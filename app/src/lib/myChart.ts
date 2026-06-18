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

const KEY = 'my_charts_v2';   // SavedChart[]
const REP_KEY = 'my_rep_v2';  // 대표 id

const SAMPLE_ID = 'sample-self';      // 데모 자동 시드 id (등록 한도 계산서 제외 — 사용자가 만든 게 아님)
export const FREE_CHART_LIMIT = 10;   // 무료 티어 명식 등록 한도. 프로 = 무제한 (ADR-051)

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
export type SavedChart = { id: string; label: string; relation: string; input: ChartInput; serverChartId?: string };

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
  };
  await setRaw(KEY, JSON.stringify([...charts, item]));
  const rep = await getRaw(REP_KEY);
  if (!rep) await setRaw(REP_KEY, id); // 첫 명식 = 대표
  return id;
}

/** 대표 명식 id 지정 (홈에서 전환). */
export async function setRepresentative(id: string): Promise<void> {
  await setRaw(REP_KEY, id);
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
    serverChartId: undefined, // 생년월일 변경 가능 → 서버 매핑 초기화(이전 풀이 캐시와 분리)
  };
  await setRaw(KEY, JSON.stringify(charts));
}

/** 명식 삭제. 대표를 지우면 남은 첫 명식이 대표가 된다. */
export async function deleteChart(id: string): Promise<void> {
  const charts = await listCharts();
  const rest = charts.filter((c) => c.id !== id);
  await setRaw(KEY, JSON.stringify(rest));
  const rep = await getRaw(REP_KEY);
  if (rep === id) {
    if (rest.length) await setRaw(REP_KEY, rest[0].id);
    else await delRaw(REP_KEY);
  }
}

/** 전체 초기화. */
export async function clearMyChart(): Promise<void> {
  await delRaw(KEY);
  await delRaw(REP_KEY);
}
