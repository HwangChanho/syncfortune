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
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { PressableScale } from '../components/PressableScale';
import Svg, { Path } from 'react-native-svg'; // 애플 로고(글리프 U+F8FF 미전송·미렌더 이슈 → SVG로 안정 렌더)
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Image as ExpoImage } from 'expo-image';
import { brandMarkSolid } from '../lib/ui/brandAsset';   // 시안 p02 「운」 심볼
import { isAnonSession } from '../lib/useAuth'; // 익명 세션 판정 — 로그인 시 linkIdentity(승격·데이터 보존) vs signInWithOAuth 분기(Apple 5.1.1)
import { logEvent } from '../lib/backend/logger'; // ★로그인 진단(daniel 07-11: OAuth 버튼 무반응 원인 로그)
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useWideWeb } from '../components/WebShell'; // ★넓은 웹 판정 한 곳 — 화면이 직접 Platform·픽셀을 보지 않게

// ★크래시 근본수정(daniel 07-04): expo-web-browser 네이티브 모듈이 빌드에 링크 안 되면(Podfile.lock 누락) 정적 import·
//   모듈로드 호출이 화면 진입(로그아웃→AuthScreen)·로그인 탭에서 즉시 크래시("Cannot find native module 'ExpoWebBrowser'").
//   → lazy require + guard(런치크래시 교훈: 전역 네이티브 정적 import 금지). 모듈 없으면 null → Linking 폴백(브라우저
//   자동닫힘만 없고, 로그인 콜백(딥링크)은 auth-callback 라우트가 exchangeCodeForSession/verifyOtp 로 처리한다).
function webBrowser(): any | null { try { return require('expo-web-browser'); } catch { return null; } }
try { webBrowser()?.maybeCompleteAuthSession(); } catch { /* 네이티브 모듈 없으면 무시 */ }

/**
 * 소셜 로그인 복귀 주소.
 * · 네이티브 = `syncfortune://auth-callback` (딥링크)
 * · **웹** = `<현재 오리진>/auth-callback` — 웹엔 딥링크가 없다. 브라우저가 그 주소로 되돌아오고
 *   `app/auth-callback.tsx` 가 `?code=` 를 받아 세션을 확립한다(그 라우트는 이미 쿼리로 동작한다).
 * ⚠️이 주소는 **Supabase Auth 의 Redirect URLs** 와 각 소셜 콘솔에 **등록돼 있어야** 한다.
 *   등록 안 된 주소로 오면 provider 가 그 자리에서 막는다(코드로는 못 뚫는다).
 */
function authRedirectUrl(): string {
  if (Platform.OS === 'web') return `${window.location.origin}/auth-callback`;
  return Linking.createURL('auth-callback');
}

// 인증 세션 복귀 URL(syncfortune://auth-callback?code=… / ?token_hash=&type=) → 세션 확립.
//   openAuthSessionAsync 가 리다이렉트를 가로채 브라우저를 닫으므로, 콜백 라우트 대신 여기서 직접 처리한다.
async function completeAuthFromUrl(url: string): Promise<{ error: any } | undefined> {
  const { queryParams } = Linking.parse(url);
  const code = queryParams?.code, th = queryParams?.token_hash, ty = queryParams?.type;
  // ★에러를 반환(옛 코드는 무시) — 익명 linkIdentity 콜백에서 '이미 가입된 소셜' 실패를 호출부가 감지해 전환(signInWithOAuth) 처리하게.
  if (typeof code === 'string') { const { error } = await supabase.auth.exchangeCodeForSession(code); return error ? { error } : undefined; }                   // 구글·애플(PKCE)
  if (typeof th === 'string' && typeof ty === 'string') { const { error } = await supabase.auth.verifyOtp({ token_hash: th, type: ty as any }); return error ? { error } : undefined; } // 네이버(매직링크)
  // ★★근본원인(daniel 07-11 진단 확정): 익명 세션에 '이미 다른 계정에 연결된 소셜'을 link 시도하면 Supabase 는 콜백 URL 에 code 없이
  //   ?error=/?error_description= 로 실패를 실어 보낸다. 위 code/token_hash 분기를 전부 건너뛰고 옛 코드는 여기서 그냥 undefined 를 반환 →
  //   호출부가 '성공도 실패도 아님'으로 오인해 조용히 로그인 화면으로 복귀(=OAuth 무반응 버그). → error 파라미터를 {error}로 전파해 signin 폴백을 태운다.
  const ep = queryParams?.error_description ?? queryParams?.error_code ?? queryParams?.error;
  const em = Array.isArray(ep) ? ep[0] : ep;
  if (typeof em === 'string' && em) return { error: { message: em } };
  return undefined;
}

