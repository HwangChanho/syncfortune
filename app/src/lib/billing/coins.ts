// app/src/lib/billing/coins.ts — 코인 가격표·잔액·차감(단일 출처)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "모든 풀이는 코인으로 구매하고 코인 충전해서 하는 식으로"
// 기획서 = docs/PLAN_coin_system.md
//
// ★왜 코인인가(오늘 실제로 터진 것들이 근거):
//   건당 결제는 **콘텐츠를 볼 때마다 스토어 왕복**을 한다. 그 왕복이 반복적으로 깨졌다 —
//   결제창 지연·무표시, 결제 후 백그라운드 시 적립 폴링 실패, 조회 실패를 '없음'으로 오해한 재결제 유도.
//   코인은 **결제를 충전 1회로 모으고, 소비는 서버 원자적 차감**(폴링 없음)으로 바꾼다.
//
// ★환산 = **1코인 = ₩100**. 기존 단가를 그대로 옮긴다(인상·인하 없음 — 기존 사용자 신뢰).
// ★적립은 서버(웹훅)만 — 이 파일에는 적립 함수를 두지 않는다(클라 적립 = 결제 우회).
// ⚠️가격 조정은 daniel 슬롯. 여기가 **단일 출처**이고 하네스(check:coins)가 누락·불일치를 잡는다.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import { CREDIT_KINDS, type CreditKind } from './coupons';

export { WON_PER_COIN, COIN_PRICE, COIN_PACKS } from './coinPrices';   // ★가격표는 순수 파일에(하네스가 런타임 없이 검증)
import { COIN_PRICE } from './coinPrices';

/** 이 콘텐츠의 코인 가격(미등록이면 null — 화면은 '가격 미정'으로 안전 처리). */
export function coinPriceOf(kind: string): number | null {
  return (COIN_PRICE as Record<string, number>)[kind] ?? null;
}

/**
 * 현재 코인 잔액.
 * @returns 잔액 / **조회 실패 시 null**
 * ★'0'과 '확인 불가'를 반드시 구분한다 — 오늘 재결제 사고의 근인이 정확히 이 혼동이었다
 *   (조회 실패를 '없음'으로 읽고 결제창을 다시 띄웠다). 실패면 충전을 권하지 말고 재시도를 안내할 것.
 */
export async function coinBalanceOrNull(): Promise<number | null> {
  const { data, error } = await supabase.from('coin_balance').select('balance').maybeSingle();
  if (error) return null;
  return Number((data as { balance?: number } | null)?.balance ?? 0);
}

/**
 * 코인 차감(서버 원자적). 잔액이 모자라면 false — 클라는 잔액을 만질 수 없다.
 * @returns 차감 성공 여부. 통신 실패도 false 이므로 **호출측은 잔액을 다시 확인**해야 한다.
 */
export async function spendCoins(kind: string, cost: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('spend_coins', { p_kind: kind, p_cost: cost });
  return !error && data === true;
}

/**
 * 클라가 직접 차감하는 경우(= Edge 생성 단계가 없는 '도구') 전용.
 * @param kind 서버 화이트리스트에 등록된 kind 만 허용(현재 'timeresolve')
 * @returns 성공 여부 + 실패 사유. **금액은 서버가 정한다**(클라가 비용을 보내지 않는다).
 *
 * ★왜 spendCoins 를 안 쓰나: spend_coins(kind, cost) 는 비용을 인자로 받는다 — Edge 전용이라 안전하지만,
 *   클라가 직접 부르는 자리에 쓰면 "1코인 내고 해제"가 된다(buy_ad_free 와 같은 원칙).
 */
export async function spendCoinsFixed(kind: string): Promise<{ ok: boolean; reason?: string; balance?: number; cost?: number }> {
  const { data, error } = await supabase.rpc('spend_coins_fixed', { p_kind: kind });
  if (error) return { ok: false, reason: 'error' };
  const r = data as any;
  return r?.ok ? { ok: true, cost: r.cost, balance: r.balance }
               : { ok: false, reason: String(r?.error ?? 'error'), balance: r?.balance, cost: r?.cost };
}

/** 하네스·화면용 — 유료 kind 전체(가격표 대조 기준). */
export function allPaidKinds(): CreditKind[] {
  return CREDIT_KINDS.map((c) => c.key);
}
