// app/src/lib/genProgress.ts — 통변 생성 진행률(전역 스토어)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 풀이 중 홈으로 나가도 진행률(%)을 홈/배너에서 확인. 생성 루프(ReadingScreen 등)가 갱신하고
//   홈이 구독해 배너로 노출한다. ★컴포넌트 언마운트와 무관 — 루프는 계속 돌므로(서버가 영역별 캐시),
//   진행률을 컴포넌트 state가 아닌 모듈 스토어에 두어야 홈에서 보인다(화면 나가도 유지).
// ─────────────────────────────────────────────────────────────────────────
import { useReducer, useEffect } from 'react';

export type GenState = {
  active: boolean;  // 생성 중 여부
  done: number;     // 완료 영역 수
  total: number;    // 전체 영역 수(사주 16·자미 12·단일 1)
  label: string;    // 표시명(예: '사주 풀이')
  route: string;    // 완료/탭 시 돌아갈 경로
};

let state: GenState = { active: false, done: 0, total: 0, label: '', route: '/' };
const listeners = new Set<() => void>();

/** 진행률 갱신 — 일부 필드만 patch. 구독자(홈 배너 등) 즉시 리렌더. */
export function setGenProgress(patch: Partial<GenState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export function getGenProgress(): GenState { return state; }

/** 진행률 구독 훅 — 홈 등에서 사용. 변경 시 리렌더. */
export function useGenProgress(): GenState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { listeners.add(force); return () => { listeners.delete(force); }; }, []);
  return state;
}
