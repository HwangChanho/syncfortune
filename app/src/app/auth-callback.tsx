// src/app/auth-callback.tsx — 소셜 로그인 복귀 처리 라우트 (syncfortune://auth-callback)
// ─────────────────────────────────────────────────────────────────────────
// 구글·애플(?code=) = exchangeCodeForSession / 네이버(?token_hash=&type=) = verifyOtp.
//   토큰 처리하는 동안 로딩 화면 → 끝나면 홈으로(세션 확립 시 (app) 진입). 라우트가 없으면
//   Expo Router가 "Unmatched Route" 를 띄우므로 이 화면이 그 진입점이 된다.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Alert } from '../lib/ui/alert';                 // 커스텀 알림(앱 디자인 · 웹에서도 동작)
import { logEvent } from '../lib/backend/logger';        // ★실패 원인을 서버에 남긴다(웹은 콘솔을 못 본다)
import { colors, space, font } from '../lib/theme';

export default function AuthCallback() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    code?: string; token_hash?: string; type?: string;
    error?: string; error_code?: string; error_description?: string;
  }>();
  const done = useRef(false); // 중복 처리 방지(리렌더)

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      // ★★2026-08-16 근본수정(daniel *"웹 로그인은 여전히 안되고"*)
      //   옛 코드는 `catch {}` 로 **모든 실패를 삼키고** 곧장 홈으로 보냈다. `exchangeCodeForSession` 의
      //   `error` 반환값도 보지 않았다. 그래서 실패해도 사용자는 로그인 화면으로 조용히 돌아올 뿐이고,
      //   개발자도 **원인을 볼 방법이 없었다** — "그냥 안 된다"만 남는다.
      //   ⇒ ① 공급자가 실어 보낸 에러도 읽고 ② 교환 결과의 error 를 확인하고 ③ 서버 로그에 남기고
      //     ④ 사용자에게 한 줄 알린다. 실패해도 홈으로 보내는 것은 그대로(미인증이면 가드가 처리).
      const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
      let failure: string | null = null;
      let stage = 'none';   // 어느 단계에서 죽었는지 — 로그로 남긴다(코드 없음 / 교환 실패 / 예외)

      // ① 공급자·Supabase 가 code 대신 error 를 실어 보낸 경우(허용목록 밖 redirect·동의 거부 등)
      const provErr = one(params.error_description) ?? one(params.error_code) ?? one(params.error);

      try {
        if (provErr) {
          stage = 'provider'; failure = provErr;
        } else if (typeof params.code === 'string') {
          stage = 'pkce';
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);        // 구글·애플(PKCE)
          if (error) failure = error.message ?? String(error);
        } else if (typeof params.token_hash === 'string' && typeof params.type === 'string') {
          stage = 'otp';
          const { error } = await supabase.auth.verifyOtp({ token_hash: params.token_hash, type: params.type as any }); // 네이버(매직링크)
          if (error) failure = error.message ?? String(error);
        } else {
          // 코드도 토큰도 에러도 없이 도착 = 복귀 주소는 맞는데 파라미터가 유실된 것(라우팅·리다이렉트 설정 의심)
          stage = 'empty'; failure = 'no code/token in callback';
        }
      } catch (e) {
        failure = (e as Error).message ?? 'exchange threw';
      }

      // ③ 서버 로그 — 웹은 콘솔을 볼 수 없는 사용자가 대부분이라 여기서만 원인이 남는다
      logEvent(failure ? 'auth_callback_fail' : 'auth_callback_ok', {
        stage,
        err: failure,
        hasCode: typeof params.code === 'string',
        hasToken: typeof params.token_hash === 'string',
        origin: Platform.OS === 'web' ? window.location.origin : 'native',
      });

      // ④ 사용자 통지 — 조용히 로그인 화면으로 되돌아가면 "눌러도 아무 일이 없다"로 읽힌다
      if (failure) Alert.alert(t('auth.failedTitle'), failure);

      router.replace('/');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.ju} />
      <Text style={styles.txt}>{t('auth.processing')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, gap: space(4) },
  txt: { ...font.body, color: colors.inkSoft },
});
