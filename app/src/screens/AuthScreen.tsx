// app/src/screens/AuthScreen.tsx — 로그인·회원가입 (이메일+비번, 다국어, 한지·먹 테마, S6)
// ─────────────────────────────────────────────────────────────────────────
// P0 인증 = Supabase Auth 이메일+비밀번호 + 구글 OAuth(PKCE). 세션은 SecureStore(ADR-032). 문자열은 i18n(한·영·일).
// 성공 시 onAuthStateChange(useAuth)가 분기를 자동 전환(단일 진실원천=세션). 네비 직접 호출 안 함.
// 구글: signInWithOAuth({skipBrowserRedirect}) 로 인증 URL 받아 Linking.openURL → 외부 브라우저 로그인 →
//   syncfortune://auth-callback?code= 로 복귀 → useAuth 의 url 리스너가 exchangeCodeForSession 처리.
// ※ 애플 OAuth 는 스토어 심사 전 추가(애플은 타 소셜 있으면 Sign in with Apple 필수).
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
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

  // 구글 OAuth — 인증 URL 을 받아 외부 브라우저로 열고, 복귀(deep-link)는 useAuth 가 처리.
  async function signInWithGoogle() {
    setLoading(true);
    const redirectTo = Linking.createURL('auth-callback'); // syncfortune://auth-callback
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true }, // URL 만 받아 직접 연다(웹 자동리다이렉트 억제)
    });
    setLoading(false);
    if (error) { Alert.alert('!', error.message); return; }
    if (data?.url) await Linking.openURL(data.url);
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

      {/* 구분선 (또는) */}
      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>{t('auth.or')}</Text>
        <View style={styles.orLine} />
      </View>

      {/* 구글 로그인 — 흰 배경·구글 가이드라인 색(이메일 버튼과 시각 구분) */}
      <Pressable style={[styles.googleBtn, loading && styles.btnDisabled]} onPress={signInWithGoogle} disabled={loading}>
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.googleText}>{t('auth.google')}</Text>
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
  // 구분선 (또는)
  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(6), marginBottom: space(1) },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  orText: { ...font.caption, color: colors.inkFaint, marginHorizontal: space(3) },
  // 구글 버튼 — 흰 배경(구글 브랜드 가이드), 이메일 버튼과 색 대비
  googleBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space(2.5),
    backgroundColor: colors.white, borderRadius: radius.md, padding: space(4), marginTop: space(3), ...shadow.card,
  },
  googleG: { color: '#4285F4', fontSize: 18, fontWeight: '800' }, // 구글 블루 G
  googleText: { color: '#1F1F1F', fontSize: 16, fontWeight: '700' },
});
