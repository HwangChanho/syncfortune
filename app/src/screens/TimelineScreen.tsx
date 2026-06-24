// app/src/screens/TimelineScreen.tsx — 인생 타임라인 (대운·연도 각각 picker + 위/아래 분리 통변)
// ─────────────────────────────────────────────────────────────────────────
// daniel: ① 대운(10년)·연도(1년) 모두 picker(모달)로 선택 ② 위(대운)/아래(연도)로 나눠 각각 통변 표시.
//   선택 항목(life_{startAge} / year_{YYYY}) 통변을 Edge(kind='timeline')로 생성·캐시. 현재 대운·올해 기본.
//   캐시(readings chart_id×category)로 재생성 0. 프리미엄 메뉴(비프리미엄=유도).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Alert } from '../lib/alert'; // 커스텀 알림(앱 디자인)
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import { useAuth } from '../lib/useAuth';
import { useSubscription } from '../lib/subscription';
import { useFontScale } from '../lib/fontScale';
import { setGenProgress } from '../lib/genProgress'; // 일회성 진행도(daniel 이슈15)
import { supabase } from '../lib/supabase';
import { ensureServerChartId } from '../lib/prewarmReadings';
import { invokeFail } from '../lib/interpretResult'; // 방어: 일시적 불가/오류 친화 처리
import { getRepresentativeId } from '../lib/myChart'; // 대표 명식 여부(자동생성 한정)
import { assertOnline, isOnline } from '../lib/network'; // 오프라인 시 신규 생성 차단
import { loadCredits, grantCredit } from '../lib/coupons'; // 크레딧 보유확인 + 구매 후 부여(차감은 Edge·P3)
import { isReadingUnlocked } from '../lib/unlocks'; // 서버 세트 언락(timeline)
import { purchaseCreditRC } from '../lib/purchases'; // timeline 개별 구매(비프리미엄)
import { appLang } from '../lib/i18n'; // 통변 출력 언어(앱 언어)
import { stemElement, branchElement, elementColor, elementText, stemYinYang, branchYinYang } from '../lib/ohaeng';
import { TTSButton } from '../components/TTSButton'; // daniel: 풀이 음성 읽기(온디바이스 TTS·무료)
import { colors, radius, space, shadow, font } from '../lib/theme';
import type { ChartInput } from '@spec/chart';
import type { SavedChart } from '../lib/myChart';

const AGE_MIN = 10, AGE_MAX = 100;

