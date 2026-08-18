// app/src/lib/content/favorites.ts — 콘텐츠 찜하기 (시안 마이페이지 「찜한 콘텐츠」)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 무엇을 담나
//   `contentSections` 카드 키(`compat`·`talent`·`taro`…). "나중에 보고 싶다"는 표시라
//   명식·결제와 무관하게 **사람 단위로 하나**면 된다.
//
// ■ 로컬 + 서버 (익명 사용을 막지 않는다)
//   · 비로그인 → 기기 로컬에만 담긴다. 하트를 누르려고 로그인을 강요하지 않는다
//     (이 앱은 익명 사용을 전제로 심사까지 통과했다 — [[appstore-rejection-2026-07-08]]).
//   · 로그인   → 서버가 정본. 로컬에 있던 것은 **처음 로그인한 순간 합쳐 올린다**(지우지 않는다).
//   ⇒ 합집합으로 병합한다. 찜은 지워서 손해 볼 게 없는 데이터라, 충돌하면 '있는 쪽'을 택한다.
//
// ■ 왜 낙관적 갱신인가
//   하트는 누른 즉시 채워져야 한다. 서버 왕복을 기다리면 두 번 누르게 되고, 그러면 토글이 꼬인다.
//   ⇒ 로컬을 먼저 바꾸고 화면에 알린 뒤 서버로 보낸다. 서버가 실패해도 로컬은 남아 다음 기회에 올라간다.
//   ⚠️서버 PK 가 `(owner_id, content_key)` 라 같은 것을 두 번 보내도 DB 가 중재한다(앱이 막지 않아도 된다).
// ═══════════════════════════════════════════════════════════════════════════
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';
import { logEvent } from '../backend/logger';

const LOCAL_KEY = 'pref.favorites';

/** 구독자 — 하트가 여러 화면에 동시에 떠 있어도 같은 값을 본다. */
type Listener = (keys: Set<string>) => void;
const listeners = new Set<Listener>();
let _keys = new Set<string>();
let _loaded = false;

function emit(): void { const snap = new Set(_keys); listeners.forEach((fn) => fn(snap)); }

async function readLocal(): Promise<string[]> {
  try {
    const raw = Platform.OS === 'web'
      ? (globalThis as any).localStorage?.getItem(LOCAL_KEY)
      : await SecureStore.getItemAsync(LOCAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

async function writeLocal(keys: Set<string>): Promise<void> {
  const json = JSON.stringify([...keys]);
  try {
    if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(LOCAL_KEY, json);
    else await SecureStore.setItemAsync(LOCAL_KEY, json);
  } catch { /* 저장 실패해도 이번 세션은 메모리로 동작한다 */ }
}

/**
 * 찜 목록을 읽어 메모리에 세운다. 로그인 상태면 서버와 합친다.
 *
 * @returns 지금 찜한 키 집합
 * ★여러 번 불러도 안전하다(화면 진입마다 호출). 서버 실패 시 로컬만으로 계속 동작한다.
 */
export async function loadFavorites(): Promise<Set<string>> {
  const local = new Set(await readLocal());
  _keys = local;
  _loaded = true;
  emit();                                  // 서버를 기다리지 않고 먼저 보여준다

  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return _keys;            // 비로그인 — 로컬이 전부

    const r = await withTimeout(supabase.from('content_favorites').select('content_key'), 8000);
    if (!r || r.error || !r.data) return _keys;   // 조회 실패 — 로컬 유지(빈 목록으로 덮지 않는다)

    const server = new Set<string>(r.data.map((x: { content_key: string }) => x.content_key));
    // ★합집합 — 로컬에만 있던 것(로그인 전에 찜한 것)을 서버로 올린다
    const onlyLocal = [...local].filter((k) => !server.has(k));
    if (onlyLocal.length) {
      await supabase.from('content_favorites')
        .upsert(onlyLocal.map((k) => ({ owner_id: u.user.id, content_key: k })), { onConflict: 'owner_id,content_key' });
      logEvent('favorites_merged_up', { count: onlyLocal.length });
    }
    _keys = new Set([...server, ...local]);
    void writeLocal(_keys);
    emit();
  } catch { /* 네트워크 문제 — 로컬로 계속 */ }
  return _keys;
}

/** 지금 찜했는가(메모리 조회 — 화면이 자주 묻는다). */
export function isFavorite(key: string): boolean { return _keys.has(key); }

/** 아직 한 번도 안 읽었는가(첫 렌더에서 로딩 표시가 필요한 화면용). */
export function favoritesLoaded(): boolean { return _loaded; }

/** 지금 찜 목록 스냅샷. */
export function favoriteKeys(): Set<string> { return new Set(_keys); }

/**
 * 찜 토글.
 *
 * @param key `contentSections` 카드 키
 * @returns 토글 후 상태(true = 찜함)
 * ★낙관적 — 로컬·화면을 먼저 바꾸고 서버로 보낸다.
 */
export async function toggleFavorite(key: string): Promise<boolean> {
  const now = !_keys.has(key);
  if (now) _keys.add(key); else _keys.delete(key);
  emit();
  void writeLocal(_keys);

  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return now;              // 비로그인 — 로컬에만 남는다(로그인하면 올라간다)
    if (now) {
      await supabase.from('content_favorites')
        .upsert({ owner_id: u.user.id, content_key: key }, { onConflict: 'owner_id,content_key' });
    } else {
      await supabase.from('content_favorites').delete().eq('content_key', key);   // RLS 가 owner 를 건다
    }
  } catch { /* 실패해도 로컬은 남는다 — 다음 loadFavorites 에서 다시 올라간다 */ }
  return now;
}

/**
 * 찜 변경 구독.
 * @param fn 변경마다 호출(현재 집합을 받는다)
 * @returns 해지 함수
 */
export function subscribeFavorites(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
