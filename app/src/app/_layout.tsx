// src/app/_layout.tsx — Expo Router 루트 레이아웃 (멀티플랫폼 엔트리, ADR-036)
// ─────────────────────────────────────────────────────────────────────────
// 파일기반 라우팅의 최상위. 인증 세션을 복원하는 동안 스플래시를 띄우고,
// 실제 세션 가드는 (app)/_layout 에서 처리한다(미인증 시 /login 리다이렉트).
// native = 스택 내비 / web = URL 라우팅 으로 같은 트리가 양쪽에서 동작한다.
// ─────────────────────────────────────────────────────────────────────────
import 'intl-pluralrules'; // Intl.PluralRules polyfill (Hermes) — iztro i18next 보조(ERROR 폴백, 무해)
import '../lib/i18n'; // 다국어(한·영·일) init
// ★전역 최소 줄간격(daniel 2026-07-28 "글자가 클때 줄간 간격이 너무 좁아") — import 시점에 1회 설치.
//   테마 프리셋에 lineHeight 가 없어 대부분의 텍스트가 RN 기본(약 1.2배)으로 그려지고 있었다.
//   화면 291곳을 고치는 대신 바닥값을 여기서 깐다(자세한 근거는 모듈 주석).
import { installMinLineHeight } from '../lib/ui/textLineHeight';
installMinLineHeight();
import { useEffect, useState, useSyncExternalStore, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useFonts } from 'expo-font'; // 트렌디 폰트(Pretendard) 런타임 로드 — 네이티브 ExpoFont pod
import { View, ActivityIndicator, StyleSheet, LogBox, AppState, InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // 이슈20 드래그 reorder(gesture-handler) — 루트 래핑 필수
import { useAuth, whenAuthCleanupIdle } from '../lib/useAuth'; // whenAuthCleanupIdle: 로그아웃 클린업 완료 게이트(L3 — sync 전 대기)
import { configurePurchases } from '../lib/billing/purchases'; // 인앱결제(RevenueCat) 초기화
import { refreshPremium } from '../lib/billing/premiumStore';
import { applyCopyOverrides } from '../lib/ui/copyOverrides';   // ★빌드 없이 문구 수정(기획자 경로)
import { refreshAdFree } from '../lib/billing/adFree';   // ★광고 제거(운) 전역 재평가 — 배너가 전 화면에 있어 단일 소스가 필요 // 세션 변경(로그인/로그아웃/계정전환) 시 프리미엄 전역 재평가 → 광고 즉시 토글(daniel 2026-06-24)
import { migrateLocalCreditsOnLogin } from '../lib/billing/migrateCredits'; // 로그인 시 디바이스 구매 이관(H)
import { preferSelfAsRep, syncChartsFromServer, subscribeRepChange } from '../lib/engine/myChart'; // 대표 명식=본인 + 명식 멀티기기 동기화(포그라운드 복귀 시) + 대표 변경 구독(테마 반영)
import { applyThemeNow, consumeThemeReload } from '../lib/theme';
import { hydrateGenProgress } from '../lib/backend/genProgress'; // 앱 시작 시 진행중/미확인 풀이 복원 → 홈 배너(daniel: 강제종료 생존)
import { initAds, setAdTestMode } from '../lib/core/ads'; // AdMob 초기화 + 테스트광고 모드(관리자/테스트=실 유닛 서빙 전이라 구글 테스트광고로, daniel)
import { setClientTestMode } from '../lib/core/testMode'; // ★클라 테스트모드 캐시 → readings 목업(tier='mock') 필터 판정(OFF서 목업 새어나감 방지, daniel 07-23)
import { supabase } from '../lib/supabase'; // 세션 유저 test_mode·is_admin → 테스트광고 게이트
import { FontScaleProvider } from '../lib/ui/fontScale'; // 전역 글자 크기(설정에서 조절)
import { colors, getLoadingMode } from '../lib/theme'; // getLoadingMode: 인트로 화면 모드 video(호랑이)/text(八字)/off(없음, daniel 07-15)
import { AppAlert } from '../components/AppAlert'; // 커스텀 알림 호스트(시스템 Alert 대체)
import { installCrashLogger, logEvent, setLogTestContext } from '../lib/backend/logger';
import { installAdminTrace, setAdminTrace } from '../lib/backend/adminTrace'; // ★Edge·RPC 자동 추적(관리자 상세 / 일반은 실패만) // 전역 JS 크래시 → app_logs(DB 로그) + 앱 사용 세션 시간 로깅 + 테스트/배포 로그 태그
import { TextSplash } from '../components/TextSplash'; // 로딩 영상 OFF 시(설정) 八字 한자 스플래시
import { BusyOverlay } from '../components/BusyOverlay'; // 인증 전환(로그아웃/로그인) 중 전역 블로킹 로딩(먹통 방지)
import { subscribeAuthBusy, getAuthBusy } from '../lib/ui/authBusy';
import { ChartConfirmHost } from '../lib/ui/chartConfirm'; // 풀이/구매 전 명식 확인 모달(드롭다운 변경)
import { Onboarding } from '../components/Onboarding'; // ★첫 실행 자기이해 온보딩(App Store 4.3: '운세앱'→'AI 자기이해 도구' 인상 전환)
import { applyGlobalFont } from '../lib/ui/globalFont'; // 전역 Pretendard 폰트 — Text/TextInput 렌더 패치(트렌디, daniel 기획서 UX)
import { loadFeatures } from '../lib/core/features'; // ★신규 기능 노출 게이트(원격 플래그+관리자) — 속궁합/커뮤니티/위젯 재제출 안전판
import { syncThemeElement, ensureThemeElement } from '../lib/ui/themeElement'; // ★대표명식 일간 오행 → 테마 강조색 소스 저장(자동 강조색)
import { installRnwStyleShim } from '../lib/web/rnwStyleShim'; // ★웹: 중첩 <Text> 크래시 무해화(네이티브 무관)
import { AppErrorBoundary } from '../components/AppErrorBoundary'; // ★전역 렌더 오류 방어(백지 금지)

// ★react-native-web 호환 shim — 중첩 <Text> 가 웹에서 앱 전체를 백지로 만들던 것을 무해화.
//   자세한 근거는 `lib/web/rnwStyleShim.ts` 머리말. 네이티브는 이 줄이 아무 일도 하지 않는다.
installRnwStyleShim();

// i18next 26.x가 Hermes에서 Intl.PluralRules 를 인식 못 해 내는 dev 경고(동작은 v3 fallback 정상,
//   한·영·일 복수형 단순해 영향 0) 억제. 프로덕션 빌드엔 LogBox 자체가 없어 무영향.
LogBox.ignoreLogs([/i18next::pluralResolver/]);

// ★전역 폰트 패치(모듈 로드 1회, RootLayout 렌더 전) — 모든 Text·TextInput의 fontWeight → Pretendard 웨이트 주입.
//   실제 폰트 파일은 RootLayout의 useFonts로 로드(로드 완료 전엔 시스템 폰트로 우아하게 폴백).
applyGlobalFont();

export default function RootLayout() {
  const router = useRouter();
  // ★지금 화면 경로를 **ref 로** 들고 있는다 — 테마 리로드 직전에 저장해 두었다가 돌아온다.
  //   구독 콜백은 한 번만 등록되므로(`[]`) 클로저에 갇힌 값이 아니라 ref 를 봐야 최신이다.
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { session, loading } = useAuth();
  // Pretendard **5웨이트** 로드 — globalFont 패치가 참조하는 키명과 일치해야 함.
  //   ★2026-08-22 Medium(500)·ExtraBold(800) 추가: 시안(`니운내운.pdf`)이 다섯 웨이트를 쓰는데
  //     앱엔 셋뿐이라 500→Regular · 800→Bold 로 떨어져 **한 단계씩 얇게** 나오고 있었다.
  //   ⚠️다섯 다 **같은 판(Version 1.309 · alternative ttf 빌드)** 이다 — 판이 섞이면 글자 폭이
  //     웨이트마다 미묘하게 어긋난다(기존 Regular 와 저장소 파일의 md5 가 같은 것으로 확인했다).
  //   에러 시(fontError)엔 게이트하지 않고 시스템 폰트로 진행(폰트 문제로 앱이 막히지 않게).
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('../../assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.ttf'),
    'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard-ExtraBold.ttf'),
  });
  const authBusy = useSyncExternalStore(subscribeAuthBusy, getAuthBusy); // 로그아웃/로그인 전환 중 전역 블로킹 오버레이(먹통 방지)
  const [splash, setSplash] = useState(() => getLoadingMode() !== 'off'); // 앱 실행 인트로 1회 — 끝나면 언마운트. off=처음부터 없음(바로 앱)

  // 전역 크래시 로거 등록(앱 시작 1회) — JS 치명 에러를 app_logs 에 기록(daniel: DB 로그).
  useEffect(() => {
    installCrashLogger();
    installAdminTrace();   // ★Edge·RPC 를 한 곳에서 가로채 로깅(호출 지점 24곳을 고치지 않는다)
  }, []);
  // AdMob SDK 초기화(앱 시작 1회) — 이게 없으면 ad.load()가 실패해 무료 보상형 광고가 안 뜬다(daniel 버그). 모듈 없는 빌드는 no-op.
  useEffect(() => { initAds().catch(() => {}); }, []);
  // ★문구 오버라이드(daniel 2026-08-03) — 앱 재빌드 없이 기획자가 고친 문구를 번들 위에 덮는다.
  //   실패·지연은 무시(내부에서 5초 상한) — 문구는 부가라 번들 값으로 정상 동작한다.
  useEffect(() => { void applyCopyOverrides(); }, []);
  // 진행중/완료-미확인 풀이 복원(daniel: 풀이 중 강제종료해도 홈에 '이전에 진행중인 풀이' 배너 → 탭하여 이어보기).
  useEffect(() => { hydrateGenProgress().catch(() => {}); }, []);
  // ★테스트광고 게이트(daniel) — 관리자/테스트 계정은 실 AdMob 유닛 서빙 전이라 구글 테스트광고를 보게(배너·보상형·전면 동작 확인용).
  //   세션 바뀔 때마다 test_mode·is_admin 재평가. 일반 유저는 false(실 유닛, 앱 출시 후 서빙).
  useEffect(() => {
    if (!session) { setAdTestMode(false); setClientTestMode(false); setLogTestContext(false); setAdminTrace(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setAdTestMode(false); setClientTestMode(false); setLogTestContext(false); setAdminTrace(false); return; }
      // ★★전역 테스트모드(daniel 2026-08-01)를 **함께** 읽는다.
      //   서버(interpret)만 전역으로 켜면 목업이 저장되는데, 클라의 `excludeMock` 이 그걸 걸러내
      //   화면이 통째로 빈다(개인 test_mode 가 false 이므로). 두 소스를 OR 로 묶어야 짝이 맞는다.
      //   ⚠️이 짝을 깨면 "테스트모드 켰는데 풀이가 안 보인다"가 된다 — 서버·클라 어느 한쪽만 고치지 말 것.
      Promise.all([
        supabase.from('profiles').select('test_mode, is_admin, admin_mode').eq('id', data.user.id).maybeSingle(),
        supabase.from('app_flags').select('enabled').eq('key', 'global_test_mode').maybeSingle(),
      ]).then(([{ data: p }, { data: gf }]) => {
          const globalTest = (gf as { enabled?: boolean } | null)?.enabled === true;
          const mockOn = !!p?.test_mode || globalTest;   // 개인(관리자) OR 전역
          setAdTestMode(mockOn); // 테스트모드 ON 시에만 테스트광고+게이트(평소 관리자 편의)
          setClientTestMode(mockOn); // ★readings 목업 필터 소스 — OFF면 direct 로드가 tier='mock' 제외(실모드 목업 서빙 차단)
          setLogTestContext(mockOn || !!p?.is_admin || !!p?.admin_mode); setAdminTrace(mockOn || !!p?.is_admin || !!p?.admin_mode); // ★로그 test 태그 = 관리자/테스트 계정(실사용자 로그와 분리)
        });
    }).catch(() => {});
  }, [session]);
  // 앱 실행 시 대표 명식을 '본인'으로(daniel) — 로컬 명식 기준 즉시(로그인 동기화 후엔 syncChartsFromServer가 한 번 더 보정).
  //   대표명식 확정 후 일간 오행을 테마 강조색 소스로 저장(auto 강조 모드면 다음 로드에 일간 색 반영).
  //   ★★테마는 여기서 **덮지 않는다**(2026-08-18 Boss ②안: 테마 소스를 대표와 분리).
  //     대표는 앱을 켤 때마다 본인으로 돌아가지만, 테마는 **마지막으로 고른 명식**의 색을 지킨다.
  //     `ensureThemeElement()` 는 저장값이 없을 때(최초 실행)만 본인 오행으로 초기화한다.
  //   ★★2026-08-19: '테마 리로드'로 다시 뜬 경우에는 `preferSelfAsRep()` 을 **건너뛴다**.
  //     안 그러면 방금 고른 명식이 리로드 직후 본인으로 되돌아간다(테마만 바뀌고 명식은 원복 = 최악).
  //     그리고 있던 화면으로 돌려보낸다(daniel 2026-07-18 *"명식 바꿀 때마다 홈으로 튕겨서"*).
  useEffect(() => {
    const { was, returnTo } = consumeThemeReload();
    if (!was) preferSelfAsRep().catch(() => {});
    ensureThemeElement().catch(() => {});
    if (was && returnTo && returnTo !== '/') {
      // ⚠️라우터가 아직 첫 화면을 마운트하기 전이면 `replace` 가 **조용히 버려진다**
      //   (2026-08-19 실측: `setTimeout(…, 0)` 으로는 홈에 머물렀다).
      //   ⇒ 실제로 그 경로에 도착할 때까지 짧게 재시도한다. 2초 안에 안 되면 포기(홈에 머문다).
      let tries = 0;
      const tick = setInterval(() => {
        tries += 1;
        try { router.replace(returnTo as never); } catch { /* 아직 준비 안 됨 */ }
        if (pathnameRef.current === returnTo || tries >= 10) clearInterval(tick);
      }, 200);
    }
  }, []);
  // ★★명식을 바꾸면 테마도 **그 명식 오행으로** 간다(Boss 2026-08-18 "현재 적용된 명식 기준").
  //   `reload=true` — 다만 실제 리로드는 **웹에서만** 일어난다(theme.storeChartElement 참조).
  //   07-18 에 리로드를 뺀 이유가 "명식 바꿀 때마다 홈으로 튕겨서"였는데, 웹은 같은 URL 로 새로고침이라
  //   튕기지 않는다. 네이티브는 그 제약이 그대로라 저장만 되고 **다음 실행**에 반영된다.
  // ★★명식을 **사람이 고르면** 테마도 그 명식 오행으로 간다(Boss 2026-08-18 "현재 적용된 명식 기준").
  //   ⚠️`'boot'`(앱이 대표를 본인으로 되돌린 것)는 따라가지 않는다 — 그러면 어제 고른 색이 매번 리셋된다.
  //   색이 실제로 바뀌는 시점은 **다음 진입**이다(`colors` 가 모듈 로드 시 1회 결정 — 168개 파일이 import).
  //   ★색을 **지금** 바꾸려면 앱을 다시 띄우는 수밖에 없다(`colors` 가 모듈 로드 시 1회 결정 — 168개 파일이 import).
  //     그 비용을 두 가지로 덜었다: ①오행이 **실제로 바뀔 때만** 리로드(같은 오행끼리 전환은 그대로)
  //     ②리로드 뒤 **있던 화면으로 복귀**(위 부팅 훅).
  useEffect(() => subscribeRepChange((reason) => {
    if (reason === 'boot') return;   // 앱이 대표를 본인으로 되돌린 것 — 어제 고른 색을 리셋하지 않는다
    void syncThemeElement().then((changed) => { if (changed) applyThemeNow(pathnameRef.current); });
  }), []);
  // ★신규 기능 노출 게이트 로드(세션 변경 시) — 원격 플래그(app_flags)+내 관리자 여부. 속궁합/커뮤니티/위젯 게이트.
  useEffect(() => { loadFeatures().catch(() => {}); }, [session?.user?.id]);
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
        // ⚠️포그라운드 복귀에서는 테마를 **건드리지 않는다**(2026-08-18) — 복귀 시점의 대표는
        //   사용자가 고른 것이 아닐 수 있다(부팅 복귀·서버 동기화). 최초 초기화만 보장한다.
        ensureThemeElement().catch(() => {});
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
    // ★광고 제거(코인 구매) 재평가(daniel 07-28) — 계정마다 값이 다르므로 세션이 바뀌면 반드시 다시 읽는다.
    //   안 읽으면 A 계정이 산 무광고가 B 계정에 그대로 남는다(반대로도 마찬가지).
    void refreshAdFree();
    if (session?.user) InteractionManager.runAfterInteractions(() => { migrateLocalCreditsOnLogin(); }); // 로그인 시 구매분 이관 — 상호작용 후로(#2 진입 지연 완화, daniel)
  }, [session?.user?.id]);

  // 최상위 두 영역: login(미인증) · (app)(인증). 헤더는 각 하위에서 제어.
  //   FontScaleProvider 로 전역 글자 배율 제공. 인트로(SplashOverlay)는 최상위 1회 — 그 사이 세션 복원(loading).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ★전역 에러 바운더리(2026-08-17) — 한 화면의 렌더 오류가 **앱 전체를 백지로** 만들지 않게.
          종전엔 바운더리가 하나도 없어서, 어느 한 곳이 죽으면 사이드바까지 사라지고 원인은 콘솔에만 남았다. */}
      <AppErrorBoundary where="root">
      <FontScaleProvider>
        {(loading || (!fontsLoaded && !fontError)) ? (
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
        {/* ★첫 실행 자기이해 온보딩 — 스플래시 종료 후 노출. 신규 설치 1회(컴포넌트 자체 판정: 플래그+기존 명식).
            App Store 4.3 대응 = 리뷰어가 운세 카드그리드 대신 'AI 자기이해 도구' 여정을 먼저 보게. */}
        {!splash && <Onboarding />}
        {/* 인트로 스플래시 1회 — 설정: video=호랑이영상 / text=八字한자 / off=없음(splash 처음부터 false, 여기 미렌더) */}
        {/* ★스플래시 영상 제거(daniel 2026-08-05 "로딩화면 영상 다 없애버려") — video 모드여도 텍스트 스플래시로. */}
        {splash && <TextSplash onDone={() => setSplash(false)} />}
      </FontScaleProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
});
