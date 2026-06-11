// src/app/(app)/timeline.tsx — 인생 타임라인 라우트 (대운 카테고리 + 연도 picker)
// ─────────────────────────────────────────────────────────────────────────
// 대표 명식(또는 input param)을 TimelineScreen 에 주입. 대운(10년)·연도(1년) 선택형 통변.
//   캐시 연결을 위해 대표 SavedChart(serverChartId)도 전달(ADR-052).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TimelineScreen } from '../../screens/TimelineScreen';
import { loadRepChart, type SavedChart } from '../../lib/myChart';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

export default function TimelineRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const { input } = useLocalSearchParams<{ input?: string }>();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (input) { setMe(JSON.parse(input)); setSavedChart(null); setLoading(false); return; }
    let alive = true;
    loadRepChart().then((ch) => {
      if (!alive) return;
      setSavedChart(ch); setMe(ch?.input ?? null); setLoading(false);
    });
    return () => { alive = false; };
  }, [input]);

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
  return <TimelineScreen input={me} savedChart={savedChart} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
