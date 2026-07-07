// app/src/screens/AuthScreen.tsx — 로그인·회원가입 (이메일+비번, 다국어, 한지·먹 테마, S6)
// ─────────────────────────────────────────────────────────────────────────
// P0 인증 = Supabase Auth 이메일+비밀번호 + 구글 OAuth(PKCE). 세션은 SecureStore(ADR-032). 문자열은 i18n(한·영·일).
// 성공 시 onAuthStateChange(useAuth)가 분기를 자동 전환(단일 진실원천=세션). 네비 직접 호출 안 함.
// 구글: signInWithOAuth({skipBrowserRedirect}) 로 인증 URL 받아 openAuthSessionAsync(인앱 인증 세션)로 로그인 →
//   syncfortune://auth-callback?code= 로 복귀 → 성공 시 completeAuthFromUrl(아래)이 exchangeCodeForSession 처리
//   (WB 네이티브 모듈 없어 Linking 폴백일 땐 딥링크를 auth-callback 라우트가 처리 — useAuth 엔 url 리스너 없음).
// ※ 애플 OAuth 는 스토어 심사 전 추가(애플은 타 소셜 있으면 Sign in with Apple 필수).
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { PressableScale } from '../components/PressableScale';
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { colors, radius, space, shadow, font } from '../lib/theme';

// ★크래시 근본수정(daniel 07-04): expo-web-browser 네이티브 모듈이 빌드에 링크 안 되면(Podfile.lock 누락) 정적 import·
//   모듈로드 호출이 화면 진입(로그아웃→AuthScreen)·로그인 탭에서 즉시 크래시("Cannot find native module 'ExpoWebBrowser'").
//   → lazy require + guard(런치크래시 교훈: 전역 네이티브 정적 import 금지). 모듈 없으면 null → Linking 폴백(브라우저
//   자동닫힘만 없고, 로그인 콜백(딥링크)은 auth-callback 라우트가 exchangeCodeForSession/verifyOtp 로 처리한다).
function webBrowser(): any | null { try { return require('expo-web-browser'); } catch { return null; } }
try { webBrowser()?.maybeCompleteAuthSession(); } catch { /* 네이티브 모듈 없으면 무시 */ }

// 인증 세션 복귀 URL(syncfortune://auth-callback?code=… / ?token_hash=&type=) → 세션 확립.
//   openAuthSessionAsync 가 리다이렉트를 가로채 브라우저를 닫으므로, 콜백 라우트 대신 여기서 직접 처리한다.
async function completeAuthFromUrl(url: string): Promise<void> {
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code, th = queryParams?.token_hash, ty = queryParams?.type;
  if (typeof code === 'string') await supabase.auth.exchangeCodeForSession(code);                         // 구글·애플(PKCE)
  else if (typeof th === 'string' && typeof ty === 'string') await supabase.auth.verifyOtp({ token_hash: th, type: ty as any }); // 네이버(매직링크)
}

