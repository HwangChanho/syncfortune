// app/src/lib/subscription.ts — 구독 상태 (유료 게이트, S6 결제)
// ─────────────────────────────────────────────────────────────────────────
// 프리미엄 구독 여부 = 광고 제거·명식 무제한 등록(ADR-051)의 게이트. 진실원천 = Supabase profiles.is_premium.
//   결제(RevenueCat) 성공 → 웹훅이 profiles.is_premium 갱신(추후) → 이 훅이 재조회. 수동 부여(오너·체험)도 같은 컬럼.
//   ※ isPremium 은 Edge LLM 호출을 *유발하지 않는다*(유료 통변은 useEntitlement 별도) → 절대0 정합 유지.
//   미로그인 = 항상 false(엔타이틀먼트는 계정 귀속). RLS "own profile"(id=auth.uid())로 본인 행만 읽음.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from './supabase';

export function useSubscription() {
  const { session } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // 미로그인 → 무료(엔타이틀먼트=계정 귀속). 로그인 → 본인 profiles.is_premium 조회.
    if (!session?.user) {
      setIsPremium(false);
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        // 조회 실패(네트워크·행없음)는 보수적으로 무료 처리.
        setIsPremium(!error && !!data?.is_premium);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [session]);

  return { isPremium, loading, purchasePremium };
}

// 프리미엄 구매 — RevenueCat paywall/구매. daniel 연동 전엔 미구현(안내).
export async function purchasePremium(): Promise<void> {
  // TODO: RevenueCat presentPaywallIfNeeded() 또는 Purchases.purchasePackage(pkg).
  //   구매 성공 → 웹훅이 profiles.is_premium 갱신 → useSubscription 재조회.
  throw new Error('프리미엄 결제는 준비 중입니다 (RevenueCat 연동 예정).');
}
