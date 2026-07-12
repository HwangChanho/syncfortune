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

// dev 전용 자동 로그인(시뮬 편의) — __DEV__ + .env 자격증명 있을 때만 1회. 성공 여부 반환(ensureAnonSession 이 실패 시 익명으로 폴백).
let devAutoLoginTried = false;
async function tryDevAutoLogin(): Promise<boolean> {
  if (!__DEV__ || devAutoLoginTried) return false;
  const email = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_EMAIL;
  const password = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN_PASSWORD;
  if (!email || !password) return false;
  devAutoLoginTried = true;
  try { const { error } = await supabase.auth.signInWithPassword({ email, password }); return !error; }
  catch { return false; }
}

// ★익명 세션 확보(Apple 5.1.1 — 비계정형 IAP 구매에 로그인 강제 금지, daniel 2026-07-08 심사반려 대응).
//   저장 세션이 없으면(미로그인) 익명 세션을 만들어 **로그인 없이 구매·통변**이 되게 한다. dev 자동로그인이 되면 그걸 우선.
//   이후 SIGNED_IN(익명)이 configurePurchases(익명uid)·prefetchOnLogin 파이프라인을 그대로 가동. 로그인(SSO/이메일)은
//   **선택** = 크로스디바이스 동기화용(익명→등록 link 로 같은 uid 승격). 익명도 안정 uid+profiles+RLS 격리 → C1(결제=계정귀속) 유지.
//   ⚠️선결: Supabase 대시보드/Config 에서 익명 로그인 활성화(enable_anonymous_sign_ins). 비활성이면 catch → 미로그인 폴백(무료만).
let anonTried = false;
async function ensureAnonSession(): Promise<void> {
  if (anonTried) return;
  anonTried = true;
  if (await tryDevAutoLogin()) return;                 // dev 시뮬 = 테스트 계정 우선
  try { await supabase.auth.signInAnonymously(); }      // 프로덕션 = 익명 세션
  catch { /* 익명 비활성/네트워크 실패 = 미로그인 유지(무료 온디바이스만 사용) */ }
}

// ── 로그아웃 클린업 배리어(L3) ──────────────────────────────────────────────
//   버그: 로그아웃(계정 A) 클린업(RC 익명화 logoutPurchases + 로컬 명식 삭제 clearLocalUserData)이 *비동기 배리어 없이*
//     돌아가는 사이에, 곧이은 다른 계정(B) 로그인의 명식 동기화(prefetchOnLogin → syncChartsFromServer)가 아직 안 지워진
//     A의 로컬 명식을 읽어 union 머지 → pushChartsNow 로 **B 계정 blob 에 A 명식을 밀어넣는다**(계정 간 명식 누출).
//     느린 건 logoutPurchases(네트워크)라 clearLocalUserData 가 시작도 전에 sync 가 끼어들 수 있어 창이 넓다.
//   해결: SIGNED_OUT 시 클린업 전체(logoutPurchases + clearLocalUserData)를 하나의 Promise 로 감싸 배리어에 *동기 세팅*하고,
//     명식 sync 진입 전(prefetchOnLogin 내부 · _layout 포그라운드 복귀)에서 whenAuthCleanupIdle() 로 완료를 기다린다.
//   ※ 배리어는 완료 후 null 로 되돌리지 않는다 — 이미 resolve 된 Promise 를 await 하면 즉시 통과(무해)이고,
//     다음 SIGNED_OUT 이 새 pending Promise 로 덮는다(되돌리면 뒤늦은 finally 가 새 배리어를 지우는 레이스가 생김).
let _cleanupBarrier: Promise<void> | null = null;
/** 진행 중인 로그아웃 클린업이 있으면 그 완료를 기다린다(없으면 즉시 resolve). 명식 sync 진입 전 게이트(L3). */
export function whenAuthCleanupIdle(): Promise<void> { return _cleanupBarrier ?? Promise.resolve(); }

