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
import type { CreditKind } from './coupons';
import { isOnline } from '../backend/network'; // daniel: 네트워크/서버 미연결 시 구매 차단(결제 후 미반영·실패상태 방지)
import { logEvent } from '../backend/logger'; // ★결제 이벤트 로그(배포 필수 — daniel 07-02)
import { assertReadingAvailable } from './llmHealth'; // ★결제 전 Anthropic 크레딧/헬스 확인(daniel 07-21) — 죽었으면 과금 차단

// 네이티브 모듈 lazy require — 미포함 빌드에서 정적 import 크래시 방지(필수 가드).
let Purchases: any = null;
try { Purchases = require('react-native-purchases').default; } catch { Purchases = null; }

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
export function configurePurchases(appUserId?: string): void {
  if (!purchasesEnabled()) return;
  try {
    if (!configured) {
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
 * 스토어가 상품을 0개로 준 **원인을 가르기 위한** 재료 수집(진단 전용).
 *
 * 왜 필요한가: `getProducts` 는 실패해도 **throw 하지 않고 빈 배열**을 준다. 그래서 로그에 "0개"만 남고
 *   원인(①Play 가 아닌 경로로 설치 ②테스터 미등록 ③RC 상품 매핑)이 구분되지 않는다.
 *   아래 값들이 그 셋을 가른다:
 *   · `offeringsErr` — RC 가 스토어와 통신하며 받은 **에러 코드**. 설정/스토어 문제면 여기에 뜬다.
 *   · `allCoins` — 코인 4종을 한꺼번에 조회했을 때 **몇 개**가 오는지.
 *     0 이면 스토어 연결 자체 문제(설치 경로·테스터), 일부만 오면 상품별 설정 문제다.
 *   · `rcUserId`/`rcAnon` — 어느 RC 사용자로 붙었는지(계정 뒤섞임 확인).
 *
 * @param productId 실패한 상품 id
 * @returns 로그에 펼쳐 넣을 평평한 객체. **절대 throw 하지 않는다.**
 */
async function collectStoreDiag(productId: string): Promise<Record<string, unknown>> {
  const d: Record<string, unknown> = {};
  // ① RC 오퍼링 — getProducts 와 달리 실패 시 에러를 던지므로 코드/메시지를 얻을 수 있다.
  try {
    const off = await Purchases.getOfferings();
    d.offerings = Object.keys(off?.all ?? {}).length;
    d.offeringCurrent = off?.current?.identifier ?? null;
  } catch (e: any) {
    // ★2026-08-09 2차 수정: 처음엔 `code ?? underlyingErrorMessage ?? message` 로 적었는데
    //   code(23)가 있으면 거기서 끊겨 **정작 원인을 말해 주는 문장을 버렸다**.
    //   RevenueCat 은 `underlyingErrorMessage` 에 "왜 못 가져왔는지"를 담는다
    //   (예: "None of the products registered in the RevenueCat dashboard could be fetched from Google Play").
    //   ⇒ 셋을 **각각** 남긴다. 진단은 하나로 합치는 순간 정보가 준다.
    d.offErrCode = e?.code ?? null;
    d.offErrUnderlying = String(e?.underlyingErrorMessage ?? '').slice(0, 300);
    d.offErrMessage = String(e?.message ?? '').slice(0, 300);
  }
  // ② 코인 4종 일괄 조회 — 전부 0인지 일부만 0인지가 원인을 가른다.
  try {
    const ids = ['coin_100', 'coin_300', 'coin_600', 'coin_1200'];
    const got = await Purchases.getProducts(ids);
    d.allCoins = got.length;
    d.allCoinIds = got.map((x: { identifier: string }) => x.identifier).join(',');
  } catch (e: any) {
    d.allCoinsErr = String(e?.message ?? e).slice(0, 200);
    d.allCoinsUnderlying = String(e?.underlyingErrorMessage ?? '').slice(0, 300);
  }
  // ③ 어느 RC 사용자로 붙어 있나(계정 뒤섞임·익명 여부).
  try {
    const ci = await Purchases.getCustomerInfo();
    d.rcUserId = String(ci?.originalAppUserId ?? '').slice(0, 40);
    d.rcAnon = String(ci?.originalAppUserId ?? '').startsWith('$RCAnonymous');
  } catch (e: any) {
    d.rcUserErr = String(e?.message ?? e).slice(0, 120);
  }
  d.askedFor = productId;
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
  const products = await Purchases.getProducts([productId]);
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
    const diag = await collectStoreDiag(productId);
    logEvent('purchase_products_empty', { productId, platform: Platform.OS, ...diag }, 'error');
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
    const products = await Purchases.getProducts([productId]);
    return products[0]?.priceString ?? fallback;
  } catch { return fallback; }
}

/** 여러 상품의 현지 통화 가격 일괄 조회 — { productId: priceString }. RC 미설정/실패 시 빈 객체(호출처가 ₩ 폴백). */
export async function priceStringsRC(productIds: string[]): Promise<Record<string, string>> {
  if (!purchasesEnabled()) return {};
  try {
    const products = await Purchases.getProducts(productIds);
    return Object.fromEntries(products.map((p: any) => [p.identifier, p.priceString]));
  } catch { return {}; }
}
