// app/src/screens/ReadingScreen.tsx — 전 영역 일괄 풀이 + 캐시 재사용 + 프리미엄 즉시 열람
// ─────────────────────────────────────────────────────────────────────────
// '프리미엄 풀이' = 16개 전 영역을 한 번에 통변해 카드로 표시.
// 캐시(ADR-052): 명식↔서버 charts.id 매핑(savedChart.serverChartId, 온디바이스)으로 chart_id 안정화
//   → 진입 시 readings(chart_id×category)를 select 해 *생성 없이* 즉시 표시. 없는 영역만 새로 생성.
//   첫 생성 때 charts 1회 insert → setServerChartId 로 매핑 보관 → 재방문 시 같은 chart_id(=Edge 캐시 적중).
// 접근: 프리미엄(구독)=게이트 없이 생성 / 비프리미엄=trial(첫1회 무료)·perUse(광고·건당). 캐시 열람은 무게이트.
//   ⚠️ '1회 트리거=전 영역 1세트' 게이트. 세트 단가 정책은 daniel 검수.
//   ⚠️ Edge invoke=프로덕션(개발 미배포=호출 실패=비용0·절대0). charts insert/readings select 는 직접 호출이라 개발에서도 동작.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import { useAuth } from '../lib/useAuth';
import { supabase } from '../lib/supabase';
import { useEntitlement } from '../lib/entitlement';
import { useSubscription } from '../lib/subscription';
import { setServerChartId, type SavedChart } from '../lib/myChart';
import { colors, radius, space, shadow, font } from '../lib/theme';
import type { ChartInput, CategoryKey } from '@spec/chart';

const CATEGORIES: CategoryKey[] = [
  '성격내면', '취업운', '직장운', '사업운', '금전소득운', '투자편재운', '재물손재', '연애운',
  '결혼배우자운', '대인사회성', '부모운', '형제운', '자식운', '건강', '학업자기계발', '이동환경',
];

