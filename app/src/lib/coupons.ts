// app/src/lib/coupons.ts — 무료 이용권 쿠폰 사용·크레딧 (파트별 무료권 + 1회 올패스)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 코드 입력 → 유료 기능 무료 크레딧 부여. 파트별('reading'·'ziwei'·'compat'·'timeline'·'followup')
//   또는 올패스('all'=각 파트 1씩). 검증·차감은 서버 RPC(SECURITY DEFINER) — 앱은 RPC만 호출.
//   게이트는 결제 전에 useCredit(kind) 로 크레딧 우선 소비(있으면 무료). 비프리미엄 전용(프리미엄은 무게이트).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

export type CreditKind = 'reading' | 'ziwei' | 'compat' | 'timeline' | 'followup' | 'love';
// price = 건당 가격(원). daniel 확정(2026-06): 원가(opus, 영구캐시 1회)×~3, 소액(타임라인·질문)=₩990, 애정 ₩4,900.
export const CREDIT_KINDS: { key: CreditKind; ko: string; price: number }[] = [
  { key: 'reading', ko: '사주 풀이', price: 6900 }, { key: 'ziwei', ko: '자미두수', price: 4900 }, { key: 'compat', ko: '궁합', price: 3900 },
  { key: 'timeline', ko: '인생 타임라인', price: 990 }, { key: 'followup', ko: '추가 질문', price: 990 }, { key: 'love', ko: '나의 애정흐름', price: 4900 },
];
export const PREMIUM_PRICE = 39900; // 평생 프리미엄(대표명식 전부 무제한)

export type RedeemResult =
  | { ok: true; kind: string; qty: number }
  | { ok: false; error: string };

/** 쿠폰 코드 사용 → 크레딧/올패스 부여(서버 redeem_coupon RPC). 1인 1쿠폰 1회. */
export async function redeemCoupon(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });
  if (error) return { ok: false, error: error.message };
  return data as RedeemResult;
}

/** 보유 크레딧(파트별 잔여 수) — 설정 표시·게이트 사전 확인용(RLS 본인만). */
export async function loadCredits(): Promise<Record<string, number>> {
  const { data } = await supabase.from('entitlement_credits').select('kind, remaining');
  const out: Record<string, number> = {};
  (data ?? []).forEach((r: any) => { if (r.remaining > 0) out[r.kind] = r.remaining; });
  return out;
}

/** 크레딧 1 소비(use_credit RPC) — 있으면 차감 후 true(무료 진행), 없으면 false(기존 결제 게이트). */
export async function useCredit(kind: CreditKind): Promise<boolean> {
  const { data, error } = await supabase.rpc('use_credit', { p_kind: kind });
  return !error && data === true;
}

/**
 * 이용권 구매 성공 시 크레딧 부여(grant_credit RPC). 마켓에서 결제 완료 후 호출 → 잔여 +qty.
 * ⚠️ 결제 검증은 RevenueCat 웹훅이 정식 — 현재는 클라 구매 성공 후 호출(신뢰기반, daniel 슬롯).
 * @returns 부여 후 잔여 수(실패 시 null)
 */
export async function grantCredit(kind: CreditKind, qty = 1): Promise<number | null> {
  const { data, error } = await supabase.rpc('grant_credit', { p_kind: kind, p_qty: qty });
  return error ? null : (data as number);
}
