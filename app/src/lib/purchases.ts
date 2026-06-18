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
};

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
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages?.[0];
  if (!pkg) throw new Error('상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active[ENTITLEMENT_PREMIUM];
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

/** 소비성(상품 id) 구매 — 성공 시 true(결제 완료). 취소 시 false. */
export async function purchaseConsumableRC(productId: string): Promise<boolean> {
  if (!purchasesEnabled()) throw new Error('결제가 아직 준비 중이에요.');
  const products = await Purchases.getProducts([productId]);
  if (!products.length) throw new Error('상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  try {
    await Purchases.purchaseStoreProduct(products[0]);
    return true;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

/** 영역별 이용권(소비성) 구매 — 성공 시 true. 호출처가 성공 시 grantCredit(kind)로 크레딧 반영(웹훅 전 MVP). */
export async function purchaseCreditRC(kind: CreditKind): Promise<boolean> {
  return purchaseConsumableRC(CREDIT_PRODUCT[kind]);
}

/** 구매 복원(App Store 필수) → 프리미엄 활성 여부 반환. */
export async function restorePurchasesRC(): Promise<boolean> {
  if (!purchasesEnabled()) return false;
  const ci = await Purchases.restorePurchases();
  return !!ci.entitlements.active[ENTITLEMENT_PREMIUM];
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
