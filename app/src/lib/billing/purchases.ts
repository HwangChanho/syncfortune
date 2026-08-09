// app/src/lib/purchases.ts — 인앱결제(RevenueCat) 래퍼
// ─────────────────────────────────────────────────────────────────────────
// 프리미엄(비소모성 평생) + 이용권(소비성, 영역별). RevenueCat이 영수증 검증 대행.
//   서버 권위: RevenueCat Webhook → Edge(rc-webhook) → profiles.is_premium / entitlement_credits 동기화
//   (appUserID=Supabase user.id). 웹훅 도입 전까지는 클라가 구매 성공 직후 직접 반영(신뢰 기반 MVP).
//   ⚠️ react-native-purchases = *네이티브 모듈* → 미포함 빌드(재빌드 전 dev client)에서 정적 import 크래시.
//      반드시 lazy require 가드(network.ts/ads.ts 와 동일 패턴). 모듈/키 없으면 전 함수 안전 no-op.
//   ⚠️ RC SDK 공개키는 클라 임베드 안전(공개용). 키 미설정(EXPO_PUBLIC_RC_*) 시 결제 UI는 '준비 중' 폴백.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import { APP_BUILD } from '../core/buildInfo'; // 진단에 빌드번호(어떤 빌드가 낸 로그인지 추론하지 않으려고)
import type { CreditKind } from './coupons';
import { isOnline } from '../backend/network'; // daniel: 네트워크/서버 미연결 시 구매 차단(결제 후 미반영·실패상태 방지)
import { logEvent } from '../backend/logger'; // ★결제 이벤트 로그(배포 필수 — daniel 07-02)
import { assertReadingAvailable } from './llmHealth'; // ★결제 전 Anthropic 크레딧/헬스 확인(daniel 07-21) — 죽었으면 과금 차단

/**
 * 우리가 실제로 쓰는 RevenueCat SDK 표면만 선언한 **타입 파사드**.
 *
 * 왜 만들었나 (2026-08-09 · 안드로이드 결제 3일 사고의 구조적 원인):
 *   네이티브 모듈을 lazy require 하면서 `Purchases: any` 로 뒀더니 **tsc 가 아무것도 못 잡았다.**
 *   그 결과 두 번이나 조용히 틀렸다 —
 *     ① `getProducts(ids)` 를 타입 없이 호출 → 기본값 `subs` 로 조회 → 코인이 영영 안 잡힘(근본 원인)
 *     ② `setLogHandler(({logLevel,message})=>…)` 로 구조분해 → 실제는 위치 인자 2개 → 전부 undefined
 *
 * ★★핵심 안전장치: **`getProducts` 의 `type` 을 필수 인자로 선언**했다.
 *   SDK 원본은 optional 이고 기본값이 `subs` 라 위험하다 — 파사드에서 required 로 바꿔
 *   **빠뜨리면 컴파일이 안 되게** 만든다(문법으로 막는 게 grep 하네스보다 강하다).
 *
 * ⚠️이 선언은 SDK 타이핑과 **손으로 맞춘 것**이다. 메서드를 추가할 때는
 *   `app/node_modules/react-native-purchases/dist/purchases.d.ts` 를 열어 시그니처를 대조할 것.
 */
type RCProduct = { identifier: string; priceString?: string };
type RCApi = {
  configure(o: { apiKey: string; appUserID?: string }): void;
  isConfigured(): Promise<boolean>;
  isAnonymous(): Promise<boolean>;
  getAppUserID(): Promise<string>;
  logIn(id: string): Promise<unknown>;
  logOut(): Promise<unknown>;
  getCustomerInfo(): Promise<{ originalAppUserId?: string; entitlements: { active: Record<string, unknown> } }>;
  getStorefront(): Promise<{ countryCode?: string } | null>;
  canMakePayments(): Promise<boolean>;
  getOfferings(): Promise<{ all?: Record<string, unknown>; current?: { identifier?: string } | null }>;
  /** ★type 필수 — SDK 는 optional(기본 'subs')이지만 여기선 못 빠뜨리게 막는다. */
  getProducts(ids: string[], type: 'inapp' | 'subs'): Promise<RCProduct[]>;
  purchaseStoreProduct(p: RCProduct): Promise<unknown>;
  restorePurchases(): Promise<{ entitlements: { active: Record<string, unknown> } }>;
  /** ★위치 인자 2개 — 객체 구조분해 아님(dist/callbackTypes.d.ts:36). */
  setLogHandler(h: (logLevel: unknown, message: unknown) => void): void;
  setLogLevel(level: unknown): Promise<void>;
  LOG_LEVEL: Record<string, unknown>;
};

