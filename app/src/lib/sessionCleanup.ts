// app/src/lib/sessionCleanup.ts — 로그아웃 시 로컬 사용자 데이터 일괄 정리(daniel 2026-06-23)
// ─────────────────────────────────────────────────────────────────────────
// 문제: 로그아웃이 supabase.auth.signOut() 만 호출 → 명식·관리자 메뉴·진행률 배너 등
//   로컬 상태가 화면 전환(focus) 전까지 살아있었음. 모든 로그아웃 경로(설정·홈·토큰만료)를
//   useAuth 의 SIGNED_OUT 이벤트 한 곳에서 이 함수로 일괄 정리한다(단일 진실원천).
// ─────────────────────────────────────────────────────────────────────────
//  ★삭제(계정 데이터): 명식·대표·tombstone(서버 blob 은 보존→재로그인 복원) · 통변 unlock 로컬 캐시
//                     · 비로그인 디바이스 크레딧 · 통변 생성 진행률 배너
//  ★유지(계정 무관·기기 설정): 글자크기·언어 설정, 반려동물 명식, 오늘의 타로(재미·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
import { clearMyChart } from './myChart';
import { localClear } from './localCredits';
import { clearAllUnlocks } from './unlocks';
import { setGenProgress } from './genProgress';

/** 로그아웃 시 호출 — 로컬 사용자 데이터 일괄 정리. 실패는 격리(allSettled)해 한 항목 오류가 전체를 막지 않게. */
export async function clearLocalUserData(): Promise<void> {
  await Promise.allSettled([
    clearMyChart(),     // 명식·대표·tombstone (notifyRepChange 로 ChartPicker·홈 즉시 갱신)
    localClear(),       // 비로그인 디바이스 크레딧
    clearAllUnlocks(),  // 통변 unlock 로컬 캐시(다른 계정이 이전 unlock 물려받지 않게)
  ]);
  setGenProgress({ active: false, done: 0, total: 0, label: '', route: '/' }); // 진행률 배너 초기화
}
