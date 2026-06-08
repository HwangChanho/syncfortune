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

// label/relation 은 ChartInput PII 계약 외 메타 → 함께 보관
export type SavedChart = { id: string; label: string; relation: string; input: ChartInput };

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

// 개발/데모 편의: 명식이 비어 있으면 자동 시드할 *익명* 샘플(실존 인물 아님 — PII 아님).
// 재빌드·SecureStore 초기화로 명식이 날아가도 항상 대표 명식이 존재하게 한다(엔진 데모용).
//   ※ 실제 사용자 명식은 앱에서 직접 등록 — 온디바이스 SecureStore 에만 잔류(ADR-005).
const SAMPLE_CHART: SavedChart = {
  id: 'sample-self',
  label: '샘플 (예시)',
  relation: '본인',
  input: {
    birthDateTime: '2000-01-01 12:00',
    calendar: '양',
    timeAccuracy: '정확',
    sex: '남',
    birthPlace: '서울',
  } as ChartInput,
};

/** 저장된 전체 명식 목록. 비어 있으면 본인 샘플을 자동 시드(+대표)한다. */
export async function listCharts(): Promise<SavedChart[]> {
  const json = await getRaw(KEY);
  const charts = json ? (JSON.parse(json) as SavedChart[]) : [];
  if (charts.length === 0) {
    await setRaw(KEY, JSON.stringify([SAMPLE_CHART]));
    if (!(await getRaw(REP_KEY))) await setRaw(REP_KEY, SAMPLE_CHART.id);
    return [SAMPLE_CHART];
  }
  return charts;
}

/** 명식 추가 저장 → id 반환. 첫 명식은 자동 대표. */
export async function addChart(input: any): Promise<string> {
  const charts = await listCharts();
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

/** 명식 등록 (호환 — register 에서 호출). 추가 + (첫이면)대표. */
export async function saveMyChart(input: any): Promise<void> {
  await addChart(input);
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
