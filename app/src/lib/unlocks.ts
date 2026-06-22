// app/src/lib/unlocks.ts — 통변 unlock 영속(차감 후 재차감/재잠금 방지)
// ─────────────────────────────────────────────────────────────────────────
// daniel(2026-06): "한번 unlock 하면 풀려야." 쿠폰·광고·결제로 한번 차감하면 그 (차트×종류)는
//   영구 무료 재생성이 되어야 한다. invoke(LLM)가 강제종료·홈이동·네트워크로 중단돼 일부만
//   생성됐어도, 재진입 시 재차감 없이 이어서 생성(돈 두 번 안 나감).
//   ※ 기기 로컬(SecureStore) 저장 — chart_id 는 서버 귀속이라 사실상 계정 단위로 동작한다.
//     비로그인 구매 이관(H)을 붙일 때 서버 테이블로 승격 가능(키 포맷 유지).
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const key = (chartId: string, kind: string) => `unlock_${chartId}_${kind}`;
const IDX = 'unlock_keys_v1'; // unlock 키 목록 — SecureStore 는 glob 미지원이라 로그아웃 일괄 삭제용 인덱스를 따로 둔다.

async function rawGet(k: string): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(k) ?? null;
  return SecureStore.getItemAsync(k);
}
async function rawSet(k: string, v: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(k, v); else await SecureStore.setItemAsync(k, v);
}
async function rawDel(k: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.removeItem(k); else await SecureStore.deleteItemAsync(k);
}
async function addToIndex(k: string): Promise<void> {
  try { const raw = await rawGet(IDX); const arr: string[] = raw ? JSON.parse(raw) : []; if (!arr.includes(k)) { arr.push(k); await rawSet(IDX, JSON.stringify(arr)); } } catch { /* 인덱스 실패는 조용히(unlock 자체는 저장됨) */ }
}

/** (차트×종류) unlock(차감 완료) 여부 — true 면 재차감 없이 무료 생성/재생성. */
export async function isUnlocked(chartId: string, kind: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(key(chartId, kind)) === '1';
    return (await SecureStore.getItemAsync(key(chartId, kind))) === '1';
  } catch { return false; } // 저장소 접근 실패 = 잠김(보수적)
}

/** 차감(쿠폰·광고·결제) 성공 직후 호출 — 그 (차트×종류)를 영구 unlock 으로 도장. */
export async function markUnlocked(chartId: string, kind: string): Promise<void> {
  try {
    if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(key(chartId, kind), '1');
    else await SecureStore.setItemAsync(key(chartId, kind), '1');
    await addToIndex(key(chartId, kind)); // 로그아웃 일괄 삭제용 인덱스에 등록
  } catch { /* 저장 실패는 조용히 — 다음 차감 때 다시 시도(최악=재차감 1회, 크래시는 없음) */ }
}

/** 로그아웃 시 모든 통변 unlock 로컬 캐시 삭제(인덱스 기반 — 다른 계정이 이전 unlock 을 물려받지 않게). sessionCleanup 이 호출. */
export async function clearAllUnlocks(): Promise<void> {
  try {
    const raw = await rawGet(IDX);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    for (const k of arr) await rawDel(k);
    await rawDel(IDX);
  } catch { /* 정리 실패는 조용히 */ }
}

// ── 서버 권위 세트 언락(보안 P3, daniel 2026-06) — saju/ziwei/timeline 세트 단위 ──────────────
// Edge interpret 가 (크레딧 차감 후) reading_unlocks 에 기록한다. 클라는 *읽기만* — '이미 열림'이면
//   재결제 없이 바로 재생성. (로컬 markUnlocked 와 달리 서버 진실의 원천 → 기기 바뀌어도 유지.)
//   kind = 'reading'(saju) | 'ziwei' | 'timeline'.
export async function isReadingUnlocked(chartId: string, kind: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('reading_unlocks').select('chart_id').eq('chart_id', chartId).eq('kind', kind).maybeSingle();
    return !!data;
  } catch { return false; } // 조회 실패 = 잠김(보수적, Edge 가 최종 판정)
}
