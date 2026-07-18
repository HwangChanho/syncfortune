// app/src/lib/core/categories.ts — 명식 카테고리(관계) 관리 (daniel 2026-07-18)
// ─────────────────────────────────────────────────────────────────────────
// 등록 화면에서 카테고리를 신규 생성·삭제하고, 그게 리스트 필터에 반영된다. 카테고리를 삭제하면
//   그 카테고리에 속한 명식들의 relation 이 '기타'로 자동 이동한다.
//   프리셋(가족·지인·연인·관심·반려동물·공인)은 기본 제공하되 숨김(삭제) 가능 + 사용자 커스텀 추가.
//   본인(self)·기타(OTHER)는 특수 — 목록 관리/삭제 대상 아님(self=본인 명식 고정, 기타=default 이동처).
// 저장: SecureStore(로컬). 커스텀 목록 + 숨긴 프리셋. 명식 relation 자체는 myChart 가 소유(계정 동기화).
// ─────────────────────────────────────────────────────────────────────────
import * as SecureStore from 'expo-secure-store';
import { reassignRelation } from '../engine/myChart';

const PRESET = ['가족', '지인', '연인', '관심', '반려동물', '공인'] as const;
export const OTHER_CATEGORY = '기타';
const CUSTOM_KEY = 'pref.customCategories'; // 사용자 추가 카테고리 (JSON string[])
const HIDDEN_KEY = 'pref.hiddenCategories'; // 삭제(숨김)한 프리셋 (JSON string[])

function readArr(key: string): string[] {
  try { const v = (SecureStore as any).getItem?.(key); return v ? (JSON.parse(v) as string[]) : []; } catch { return []; }
}
async function writeArr(key: string, arr: string[]): Promise<void> {
  const s = JSON.stringify(arr);
  try { (SecureStore as any).setItem?.(key, s); } catch { /* noop */ }
  await SecureStore.setItemAsync(key, s).catch(() => {});
}

/** 등록 선택지용 카테고리 목록 — 프리셋(숨김 제외) + 커스텀 + '기타'. self(본인)는 등록 화면이 별도 표시. */
export function getCategories(): string[] {
  const hidden = new Set(readArr(HIDDEN_KEY));
  const custom = readArr(CUSTOM_KEY).filter((c) => c && c !== OTHER_CATEGORY && c !== 'self');
  const presets = PRESET.filter((p) => !hidden.has(p));
  return [...new Set([...presets, ...custom]), OTHER_CATEGORY]; // 중복 제거 + 기타는 항상 맨 뒤
}

/** 커스텀 카테고리 추가. 이미 있음/기타/self 는 무시. 숨겼던 프리셋 재추가면 숨김 해제로 부활. */
export async function addCategory(name: string): Promise<void> {
  const n = name.trim();
  if (!n || n === OTHER_CATEGORY || n === 'self') return;
  if ((PRESET as readonly string[]).includes(n)) {
    const hidden = readArr(HIDDEN_KEY);
    if (hidden.includes(n)) await writeArr(HIDDEN_KEY, hidden.filter((h) => h !== n)); // 숨김 해제
    return;
  }
  const custom = readArr(CUSTOM_KEY);
  if (!custom.includes(n)) { custom.push(n); await writeArr(CUSTOM_KEY, custom); }
}

/** 카테고리 삭제 + 소속 명식 relation → '기타'. self·기타는 삭제 불가. 프리셋=숨김 처리, 커스텀=목록 제거. */
export async function removeCategory(name: string): Promise<void> {
  if (name === OTHER_CATEGORY || name === 'self') return;
  if ((PRESET as readonly string[]).includes(name)) {
    const hidden = readArr(HIDDEN_KEY);
    if (!hidden.includes(name)) { hidden.push(name); await writeArr(HIDDEN_KEY, hidden); }
  } else {
    await writeArr(CUSTOM_KEY, readArr(CUSTOM_KEY).filter((c) => c !== name));
  }
  await reassignRelation(name, OTHER_CATEGORY); // ★소속 명식 → 기타 일괄(daniel 스펙)
}

/** 삭제(숨김/제거) 가능한 카테고리인가 — self·기타는 불가. */
export function isRemovable(name: string): boolean {
  return name !== OTHER_CATEGORY && name !== 'self';
}