// 로그인 직후 백그라운드 prefetch — 명식 동기화·푸시토큰 + 대표 serverChartId 선발급 + 프리미엄 선생성.
//   ★세션당 1회(lastPrefetchId 가드) — 싱글톤이라 원래 1회지만, 같은 세션 재발행(SIGNED_IN 반복) 대비 이중 가드.
let lastPrefetchId: string | null = null;
async function prefetchOnLogin(s: Session): Promise<void> {
  if (!s.user?.id || s.user.id === lastPrefetchId) return; // 같은 세션 = 스킵(중복 prefetch 방지)
  lastPrefetchId = s.user.id;
  // ★L3: 직전 로그아웃 클린업(로컬 명식 삭제)이 진행 중이면 완료까지 대기 — 안 그러면 아래 syncChartsFromServer /
  //   loadRepChart 가 이전 계정 명식을 읽어 새 계정 blob·serverChartId 로 오염된다(계정 간 누출). 클린업 없으면 즉시 통과.
  await whenAuthCleanupIdle();
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

// 세션 갱신 — *로그인한 유저(user.id)가 바뀔 때만* 반영(참조 안정 → 전 구독자 스퍼리어스 리렌더 차단).
//   ★핵심(daniel 07-03 "풀이 읽는 중 화면이 중간중간 리로딩됨"): supabase 는 autoRefreshToken=true 라
//   토큰 만료 즈음(≈1시간)·포그라운드 복귀 시 onAuthStateChange('TOKEN_REFRESHED', s) 를 쏜다 —
//   같은 유저인데 access_token 만 새로 발급된 세션 *객체*다. 예전엔 access_token 이 다르면 세션을 교체·emit 해서,
//   useAuth() 를 쓰는 전 컴포넌트(25곳)가 리렌더되고 특히 풀이/콘텐츠 화면의 캐시 fetch effect(deps 에 session 포함)가
//   재실행 → readings 재조회 → 리스트가 새로 그려지며 '리로딩(깜빡임)'으로 보였다.
//   → 토큰만 바뀐 갱신은 무시하고, 실제 로그인/로그아웃(null↔세션)·계정 전환(user.id 변화)만 반영한다.
//   안전성: 앱 어디서도 세션의 access_token 을 직접 인증에 쓰지 않는다(grep 확인). supabase 클라가 SecureStore 의
//   최신 토큰을 내부적으로 주입하고, 소비처는 session.user.id/존재여부만 사용 → 스토어 참조를 고정해도 무해.
function setSession(s: Session | null): boolean {
  // 둘 다 세션이고 같은 유저 = TOKEN_REFRESHED/중복 SIGNED_IN → 참조 유지(no-op, 리렌더 차단).
  if (_session && s && _session.user?.id === s.user?.id) return false;
  if (_session === s) return false;             // null↔null 등 동일 참조 = no-op
  _session = s; emit(); return true;            // 로그인/로그아웃/계정전환만 반영
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
    else void ensureAnonSession(); // ★미로그인 → 익명 세션(로그인 없이 구매·통변 · Apple 5.1.1)
  });
  // 2) 세션 변화 구독(앱 전역 단 1개)
  supabase.auth.onAuthStateChange((_event, s) => {
    const changed = setSession(s);
    if (_event === 'SIGNED_IN' && s) InteractionManager.runAfterInteractions(() => { void prefetchOnLogin(s); }); // prefetch 자체가 세션당 1회 가드
    if (_event === 'SIGNED_OUT') {
      lastPrefetchId = null; // 다음 로그인 때 다시 prefetch
      setAuthBusy(true);     // 로그아웃 클린업 동안 화면 막고 로딩(먹통 방지)
      // ★L3: 클린업 전체를 배리어에 *동기 세팅* — 느린 logoutPurchases(네트워크)까지 덮어야 다음 로그인 sync 가
      //   클린업 완료(로컬 명식 삭제)까지 기다린다. 여기서 지연 세팅하면 그 사이 sync 가 이전 계정 명식을 밀어넣는다.
      // ★배리어 hang 방어(감사 07-11): logoutPurchases()=RC 네이티브/네트워크 콜이 타임아웃 없이 멈추면 setAuthBusy(false)·재익명이
      //   영영 안 돌아 전역 BusyOverlay 가 걸린 채 '먹통'. 각 단계를 타임아웃 레이스로 감싸 최악의 경우에도 ~수초 내 진행(실패·hang 은 무시하고 다음).
      const withTimeout = (p: Promise<unknown>, ms: number) => Promise.race([p.catch(() => {}), new Promise<void>((res) => setTimeout(res, ms))]);
      _cleanupBarrier = (async () => {
        await withTimeout(logoutPurchases(), 5000);
        await withTimeout(clearLocalUserData(), 5000);
        setAuthBusy(false);
      })();
      void _cleanupBarrier;
      // ★로그아웃/계정삭제 후 재익명(Apple 5.1.1: 로그인 없이 계속 사용·구매 가능) — 클린업 배리어 *완료 후* 새 익명 세션.
      //   배리어 *안*에 넣으면: 재익명 SIGNED_IN→prefetchOnLogin→whenAuthCleanupIdle 가 아직 안 끝난 배리어를 await = 데드락. 그래서 .then 으로 배리어 밖.
      void _cleanupBarrier.then(() => supabase.auth.signInAnonymously()).catch(() => { /* 익명 비활성/실패 = 미로그인(무료만) */ });
    }
    void changed; // (참조 안정용 반환값 — 현재 분기엔 불필요)
  });
  setupNotificationTapListener(); // 알림 탭 딥링크(전역 1회·자체 중복가드)
}

