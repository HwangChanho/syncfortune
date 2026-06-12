// app/src/lib/useAuth.ts — 인증 세션 구독 훅 (L4↔L3 게이트, S6)
// ─────────────────────────────────────────────────────────────────────────
// Supabase Auth 세션을 구독해 로그인 상태를 앱 전역에 노출한다.
// 세션 토큰은 supabase.ts 의 SecureStore 어댑터(기기 하드웨어 암호화)에 저장 — 세션 보호(ADR-032).
// RLS 가 user_id 기준 행 격리를 강제하므로(규칙8), 인증 = 데이터 접근의 1차 관문.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// dev 전용 자동 로그인(시뮬 편의) — __DEV__ + app/.env(gitignore) 자격증명이 있을 때만 1회 시도.
//   프로덕션 빌드는 __DEV__=false + .env 에 키 없음 → 절대 동작하지 않는다. 자격증명은 코드가 아닌 env 에만 둔다.
let devAutoLoginTried = false;
async function tryDevAutoLogin() {
  if (!__DEV__ || devAutoLoginTried) return;
  const email = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_EMAIL;
  const password = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_PASSWORD;
  if (!email || !password) return;
  devAutoLoginTried = true;
  await supabase.auth.signInWithPassword({ email, password }).catch(() => {});
}

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
      if (!data.session) tryDevAutoLogin(); // dev: 세션 없으면 테스트계정 자동 로그인(시뮬 편의)
    });
    // 2) 이후 세션 변화 구독 — 로그인/로그아웃/토큰 자동 갱신 시 즉시 반영
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    // ※ 소셜 로그인 복귀(syncfortune://auth-callback?code=/token_hash=)는 `app/auth-callback.tsx`
    //   라우트가 단일 처리(exchangeCodeForSession/verifyOtp) — 여기서 중복 처리하지 않는다(레이스 방지).
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  return { session, loading };
}
