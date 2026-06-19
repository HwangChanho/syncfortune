// app/src/lib/myChart.ts — 내 명식 다중 보관 + 대표 설정 (온디바이스, 로그인 불필요)
// ─────────────────────────────────────────────────────────────────────────
// 여러 명식(본인·가족·지인…)을 기기에 저장하고 그중 하나를 '대표'로 둔다.
//   대표 명식 = 앱 기본(명식·풀이·궁합이 이 명식 기준). 홈에서 다른 명식으로 전환 가능.
// PII(생년월일)라 native=SecureStore(하드웨어 암호화) / web=localStorage(ADR-032·037).
//   서버 전송 없음 — 비로그인 무료 흐름의 "내 정보"는 기기에만.
// 호환: loadMyChart()=대표 input / saveMyChart(input)=추가+대표(기존 호출처 유지).
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ChartInput } from '@spec/chart';
import { supabase } from './supabase'; // 계정 동기화(ADR-056) — owner 전용 암호화 blob RPC

const KEY = 'my_charts_v2';   // SavedChart[]
const REP_KEY = 'my_rep_v2';  // 대표 id
const TOMB_KEY = 'my_charts_tomb_v1'; // 삭제된 id[] (union 머지에서 제외 → 삭제 전파)
const BLOB_V = 1;             // 동기화 blob 스키마 버전

const SAMPLE_ID = 'sample-self';      // 데모 자동 시드 id (등록 한도 계산서 제외 — 사용자가 만든 게 아님)
export const FREE_CHART_LIMIT = 10;   // 무료 티어 명식 등록 한도. 프로 = 무제한 (ADR-051)

// ── 대표 명식 변경 전역 동기화(daniel 2026-06) — 홈이든 어디든 바꾸면 모든 화면·ChartPicker 즉시 반영 ──
//   비React 모듈이라 가벼운 pub/sub. setRepresentative/add/update/delete 시 notifyRepChange()로 알린다.
type RepListener = () => void;
const repListeners = new Set<RepListener>();
/** 대표 명식 변경 구독 → 해제 함수 반환(useEffect cleanup). */
export function subscribeRepChange(cb: RepListener): () => void {
  repListeners.add(cb);
  return () => { repListeners.delete(cb); };
}
function notifyRepChange(): void {
  repListeners.forEach((cb) => { try { cb(); } catch { /* 구독자 오류 격리 */ } });
}

// ── 계정 동기화(ADR-056) — 명식을 owner 전용 *암호화 blob*(set/get_my_charts RPC, Vault 키)으로 서버 저장 ──
//   → 같은 계정으로 다른 기기 로그인 시 복원. 로컬이 진실원천, 서버는 동기화 사본. 비로그인은 no-op(기기 로컬만).
//   삭제 전파: tombstone(삭제 id) 유지 → union(서버∪로컬) 머지에서 제외. id=`c_${ms}`라 기기 간 충돌 사실상 없음.
async function getTombstones(): Promise<string[]> {
  const j = await getRaw(TOMB_KEY); try { return j ? JSON.parse(j) : []; } catch { return []; }
}
async function setTombstones(ids: string[]): Promise<void> {
  await setRaw(TOMB_KEY, JSON.stringify(Array.from(new Set(ids)).slice(-500))); // 상한(폭주 방지)
}
async function hasSession(): Promise<boolean> {
  try { const { data } = await supabase.auth.getSession(); return !!data.session; } catch { return false; }
}

// 푸시(디바운스) — 로컬 명식+대표+tombstone 을 서버에 암호화 저장. 세션 있을 때만·fire-and-forget(UI 비차단).
let pushTimer: any = null;
export function pushChartsDebounced(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; void pushChartsNow(); }, 1500);
}
async function pushChartsNow(): Promise<void> {
  if (!(await hasSession())) return;                       // 비로그인 = 동기화 없음
  try {
    const blob = JSON.stringify({ v: BLOB_V, charts: await listCharts(), rep: await getRaw(REP_KEY), tombstones: await getTombstones() });
    await supabase.rpc('set_my_charts', { p_blob: blob });
  } catch { /* 네트워크/세션 오류 격리 — 다음 변경 때 재시도 */ }
}

