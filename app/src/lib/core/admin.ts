// app/src/lib/admin.ts — 관리자(daniel) 전용 (앱 내 관리자 화면)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 별도 웹 없이 앱 내에서 관리. 호출자 profiles.is_admin 인 경우만 서버 RPC 통과(SECURITY DEFINER + 게이트).
//   유저 목록 확인 · 이용권 선물(grant) · 프리미엄 선물/해제. 이메일(PII)은 관리자만(규칙8).
//   ⚠️ 모든 권한 판정은 서버 RPC(is_caller_admin)에서 — 클라 isAdmin 은 UI 표시용일 뿐(우회 불가).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import type { CreditKind } from '../billing/coupons';

export type AdminUser = { id: string; email: string; is_premium: boolean; is_admin: boolean; created_at: string; chart_count: number; reading_count: number; paid_total: number };

/** 내가 관리자인지(profiles.is_admin) — 화면 진입 노출용. 실제 권한은 서버 RPC가 강제. */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_caller_admin');
  return !error && data === true;
}

/** 유저 목록(관리자 전용, 최근 가입순). 비관리자 호출 시 서버가 차단 → 빈 배열. */
export async function adminListUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users');
  return error ? [] : ((data ?? []) as AdminUser[]);
}

/** 특정 유저에게 이용권 선물(+qty). 실패 시 사유를 throw(호출처에서 Alert 로 노출). */
export async function adminGrantCredit(owner: string, kind: CreditKind, qty = 1): Promise<void> {
  const { error } = await supabase.rpc('admin_grant_credit', { p_owner: owner, p_kind: kind, p_qty: qty });
  if (error) throw new Error(error.message); // generic 'false' 대신 사유 전달(예: check 위반·권한)
}

/** 특정 유저 프리미엄 선물/해제. 실패 시 사유를 throw. */
export async function adminSetPremium(owner: string, val: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_premium', { p_owner: owner, p_val: val });
  if (error) throw new Error(error.message);
}

export type AdminUserDetail = {
  reading_count: number; followup_count: number; chart_count: number;
  // birth/label = 서버 암호화(birth_enc/label_enc) 복호화 결과(관리자만). birth=ChartInput JSON 문자열·label=명식 라벨.
  //   기존(암호화 도입 전) 명식은 미저장 → null. 신규 등록/풀이부터 채워짐.
  charts: { id: string; saju: any; birth?: string | null; label?: string | null }[];
  credits: { kind: string; remaining: number }[];
  // 결제 내역(RC 웹훅 기록) — product=상품id, amount=결제금액, type=RC 이벤트(INITIAL_PURCHASE 등), at=시각
  purchases: { product: string; kind: string | null; amount: number | null; currency: string; type: string | null; at: string }[];
  paid_total: number; // 총 결제액(샌드박스 제외)
};

/** 특정 유저 상세(사용량·등록 명식·보유 이용권) — 관리자만(서버 게이트). */
export async function adminUserDetail(owner: string): Promise<AdminUserDetail | null> {
  const { data, error } = await supabase.rpc('admin_user_detail', { p_owner: owner });
  return error ? null : (data as AdminUserDetail);
}

// 전체 집계 통계(관리자 대시보드, daniel G) — 총 사용량·추정비용·잔여 이용권·분야별·상위 사용자.
export type AdminStats = {
  total_users: number; premium_users: number; total_readings: number; total_followups: number;
  credits_remaining: number; est_cost: number; total_revenue: number;
  by_category: { category: string; n: number }[];
  top_users: { name: string | null; readings: number }[];
};

/** 전체 현황 집계 — 관리자만(서버 게이트). */
export async function adminStats(): Promise<AdminStats | null> {
  const { data, error } = await supabase.rpc('admin_stats');
  return error ? null : (data as AdminStats);
}

// 계정별 앱 사용 시간(app_session 로그 집계, daniel 2026-06) — 평균/총/세션수/최근(최근 30일=app_logs 보관기간).
export type AdminUsage = { sessions: number; avg_sec: number; total_sec: number; last_seen: string | null };

/** 특정 유저의 앱 사용 시간 집계 — 관리자만(서버 게이트). */
export async function adminUserUsage(owner: string): Promise<AdminUsage | null> {
  const { data, error } = await supabase.rpc('admin_user_usage', { p_owner: owner });
  if (error) return null;
  const r = Array.isArray(data) ? data[0] : data;          // TABLE 반환(집계 1행)
  return (r ?? null) as AdminUsage | null;
}

// 콘텐츠별 방문 집계(content_visits, daniel 2026-07-06) — 어떤 콘텐츠를 얼마나 봤는지(kind별 방문 횟수·최근 방문 시각).
//   kind = 앱이 쓰는 콘텐츠 식별자('saju'·'love'·'daily' 등). visits = 누적 방문 수. last_at = 최근 방문 시각(ISO, 없으면 null).
export type AdminContentVisit = { kind: string; visits: number; last_at: string | null };

/** 특정 유저의 콘텐츠별 방문 내역(방문 많은 순) — 관리자만(서버 게이트). 비관리자·오류 시 빈 배열. */
export async function adminUserContentVisits(owner: string): Promise<AdminContentVisit[]> {
  const { data, error } = await supabase.rpc('admin_user_content_visits', { p_owner: owner });
  return error ? [] : ((data ?? []) as AdminContentVisit[]);
}
