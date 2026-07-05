// app/src/lib/content/reunionOther.ts — 재회운 '옛 인연(상대)' 명식 로컬 잠금 저장
// ─────────────────────────────────────────────────────────────────────────
// daniel(2026-07-05): 재회운은 상대(옛 인연)를 *한 번만* 등록하고, 등록 후엔 그 명식으로 고정(잠금).
//   바꾸려면 새로 풀어야(재구매·재생성) 한다. 그 '잠긴 상대'를 이 기기에 영속 저장한다.
//   · 키 = reunion_other_<serverChartId> → 본인 대표 명식(서버차트ID)별로 상대 1명(명식 전환 시 각자 유지).
//   · 값 = ChartInput(JSON) — 상대 생년월일·성별 등. computeChart 로 매 풀이 때 결정론 산출(저장은 입력값만).
//   · unlocks.ts 와 동일하게 SecureStore(native)/localStorage(web) — chart_id 가 서버 귀속이라 사실상 계정 단위.
//   ⚠️ 상대 PII(생일)이므로 SecureStore(암호화 저장). 규칙8: 동의 얻은 경우만 입력(폼에서 고지).
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// SecureStore 키 charset(영숫자·._-)만 허용 — serverChartId(UUID: hex+대시)·접두어 언더스코어 모두 안전(unlocks.ts 동일).
const key = (serverChartId: string) => `reunion_other_${serverChartId}`;

async function getRaw(k: string): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(k) ?? null;
  return SecureStore.getItemAsync(k);
}
async function setRaw(k: string, v: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(k, v);
  else await SecureStore.setItemAsync(k, v);
}
async function delRaw(k: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.removeItem(k);
  else await SecureStore.deleteItemAsync(k);
}

/** 이 대표 명식(serverChartId)에 잠긴 상대(옛 인연) 명식 입력값 로드 — 없으면 null(미등록). */
export async function loadReunionOther(serverChartId: string): Promise<any | null> {
  try {
    const json = await getRaw(key(serverChartId));
    return json ? JSON.parse(json) : null;
  } catch { return null; } // 저장소·파싱 실패 = 미등록 취급(보수적)
}

/** 상대(옛 인연) 명식 잠금 저장(첫 등록) — 이후 읽기전용·바꾸려면 새로 풀기. */
export async function saveReunionOther(serverChartId: string, input: any): Promise<void> {
  try { await setRaw(key(serverChartId), JSON.stringify(input)); } catch { /* 저장 실패는 조용히 — 다음 등록 때 재시도 */ }
}

/** 상대 잠금 해제(‘바꾸기 = 새로 풀기’ 확정 시에만) — 저장분 제거. */
export async function clearReunionOther(serverChartId: string): Promise<void> {
  try { await delRaw(key(serverChartId)); } catch { /* 무시 */ }
}
