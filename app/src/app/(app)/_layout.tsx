// src/app/(app)/_layout.tsx — 인증 영역 레이아웃 + 하단 배너 광고(무료)
// ─────────────────────────────────────────────────────────────────────────
// 로그인 게이트 없음(ADR-037) — 명식·궁합은 온디바이스 무료(규칙5).
// 무료 사용자 = 하단 AdBanner 고정 / 프리미엄(구독) = 광고 없음(ADR-043).
// ─────────────────────────────────────────────────────────────────────────
import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useEffect } from 'react';
import { clearGenByPath } from '../../lib/genProgress'; // 화면 접근 시 그 풀이 알림 배너 해제(daniel ⑨)
import { useFontScale } from '../../lib/fontScale';
import { AdBanner } from '../../components/AdBanner';
import { BottomNav } from '../../components/BottomNav';
import { OfflineBanner } from '../../components/OfflineBanner';
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
      <OfflineBanner />
      <Stack screenOptions={{
        // ★기본 = 헤더 타이틀 없음(daniel: 콘텐츠 상단에 라우트 영어 이름 'country'·'gaeun' 등이 박히던 문제 →
        //   _layout 누락 라우트가 expo-router 기본값=파일명(영어)을 띄움). 타이틀이 필요한 화면만 아래 title: 로 덮어씀.
        headerTitle: '',
        headerStyle: { backgroundColor: colors.bg }, // 한지 헤더
        headerTintColor: colors.ink,                 // 먹 — 뒤로가기·타이틀
        headerTitleStyle: { color: colors.ink, fontWeight: '700', fontSize: fs(17) }, // 글자크기 반응
        headerShadowVisible: false,                  // 한지 무드 — 헤더 그림자 제거
        // 뒤로버튼 = iOS 네이티브(daniel #9: iOS26 글래스 버튼 안에서 커스텀 '‹뒤로'가 왼쪽에 붙던 문제 →
        //   네이티브가 글래스 안 가운데 정렬·표준 처리). headerBackTitle 로 '뒤로' 텍스트만 지정.
        headerBackButtonDisplayMode: 'default',
        headerBackTitle: '뒤로',
        contentStyle: { backgroundColor: colors.bg }, // 씬 배경 한지(전환 시 흰 깜빡임 방지)
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
        <Stack.Screen name="persona" options={{ headerTitle: '' }} />
        <Stack.Screen name="egenteto" options={{ headerTitle: '' }} />
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
        <Stack.Screen name="premium" options={{ headerTitle: '' }} />
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