// 네이티브 모듈 lazy require — 미포함 빌드에서 정적 import 크래시 방지(필수 가드).
let Purchases: RCApi = null as unknown as RCApi;   // 미포함 빌드에선 null — purchasesEnabled() 가 먼저 막는다
try { Purchases = require('react-native-purchases').default as RCApi; } catch { Purchases = null as unknown as RCApi; }

// RevenueCat 공개 SDK 키 — daniel: RevenueCat 대시보드 → Project → API Keys(Apple/Google 앱별).
const RC_KEY = Platform.OS === 'ios'
  ? (process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '')
  : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '');

// Entitlement(프리미엄)·상품 식별자 — RevenueCat·App Store Connect와 1:1. 가격은 스토어에서 설정(id엔 가격 안 박음).
export const ENTITLEMENT_PREMIUM = 'premium';
export const PRODUCT_PREMIUM = 'premium_lifetime';  // 비소모성(평생 프리미엄 ₩49,900)

// 영역별 이용권(소비성) 상품 id — CreditKind ↔ 스토어 상품(1:1).
//   가격: 사주6900·자미4900·궁합3900·애정4900·타임라인990·추가질문990·신년6900·인생그래프3900 (CREDIT_KINDS.price, ASC에서 설정).
export const CREDIT_PRODUCT: Record<CreditKind, string> = {
  reading: 'credit_reading',
  ziwei: 'credit_ziwei',
  compat: 'credit_compat',
  love: 'credit_love',
  timeline: 'credit_timeline',
  followup: 'credit_followup',
  newyear: 'credit_newyear',     // 신년운세 ₩6,900 (스페셜)
  lifegraph: 'credit_lifegraph', // 인생 그래프 ₩3,900 (스페셜)
  roots: 'credit_roots',         // 명식의 뿌리 ₩4,900
  image: 'credit_image',         // 비치는 나 ₩4,900
  mission: 'credit_mission',     // 나의 사명 ₩6,900
  career: 'credit_career',       // 사업가의 나 vs 직장인의 나 ₩4,900
  talent: 'credit_talent',       // 나의 타고난 재능 ₩4,900(월지 축) — ⚠️ASC/RC에 credit_talent 상품 등록 필요(daniel)
  astrology: 'credit_astrology',   // 별자리 운세 ₩4,900 — ⚠️ASC/RC 상품 등록 필요(daniel)
  dream: 'credit_dream',         // AI 꿈해몽 — 단건 ₩500은 Apple IAP 최저가 미만 → 5회 번들(₩2,500) 상품으로 판매(daniel 06-28)
  gaeun: 'credit_gaeun',         // 맞춤 개운법 ₩4,900 — ⚠️ASC/RC 상품 등록 필요(daniel)
  celeb: 'credit_celeb',         // 세계 인물 매칭 ₩1,200 — ⚠️ASC/RC 상품 등록 필요(daniel)
  timeresolve: 'credit_timeresolve', // 태어난 시 찾기(TPR) ₩990 — ⚠️ASC/RC 상품 등록 필요(daniel)
  future10: 'credit_future10',   // 10년 뒤 나의 모습 — ⚠️ASC/RC 상품 등록 필요(daniel)
  child: 'credit_child',         // 자식운(프리미엄 포함, 비프리미엄 개별) — ⚠️ASC/RC 상품 등록 필요(daniel)
  child_couple: 'credit_child_couple', // 자식운 · 부부(솔로 소유자 반값 업그레이드 ₩4,950) — ⚠️ASC/RC 상품 등록 필요(daniel)
  reunion: 'credit_reunion',     // 재회운(옛 인연·도화-충 timing) ₩4,900 — ⚠️ASC/RC 상품 등록 필요(daniel)
  crush: 'credit_crush',         // 짝사랑 인연운(인연星·도화 발동 timing) ₩4,900 — ⚠️ASC/RC 상품 등록 필요(daniel)
  job: 'credit_job',             // 취업·이직운(관성·인성 발동 timing) ₩4,900 — ⚠️ASC/RC 상품 등록 필요(daniel)
  jobfit: 'credit_jobfit',       // 나에게 어울리는 직업(직업 적성 딥리포트 EEL) ₩4,900 — ⚠️ASC/RC 상품 등록 필요(daniel)
  wealth: 'credit_wealth',       // 재물 딥리포트(그릇/유형/시기/처방 4축 EEL) ₩4,900 — ⚠️ASC/RC 상품 등록 필요(daniel)
  // 인생 타임라인 세운 번들(daniel 2026-07-23) — 결제 1건이 fungible 'timeline' 크레딧을 5·10개 적립(rc-webhook BUNDLE). ⚠️ASC/RC 상품 등록 필요(daniel)
};

