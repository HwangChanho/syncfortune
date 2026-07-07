// src/app/_layout.tsx — Expo Router 루트 레이아웃 (멀티플랫폼 엔트리, ADR-036)
// ─────────────────────────────────────────────────────────────────────────
// 파일기반 라우팅의 최상위. 인증 세션을 복원하는 동안 스플래시를 띄우고,
// 실제 세션 가드는 (app)/_layout 에서 처리한다(미인증 시 /login 리다이렉트).
// native = 스택 내비 / web = URL 라우팅 으로 같은 트리가 양쪽에서 동작한다.
// ─────────────────────────────────────────────────────────────────────────
import 'intl-pluralrules'; // Intl.PluralRules polyfill (Hermes) — iztro i18next 보조(ERROR 폴백, 무해)
import '../lib/i18n'; // 다국어(한·영·일) init
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, LogBox, AppState, InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // 이슈20 드래그 reorder(gesture-handler) — 루트 래핑 필수
import { useAuth, whenAuthCleanupIdle } from '../lib/useAuth'; // whenAuthCleanupIdle: 로그아웃 클린업 완료 게이트(L3 — sync 전 대기)
import { configurePurchases } from '../lib/billing/purchases'; // 인앱결제(RevenueCat) 초기화
import { refreshPremium } from '../lib/billing/premiumStore'; // 세션 변경(로그인/로그아웃/계정전환) 시 프리미엄 전역 재평가 → 광고 즉시 토글(daniel 2026-06-24)
import { migrateLocalCreditsOnLogin } from '../lib/billing/migrateCredits'; // 로그인 시 디바이스 구매 이관(H)
import { preferSelfAsRep, syncChartsFromServer } from '../lib/engine/myChart'; // 대표 명식=본인 + 명식 멀티기기 동기화(포그라운드 복귀 시)
import { hydrateGenProgress } from '../lib/backend/genProgress'; // 앱 시작 시 진행중/미확인 풀이 복원 → 홈 배너(daniel: 강제종료 생존)
import { initAds, setAdTestMode } from '../lib/core/ads'; // AdMob 초기화 + 테스트광고 모드(관리자/테스트=실 유닛 서빙 전이라 구글 테스트광고로, daniel)
import { supabase } from '../lib/supabase'; // 세션 유저 test_mode·is_admin → 테스트광고 게이트
import { FontScaleProvider } from '../lib/ui/fontScale'; // 전역 글자 크기(설정에서 조절)
import { colors, getLoadingVideoEnabled } from '../lib/theme'; // getLoadingVideoEnabled: 인트로 영상 on/off pref(off=八字 스플래시)
import { AppAlert } from '../components/AppAlert'; // 커스텀 알림 호스트(시스템 Alert 대체)
import { installCrashLogger, logEvent, setLogTestContext } from '../lib/backend/logger'; // 전역 JS 크래시 → app_logs(DB 로그) + 앱 사용 세션 시간 로깅 + 테스트/배포 로그 태그
import { VideoSplash } from '../components/VideoSplash'; // 앱 실행 인트로 영상(왕궁 문→웅장한 호랑이→으르렁, 폴백=이미지)
import { TextSplash } from '../components/TextSplash'; // 로딩 영상 OFF 시(설정) 八字 한자 스플래시
import { BusyOverlay } from '../components/BusyOverlay'; // 인증 전환(로그아웃/로그인) 중 전역 블로킹 로딩(먹통 방지)
import { subscribeAuthBusy, getAuthBusy } from '../lib/ui/authBusy';
import { ChartConfirmHost } from '../lib/ui/chartConfirm'; // 풀이/구매 전 명식 확인 모달(드롭다운 변경)

// i18next 26.x가 Hermes에서 Intl.PluralRules 를 인식 못 해 내는 dev 경고(동작은 v3 fallback 정상,
//   한·영·일 복수형 단순해 영향 0) 억제. 프로덕션 빌드엔 LogBox 자체가 없어 무영향.
LogBox.ignoreLogs([/i18next::pluralResolver/]);

