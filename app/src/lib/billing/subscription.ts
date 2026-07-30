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
  return { isPremium: PREMIUM_ENABLED && isPremium, loading, refresh };
}

// ★purchasePremium 제거(daniel 2026-07-30 전수조사) — 프리미엄 폐지(PREMIUM_ENABLED=false) 이후
//   유일한 호출부였던 register.tsx '업그레이드'가 **등록도 안 된 상품**을 사려 해 항상 실패했다.
//   과거 구매자 판정(isPremium 읽기)과 복원은 남긴다 — 이력 보존.