// AI 꿈해몽: 단건 ₩500이 Apple IAP 최저가(~₩1,200) 미만이라 **5회 번들**(₩2,500, ≈₩500/회)로 판매(daniel 06-28).
//   구매 1회 = DREAM_BUNDLE_QTY 크레딧 적립(다른 이용권은 1:1, dream만 번들). grantCredit('dream', DREAM_BUNDLE_QTY).
export const DREAM_BUNDLE_QTY = 5;


// ⚠️ deprecated(구 단일가 건당) — 영역별 CREDIT_PRODUCT 로 이행. entitlement.ts 하위호환 위해 유지.
export const PRODUCT_UNLOCK_2500 = 'unlock_2500';
export const PRODUCT_UNLOCK_4900 = 'unlock_4900';

let configured = false;

/** RC 사용 가능 여부(네이티브 모듈 포함 + 키 설정됨). 아니면 결제 UI는 '준비 중' 폴백. */
export function purchasesEnabled(): boolean {
  return !!Purchases && !!RC_KEY;
}

/** 앱 시작/로그인 시 1회 — RC 초기화 + Supabase 유저 연결(appUserID). 모듈/키 없으면 no-op. */
/**
 * RevenueCat SDK 가 내부적으로 찍는 로그의 **최근 몇 줄**을 담아 두는 링버퍼.
 *
 * 왜: `getProducts` 는 실패해도 **빈 배열**만 주고, `getOfferings` 의 에러 객체는 RN 브리지를 건너오며
 *   상세 메시지(`underlyingErrorMessage`)가 **빈 문자열로 유실된다**(2026-08-09 실측).
 *   그래서 원인이 로그에 남지 않았다 — 코드 23("설정 문제")만 보이고 *무엇이* 문제인지는 안 보였다.
 *   SDK 는 BillingClient 응답(예: 상품 조회 응답 코드·사유)을 **자기 로그로는 찍는다** → 그걸 가로채 서버로 보낸다.
 * ★민감정보는 담기지 않는다(SDK 진단 문자열). 길이·줄 수를 제한해 로그 폭주를 막는다.
 */
/**
 * ★★상품 조회 타입 — **반드시 명시한다**(2026-08-09 실측으로 잡은 근본 원인).
 *
 * `Purchases.getProducts(ids, type?)` 의 **기본값은 `subs`(구독)** 다(타이핑 원문: "Subs by default").
 * 우리 상품은 코인 4종 = **전부 일회성(consumable)** 이라, 타입을 안 넘기면 Google Play 가
 * 구독 카탈로그에서 찾다가 못 찾고 **빈 배열**을 준다 — 그게 안드로이드 결제가
 * 단 한 번도 성공하지 못한 이유였다.
 *   실측 SDK 로그: `UnfetchedProduct{productId='coin_100', productType='subs', statusCode=3}`
 *                  `Product not found: coin_100 - Product Type: subs, Reason: PRODUCT_NOT_FOUND`
 * ⚠️iOS 는 StoreKit 이 이 구분을 안 해서 **그대로 동작했다** — 그래서 플랫폼 차이로만 보였고
 *   Play·RevenueCat 설정을 며칠 뒤졌다. 설정은 처음부터 전부 정상이었다.
 */
const PRODUCT_TYPE_INAPP = 'inapp';   // PURCHASE_TYPE.INAPP — Purchases 가 any 라 리터럴로 둔다

const RC_LOG_MAX = 12;
const rcLog: string[] = [];
/** 최근 SDK 로그를 오래된 것부터 이어붙인 문자열(진단 payload 용). */
export function rcRecentLogs(): string {
  return rcLog.join(' | ').slice(0, 900);
}

