// app/src/lib/subscription.ts — 구독 상태 (유료 게이트, S6 결제)
// ─────────────────────────────────────────────────────────────────────────
// 프리미엄 구독 여부 = 유료 통변·저장의 게이트. 진실원천 = 스토어 결제(RevenueCat).
// P0 골격: 인터페이스만 — RevenueCat SDK(react-native-purchases) 연동은 daniel(스토어 계정·상품·API키) 후.
//   isPremium 미러는 Supabase profiles(RevenueCat webhook) 또는 Purchases.getCustomerInfo 로 채운다(TODO).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export function useSubscription() {
  const { session } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO(daniel 연동): RevenueCat Purchases.getCustomerInfo() → entitlements.active['premium'] 여부
    //   또는 Supabase profiles.is_premium(웹훅 미러) 조회. P0 = 미구독 기본
    //   (개발 중 유료경로 차단 = Edge LLM 호출 안 됨 = 절대0 정합).
    setIsPremium(false);
    setLoading(false);
  }, [session]);

  return { isPremium, loading, purchasePremium };
}

// 프리미엄 구매 — RevenueCat paywall/구매. daniel 연동 전엔 미구현(안내).
export async function purchasePremium(): Promise<void> {
  // TODO: RevenueCat presentPaywallIfNeeded() 또는 Purchases.purchasePackage(pkg).
  //   구매 성공 → 웹훅이 profiles.is_premium 갱신 → useSubscription 재조회.
  throw new Error('프리미엄 결제는 준비 중입니다 (RevenueCat 연동 예정).');
}
