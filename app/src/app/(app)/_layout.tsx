// src/app/(app)/_layout.tsx — 인증 영역 레이아웃 + 하단 배너 광고(무료)
// ─────────────────────────────────────────────────────────────────────────
// 로그인 게이트 없음(ADR-037) — 명식·궁합은 온디바이스 무료(규칙5).
// 무료 사용자 = 하단 AdBanner 고정 / 프리미엄(구독) = 광고 없음(ADR-043).
// ─────────────────────────────────────────────────────────────────────────
import { Stack, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View, Platform } from 'react-native';
import { useEffect } from 'react';
import { clearGenByPath } from '../../lib/backend/genProgress'; // 화면 접근 시 그 풀이 알림 배너 해제(daniel ⑨)
import { logEvent } from '../../lib/backend/logger'; // 콘텐츠 조회 로깅(daniel 2026-08-10) — 아래 useEffect 참조
import { useFontScale } from '../../lib/ui/fontScale';
import { AdBanner } from '../../components/AdBanner';
import { BottomNav } from '../../components/BottomNav';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ContentBackdrop } from '../../components/ContentBackdrop'; // ★전 콘텐츠 화면 공통 배경(한지/달밤+별) — daniel 07-02
import { WebShell, useWideWeb } from '../../components/WebShell'; // 넓은 웹 = 좌측 내비 + 가운데 컬럼(네이티브·모바일 웹은 무영향)
import { PAID_ROUTES } from '../../lib/content/contentSections'; // 유료 화면 = 광고 없음(daniel 08-06)
import { colors } from '../../lib/theme';

// deep link 로 하위 화면(register 등)에 직접 진입해도 index(홈)를 스택 최하단에 깔아
//   헤더 뒤로가기를 항상 보장한다(정상 네비·딥링크 무관).
export const unstable_settings = { initialRouteName: 'index' };

/** 마지막으로 기록한 경로 — 화면 조회 로그의 **연속 중복**을 막는다(아래 useEffect 주석 참조).
 *  ★모듈 스코프인 이유: 레이아웃이 두 번 마운트돼도 하나로 공유돼야 막힌다(useRef 는 인스턴스마다 따로다). */
let lastLoggedPath: string | null = null;

