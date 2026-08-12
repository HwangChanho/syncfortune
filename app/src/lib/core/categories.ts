// app/src/lib/core/categories.ts — 명식 카테고리(관계) 관리 (daniel 2026-07-18)
// ─────────────────────────────────────────────────────────────────────────
// 등록 화면에서 카테고리를 신규 생성·삭제하고, 그게 리스트 필터에 반영된다. 카테고리를 삭제하면
//   그 카테고리에 속한 명식들의 relation 이 '기타'로 자동 이동한다.
//   프리셋(가족·지인·연인·관심·반려동물·공인)은 기본 제공하되 숨김(삭제) 가능 + 사용자 커스텀 추가.
//   본인(self)·기타(OTHER)는 특수 — 목록 관리/삭제 대상 아님(self=본인 명식 고정, 기타=default 이동처).
// 저장: SecureStore(로컬). 커스텀 목록 + 숨긴 프리셋. 명식 relation 자체는 myChart 가 소유(계정 동기화).
// ─────────────────────────────────────────────────────────────────────────
import * as SecureStore from 'expo-secure-store';
// ★myChart 는 **정적 import 하지 않는다** — myChart 가 이 파일을(readCategoryState) import 하므로
//   정적으로 두면 **순환 참조**가 되고, 평가 순서에 따라 한쪽이 undefined 로 잡혀 런타임에 죽는다.
//   reassignRelation 은 '사용자가 카테고리를 지울 때'만 필요하다 = 그 시점엔 모든 모듈이 이미 로드돼 있다.
//   ⇒ 호출 시점에 lazy require([[launch-crash-native-import-and-hermes-build]] 와 같은 처방).

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { reassignRelation } = require('../engine/myChart') as typeof import('../engine/myChart');
  await reassignRelation(name, OTHER_CATEGORY); // ★소속 명식 → 기타 일괄(daniel 스펙)
}

/** 삭제(숨김/제거) 가능한 카테고리인가 — self·기타는 불가. */
export function isRemovable(name: string): boolean {
  return name !== OTHER_CATEGORY && name !== 'self';
}

// ─────────────────────────────────────────────────────────────────────────
// ★계정 동기화(daniel 2026-08-12 "다 고쳐")
//   종전엔 커스텀·숨김이 **SecureStore(로컬)에만** 있어 기기를 바꾸면 사라졌다.
//   명식의 소속(relation)은 myChart blob 으로 따라오는데 **카테고리 목록만 안 따라와서**,
//   새 기기에선 '가족'에 속한 명식은 있는데 '가족'이라는 카테고리는 없는 상태가 됐다.
//
//   ★왜 profiles 컬럼이 아니라 **명식 blob 에 싣나**
//     ① 카테고리는 명식의 relation 이 가리키는 대상이다 — **따로 동기화하면 어긋난 순간이 생긴다**
//        (명식은 왔는데 카테고리는 아직인 상태). 같은 blob 이면 원자적으로 함께 온다.
//     ② blob 은 owner 전용 **Vault 암호화**(ADR-056) — 카테고리 이름도 개인정보다('전 여친' 같은).
//     ③ DDL 이 필요 없다.
// ─────────────────────────────────────────────────────────────────────────

/** 동기화에 실을 카테고리 상태. `custom`=사용자가 만든 것 · `hidden`=사용자가 지운 프리셋. */
export type CategoryState = { custom: string[]; hidden: string[] };

/** 지금 로컬 상태를 읽는다(blob 에 실을 때). */
export function readCategoryState(): CategoryState {
  return { custom: readArr(CUSTOM_KEY), hidden: readArr(HIDDEN_KEY) };
}

/**
 * 서버 상태를 로컬과 **합집합 머지**한다(blob 을 받았을 때).
 * ★삭제(hidden)도 반드시 함께 실어야 한다 — 안 그러면 "지운 프리셋이 새 기기에서 되살아난다".
 * ★합집합인 이유: 두 기기가 각자 만든 카테고리를 **잃지 않기 위해**(명식 머지와 같은 규칙).
 *   대신 '한쪽에서 지운 것'은 hidden 에 남아 양쪽에서 지워진 상태로 수렴한다.
 * @returns 로컬이 실제로 바뀌었으면 true(호출측이 재푸시 여부를 정한다)
 */
export async function mergeCategoryState(server: Partial<CategoryState> | null | undefined): Promise<boolean> {
  if (!server) return false;
  const local = readCategoryState();
  const uni = (a: string[], b: string[]) => [...new Set([...(a ?? []), ...(b ?? [])])].filter(Boolean);
  const custom = uni(local.custom, server.custom ?? []);
  const hidden = uni(local.hidden, server.hidden ?? []);
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i]);
  if (same(custom, local.custom) && same(hidden, local.hidden)) return false;
  await writeArr(CUSTOM_KEY, custom);
  await writeArr(HIDDEN_KEY, hidden);
  return true;
}