// 타임라인 통변 카테고리 — Edge 응답 키와 1:1, 라벨은 i18n.
//   대운(10년)=5갈래 / 연운(1년)=유료라 8갈래(+월별, daniel "올해는 더 다양하게").
type CatKey = 'general' | 'work' | 'money' | 'love' | 'health' | 'social' | 'growth' | 'move';
const CAT_DEF: Record<CatKey, string> = {
  general: 'timeline.catGeneral', work: 'timeline.catWork', money: 'timeline.catMoney',
  love: 'timeline.catLove', health: 'timeline.catHealth',
  social: 'timeline.catSocial', growth: 'timeline.catGrowth', move: 'timeline.catMove',
};
const DECADE_KEYS: CatKey[] = ['general', 'work', 'money', 'love', 'health'];
const YEAR_KEYS: CatKey[] = ['general', 'work', 'money', 'love', 'health', 'social', 'growth', 'move'];
const catsFor = (key: string): CatKey[] => (key.startsWith('year_') ? YEAR_KEYS : DECADE_KEYS);

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
  const [catByKey, setCatByKey] = useState<Record<string, CatKey>>({}); // 기간별 선택된 카테고리 칩(기본 general)
  const listRef = useRef<ScrollView>(null);                   // picker 목록 스크롤(선택 위치로 이동)
  const ROW_H = 48;                                           // 목록 행 고정 높이(스크롤 오프셋 계산용)
  // 기간별 잠금 해제 집합(ref). 프리미엄=현재 대운/올해 무료, 그 외엔 이용권으로 해당 key만 1회 해제.
  //   생성되면 캐시(readings)에 남아 영구 무료 → ref는 '결제 직후 재생성 허용' 용도.
  // 세트 언락은 서버 reading_unlocks 권위로 이전(P3) — 로컬 unlocked ref 제거
  // 대표 명식 여부 — 자동생성(현재 대운/올해)은 대표 명식에만(비용통제). 다른 명식은 직접 열어야.
  const [isRep, setIsRep] = useState(false);
  useEffect(() => {
    let alive = true;
    getRepresentativeId().then((rid) => { if (alive) setIsRep(!!savedChart && !!rid && rid === savedChart.id); }).catch(() => {});
    return () => { alive = false; };
  }, [savedChart]);

  // 한 기간이 무료인지(프리미엄 & 현재 대운/올해) — 자동 생성·게이트 분기 공용
  const isCurrentPeriod = (key: string) => key === curDecadeKey || key === `year_${nowYear}`;
  const isFree = (key: string) => isCurrentPeriod(key); // 현재 대운·올해 = 전원 무료(무료시기·daniel)

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
      const { data } = await supabase.from('readings').select('category, content').eq('chart_id', id).eq('lang', appLang());
      if (!alive) return;
      const loaded: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { if (/^(life|year)_/.test(r.category)) loaded[r.category] = r.content; });
      setReadings(loaded);
      // 프리미엄 자동 생성은 '무료' 기간(현재 대운·올해)만 + ★대표 명식에만(비용통제). 오프라인=보류.
      if (isRep && isOnline()) { // 현재 대운·올해는 전원 무료 → 자동 생성(daniel)
        if (curDecadeKey && !loaded[curDecadeKey]) gen(curDecadeKey, id);
        if (!loaded[`year_${nowYear}`]) gen(`year_${nowYear}`, id);
      }
    })().catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, session, savedChart, curDecadeKey, isRep]);

  // 항목 통변 생성(Edge kind='timeline') — 캐시 적중 시 재생성 0.
  //   게이트(daniel): 프리미엄=현재 대운/올해 무료, 그 외 시기는 타임라인 이용권으로 1회 열기(건당 결제 준비 중).
  async function gen(key: string, id?: string | null) {
    const cid = id ?? chartId;
    if (!cid || readings[key] || busy === key) return;
    if (!assertOnline(t)) return;                          // 오프라인 = 신규 생성 차단
    // 비프리미엄 = 프리미엄 유도(타임라인은 프리미엄 메뉴). 이용권이 있으면 이용권으로 열기 허용.
    // 게이트(새 정책·daniel): 프리미엄(무제한)=무료 / 현재 대운·올해=전원 무료 / 그 외=서버 언락 또는 개별 크레딧(없으면 구매). 차감·언락은 Edge.
    if (!isPremium && !isFree(key)) {
      const has = (cid ? await isReadingUnlocked(cid, 'timeline') : false) || ((await loadCredits())['timeline'] ?? 0) > 0;
      if (!has) {
        Alert.alert(t('timeline.unlockTitle'), t('timeline.unlockMsg'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('reading.payPerUse', '구매'), onPress: async () => { try { const ok = await purchaseCreditRC('timeline'); if (!ok) return; await grantCredit('timeline'); await gen(key, cid); } catch (e) { Alert.alert('!', (e as Error).message); } } },
        ]);
        return;
      }
    }
    setBusy(key);
    setGenProgress({ active: true, total: 1, done: 0, label: '인생 타임라인', route: '/timeline' }); // 일회성 진행도(daniel 이슈15)
    try {
      const { data, error } = await supabase.functions.invoke('interpret', { body: { chartId: cid, category: key, kind: 'timeline', tier: 'paid', lang: appLang() } });
      // 방어: 일시적 불가/오류는 원문 대신 친화 메시지로(예전 'non-2xx' 노출 방지)
      const f = invokeFail(data, error);
      setReadings((prev) => ({ ...prev, [key]: f ? { error: f.message } : data?.reading }));
    } catch (e) { setReadings((prev) => ({ ...prev, [key]: { error: (e as Error).message } })); }
    setGenProgress({ route: '/timeline', done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기'(daniel 이슈15)
    setBusy(null);
  }

  // picker에서 선택 → 무료/이미 캐시된 기간만 자동 생성. 잠긴 기간은 카드의 '열기' 버튼으로 명시적 결제.
  function pick(key: string) {
    if (key.startsWith('life_')) setSelDecade(key); else setSelYear(key);
    setPicker(null);
    if (!readings[key] && isFree(key)) gen(key); // 무료시기(현재 대운·올해)만 자동 — 유료 시기는 카드에서 직접
  }

  // 카드의 카테고리 칩 선택값(기본 general)
  const catOf = (key: string): CatKey => catByKey[key] ?? 'general';

  const bodyDyn = { fontSize: fs(15), lineHeight: fs(25) };
  const decadeLabel = decades.find((d) => d.key === selDecade)?.label ?? '';
  const yearLabel = selYear.startsWith('year_') ? `${selYear.slice(5)}년` : '';

  // 간지 칩 — 천간·지지 각각 제 오행색으로 분리(daniel #16: 한 글자씩 알맞은 색)
  const gzChip = (gz: string, _stem?: string) => (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[...gz].map((ch, i) => {
        const el = i === 0 ? stemElement(ch) : branchElement(ch); // 0=천간, 1=지지
        const yy = i === 0 ? stemYinYang(ch) : branchYinYang(ch); // daniel: 모든 한자에 음양 표시
        return (
          <View key={i} style={[styles.gz, { backgroundColor: elementColor[el] }]}>
            <Text style={[styles.gzTx, { color: elementText[el] }]}>{ch}</Text>
            <Text style={{ fontSize: 8, fontWeight: '700', color: elementText[el], marginTop: -3 }}>{yy === '+' ? '양' : '음'}</Text>
          </View>
        );
      })}
    </View>
  );

  // 통변 카드(공용) — 5카테고리(통합·직업·재물·애정·건강) 칩 + 선택 카테고리 본문(원국 풀이처럼 상세).
  //   잠긴 기간(프리미엄 현재 외)은 잠금 안내 + '이 시기 열기' 버튼(이용권 차감).
  const card = (key: string) => {
    const r = readings[key];
    if (busy === key && !r) return <View style={styles.card}><ActivityIndicator color={colors.ju} /><Text style={styles.busyTx}>{t('timeline.generating')}</Text></View>;
    if (r?.error) return <View style={styles.card}><Text style={styles.err}>{String(r.error)}</Text></View>;
    // 아직 생성 안 됨 → 무료 기간이면 안내, 잠긴 기간이면 잠금 카드(열기 버튼)
    if (!r) {
      if (isFree(key)) return (
        <Pressable style={styles.readBtn} onPress={() => gen(key)}>
          <Text style={[styles.readBtnTx, { fontSize: fs(15) }]}>{t('timeline.readThis', '이 시기 풀이 보기')}</Text>
        </Pressable>
      );
      return (
        <View style={[styles.card, styles.lockCard]}>
          <Text style={styles.lockH}>🔒 {t('timeline.lockedTitle')}</Text>
          <Text style={styles.lockSub}>{t('timeline.lockedSub')}</Text>
          <Pressable style={styles.unlockBtn} onPress={() => gen(key)}>
            <Text style={styles.unlockBtnTx}>{t('timeline.unlock')}</Text>
          </Pressable>
        </View>
      );
    }
    // 하위호환: 구(舊) 캐시는 {base,overlay,remedy} 형식 — 카테고리 키가 없으면 옛 레이아웃으로 표시.
    //   (배포 후 새로 생성되는 풀이는 {general,work,money,love,health} 5카테고리)
    const isOld = !YEAR_KEYS.some((ck) => typeof r[ck] === 'string') && (r.base || r.overlay || r.remedy);
    if (isOld) {
      return (
        <View style={styles.card}>
          {r.base ? <Text style={[styles.body, bodyDyn]}>{r.base}</Text> : null}
          {r.overlay ? <Text style={[styles.body, bodyDyn, { marginTop: space(3) }]}>{r.overlay}</Text> : null}
          {r.remedy ? <Text style={[styles.body, bodyDyn, { marginTop: space(3) }]}>{r.remedy}</Text> : null}
        </View>
      );
    }
    const cats = catsFor(key);                                 // 연도=8 / 대운=5
    const cat = cats.includes(catOf(key)) ? catOf(key) : 'general'; // 대운에서 8개용 선택이 남아있으면 보정
    const body = r[cat];                                       // 선택 카테고리 본문
    const months: any[] = Array.isArray(r.months) ? r.months : []; // 연운 월별(12)
    return (
      <View style={styles.card}>
        {/* 이슈19 소제목 — 이 시기 통변의 headline 있으면 통변 표시 맨 위에 한 줄 강조 */}
        {typeof r.headline === 'string' && r.headline.trim() ? (
          <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: fs(26) }}>{r.headline}</Text>
        ) : null}
        {/* 카테고리 칩 — 대운 5 / 연운 8 */}
        <View style={styles.chips}>
          {cats.map((ck) => {
            const on = ck === cat;
            return (
              <Pressable key={ck} style={[styles.chip, on && styles.chipOn]} onPress={() => setCatByKey((p) => ({ ...p, [key]: ck }))}>
                <Text style={[styles.chipTx, on && styles.chipTxOn]}>{t(CAT_DEF[ck])}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.body, bodyDyn, { marginTop: space(4) }]}>{typeof body === 'string' && body ? body : t('timeline.generating')}</Text>

        {/* 연운 월별 흐름(1~12월) — 유료라 더 디테일하게 */}
        {months.length > 0 && (
          <View style={styles.monthsBox}>
            <Text style={styles.monthsH}>{t('timeline.months')}</Text>
            {months.map((m, i) => (
              <View key={i} style={styles.monthRow}>
                <Text style={styles.monthNo}>{i + 1}{t('timeline.monthUnit')}</Text>
                <Text style={[styles.monthTx, bodyDyn]}>{String(m).replace(/^\s*\d+\s*월\s*[—\-:]*\s*/, '')}</Text>
              </View>
            ))}
          </View>
        )}
        {/* daniel(2026-06-24): 이 시기 풀이 음성으로 듣기(온디바이스 TTS·무료) */}
        <TTSButton reading={r} />
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
  body: { ...font.body, color: colors.ink },
  // 카테고리 칩(통합·직업·재물·애정·건강)
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { paddingVertical: space(2), paddingHorizontal: space(3), borderRadius: radius.pill ?? 999, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.bg },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTxOn: { color: colors.bg },
  // 연운 월별(1~12월)
  monthsBox: { marginTop: space(5), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  monthsH: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(3) },
  monthRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space(2.5), gap: space(3) },
  monthNo: { fontSize: 13, fontWeight: '800', color: colors.ju, width: 34 },
  monthTx: { ...font.body, color: colors.ink, flex: 1 },
  // 잠금 카드(현재 외 시기)
  lockCard: { alignItems: 'center', borderColor: colors.ju, borderStyle: 'dashed' },
  lockH: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  lockSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', lineHeight: 19, marginBottom: space(4) },
  unlockBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(7) },
  unlockBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  readBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(3), ...shadow.card }, // 이 시기 풀이 생성 버튼(daniel)
  readBtnTx: { color: colors.bg, fontWeight: '800' },
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