export default function AppLayout() {
  // ★화면 제목도 그 나라 말로 — 종전엔 한국어가 박혀 있어 en/ja 사용자에게 그대로 떴다
  //   (Boss 2026-08-25 «해당국가 언어로». 관리자 전용 둘은 한국어가 정본이라 그대로 둔다.)
  const { t } = useTranslation();
  const { fs } = useFontScale();   // 글자크기 설정 → 헤더 타이틀 반응(daniel). 뒤로버튼은 iOS 네이티브.
  const wideWeb = useWideWeb();    // 넓은 웹 = 하단 탭 대신 좌측 사이드바(아래 렌더 참조)
  // 해당 화면을 어떤 루트로든 접근하면 그 풀이의 홈 알림 배너 해제(daniel ⑨). 홈('/')은 제외(배너 노출 유지).
  const pathname = usePathname();
  useEffect(() => { if (pathname && pathname !== '/') clearGenByPath(pathname); }, [pathname]);
  // ── ★콘텐츠 조회 로깅 (daniel 2026-08-10 "로깅") ──────────────────────────
  //   왜 필요했나: 콘텐츠가 51종인데 **무엇이 열리는지 아무 기록도 없었다.**
  //   실측(08-10): `app_logs` 에 `app_active` 996건 · `admin_*` 4건이 전부 —
  //   즉 프로덕션에 나가도 "뭐가 팔리는지"를 영영 모르는 상태였다. 기획을 추측으로 하게 되는 원인.
  //
  //   ★왜 여기 한 곳인가: 콘텐츠는 저마다 **고유 라우트**(`/wealth`·`/taro`·`/ziwei`…)를 갖는다
  //   (쿼리 파라미터로 갈리지 않는다 — 실측 확인). 그래서 이 레이아웃의 `pathname` 하나면
  //   **51개 화면을 하나도 안 고치고** 전부 잡힌다. 화면마다 심으면 반드시 빠뜨린다(이 프로젝트 반복 실수).
  //
  //   · PII 없음 — 동적 세그먼트 라우트가 없어 경로에 id·생년월일이 실리지 않는다(실측 확인).
  //   · `logEvent` 는 fire-and-forget 이고 `env: dev|prod` 태그를 자동으로 붙인다(테스트↔실사용 분리).
  //   · 홈('/')도 남긴다 — 진입 대비 콘텐츠 도달률을 보려면 분모가 필요하다.
  //   · 같은 경로를 다시 열면 다시 남는다(deps=[pathname]) — 그게 '조회 수'다.
  //   집계: `npm run stats:content`
  //
  //   ⚠️★중복 가드가 **필수**다(실측으로 잡음): 가드 없이 넣었더니 경로마다 **3ms 간격으로 2건씩**
  //     찍혔다(`/taro` 07:40:38.718 · .721). 그대로 뒀으면 **모든 조회 수가 정확히 2배**가 되어
  //     통계가 조용히 거짓말을 한다 — 숫자가 나오니 맞는 줄 알았을 것이다.
  //     원인(레이아웃 이중 실행)보다 **가드가 확실**하다. 그리고 ref 가 아니라 **모듈 스코프**를 쓴다:
  //     레이아웃 인스턴스가 둘이면 ref 는 각자라 못 막는다.
  //     ★A→B→A 는 그대로 2번 남는다(연속 중복만 막는다) — 그게 '조회 수'의 정의다.
  useEffect(() => {
    if (!pathname || lastLoggedPath === pathname) return;
    lastLoggedPath = pathname;
    logEvent('screen', { path: pathname });
  }, [pathname]);
  // 유료(운으로 여는) 콘텐츠 화면인가 — 하단 배너 노출 판정(아래 AdBanner 주석 참조).
  //   startsWith 인 이유: 라우트가 하위 경로를 갖는 경우(/reading/... 등)도 같은 콘텐츠다.
  const isPaidScreen = !!pathname && PAID_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ★전역 배경 — 모든 하위 화면 뒤에 단 하나. 첫 자식 = 최하단(뒤). 화면 루트는 투명이라 이게 비쳐 보인다.
          루트 View 의 backgroundColor: colors.bg 는 이 배경이 뜨기 전 흰 깜빡임 방지용 베이스(곧 가려짐). */}
      <ContentBackdrop />
      <OfflineBanner />
      {/* ★넓은 웹에서만 좌측 내비 + 가운데 컬럼으로 감싼다. 네이티브·모바일 웹은 children 그대로 지나간다. */}
      <WebShell>
      <Stack screenOptions={{
        // ★기본 = 헤더 타이틀 없음(daniel: 콘텐츠 상단에 라우트 영어 이름 'country'·'gaeun' 등이 박히던 문제 →
        //   _layout 누락 라우트가 expo-router 기본값=파일명(영어)을 띄움). 타이틀이 필요한 화면만 아래 title: 로 덮어씀.
        headerTitle: '',
        headerStyle: { backgroundColor: colors.card }, // 헤더 배경 = 카드 서피스(라이트=연베이지 #FBF5E8) — 배경 위 도드라지게(daniel 07-03)
        headerTintColor: colors.ink,                 // 먹 — 뒤로가기·타이틀
        headerTitleStyle: { color: colors.ink, fontWeight: '700', fontSize: fs(17) }, // 글자크기 반응
        // ★Apple 디자인(daniel 2026-07-15): iOS Large Title 스타일 — title 있는 화면(아래 headerLargeTitle)에서 큰 타이틀.
        headerLargeTitleStyle: { color: colors.ink, fontWeight: '700' },
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,                  // iOS 무드 — 헤더 그림자 제거(구분선/대비로 깊이)
        // 뒤로버튼 = iOS 네이티브(daniel #9: iOS26 글래스 버튼 안에서 커스텀 '‹뒤로'가 왼쪽에 붙던 문제 →
        //   네이티브가 글래스 안 가운데 정렬·표준 처리). headerBackTitle 로 '뒤로' 텍스트만 지정.
        headerBackButtonDisplayMode: 'default',
        headerBackTitle: t('nav.back', '뒤로'),
        // ★웹은 뒤로가기를 그리지 않는다 (daniel 2026-08-19 *"웹에서는 뒤로가기 빼도 될꺼같은데"*).
        //   브라우저가 이미 뒤로가기를 갖고 있어 **같은 일을 하는 버튼이 둘**이 된다.
        //   ⚠️네이티브는 그대로 둔다 — 거기엔 브라우저 뒤로가기가 없어서 이게 유일한 통로다.
        ...(Platform.OS === 'web' ? { headerLeft: () => null, headerBackVisible: false } : null),
        contentStyle: { backgroundColor: 'transparent' }, // ★씬 투명 — 전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02). 흰 깜빡임은 루트 View bg + 배경 레이어가 방지.
        animation: 'fade', // ★카드 진입 애니(홈 카드가 화면 채움) 뒤에 슬라이드가 또 나와 이상하던 것 → 페이드로 통일(카드 fill이 전환, daniel 07-01)
      }}>
        {/* ★탭 라우트 5개(index·contents·community·coach·market)는 전환 애니 없음(daniel 2026-07-26 "탭바 넘길 때 애니메이션 빼줘").
            BottomNav 는 router.replace 로 이동하므로 전역 screenOptions 의 animation:'fade' 를 타고 있었다.
            전역 fade 는 콘텐츠 화면 진입용으로 07-01 에 의도된 것이라 유지하고, **탭만** 'none' 으로 덮어쓴다. */}
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
        {/* ★★하단 탭 라우트는 **반드시** headerShown:false + animation:'none' 이다(2026-08-20).
            빠뜨리면 Stack 기본 헤더(64px 흰 띠)가 얹히고, 탭을 넘길 때 전역 fade 가 붙는다.
            ⚠️실제로 `/chats` 를 새로 만들고 등록을 잊어 흰 띠가 떴다 — 화면은 멀쩡히 돌아서
              '레이아웃이 좀 이상한데' 로만 보였다. `check:reach` R4 가 이제 지킨다. */}
        <Stack.Screen name="chats" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="friends" options={{ headerShown: false }} />
        <Stack.Screen name="friendcompat" options={{ headerShown: false }} />
        <Stack.Screen name="talk" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="register" options={{ title: t('screen.register', '차트 등록') }} />
        <Stack.Screen name="myeongsik" options={{ headerTitle: '' }} />
        <Stack.Screen name="sinsal" options={{ headerTitle: '' }} />
        <Stack.Screen name="reading" options={{ headerTitle: '' }} />
        <Stack.Screen name="timeline" options={{ headerTitle: '' }} />
        {/* ★설정은 이제 **탭**이다(2026-08-20 4탭) — 다른 탭과 같이 Stack 헤더를 끈다.
            ⚠️종전 `title:'설정'` 헤더는 웹에서 **제목이 그려지지 않아** 64px 흰 띠만 남았다
              (실물에서 확인). 정보 없는 띠가 네 탭 중 하나에만 있으면 그건 결함이다.
            ★`/settings` 로 push 진입하는 곳이 없음을 확인하고 껐다 — 뒤로가기가 필요 없다. */}
        <Stack.Screen name="settings" options={{ headerShown: false, animation: 'none' }} />
        {/* ★시안 4탭(2026-08-18) — 마이페이지·풀이 보관함·결제 내역 */}
        <Stack.Screen name="my" options={{ headerShown: false }} />
        <Stack.Screen name="myreadings" options={{ headerShown: false }} />
        <Stack.Screen name="favorites" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="analyzed" options={{ headerShown: false }} />
        <Stack.Screen name="coinhistory" options={{ title: t('screen.coinhistory', '결제/충전 내역') }} />
        <Stack.Screen name="compat" options={{ headerTitle: '' }} />
        <Stack.Screen name="taro" options={{ headerTitle: '' }} />
        <Stack.Screen name="today" options={{ headerTitle: '' }} />
        <Stack.Screen name="month" options={{ headerTitle: '' }} />
        <Stack.Screen name="charts" options={{ title: t('screen.charts', '만세력') }} />
        <Stack.Screen name="traits" options={{ headerTitle: '' }} />
        <Stack.Screen name="dayPillar" options={{ headerTitle: '' }} />
        <Stack.Screen name="pet" options={{ headerTitle: '' }} />
        <Stack.Screen name="love" options={{ headerTitle: '' }} />
        <Stack.Screen name="lifegraph" options={{ headerTitle: '' }} />
        <Stack.Screen name="future10" options={{ headerTitle: '' }} />
        {/* 신규(daniel 2026-07-05) — 재회·짝사랑·취업 유료 + 무료 질문형 퍼널. 기존 콘텐츠와 동일 틀(headerTitle:''). */}
        <Stack.Screen name="reunion" options={{ headerTitle: '' }} />
        <Stack.Screen name="crush" options={{ headerTitle: '' }} />
        <Stack.Screen name="job" options={{ headerTitle: '' }} />
        <Stack.Screen name="reunionAsk" options={{ headerTitle: '' }} />
        <Stack.Screen name="crushAsk" options={{ headerTitle: '' }} />
        <Stack.Screen name="jobAsk" options={{ headerTitle: '' }} />
        <Stack.Screen name="child" options={{ headerTitle: '' }} />
        <Stack.Screen name="newyear" options={{ headerTitle: '' }} />
        <Stack.Screen name="career" options={{ headerTitle: '' }} />
        <Stack.Screen name="talent" options={{ headerTitle: '' }} />
        <Stack.Screen name="numerology" options={{ headerTitle: '' }} />
        <Stack.Screen name="astrology" options={{ headerTitle: '' }} />
        <Stack.Screen name="mbti" options={{ headerTitle: '' }} />
        <Stack.Screen name="roots" options={{ headerTitle: '' }} />
        <Stack.Screen name="image" options={{ headerTitle: '' }} />
        <Stack.Screen name="impression" options={{ headerTitle: '' }} />
        <Stack.Screen name="gem" options={{ headerTitle: '' }} />
        <Stack.Screen name="timeResolve" options={{ headerTitle: '' }} />
        <Stack.Screen name="mission" options={{ headerTitle: '' }} />
        <Stack.Screen name="personatype" options={{ headerTitle: '' }} /> {/* 성격유형 120종(홈 주인공 상세 · 64종 /persona 통합, daniel 07-20) */}
        {/* 되돌아보기(lookback) 제거 — daniel 07-23. 화면 파일·라우트 삭제. */}
        <Stack.Screen name="egenteto" options={{ headerTitle: '' }} />
        <Stack.Screen name="coach" options={{ headerShown: false, animation: 'none' }} />
        {/* 하단탭 '풀이'(콘텐츠 목록) — 홈·코치처럼 탭 화면이라 자체 타이틀을 그린다(헤더 숨김, daniel 07-18 IA 개편). */}
        <Stack.Screen name="contents" options={{ headerShown: false, animation: 'none' }} />
        {/* ★headerShown:false — 탭 5개 중 **커뮤니티만 빈 헤더가 켜져 있어** 상단이 이중으로 비었다
            (daniel 2026-08-07 IMG_8418 "커뮤니티 상단에 여백이 너무 많아"). 제목 없는 헤더 ≈59pt +
            카테고리 칩바 44pt 가 겹쳤다. 다른 탭(index·coach·contents)과 같은 규칙으로 맞춘다. */}
        <Stack.Screen name="community" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="moment" options={{ title: t('screen.moment', '모먼트') }} />
        {/* 가볍게 보기 — 명식 없이 생년월일만으로 즉시 결과(신규 유입 · docs/PLAN_light_mode.md L1) */}
        <Stack.Screen name="light" options={{ title: t('screen.light', '가볍게 보기') }} />
        <Stack.Screen name="biorhythm" options={{ title: t('screen.biorhythm', '바이오리듬') }} />
        <Stack.Screen name="coins" options={{ title: t('screen.coins', '운 충전') }} />
        <Stack.Screen name="joseonjob" options={{ headerTitle: '' }} />
        <Stack.Screen name="lovestyle" options={{ headerTitle: '' }} />
        <Stack.Screen name="bok" options={{ headerTitle: '' }} />
        <Stack.Screen name="pastlife" options={{ headerTitle: '' }} />
        <Stack.Screen name="healing" options={{ headerTitle: '' }} />
        <Stack.Screen name="taegil" options={{ headerTitle: '' }} />
        <Stack.Screen name="luck" options={{ headerTitle: '' }} />
        <Stack.Screen name="zodiac" options={{ headerTitle: '' }} />
        <Stack.Screen name="name" options={{ headerTitle: '' }} />
        <Stack.Screen name="dream" options={{ headerTitle: '' }} />
        <Stack.Screen name="taemong" options={{ headerTitle: '' }} />
        {/* 프리미엄 허브 제거 — 홈 사주/자미 → 원국풀이(/reading·/ziwei) 직접 진입(daniel 07-01) */}
        <Stack.Screen name="market" options={{ title: t('screen.market', '마켓'), animation: 'none' }} />
        <Stack.Screen name="shared/[id]" options={{ title: t('screen.shared', '공유받은 풀이') }} />
        {/* ★아래 둘은 **운영자만** 본다 — 한국어가 정본이라 다국어로 안 뺀다(빼면 관리 화면이 더 헷갈린다) */}
        <Stack.Screen name="admin" options={{ title: t('nav.admin', '관리자') }} />
        <Stack.Screen name="coststable" options={{ title: t('nav.costs', '비용·수익 분석') }} />
      </Stack>
      </WebShell>
      {/* 하단 배너 — 무료 화면에만. 광고 제거 구매자는 AdBanner 내부에서 숨긴다(useAdFree).
          ★유료 콘텐츠 화면에서는 띄우지 않는다(daniel 2026-08-06 "유료 컨텐츠는 광고 다 빼").
            배너는 전역(_layout)이라 **운을 내고 여는 풀이를 읽는 내내** 하단에 광고가 붙어 있었다.
            무료는 광고로, 유료는 값으로 — 그 경계를 여기 길목 하나에서 정한다.
            판정 목록(PAID_ROUTES)은 creditKey 라는 사실에서 자동 파생되므로 콘텐츠가 늘어도 안 빠진다. */}
      {!isPaidScreen && <AdBanner />}
      {/* 하단 탭 네비(홈/마켓) — 모든 화면 최하단 고정.
          ★넓은 웹에서는 좌측 사이드바(WebShell)가 그 일을 하므로 띄우지 않는다 —
            둘 다 있으면 같은 내비가 두 벌이 된다. */}
      {!wideWeb && <BottomNav />}
    </View>
  );
}
