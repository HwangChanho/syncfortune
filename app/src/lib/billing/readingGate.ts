// app/src/lib/billing/readingGate.ts
// ─────────────────────────────────────────────────────────────────────────
// 풀이 화면 게이트 순수 로직(RN 의존 0) — ReadingScreen의 '권한/잠금/자물쇠' 판정을 한 곳에 모은다.
//   ★목적(daniel 07-02 하네스): 컴포넌트에 임베드돼 테스트 못 하던 상태-플로우 로직을 순수함수로 빼서
//   `scripts/test-reading-gate.ts` 시나리오 테스트로 *빌드 전* 회귀를 잡는다(자물쇠 반복 버그 재발 방지).
//   이 파일은 RN·supabase 등을 import하지 않는다(node/tsx에서 그대로 실행 가능해야 테스트됨).
// ─────────────────────────────────────────────────────────────────────────

/** 이 명식 풀이 열람 '권한': 전역 프리미엄(계정/관리자 ON) OR 이 명식 프리미엄 지정 OR 결제 언락. */
export function computeEntitled(isPremium: boolean, isPremiumForChart: boolean, unlocked: boolean): boolean {
  return isPremium || isPremiumForChart || unlocked;
}

/**
 * 페이월(잠금 카드) 표시 여부.
 * ★근본 규칙(자물쇠 반복 버그): **캐시된 풀이가 하나라도 있으면 절대 잠그지 않는다**(완료 풀이를 가리면 안 됨).
 * 추가로 ①캐시 로드 완료 ②언락 조회 완료(race 깜빡임 방지) ③생성 진행 중 아님 ④미권한 일 때만.
 */
export function computeLocked(p: {
  cacheLoaded: boolean;
  unlockedLoaded: boolean;
  entitled: boolean;
  hasProgress: boolean;
  readingsCount: number;
}): boolean {
  return p.cacheLoaded && p.unlockedLoaded && !p.entitled && !p.hasProgress && p.readingsCount === 0;
}

/** 생성 중 자물쇠(UnlockOverlay): 생성 진행 중 + 캐시가 하나도 없을 때만(이미 생성분 있으면 그 위에 자물쇠 X). */
export function showUnlockOverlay(hasProgress: boolean, readingsCount: number): boolean {
  return hasProgress && readingsCount === 0;
}

/**
 * 프리미엄 자동생성(runAll) 발동 여부 — 빈 캐시로 진입 시 미생성 영역을 자동으로 채우되,
 * ★근본 방어(자물쇠 반복): 로드된 readings가 *현재 resolved chartId 기준*으로 비어 있을 때만 발동한다.
 *   stale/racing 로드(직전 다른 명식으로 로드된 결과)로는 절대 자동생성하지 않는다(잘못된 명식 재생성=자물쇠 방지).
 *   서버 멱등키(안정 natal 지문)가 근본 수정이고, 이 가드는 클라 2차 방어(로드 명식 ≠ 현재 명식이면 판정 보류).
 */
export function computeShouldAutoGen(p: {
  premiumForChart: boolean; isRep: boolean; cacheLoaded: boolean; hasProgress: boolean;
  autoRan: boolean; online: boolean; hasSession: boolean;
  readingsChartId: string | null; currentChartId: string | null; missingCount: number;
}): boolean {
  if (!p.premiumForChart || !p.isRep || !p.cacheLoaded || p.hasProgress || p.autoRan || !p.online || !p.hasSession) return false;
  if (p.currentChartId == null || p.readingsChartId !== p.currentChartId) return false; // 로드된 캐시가 현재 명식 기준이 아니면(stale/race) 자동생성 금지
  return p.missingCount > 0;
}