export function ReadingScreen({ input, savedChart }: { input: ChartInput | null; savedChart?: SavedChart | null }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { mode, consumeTrial, watchAdForReading, purchaseReading } = useEntitlement();
  const { isPremium } = useSubscription();
  // 영역별 결과(생성·캐시된 영역만 키 존재) + 진행률 + 전역 에러 + 서버 chart_id
  const [readings, setReadings] = useState<Partial<Record<CategoryKey, any>>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [chartId, setChartId] = useState<string | null>(savedChart?.serverChartId ?? null);
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);

  // 진입 시: 서버 chart_id 확보 + 저장된 풀이(캐시) 로드 → 생성 없이 즉시 표시.
  //   savedChart 가 있어야 chart_id 안정화(재사용). 없으면(input-param 경로) 캐시 생략 → 버튼 생성.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!c || !session || !savedChart) return;
      const id = await ensureServerChart();
      if (!alive || !id) return;
      setChartId(id);
      // 저장된 영역별 풀이 로드(RLS own readings 로 본인 것만)
      const { data } = await supabase.from('readings').select('category, content').eq('chart_id', id);
      if (!alive || !data) return;
      const loaded: Partial<Record<CategoryKey, any>> = {};
      data.forEach((r: any) => { loaded[r.category as CategoryKey] = r.content; });
      setReadings(loaded);
    })().catch(() => { /* 캐시 로드 실패는 조용히 — 생성 버튼으로 폴백 */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, session, savedChart]);

  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  // 서버 charts row 확보: savedChart.serverChartId 있으면 재사용, 없으면 insert 후 매핑 저장(1회).
  async function ensureServerChart(): Promise<string | null> {
    if (!c || !session || !savedChart) return null;
    if (savedChart.serverChartId) return savedChart.serverChartId;
    const { data, error } = await supabase.from('charts')
      .insert({ owner_id: session.user.id, relation: 'self', saju: { ...c.saju, timeUnknown: input?.timeAccuracy === '미상' }, ziwei: c.ziwei, consent: true })
      .select('id').single();
    if (error || !data) return null;
    await setServerChartId(savedChart.id, data.id); // 온디바이스 매핑 저장 → 다음부터 재사용
    return data.id;
  }

  // savedChart 없는 폴백(input-param 경로): 캐시 매핑 없이 1회용 charts insert.
  async function insertChart(): Promise<string | null> {
    if (!c || !session) return null;
    const { data, error } = await supabase.from('charts')
      .insert({ owner_id: session.user.id, relation: 'self', saju: { ...c.saju, timeUnknown: input?.timeAccuracy === '미상' }, ziwei: c.ziwei, consent: true })
      .select('id').single();
    return error || !data ? null : data.id;
  }

  // 아직 없는 영역만 생성(캐시된 건 skip — 비용 방어). chart_id 는 재사용 우선.
  async function runAll(isTrial: boolean) {
    if (!c || !session) return;
    setGlobalError(null);
    let id = chartId;
    if (!id) {
      id = savedChart ? await ensureServerChart() : await insertChart();
      if (!id) { setGlobalError(t('reading.saveFail')); return; }
      setChartId(id);
    }
    const todo = CATEGORIES.filter((cat) => !readings[cat]);
    if (!todo.length) return;                              // 전부 캐시됨 → 생성 불필요
    setProgress({ done: CATEGORIES.length - todo.length, total: CATEGORIES.length });
    for (const cat of todo) {
      try {
        const { data, error } = await supabase.functions.invoke('interpret', { body: { chartId: id, category: cat, tier: 'paid' } });
        setReadings((prev) => ({ ...prev, [cat]: error ? { error: error.message } : data?.reading }));
      } catch (err) {
        setReadings((prev) => ({ ...prev, [cat]: { error: (err as Error).message } }));
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : null));
    }
    setProgress(null);
    if (isTrial) await consumeTrial();                     // 무료 체험 소진(전 영역 1세트 = 1회)
  }

  // 생성 트리거: 프리미엄(구독)=게이트 우회 / 비프리미엄=trial·perUse 게이트.
  async function onStart() {
    if (!session) { router.push('/login'); return; }
    if (isPremium) { await runAll(false); return; }        // 구독 = 무게이트(캐시로 비용 방어)
    if (mode === 'perUse') {
      Alert.alert(t('reading.premiumAlert'), t('reading.premiumAlertMsg'), [
        { text: t('reading.watchAd'), onPress: async () => { try { await watchAdForReading(); await runAll(false); } catch (e) { Alert.alert('!', (e as Error).message); } } },
        { text: t('reading.payPerUse'), onPress: async () => { try { await purchaseReading(); await runAll(false); } catch (e) { Alert.alert('!', (e as Error).message); } } },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }
    await runAll(mode === 'trial');
  }

  const banner = isPremium ? t('reading.bannerPremium') : (mode === 'trial' ? t('reading.bannerTrial') : t('reading.bannerPerUse'));
  const haveAll = CATEGORIES.every((cat) => readings[cat]);
  const showStart = !haveAll && progress === null;         // 캐시 다 있으면 버튼 숨김(바로 표시)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{t('reading.title')}</Text>
      <Text style={styles.sub}>{t('reading.sub')}</Text>

      {/* 생성 버튼 + 과금 안내(미생성 영역이 있을 때만) */}
      {showStart && (
        <>
          <Pressable style={styles.startBtn} onPress={onStart}>
            <Text style={styles.startBtnText}>{t('reading.runAll')}</Text>
          </Pressable>
          <Text style={styles.bannerText}>{banner}</Text>
        </>
      )}

      {/* 생성 중 진행률 (N/16) */}
      {progress && (
        <View style={styles.progressRow}>
          <ActivityIndicator color={colors.ju} />
          <Text style={styles.progressText}>{t('reading.progress', { done: progress.done, total: progress.total })}</Text>
        </View>
      )}

      {/* 차트 저장 실패(전역) */}
      {globalError && <View style={styles.card}><Text style={styles.err}>{globalError}</Text></View>}

      {/* 영역별 결과 카드 — 캐시·생성된 순서대로 누적(전 영역) */}
      {CATEGORIES.map((cat) => {
        const r = readings[cat];
        if (!r) return null;
        return (
          <View key={cat} style={styles.card}>
            <Text style={styles.cardTitle}>{t(`category.${cat}`)}</Text>
            {r.error ? (
              <Text style={styles.err}>{r.error}</Text>
            ) : (
              <>
                {r.base && <Text style={styles.rk}>{t('reading.base')}: {r.base}</Text>}
                {r.overlay && <Text style={styles.rk}>{t('reading.overlay')}: {r.overlay}</Text>}
                {r.remedy && <Text style={styles.rk}>{t('reading.remedy')}: {r.remedy}</Text>}
                {!r.base && !r.overlay && !r.remedy && <Text style={styles.rk}>{JSON.stringify(r, null, 2)}</Text>}
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  h: { ...font.heading, fontSize: 18 },
  sub: { ...font.caption, marginTop: space(1.5), marginBottom: space(4) },
  startBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', marginTop: space(2), ...shadow.card },
  startBtnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  bannerText: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(3) },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(5), marginBottom: space(2) },
  progressText: { ...font.body, color: colors.inkSoft },
  card: {
    marginTop: space(4), padding: space(4), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.card,
  },
  cardTitle: { ...font.heading, color: colors.ju, marginBottom: space(2) },
  rk: { ...font.body, marginTop: space(2), lineHeight: 21 },
  err: { fontSize: 13, color: colors.ju },
});
