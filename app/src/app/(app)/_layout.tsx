// src/app/(app)/_layout.tsx — 인증 영역 레이아웃 + 하단 배너 광고(무료)
// ─────────────────────────────────────────────────────────────────────────
// 로그인 게이트 없음(ADR-037) — 명식·궁합은 온디바이스 무료(규칙5).
// 무료 사용자 = 하단 AdBanner 고정 / 프리미엄(구독) = 광고 없음(ADR-043).
// ─────────────────────────────────────────────────────────────────────────
import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useEffect } from 'react';
import { clearGenByPath } from '../../lib/backend/genProgress'; // 화면 접근 시 그 풀이 알림 배너 해제(daniel ⑨)
import { useFontScale } from '../../lib/ui/fontScale';
import { AdBanner } from '../../components/AdBanner';
import { BottomNav } from '../../components/BottomNav';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ContentBackdrop } from '../../components/ContentBackdrop'; // ★전 콘텐츠 화면 공통 배경(한지/달밤+별) — daniel 07-02
import { colors } from '../../lib/theme';

// deep link 로 하위 화면(register 등)에 직접 진입해도 index(홈)를 스택 최하단에 깔아
//   헤더 뒤로가기를 항상 보장한다(정상 네비·딥링크 무관).
export const unstable_settings = { initialRouteName: 'index' };

export default function AppLayout() {
  const { fs } = useFontScale();   // 글자크기 설정 → 헤더 타이틀 반응(daniel). 뒤로버튼은 iOS 네이티브.
  // 해당 화면을 어떤 루트로든 접근하면 그 풀이의 홈 알림 배너 해제(daniel ⑨). 홈('/')은 제외(배너 노출 유지).
  const pathname = usePathname();
  useEffect(() => { if (pathname && pathname !== '/') clearGenByPath(pathname); }, [pathname]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ★전역 배경 — 모든 하위 화면 뒤에 단 하나. 첫 자식 = 최하단(뒤). 화면 루트는 투명이라 이게 비쳐 보인다.
          루트 View 의 backgroundColor: colors.bg 는 이 배경이 뜨기 전 흰 깜빡임 방지용 베이스(곧 가려짐). */}
      <ContentBackdrop />
      <OfflineBanner />
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
        headerBackTitle: '뒤로',
        contentStyle: { backgroundColor: 'transparent' }, // ★씬 투명 — 전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02). 흰 깜빡임은 루트 View bg + 배경 레이어가 방지.
        animation: 'fade', // ★카드 진입 애니(홈 카드가 화면 채움) 뒤에 슬라이드가 또 나와 이상하던 것 → 페이드로 통일(카드 fill이 전환, daniel 07-01)
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: '차트 등록' }} />
        <Stack.Screen name="myeongsik" options={{ headerTitle: '' }} />
        <Stack.Screen name="sinsal" options={{ headerTitle: '' }} />
        <Stack.Screen name="reading" options={{ headerTitle: '' }} />
        <Stack.Screen name="timeline" options={{ headerTitle: '' }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
        <Stack.Screen name="compat" options={{ headerTitle: '' }} />
        <Stack.Screen name="taro" options={{ headerTitle: '' }} />
        <Stack.Screen name="today" options={{ headerTitle: '' }} />
        <Stack.Screen name="month" options={{ headerTitle: '' }} />
        <Stack.Screen name="charts" options={{ title: '만세력' }} />
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
        <Stack.Screen name="timeResolve" options={{ headerTitle: '' }} />
        <Stack.Screen name="mission" options={{ headerTitle: '' }} />
        <Stack.Screen name="personatype" options={{ headerTitle: '' }} /> {/* 성격유형 120종(홈 주인공 상세 · 64종 /persona 통합, daniel 07-20) */}
        <Stack.Screen name="lookback" options={{ headerTitle: '' }} />   {/* 되돌아보기 — 내 기록 × 그날 운세(리텐션 Phase 1) */}
        <Stack.Screen name="egenteto" options={{ headerTitle: '' }} />
        <Stack.Screen name="coach" options={{ headerShown: false }} />
        {/* 하단탭 '풀이'(콘텐츠 목록) — 홈·코치처럼 탭 화면이라 자체 타이틀을 그린다(헤더 숨김, daniel 07-18 IA 개편). */}
        <Stack.Screen name="contents" options={{ headerShown: false }} />
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
        {/* 프리미엄 허브 제거 — 홈 사주/자미 → 원국풀이(/reading·/ziwei) 직접 진입(daniel 07-01) */}
        <Stack.Screen name="market" options={{ title: '마켓' }} />
        <Stack.Screen name="shared/[id]" options={{ title: '공유받은 풀이' }} />
        <Stack.Screen name="admin" options={{ title: '관리자' }} />
        <Stack.Screen name="coststable" options={{ title: '비용·수익 분석' }} />
      </Stack>
      {/* 무료=하단 배너 고정 / 프리미엄=숨김 (AdBanner 내부에서 isPremium 분기) */}
      <AdBanner />
      {/* 하단 탭 네비(홈/마켓) — 모든 화면 최하단 고정 */}
      <BottomNav />
    </View>
  );
}
