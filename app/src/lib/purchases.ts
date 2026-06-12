// app/src/lib/purchases.ts — 인앱결제(RevenueCat) 래퍼
// ─────────────────────────────────────────────────────────────────────────
// 구독(프리미엄) + 소비성(건당 ₩2,500·₩4,900). RevenueCat이 영수증 검증 대행.
//   서버 권위: RevenueCat Webhook → Edge(rc-webhook) → profiles.is_premium 동기화(appUserID=Supabase user.id).
//   ⚠️ RC SDK 공개키는 클라 임베드 안전(공개용). 키 미설정(EXPO_PUBLIC_RC_*) 시 전 함수 안전 no-op → 빌드/실행 무탈.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// RevenueCat 공개 SDK 키 — daniel: RevenueCat 대시보드 → Project → API Keys(Apple/Google 앱별).
const RC_KEY = Platform.OS === 'ios'
  ? (process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '')
  : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '');

// Entitlement(구독)·상품(소비성) 식별자 — RevenueCat·App Store Connect와 1:1.
export const ENTITLEMENT_PREMIUM = 'premium';
export const PRODUCT_UNLOCK_2500 = 'unlock_2500'; // 건당 ₩2,500(풀이·궁합·타임라인·질문 공용)
export const PRODUCT_UNLOCK_4900 = 'unlock_4900'; // 건당 ₩4,900(애정흐름)

let configured = false;

/** RC 사용 가능 여부(키 설정됨). 미설정이면 결제 UI는 '준비 중'으로 폴백. */
export function purchasesEnabled(): boolean {
  return !!RC_KEY;
}

/** 앱 시작/로그인 시 1회 — RC 초기화 + Supabase 유저와 연결(appUserID). 키 없으면 no-op. */
export function configurePurchases(appUserId?: string): void {
  if (!RC_KEY) return;
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
  if (!RC_KEY || !configured) return;
  try { await Purchases.logOut(); } catch { /* ignore */ }
}

/** 현재 프리미엄(구독) 활성 여부 — RC customerInfo 기준. */
export async function isPremiumActiveRC(): Promise<boolean> {
  if (!RC_KEY) return false;
  try {
    const ci = await Purchases.getCustomerInfo();
    return !!ci.entitlements.active[ENTITLEMENT_PREMIUM];
  } catch { return false; }
}

/** 프리미엄 구독 구매 → 활성화 성공 시 true. (사용자 취소 시 false) */
export async function purchasePremiumRC(): Promise<boolean> {
  if (!RC_KEY) throw new Error('결제가 아직 준비 중이에요.');
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

/** 소비성(건당) 구매 — 성공 시 true(=결제 완료, 해당 1회 잠금 해제). 취소 시 false. */
export async function purchaseConsumableRC(productId: string): Promise<boolean> {
  if (!RC_KEY) throw new Error('결제가 아직 준비 중이에요.');
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

/** 구매 복원(App Store 필수) → 프리미엄 활성 여부 반환. */
export async function restorePurchasesRC(): Promise<boolean> {
  if (!RC_KEY) return false;
  const ci = await Purchases.restorePurchases();
  return !!ci.entitlements.active[ENTITLEMENT_PREMIUM];
}

/** 현지 통화 가격 문자열(상품). 없으면 fallback. */
export async function priceStringRC(productId: string, fallback: string): Promise<string> {
  if (!RC_KEY) return fallback;
  try {
    const products = await Purchases.getProducts([productId]);
    return products[0]?.priceString ?? fallback;
  } catch { return fallback; }
}
