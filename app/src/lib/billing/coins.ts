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
import { withTimeout, GATE_TIMEOUT_MS as BALANCE_TIMEOUT_MS } from '../core/withTimeout';   // ★상한 정의는 한 곳(core/withTimeout)
import { CREDIT_KINDS, type CreditKind } from './coupons';

export { WON_PER_COIN, COIN_PRICE, COIN_PACKS } from './coinPrices';   // ★가격표는 순수 파일에(하네스가 런타임 없이 검증)
import { COIN_PRICE } from './coinPrices';

/** 이 콘텐츠의 운 가격(미등록이면 null — 화면은 '가격 미정'으로 안전 처리). */
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
  const r = await withTimeout(
    supabase.from('coin_balance').select('balance').maybeSingle(),
    BALANCE_TIMEOUT_MS,
  );
  if (!r) return null;                                       // 타임아웃 = 확인 불가(0 아님)
  const { data, error } = r;
  if (error) return null;                                    // ★조회 실패 — 절대 '없음'으로 취급하지 않는다
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

/**
 * 화면 기능을 (명식 × 기능) 단위로 **영구** 언락한다 — 운 차감과 언락 기록이 **한 트랜잭션**.
 *
 * ★왜 spendCoinsFixed 를 안 쓰나: 그건 차감만 하고 «열렸다»는 기록을 안 남긴다.
 *   차감과 기록이 갈라지면 «돈은 나갔는데 잠김» = 두 번 결제가 된다(그게 07-28 사고였다).
 *   서버 `unlock_chart_feature` 는 둘을 같이 하고, **이미 열린 건 cost 0 으로 돌려준다**(멱등).
 *
 * @param kind    기능 키 — 서버 허용목록에 있는 것만(현재 'chunghap'). 없는 키는 `reason:'kind'`.
 * @param chartId 내 명식 id. 남의 것이면 서버가 `reason:'chart'` 로 거절한다(차감 없음).
 * @returns ok + 실제 차감액(cost) + 남은 잔액. `already:true` = 이미 열려 있어 **한 푼도 안 나갔다**.
 *          실패 사유: 'auth'(미로그인) · 'kind' · 'chart' · 'insufficient'(잔액부족) · 'error'(통신)
 * ⚠️금액은 **클라가 보내지 않는다** — 서버가 정한다(FEATURE_UNLOCKS 의 값은 표기용).
 */
export async function unlockChartFeature(kind: string, chartId: string): Promise<{
  ok: boolean; reason?: string; balance?: number; cost?: number; already?: boolean;
}> {
  const { data, error } = await supabase.rpc('unlock_chart_feature', { p_kind: kind, p_chart_id: chartId });
  if (error) return { ok: false, reason: 'error' };
  const r = data as any;
  return r?.ok ? { ok: true, cost: r.cost, balance: r.balance, already: !!r.already }
               : { ok: false, reason: String(r?.error ?? 'error'), balance: r?.balance, cost: r?.cost };
}

/** 하네스·화면용 — 유료 kind 전체(가격표 대조 기준). */
export function allPaidKinds(): CreditKind[] {
  return CREDIT_KINDS.map((c) => c.key);
}

// ─────────────────────────────────────────────────────────────────────────
// ★잔액 표시의 **단일 훅**(daniel 2026-08-01 신고 2건의 공통 원인)
//   ① "로그아웃했는데 이전 아이디 금액이 남아있어"
//   ② "운 충전했는데 이 화면만 안 바뀌었어"(마켓)
//
//   왜 계속 어긋났나: 잔액을 읽는 화면이 넷인데 **각자 다른 방식**이었다 —
//     마켓 `useEffect(…, [])`(최초 1회만) · 설정/배지 `useFocusEffect(…, [])`(세션 무시).
//   그래서 화면마다 다른 순간에 멈춘 값이 남았다. 표시 규칙을 한 곳으로 모은다.
//     · 화면에 **다시 들어올 때마다** 다시 읽는다(충전하고 돌아오면 최신)
//     · **세션이 바뀌면 즉시 비운다**(남의 잔액이 내 화면에 남지 않게)
//     · 조회 실패는 null 그대로 — 0으로 보이면 불필요한 충전을 유도한다(07-28 재결제 사고와 같은 유형)
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * 보유 운 잔액(표시용).
 * @param session 현재 세션(useAuth().session) — 바뀌면 즉시 비우고 다시 읽는다.
 * @returns 잔액 / null(미로그인·조회 실패·로딩)
 */
export function useCoinBalance(session: unknown): number | null {
  const [bal, setBal] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (!session) { setBal(null); return () => { alive = false; }; }
    void coinBalanceOrNull().then((b) => { if (alive) setBal(b); });
    return () => { alive = false; };
  }, [session]));
  return bal;
}
