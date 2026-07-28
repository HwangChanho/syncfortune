// app/src/lib/billing/adFree.ts — 광고 제거(코인 구매) 전역 store
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "광고 제거를 코인으로 살수있게 하자"
//
// ★왜 store 인가: 광고 배너(AdBanner)는 **모든 화면 하단**에 있다. 화면마다 각자 상태를 들고 있으면
//   구매 직후 한 화면만 광고가 사라지고 다른 화면은 그대로 남는다 — premiumStore 가 정확히 그 문제로
//   만들어졌다(2026-06-24). 같은 패턴(모듈 전역 + useSyncExternalStore)을 따른다.
//
// ★진실원천 = 서버 profiles.ad_free_until **하나**. 클라는 읽기만 한다.
//   구매도 서버 RPC(buy_ad_free)가 금액·기간을 정한다 — 클라가 금액을 넘기면
//   "1코인 내고 광고 제거"가 가능해지기 때문(spend_coins 는 Edge 전용이라 안전하지만 이건 클라 호출).
//
// ★영구 = 9999-12-31 로 저장된다. 그래서 판정은 `now < until` 한 번이면 끝난다(특수값 분기 불필요).
// ─────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabase';

/** 영구 판정 기준 — 이 시각 이상이면 '영구'로 표시한다(서버 저장값 9999-12-31). */
const FOREVER_FROM = new Date('9000-01-01T00:00:00Z').getTime();

let _until: number | null = null;   // 만료 시각(ms). null = 광고 제거 없음
let _loaded = false;                // 최초 조회 완료 여부
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }

/** 포그라운드 복귀 시 재조회(다른 기기·관리자 조정 반영). 모듈 1회만 등록. */
let _fgSub: { remove?: () => void } | null = null;
function ensureForegroundRefresh(): void {
  if (_fgSub) return;
  try {
    _fgSub = AppState.addEventListener('change', (s) => { if (s === 'active') void refreshAdFree(); }) as any;
  } catch { /* 모듈 문제 시 무시 — 광고는 켜진 채로(수익 보수적) */ }
}

/**
 * 서버에서 광고 제거 만료 시각을 다시 읽는다.
 * ★조회 실패 시 **기존 값을 유지**한다(광고를 갑자기 켜지 않는다) — 돈 낸 사용자에게
 *   네트워크 문제로 광고가 다시 뜨는 건 명백한 손해다. 미로그인만 명시적으로 해제.
 */
export async function refreshAdFree(): Promise<void> {
  ensureForegroundRefresh();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { _until = null; _loaded = true; emit(); return; }
    const { data, error } = await supabase.from('profiles').select('ad_free_until').eq('id', session.user.id).maybeSingle();
    if (error) return;                                  // ★실패 = 유지(위 주석)
    const raw = (data as { ad_free_until?: string | null } | null)?.ad_free_until ?? null;
    _until = raw ? new Date(raw).getTime() : null;
    _loaded = true;
    emit();
  } catch { /* 유지 */ }
}

/** 구독 등록(useSyncExternalStore). */
export function subscribeAdFree(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** 지금 광고 제거가 유효한가(원시 boolean — 동일성 안정). */
export function getAdFreeSnapshot(): boolean {
  return _until != null && _until > Date.now();
}

/** 만료 시각(ms) — null=없음. 화면 표기용. */
export function getAdFreeUntilSnapshot(): number | null { return _until; }

/** 영구 구매 여부(9999-12-31 저장분). */
export function isAdFreeForever(): boolean { return _until != null && _until >= FOREVER_FROM; }

/** 최초 조회 완료 여부 — 조회 전에는 광고를 띄우지 않는다(깜빡임 방지). */
export function isAdFreeLoaded(): boolean { return _loaded; }

/** 훅 — 광고 제거 유효 여부. */
export function useAdFree(): boolean {
  return useSyncExternalStore(subscribeAdFree, getAdFreeSnapshot, getAdFreeSnapshot);
}

/** 훅 — 만료 시각(표기용). */
export function useAdFreeUntil(): number | null {
  return useSyncExternalStore(subscribeAdFree, getAdFreeUntilSnapshot, getAdFreeUntilSnapshot);
}

export type AdFreePlan = 'adfree_30' | 'adfree_forever';
export type BuyAdFreeResult =
  | { ok: true; until: number | null; already?: boolean }
  | { ok: false; reason: 'insufficient'; balance: number; cost: number }
  | { ok: false; reason: 'auth' | 'plan' | 'error' };

/**
 * 광고 제거 구매(코인 차감 + 기간 연장) — 전부 서버 RPC 한 번에서 원자적으로 처리된다.
 * @param plan 'adfree_30'(30일) | 'adfree_forever'(영구)
 * @returns 성공 시 갱신된 만료 시각. 잔액 부족이면 부족분 판단용 balance/cost 동봉.
 * ⚠️금액은 **서버가 정한다** — 여기서 비용을 보내지 않는다(위조 방지).
 */
export async function buyAdFree(plan: AdFreePlan): Promise<BuyAdFreeResult> {
  const { data, error } = await supabase.rpc('buy_ad_free', { p_plan: plan });
  if (error) return { ok: false, reason: 'error' };
  const r = data as any;
  if (r?.ok) {
    _until = r.until ? new Date(r.until).getTime() : _until;
    emit();
    return { ok: true, until: _until, already: !!r.already };
  }
  if (r?.error === 'insufficient') return { ok: false, reason: 'insufficient', balance: Number(r.balance ?? 0), cost: Number(r.cost ?? 0) };
  return { ok: false, reason: (r?.error === 'auth' || r?.error === 'plan') ? r.error : 'error' };
}
