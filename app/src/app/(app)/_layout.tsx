// src/app/(app)/_layout.tsx — 인증 영역 레이아웃 + 하단 배너 광고(무료)
// ─────────────────────────────────────────────────────────────────────────
// 로그인 게이트 없음(ADR-037) — 명식·궁합은 온디바이스 무료(규칙5).
// 무료 사용자 = 하단 AdBanner 고정 / 프리미엄(구독) = 광고 없음(ADR-043).
// ─────────────────────────────────────────────────────────────────────────
import { Stack, useRouter } from 'expo-router';
import { View, Pressable, Text } from 'react-native';
import { useFontScale } from '../../lib/fontScale';
import { AdBanner } from '../../components/AdBanner';
import { BottomNav } from '../../components/BottomNav';
import { OfflineBanner } from '../../components/OfflineBanner';
import { colors } from '../../lib/theme';

// deep link 로 하위 화면(register 등)에 직접 진입해도 index(홈)를 스택 최하단에 깔아
//   헤더 뒤로가기를 항상 보장한다(정상 네비·딥링크 무관).
export const unstable_settings = { initialRouteName: 'index' };

export default function AppLayout() {
  const { fs } = useFontScale();   // 글자크기 설정 → 헤더 타이틀·뒤로버튼도 반응(daniel)
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.bg }, // 한지 헤더
        headerTintColor: colors.ink,                 // 먹 — 뒤로가기·타이틀
        headerTitleStyle: { color: colors.ink, fontWeight: '700', fontSize: fs(17) }, // 글자크기 반응
        headerShadowVisible: false,                  // 한지 무드 — 헤더 그림자 제거
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg }, // 씬 배경 한지(전환 시 흰 깜빡임 방지)
        // 뒤로버튼도 글자크기에 따라 커지게 — 커스텀 chevron(루트는 canGoBack=false라 미표시)
        headerLeft: (p: any) => p?.canGoBack ? (
          <Pressable onPress={() => router.back()} hitSlop={16} style={{ paddingRight: 16, paddingVertical: 4 }}>
            <Text style={{ color: colors.ink, fontSize: fs(38), lineHeight: fs(40), marginTop: -3, fontWeight: '600' }}>‹</Text>
          </Pressable>
        ) : null,
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
        <Stack.Screen name="lifegraph" options={{ title: '인생 그래프' }} />
        <Stack.Screen name="newyear" options={{ title: '신년운세' }} />
        <Stack.Screen name="roots" options={{ title: '명식의 뿌리' }} />
        <Stack.Screen name="image" options={{ title: '비치는 나' }} />
        <Stack.Screen name="mission" options={{ title: '나의 사명' }} />
        <Stack.Screen name="persona" options={{ title: '성격유형' }} />
        <Stack.Screen name="egenteto" options={{ title: '에겐·테토' }} />
        <Stack.Screen name="joseonjob" options={{ title: '조선시대 직업' }} />
        <Stack.Screen name="lovestyle" options={{ title: '연애 스타일' }} />
        <Stack.Screen name="bok" options={{ title: '타고난 복' }} />
        <Stack.Screen name="pastlife" options={{ title: '전생 이야기' }} />
        <Stack.Screen name="healing" options={{ title: '나만의 힐링 방법' }} />
        <Stack.Screen name="taegil" options={{ title: '택일' }} />
        <Stack.Screen name="luck" options={{ title: '오늘의 행운' }} />
        <Stack.Screen name="zodiac" options={{ title: '띠·별자리' }} />
        <Stack.Screen name="name" options={{ title: '이름풀이' }} />
        <Stack.Screen name="dream" options={{ title: '꿈해몽' }} />
        <Stack.Screen name="premium" options={{ title: '프리미엄' }} />
        <Stack.Screen name="market" options={{ title: '마켓' }} />
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
