// src/app/(app)/timeline.tsx — 인생 타임라인(대운별 시기 풀이) 라우트 (프리미엄)
// ─────────────────────────────────────────────────────────────────────────
// 대표 명식의 대운(10년 단위 시기, 10~100세)을 항목으로 ReadingScreen 재사용 —
//   캐시(chart_id×category=life_{startAge})·프리미엄 게이트·추가 질문이 전부 그대로 동작.
//   각 시기 = 한 인생 국면. Edge kind='timeline' 이 그 대운의 간지·세운 흐름을 통변(쉬운 말).
// 명식 결정: input param(특정 명식) 우선 → 없으면 대표 SavedChart(캐시 연결, ADR-052).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReadingScreen, type ReadingCategory } from '../../screens/ReadingScreen';
import { loadRepChart, type SavedChart } from '../../lib/myChart';
import { buildSajuChart } from '@engine/saju';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

// 10~100세 범위와 겹치는 대운만 항목으로(보통 7·17·…·97세 시작 = 약 10개).
const AGE_MIN = 10, AGE_MAX = 100;

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

  // 타임라인 항목 = ① 올해+근래 1년 단위(year_{YYYY}, '올해 운세'가 제일 중요 → 맨 앞) ② 10년 단위(life_{startAge}).
  //   Edge는 category 접두사(year_/life_)로 연운/대운을 분기. 캐시 키도 접두사로 구분.
  const cats = useMemo<ReadingCategory[] | undefined>(() => {
    if (!me) return undefined;
    const saju = buildSajuChart(me);
    const luck: any[] = saju.luckCycles ?? [];
    const now = new Date().getFullYear();
    // ① 올해 ~ +4년: 각 대운의 세운(流年)에서 해당 연도를 찾아 1년 단위 항목으로(중복 제거)
    const yearMap = new Map<number, any>();
    luck.forEach((l) => (l.annuals ?? []).forEach((a: any) => {
      if (a.year >= now && a.year <= now + 4 && !yearMap.has(a.year)) yearMap.set(a.year, a);
    }));
    const yearCats: ReadingCategory[] = Array.from(yearMap.values())
      .sort((a, b) => a.year - b.year)
      .map((a) => ({ key: `year_${a.year}`, label: `${a.year === now ? '올해 · ' : ''}${a.year}년 · ${a.stem}${a.branch}` }));
    // ② 10년 단위 대운(10~100세)
    const decadeCats: ReadingCategory[] = luck
      .filter((l) => l.startAge + 9 >= AGE_MIN && l.startAge <= AGE_MAX)
      .map((l) => ({ key: `life_${l.startAge}`, label: `${l.startAge}~${l.startAge + 9}세 · ${l.stem}${l.branch}` }));
    return [...yearCats, ...decadeCats]; // 올해(1년) 먼저, 그다음 장기(10년)
  }, [me]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!me || !cats?.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('manse.empty')}</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/register')}>
          <Text style={styles.btnText}>{t('compat.registerMyChart')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ReadingScreen
      input={me}
      savedChart={savedChart}
      categories={cats}
      kind="timeline"
      titleKey="reading.timelineTitle"
      subKey="reading.timelineSub"
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
