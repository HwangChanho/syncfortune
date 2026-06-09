// app/src/lib/tarotStore.ts — 오늘의 타로 결과 저장(하루 1회·결과 고정)
// ─────────────────────────────────────────────────────────────────────────
// 타로는 하루 1회만 뽑고, 뽑은 결과는 그날 안에서 고정(재진입해도 같은 카드·풀이).
//   날짜(로컬 'YYYY-M-D')가 바뀌면 새로 뽑을 수 있다. PII 아님 — native=SecureStore / web=localStorage.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SpreadCard } from './tarot';

const KEY = 'taro_daily_v1';

export type DailyTaro = { date: string; categoryKey: string; cards: SpreadCard[] };

async function getRaw(): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}
async function setRaw(v: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(KEY, v);
  else await SecureStore.setItemAsync(KEY, v);
}

/** 오늘(today='YYYY-M-D') 이미 뽑은 타로가 있으면 반환, 없으면(또는 어제 것) null. */
export async function loadTodayTaro(today: string): Promise<DailyTaro | null> {
  const json = await getRaw();
  if (!json) return null;
  try {
    const d = JSON.parse(json) as DailyTaro;
    return d.date === today ? d : null;
  } catch {
    return null;
  }
}

/** 오늘 뽑은 결과를 고정 저장(다음 진입 시 그대로 복원). */
export async function saveTodayTaro(d: DailyTaro): Promise<void> {
  await setRaw(JSON.stringify(d));
}
