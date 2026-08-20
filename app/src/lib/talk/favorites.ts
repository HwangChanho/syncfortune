// app/src/lib/talk/favorites.ts — 즐겨찾기 친구 (온디바이스)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"즐겨찾기 친구 칸을 상단에 만들고 거기에 노쎔을 고정으로 박고
//                    나머진 자유롭게 추가 제거 가능하게 하자"*
//
// ■ 왜 서버가 아니라 기기에 두나
//   즐겨찾기는 **화면 배치 취향**이지 계정 데이터가 아니다. 서버에 두면
//   ①로그인 전에는 못 쓰고 ②누를 때마다 왕복이 생긴다.
//   ⇒ 기기에 둔다. 기기를 바꾸면 초기화되지만, 다시 별을 누르는 비용은 한 번뿐이다.
//
// ■ ★고정(pinned)과 즐겨찾기(사용자 선택)를 **구분**한다
//   노쎔은 메인 상담사라 항상 맨 위에 있어야 한다. 사용자가 뺄 수 있게 두면
//   실수로 빼고 나서 "노쎔이 없어졌다"가 된다 — 그건 우리 잘못이지 사용자 잘못이 아니다.
//   ⇒ 고정은 코드가 정하고, 그 아래를 사용자가 자유롭게 채운다.
// ═══════════════════════════════════════════════════════════════════════════
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ⚠️이 앱엔 AsyncStorage 가 없다 — `expo-secure-store` 가 공통 스토리지다
//   (`genProgress.ts`·`logger.ts` 와 같은 선택). 즐겨찾기는 비밀이 아니지만 저장소를 늘리지 않는다.
async function getRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function setRaw(key: string, val: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(key, val);
  else await SecureStore.setItemAsync(key, val);
}

/** ★항상 맨 위에 고정되는 친구. 사용자가 뺄 수 없다(Boss 2026-08-20 "노쎔을 고정으로"). */
export const PINNED_IDS = ['nossem'] as const;

const KEY = 'pref.talkFavorites';
let _cache: string[] | null = null;
const subs = new Set<() => void>();

/** 즐겨찾기 변경 알림 — 목록 화면이 즉시 다시 그리게(저장 후 새로고침을 요구하지 않는다). */
export function subscribeFavorites(fn: () => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

/**
 * 지금 즐겨찾기 목록(고정 제외 · 사용자가 고른 것만).
 * @returns id 배열. 아직 안 읽었으면 빈 배열(첫 렌더가 멈추지 않게)
 */
export function favoritesSnapshot(): string[] {
  return _cache ?? [];
}

/** 저장소에서 한 번 읽어 캐시에 올린다. */
export async function loadFavorites(): Promise<string[]> {
  if (_cache) return _cache;
  try {
    const raw = await getRaw(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    _cache = Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch { _cache = []; }
  return _cache;
}

/** 즐겨찾기인가 — ★고정된 친구도 '켜짐'으로 본다(별이 비어 보이면 누르고 싶어진다). */
export function isFavorite(id: string): boolean {
  return (PINNED_IDS as readonly string[]).includes(id) || favoritesSnapshot().includes(id);
}

/** 고정이라 사용자가 끌 수 없는가. */
export function isPinned(id: string): boolean {
  return (PINNED_IDS as readonly string[]).includes(id);
}

/**
 * 즐겨찾기 토글.
 * @returns 바뀐 뒤 상태(true=즐겨찾기). ★고정된 친구면 아무것도 하지 않고 true.
 */
export async function toggleFavorite(id: string): Promise<boolean> {
  if (isPinned(id)) return true;              // 고정은 못 끈다(위 주석 참조)
  const cur = await loadFavorites();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  _cache = next;
  try { await setRaw(KEY, JSON.stringify(next)); } catch { /* 저장 실패해도 이번 세션은 반영된다 */ }
  subs.forEach((f) => f());
  return next.includes(id);
}

/**
 * 목록을 [즐겨찾기, 나머지] 로 가른다.
 *
 * @param ids 화면에 보이는 순서대로의 id
 * @returns `{ fav, rest }` — `fav` 는 **고정이 먼저**, 그다음 사용자가 고른 순서
 */
export function splitByFavorite<T extends { id: string }>(items: T[]): { fav: T[]; rest: T[] } {
  const pinned = PINNED_IDS as readonly string[];
  const chosen = favoritesSnapshot();
  const fav = [
    ...pinned.map((p) => items.find((i) => i.id === p)).filter(Boolean) as T[],
    ...chosen.map((c) => items.find((i) => i.id === c && !pinned.includes(c))).filter(Boolean) as T[],
  ];
  const favIds = new Set(fav.map((f) => f.id));
  return { fav, rest: items.filter((i) => !favIds.has(i.id)) };
}
