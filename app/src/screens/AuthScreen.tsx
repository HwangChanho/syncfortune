// app/src/screens/AuthScreen.tsx — 로그인·회원가입 (이메일+비번, 다국어, 한지·먹 테마, S6)
// ─────────────────────────────────────────────────────────────────────────
// P0 인증 = Supabase Auth 이메일+비밀번호. 세션은 SecureStore(ADR-032). 문자열은 i18n(한·영·일).
// 성공 시 onAuthStateChange(useAuth)가 분기를 자동 전환(단일 진실원천=세션). 네비 직접 호출 안 함.
// ※ 애플/구글 OAuth 는 스토어 심사 전 추가(애플은 타 소셜 있으면 Sign in with Apple 필수).
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { colors, radius, space, shadow, font } from '../lib/theme';

export function AuthScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin'); // 로그인/가입 토글
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email || !password) {
      Alert.alert(t('auth.needInput'), '');
      return;
    }
    setLoading(true);
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('!', error.message);
      return;
    }
    if (mode === 'signup') {
      Alert.alert(t('auth.signupTitle'), t('auth.signupDone'));
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('appName')}</Text>
      <View style={styles.divider} />
      <Text style={styles.sub}>{mode === 'signin' ? t('auth.signin') : t('auth.signupTitle')}</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.email')}
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.password')}
        placeholderTextColor={colors.inkFaint}
        secureTextEntry
      />

      <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.btnText}>{mode === 'signin' ? t('auth.signin') : t('common.signup')}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        <Text style={styles.toggle}>{mode === 'signin' ? t('auth.toSignup') : t('auth.toSignin')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: space(7), backgroundColor: colors.bg },
  title: { ...font.display, textAlign: 'center' },
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.ju, alignSelf: 'center', marginTop: space(3) },
  sub: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(3), marginBottom: space(7) },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    padding: space(3.5), fontSize: 15, color: colors.ink, marginTop: space(3), ...shadow.soft,
  },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(4), alignItems: 'center', marginTop: space(5), ...shadow.card },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  toggle: { color: colors.ju, textAlign: 'center', marginTop: space(4.5), fontSize: 14 },
});
