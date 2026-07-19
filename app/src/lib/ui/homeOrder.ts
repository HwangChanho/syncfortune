// src/lib/ui/homeOrder.ts — 홈 블록 배치 순서(계정별 저장·복원)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-19: "홈 배치순서를 계정별로 수정 가능하게 하고싶어" +
//   기본 순서 = 명식 → AI 코치 배너 → 오늘의 기운 → 나의 성격유형 → 나는 어떤 사람인가.
//
// 저장 위치:
//   · 로그인  = `profiles.home_order`(jsonb) — **계정별**이라 기기를 바꿔도 따라온다.
//   · 비로그인 = SecureStore 로컬. 로그인하면 서버 값이 우선(서버가 정본).
//   두 경우 모두 로컬에 캐시해 두어 앱 시작 직후 첫 렌더에서 순서가 튀지 않게 한다.
//
// ★알 수 없는 키·빠진 키 방어: 저장된 배열에 지금 없는 키가 있으면 버리고, 새로 생긴 블록은 뒤에 붙인다.
//   (블록이 추가·삭제돼도 유저 설정이 깨지지 않는다 — 마이그레이션 불필요.)
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';

/** 홈에서 순서를 바꿀 수 있는 블록. (헤더·풀이 진행률 배너·로그인 링크는 고정이라 제외) */
export type HomeBlockKey = 'chart' | 'coach' | 'today' | 'persona' | 'self';

/** daniel 확정 기본 순서(2026-07-19). */
export const DEFAULT_HOME_ORDER: HomeBlockKey[] = ['chart', 'coach', 'today', 'persona', 'self'];

/** 블록 라벨 — 설정의 순서 편집 화면에 표시. */
export const HOME_BLOCK_LABEL: Record<HomeBlockKey, string> = {
  chart: '명식 선택',
  coach: 'AI 자기이해 코치',
  today: '오늘의 기운',
  persona: '나의 성격유형',
  self: '나는 어떤 사람인가',
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
  // 새로 생긴 블록(저장 당시엔 없던 것)은 기본 순서를 따라 뒤에 붙인다 — 사라지지 않게.
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

/**
 * 홈 블록 순서를 읽고 저장하는 훅.
 * @returns order = 현재 순서 / setOrder = 저장(서버+로컬) / reset = 기본값으로 / ready = 로드 완료 여부
 */
export function useHomeOrder() {
  const [order, setOrderState] = useState<HomeBlockKey[]>(DEFAULT_HOME_ORDER);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = await readLocal();
      if (alive && local) setOrderState(local);      // 1차: 로컬 캐시로 즉시 반영(깜빡임 방지)
      // 2차: 로그인 상태면 서버가 정본 — 계정을 바꿔 로그인해도 그 계정 순서가 나온다.
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u?.user) { if (alive) setReady(true); return; }
        const { data } = await supabase.from('profiles').select('home_order').eq('id', u.user.id).maybeSingle();
        if (!alive) return;
        if (data?.home_order) {
          const norm = normalizeOrder(data.home_order);
          setOrderState(norm);
          writeLocal(norm);                          // 다음 시작을 위해 캐시
        }
      } catch { /* 서버 실패 시 로컬/기본값 유지 */ }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  /** 순서 저장 — 로컬 즉시 + 서버(로그인 시). 서버 실패해도 로컬은 유지된다. */
  const setOrder = useCallback(async (next: HomeBlockKey[]) => {
    const norm = normalizeOrder(next);
    setOrderState(norm);
    await writeLocal(norm);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) await supabase.from('profiles').update({ home_order: norm }).eq('id', u.user.id);
    } catch { /* 오프라인 등 — 로컬엔 남아 다음 접속 때 다시 시도되지 않지만, 화면은 이미 반영됨 */ }
  }, []);

  const reset = useCallback(() => setOrder(DEFAULT_HOME_ORDER), [setOrder]);

  return { order, setOrder, reset, ready };
}
