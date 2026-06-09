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
export type SavedChart = { id: string; label: string; relation: string; input: ChartInput };

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
export async function addChart(input: any, opts?: { isPro?: boolean }): Promise<string> {
  const charts = await listCharts();
  // 무료 티어 = 직접 등록 명식 10개까지(샘플 시드 제외). 프로 = 무제한.
  const used = countReal(charts);
  if (!opts?.isPro && used >= FREE_CHART_LIMIT) {
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

/** 명식 등록 (호환 — register 에서 호출). 추가 + (첫이면)대표. 무료 한도는 addChart 가 강제. */
export async function saveMyChart(input: any, opts?: { isPro?: boolean }): Promise<void> {
  await addChart(input, opts);
}

/** 현재 등록 사용량 (UI 표시·사전 안내용). count=직접 등록 수(샘플 제외), limit=무료 한도. */
export async function getChartUsage(): Promise<{ count: number; limit: number }> {
  const charts = await listCharts();
  return { count: countReal(charts), limit: FREE_CHART_LIMIT };
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
