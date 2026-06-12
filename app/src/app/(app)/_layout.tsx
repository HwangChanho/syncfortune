// src/app/(app)/_layout.tsx — 인증 영역 레이아웃 + 하단 배너 광고(무료)
// ─────────────────────────────────────────────────────────────────────────
// 로그인 게이트 없음(ADR-037) — 명식·궁합은 온디바이스 무료(규칙5).
// 무료 사용자 = 하단 AdBanner 고정 / 프리미엄(구독) = 광고 없음(ADR-043).
// ─────────────────────────────────────────────────────────────────────────
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AdBanner } from '../../components/AdBanner';
import { BottomNav } from '../../components/BottomNav';
import { OfflineBanner } from '../../components/OfflineBanner';
import { colors } from '../../lib/theme';

// deep link 로 하위 화면(register 등)에 직접 진입해도 index(홈)를 스택 최하단에 깔아
//   헤더 뒤로가기를 항상 보장한다(정상 네비·딥링크 무관).
export const unstable_settings = { initialRouteName: 'index' };

export default function AppLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.bg }, // 한지 헤더
        headerTintColor: colors.ink,                 // 먹 — 뒤로가기·타이틀
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        headerShadowVisible: false,                  // 한지 무드 — 헤더 그림자 제거
        headerBackButtonDisplayMode: 'minimal',      // 뒤로가기 텍스트('Back') 숨김 — 화살표만(react-nav 7, 다국어 무관)
        contentStyle: { backgroundColor: colors.bg }, // 씬 배경 한지(전환 시 흰 깜빡임 방지)
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: '차트 등록' }} />
        <Stack.Screen name="myeongsik" options={{ title: '명식' }} />
        <Stack.Screen name="sinsal" options={{ title: '신살·공망' }} />
        <Stack.Screen name="reading" options={{ title: '풀이' }} />
        <Stack.Screen name="timeline" options={{ title: '인생 타임라인' }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
        <Stack.Screen name="compat" options={{ title: '1:1 궁합' }} />
        <Stack.Screen name="taro" options={{ title: '타로' }} />
        <Stack.Screen name="today" options={{ title: '오늘의 운세' }} />
        <Stack.Screen name="month" options={{ title: '이달의 운세' }} />
        <Stack.Screen name="charts" options={{ title: '만세력' }} />
        <Stack.Screen name="traits" options={{ title: '나의 특징' }} />
        <Stack.Screen name="dayPillar" options={{ title: '일주론' }} />
        <Stack.Screen name="pet" options={{ title: '나의 반려동물' }} />
        <Stack.Screen name="love" options={{ title: '나의 애정흐름' }} />
        <Stack.Screen name="premium" options={{ title: '프리미엄' }} />
        <Stack.Screen name="market" options={{ title: '마켓' }} />
        <Stack.Screen name="admin" options={{ title: '관리자' }} />
      </Stack>
      {/* 무료=하단 배너 고정 / 프리미엄=숨김 (AdBanner 내부에서 isPremium 분기) */}
      <AdBanner />
      {/* 하단 탭 네비(홈/마켓) — 모든 화면 최하단 고정 */}
      <BottomNav />
    </View>
  );
}
