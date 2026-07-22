// src/lib/ui/homeOrder.ts — 홈 블록 배치 순서(계정별 저장·복원) · **전역 스토어**
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-19: "홈 배치순서를 계정별로 수정 가능하게" +
//   기본 순서 = 명식 → AI 코치 → 오늘의 기운 → 오늘의 관계 → 나의 성격유형 → 나는 어떤 사람인가.
//
// ★07-20 수정(daniel "홈 커스텀 안됨"): 기존 구현은 화면마다 useState 가 **독립**이라,
//   설정에서 순서를 바꿔 setOrder 해도 홈 화면의 훅 인스턴스는 stale → 홈에 반영이 안 됐다
//   (premiumStore 와 같은 부류의 버그: 화면별 독립 상태). → **모듈 전역 단일 상태 + useSyncExternalStore**
//   로 전환해 setHomeOrder 한 번이 설정·홈 전 구독자에 즉시 반영되게 한다.
//
// 저장 위치:
//   · 로그인  = `profiles.home_order`(jsonb) — 계정별이라 기기를 바꿔도 따라온다.
//   · 비로그인 = SecureStore 로컬. 로그인하면 서버 값이 우선(서버가 정본).
//   두 경우 모두 로컬 캐시 → 앱 시작 직후 첫 렌더에서 순서가 튀지 않게.
// ★알 수 없는 키·빠진 키 방어(normalizeOrder): 블록이 추가·삭제돼도 유저 설정이 깨지지 않는다.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';

/** 홈에서 순서를 바꿀 수 있는 블록. (헤더·풀이 진행률 배너·로그인 링크는 고정이라 제외) */
export type HomeBlockKey = 'chart' | 'coach' | 'today' | 'relation' | 'persona' | 'self' | 'biorhythm' | 'luck';

/** daniel 확정 기본 순서(2026-07-19) + 오늘의 관계(07-20) + 바이오리듬(07-21) + 오늘의 행운(07-22 코드큐).
 *  ★신규 블록(luck)은 '맨 아래' 기본(daniel 홈 길이·순서 민감) — 기존 사용자는 normalizeOrder 가 저장 순서 끝에 자동 덧붙인다. */
export const DEFAULT_HOME_ORDER: HomeBlockKey[] = ['chart', 'coach', 'today', 'relation', 'persona', 'self', 'biorhythm', 'luck'];

/** 블록 라벨 — 설정의 순서 편집 화면에 표시. */
export const HOME_BLOCK_LABEL: Record<HomeBlockKey, string> = {
  chart: '명식 선택',
  coach: 'AI 자기이해 코치',
  today: '오늘의 기운',
  relation: '오늘의 관계',
  persona: '나의 성격유형',
  self: '나는 어떤 사람인가',
  biorhythm: '바이오리듬',
  luck: '오늘의 행운',
};

const LOCAL_KEY = 'pref.homeOrder';

/**
 * 저장값을 현재 블록 목록에 맞춰 정규화한다.
 * @param raw 저장된 배열(신뢰할 수 없는 값)
 * @returns 알 수 없는 키를 제거하고, 빠진 블록을 기본 순서 자리에 덧붙인 배열
 */
export function normalizeOrder(raw: unknown): HomeBlockKey[] {
  const valid = new Set(DEFAULT_HOME_ORDER);
  const arr = Array.isArray(raw) ? raw.filter((k): k is HomeBlockKey => typeof k === 'string' && valid.has(k as HomeBlockKey)) : [];
  const seen = new Set(arr);
  return [...arr, ...DEFAULT_HOME_ORDER.filter((k) => !seen.has(k))];
}

/** 로컬 캐시 읽기(동기 실패해도 안전) — 첫 렌더 깜빡임 방지용. */
async function readLocal(): Promise<HomeBlockKey[] | null> {
  try {
    const v = await SecureStore.getItemAsync(LOCAL_KEY);
    return v ? normalizeOrder(JSON.parse(v)) : null;
  } catch { return null; }
}
async function writeLocal(order: HomeBlockKey[]): Promise<void> {
  try { await SecureStore.setItemAsync(LOCAL_KEY, JSON.stringify(order)); } catch { /* noop */ }
}

// ── 전역 단일 상태(모든 화면 공유) ─────────────────────────────────────────
let _order: HomeBlockKey[] = DEFAULT_HOME_ORDER;
let _ready = false;
const listeners = new Set<() => void>();
function emit(): void { for (const l of listeners) l(); }
function subscribe(cb: () => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }
const getOrder = (): HomeBlockKey[] => _order;   // useSyncExternalStore: 값 미변경 시 동일 참조(안정)
const getReady = (): boolean => _ready;
function sameOrder(a: HomeBlockKey[], b: HomeBlockKey[]): boolean { return a.length === b.length && a.every((x, i) => x === b[i]); }
/** 순서 반영(내용이 실제로 바뀔 때만 새 참조·emit — 동일 순서 재로드로 인한 불필요 리렌더 방지). */
function pushOrder(next: HomeBlockKey[]): void { if (!sameOrder(_order, next)) { _order = next; emit(); } }

/** 로컬 캐시 → (로그인 시)서버 순으로 읽어 전역 상태에 반영. 훅 마운트마다 호출(계정 전환·최신값 반영). */
export async function loadHomeOrder(): Promise<void> {
  const local = await readLocal();
  if (local) pushOrder(local);                       // 1차: 로컬 캐시 즉시(깜빡임 방지)
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) {
      const { data } = await supabase.from('profiles').select('home_order').eq('id', u.user.id).maybeSingle();
      if (data?.home_order) { const norm = normalizeOrder(data.home_order); pushOrder(norm); void writeLocal(norm); }
    }
  } catch { /* 서버 실패 시 로컬/기본값 유지 */ }
  if (!_ready) { _ready = true; emit(); }
}

/** 순서 저장 — 전역 즉시 반영(설정·홈 동시) + 로컬 + 서버(로그인 시). */
export async function setHomeOrder(next: HomeBlockKey[]): Promise<void> {
  const norm = normalizeOrder(next);
  pushOrder(norm);                                   // ★설정에서 바꾸면 홈도 즉시 반영(전역 스토어)
  await writeLocal(norm);
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) await supabase.from('profiles').update({ home_order: norm }).eq('id', u.user.id);
  } catch { /* 오프라인 등 — 화면은 이미 반영, 로컬 저장됨 */ }
}

/**
 * 홈 블록 순서 훅 — 전역 상태를 구독한다(설정·홈 어디서 바꿔도 동시 반영).
 * @returns order = 현재 순서 / setOrder = 저장(전역+로컬+서버) / reset = 기본값 / ready = 로드 완료 여부
 */
export function useHomeOrder() {
  const order = useSyncExternalStore(subscribe, getOrder);
  const ready = useSyncExternalStore(subscribe, getReady);
  useEffect(() => { void loadHomeOrder(); }, []);    // 마운트 시 최신값 로드(계정 전환 반영)
  const setOrder = useCallback((next: HomeBlockKey[]) => setHomeOrder(next), []);
  const reset = useCallback(() => setHomeOrder(DEFAULT_HOME_ORDER), []);
  return { order, setOrder, reset, ready };
}