/**
 * 현재 로그인 세션·로딩 상태. 앱 전역 단일 스토어를 구독(가벼움).
 * - session: null=미로그인 / Session=로그인됨 · loading: 세션 복원 중(스플래시).
 */
// ★등록 유저 판정(daniel 07-11 재수정) — is_anonymous 만으로 판정하면 **persist된 세션에 is_anonymous 가 undefined 일 때**
//   `!undefined = true` 가 되어 익명인데도 '등록'으로 오판 → 로그인 화면이 홈으로 튕긴다(07-08 저장 익명세션에서 실제 발생).
//   → **이메일/전화/identities 유무**로 판정(등록 유저는 반드시 이 중 하나 보유, 익명은 셋 다 없음). undefined 여도 안전하게 '미등록'(=로그인 화면 노출)으로 폴백.
function userIsRegistered(u: any): boolean {
  if (!u) return false;
  if ((u.identities?.length ?? 0) > 0) return true; // 소셜/이메일 연결(익명 = 빈 배열)
  if (u.email || u.phone) return true;               // 이메일·전화 보유
  return u.is_anonymous === false;                   // 명시적으로 익명 아님(있을 때만 신뢰)
}

/**
 * 현재 로그인 세션·로딩 상태. 앱 전역 단일 스토어를 구독(가벼움).
 * - session: null=미로그인 / Session=로그인됨(익명 포함) · loading: 세션 복원 중(스플래시).
 * - isRegistered: 등록(익명 아님) 유저 — 로그인 CTA·계정카드·공유/동기화 구분용. 구매·통변은 session(익명 포함)이면 됨(Apple 5.1.1).
 */
export function useAuth() {
  useEffect(() => { startAuthOnce(); }, []); // 최초 마운트 1회 초기화(이후 idempotent)
  const session = useSyncExternalStore(subscribe, getSession);
  const loading = useSyncExternalStore(subscribe, getLoading);
  return { session, loading, isRegistered: userIsRegistered(session?.user) };
}

/** 훅 밖(스토어/유틸)에서 등록 여부 — 익명 세션은 false. */
export function isRegisteredUser(): boolean { return userIsRegistered(_session?.user); }

/** 현재 세션이 익명인지 — 로그인 시 linkIdentity(같은 uid 승격·데이터 보존) vs signInWithOAuth(신규/전환) 분기용. 세션은 있으나 미등록 = 익명. */
export function isAnonSession(): boolean { return !!_session?.user && !userIsRegistered(_session.user); }
