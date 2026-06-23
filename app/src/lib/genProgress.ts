// app/src/lib/genProgress.ts — 통변 생성 진행률(전역 스토어, route별 다중)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 풀이 중 홈으로 나가도 진행률(%)을 홈/배너에서 확인. 생성 루프(ReadingScreen 등)가 갱신하고
//   홈이 구독해 배너로 노출한다. ★컴포넌트 언마운트와 무관 — 루프는 계속 돌므로(서버가 영역별 캐시),
//   진행률을 컴포넌트 state가 아닌 모듈 스토어에 둔다(화면 나가도 유지).
// ★다중(2026-06-23 daniel): 여러 개를 한 번에 풀 수 있으니 route별로 따로 보관 → 홈에 여러 배너.
//   - 모든 호출은 patch.route 필수(어느 풀이인지 구분). 같은 route면 갱신, 처음이면 추가.
//   - active:false = 그 route 항목 제거(게이트/중단). clearGenProgress(route)=탭/화면접근 시 제거.
//   - useGenProgress()=항목 배열(추가된 순서). getGenItem(route)=단건(루프 증분용).
// ─────────────────────────────────────────────────────────────────────────
import { useReducer, useEffect } from 'react';
import { notifyReadingDone } from './notifications'; // 완료 전이 시 푸시 1회(daniel ⑨ — 화면 밖/백그라운드에도 알림)

export type GenItem = {
  route: string;    // 식별 키 + 완료/탭 시 돌아갈 경로
  done: number;     // 완료 영역 수
  total: number;    // 전체 영역 수(사주 16·자미 12·단일 1)
  label: string;    // 표시명(예: '사주 풀이')
  active: boolean;  // 생성 중/완료대기(배너 표시). false patch = 제거
  seq: number;      // 추가 순서(배너 정렬 — 단조 증가)
};

let items: Record<string, GenItem> = {};
let seq = 0;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

/**
 * 진행률 갱신 — route별 upsert. patch.route 필수.
 * active:false 를 주면 그 route 항목을 제거(게이트/중단 시 배너 닫기).
 */
export function setGenProgress(patch: Partial<GenItem> & { route: string }) {
  const { route } = patch;
  if (patch.active === false) { if (items[route]) { delete items[route]; emit(); } return; }
  const prev = items[route];
  const next: GenItem = {
    route,
    done: patch.done ?? prev?.done ?? 0,
    total: patch.total ?? prev?.total ?? 1,
    label: patch.label ?? prev?.label ?? '',
    active: patch.active ?? prev?.active ?? true,
    seq: prev?.seq ?? ++seq,
  };
  items[route] = next;
  emit();
  // 완료 전이(이전엔 미완료 → 이번에 완료) = 푸시 1회(daniel ⑨: 화면 밖/백그라운드에도). 실패해도 무시.
  const wasDone = !!prev && prev.total > 0 && prev.done >= prev.total;
  const nowDone = next.total > 0 && next.done >= next.total;
  if (nowDone && !wasDone) { notifyReadingDone(`${next.label} 풀이가 완성됐어요`, '준비된 풀이를 확인해 보세요', next.route).catch(() => {}); }
}

/** 특정 route 항목 제거 — 배너 탭 이동 시 / 해당 화면 접근 시(daniel: 접근하면 알림 사라짐). */
export function clearGenProgress(route: string) { if (items[route]) { delete items[route]; emit(); } }
/** 경로 접근 시 해당 항목 제거(daniel ⑨: 그 화면을 어떤 루트로든 접근하면 알림 사라짐). 쿼리(?kind) 무시하고 base 경로로 매칭. */
export function clearGenByPath(path: string) {
  let changed = false;
  for (const k of Object.keys(items)) { if (k === path || k.split('?')[0] === path) { delete items[k]; changed = true; } }
  if (changed) emit();
}
/** 전부 제거 — 로그아웃 정리 등. */
export function clearAllGenProgress() { if (Object.keys(items).length) { items = {}; emit(); } }
/** 단건 조회(생성 루프의 증분 갱신용 — 직전 done 값 읽기). */
export function getGenItem(route: string): GenItem | undefined { return items[route]; }

/** 진행률 구독 훅 — 홈 등에서 사용. 항목 배열(추가 순서). 변경 시 리렌더. */
export function useGenProgress(): GenItem[] {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { listeners.add(force); return () => { listeners.delete(force); }; }, []);
  return Object.values(items).sort((a, b) => a.seq - b.seq);
}