export function configurePurchases(appUserId?: string): void {
  if (!purchasesEnabled()) return;
  try {
    if (!configured) {
      // ★진단(2026-08-09): SDK 로그를 가로채 링버퍼에 담는다. configure **전에** 걸어야 초기 로그도 잡힌다.
      //   VERBOSE 로 올리는 이유 = 상품 조회 실패 사유는 debug/verbose 급에서만 찍힌다.
      try {
        // ⚠️시그니처는 **위치 인자 두 개**다 — `LogHandler = (logLevel, message) => void`.
        //   처음엔 `({logLevel, message})` 로 구조분해해 전부 undefined 가 찍혔다(2026-08-09 실측).
        //   ★그때 파라미터에 내 추측 타입을 직접 달아 **tsc 가 잡을 기회를 없앴다**.
        //     콜백 인자는 주석 달지 말고 **라이브러리 타입이 흘러들어오게** 둘 것.
        //   ★`Purchases` 는 `any` 다(런치 크래시 회피용 lazy require·18행) → **타입이 흐르지 않는다**.
        //     그래서 잘못된 시그니처를 tsc 가 잡아 주지 못한다. SDK 타이핑을 눈으로 대조해 맞춘 것:
        //     `@revenuecat/purchases-typescript-internal` callbackTypes.d.ts:36
        //     `export type LogHandler = (logLevel: LOG_LEVEL, message: string) => void;`
        Purchases.setLogHandler((logLevel: unknown, message: unknown) => {
          rcLog.push(`${String(logLevel)}:${String(message).slice(0, 160)}`);
          if (rcLog.length > RC_LOG_MAX) rcLog.shift();   // 오래된 것부터 버린다
        });
        void Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
      } catch { /* 진단이 본 기능을 막지 않는다 */ }
      Purchases.configure({ apiKey: RC_KEY, appUserID: appUserId });
      configured = true;
    } else if (appUserId) {
      Purchases.logIn(appUserId).catch(() => {});
    }
  } catch { /* 설정 실패해도 앱은 무탈 */ }
}

/** 로그아웃 시 RC 익명화. */
export async function logoutPurchases(): Promise<void> {
  if (!purchasesEnabled() || !configured) return;
  try { await Purchases.logOut(); } catch { /* ignore */ }
}

/** 현재 프리미엄 활성 여부 — RC customerInfo 기준. */
export async function isPremiumActiveRC(): Promise<boolean> {
  if (!purchasesEnabled()) return false;
  try {
    const ci = await Purchases.getCustomerInfo();
    return !!ci.entitlements.active[ENTITLEMENT_PREMIUM];
  } catch { return false; }
}

// ★purchasePremiumRC 제거(daniel 2026-07-30 전수조사).
//   프리미엄은 07-28 폐지됐고(`PREMIUM_ENABLED=false`), 상품 `premium_lifetime` 은 **Play 에 등록돼 있지도 않다**.
//   그런데 register.tsx '업그레이드' 버튼이 이 함수를 **실제로 호출**하고 있었다 → 누르면 "상품을 불러오지 못했어요".
//   즉 죽은 코드가 아니라 **살아 있는 깨진 결제 경로**였다. 구매 경로만 지우고, 과거 구매자 판정
//   (isPremiumActiveRC·ENTITLEMENT_PREMIUM)과 복원(restorePurchasesRC)은 그대로 둔다(이력 보존).

/**
 * 결제 **전 과정 자가진단** — 한 번의 실패로 전체 그림을 보기 위한 것(daniel 2026-08-09
 * "한번에 전체 프로세스 확인 가능하게 로깅해서 올려").
 *
 * 왜 이렇게 바꿨나: 진단을 조각으로 붙이다 **세 번 헛돌았다**(폴백 순서로 원인 문장 유실 →
 *   RN 브리지가 상세 메시지를 빈 값으로 넘김 → 로그 콜백 시그니처 오류). 매번 Boss 가 다시 눌러야 했다.
 *   ⇒ 단계마다 결과·소요시간·에러를 **각각** 남기고 **한 이벤트**로 올린다. 한 번 누르면 끝나게.
 *
 * ★단계는 전부 개별 try/catch — 하나가 죽어도 나머지는 계속 수집한다(진단이 진단을 막으면 안 된다).
 * ★`getStorefront`(스토어 국가)와 `canMakePayments`(결제 가능 여부)가 핵심이다:
 *   상품이 **KR 단독 판매**라 스토어 국가가 KR 이 아니면 그것만으로 0개가 된다.
 *
 * @param productId 사용자가 실제로 누른 상품 id
 * @returns 로그 payload 로 그대로 올릴 평평한 객체. **절대 throw 하지 않는다.**
 */
