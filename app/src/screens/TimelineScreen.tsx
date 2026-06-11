// app/src/screens/TimelineScreen.tsx — 인생 타임라인 (대운·연도 각각 picker + 위/아래 분리 통변)
// ─────────────────────────────────────────────────────────────────────────
// daniel: ① 대운(10년)·연도(1년) 모두 picker(모달)로 선택 ② 위(대운)/아래(연도)로 나눠 각각 통변 표시.
//   선택 항목(life_{startAge} / year_{YYYY}) 통변을 Edge(kind='timeline')로 생성·캐시. 현재 대운·올해 기본.
//   캐시(readings chart_id×category)로 재생성 0. 프리미엄 메뉴(비프리미엄=유도).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react';
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
  const curAge = nowYear - birthYear;

  // 대운(10년)·연도(1년) 목록 — 엔진 luckCycles + annuals
  const { decades, years, curDecadeKey } = useMemo(() => {
    const luck: any[] = (c?.saju as any)?.luckCycles ?? [];
    const decades = luck
      .filter((l) => l.startAge + 9 >= AGE_MIN && l.startAge <= AGE_MAX)
      .map((l) => ({ key: `life_${l.startAge}`, startAge: l.startAge, label: `${l.startAge}~${l.startAge + 9}세`, gz: `${l.stem}${l.branch}`, stem: l.stem }));
    const cur = decades.find((d) => curAge >= d.startAge && curAge < d.startAge + 10);
    const ymap = new Map<number, any>();
    luck.forEach((l) => (l.annuals ?? []).forEach((a: any) => {
      const age = a.year - birthYear;
      if (age >= AGE_MIN && age <= AGE_MAX && !ymap.has(a.year)) ymap.set(a.year, { ...a, age });
    }));
    const years = Array.from(ymap.values()).sort((x, y) => x.year - y.year)
      .map((a) => ({ key: `year_${a.year}`, year: a.year, age: a.age, gz: `${a.stem}${a.branch}`, stem: a.stem }));
    return { decades, years, curDecadeKey: cur?.key ?? decades[0]?.key ?? '' };
  }, [c, birthYear, curAge]);

  const [readings, setReadings] = useState<Record<string, any>>({});
  const [selDecade, setSelDecade] = useState<string>('');
  const [selYear, setSelYear] = useState<string>(`year_${nowYear}`);
  const [chartId, setChartId] = useState<string | null>(savedChart?.serverChartId ?? null);
  const [busy, setBusy] = useState<string | null>(null);      // 생성 중인 category
  const [picker, setPicker] = useState<'decade' | 'year' | null>(null);
  const listRef = useRef<ScrollView>(null);                   // picker 목록 스크롤(선택 위치로 이동)
  const ROW_H = 48;                                           // 목록 행 고정 높이(스크롤 오프셋 계산용)

  useEffect(() => { if (curDecadeKey && !selDecade) setSelDecade(curDecadeKey); }, [curDecadeKey, selDecade]);

  // picker 열릴 때 선택 항목(연도=올해·대운=현재)으로 스크롤 위치를 맞춘다(맨 위 아닌 현재로, daniel).
  useEffect(() => {
    if (!picker) return;
    const items = picker === 'decade' ? decades : years;
    const selKey = picker === 'decade' ? selDecade : selYear;
    const idx = items.findIndex((x) => x.key === selKey);
    if (idx > 1) setTimeout(() => listRef.current?.scrollTo({ y: (idx - 1) * ROW_H, animated: false }), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker]);

  // 진입 시 서버차트 + 캐시 로드 → 현재 대운·올해 자동 생성(둘 다 보이게)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!c || !session || !input || !savedChart) return;
      const id = await ensureServerChartId(c, input, session, savedChart);
      if (!alive || !id) return;
      setChartId(id);
      const { data } = await supabase.from('readings').select('category, content').eq('chart_id', id);
      if (!alive) return;
      const loaded: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { if (/^(life|year)_/.test(r.category)) loaded[r.category] = r.content; });
      setReadings(loaded);
      if (isPremium) {
        if (curDecadeKey && !loaded[curDecadeKey]) gen(curDecadeKey, id);
        if (!loaded[`year_${nowYear}`]) gen(`year_${nowYear}`, id);
      }
    })().catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, session, savedChart, curDecadeKey]);

  // 항목 통변 생성(Edge kind='timeline') — 캐시 적중 시 재생성 0. 프리미엄만.
  async function gen(key: string, id?: string | null) {
    const cid = id ?? chartId;
    if (!cid || readings[key] || busy === key) return;
    if (!isPremium) { Alert.alert(t('timeline.premiumTitle'), t('timeline.premiumMsg')); return; }
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke('interpret', { body: { chartId: cid, category: key, kind: 'timeline', tier: 'paid' } });
      setReadings((prev) => ({ ...prev, [key]: error ? { error: error.message } : data?.reading }));
    } catch (e) { setReadings((prev) => ({ ...prev, [key]: { error: (e as Error).message } })); }
    setBusy(null);
  }

  function pick(key: string) {
    if (key.startsWith('life_')) setSelDecade(key); else setSelYear(key);
    setPicker(null);
    if (!readings[key]) gen(key);
  }

  const bodyDyn = { fontSize: fs(15), lineHeight: fs(25) };
  const decadeLabel = decades.find((d) => d.key === selDecade)?.label ?? '';
  const yearLabel = selYear.startsWith('year_') ? `${selYear.slice(5)}년` : '';

  // 간지 칩(오행색)
  const gzChip = (gz: string, stem: string) => (
    <View style={[styles.gz, { backgroundColor: elementColor[stemElement(stem)] }]}>
      <Text style={[styles.gzTx, { color: elementText[stemElement(stem)] }]}>{gz}</Text>
    </View>
  );

  // 통변 카드(공용) — base(흐름)/overlay(두드러지는 때)/remedy(조언)
  const card = (key: string) => {
    const r = readings[key];
    if (busy === key && !r) return <View style={styles.card}><ActivityIndicator color={colors.ju} /><Text style={styles.busyTx}>{t('timeline.generating')}</Text></View>;
    if (r?.error) return <View style={styles.card}><Text style={styles.err}>{String(r.error)}</Text></View>;
    if (!r) return <Text style={styles.note}>{isPremium ? t('timeline.tapToRead') : t('timeline.premiumMsg')}</Text>;
    return (
      <View style={styles.card}>
        {r.base ? <View style={styles.sec}><Text style={styles.secLabel}>{t('timeline.flow')}</Text><Text style={[styles.body, bodyDyn]}>{r.base}</Text></View> : null}
        {r.overlay ? <View style={styles.sec}><Text style={styles.secLabel}>{t('timeline.peak')}</Text><Text style={[styles.body, bodyDyn]}>{r.overlay}</Text></View> : null}
        {r.remedy ? <View style={[styles.sec, styles.remedySec]}><Text style={styles.secLabel}>{t('timeline.advice')}</Text><Text style={[styles.body, bodyDyn]}>{r.remedy}</Text></View> : null}
      </View>
    );
  };

  // picker 버튼(공용)
  const pickerBtn = (label: string, sub: string, onPress: () => void) => (
    <Pressable style={styles.pickBtn} onPress={onPress}>
      <Text style={styles.pickBtnTx}>{label}: <Text style={{ color: colors.ju, fontWeight: '800' }}>{sub}</Text></Text>
      <Text style={styles.pickChevron}>▾</Text>
    </Pressable>
  );

  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{t('reading.timelineTitle')}</Text>
      <Text style={styles.sub}>{t('reading.timelineSub')}</Text>

      {/* ── 위: 대운(10년) ── */}
      <Text style={styles.secH}>{t('timeline.decades')}</Text>
      {pickerBtn(t('timeline.pickDecade'), `${decadeLabel}${selDecade === curDecadeKey ? ` (${t('timeline.now')})` : ''}`, () => setPicker('decade'))}
      {card(selDecade)}

      <View style={styles.divider} />

      {/* ── 아래: 연도(1년) ── */}
      <Text style={styles.secH}>{t('timeline.years')}</Text>
      {pickerBtn(t('timeline.pickYear'), `${yearLabel}${selYear === `year_${nowYear}` ? ` (${t('timeline.thisYear')})` : ''}`, () => setPicker('year'))}
      {card(selYear)}

      {/* picker 모달(대운/연도 공용) */}
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetH}>{picker === 'decade' ? t('timeline.pickDecade') : t('timeline.pickYear')}</Text>
            <ScrollView ref={listRef} style={{ maxHeight: 440 }}>
              {picker === 'decade' && decades.map((d) => {
                const on = selDecade === d.key, isCur = d.key === curDecadeKey;
                return (
                  <Pressable key={d.key} style={[styles.row, on && styles.rowOn]} onPress={() => pick(d.key)}>
                    <Text style={[styles.rowTx, isCur && { color: colors.ju, fontWeight: '800' }]}>{d.label}{isCur ? ` (${t('timeline.now')})` : ''}</Text>
                    {gzChip(d.gz, d.stem)}
                  </Pressable>
                );
              })}
              {picker === 'year' && years.map((y) => {
                const on = selYear === y.key, isNow = y.year === nowYear;
                return (
                  <Pressable key={y.key} style={[styles.row, on && styles.rowOn]} onPress={() => pick(y.key)}>
                    <Text style={[styles.rowTx, isNow && { color: colors.ju, fontWeight: '800' }]}>{y.year}년 · {y.age}세{isNow ? ` (${t('timeline.thisYear')})` : ''}</Text>
                    {gzChip(y.gz, y.stem)}
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
  secH: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space(7) },
  gz: { minWidth: 44, paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.sm, alignItems: 'center' },
  gzTx: { fontSize: 16, fontWeight: '800' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, padding: space(4), ...shadow.card },
  pickBtnTx: { ...font.body, color: colors.ink, flexShrink: 1 },
  pickChevron: { color: colors.ju, fontSize: 16, fontWeight: '800' },
  card: { marginTop: space(3), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  sec: { marginTop: space(4) },
  secLabel: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink },
  remedySec: { marginTop: space(5), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  err: { fontSize: 13, color: colors.ju },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(3), lineHeight: 19 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space(5), paddingBottom: space(9) },
  sheetH: { ...font.heading, color: colors.ink, marginBottom: space(3) },
  row: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(2), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowOn: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  rowTx: { ...font.body, color: colors.ink },
});