export default function RootLayout() {
  const { session, loading } = useAuth();
  const authBusy = useSyncExternalStore(subscribeAuthBusy, getAuthBusy); // 로그아웃/로그인 전환 중 전역 블로킹 오버레이(먹통 방지)
  const [splash, setSplash] = useState(true); // 앱 실행 인트로(緣) 1회 — 끝나면 언마운트

  // 전역 크래시 로거 등록(앱 시작 1회) — JS 치명 에러를 app_logs 에 기록(daniel: DB 로그).
  useEffect(() => { installCrashLogger(); }, []);
  // AdMob SDK 초기화(앱 시작 1회) — 이게 없으면 ad.load()가 실패해 무료 보상형 광고가 안 뜬다(daniel 버그). 모듈 없는 빌드는 no-op.
  useEffect(() => { initAds().catch(() => {}); }, []);
  // 진행중/완료-미확인 풀이 복원(daniel: 풀이 중 강제종료해도 홈에 '이전에 진행중인 풀이' 배너 → 탭하여 이어보기).
  useEffect(() => { hydrateGenProgress().catch(() => {}); }, []);
  // ★테스트광고 게이트(daniel) — 관리자/테스트 계정은 실 AdMob 유닛 서빙 전이라 구글 테스트광고를 보게(배너·보상형·전면 동작 확인용).
  //   세션 바뀔 때마다 test_mode·is_admin 재평가. 일반 유저는 false(실 유닛, 앱 출시 후 서빙).
  useEffect(() => {
    if (!session) { setAdTestMode(false); setLogTestContext(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setAdTestMode(false); setLogTestContext(false); return; }
      supabase.from('profiles').select('test_mode, is_admin, admin_mode').eq('id', data.user.id).maybeSingle()
        .then(({ data: p }) => {
          setAdTestMode(!!p?.test_mode); // 테스트모드 토글 ON 시에만 테스트광고+게이트(평소 관리자 편의)
          setLogTestContext(!!p?.test_mode || !!p?.is_admin || !!p?.admin_mode); // ★로그 test 태그 = 관리자/테스트 계정(실사용자 로그와 분리)
        });
    }).catch(() => {});
  }, [session]);
  // 앱 실행 시 대표 명식을 '본인'으로(daniel) — 로컬 명식 기준 즉시(로그인 동기화 후엔 syncChartsFromServer가 한 번 더 보정).
  useEffect(() => { preferSelfAsRep().catch(() => {}); }, []);
  // 앱 사용 세션 시간 추적(daniel: 관리자 계정별 평균 사용시간) — 포그라운드 구간 길이를 app_session 으로 기록.
  //   로그인 상태에서만 owner 귀속(미로그인 logEvent는 조용히 실패). 첫 구간 = 앱 실행~첫 백그라운드.
  useEffect(() => {
    let start = Date.now();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        start = Date.now();                                  // 포그라운드 복귀 → 구간 시작 리셋
        // ★포그라운드 복귀 시 서버 동기화(daniel 07-03: 재실행 없이 반영) — 명식 멀티기기 동기화 + 백그라운드 풀이 완료 반영.
        //   (프리미엄은 premiumStore 자체 리스너가 별도로 재평가. 크레딧=마켓 진입 시 로드, 공유=딥링크라 여기선 제외.)
        // ★L3: 로그아웃 클린업이 진행 중이면 완료 후 sync — 이전 계정 명식이 새 계정 blob 으로 새는 것 방지(배리어 없으면 즉시).
        void whenAuthCleanupIdle().then(() => syncChartsFromServer());
        hydrateGenProgress().catch(() => {});
        return;
      }
      const sec = Math.round((Date.now() - start) / 1000);   // 백그라운드/비활성 → 이번 구간 길이
      if (sec >= 3 && sec <= 6 * 3600) logEvent('app_session', { sec }); // 3초~6시간만(이상치 제외)
    });
    return () => sub.remove();
  }, []);
  // 인앱결제 초기화 — 키 미설정 시 no-op. 로그인 시 RC 유저(appUserID=Supabase user.id) 연결.
  useEffect(() => {
    configurePurchases(session?.user?.id);
    void refreshPremium(session?.user?.id ?? null); // ★세션 변경 시 프리미엄 재평가 → 전 화면 광고(하단 배너·보상형 게이트) 즉시 반영
    if (session?.user) InteractionManager.runAfterInteractions(() => { migrateLocalCreditsOnLogin(); }); // 로그인 시 구매분 이관 — 상호작용 후로(#2 진입 지연 완화, daniel)
  }, [session?.user?.id]);

  // 최상위 두 영역: login(미인증) · (app)(인증). 헤더는 각 하위에서 제어.
  //   FontScaleProvider 로 전역 글자 배율 제공. 인트로(SplashOverlay)는 최상위 1회 — 그 사이 세션 복원(loading).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FontScaleProvider>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.ju} /></View>
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="auth-callback" />
            <Stack.Screen name="(app)" />
          </Stack>
        )}
        <AppAlert />
        {/* 풀이/구매 전 명식 확인 모달(드롭다운으로 명식 변경 가능, daniel 07-02) — 전역 호스트 1개 */}
        <ChartConfirmHost />
        {/* 인증 전환(로그아웃/로그인) 중 화면 막고 로딩 — 클린업 캐스케이드 동안 '먹통' 방지(daniel 07-02) */}
        <BusyOverlay visible={authBusy} message="잠시만 기다려 주세요…" />
        {/* 인트로 스플래시 1회 — 설정 pref: 영상 ON=VideoSplash / OFF=八字 한자만(daniel 07-03) */}
        {splash && (getLoadingVideoEnabled() ? <VideoSplash onDone={() => setSplash(false)} /> : <TextSplash onDone={() => setSplash(false)} />)}
      </FontScaleProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
});
