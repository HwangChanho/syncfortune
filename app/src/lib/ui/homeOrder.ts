// src/lib/ui/homeOrder.ts — 홈 블록 배치 순서(계정별 저장·복원) · **전역 스토어**
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-19: "홈 배치순서를 계정별로 수정 가능하게" +
//   기본 순서(daniel 07-23 확정) = 명식 → 만세력 → AI 코치 → 오늘의 기운 → 나는 어떤 사람인가 → 나의 성격유형 → 오늘의 관계 → 바이오리듬 → 오늘의 행운.
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

/** 홈에서 순서를 바꿀 수 있는 블록. (헤더·풀이 진행률 배너·로그인 링크는 고정이라 제외)
 *  ★manse(만세력)·coach(AI 코치)는 상단 '⚡ 바로가기' 메뉴로 / chart(명식 선택)는 홈에서 제거(daniel 2026-07-25) — 홈은 대표 명식 기준 자동 표시.
 *    (normalizeOrder 가 valid=DEFAULT 기준으로 필터하므로, 기존 사용자 저장값의 manse/coach/chart 는 자동 제거된다.) */
export type HomeBlockKey = 'today' | 'month' | 'banner' | 'relation' | 'relmap' | 'persona' | 'self' | 'biorhythm' | 'luck' | 'decision' | 'free3' | 'bonus';

/** daniel 확정 기본 순서 + 오늘의 관계(07-20) + 바이오리듬(07-21) + 오늘의 행운(07-22).
 *  ★07-25: manse·coach → 바로가기 메뉴 / chart(명식 선택) 제거. 오늘의 기운 → 나는 어떤 사람 → 성격유형 → 오늘의 관계 → 바이오리듬 → 오늘의 행운.
 *  ★신규 블록(luck)은 '맨 아래' 기본 — 기존 사용자는 normalizeOrder 가 저장 순서 끝에 자동 덧붙인다. */
//  ★07-26: 오늘의 결정(decision) 추가 — 신규 블록이라 '맨 아래' 기본(기존 사용자는 normalizeOrder 가 저장 순서 끝에 자동 덧붙임).
// ★08-06(daniel "오늘의 운세를 최상단에 놓고 그 아래 배너를 두자" + "편집에 배너도 위치이동 가능하게"):
//   배너(HouseAdBanner)를 헤더 고정에서 **드래그 가능한 블록**으로 옮겼다. 종전엔 헤더라 항상 today 위였고
//   순서를 바꿀 수도 없었다 — 첫 화면을 광고가 차지하는 배치를 사용자·운영자 둘 다 못 바꾸는 구조였다.
export const DEFAULT_HOME_ORDER: HomeBlockKey[] = ['today', 'month', 'banner', 'free3', 'bonus', 'self', 'persona', 'relation', 'relmap', 'biorhythm', 'luck', 'decision'];
//   ★'relmap'(관계 지도) 은 'relation'(오늘의 관계) 바로 뒤 — 둘 다 **사람** 이야기라 붙여 둔다(2026-08-14).
//     상대가 없으면 카드가 스스로 안 그려지므로 순서에 있어도 빈 자리가 생기지 않는다.

/** 블록 라벨 — 설정의 순서 편집 화면에 표시. */
export const HOME_BLOCK_LABEL: Record<HomeBlockKey, string> = {
  today: '오늘의 운세', // ★daniel 2026-08-06: '오늘의 기운' → '오늘의 운세'(풀이탭 '이달의 운세'와 짝)
  month: '이달의 운세', // ★Boss 2026-08-25 — 오늘의 운세와 짝. 성태현이 맡는다
  banner: '추천 배너', // ★08-06 부터 이동 가능한 블록(종전 고정 헤더)
  free3: '무료 체험 3종', // ★시안(니운내운.pdf p04) — 매일 도는 무료 카드 3장
  bonus: '도착한 혜택', // ★시안 p13 하단 — 보너스 쿠폰이 있을 때만 뜬다
  relation: '오늘의 관계',
  relmap: '관계 지도',
  persona: '나의 성격유형',
  self: '나는 어떤 사람인가',
  biorhythm: '바이오리듬',
  luck: '오늘의 행운',
  decision: '모먼트', // ★이름 변경(daniel 2026-07-26): 오늘의 결정 → 모먼트(결정 판정 + 설레는 제안)
};

