// src/app/(app)/sokgunghap.tsx — 속궁합 라우트 (내 차트 로드 → 주입). compat.tsx 패턴.
// ─────────────────────────────────────────────────────────────────────────
// 저장된 내 차트(대표)를 로드해 SokgunghapScreen 에 me 로 주입. 없으면 명식 등록 유도.
// 17+ 게이트·상대 입력은 화면 내부에서 처리. 노출 여부는 원격 플래그(features.sokgunghap)로 제어.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { SokgunghapScreen } from '../../screens/SokgunghapScreen';
import { loadMyChart } from '../../lib/engine/myChart';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

export default function SokgunghapRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await loadMyChart();
      if (!alive) return;
      setMe(c); setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;

  if (!me) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('compat.needChart', '먼저 내 명식을 등록해 주세요.')}</Text>
        <PressableScale style={styles.btn} onPress={() => router.push('/register')}>
          <Text style={styles.btnText}>{t('compat.registerMyChart', '내 명식 등록하기')}</Text>
        </PressableScale>
      </View>
    );
  }

  return <SokgunghapScreen me={me} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5), lineHeight: 22 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
