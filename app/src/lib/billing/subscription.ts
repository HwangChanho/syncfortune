// app/src/lib/subscription.ts — 구독 상태 훅(유료 게이트·광고 제거). 전역 store(premiumStore) 구독.
// ─────────────────────────────────────────────────────────────────────────
// 프리미엄 구독 여부 = 광고 제거·명식 무제한 등록(ADR-051)의 게이트. 진실원천 = Supabase profiles.is_premium OR RC.
//   ★상태는 premiumStore(전역 단일 source) 로 관리 — 로그인/로그아웃/구매 시 refreshPremium 한 번에 전 화면 동시 반영.
//   (이전엔 화면마다 독립 useState 라 전환 시 배너·게이트가 stale 했음 — daniel 2026-06-24 수정. [[premiumStore]])
//   ※ isPremium 은 Edge LLM 호출을 *유발하지 않는다*(유료 통변은 useEntitlement 별도) → 절대0 정합 유지.
//   미로그인 = 항상 false(엔타이틀먼트는 계정 귀속). RLS "own profile"(id=auth.uid())로 본인 행만 읽음.
// ─────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { purchasePremiumRC } from './purchases';
import { subscribePremium, getPremiumSnapshot, getPremiumLoadingSnapshot, refreshPremium } from './premiumStore';

// ★★2026-07-28 프리미엄 폐지(daniel "프리미엄도 빼버려") — 코인 단일 과금으로 통일.
//   ⚠️**161곳 34파일**의 isPremium 분기를 지우지 않고 **근원에서 false 로 만든다.**
//     이유: 흩어진 수술은 반드시 어딘가를 깨뜨린다(오늘만 해도 일괄치환 오작동을 두 번 겪었다).
//     여기서 끄면 모든 분기가 자동으로 '비프리미엄'을 타고, 되돌리기도 한 줄이다.
//     획득 경로(마켓 구매·관리자 선물·ASC 상품)는 별도로 제거했다 = 아무도 새로 가질 수 없다.
//   ⚠️실구매자 확인함: premium_lifetime 구매는 **daniel 본인 계정 1건뿐**(2026-07-02) — 외부 피해 0.
const PREMIUM_ENABLED = false;

export function useSubscription() {
  const { session } = useAuth();
  // 전역 store 구독 — 어느 화면이든 동일 source. refreshPremium 호출 시 전 구독자(배너·게이트)가 동시 갱신.
  const isPremium = useSyncExternalStore(subscribePremium, getPremiumSnapshot);
  const loading = useSyncExternalStore(subscribePremium, getPremiumLoadingSnapshot);
  // 수동 갱신(구매 직후 등) — 현재 로그인 유저 기준 재평가. 세션 변경에 따른 자동 갱신은 _layout 이 담당.
  const refresh = useCallback(() => refreshPremium(session?.user?.id ?? null), [session]);
  return { isPremium: PREMIUM_ENABLED && isPremium, loading, purchasePremium, refresh };
}

// 프리미엄 구매 — RevenueCat 구독. 성공 시 웹훅이 profiles.is_premium 갱신(서버 권위) + RC가 즉시 반영.
//   ※ 로그인 게이트는 호출처(requireLoginForPurchase) — 구매는 계정(appUserID)에 귀속돼야 저장됨.
//   취소는 'cancelled' throw → 호출처에서 조용히 무시. 성공 후 호출처가 refresh() 로 전역 반영.
export async function purchasePremium(): Promise<void> {
  const ok = await purchasePremiumRC();        // 키 미설정 시 '준비 중' throw
  if (!ok) throw new Error('cancelled');
}
