// src/app/(app)/pay.tsx — 결제창에서 **돌아오는 자리**
// ═══════════════════════════════════════════════════════════════════════════
// 토스가 `successUrl` 로 `paymentKey`·`orderId`·`amount` 를 붙여 되돌린다.
// 이 화면이 승인을 확정(`confirm`)하고 결과를 말한 뒤 충전 화면으로 보낸다.
//
// ■ ★승인은 **서버가** 한다 — 여기서는 «부르고 결과를 보여 줄» 뿐이다.
//   금액도 서버가 PG 에게 다시 물어 확인한다(클라가 URL 로 준 값은 근거가 아니다).
// ■ ⚠️두 번 부르지 않는다 — 뒤로가기·새로고침으로 이 화면이 다시 떠도
//   `settle_web_order` 가 «선점» 으로 막지만, 화면도 한 번만 부르게 잠근다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { confirmWebOrder } from '../../lib/billing/webPay';
import { colors, radius, space, font } from '../../lib/theme';

export default function PayReturnRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const p = useLocalSearchParams<{ ok?: string; orderId?: string; paymentKey?: string; amount?: string; message?: string }>();
  const [state, setState] = useState<'working' | 'ok' | 'fail'>('working');
  const [msg, setMsg] = useState('');
  const [coins, setCoins] = useState(0);
  const once = useRef(false);   // ★한 번만 — 새로고침·뒤로가기로 다시 떠도 두 번 안 부른다

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    // 실패로 돌아온 경우 — PG 가 이유를 준다
    if (p.ok === '0' || !p.paymentKey || !p.orderId) {
      setState('fail');
      setMsg(String(p.message ?? t('pay.canceled', '결제가 취소됐어요.')));
      return;
    }
    void confirmWebOrder(String(p.orderId), String(p.paymentKey), Number(p.amount ?? 0))
      .then((c) => { setCoins(c); setState('ok'); })
      .catch((e) => { setState('fail'); setMsg(String(e?.message ?? '') || t('pay.failMsg', '결제를 확인하지 못했어요.')); });
  }, [p.ok, p.orderId, p.paymentKey, p.amount, p.message, t]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {state === 'working' ? t('pay.working', '결제를 확인하고 있어요…')
          : state === 'ok' ? t('pay.okTitle', '충전됐어요')
            : t('pay.failTitle', '충전하지 못했어요')}
      </Text>
      {state === 'ok' ? (
        <Text style={styles.sub}>{t('pay.okMsg', '{{coins}} 운이 들어왔어요.').replace('{{coins}}', String(coins))}</Text>
      ) : null}
      {state === 'fail' ? <Text style={styles.sub}>{msg}</Text> : null}
      {state !== 'working' ? (
        <PressableScale style={styles.btn} onPress={() => router.replace('/coins')}>
          <Text style={styles.btnTx}>{t('pay.back', '충전 화면으로')}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(3), padding: space(6), backgroundColor: colors.bg },
  title: { ...font.heading, color: colors.ink, textAlign: 'center' },
  sub: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  btn: { marginTop: space(3), paddingVertical: space(3.5), paddingHorizontal: space(7), borderRadius: radius.md, backgroundColor: colors.ju },
  btnTx: { ...font.body, color: colors.onJu, fontWeight: '800' },
});
