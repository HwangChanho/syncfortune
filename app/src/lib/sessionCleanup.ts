// app/src/lib/sessionCleanup.ts — 로그아웃 시 로컬 사용자 데이터 정리(daniel 2026-06-23)
// ─────────────────────────────────────────────────────────────────────────
// 문제: 로그아웃이 supabase.auth.signOut() 만 호출 → 명식·관리자 메뉴·진행률 배너가
//   화면 전환(focus) 전까지 살아있었음. useAuth 의 SIGNED_OUT 한 곳에서 일괄 정리한다.
// ─────────────────────────────────────────────────────────────────────────
//  ★삭제: 명식·대표·tombstone(서버 blob 보존→재로그인 복원) · 통변 생성 진행률 배너
//  ★유지: 글자크기·언어 설정, 반려동물, 오늘의 타로(기기 로컬·계정 무관)
//  ⚠️ 구매/이용권은 절대 건드리지 않는다(daniel): RC 영수증·서버 크레딧(entitlement_credits)·
//     비로그인 로컬 크레딧(local_credits)·통변 unlock(차감 완료 표시) — 모두 보존.
//     로그아웃으로 지우면 재로그인 시 구매 손실·재차감 위험. 구매 상태는 로그인과 분리한다.
// ─────────────────────────────────────────────────────────────────────────
import { clearMyChart } from './myChart';
import { clearAllGenProgress } from './genProgress';

/** 로그아웃 시 호출 — 명식·진행률만 정리(구매/이용권은 보존). */
export async function clearLocalUserData(): Promise<void> {
  await clearMyChart().catch(() => {}); // 명식·대표·tombstone (notifyRepChange 로 ChartPicker·홈 즉시 갱신). 서버 blob 보존.
  clearAllGenProgress(); // 진행률 배너 전부 초기화(다중)
}
