// app/src/lib/subscription.ts — 구독 상태 (유료 게이트, S6 결제)
// ─────────────────────────────────────────────────────────────────────────
// 프리미엄 구독 여부 = 광고 제거·명식 무제한 등록(ADR-051)의 게이트. 진실원천 = Supabase profiles.is_premium.
//   결제(RevenueCat) 성공 → 웹훅이 profiles.is_premium 갱신(추후) → 이 훅이 재조회. 수동 부여(오너·체험)도 같은 컬럼.
//   ※ isPremium 은 Edge LLM 호출을 *유발하지 않는다*(유료 통변은 useEntitlement 별도) → 절대0 정합 유지.
//   미로그인 = 항상 false(엔타이틀먼트는 계정 귀속). RLS "own profile"(id=auth.uid())로 본인 행만 읽음.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from './supabase';
import { purchasePremiumRC, isPremiumActiveRC } from './purchases';

export function useSubscription() {
  const { session } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  // 프리미엄 = 서버(profiles.is_premium, 웹훅이 갱신) OR RC customerInfo(구매 직후 즉시 반영).
  const fetchPremium = useCallback(async () => {
    if (!session?.user) { setIsPremium(false); setLoading(false); return; }
    const [profile, rc] = await Promise.all([
      supabase.from('profiles').select('is_premium').eq('id', session.user.id).maybeSingle(),
      isPremiumActiveRC(),
    ]);
    setIsPremium((!profile.error && !!profile.data?.is_premium) || rc);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    let alive = true; setLoading(true);
    fetchPremium().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchPremium]);

  return { isPremium, loading, purchasePremium, refresh: fetchPremium };
}

// 프리미엄 구매 — RevenueCat 구독. 성공 시 웹훅이 profiles.is_premium 갱신(서버 권위) + RC가 즉시 반영.
//   ※ 로그인 게이트는 호출처(requireLoginForPurchase) — 구매는 계정(appUserID)에 귀속돼야 저장됨.
//   취소는 'cancelled' throw → 호출처에서 조용히 무시.
export async function purchasePremium(): Promise<void> {
  const ok = await purchasePremiumRC();        // 키 미설정 시 '준비 중' throw
  if (!ok) throw new Error('cancelled');
}
