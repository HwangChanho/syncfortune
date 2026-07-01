// src/app/(app)/month.tsx — 이달의 운세 (LLM 통변, ADR 개정 2026-06)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 오늘의 운세와 동일하게 LLM 통변 — 원국+대운+세운+이번 달 월건의 형충화합을 종합해
//   이달 생길 이슈와 대처까지 쉽게. Edge kind='monthly'(DAILY_READING_SYSTEM 공용).
// 접근: 프리미엄=무광고 자동 / 무료=보상형 광고 1회 → 생성. 캐시: readings(chart_id × 'monthly_YYYYMM' × lang).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDailyFortune, DAILY_AREA_KEYS, dailyHeadline, type DailyAreaKey } from '../../lib/dailyFortune';
import { loadRepChart, type SavedChart } from '../../lib/myChart';
import { ensureServerChartId } from '../../lib/prewarmReadings';
import { computeChart } from '../../lib/engine';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/subscription';
import { showRewardedAd } from '../../lib/ads';
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { logEvent } from '../../lib/logger';
import { invokeFail } from '../../lib/interpretResult'; // 방어: 일시적 불가/오류 친화 처리
import { assertOnline } from '../../lib/network'; // daniel: 네트워크/서버 미연결 시 풀이 생성 차단
import { setGenProgress } from '../../lib/genProgress'; // 일회성 진행도(daniel·docs/CONTENT_API_INVENTORY.md)
import type { Stem, Branch } from '@spec/chart';
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading, stemYinYang, branchYinYang } from '../../lib/ohaeng';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(가드 내장)
import { TTSButton } from '../../components/TTSButton'; // daniel: 풀이 음성 읽기(온디바이스 TTS·무료)