const LOCAL_KEY = 'pref.homeOrder';
/** 전역 기본(관리자 콘솔) 캐시 — 첫 렌더에서 서버 응답을 기다리지 않게. */
const LOCAL_GLOBAL_KEY = 'pref.homeOrderGlobal';

/**
 * ★**운영자가 정하는 노출 목록 + 기본 순서**(2026-08-16 Boss "관리자 페이지에서 홈 메뉴구성 변경").
 *
 * 종전엔 `DEFAULT_HOME_ORDER`(코드 상수)가 유일한 기본이라 **배치를 바꾸려면 앱을 다시 내야 했다.**
 * 이제 `app_config.home_order`(익명 읽기 가능·관리자만 쓰기)가 그 자리를 대신한다.
 *
 * ■ 두 층을 분리한다
 *   · **전역**(여기) = *어떤 블록이 존재하는가* + 기본 순서 → 운영자가 정한다
 *   · **개인**(profiles.home_order) = 그 안에서의 순서 → 사용자가 정한다
 *   ⇒ 운영자가 블록을 빼면 **모두에게서 사라진다**(개인 설정이 되살리지 못한다).
 *     종전 `normalizeOrder` 는 빠진 키를 자동으로 되붙였기 때문에 그대로 두면 '숨기기'가 동작하지 않는다.
 *
 * 서버를 못 읽으면 코드 상수로 떨어진다(앱이 빈 홈이 되는 일은 없다).
 */
let _allowed: HomeBlockKey[] = DEFAULT_HOME_ORDER;

/**
 * 저장값을 현재 블록 목록에 맞춰 정규화한다.
 * @param raw 저장된 배열(신뢰할 수 없는 값)
 * @returns 알 수 없는 키를 제거하고, 빠진 블록을 기본 순서 자리에 덧붙인 배열
 */
/**
 * 신규 블록의 **기본 자리**(맨 뒤가 아닌 것만). `[블록, 이 블록 바로 뒤에]`.
 * 순서대로 적용되므로 뒤 항목이 앞 항목 뒤에 붙을 수 있다(free3 는 banner 뒤 = today 아래 두 번째).
 */
const NEW_BLOCK_ANCHOR: ReadonlyArray<readonly [HomeBlockKey, HomeBlockKey]> = [
  ['month', 'today'],    // ★Boss 2026-08-25 — 이달의 운세는 **오늘의 운세 바로 아래**(짝이라 붙여 둔다)
  ['banner', 'month'],   // daniel 2026-08-06 "배너는 오늘의 운세 바로 아래" → 이제 이달 다음
  ['free3', 'banner'],   // 시안 p04 — 배너 다음이 무료 3열
  ['bonus', 'free3'],    // 시안 p13 — 무료 3열 다음이 혜택
];

