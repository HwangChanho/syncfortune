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
import * as SecureStore from 'expo-secure-store'; // 진행률 영구 저장(daniel: 강제종료해도 홈 배너 복원). 앱 공통 스토리지(AsyncStorage 미설치)
import { notifyReadingDone, isTalkOpen } from './notifications'; // 완료 전이 시 푸시 1회(daniel ⑨ — 화면 밖/백그라운드에도 알림)
import { postGenToTalk } from '../talk/genTalkPost';           // ★진행·완료를 담당자의 말로 방에 남긴다(Boss 08-31)

export type GenItem = {
  route: string;    // 식별 키 + 완료/탭 시 돌아갈 경로
  done: number;     // 완료 영역 수
  total: number;    // 전체 영역 수(사주 16·자미 12·단일 1)
  label: string;    // 표시명(예: '사주 풀이')
  chartLabel?: string; // 어느 명식의 풀이인지(예: '황찬호') — 배너·푸시에 노출(daniel 07-02)
  active: boolean;  // 생성 중/완료대기(배너 표시). false patch = 제거
  seq: number;      // 추가 순서(배너 정렬 — 단조 증가)
  startedAt: number; // 생성 시작 시각(ms) — 단일 콜(총1)의 추정 진행률(시작 0%~저장 100%)용. multi는 done/total 실제값 사용
  restored?: boolean; // 앱 재시작 시 영구저장에서 복원됨(daniel: '이전에 진행중인 풀이' 문구·탭하여 이어보기). 실시간 생성 중 아님.
};

let items: Record<string, GenItem> = {};
let seq = 0;
const listeners = new Set<() => void>();
// 영구 저장(daniel: 풀이 중 강제종료해도 재오픈 시 홈 배너로 진행중/미확인 풀이 복원). 변경마다 디바운스 저장.
const PKEY = 'genProgress_v1'; // SecureStore 키는 영숫자·._- 만(콜론 불가)
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { SecureStore.setItemAsync(PKEY, JSON.stringify(items)).catch(() => {}); }, 400);
}
function emit() { listeners.forEach((l) => l()); persist(); }

/**
 * 앱 시작 시 1회 호출 — 종료 전 진행중/완료-미확인 풀이를 복원해 홈 배너로 노출(daniel).
 * 복원 항목은 restored=true(실시간 생성 중 아님 — 탭하면 그 화면에서 이어 생성/확인).
 */