export default function MonthScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const f = useMemo(() => getDailyFortune(), []); // monthGanZhi(이번 달 월건)
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [reading, setReading] = useState<Record<string, string> | null>(null);
  const [area, setArea] = useState<DailyAreaKey>('general');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const stem = f.monthGanZhi[0] as Stem;
  const branch = f.monthGanZhi[1] as Branch;
  const category = `monthly_${f.date.slice(0, 7).replace('-', '')}`; // monthly_YYYYMM (월별 캐시)
  // 이달의 기운 한 줄 타이틀(온디바이스) — 이번 달 월건 기준. 명식 있으면 즉시.
  const headline = useMemo(() => { if (!saved) return null; try { return dailyHeadline(computeChart(saved.input).saju, stem, branch, 'month'); } catch { return null; } }, [saved, stem, branch]);

  useEffect(() => {
    let alive = true;
    setReading(null); setErr(null); setLoaded(false);
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const c = computeChart(ch.input);
      const id = await ensureServerChartId(c, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', category).eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      const cached = (data?.content as Record<string, string> | undefined) ?? null;
      setReading(cached);
      setLoaded(true);
      if (isPremium && !cached) generate(id);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, category, isPremium]);

  async function generate(id: string) {
    if (!assertOnline(t)) return; // daniel: 오프라인이면 풀이 진입(Edge 생성) 차단
    if (busy) return;
    setBusy(true); setErr(null);
    setGenProgress({ active: true, total: 1, done: 0, label: '이달의 운세', route: '/month' }); // 일회성 진행도(daniel)
    logEvent('monthly_generate', { chartId: id, category });
    try {
      const { data, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category, kind: 'monthly', gz: f.monthGanZhi, tier: 'paid', lang: appLang(), ...(saved?.context ? { context: saved.context } : {}) },
      });
      // 방어: 일시적 불가(200+unavailable)/오류 모두 친화 메시지로 처리(원문 'non-2xx' 노출 방지)
      const fail = invokeFail(data, error);
      if (fail) { logEvent(fail.kind === 'unavailable' ? 'monthly_unavailable' : 'monthly_error', { message: fail.message, retryAt: fail.retryAt }, 'error'); setErr(fail.message); }
      else setReading((data?.reading as Record<string, string>) ?? null);
    } catch (e: any) { logEvent('monthly_throw', { message: String(e?.message ?? e) }, 'error'); setErr(t('today.genFail', '풀이 생성에 실패했어요. 잠시 후 다시 시도해 주세요.')); }
    setGenProgress({ route: '/month', done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기'(daniel)
    setBusy(false);
  }

  async function onStart() {
    if (!chartId || busy) return;
    if (isPremium) { generate(chartId); return; }
    setBusy(true); setErr(null);                            // 광고 로딩 표시 — 무반응(daniel) 방지
    let earned = false;
    try { earned = await showRewardedAd(); } catch { /* 미시청/닫기 */ }
    setBusy(false);
    if (earned) generate(chartId);
    else setErr(t('today.adFail', '광고를 불러오지 못했어요. 잠시 후 다시 시도하거나, 프리미엄으로 광고 없이 보실 수 있어요.'));
  }

  const gzChip = (g: string, kind: 'stem' | 'branch') => {
    const el = kind === 'stem' ? stemElement(g) : branchElement(g);
    const ko = kind === 'stem' ? stemReading(g) : branchReading(g);
    const yy = kind === 'stem' ? stemYinYang(g) : branchYinYang(g); // daniel: 음양 표시
    return (
      <View style={[styles.gzChip, { backgroundColor: elementColor[el] }]}>
        <Text style={[styles.gzChipTx, { color: elementText[el] }]}>{g}</Text>
        <Text style={[styles.gzChipKo, { color: elementText[el] }]}>{ko} {yy}</Text>
      </View>
    );
  };

  return (
    <ImageBackground source={bgSource} style={styles.bgImage} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ContentHero image={require('../../../assets/icons/month.jpg')} title={t('month.title', '이달의 운세')} sub={t('month.heroSub', '이번 달 월건으로 보는 흐름')} />
        {/* 이번 달 월건 헤더 */}
        <View style={styles.pillarRow}>
          {gzChip(stem, 'stem')}
          {gzChip(branch, 'branch')}
          <View style={styles.pillarInfo}>
            <Text style={styles.pillarTitle}>{t('month.monthPillar')}</Text>
            <Text style={styles.pillarSub}>{f.yearGanZhi}년 {f.monthGanZhi}월</Text>
          </View>
        </View>

        {/* 타이틀 = API 본문 headline 우선(본문과 정합) / 로드 전엔 온디바이스 룰(즉시성) — daniel 07-01 */}
        {(reading?.headline || headline) && (
          <View style={styles.headlineCard}><Text style={styles.headlineTitle}>{reading?.headline || headline}</Text></View>
        )}

        {!loaded ? (
          <View style={styles.readCard}><ActivityIndicator color={colors.ju} /></View>
        ) : !session ? (
          // daniel(2026-06-24): 이달의 운세도 로그인 필요(LLM·서버차트·계정 귀속)
          <View style={styles.readCard}>
            <Text style={styles.readTx}>{t('month.needLogin', '이달의 운세는 로그인 후 볼 수 있어요.')}</Text>
            <Pressable style={styles.regBtn} onPress={() => router.push('/login')}>
              <Text style={styles.regBtnTx}>{t('login.go', '로그인')}</Text>
            </Pressable>
          </View>
        ) : !saved ? (
          <View style={styles.readCard}>
            <Text style={styles.readTx}>{t('today.needChart')}</Text>
            <Pressable style={styles.regBtn} onPress={() => router.push('/register')}>
              <Text style={styles.regBtnTx}>{t('today.registerBtn')}</Text>
            </Pressable>
          </View>
        ) : reading ? (
          <>
            <View style={styles.areaChips}>
              {DAILY_AREA_KEYS.map((k) => (
                <Pressable key={k} style={[styles.areaChip, area === k && styles.areaChipOn]} onPress={() => setArea(k)}>
                  <Text style={[styles.areaChipTx, area === k && styles.areaChipTxOn]}>{t(`today.area_${k}`)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.readCard}>
              {/* daniel #17: 신규 '투자' 영역이 구(舊) 캐시엔 없을 수 있음 → '실패' 대신 중립 안내 */}
              <Text style={[styles.readTx, { fontSize: fs(15), lineHeight: fs(26) }]}>{reading[area] || t('today.areaSoon', '이 분야 풀이는 다음 운세부터 채워져요.')}</Text>
            </View>
            {/* 이슈17: 풀이 결과 공유(content 없거나 error면 컴포넌트가 자체 미노출) */}
            <TTSButton reading={reading} />
            <ShareReadingButton kind="monthly" title={t('month.title', '이달의 운세')} content={reading} />
          </>
        ) : busy ? (
          <View style={styles.readCard}><ActivityIndicator color={colors.ju} /><Text style={styles.genWait}>{t('month.generating', '이번 달 흐름을 풀어내는 중…')}</Text></View>
        ) : (
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>{t('month.gateTitle', '이달의 운세 보기')}</Text>
            <Text style={styles.gateDesc}>{t('month.gateDesc', '타고난 사주에 지금의 큰 흐름·올해·이번 달 기운을 더해, 이달 생길 수 있는 일과 대처를 풀어 드려요.')}</Text>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Pressable style={styles.gateBtn} onPress={onStart}>
              <Text style={styles.gateBtnTx}>{isPremium ? t('month.seePremium', '이달의 운세 보기') : t('today.seeAd', '광고 보고 무료로 보기')}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sub}>{t('month.note')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  headlineCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(3.5), paddingHorizontal: space(4), marginBottom: space(4), alignItems: 'center', ...shadow.card },
  headlineTitle: { ...font.body, color: colors.ju, fontWeight: '800', fontSize: 17, textAlign: 'center', lineHeight: 24 },
  pillarRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(2.5),
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    padding: space(3.5), marginBottom: space(4), ...shadow.card,
  },
  gzChip: { width: 40, height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  gzChipTx: { fontSize: 20, fontWeight: '800' },
  gzChipKo: { fontSize: 10, fontWeight: '600', marginTop: -1 },
  pillarInfo: { flex: 1, marginLeft: space(1.5) },
  pillarTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  pillarSub: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  areaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) },
  areaChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  areaChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  areaChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  areaChipTxOn: { color: colors.bg },
  readCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card, alignItems: 'center' },
  readTx: { ...font.body, color: colors.ink, lineHeight: 26, fontSize: 15, alignSelf: 'stretch' },
  genWait: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  gateCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(6), alignItems: 'center', ...shadow.card },
  gateTitle: { ...font.heading, color: colors.ink },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), marginBottom: space(5), lineHeight: 22 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3.25) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  err: { fontSize: 13, color: colors.ju, marginBottom: space(3), textAlign: 'center' },
  regBtn: { alignSelf: 'center', marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4.5), paddingVertical: space(2.25) },
  regBtnTx: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(5) },
});