async function runBillingSelfTest(productId: string): Promise<Record<string, unknown>> {
  const d: Record<string, unknown> = {
    build: APP_BUILD,
    platform: Platform.OS,
    askedFor: productId,
    keyPrefix: RC_KEY.slice(0, 5),      // 키 자체는 남기지 않는다(앞 5자로 플랫폼만 확인)
    keyLen: RC_KEY.length,
    enabled: purchasesEnabled(),
    online: isOnline(),
  };
  /** 한 단계를 재고 결과·소요시간·에러를 각각 남긴다. */
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const v = await fn();
      d[name] = v;
    } catch (e: any) {
      d[`${name}Err`] = String(e?.message ?? e).slice(0, 200);
      d[`${name}Code`] = e?.code ?? null;
    }
    d[`${name}Ms`] = Date.now() - t0;
  };

  await step('configured', () => Purchases.isConfigured());
  await step('appUserId', async () => String(await Purchases.getAppUserID() ?? '').slice(0, 40));
  await step('anon', () => Purchases.isAnonymous());
  // ★스토어 국가 — 상품이 KR 단독이라 여기가 KR 이 아니면 그 자체가 원인이다.
  await step('storefront', async () => JSON.stringify(await Purchases.getStorefront() ?? null).slice(0, 120));
  // ★이 기기에서 결제 자체가 가능한가(Play Billing 연결 상태).
  await step('canPay', () => Purchases.canMakePayments());
  await step('offerings', async () => {
    const o = await Purchases.getOfferings();
    return `all=${Object.keys(o?.all ?? {}).length} cur=${o?.current?.identifier ?? '-'}`;
  });
  await step('one', async () => (await Purchases.getProducts([productId], PRODUCT_TYPE_INAPP)).length);
  await step('four', async () => {
    const got = await Purchases.getProducts(['coin_100', 'coin_300', 'coin_600', 'coin_1200'], PRODUCT_TYPE_INAPP);
    return `${got.length}:${got.map((x: { identifier: string }) => x.identifier).join(',')}`;
  });
  // 구독 타입으로도 물어본다 — INAPP 만 0 인지, 스토어 연결 자체가 죽었는지 가른다.
  // 대조군: 구독 타입으로 물으면 0 이어야 정상이다(코인은 구독이 아니므로).
  await step('fourSub', async () => (await Purchases.getProducts(['coin_100'], 'subs')).length);

  d.rcLog = rcRecentLogs();   // ★SDK 가 스스로 찍은 로그(BillingClient 응답 등)
  return d;
}

