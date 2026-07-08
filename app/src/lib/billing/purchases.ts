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

/** 프리미엄(평생) 구매 → 활성 성공 시 true. 사용자 취소 시 false. */
export async function purchasePremiumRC(): Promise<boolean> {
  if (!purchasesEnabled()) throw new Error('결제가 아직 준비 중이에요.');
  if (!isOnline()) throw new Error('인터넷 연결이 필요해요. 연결한 뒤 다시 시도해 주세요.'); // daniel: 오프라인 구매 차단(결제만 되고 미반영되는 상태 방지)
  // ★상품 직접 구매(오퍼링/패키지 경유 X) — RC 오퍼링의 Lifetime 패키지가 placeholder 상품(lifetime)에
  //   묶여 있어 평생 프리미엄 구매가 실패하던 문제 우회(rc-setup 404). 이용권과 동일하게 premium_lifetime 직접.
  const products = await Purchases.getProducts([PRODUCT_PREMIUM]);
  if (!products.length) throw new Error('상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct(products[0]);
    const ok = !!customerInfo.entitlements.active[ENTITLEMENT_PREMIUM];
    logEvent('purchase_premium', { product: PRODUCT_PREMIUM, ok }); // 결제 성공 로그(배포 필수)
    return ok;
  } catch (e: any) {
    if (e?.userCancelled) { logEvent('purchase_premium_cancel', { product: PRODUCT_PREMIUM }); return false; }
    logEvent('purchase_premium_fail', { product: PRODUCT_PREMIUM, message: String(e?.message ?? e) }, 'error');
    throw e;
  }
}

/** 소비성(상품 id) 구매 — 성공 시 true(결제 완료). 취소 시 false. */
export async function purchaseConsumableRC(productId: string): Promise<boolean> {
  if (!purchasesEnabled()) throw new Error('결제가 아직 준비 중이에요.');
  if (!isOnline()) throw new Error('인터넷 연결이 필요해요. 연결한 뒤 다시 시도해 주세요.'); // daniel: 오프라인 구매 차단(결제만 되고 미반영되는 상태 방지)
  const products = await Purchases.getProducts([productId]);
  if (!products.length) throw new Error('상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
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

/** 영역별 이용권(소비성) 구매 — 성공 시 true. 호출처가 성공 시 grantCredit(kind)로 크레딧 반영(웹훅 전 MVP). */
export async function purchaseCreditRC(kind: CreditKind): Promise<boolean> {
  return purchaseConsumableRC(CREDIT_PRODUCT[kind]);
}

// ★재통변 할인 상품ID(daniel 07-08 통일 모델·ⓑ 콘텐츠별): 기존 이용권 SKU + 티어 접미(_r30 프리미엄 30% / _r10 일반 10%).
//   rc-webhook 이 접미를 떼어 같은 kind 로 적립 → 재생성. ★가격은 스토어 등록가(정가×0.7/0.9) — asc-iap.js 가 정가에서 파생 생성(가격 변동 대비).
export function renewalCreditProductId(kind: CreditKind, isPremium: boolean): string {
  return `${CREDIT_PRODUCT[kind]}${isPremium ? '_r30' : '_r10'}`;
}

/** 운세형 콘텐츠 구매 1년 후 재통변(할인) 구매 — 성공 시 true. 웹훅이 kind 이용권 적립 → 호출처가 최신 모델로 재생성. */
export async function purchaseContentRenewalRC(kind: CreditKind, isPremium: boolean): Promise<boolean> {
  return purchaseConsumableRC(renewalCreditProductId(kind, isPremium));
}

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
