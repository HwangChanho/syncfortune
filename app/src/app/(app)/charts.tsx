// src/app/(app)/charts.tsx — 만세력·차트 관리 (무료, 광고 진입, 한지·먹 테마). 내 명식(myChart) 표시.
// ─────────────────────────────────────────────────────────────────────────
// 저장된 내 차트(self) 로드 → MyeongsikScreen 재사용. 없으면 등록 유도. (추후 N명 목록 확장)
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MyeongsikScreen } from '../../screens/MyeongsikScreen';
import { loadMyChart } from '../../lib/myChart';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

export default function ChartsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyChart().then((c) => { setMe(c); setLoading(false); });
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;

  if (!me) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('manse.empty')}</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/register')}>
          <Text style={styles.btnText}>{t('compat.registerMyChart')}</Text>
        </Pressable>
      </View>
    );
  }

  // 내 명식 표시 + 풀이 진입(같은 input 전달)
  return (
    <MyeongsikScreen
      input={me}
      onReading={() => router.push({ pathname: '/reading', params: { input: JSON.stringify(me) } })}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
