// app/src/lib/coupons.ts — 무료 이용권 쿠폰 사용·크레딧 (파트별 무료권 + 1회 올패스)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 코드 입력 → 유료 기능 무료 크레딧 부여. 파트별('reading'·'ziwei'·'compat'·'timeline'·'followup')
//   또는 올패스('all'=각 파트 1씩). 검증·차감은 서버 RPC(SECURITY DEFINER) — 앱은 RPC만 호출.
//   게이트는 결제 전에 useCredit(kind) 로 크레딧 우선 소비(있으면 무료). 비프리미엄 전용(프리미엄은 무게이트).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import { localGrant, localUse, localCreditsAll } from './localCredits'; // 비로그인 = 디바이스 로컬 크레딧(daniel H)

// 로그인 세션 유무 — 있으면 서버(RPC/테이블), 없으면 디바이스 로컬(비로그인 구매분, 로그인 시 이관).
async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export type CreditKind = 'reading' | 'ziwei' | 'compat' | 'timeline' | 'followup' | 'love' | 'newyear' | 'lifegraph' | 'roots' | 'image' | 'mission' | 'career' | 'talent' | 'numerology' | 'astrology' | 'dream';
// price = 건당 가격(원). daniel 확정(2026-06): 원가(opus, 영구캐시 1회)×~3, 소액(타임라인·질문)=₩990, 애정 ₩4,900.
export const CREDIT_KINDS: { key: CreditKind; ko: string; price: number }[] = [
  { key: 'reading', ko: '사주 풀이', price: 9900 }, { key: 'ziwei', ko: '자미두수', price: 8900 }, { key: 'compat', ko: '궁합', price: 3900 },
  { key: 'timeline', ko: '인생 타임라인', price: 990 }, { key: 'followup', ko: '추가 질문', price: 990 }, { key: 'love', ko: '나의 애정흐름', price: 4900 },
  // 스페셜(고비용 LLM) — 광고 게이트 제거·건당 결제 전환(daniel 2026-06). 오늘/이달은 저비용이라 광고 무료 유지.
  { key: 'newyear', ko: '신년운세', price: 6900 }, { key: 'lifegraph', ko: '인생 그래프', price: 3900 },
  // 심층 콘텐츠(daniel 2026-06): 뿌리(통근·투출)·비치는 나(천간 인상)·나의 사명(격국·용신 + 자미 보조)
  { key: 'roots', ko: '명식의 뿌리', price: 4900 }, { key: 'image', ko: '비치는 나', price: 4900 }, { key: 'mission', ko: '나의 사명', price: 6900 },
  // 신규(daniel 2026-06): 사업가의 나 vs 직장인의 나(명식+대운+세운, 6카테고리)
  { key: 'career', ko: '사업가의 나', price: 4900 },
  // 신규(daniel 2026-06-23): 나의 타고난 재능(월지 축 백본 — 재능·동기·재물)
  { key: 'talent', ko: '나의 타고난 재능', price: 4900 },
  // 신규(daniel 2026-06-23): 수비학(피타고리안)·별자리 운세(서양 네이탈) — 도메인=Claude 표준 레퍼런스 인코딩, 가격=api_usage 실측 후 daniel 확정
  { key: 'numerology', ko: '수비학', price: 4900 }, { key: 'astrology', ko: '별자리 운세', price: 4900 },
  // AI 꿈해몽 — 5회 번들 ₩1,200(=₩240/회). Apple IAP 최저가 미만이라 번들 판매(daniel). price=건당 참조값.
  { key: 'dream', ko: 'AI 꿈해몽', price: 240 },
];
export const PREMIUM_PRICE = 49900; // 평생 프리미엄(대표명식 전부 무제한). daniel: 사업가 등 헤비유저(궁합 반복) 타겟 — 일반은 건당/쿠폰. 프리미엄은 소수 기대.

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
  if (!(await hasSession())) return localCreditsAll();    // 비로그인 = 디바이스 로컬(H)
  const { data } = await supabase.from('entitlement_credits').select('kind, remaining');
  const out: Record<string, number> = {};
  (data ?? []).forEach((r: any) => { if (r.remaining > 0) out[r.kind] = r.remaining; });
  return out;
}

/** 크레딧 1 소비(use_credit RPC) — 있으면 차감 후 true(무료 진행), 없으면 false(기존 결제 게이트). */
export async function useCredit(kind: CreditKind): Promise<boolean> {
  if (!(await hasSession())) return localUse(kind);        // 비로그인 = 로컬 차감(H)
  const { data, error } = await supabase.rpc('use_credit', { p_kind: kind });
  return !error && data === true;
}

/**
 * 이용권 구매 성공 시 크레딧 부여(grant_credit RPC). 마켓에서 결제 완료 후 호출 → 잔여 +qty.
 * ⚠️ 결제 검증은 RevenueCat 웹훅이 정식 — 현재는 클라 구매 성공 후 호출(신뢰기반, daniel 슬롯).
 * @returns 부여 후 잔여 수(실패 시 null)
 */
export async function grantCredit(kind: CreditKind, qty = 1): Promise<number | null> {
  if (!(await hasSession())) { await localGrant(kind, qty); return qty; } // 비로그인 = 로컬 적립(로그인 시 이관, H)
  const { data, error } = await supabase.rpc('grant_credit', { p_kind: kind, p_qty: qty });
  return error ? null : (data as number);
}
