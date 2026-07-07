// src/app/(app)/timeline.tsx — 인생 타임라인 라우트 (대운 카테고리 + 연도 picker)
// ─────────────────────────────────────────────────────────────────────────
// 대표 명식(또는 input param)을 TimelineScreen 에 주입. 대운(10년)·연도(1년) 선택형 통변.
//   캐시 연결을 위해 대표 SavedChart(serverChartId)도 전달(ADR-052).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TimelineScreen } from '../../screens/TimelineScreen';
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 멈칫 제거(daniel 2026-06-28)
import { ChartSkeleton } from '../../components/Skeleton';     // 그 사이 스켈레톤
import { loadRepChart, listCharts, setRepresentative, getRepresentativeId, type SavedChart } from '../../lib/engine/myChart';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

export default function TimelineRoute() {
  useLogContentVisit('timeline'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const { input, chartId } = useLocalSearchParams<{ input?: string; chartId?: string }>();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [loading, setLoading] = useState(true);
  const ready = useDeferredReady(); // 전환 끝난 뒤 TimelineScreen(대운·세운 산출) 마운트
  const lastAppliedChartId = useRef<string | null>(null); // ★M1 적용한 chartId param 추적(재진입 중복 setRepresentative 방지·reading.tsx 38-43)

  useEffect(() => {
    if (input) { setMe(JSON.parse(input)); setSavedChart(null); setLoading(false); return; }
    let alive = true;
    (async () => {
      // ★M1(재진입 바인딩): 배너/푸시 route 의 chartId → 그 명식을 대표로 1회 전환 → loadRepChart 가 그 명식을 로드(reading.tsx 38-43 패턴).
      //   콜드런치 preferSelfAsRep 로 대표가 self 로 리셋돼도 결제한 명식이 뜨게. 중복가드(ref)+이미 대표면 skip.
      if (chartId && chartId !== lastAppliedChartId.current) {
        lastAppliedChartId.current = chartId;
        const cs = await listCharts();
        const target = cs.find((sc) => sc.id === chartId) ?? null;
        if (target && (await getRepresentativeId()) !== target.id) await setRepresentative(target.id);
      }
      const ch = await loadRepChart();
      if (!alive) return;
      setSavedChart(ch); setMe(ch?.input ?? null); setLoading(false);
    })();
    return () => { alive = false; };
  }, [input, chartId]);

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