export function AuthScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewMode, setReviewMode] = useState(false); // ★심사용 히든 로그인(타이틀 롱프레스 0.8s) — SNS 전용이라 App Store 리뷰어 데모계정 접근 경로(daniel 07-07). 일반 유저엔 안 보임.

  // 이메일 로그인(심사용 히든 — reviewMode에서만 노출. 신규 계정은 소셜 로그인으로. daniel)
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

  // 공용 OAuth(구글·애플) — Supabase 네이티브 프로바이더. 인증 URL 을 받아 인앱 인증 세션으로 열고,
  //   복귀(?code=)는 성공 시 completeAuthFromUrl 이(WB 없는 폴백 딥링크는 auth-callback 라우트가) exchangeCodeForSession 으로 처리.
  async function signInWithOAuth(provider: 'google' | 'apple') {
    setLoading(true);
    const redirectTo = Linking.createURL('auth-callback'); // syncfortune://auth-callback
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true }, // URL 만 받아 직접 연다(웹 자동리다이렉트 억제)
    });
    if (error) { setLoading(false); Alert.alert('!', error.message); return; }
    // 인앱 인증 세션(ASWebAuthenticationSession) — 로그인 후 리다이렉트 시 브라우저가 자동으로 닫힌다(외부 탭 잔류 X).
    if (data?.url) {
      const WB = webBrowser();
      if (WB) {
        try {
          const res = await WB.openAuthSessionAsync(data.url, redirectTo);
          if (res.type === 'success' && res.url) await completeAuthFromUrl(res.url); // 세션 확립(성공 시 useAuth 가 자동 분기)
        } catch (e) { Alert.alert('!', (e as Error).message); }
      } else {
        await Linking.openURL(data.url); // 폴백: 네이티브 모듈 없으면 외부 브라우저(자동닫힘 X)·콜백 딥링크는 auth-callback 라우트가 처리
      }
    }
    setLoading(false);
  }

  // 네이버 — Supabase 미지원 프로바이더라 커스텀 Edge(naver-auth)가 OAuth 를 오케스트레이션한다.
  //   앱은 Edge 진입 URL 만 연다 → Edge: 네이버 인증 → 프로필 → Supabase 유저 → 매직링크 토큰 →
  //   syncfortune://auth-callback?token_hash=&type=magiclink 로 복귀 → 성공 시 completeAuthFromUrl 이(폴백 딥링크는 auth-callback 라우트가) verifyOtp 로 세션 확립.
  async function signInWithNaver() {
    setLoading(true); // 외부 브라우저 전환까지 버튼 비활성(중복 탭 방지)
    try {
      const appRedirect = Linking.createURL('auth-callback');               // syncfortune://auth-callback
      const fnBase = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
      if (!fnBase) { Alert.alert('!', t('common.error')); return; }
      // 인앱 인증 세션 — 네이버 로그인·매직링크 복귀 시 브라우저 자동 닫힘(외부 탭 잔류 X).
      const naverUrl = `${fnBase}/functions/v1/naver-auth?app_redirect=${encodeURIComponent(appRedirect)}`;
      const WB = webBrowser();
      if (WB) {
        const res = await WB.openAuthSessionAsync(naverUrl, appRedirect);
        if (res.type === 'success' && res.url) await completeAuthFromUrl(res.url);
      } else {
        await Linking.openURL(naverUrl); // 폴백: 네이티브 모듈 없으면 외부 브라우저·콜백 딥링크는 auth-callback 라우트가 처리
      }
    } catch (e) { Alert.alert('!', (e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <View style={styles.wrap}>
      {/* 타이틀 롱프레스(0.8s) = 심사용 히든 로그인 노출(App Store 리뷰어 전용 — SNS 전용 앱의 데모계정 접근, daniel 07-07) */}
      <Pressable onLongPress={() => setReviewMode(true)} delayLongPress={800}>
        <Text style={styles.title}>{t('appName')}</Text>
      </Pressable>
      <View style={styles.divider} />

      {/* ★이메일/비번 로그인 제거 — SNS 로그인만(daniel). 단 심사용 히든 로그인은 reviewMode(타이틀 롱프레스)에서만 노출. */}
      {reviewMode && (
        <View>
          <TextInput style={styles.input} placeholder="email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} placeholderTextColor={colors.inkFaint} />
          <TextInput style={styles.input} placeholder="password" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor={colors.inkFaint} />
          <PressableScale style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
            <Text style={styles.btnText}>{t('auth.login', '로그인')}</Text>
          </PressableScale>
        </View>
      )}
      {loading ? <ActivityIndicator color={colors.ju} style={{ marginVertical: space(3) }} /> : null}

      {/* 소셜 로그인 — 애플·구글·네이버 (각 브랜드 색) */}
      <PressableScale style={[styles.appleBtn, loading && styles.btnDisabled]} onPress={() => signInWithOAuth('apple')} disabled={loading}>
        <Text style={styles.appleLogo}></Text>
        <Text style={styles.appleText}>{t('auth.apple')}</Text>
      </PressableScale>

      <PressableScale style={[styles.googleBtn, loading && styles.btnDisabled]} onPress={() => signInWithOAuth('google')} disabled={loading}>
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.googleText}>{t('auth.google')}</Text>
      </PressableScale>

      <PressableScale style={[styles.naverBtn, loading && styles.btnDisabled]} onPress={signInWithNaver} disabled={loading}>
        <Text style={styles.naverN}>N</Text>
        <Text style={styles.naverText}>{t('auth.naver')}</Text>
      </PressableScale>
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
