// src/app/_layout.tsx — Expo Router 루트 레이아웃 (멀티플랫폼 엔트리, ADR-036)
// ─────────────────────────────────────────────────────────────────────────
// 파일기반 라우팅의 최상위. 인증 세션을 복원하는 동안 스플래시를 띄우고,
// 실제 세션 가드는 (app)/_layout 에서 처리한다(미인증 시 /login 리다이렉트).
// native = 스택 내비 / web = URL 라우팅 으로 같은 트리가 양쪽에서 동작한다.
// ─────────────────────────────────────────────────────────────────────────
import 'intl-pluralrules'; // Intl.PluralRules polyfill (Hermes) — iztro i18next 보조(ERROR 폴백, 무해)
import '../lib/i18n'; // 다국어(한·영·일) init
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { useAuth } from '../lib/useAuth';
import { configurePurchases } from '../lib/purchases'; // 인앱결제(RevenueCat) 초기화
import { FontScaleProvider } from '../lib/fontScale'; // 전역 글자 크기(설정에서 조절)
import { colors } from '../lib/theme';

// i18next 26.x가 Hermes에서 Intl.PluralRules 를 인식 못 해 내는 dev 경고(동작은 v3 fallback 정상,
//   한·영·일 복수형 단순해 영향 0) 억제. 프로덕션 빌드엔 LogBox 자체가 없어 무영향.
LogBox.ignoreLogs([/i18next::pluralResolver/]);

export default function RootLayout() {
  const { session, loading } = useAuth();

  // 인앱결제 초기화 — 키 미설정 시 no-op. 로그인 시 RC 유저(appUserID=Supabase user.id) 연결.
  useEffect(() => { configurePurchases(session?.user?.id); }, [session?.user?.id]);

  // 저장된 세션 복원 중 — 스플래시(라우트 깜빡임 방지)
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ju} />
      </View>
    );
  }

  // 최상위 두 영역: login(미인증) · (app)(인증). 헤더는 각 하위에서 제어.
  //   FontScaleProvider 로 전역 글자 배율 제공(통변 등 본문 가독성, 설정에서 조절).
  return (
    <FontScaleProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="(app)" />
      </Stack>
    </FontScaleProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
});
