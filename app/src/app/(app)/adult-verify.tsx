// src/app/(app)/adult-verify.tsx — **본인인증에서 돌아오는 자리**(웹 전용 경로)
// ─────────────────────────────────────────────────────────────────────────
// ★2026-09-03 — 실제로 인증을 태워 보다 잡았다: 이 라우트가 **없어서 404**("Unmatched Route")였다.
//   폰은 `openAuthSessionAsync` 가 리다이렉트를 **가로채** 브라우저를 닫으므로 이 화면이 필요 없다.
//   웹은 같은 창에서 되돌아오므로 **받아 줄 자리가 있어야 한다**(로그인 콜백과 같은 사정).
//
// ■ 하는 일 — `imp_uid` 를 받아 서버에 넘기고, 끝나면 설정으로 돌려보낸다.
//   ⚠️여기서 **성인 여부를 판정하지 않는다** — 서버가 포트원에 직접 물어 정한다.
//   ⚠️`error` 로 돌아오면 그 사유를 그대로 보여 준다(«아무 일도 안 일어난 화면» 을 만들지 않는다).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { supabase } from '../../lib/supabase';
import { colors, space, font, radius } from '../../lib/theme';

export default function AdultVerifyReturn() {
  const { imp_uid: impUid, error } = useLocalSearchParams<{ imp_uid?: string; error?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (error) { setMsg(String(error)); return; }
    if (!impUid) { setMsg(t('adult.noResult', '인증 결과를 받지 못했어요.')); return; }
    let alive = true;
    void supabase.functions.invoke('adult-verify', { body: { impUid: String(impUid) } })
      .then(({ data, error: e }) => {
        if (!alive) return;
        const ok = !e && (data as { ok?: boolean } | null)?.ok === true;
        setMsg(ok
          ? t('adult.done', '본인인증이 끝났어요. 이제 성인 대화를 켤 수 있어요.')
          : t('adult.failed', '본인인증을 마치지 못했어요. 다시 시도해 주세요.'));
      });
    return () => { alive = false; };
  }, [impUid, error, t]);

  return (
    <View style={s.wrap}>
      {msg === null ? <ActivityIndicator color={colors.ju} /> : <Text style={s.msg}>{msg}</Text>}
      {msg !== null ? (
        <PressableScale style={s.btn} onPress={() => router.replace('/settings')}>
          <Text style={s.btnTx}>{t('common.confirm', '확인')}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space(6), gap: space(4) },
  msg: { ...font.body, color: colors.ink, textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(6), paddingVertical: space(3) },
  btnTx: { ...font.body, color: colors.onJu, fontWeight: '700', lineHeight: 20 },
});