export function normalizeOrder(raw: unknown): HomeBlockKey[] {
  const valid = new Set(_allowed);   // ★코드 상수가 아니라 **운영자가 정한 목록** 기준
  const arr = Array.isArray(raw) ? raw.filter((k): k is HomeBlockKey => typeof k === 'string' && valid.has(k as HomeBlockKey)) : [];
  const seen = new Set(arr);
  const out = [...arr, ..._allowed.filter((k) => !seen.has(k))];
  // ★신규 블록은 기본은 '맨 뒤'지만, **배너만은 오늘의 운세 바로 아래**여야 한다
  //   (daniel 2026-08-06 "배너는 홈에서 오늘의 운세 바로 아래로 두라고").
  //   기존 사용자는 저장된 order 에 banner 가 없어 위 로직대로면 **맨 끝**에 붙는다 —
  //   기본 순서만 바꿔서는 이미 쓰던 계정에 반영되지 않는다(그래서 실물에서 안 바뀌어 보였다).
  // ★08-18: `free3`(무료 체험 3종)도 같은 사정이다 — 기존 사용자의 저장 order 에 없어서 맨 끝으로 밀린다.
  //   그래서 특례를 **표로 일반화**했다. 앞으로 '기본 자리가 맨 뒤가 아닌' 블록은 여기 한 줄만 더하면 된다.
  let cur = out;
  for (const [key, after] of NEW_BLOCK_ANCHOR) {
    if (seen.has(key) || !_allowed.includes(key)) continue;   // 이미 저장돼 있으면 사용자의 순서를 존중한다
    const rest = cur.filter((k) => k !== key);
    const at = rest.indexOf(after);
    rest.splice(at >= 0 ? at + 1 : 0, 0, key);
    cur = rest;
  }
  return cur;
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
  // 0차: 전역 목록(관리자) — 캐시 먼저 적용하고 서버로 갱신한다.
  //   ★이걸 **개인 설정보다 먼저** 세워야 한다. `normalizeOrder` 가 이 목록을 기준으로 거르기 때문.
  try {
    const cached = await SecureStore.getItemAsync(LOCAL_GLOBAL_KEY);
    if (cached) { const g = JSON.parse(cached); if (Array.isArray(g) && g.length) _allowed = g; }
  } catch { /* 캐시 없음 — 코드 상수로 */ }
  try {
    // ★두 줄을 함께 읽는다(2026-08-18) — `home_order`(노출·순서)와 `home_hidden`(운영자가 **뺀** 블록).
    //   왜 나눴나: 종전엔 `home_order` 하나로 "이게 전부"라고 봤다. 그러면 **새로 배포한 블록**이
    //   서버 목록에 없다는 이유로 안 나오고, 블록을 낼 때마다 관리자 콘솔을 눌러야 했다.
    //   ('운영자가 뺀 것'과 '서버가 아직 모르는 것'이 구분되지 않았던 것 — 실제로 `free3` 가 이걸로 막혔다.)
    const { data: rows } = await supabase.from('app_config').select('key, value').in('key', ['home_order', 'home_hidden']);
    const pick = (k: string) => (Array.isArray(rows) ? rows.find((r) => r?.key === k)?.value : undefined);
    const g = pick('home_order');
    const hiddenRaw = pick('home_hidden');
    const hidden = new Set<HomeBlockKey>(Array.isArray(hiddenRaw) ? (hiddenRaw as HomeBlockKey[]) : []);
    if (Array.isArray(g) && g.length) {
      // 코드에 없는 키(옛 블록)는 버린다 — 운영자가 실수해도 앱이 깨지지 않게
      const known = new Set(DEFAULT_HOME_ORDER);
      const next = g.filter((k: unknown): k is HomeBlockKey => typeof k === 'string' && known.has(k as HomeBlockKey));
      // 서버가 모르는 **신규** 블록을 뒤에 잇는다 — 단, 운영자가 명시적으로 숨긴 것은 뺀다.
      const seenSrv = new Set(next);
      const fresh = DEFAULT_HOME_ORDER.filter((k) => !seenSrv.has(k) && !hidden.has(k));
      const merged = [...next, ...fresh];
      if (merged.length) { _allowed = merged; void SecureStore.setItemAsync(LOCAL_GLOBAL_KEY, JSON.stringify(merged)).catch(() => {}); }
    }
  } catch { /* 오프라인 등 — 캐시/코드 상수 유지 */ }
  pushOrder(normalizeOrder(_order));                 // 전역 목록이 바뀌었으면 현재 순서를 그 안으로 재정렬

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