/** 소비성(상품 id) 구매 — 성공 시 true(결제 완료). 취소 시 false. */
export async function purchaseConsumableRC(productId: string): Promise<boolean> {
  if (!purchasesEnabled()) throw new Error('결제가 아직 준비 중이에요.');
  if (!isOnline()) throw new Error('인터넷 연결이 필요해요. 연결한 뒤 다시 시도해 주세요.'); // daniel: 오프라인 구매 차단(결제만 되고 미반영되는 상태 방지)
  // ★결제 전 Anthropic 크레딧/헬스 확인(Boss 07-21) — 소비성 이용권은 전부 LLM 풀이라, 클로드가 확실히
  //   죽었으면(크레딧 소진·키 off·수동 점검) *과금 전에* 막는다. 확실한 불가만 throw, 일시장애는 통과(백스톱=생성실패 환불).
  //   기존 두 가드(준비중·오프라인)와 동일하게 throw → 호출부 catch 가 Alert(e.message)로 표출.
  await assertReadingAvailable();
  const products = await Purchases.getProducts([productId], PRODUCT_TYPE_INAPP);
  if (!products.length) {
    // ★여기서 막히면 **아무 로그도 안 남았다**(daniel 2026-08-07 "안드로이드 결제가 안돼").
    //   실측: app_logs 에 android 결제 기록이 성공·실패 **양쪽 다 0건** — 즉 purchaseStoreProduct 에
    //   도달조차 못 하고 이 줄에서 죽고 있었는데, 화면엔 "상품을 불러오지 못했어요"만 뜨고 원인은 어디에도 안 남았다.
    //   (07-26 푸시 `catch {}`, 08-07 push-dispatch 거부사유 폐기와 **같은 계열의 사고**.)
    //   스토어가 상품을 0개로 주는 경우는 원인이 갈리므로(설치 경로·테스터 등록·상품 상태) 반드시 남긴다.
    //   ★2026-08-09 진단 보강(daniel "안드로이드 결제가 여전히 안된대"):
    //     "0개"만 남으면 원인이 셋(설치 경로·테스터 등록·RC 매핑) 중 어느 것인지 못 가른다 —
    //     실제로 이 로그 2건을 보고도 원격에서 좁히지 못했다. **다음 실패 한 번으로 확정되게** 재료를 같이 남긴다.
    //     ⚠️진단 수집이 실패해도 원래 에러를 삼키지 않는다(진단이 본 기능을 망치면 안 된다) — 전부 개별 catch.
    const diag = await runBillingSelfTest(productId);
    logEvent('purchase_products_empty', diag, 'error');
    throw new Error('상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  try {
    await Purchases.purchaseStoreProduct(products[0]);
    logEvent('purchase_consumable', { productId, ok: true }); // 이용권 결제 성공 로그(배포 필수)
    return true;
  } catch (e: any) {
    if (e?.userCancelled) { logEvent('purchase_consumable_cancel', { productId }); return false; }
    logEvent('purchase_consumable_fail', { productId, message: String(e?.message ?? e) }, 'error');
    throw e;
  }
}

// ★purchaseCreditRC 제거(daniel 2026-07-30 전수조사) — **실제 호출부 0건**이었다(import 만 6개 파일에 남아 있었다).
//   07-28 코인 단일화폐 전환으로 콘텐츠는 전부 코인(ensureCoinsFor)으로 열린다. 스토어 건당 결제 경로는 없다.
//   ⚠️`CREDIT_PRODUCT` 맵 자체는 남긴다 — `check:credit`(드리프트 하네스)와 rc-webhook 적립 매핑의 참조점이다.

/**
 * 코인 팩 구매(daniel 2026-07-28 코인 전환) — 성공 시 true, 사용자가 취소하면 false.
 * @param packId ASC 에 등록한 소비형 상품 id(coin_100·coin_300·coin_600·coin_1200)
 *
 * ★적립은 이 함수가 하지 않는다 — RevenueCat 웹훅이 영수증 검증 후 `grant_coins` 로 적립한다.
 *   클라가 잔액을 올릴 수 있으면 그 자체가 결제 우회다(2026-07-03 C1 취약점과 같은 형태).
 *   그래서 호출측은 구매 성공 후 **잔액을 다시 조회**해 반영을 확인한다.
 */
export async function purchaseCoinPack(packId: string): Promise<boolean> {
  return purchaseConsumableRC(packId);
}

// ★renewalCreditProductId · purchaseContentRenewalRC 제거(daniel 2026-07-30 "재통변은 코인으로 바꿔").
//   `credit_<kind>_r30/_r10` 할인 SKU 를 스토어에서 사던 경로다. 두 가지 이유로 성립하지 않았다:
//   ①그 SKU 는 **Play 에 등록조차 없다**(07-30 코인 단일화폐로 확정 — 등록 안 함)
//   ②할인율이 프리미엄 티어로 갈렸는데 프리미엄은 07-28 폐지됐다(PREMIUM_ENABLED=false)
//   → 재통변은 코인으로 낸다: 청구·차감은 **Edge interpret**(renewConfirm 동의 필요), 흐름은 `billing/renewal.ts`.

/** 구매 복원(App Store 필수) → 프리미엄 활성 여부 반환. */
export async function restorePurchasesRC(): Promise<boolean> {
  if (!purchasesEnabled()) return false;
  const ci = await Purchases.restorePurchases();
  const premium = !!ci.entitlements.active[ENTITLEMENT_PREMIUM];
  logEvent('purchase_restore', { premium }); // 복원 결과 로그
  return premium;
}

/** 현지 통화 가격 문자열(상품). 없으면 fallback. */
export async function priceStringRC(productId: string, fallback: string): Promise<string> {
  if (!purchasesEnabled()) return fallback;
  try {
    const products = await Purchases.getProducts([productId], PRODUCT_TYPE_INAPP);
    return products[0]?.priceString ?? fallback;
  } catch { return fallback; }
}

/** 여러 상품의 현지 통화 가격 일괄 조회 — { productId: priceString }. RC 미설정/실패 시 빈 객체(호출처가 ₩ 폴백). */
export async function priceStringsRC(productIds: string[]): Promise<Record<string, string>> {
  if (!purchasesEnabled()) return {};
  try {
    const products = await Purchases.getProducts(productIds, PRODUCT_TYPE_INAPP);
    return Object.fromEntries(products.map((p: any) => [p.identifier, p.priceString]));
  } catch { return {}; }
}
