// src/app/auth-callback.tsx — 소셜 로그인 복귀 처리 라우트 (syncfortune://auth-callback)
// ─────────────────────────────────────────────────────────────────────────
// 구글·애플(?code=) = exchangeCodeForSession / 네이버(?token_hash=&type=) = verifyOtp.
//   토큰 처리하는 동안 로딩 화면 → 끝나면 홈으로(세션 확립 시 (app) 진입). 라우트가 없으면
//   Expo Router가 "Unmatched Route" 를 띄우므로 이 화면이 그 진입점이 된다.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { colors, space, font } from '../lib/theme';

export default function AuthCallback() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string; token_hash?: string; type?: string; error?: string }>();
  const done = useRef(false); // 중복 처리 방지(리렌더)

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      try {
        if (typeof params.code === 'string') {
          await supabase.auth.exchangeCodeForSession(params.code);        // 구글·애플(PKCE)
        } else if (typeof params.token_hash === 'string' && typeof params.type === 'string') {
          await supabase.auth.verifyOtp({ token_hash: params.token_hash, type: params.type as any }); // 네이버(매직링크)
        }
      } catch { /* 실패해도 홈으로 — 미인증이면 (app)/_layout 이 로그인으로 보냄 */ }
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
