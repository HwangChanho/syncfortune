// src/app/(app)/timeline.tsx — 인생 타임라인 라우트 (대운 카테고리 + 연도 picker)
// ─────────────────────────────────────────────────────────────────────────
// 대표 명식(또는 input param)을 TimelineScreen 에 주입. 대운(10년)·연도(1년) 선택형 통변.
//   캐시 연결을 위해 대표 SavedChart(serverChartId)도 전달(ADR-052).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TimelineScreen } from '../../screens/TimelineScreen';
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 멈칫 제거(daniel 2026-06-28)
import { ChartSkeleton } from '../../components/Skeleton';     // 그 사이 스켈레톤
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

export default function TimelineRoute() {
  useLogContentVisit('timeline'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const { input } = useLocalSearchParams<{ input?: string }>();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [loading, setLoading] = useState(true);
  const ready = useDeferredReady(); // 전환 끝난 뒤 TimelineScreen(대운·세운 산출) 마운트

  useEffect(() => {
    if (input) { setMe(JSON.parse(input)); setSavedChart(null); setLoading(false); return; }
    let alive = true;
    loadRepChart().then((ch) => {
      if (!alive) return;
      setSavedChart(ch); setMe(ch?.input ?? null); setLoading(false);
    });
    return () => { alive = false; };
  }, [input]);

  if (loading) return <ChartSkeleton />;
  if (!me) {
    return (
      <View style={styles.center}>
        <Text style={[styles.msg, { fontSize: fs(15) }]}>{t('manse.empty')}</Text>
        <PressableScale style={styles.btn} onPress={() => router.push('/register')}>
          <Text style={[styles.btnText, { fontSize: fs(15) }]}>{t('compat.registerMyChart')}</Text>
        </PressableScale>
      </View>
    );
  }
  if (!ready) return <ChartSkeleton />; // 명식 있음 + 전환 중 → 스켈레톤(TimelineScreen 마운트 지연)
  return <TimelineScreen input={me} savedChart={savedChart} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' }, // 전역 배경 노출
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
