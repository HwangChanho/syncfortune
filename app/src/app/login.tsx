// src/app/login.tsx — 로그인 라우트 (미인증 진입점, 다국어, 한지·먹 테마)
// ─────────────────────────────────────────────────────────────────────────
// AuthScreen + 상단 뒤로가기(선택 로그인이라 취소 가능). 로그인 성공 시 useAuth →
// (app)/_layout 가드가 본체 노출. 이미 로그인 상태면 홈으로.
// ─────────────────────────────────────────────────────────────────────────
import { Redirect, useRouter } from 'expo-router';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { PressableScale } from '../components/PressableScale';
import { useTranslation } from 'react-i18next';
import { AuthScreen } from '../screens/AuthScreen';
import { useAuth } from '../lib/useAuth';
import { colors, space } from '../lib/theme';

export default function Login() {
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  if (session) return <Redirect href="/(app)" />;

  return (
    <View style={styles.container}>
      {/* 선택 로그인이라 뒤로가기로 빠져나올 수 있어야 함 */}
      <PressableScale
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
        style={styles.back}
        hitSlop={8}
      >
        <Text style={styles.backText}>{t('common.back')}</Text>
      </PressableScale>
      <AuthScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  back: { paddingHorizontal: space(5), paddingTop: space(14), paddingBottom: space(1) },
  backText: { color: colors.ju, fontSize: 16, fontWeight: '600' },
});
