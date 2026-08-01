// app/src/lib/billing/readingState.ts — 풀이 상태의 **수신 계약**(구조 개편 2026-08-01)
// ─────────────────────────────────────────────────────────────────────────
// daniel: "모바일은 그거 그대로 표출만 하고" — 이 파일에 **판단 로직은 없다.**
//   서버(Edge `reading-state`)가 (명식 × 종류)의 상태를 정하고, 앱은 받은 걸 그린다.
//
// ★이 파일이 생기면서 앱에서 **사라지는 것들**(이게 개편의 목적이다):
//   · 기기 로컬 언락 스탬프로 소유를 판단하던 것 → 서버 구매 이력(reading_unlocks)이 유일한 근거
//   · 앱이 잔액을 조회해 '구매/충전'을 가르던 것   → 서버가 갈라서 status 로 알려준다
//   · 화면마다 흩어져 있던 게이트 분기            → status 4개에 대한 렌더 분기 하나
//   ⇒ 판단자가 하나뿐이라, 참여자 하나가 멈춰서 전체가 멈추는 일이 구조적으로 없어진다.
//
// ⚠️상태 조회는 **읽기 전용**이다 — 화면을 여는 것만으로 과금되지 않는다.
//   실제 차감·생성은 종전대로 `interpret` 이 원자적으로 한다.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout'; // ★게이트 경로 = 반드시 상한(멈춤 방지)

/** 서버가 정하는 상태. 앱은 이 넷 중 하나를 그대로 렌더한다. */
export type ReadingState =
  | { status: 'ready'; done: number; total: number; data?: unknown }   // 완료(단건이면 data 동봉)
  | { status: 'running'; done: number; total: number }                 // 만들어지는 중 — 진행률만
  | { status: 'purchase'; cost: number; balance: number }              // 미구매 · 잔액 충분
  | { status: 'topup'; cost: number; balance: number }                 // 미구매 · 잔액 부족
  | { status: 'free' }                                                 // 가격 없는 무료 콘텐츠
  | { status: 'error'; reason: string };                               // 판정 불가 → 재시도 안내

/**
 * (명식 × 종류)의 현재 상태를 서버에서 받는다.
 * @param chartId 서버 명식 id · @param kind 콘텐츠 종류 · @param category 단건의 카테고리(생략 시 kind)
 * @returns 항상 ReadingState. **던지지 않는다** — 실패도 status:'error' 라는 값으로 온다.
 *   (게이트에서 예외가 나면 화면 잠금이 남아 멈춤이 된다. 그래서 실패를 값으로 돌려준다.)
 */
export async function fetchReadingState(
  chartId: string,
  kind: string,
  category?: string,
): Promise<ReadingState> {
  try {
    const res = await withTimeout(
      supabase.functions.invoke('reading-state', { body: { chartId, kind, category } }),
    );
    if (!res) return { status: 'error', reason: 'timeout' };           // 상한 초과 = 확인 불가(부족 아님)
    if (res.error) return { status: 'error', reason: String(res.error.message ?? 'invoke') };
    const d = res.data as ReadingState | null;
    if (!d || typeof (d as any).status !== 'string') return { status: 'error', reason: 'bad_response' };
    return d;
  } catch (e) {
    return { status: 'error', reason: String((e as Error)?.message ?? e).slice(0, 80) };
  }
}

/** 진행률 % — 서버가 준 done/total 을 그대로 쓴다(앱이 추정하지 않는다). */
export function progressPct(s: ReadingState): number {
  if (s.status !== 'running' && s.status !== 'ready') return 0;
  return s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
}

/** 결제를 물어봐야 하는 상태인가 — 화면이 '구매/충전' UI 를 그릴지 판단할 때만 쓴다. */
export const needsPayment = (s: ReadingState): s is Extract<ReadingState, { status: 'purchase' | 'topup' }> =>
  s.status === 'purchase' || s.status === 'topup';
