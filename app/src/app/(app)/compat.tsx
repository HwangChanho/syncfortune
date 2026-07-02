// src/app/(app)/compat.tsx — 1:1 궁합 라우트 (내 차트 로드 → 주입, 다국어, 한지·먹 테마)
// ─────────────────────────────────────────────────────────────────────────
// 저장된 내 차트(self)를 로드해 CompatScreen 에 me 로 주입. 없으면 명식 등록 유도.
// 상대는 화면 내 직접 입력(동의 게이트 — 규칙8). 결정론 궁합은 온디바이스.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CompatScreen } from '../../screens/CompatScreen';
import { loadMyChart } from '../../lib/engine/myChart';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

export default function CompatRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyChart().then((c) => {
      setMe(c);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }

  // 내 차트 없음 — 명식 먼저 등록 유도
  if (!me) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('compat.needChart')}</Text>
        <PressableScale style={styles.btn} onPress={() => router.push('/register')}>
          <Text style={styles.btnText}>{t('compat.registerMyChart')}</Text>
        </PressableScale>
      </View>
    );
  }

  return <CompatScreen me={me} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5), lineHeight: 22 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
