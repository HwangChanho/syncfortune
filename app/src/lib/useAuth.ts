// app/src/lib/useAuth.ts — 인증 세션 구독 훅 (L4↔L3 게이트, S6)
// ─────────────────────────────────────────────────────────────────────────
// Supabase Auth 세션을 구독해 로그인 상태를 앱 전역에 노출한다.
// 세션 토큰은 supabase.ts 의 SecureStore 어댑터(기기 하드웨어 암호화)에 저장 — 세션 보호(ADR-032).
// RLS 가 user_id 기준 행 격리를 강제하므로(규칙8), 인증 = 데이터 접근의 1차 관문.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { InteractionManager } from 'react-native'; // #2(daniel): 로그인 직후 무거운 동기화를 상호작용 이후로 미뤄 콘텐츠 진입 지연 완화
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { syncChartsFromServer, loadRepChart } from './engine/myChart'; // 계정 동기화(ADR-056) + 대표 명식(serverChartId 선발급)
import { computeChart } from './engine/engine'; // 대표 차트 산출(serverChartId 선발급용)
import { ensureServerChartId, prewarmReadings, prewarmDaily } from './backend/prewarmReadings'; // serverChartId 선발급 + 프리미엄 풀이 선생성(daniel #32)
import { refreshPremium, getPremiumSnapshot } from './billing/premiumStore'; // 로그인 직후 프리미엄 확인(prewarm 게이트)
import { clearLocalUserData } from './backend/sessionCleanup'; // 로그아웃 시 로컬 사용자 데이터 일괄 정리(daniel 2026-06-23)
import { logoutPurchases } from './billing/purchases'; // 로그아웃 시 RC(RevenueCat) 익명화 — 이전 계정 프리미엄이 stale 하게 남아 광고가 안 뜨던 버그 차단(daniel 2026-06-24)
import { setupNotificationTapListener, registerPushToken } from './backend/notifications'; // 알림 탭 딥링크 + 푸시 토큰 등록(G: 강제종료 중 서버생성 완료 푸시)

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

// 로그인 직후 백그라운드 prefetch(daniel #32) — 명식 동기화·푸시토큰 + 대표 명식 serverChartId 선발급.
//   serverChartId 발급(insert_chart_enc)을 스플래시(인트로) 동안 끝내두면 첫 풀이 진입 시 발급 네트워크 없이
//   즉시 readings 만 로드 → '첫 로그인 후 진입이 느린' 1차 병목 제거. 실패는 조용히(진입 시 정상 경로가 재시도).
async function prefetchOnLogin(s: Session): Promise<void> {
  void syncChartsFromServer();
  void registerPushToken();
  try {
    const rep = await loadRepChart();
    if (rep) await ensureServerChartId(computeChart(rep.input), rep.input, s, rep); // ① serverChartId 선발급(첫 진입 즉시)
    // ② 프리미엄이면 대표 풀이(사주16+자미12)·오늘내일도 백그라운드 선생성 — 홈 진입 전 미리(멱등·캐시, daniel #32)
    await refreshPremium(s.user?.id); // ★ userId 넘겨야 프리미엄 평가(없이 호출하면 미로그인=false로 덮어써 광고가 뜸·#36)
    if (rep && getPremiumSnapshot()) { void prewarmReadings(rep, s); void prewarmDaily(rep, s); }
  } catch { /* 선발급 실패 무시 — 진입 시 정상 경로가 재시도 */ }
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
      if (data.session) InteractionManager.runAfterInteractions(() => { void prefetchOnLogin(data.session!); }); // 앱 시작 시 명식 동기화 + 푸시토큰 + serverChartId 선발급 — 상호작용 후로(#2·#32 진입 지연 완화)
      else tryDevAutoLogin(); // dev: 세션 없으면 테스트계정 자동 로그인(시뮬 편의)
    });
    // 2) 이후 세션 변화 구독 — 로그인/로그아웃/토큰 자동 갱신 시 즉시 반영
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // ★참조 안정화(daniel 07-02 무한 깜빡임 근본): 토큰 자동갱신·INITIAL_SESSION 재발행 등으로 *내용은 같은데
      //   객체 참조만 바뀐* 세션이 오면 state를 갱신하지 않는다. 안 그러면 session을 deps로 쓰는 전 화면 로드 이펙트가
      //   매 이벤트마다 재실행 → 콘텐츠가 '구매화면↔풀이화면'으로 깜빡이던 원인. user.id+access_token 동일 = 같은 세션.
      setSession((prev) => (prev?.user?.id === s?.user?.id && prev?.access_token === s?.access_token ? prev : s));
      if (_event === 'SIGNED_IN' && s) InteractionManager.runAfterInteractions(() => { void prefetchOnLogin(s); }); // 로그인 시 명식 동기화 + 푸시토큰 + serverChartId 선발급 — 상호작용 후로(#2·#32 daniel: 첫 로그인 진입 지연 완화)
      if (_event === 'SIGNED_OUT') { void logoutPurchases(); void clearLocalUserData(); } // ★로그아웃 즉시: RC 익명화(프리미엄 stale 차단→광고 복귀) + 명식·진행률 정리(daniel)
    });
    // ※ 소셜 로그인 복귀(syncfortune://auth-callback?code=/token_hash=)는 `app/auth-callback.tsx`
    //   라우트가 단일 처리(exchangeCodeForSession/verifyOtp) — 여기서 중복 처리하지 않는다(레이스 방지).
    const unsubTap = setupNotificationTapListener();         // 알림 탭 딥링크 리스너(루트 1회)
    return () => { sub.subscription.unsubscribe(); unsubTap(); };
  }, []);

  return { session, loading };
}