/**
 * 풀+머지(로그인 시 호출) — 서버 blob 을 받아 로컬과 union(tombstone 제외) → 로컬 저장 후 재푸시(수렴).
 * 새 기기: 로컬 비어 있어도 서버 명식이 복원됨. 기존 기기: 로컬-only 명식이 서버로 올라감(무손실).
 */
export async function syncChartsFromServer(): Promise<void> {
  if (!(await hasSession())) return;
  let server: { charts?: SavedChart[]; rep?: string; tombstones?: string[] } | null = null;
  try {
    const { data, error } = await supabase.rpc('get_my_charts');
    if (error || data == null) { if ((await listCharts()).length) await pushChartsNow(); return; } // 서버에 없음 = 첫 동기화: 로컬 있으면 올린다(빈 로컬로 덮어쓰기 방지)
    server = JSON.parse(data as string);
  } catch { return; }
  const local = await listCharts();
  const tomb = new Set<string>([...(await getTombstones()), ...(server?.tombstones ?? [])]);
  const byId = new Map<string, SavedChart>();
  for (const c of (server?.charts ?? [])) if (c && c.id && !tomb.has(c.id)) byId.set(c.id, c);
  for (const c of local) if (!tomb.has(c.id)) byId.set(c.id, c); // 같은 id 면 로컬 우선(최근 편집 반영)
  let merged = Array.from(byId.values());
  // 복구(ADR-056): blob·로컬 모두 비어 있으면(새 기기/구버전) 과거 풀이로 charts 테이블에 남은 명식을 복원(birth 복호→input 재구성).
  if (merged.length === 0) {
    try {
      const { data: rec } = await supabase.rpc('recover_my_charts');
      const rows: any[] = Array.isArray(rec) ? rec : (typeof rec === 'string' ? JSON.parse(rec) : []);
      for (const r of rows) {
        if (!r?.birth || tomb.has(String(r.id))) continue;
        let input: any; try { input = JSON.parse(r.birth); } catch { continue; }
        merged.push({ id: String(r.id), label: r.label || input.label || '내 명식', relation: r.relation || input.relation || 'self', input, serverChartId: String(r.id) });
      }
    } catch { /* 복구 실패 무시(권한/네트워크) */ }
  }
  // serverChartId 기준 중복 제거(복구분 uuid-id 와 기존 c_-id(serverChartId=uuid)가 같은 명식을 가리킬 때 합침).
  { const seen = new Set<string>(); merged = merged.filter((c) => { const fp = c.serverChartId || c.id; if (seen.has(fp)) return false; seen.add(fp); return true; }); }
  await setRaw(KEY, JSON.stringify(merged));
  await setTombstones(Array.from(tomb));
  // 대표: 로컬 대표가 유효하면 유지, 아니면 서버 대표(merged 에 존재 시), 그것도 없으면 첫 명식.
  const curRep = await getRaw(REP_KEY);
  if (!curRep || !merged.some((c) => c.id === curRep)) {
    if (server?.rep && merged.some((c) => c.id === server!.rep)) await setRaw(REP_KEY, server.rep);
    else if (merged.length) await setRaw(REP_KEY, merged[0].id);
  }
  notifyRepChange();
  await pushChartsNow();                                   // 머지 결과를 서버에 반영(수렴)
}

/**
 * 무료 등록 한도 초과 시 addChart 가 던지는 에러.
 * UI(register)가 이걸 잡아 *업그레이드 유도*로 분기한다(저장은 일어나지 않음).
 * - count: 현재 등록 수(샘플 제외) / limit: 한도(FREE_CHART_LIMIT)
 */
export class ChartLimitError extends Error {
  constructor(public count: number, public limit: number) {
    super(`무료 등록 한도(${limit}개)를 초과했습니다.`);
    this.name = 'ChartLimitError';
  }
}

// label/relation 은 ChartInput PII 계약 외 메타 → 함께 보관
// serverChartId = 이 명식에 대응하는 서버 charts.id (풀이 캐시 chart_id 안정화 — 재방문 시 재사용).
//   온디바이스에만 매핑 보관(서버 PII 무전송 원칙 유지). 첫 풀이 때 1회 발급·저장(setServerChartId).
// 풀이 grounding용 기본 정보(daniel) — 하는 일·관심/고민·자유 메모(전부 선택). 사주/자미/궁합 통변에 맥락으로 반영.
export type ChartContext = { job?: string; concern?: string; note?: string };
export type SavedChart = { id: string; label: string; relation: string; input: ChartInput; serverChartId?: string; context?: ChartContext };