export function AuthScreen() {
  const { t } = useTranslation();
  const wide = useWideWeb();   // 넓은 웹(≥900px) — 카드 레이아웃 · 부제/안내 노출. 네이티브는 항상 false.
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
  // OAuth 1스텝 실행 — mode='link'(익명 승격·같은 uid) 또는 'signin'(신규/전환). URL 받아 인앱 세션으로 열고 콜백 처리.
  //   반환: 콜백 에러(있으면). 인앱 세션(ASWebAuthenticationSession)은 리다이렉트 시 브라우저 자동 닫힘.
  async function runOAuth(provider: 'google' | 'apple', mode: 'link' | 'signin', redirectTo: string): Promise<{ error: any } | undefined> {
    // ★웹 = **페이지를 통째로 넘긴다**(2026-08-15 웹 전환).
    //   네이티브 흐름은 `skipBrowserRedirect` + 인앱 브라우저 세션인데, 웹에서 그건 팝업이라
    //   팝업 차단에 그대로 막힌다. 웹의 표준은 리다이렉트이고, 돌아오는 주소는 `/auth-callback` 이다.
    if (Platform.OS === 'web') {
      const { error } = mode === 'link'
        ? await supabase.auth.linkIdentity({ provider, options: { redirectTo } })
        : await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      // 성공하면 이 줄 다음은 실행되지 않는다(브라우저가 이미 떠났다).
      return error ? { error } : undefined;
    }
    const { data, error } = mode === 'link'
      ? await supabase.auth.linkIdentity({ provider, options: { redirectTo, skipBrowserRedirect: true } }) // 익명 세션에 소셜 연결(같은 uid·데이터 보존)
      : await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
    logEvent('diag_oauth_call', { provider, mode, hasUrl: !!data?.url, err: error ? String(error.message ?? error.code ?? error) : null }); // ★진단: linkIdentity/signin 응답
    if (error) return { error };
    if (!data?.url) return { error: { message: t('common.error') } };
    const WB = webBrowser();
    logEvent('diag_oauth_wb', { hasWB: !!WB }); // ★진단: expo-web-browser 네이티브 모듈 존재 여부(없으면 Linking 폴백)
    if (!WB) { await Linking.openURL(data.url); return undefined; } // 폴백: 네이티브 모듈 없으면 외부 브라우저 · 콜백 딥링크는 auth-callback 라우트가 처리
    const res = await WB.openAuthSessionAsync(data.url, redirectTo);
    logEvent('diag_oauth_result', { resType: res?.type ?? 'null' }); // ★진단: 인앱 세션 결과(success/cancel/dismiss)
    if (res.type === 'success' && res.url) return await completeAuthFromUrl(res.url); // 성공 시 useAuth 가 자동 분기
    return undefined; // 취소 등
  }

  // 구글·애플 로그인 — ★익명 세션이면 먼저 linkIdentity(같은 uid 로 승격 = 익명 때 산 이용권·명식 보존, daniel 2026-07-08 Apple 5.1.1).
  //   이미 그 소셜로 가입된 계정이면(Case B) 링크가 실패 → signInWithOAuth 로 전환(그 기존 계정으로 로그인). 등록 세션이면 바로 signin.
  async function signInWithOAuth(provider: 'google' | 'apple') {
    setLoading(true);
    const redirectTo = authRedirectUrl(); // 네이티브=딥링크 · 웹=<오리진>/auth-callback
    logEvent('diag_oauth_start', { provider, isAnon: isAnonSession(), redirectTo }); // ★진단: 버튼 탭 진입(무반응이면 이 로그부터 없을 것)
    try {
      // ★항상 signin(구글/애플 계정 선택창 1회 — daniel 07-11 버그: 창이 두 번 떴다).
      //   과거엔 익명 세션이면 linkIdentity(익명→등록 승격) 먼저 시도했으나, 그 소셜이 이미 다른 계정에 연결돼 있으면
      //   (=대부분의 복귀 유저) link 실패 → signin 폴백으로 브라우저(계정 선택창)가 '두 번' 떴다. signin 단독이면
      //   기존 계정으로 곧바로 단일 창 로그인. ※익명 세션의 로컬 명식은 로그인 시 migrateLocalCreditsOnLogin·명식 동기화로 이관(_layout).
      const r = await runOAuth(provider, 'signin', redirectTo);
      if (r?.error) Alert.alert('!', r.error.message ?? String(r.error));
    } catch (e) { Alert.alert('!', (e as Error).message); }
    finally { setLoading(false); }
  }

  // 네이버 — Supabase 미지원 프로바이더라 커스텀 Edge(naver-auth)가 OAuth 를 오케스트레이션한다.
  //   앱은 Edge 진입 URL 만 연다 → Edge: 네이버 인증 → 프로필 → Supabase 유저 → 매직링크 토큰 →
  //   syncfortune://auth-callback?token_hash=&type=magiclink 로 복귀 → 성공 시 completeAuthFromUrl 이(폴백 딥링크는 auth-callback 라우트가) verifyOtp 로 세션 확립.
  async function signInWithNaver() {
    setLoading(true); // 외부 브라우저 전환까지 버튼 비활성(중복 탭 방지)
    try {
      const appRedirect = authRedirectUrl();                                 // 네이티브=딥링크 · 웹=<오리진>/auth-callback
      const fnBase = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
      if (!fnBase) { Alert.alert('!', t('common.error')); return; }
      // 인앱 인증 세션 — 네이버 로그인·매직링크 복귀 시 브라우저 자동 닫힘(외부 탭 잔류 X).
      const naverUrl = `${fnBase}/functions/v1/naver-auth?app_redirect=${encodeURIComponent(appRedirect)}`;
      // 웹 = 같은 창에서 이동(팝업 아님). 복귀는 `/auth-callback` 이 받는다.
      if (Platform.OS === 'web') { window.location.assign(naverUrl); return; }
      const WB = webBrowser();
      if (WB) {
        const res = await WB.openAuthSessionAsync(naverUrl, appRedirect);
        const nerr = res.type === 'success' && res.url ? await completeAuthFromUrl(res.url) : undefined; // ★네이버 콜백 에러도 표면화(무반응 방지·구글과 동일 클래스)
        if (nerr?.error) Alert.alert('!', nerr.error.message ?? String(nerr.error));
      } else {
        await Linking.openURL(naverUrl); // 폴백: 네이티브 모듈 없으면 외부 브라우저·콜백 딥링크는 auth-callback 라우트가 처리
      }
    } catch (e) { Alert.alert('!', (e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    // ★KeyboardAvoidingView: wrap 이 세로 중앙 정렬(justifyContent:'center')이라 키보드가 올라오면
    //   심사용 히든 로그인(이메일·비번) 입력창이 정확히 덮인다. 리뷰어가 로그인 못 하면 심사 반려로 이어지는 자리라
    //   반드시 회피한다. 이 화면은 전역 BottomNav 밖(로그인)이라 표준 KAV 가 정상 동작한다.
    //   (daniel 07-18 표준 · check:keyboard 가 강제)
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
     {/*
       ★로그인 카드 — 넓은 웹에서만 '카드'가 된다(daniel 2026-08-16 *"sns 로그인 나와있는뷰 너무 옆으로만 길어 웹기준"*).
         이 라우트(`/login`)는 `WebShell` **밖**이라(로그인 전이라 사이드바가 없다) 폭을 잡아 주는 것이 없었다 —
         1512px 화면에서 버튼 세 개가 화면 끝까지 늘어났다.
       ⚠️네이티브에 영향이 가지 않게 오버라이드는 **wide 일 때만 객체를 만든다.**
         `webCard={...}` 를 항상 넘기고 값만 undefined 로 두면 RN 이 기본 스타일을 덮어 버린다
         (관계지도 `aspectRatio: undefined` 로 한 번 당한 자리 · [[duplicate-ui-single-source]]).
     */}
     <View style={wide ? [styles.card, styles.cardWeb] : styles.card}>
      {/* ★로고 + 타이틀을 **한 Pressable 안에** 둔다 — 롱프레스(0.8s)가 심사용 히든 로그인의
          유일한 진입로다(SNS 전용 앱이라 리뷰어가 데모계정으로 들어올 길이 이것뿐 · daniel 07-07).
          ⚠️타이틀을 이미지로 갈아 끼우면서 제스처를 잃으면 **또 리젝**된다 — `check:reviewlogin` 이 막는다.
          시안 p02 는 「운」 심볼 + 워드마크 2단이라, 심볼을 글자 위에 얹고 글자는 그대로 뒀다
          (이미지가 안 떠도 글자와 제스처는 남는다). */}
      <Pressable onLongPress={() => setReviewMode(true)} delayLongPress={800}>
        <ExpoImage source={brandMarkSolid()} style={styles.mark} contentFit="contain" transition={200} />
        <Text style={styles.title}>{t('appName')}</Text>
      </Pressable>
      <View style={styles.divider} />
      {/* 부제 — 웹에서만. 앱은 스플래시·홈이 이미 같은 말을 해서 로그인에서 반복하지 않는다 */}
      {wide ? <Text style={styles.sub}>{t('auth.subtitle')}</Text> : null}

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
        <Svg width={16} height={19} viewBox="0 0 24 24" style={{ marginTop: -2 }}><Path fill="#fff" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 8.02 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.51 4.08l.01-.02zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></Svg>
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

      {/* 왜 로그인하는지 한 줄 — 웹은 '선택 로그인'이라는 게 앱보다 덜 분명하다 */}
      {wide ? <Text style={styles.note}>{t('auth.note')}</Text> : null}

      {/* ★대화 저장 고지(Boss 2026-08-26 *"대화가 저장되지 않는다는걸 유저가 알수있게해
          회원가입때나. 저장은 돼도 따로 사용되지 않는다고"*).
          ⚠️«저장되지 않는다»고 쓰지 않았다 — **실제로는 저장된다**(이어보기·대화 정리가 그 위에 산다).
            거짓 고지는 없는 기능보다 나쁘다. 대신 **저장되지만 다른 데 쓰지 않는다**를 적는다.
          ★적힌 셋은 전부 실측으로 확인했다:
            · AI 학습에 안 쓴다  · 남이 못 본다(RLS — anon 키로 조회하니 빈 배열)
            · 언제든 지운다(대화창 「지우기」 — 세션과 함께 cascade 로 사라진다) */}
      <Text style={styles.privacy}>{t('auth.privacyTalk')}</Text>
     </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: space(7), backgroundColor: colors.bg },
  /** 카드 껍데기 — 네이티브에선 아무 일도 하지 않는다(폭 100%). 웹에서만 `cardWeb` 이 얹힌다. */
  card: { width: '100%' },
  /**
   * 넓은 웹의 로그인 카드.
   * ★420px 은 로그인 폼의 통상 폭이다. 우리 폼 폭 토큰(`WEB_FORM`=560)보다 좁게 잡은 이유는
   *   이 화면엔 입력이 없고 **버튼 세 개**뿐이라, 560 이면 버튼이 다시 '옆으로 긴' 막대가 되기 때문이다.
   */
  cardWeb: {
    maxWidth: 420, alignSelf: 'center',
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: space(8), paddingTop: space(9), paddingBottom: space(8), ...shadow.card,
  },
  // 심볼 — 글자 위 여백은 두되 카드가 길어지지 않게(로그인은 한 화면에 들어와야 한다)
  // ★배경이 있는 판이라 모서리를 굴린다 — 안 굴리면 각진 사각형이 화면에 떠 보인다
  mark: { width: 64, height: 64, borderRadius: 14, alignSelf: 'center', marginBottom: space(2) },
  title: { ...font.display, textAlign: 'center' },
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.ju, alignSelf: 'center', marginTop: space(3) },
  sub: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(4), marginBottom: space(2) },
  /** 카드 맨 아래 안내 — 작고 낮은 대비(버튼이 주인공이다). */
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(5), lineHeight: 18 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    padding: space(3.5), fontSize: 15, color: colors.ink, marginTop: space(3), ...shadow.soft,
  },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(4), alignItems: 'center', marginTop: space(5), ...shadow.card },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  // 대화 저장 고지 — 작게, 그러나 로그인 화면에 **반드시** 보이게
  privacy: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 17, marginTop: space(4) },
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