export async function hydrateGenProgress(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(PKEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Record<string, GenItem>;
    const keys = Object.keys(saved);
    if (!keys.length) return;
    let max = seq;
    for (const k of keys) {
      if (items[k]) continue; // 이미 이번 세션에서 생성/갱신된 건 덮지 않음
      items[k] = { ...saved[k], restored: true };
      if (saved[k].seq > max) max = saved[k].seq;
    }
    seq = max;
    listeners.forEach((l) => l()); // emit 직접(persist 재호출 불필요)
  } catch { /* 손상 데이터 무시 */ }
}

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
    chartLabel: patch.chartLabel ?? prev?.chartLabel,
    active: patch.active ?? prev?.active ?? true,
    seq: prev?.seq ?? ++seq,
    startedAt: prev?.startedAt ?? Date.now(), // 최초 생성 시각 고정(이후 갱신해도 유지) — 추정 진행률 기준점
  };
  items[route] = next;
  emit();
  // 완료 전이(이전엔 미완료 → 이번에 완료) = 푸시 1회(daniel ⑨: 화면 밖/백그라운드에도). 실패해도 무시.
  const wasDone = !!prev && prev.total > 0 && prev.done >= prev.total;
  const nowDone = next.total > 0 && next.done >= next.total;
  // daniel 07-03: 오늘/이달의 운세(/today·/month)는 완료 푸시 미발송 — 하루 3회 티저 알림으로 대체(중복 방지).
  //   홈 배너('풀이 보기')는 items 기반이라 그대로 유지되고, 즉시 푸시만 건너뛴다. 그 외 풀이(프리미엄 세트 등)는 기존대로 완료 푸시.
  // ★★2026-08-27 Boss: *"아무것도 안했는데 갑자기 사주풀이가 완성됐다고 푸시 알림이 왔어"*
  //   ⚠️원인: 앱을 켜면 저장된 진행을 복원(`restored`)하고, 그 뒤 서버와 맞추면서
  //     **이미 며칠 전에 끝난 것**이 «방금 끝난 것» 으로 읽혀 푸시가 나갔다.
  //   ⇒ **복원된 항목은 시스템 푸시를 안 낸다.** 화면 안 배너는 그대로 뜬다 —
  //     지금 앱을 켠 사람에게는 배너면 충분하고, 며칠 전 일로 폰이 울리는 건 놀랄 일이다.
  //   ★진짜로 «기다리는 중에 끝난 것»(이 세션에서 시작한 것)은 `restored` 가 아니라 그대로 푸시된다.
  const wasRestored = !!prev?.restored;
  const skipDonePush = next.route === '/today' || next.route === '/month' || wasRestored;
  /**
   * ★★2026-08-31 — 진행·완료를 **대화방에 남긴다**(Boss *"채팅창에서 나와야지"* ·
   *   *"완료되면 서윤이가 메세지보내고 내가 그화면에 없으면 푸시알림도 와야지"*).
   *
   * ■ 종전엔 홈 상단 배너뿐이었다. 정작 **그 사람과의 방** 에는 아무 말도 남지 않아,
   *   나중에 방을 열면 아무 일도 없던 것처럼 보였다.
   * ■ 시작할 때 한 번, 끝날 때 한 번. `postedRef` 로 **시작 알림은 route 당 한 번만** —
   *   진행률이 오를 때마다 부르면 방이 «보고 있어요» 로 도배된다.
   * ★푸시는 **그 방을 보고 있지 않을 때만** 낸다(오늘 만든 `isTalkOpen`).
   *   보고 있는데 울리면 «지금 눈앞에 있는 것» 을 알리는 셈이라 성가시다.
   */
  const startedNow = next.active && !prev;
  if (startedNow && !next.restored) {
    void postGenToTalk(next.route, next.label, 'working', next.chartLabel);
  }
  if (nowDone && !wasDone && !skipDonePush) {
    void (async () => {
      const who = await postGenToTalk(next.route, next.label, 'done', next.chartLabel);
      // 방을 보고 있으면 푸시를 내지 않는다 — 화면에 이미 그 말이 떠 있다
      if (who && isTalkOpen(who)) return;
      // ★탭하면 **그 방**으로 간다(종전엔 풀이 화면으로 갔다). 답장이 왔으면 답장을 보러 가는 게 맞다.
      const route = who ? `/talk?c=${encodeURIComponent(who)}` : next.route;
      notifyReadingDone(
        `${next.chartLabel ? next.chartLabel + ' — ' : ''}${next.label} 풀이가 완성됐어요`,
        '준비된 풀이를 확인해 보세요',
        route,
      ).catch(() => {});
    })();
  }
}

/** 특정 route 항목 제거 — 배너 탭 이동 시 / 해당 화면 접근 시(daniel: 접근하면 알림 사라짐). */
export function clearGenProgress(route: string) { if (items[route]) { delete items[route]; emit(); } }
/** 경로 접근 시 해당 항목 제거(daniel ⑨: 그 화면을 어떤 루트로든 접근하면 알림 사라짐). 쿼리(?kind) 무시하고 base 경로로 매칭. */
export function clearGenByPath(path: string) {
  let changed = false;
  for (const k of Object.keys(items)) { if (k === path || k.split('?')[0] === path) { delete items[k]; changed = true; } }
  if (changed) emit();
}
/**
 * base 경로 + chartId(쿼리) 매칭 제거 — kind/쿼리순서/유무와 무관하게 그 차트의 배너를 확실히 닫는다.
 * ★배너 안 사라짐 근본수정(daniel 2026-07-22): 정확 route 매칭(clearGenProgress)은 복원배너·다른 kind·쿼리순서
 *   차이로 놓칠 수 있어 '완성됐어요'가 계속 떠 있었다. 화면(그 차트)에 진입하면 이걸로 확실히 제거.
 * @param basePath 예 '/reading'  @param chartId 그 화면이 보고 있는 차트 id(SavedChart.id)
 */
export function clearGenByChart(basePath: string, chartId: string) {
  let changed = false;
  for (const k of Object.keys(items)) {
    if (k.split('?')[0] !== basePath) continue;             // base 경로 일치
    const m = k.match(/[?&]chartId=([^&]+)/);                // 쿼리 순서·kind 무관하게 chartId 파싱
    if (m && m[1] === chartId) { delete items[k]; changed = true; } // 이 차트(사주/자미 배너 모두)
  }
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
