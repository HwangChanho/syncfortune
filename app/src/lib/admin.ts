// app/src/lib/admin.ts — 관리자(daniel) 전용 (앱 내 관리자 화면)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 별도 웹 없이 앱 내에서 관리. 호출자 profiles.is_admin 인 경우만 서버 RPC 통과(SECURITY DEFINER + 게이트).
//   유저 목록 확인 · 이용권 선물(grant) · 프리미엄 선물/해제. 이메일(PII)은 관리자만(규칙8).
//   ⚠️ 모든 권한 판정은 서버 RPC(is_caller_admin)에서 — 클라 isAdmin 은 UI 표시용일 뿐(우회 불가).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import type { CreditKind } from './coupons';

export type AdminUser = { id: string; email: string; is_premium: boolean; is_admin: boolean; created_at: string };

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

/** 특정 유저에게 이용권 선물(+qty). */
export async function adminGrantCredit(owner: string, kind: CreditKind, qty = 1): Promise<boolean> {
  const { error } = await supabase.rpc('admin_grant_credit', { p_owner: owner, p_kind: kind, p_qty: qty });
  return !error;
}

/** 특정 유저 프리미엄 선물/해제. */
export async function adminSetPremium(owner: string, val: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('admin_set_premium', { p_owner: owner, p_val: val });
  return !error;
}

export type AdminUserDetail = {
  reading_count: number; followup_count: number; chart_count: number;
  charts: { id: string; saju: any }[];        // 등록 명식(saju=NormalizedChart, birth 제거)
  credits: { kind: string; remaining: number }[];
};

/** 특정 유저 상세(사용량·등록 명식·보유 이용권) — 관리자만(서버 게이트). */
export async function adminUserDetail(owner: string): Promise<AdminUserDetail | null> {
  const { data, error } = await supabase.rpc('admin_user_detail', { p_owner: owner });
  return error ? null : (data as AdminUserDetail);
}