/** 사용자가 직접 등록한 명식 수(데모 샘플 시드는 한도에서 제외). */
function countReal(charts: SavedChart[]): number {
  return charts.filter((c) => c.id !== SAMPLE_ID).length;
}

async function getRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function setRaw(key: string, val: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(key, val);
  else await SecureStore.setItemAsync(key, val);
}
async function delRaw(key: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

// 샘플 자동 시드 폐지(daniel 요청): 빈 목록은 빈 채로 둔다(앱이 '등록 유도'로 분기).
//   과거 버전이 시드해 SecureStore 에 남은 샘플('sample-self')은 읽을 때 1회 정리(아래 listCharts).
//   ※ 실제 사용자 명식은 앱에서 직접 등록 — 온디바이스 SecureStore 에만 잔류(ADR-005).

/** 저장된 전체 명식 목록(비어 있으면 빈 배열 — 시드하지 않음). 레거시 자동시드 샘플은 1회 제거. */
export async function listCharts(): Promise<SavedChart[]> {
  const json = await getRaw(KEY);
  const all = json ? (JSON.parse(json) as SavedChart[]) : [];
  // 레거시 정리: 과거 자동 시드된 샘플('sample-self')이 저장돼 있으면 제거한다.
  const charts = all.filter((c) => c.id !== SAMPLE_ID);
  if (charts.length !== all.length) {
    await setRaw(KEY, JSON.stringify(charts));        // 정리 결과 저장(1회 마이그레이션)
    if ((await getRaw(REP_KEY)) === SAMPLE_ID) {      // 대표가 샘플이었으면 재지정/해제
      if (charts.length) await setRaw(REP_KEY, charts[0].id);
      else await delRaw(REP_KEY);
    }
  }
  return charts;
}

/**
 * 명식 추가 저장 → id 반환. 첫 명식은 자동 대표.
 * @param opts.isPro 프로 구독 여부(=무제한). 무료(false·기본)는 FREE_CHART_LIMIT 초과 시 ChartLimitError.
 *   ※ React 훅(useSubscription) 밖이라 구독 여부는 호출처(UI)가 주입한다.
 *   저장소에서 강제(throw)하므로 어떤 경로로 호출해도 한도 우회 불가(방어적·단일 진실원천).
 */
export async function addChart(input: any, opts?: { isPro?: boolean; bypassLimit?: boolean }): Promise<string> {
  const charts = await listCharts();
  // 무료 티어 = 직접 등록 명식 10개까지(샘플 시드 제외). 프로 = 무제한.
  //   bypassLimit = 보상형 광고 1회 시청으로 이번 1건만 한도 우회(UI에서 광고 earned 후 주입).
  const used = countReal(charts);
  if (!opts?.isPro && !opts?.bypassLimit && used >= FREE_CHART_LIMIT) {
    throw new ChartLimitError(used, FREE_CHART_LIMIT);
  }
  const id = `c_${Date.now()}`;
  const item: SavedChart = {
    id,
    label: (input.label && String(input.label).trim()) || '내 명식',
    relation: input.relation ?? 'self',
    input,
    context: input.context, // 풀이 grounding 기본정보(선택)
  };
  await setRaw(KEY, JSON.stringify([...charts, item]));
  const rep = await getRaw(REP_KEY);
  if (!rep) await setRaw(REP_KEY, id); // 첫 명식 = 대표
  notifyRepChange(); // 목록·대표 변경 알림(전역 동기화)
  pushChartsDebounced(); // 계정 동기화(로그인 시)
  return id;
}

/** 대표 명식 id 지정 (홈에서 전환). 전역 동기화 알림. */
export async function setRepresentative(id: string): Promise<void> {
  await setRaw(REP_KEY, id);
  notifyRepChange();
  pushChartsDebounced(); // 대표도 동기화
}

/** 현재 대표 명식 id. */
export async function getRepresentativeId(): Promise<string | null> {
  return getRaw(REP_KEY);
}

/** 대표 명식의 input (호환 — 기존 loadMyChart). 없으면 null. */
export async function loadMyChart(): Promise<ChartInput | null> {
  const charts = await listCharts();
  if (!charts.length) return null;
  const repId = await getRaw(REP_KEY);
  const rep = charts.find((c) => c.id === repId) ?? charts[0];
  return rep.input;
}

/**
 * 대표 명식을 SavedChart 통째로 반환(id·serverChartId 포함). 없으면 null.
 * 풀이 화면이 serverChartId(캐시 chart_id)를 연결하려면 input 만으론 부족 → 이 함수로 SavedChart 를 받는다.
 */
export async function loadRepChart(): Promise<SavedChart | null> {
  const charts = await listCharts();
  if (!charts.length) return null;
  const repId = await getRaw(REP_KEY);
  return charts.find((c) => c.id === repId) ?? charts[0];
}

/**
 * 명식 ↔ 서버 charts.id 매핑 저장 (풀이 캐시 chart_id 안정화).
 * 첫 풀이 때 서버 charts insert 로 받은 id 를 해당 SavedChart 에 1회 기록 → 재방문 시 같은 chart_id 재사용.
 * @param localId 온디바이스 SavedChart.id / @param serverId 서버 charts.id
 */
export async function setServerChartId(localId: string, serverId: string): Promise<void> {
  const charts = await listCharts();
  const idx = charts.findIndex((c) => c.id === localId);
  if (idx < 0) return;                                   // 이미 삭제된 명식이면 무시
  charts[idx] = { ...charts[idx], serverChartId: serverId };
  await setRaw(KEY, JSON.stringify(charts));
  pushChartsDebounced(); // 캐시 매핑도 동기화(다른 기기서 같은 풀이 재사용)
}

/** 명식 등록 (호환 — register 에서 호출). 추가 + (첫이면)대표. 무료 한도는 addChart 가 강제. */
export async function saveMyChart(input: any, opts?: { isPro?: boolean; bypassLimit?: boolean }): Promise<void> {
  await addChart(input, opts);
}

/** 현재 등록 사용량 (UI 표시·사전 안내용). count=직접 등록 수(샘플 제외), limit=무료 한도. */
export async function getChartUsage(): Promise<{ count: number; limit: number }> {
  const charts = await listCharts();
  return { count: countReal(charts), limit: FREE_CHART_LIMIT };
}

/**
 * 명식 수정 — input(생년월일·시·성별·출생지 등) 교체. label/relation 도 input 값으로 갱신.
 * ⚠️ 사주가 바뀌었을 수 있으므로 serverChartId 를 무효화한다 → 다음 풀이 때 새 chart_id 재발급(캐시 분리).
 */
export async function updateChart(id: string, input: any): Promise<void> {
  const charts = await listCharts();
  const idx = charts.findIndex((c) => c.id === id);
  if (idx < 0) return;
  charts[idx] = {
    ...charts[idx],
    input,
    label: (input.label && String(input.label).trim()) || charts[idx].label,
    relation: input.relation ?? charts[idx].relation,
    context: input.context ?? charts[idx].context, // 기본정보(선택) — 없으면 기존 유지
    serverChartId: undefined, // 생년월일/맥락 변경 가능 → 서버 매핑 초기화(이전 풀이 캐시와 분리)
  };
  await setRaw(KEY, JSON.stringify(charts));
  notifyRepChange(); // 명식 내용 변경 알림(전역 동기화 — 같은 대표라도 갱신)
  pushChartsDebounced(); // 계정 동기화
}

/** 명식 삭제. 대표를 지우면 남은 첫 명식이 대표가 된다. */
export async function deleteChart(id: string): Promise<void> {
  const charts = await listCharts();
  const rest = charts.filter((c) => c.id !== id);
  await setRaw(KEY, JSON.stringify(rest));
  await setTombstones([...(await getTombstones()), id]); // 삭제 전파(다른 기기 union 머지에서 제외)
  const rep = await getRaw(REP_KEY);
  if (rep === id) {
    if (rest.length) await setRaw(REP_KEY, rest[0].id);
    else await delRaw(REP_KEY);
  }
  notifyRepChange(); // 삭제·대표 재지정 알림(전역 동기화)
  pushChartsDebounced(); // 계정 동기화(삭제 반영)
}

/** 전체 초기화. */
export async function clearMyChart(): Promise<void> {
  await delRaw(KEY);
  await delRaw(REP_KEY);
  await delRaw(TOMB_KEY); // 로컬 초기화(서버 blob 은 보존 — 재로그인 시 복원)
}
