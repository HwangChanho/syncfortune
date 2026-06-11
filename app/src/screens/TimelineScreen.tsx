// app/src/screens/TimelineScreen.tsx — 인생 타임라인 (대운 카테고리 선택 + 연도 picker)
// ─────────────────────────────────────────────────────────────────────────
// daniel: ① 대운(10년)을 카테고리로 나눠 칩으로 선택 ② 연도는 picker(모달)로 임의 선택.
//   선택 항목(life_{startAge} 또는 year_{YYYY})의 통변을 Edge(kind='timeline')로 생성·캐시·표시.
//   '올해'를 기본 선택. 캐시(readings chart_id×category)로 재생성 0. 프리미엄 메뉴(비프리미엄=유도).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import { useAuth } from '../lib/useAuth';
import { useSubscription } from '../lib/subscription';
import { useFontScale } from '../lib/fontScale';
import { supabase } from '../lib/supabase';
import { ensureServerChartId } from '../lib/prewarmReadings';
import { stemElement, elementColor, elementText } from '../lib/ohaeng';
import { colors, radius, space, shadow, font } from '../lib/theme';
import type { ChartInput } from '@spec/chart';
import type { SavedChart } from '../lib/myChart';

const AGE_MIN = 10, AGE_MAX = 100;

export function TimelineScreen({ input, savedChart }: { input: ChartInput | null; savedChart?: SavedChart | null }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const { fs } = useFontScale();
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);
  const nowYear = new Date().getFullYear();
  const birthYear = input ? parseInt(String(input.birthDateTime).slice(0, 4), 10) : 0;

  // 대운(10년)·연도(1년) 목록 — 엔진 luckCycles + annuals
  const { decades, years } = useMemo(() => {
    const luck: any[] = (c?.saju as any)?.luckCycles ?? [];
    const decades = luck
      .filter((l) => l.startAge + 9 >= AGE_MIN && l.startAge <= AGE_MAX)
      .map((l) => ({ key: `life_${l.startAge}`, startAge: l.startAge, label: `${l.startAge}~${l.startAge + 9}세`, gz: `${l.stem}${l.branch}`, stem: l.stem }));
    const ymap = new Map<number, any>();
    luck.forEach((l) => (l.annuals ?? []).forEach((a: any) => {
      const age = a.year - birthYear;
      if (age >= AGE_MIN && age <= AGE_MAX && !ymap.has(a.year)) ymap.set(a.year, { ...a, age });
    }));
    const years = Array.from(ymap.values()).sort((x, y) => x.year - y.year)
      .map((a) => ({ key: `year_${a.year}`, year: a.year, age: a.age, gz: `${a.stem}${a.branch}`, stem: a.stem }));
    return { decades, years };
  }, [c, birthYear]);

  const [readings, setReadings] = useState<Record<string, any>>({});
  const [sel, setSel] = useState<string>(`year_${nowYear}`);   // 기본 = 올해
  const [chartId, setChartId] = useState<string | null>(savedChart?.serverChartId ?? null);
  const [busy, setBusy] = useState(false);
  const [pickYear, setPickYear] = useState(false);             // 연도 picker 모달

  // 진입 시 서버차트 + 캐시(life_/year_) 로드 → 생성 없이 즉시 표시
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!c || !session || !input || !savedChart) return;
      const id = await ensureServerChartId(c, input, session, savedChart);
      if (!alive || !id) return;
      setChartId(id);
      const { data } = await supabase.from('readings').select('category, content').eq('chart_id', id);
      if (!alive || !data) return;
      const loaded: Record<string, any> = {};
      data.forEach((r: any) => { if (/^(life|year)_/.test(r.category)) loaded[r.category] = r.content; });
      setReadings(loaded);
      // 올해가 캐시에 없으면 자동 생성(가장 중요)
      if (!loaded[`year_${nowYear}`] && isPremium) gen(`year_${nowYear}`, id);
    })().catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, session, savedChart]);

  // 항목 통변 생성(Edge kind='timeline') — 캐시 적중 시 재생성 0. 프리미엄만.
  async function gen(key: string, id?: string | null) {
    const cid = id ?? chartId;
    if (!cid || readings[key] || busy) return;
    if (!isPremium) { Alert.alert(t('timeline.premiumTitle'), t('timeline.premiumMsg')); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('interpret', { body: { chartId: cid, category: key, kind: 'timeline', tier: 'paid' } });
      setReadings((prev) => ({ ...prev, [key]: error ? { error: error.message } : data?.reading }));
    } catch (e) { setReadings((prev) => ({ ...prev, [key]: { error: (e as Error).message } })); }
    setBusy(false);
  }

  function select(key: string) { setSel(key); if (!readings[key]) gen(key); }

  const cur = readings[sel];
  const bodyDyn = { fontSize: fs(15), lineHeight: fs(25) };
  const selYearLabel = sel.startsWith('year_') ? `${sel.slice(5)}년` : years.find((y) => y.year === nowYear)?.year + '년';

  // 간지 칩(오행색)
  const gzChip = (gz: string, stem: string, small?: boolean) => (
    <View style={[styles.gz, small && styles.gzSm, { backgroundColor: elementColor[stemElement(stem)] }]}>
      <Text style={[styles.gzTx, small && styles.gzTxSm, { color: elementText[stemElement(stem)] }]}>{gz}</Text>
    </View>
  );

  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{t('reading.timelineTitle')}</Text>
      <Text style={styles.sub}>{t('reading.timelineSub')}</Text>

      {/* ── 대운 카테고리(10년 단위) ── */}
      <Text style={styles.secH}>{t('timeline.decades')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {decades.map((d) => {
          const on = sel === d.key;
          return (
            <Pressable key={d.key} style={[styles.dChip, on && styles.dChipOn]} onPress={() => select(d.key)}>
              <Text style={[styles.dChipAge, on && styles.dChipTxOn]}>{d.label}</Text>
              {gzChip(d.gz, d.stem, true)}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── 연도 picker(1년 단위) ── */}
      <Text style={styles.secH}>{t('timeline.years')}</Text>
      <Pressable style={styles.pickBtn} onPress={() => setPickYear(true)}>
        <Text style={styles.pickBtnTx}>
          {t('timeline.pickYear')}: <Text style={{ color: colors.ju, fontWeight: '800' }}>{selYearLabel}{sel === `year_${nowYear}` ? ` (${t('timeline.thisYear')})` : ''}</Text>
        </Text>
        <Text style={styles.pickChevron}>▾</Text>
      </Pressable>

      {/* ── 선택 항목 통변 ── */}
      {busy && !cur ? (
        <View style={styles.card}><ActivityIndicator color={colors.ju} /><Text style={styles.busyTx}>{t('timeline.generating')}</Text></View>
      ) : cur?.error ? (
        <View style={styles.card}><Text style={styles.err}>{String(cur.error)}</Text></View>
      ) : cur ? (
        <View style={styles.card}>
          {cur.base ? <View style={styles.sec}><Text style={styles.secLabel}>{t('timeline.flow')}</Text><Text style={[styles.body, bodyDyn]}>{cur.base}</Text></View> : null}
          {cur.overlay ? <View style={styles.sec}><Text style={styles.secLabel}>{t('timeline.peak')}</Text><Text style={[styles.body, bodyDyn]}>{cur.overlay}</Text></View> : null}
          {cur.remedy ? <View style={[styles.sec, styles.remedySec]}><Text style={styles.secLabel}>{t('timeline.advice')}</Text><Text style={[styles.body, bodyDyn]}>{cur.remedy}</Text></View> : null}
        </View>
      ) : (
        <Text style={styles.note}>{isPremium ? t('timeline.tapToRead') : t('timeline.premiumMsg')}</Text>
      )}

      {/* 연도 picker 모달 */}
      <Modal visible={pickYear} transparent animationType="slide" onRequestClose={() => setPickYear(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickYear(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetH}>{t('timeline.pickYear')}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {years.map((y) => {
                const on = sel === y.key, isNow = y.year === nowYear;
                return (
                  <Pressable key={y.key} style={[styles.yRow, on && styles.yRowOn]} onPress={() => { setPickYear(false); select(y.key); }}>
                    <Text style={[styles.yTx, isNow && { color: colors.ju, fontWeight: '800' }]}>{y.year}년 · {y.age}세{isNow ? ` (${t('timeline.thisYear')})` : ''}</Text>
                    {gzChip(y.gz, y.stem, true)}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5), lineHeight: 19 },
  secH: { fontSize: 14, fontWeight: '800', color: colors.ju, marginTop: space(4), marginBottom: space(2) },
  chipRow: { gap: space(2), paddingVertical: space(1) },
  dChip: { alignItems: 'center', gap: space(1), paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  dChipOn: { borderColor: colors.ju, backgroundColor: colors.juSoft },
  dChipAge: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  dChipTxOn: { color: colors.ju },
  gz: { minWidth: 44, paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.sm, alignItems: 'center' },
  gzSm: { minWidth: 36, paddingVertical: 2 },
  gzTx: { fontSize: 16, fontWeight: '800' },
  gzTxSm: { fontSize: 13 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, padding: space(4), ...shadow.card },
  pickBtnTx: { ...font.body, color: colors.ink },
  pickChevron: { color: colors.ju, fontSize: 16, fontWeight: '800' },
  card: { marginTop: space(4), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  sec: { marginTop: space(4) },
  secLabel: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink },
  remedySec: { marginTop: space(5), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  err: { fontSize: 13, color: colors.ju },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 19 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space(5), paddingBottom: space(9) },
  sheetH: { ...font.heading, color: colors.ink, marginBottom: space(3) },
  yRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space(3), paddingHorizontal: space(2), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  yRowOn: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  yTx: { ...font.body, color: colors.ink },
});
