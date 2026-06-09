// app/src/lib/tarotStore.ts — 오늘의 타로 결과 저장(주제별 하루 1회·결과 고정)
// ─────────────────────────────────────────────────────────────────────────
// 주제(연애·직장·재물·건강·종합)마다 하루 1회, 첫 카드부터 그날 결과 고정(재진입 시 같은 카드).
//   주제별 독립 — 연애를 봤어도 직장은 따로 새로 볼 수 있다. 자정(로컬 날짜)에 초기화.
//   PII 아님 — native=SecureStore / web=localStorage.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SpreadCard } from './tarot';

// 주제별 키(SecureStore 키는 영숫자/._- 만 허용 → categoryKey=love/work/… 안전)
const keyFor = (categoryKey: string) => `taro_daily_${categoryKey}`;

export type DailyTaro = { date: string; cards: SpreadCard[]; drawn: number };

async function getRaw(k: string): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(k) ?? null;
  return SecureStore.getItemAsync(k);
}
async function setRaw(k: string, v: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(k, v);
  else await SecureStore.setItemAsync(k, v);
}

/** 오늘(today='YYYY-M-D') 그 주제(categoryKey)의 진행/결과가 있으면 반환(주제별 독립 고정). */
export async function loadTodayTaro(today: string, categoryKey: string): Promise<DailyTaro | null> {
  const json = await getRaw(keyFor(categoryKey));
  if (!json) return null;
  try {
    const d = JSON.parse(json) as DailyTaro;
    return d.date === today ? d : null; // 어제 것이면 무효(자정 초기화)
  } catch {
    return null;
  }
}

/** 그 주제의 오늘 결과(진행 포함)를 고정 저장. 첫 카드부터 호출 → 나갔다 와도 이어서 복원. */
export async function saveTodayTaro(today: string, categoryKey: string, cards: SpreadCard[], drawn: number): Promise<void> {
  await setRaw(keyFor(categoryKey), JSON.stringify({ date: today, cards, drawn } satisfies DailyTaro));
}
