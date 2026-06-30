// app/src/screens/AuthScreen.tsx — 로그인·회원가입 (이메일+비번, 다국어, 한지·먹 테마, S6)
// ─────────────────────────────────────────────────────────────────────────
// P0 인증 = Supabase Auth 이메일+비밀번호 + 구글 OAuth(PKCE). 세션은 SecureStore(ADR-032). 문자열은 i18n(한·영·일).
// 성공 시 onAuthStateChange(useAuth)가 분기를 자동 전환(단일 진실원천=세션). 네비 직접 호출 안 함.
// 구글: signInWithOAuth({skipBrowserRedirect}) 로 인증 URL 받아 Linking.openURL → 외부 브라우저 로그인 →
//   syncfortune://auth-callback?code= 로 복귀 → useAuth 의 url 리스너가 exchangeCodeForSession 처리.
// ※ 애플 OAuth 는 스토어 심사 전 추가(애플은 타 소셜 있으면 Sign in with Apple 필수).
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Alert } from '../lib/alert'; // 커스텀 알림(앱 디자인)
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { colors, radius, space, shadow, font } from '../lib/theme';

export function AuthScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 이메일 로그인(로그인 전용 — 회원가입은 따로 두지 않음, 신규 계정은 소셜 로그인으로. daniel)
  async function submit() {
    if (!email || !password) {
      Alert.alert(t('auth.needInput'), '');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { Alert.alert('!', error.message); return; }
  }

  // 공용 OAuth(구글·애플) — Supabase 네이티브 프로바이더. 인증 URL 을 받아 외부 브라우저로 열고,
  //   복귀(deep-link: ?code=)는 useAuth 가 exchangeCodeForSession 으로 처리.
  async function signInWithOAuth(provider: 'google' | 'apple') {
    setLoading(true);
    const redirectTo = Linking.createURL('auth-callback'); // syncfortune://auth-callback
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true }, // URL 만 받아 직접 연다(웹 자동리다이렉트 억제)
    });
    setLoading(false);
    if (error) { Alert.alert('!', error.message); return; }
    if (data?.url) await Linking.openURL(data.url);
  }

  // 네이버 — Supabase 미지원 프로바이더라 커스텀 Edge(naver-auth)가 OAuth 를 오케스트레이션한다.
  //   앱은 Edge 진입 URL 만 연다 → Edge: 네이버 인증 → 프로필 → Supabase 유저 → 매직링크 토큰 →
  //   syncfortune://auth-callback?token_hash=&type=magiclink 로 복귀 → useAuth 가 verifyOtp 로 세션 확립.
  async function signInWithNaver() {
    setLoading(true); // 외부 브라우저 전환까지 버튼 비활성(중복 탭 방지)
    try {
      const appRedirect = Linking.createURL('auth-callback');               // syncfortune://auth-callback
      const fnBase = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
      if (!fnBase) { Alert.alert('!', t('common.error')); return; }
      await Linking.openURL(`${fnBase}/functions/v1/naver-auth?app_redirect=${encodeURIComponent(appRedirect)}`);
    } catch (e) { Alert.alert('!', (e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('appName')}</Text>
      <View style={styles.divider} />

      {/* ★이메일/비번 로그인 제거 — SNS 로그인만(daniel). 신규·기존 모두 소셜로. */}
      {loading ? <ActivityIndicator color={colors.ju} style={{ marginVertical: space(3) }} /> : null}

      {/* 소셜 로그인 — 애플·구글·네이버 (각 브랜드 색) */}
      <Pressable style={[styles.appleBtn, loading && styles.btnDisabled]} onPress={() => signInWithOAuth('apple')} disabled={loading}>
        <Text style={styles.appleLogo}></Text>
        <Text style={styles.appleText}>{t('auth.apple')}</Text>
      </Pressable>

      <Pressable style={[styles.googleBtn, loading && styles.btnDisabled]} onPress={() => signInWithOAuth('google')} disabled={loading}>
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.googleText}>{t('auth.google')}</Text>
      </Pressable>

      <Pressable style={[styles.naverBtn, loading && styles.btnDisabled]} onPress={signInWithNaver} disabled={loading}>
        <Text style={styles.naverN}>N</Text>
        <Text style={styles.naverText}>{t('auth.naver')}</Text>
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
  // 애플 — 검정 배경(애플 브랜드 가이드)
  appleBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space(2.5),
    backgroundColor: '#000', borderRadius: radius.md, padding: space(4), marginTop: space(3), ...shadow.card,
  },
  appleLogo: { color: '#fff', fontSize: 18, marginTop: -2 }, // Apple 로고 글리프
  appleText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // 네이버 — 브랜드 그린(#03C75A) 배경, 흰 N
  naverBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space(2.5),
    backgroundColor: '#03C75A', borderRadius: radius.md, padding: space(4), marginTop: space(3), ...shadow.card,
  },
  naverN: { color: '#fff', fontSize: 18, fontWeight: '900' },
  naverText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
