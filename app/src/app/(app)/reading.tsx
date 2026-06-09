// src/app/(app)/reading.tsx — 풀이 라우트 (명식 게이트 + 대표 SavedChart 연결)
// ─────────────────────────────────────────────────────────────────────────
// '프리미엄 풀이'(딥 통변) 진입점. 풀이할 명식을 2경로로 결정한다:
//   ① input param 전달(만세력·특징·자미두수의 '풀이 보기') → 그 명식(캐시 매핑 없음 — 1회용)
//   ② param 없이 직접 진입(홈 '프리미엄 풀이' 타일) → 대표 SavedChart 로드 → serverChartId 캐시 연결(ADR-052)
// 대표 명식조차 없을 때만 등록을 유도(이미 등록한 사용자에게 '다시 등록' 요구 안 함).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReadingScreen } from '../../screens/ReadingScreen';
import { loadRepChart, type SavedChart } from '../../lib/myChart';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

export default function ReadingRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const { input } = useLocalSearchParams<{ input?: string }>();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // input param(특정 명식 지정 경로) 우선 → 캐시 매핑 없는 1회용. 없으면 대표 SavedChart(캐시 연결).
    if (input) { setMe(JSON.parse(input)); setSavedChart(null); setLoading(false); return; }
    let alive = true;
    loadRepChart().then((ch) => {
      if (!alive) return;
      setSavedChart(ch);
      setMe(ch?.input ?? null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [input]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;

  // 대표 명식조차 없으면(신규 사용자)만 등록 유도. 명식이 있으면 이 분기를 타지 않는다.
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

  return <ReadingScreen input={me} savedChart={savedChart} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
