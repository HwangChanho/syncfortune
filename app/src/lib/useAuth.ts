// app/src/lib/useAuth.ts — 인증 세션 훅 (★싱글톤 스토어)
// ─────────────────────────────────────────────────────────────────────────
// Supabase Auth 세션을 앱 전역 *단일* 구독으로 관리한다. 컴포넌트는 useSyncExternalStore 로 구독만.
// ⚠️ 성능 근본수정(daniel 07-02 "전체적으로 너무 느림"): 이전 구현은 useAuth()를 호출하는 컴포넌트(25곳:
//    useSubscription·AdBanner·ChartPicker·각 화면 등)마다 *개별* onAuthStateChange 구독 + getSession +
//    prefetchOnLogin(syncCharts·ensureServerChartId RPC·refreshPremium·prewarm)을 돌렸다 → 앱 시작/로그인마다
//    25배 중복 네트워크·CPU 폭풍. 싱글톤으로 구독 1개·prefetch 세션당 1회로 축소.
// 세션 토큰은 supabase.ts 의 SecureStore 어댑터(기기 하드웨어 암호화)에 저장(ADR-032). RLS 로 행 격리(규칙8).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useSyncExternalStore } from 'react';
import { InteractionManager } from 'react-native'; // 로그인 직후 무거운 동기화를 상호작용 이후로
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { syncChartsFromServer, loadRepChart } from './engine/myChart';
import { computeChart } from './engine/engine';
import { ensureServerChartId, prewarmReadings, prewarmDaily } from './backend/prewarmReadings';
import { refreshPremium, getPremiumSnapshot } from './billing/premiumStore';
import { clearLocalUserData } from './backend/sessionCleanup';
import { logoutPurchases } from './billing/purchases';
import { setupNotificationTapListener, registerPushToken } from './backend/notifications';
import { setAuthBusy } from './ui/authBusy'; // 로그아웃 클린업 동안 전역 블로킹(먹통 방지)

// dev 전용 자동 로그인(시뮬 편의) — __DEV__ + .env 자격증명 있을 때만 1회.
let devAutoLoginTried = false;
async function tryDevAutoLogin() {
  if (!__DEV__ || devAutoLoginTried) return;
  const email = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_EMAIL;
  const password = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_PASSWORD;
  if (!email || !password) return;
  devAutoLoginTried = true;
  await supabase.auth.signInWithPassword({ email, password }).catch(() => {});
}

// 로그인 직후 백그라운드 prefetch — 명식 동기화·푸시토큰 + 대표 serverChartId 선발급 + 프리미엄 선생성.
//   ★세션당 1회(lastPrefetchId 가드) — 싱글톤이라 원래 1회지만, 같은 세션 재발행(SIGNED_IN 반복) 대비 이중 가드.
let lastPrefetchId: string | null = null;
async function prefetchOnLogin(s: Session): Promise<void> {
  if (!s.user?.id || s.user.id === lastPrefetchId) return; // 같은 세션 = 스킵(중복 prefetch 방지)
  lastPrefetchId = s.user.id;
  void syncChartsFromServer();
  void registerPushToken();
  try {
    const rep = await loadRepChart();
    if (rep) await ensureServerChartId(computeChart(rep.input), rep.input, s, rep);
    await refreshPremium(s.user?.id); // userId 넘겨야 프리미엄 평가(#36)
    if (rep && getPremiumSnapshot()) { void prewarmReadings(rep, s); void prewarmDaily(rep, s); }
  } catch { /* 선발급 실패 무시 — 진입 시 정상 경로가 재시도 */ }
}

// ── 전역 단일 스토어 ─────────────────────────────────────────────────────
let _session: Session | null = null;
let _loading = true;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function subscribe(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb); }; }
const getSession = () => _session;   // useSyncExternalStore snapshot(참조 안정)
const getLoading = () => _loading;

// 세션 갱신 — 내용(user.id+access_token) 동일하면 no-op(참조 안정 → 전 구독자 스퍼리어스 리렌더 차단).
function setSession(s: Session | null): boolean {
  if (_session?.user?.id === s?.user?.id && _session?.access_token === s?.access_token) return false;
  _session = s; emit(); return true;
}

let _started = false;
function startAuthOnce(): void {
  if (_started) return;
  _started = true;
  // 1) 저장된 세션 복원(앱 시작 1회)
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
    if (_loading) { _loading = false; emit(); }
    if (data.session) InteractionManager.runAfterInteractions(() => { void prefetchOnLogin(data.session!); });
    else tryDevAutoLogin();
  });
  // 2) 세션 변화 구독(앱 전역 단 1개)
  supabase.auth.onAuthStateChange((_event, s) => {
    const changed = setSession(s);
    if (_event === 'SIGNED_IN' && s) InteractionManager.runAfterInteractions(() => { void prefetchOnLogin(s); }); // prefetch 자체가 세션당 1회 가드
    if (_event === 'SIGNED_OUT') {
      lastPrefetchId = null; // 다음 로그인 때 다시 prefetch
      setAuthBusy(true);     // 로그아웃 클린업 동안 화면 막고 로딩(먹통 방지)
      void (async () => {
        try { await logoutPurchases(); } catch { /* ignore */ }
        try { await clearLocalUserData(); } catch { /* ignore */ }
        setAuthBusy(false);
      })();
    }
    void changed; // (참조 안정용 반환값 — 현재 분기엔 불필요)
  });
  setupNotificationTapListener(); // 알림 탭 딥링크(전역 1회·자체 중복가드)
}

/**
 * 현재 로그인 세션·로딩 상태. 앱 전역 단일 스토어를 구독(가벼움).
 * - session: null=미로그인 / Session=로그인됨 · loading: 세션 복원 중(스플래시).
 */
export function useAuth() {
  useEffect(() => { startAuthOnce(); }, []); // 최초 마운트 1회 초기화(이후 idempotent)
  const session = useSyncExternalStore(subscribe, getSession);
  const loading = useSyncExternalStore(subscribe, getLoading);
  return { session, loading };
}
