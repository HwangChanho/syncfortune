// app/src/lib/useAuth.ts — 인증 세션 구독 훅 (L4↔L3 게이트, S6)
// ─────────────────────────────────────────────────────────────────────────
// Supabase Auth 세션을 구독해 로그인 상태를 앱 전역에 노출한다.
// 세션 토큰은 supabase.ts 의 SecureStore 어댑터(기기 하드웨어 암호화)에 저장 — 세션 보호(ADR-032).
// RLS 가 user_id 기준 행 격리를 강제하므로(규칙8), 인증 = 데이터 접근의 1차 관문.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * 현재 로그인 세션과 초기 로딩 상태를 반환.
 * - session: null = 미로그인 / Session = 로그인됨
 * - loading: 앱 시작 시 저장된 세션을 복원하는 동안 true (스플래시 표시용)
 * 세션 변화(로그인·로그아웃·자동 토큰갱신)를 실시간 반영한다.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) 앱 시작 시 SecureStore 에 저장된 세션 복원
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // 2) 이후 세션 변화 구독 — 로그인/로그아웃/토큰 자동 갱신 시 즉시 반영
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    // 언마운트 시 구독 해제 (메모리 누수 방지)
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
