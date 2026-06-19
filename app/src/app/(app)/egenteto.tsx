// src/app/(app)/egenteto.tsx — 에겐 vs 테토 (가볍게 보기) — 점수=온디바이스, 설명=LLM(광고/프리미엄)
// ─────────────────────────────────────────────────────────────────────────
// daniel stance: 관성·상관·비겁=테토(직진·주도) / 식신·인성=에겐(여유·수용) / 재성=중립.
//   ① 점수(0=에겐~100=테토)·판정은 egenTeto.ts 가 온디바이스 산출 → 명식만 있으면 막대로 즉시 표시(API 0).
//   ② 성향 *설명*(headline/성격/관계/요즘 흐름)만 Edge kind='egen' LLM — today 패턴(프리미엄 자동 / 무료 보상형 광고).
//   캐시: readings(chart_id × 'egen' × lang). 가볍게 보기(secLight) 재미·공유 콘텐츠라 영구 캐시(재방문 비용 0).
//   ※ 점수는 현재 운(대운·세운)을 반영해 매번 최신 산출되나 설명은 1회 캐시 — 운 변동 시 미세 불일치 허용(가벼운 콘텐츠, daniel 검수 슬롯).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, Pressable, ActivityIndicator, type DimensionValue } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loadRepChart, type SavedChart } from '../../lib/myChart';
import { ensureServerChartId } from '../../lib/prewarmReadings';
import { computeChart } from '../../lib/engine';
import { egenTeto, type EgenTetoResult } from '../../lib/egenTeto';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/subscription';
import { showRewardedAd } from '../../lib/ads'; // 보상형 광고 1회 = 설명 생성(무료 — API 비용 광고로 커버)
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { logEvent } from '../../lib/logger';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { ChartPicker } from '../../components/ChartPicker'; // 명식 선택(대표 전환) — 명식별 성향(daniel)

// LLM 설명 결과(EGEN_SYSTEM JSON) — 4섹션 모두 문자열
type EgenReading = { headline?: string; personality?: string; relationship?: string; nowTrend?: string };

export default function EgenTetoScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [result, setResult] = useState<EgenTetoResult | null>(null); // 온디바이스 점수(즉시)
  const [reading, setReading] = useState<EgenReading | null>(null);   // LLM 설명(게이트)
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // ChartPicker 로 대표 전환 시 재로드 트리거

  const category = 'egen'; // chart_id × 'egen' × lang 캐시 키

  // 대표 명식 → 온디바이스 점수 산출 → 서버차트 → 캐시 로드. 프리미엄 + 캐시 없으면 자동 생성.
  useEffect(() => {
    let alive = true;
    setReading(null); setResult(null); setErr(null); setLoaded(false);
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch);
      if (!ch) { setLoaded(true); return; }
      // 점수는 온디바이스 — 로그인/서버 없이도 즉시 산출(명식만 있으면)
      const c = computeChart(ch.input);
      const res = egenTeto(c.saju);
      if (!alive) return;
      setResult(res);
      if (!session) { setLoaded(true); return; } // 비로그인 = 점수만(설명 LLM은 로그인 필요)
      const id = await ensureServerChartId(c, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', category).eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      const cached = (data?.content as EgenReading | undefined) ?? null;
      setReading(cached);
      setLoaded(true);
      if (isPremium && !cached) generate(id, res); // 프리미엄 = 무광고 자동 생성
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isPremium, reloadKey]);

  // LLM 설명 생성 — 점수·판정·근거를 body 로 전달(Edge 는 점수 재계산 없이 설명만). 캐시는 Edge 가 저장.
  async function generate(id: string, res: EgenTetoResult) {
    if (busy) return;
    setBusy(true); setErr(null);
    logEvent('egen_generate', { chartId: id, score: res.tetoScore, type: res.type });
    try {
      const { data, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category, kind: 'egen', egenScore: res.tetoScore, egenType: res.type, egenReasons: res.reasons, tier: 'paid', lang: appLang() },
      });
      if (error) { logEvent('egen_error', { message: error.message }, 'error'); setErr(t('egen.genFail', '설명을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')); }
      else setReading((data?.reading as EgenReading) ?? null);
    } catch (e: any) { logEvent('egen_throw', { message: String(e?.message ?? e) }, 'error'); setErr(t('egen.genFail', '설명을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')); }
    setBusy(false);
  }

  // 무료 = 보상형 광고 1회 시청 후 생성 / 프리미엄 = 바로(이미 자동이나 버튼도 허용).
  async function onStart() {
    if (!chartId || !result || busy) return;
    if (isPremium) { generate(chartId, result); return; }
    setBusy(true); setErr(null);              // 광고 로딩 표시 — 무반응 방지
    let earned = false;
    try { earned = await showRewardedAd(); } catch { /* 미시청/닫기 */ }
    setBusy(false);
    if (earned) generate(chartId, result);
    else setErr(t('egen.adFail', '광고를 불러오지 못했어요. 잠시 후 다시 시도하거나, 프리미엄으로 광고 없이 보실 수 있어요.'));
  }

  // 타입 → 라벨(에겐형/테토형/균형형)
  const typeLabel = (ty: EgenTetoResult['type']) =>
    ty === 'teto' ? t('egen.typeTeto', '테토형') : ty === 'egen' ? t('egen.typeEgen', '에겐형') : t('egen.typeBalanced', '균형형');

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bgImage} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재산출 */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        <Text style={styles.title}>{t('egen.title', '에겐 vs 테토')}</Text>
        <Text style={styles.heroSub}>{t('egen.heroSub', '내 사주로 보는 에겐·테토 성향')}</Text>

        {!loaded ? (
          <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>
        ) : !saved ? (
          // 명식 미등록 — 등록 유도
          <View style={styles.card}>
            <Text style={styles.readTx}>{t('egen.needChart', '먼저 명식을 등록해 주세요.')}</Text>
            <Pressable style={styles.regBtn} onPress={() => router.push('/register')}>
              <Text style={styles.regBtnTx}>{t('egen.registerBtn', '명식 등록하기')}</Text>
            </Pressable>
          </View>
        ) : result ? (
          <>
            {/* 점수 비주얼(온디바이스 — 즉시 표시, 게이트 무관) */}
            <View style={styles.scoreCard}>
              <Text style={styles.scoreBadge}>{typeLabel(result.type)}</Text>
              <Text style={styles.scoreNum}>{t('egen.tetoPower', '테토력')} {result.tetoScore}<Text style={styles.scoreNumUnit}>%</Text></Text>
              <View style={styles.barRow}>
                <Text style={[styles.barEnd, result.type === 'egen' && styles.barEndOn]}>{t('egen.scaleEgen', '에겐')}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${result.tetoScore}%` as DimensionValue }]} />
                  <View style={[styles.dot, { left: `${result.tetoScore}%` as DimensionValue }]} />
                </View>
                <Text style={[styles.barEnd, styles.barEndRight, result.type === 'teto' && styles.barEndOn]}>{t('egen.scaleTeto', '테토')}</Text>
              </View>
            </View>

            {reading ? (
              // 설명(LLM) — headline + 3섹션
              <>
                {reading.headline ? <Text style={styles.headline}>{reading.headline}</Text> : null}
                {([['personality', 'secPersonality'], ['relationship', 'secRelationship'], ['nowTrend', 'secNowTrend']] as const).map(([k, lk]) =>
                  reading[k] ? (
                    <View key={k} style={styles.secCard}>
                      <Text style={styles.secTitle}>{t(`egen.${lk}`)}</Text>
                      <Text style={[styles.readTx, { fontSize: fs(15), lineHeight: fs(25) }]}>{reading[k]}</Text>
                    </View>
                  ) : null,
                )}
              </>
            ) : busy ? (
              // 생성 중(프리미엄 자동 또는 광고 후)
              <View style={styles.card}><ActivityIndicator color={colors.ju} /><Text style={styles.genWait}>{t('egen.generating', '성향을 분석하는 중…')}</Text></View>
            ) : (
              // 미생성 — 무료=광고 보고 보기 / 프리미엄은 위 useEffect 가 자동 생성
              <View style={styles.gateCard}>
                <Text style={styles.gateTitle}>{t('egen.gateTitle', '내 성향 설명 보기')}</Text>
                <Text style={styles.gateDesc}>{t('egen.gateDesc', '점수에 맞춰, 내 성향이 평소·연애·요즘 흐름에서 어떻게 드러나는지 가볍게 풀어 드려요.')}</Text>
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <Pressable style={styles.gateBtn} onPress={onStart}>
                  <Text style={styles.gateBtnTx}>{isPremium ? t('egen.seePremium', '성향 설명 보기') : t('egen.seeAd', '광고 보고 무료로 보기')}</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : null}

        <Text style={styles.note}>{t('egen.note', '※ 사주로 가볍게 보는 성향 테스트예요. 재미로 즐겨 주세요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)' },
  wrap: { padding: space(6), paddingBottom: space(12) },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(2) },
  heroSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(4) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card, alignItems: 'center' },
  // 점수 카드(온디바이스)
  scoreCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(4), ...shadow.card, alignItems: 'center' },
  scoreBadge: { fontSize: 14, fontWeight: '800', color: colors.bg, backgroundColor: colors.ju, paddingHorizontal: space(3.5), paddingVertical: space(1.25), borderRadius: radius.pill, overflow: 'hidden' },
  scoreNum: { fontSize: 34, fontWeight: '900', color: colors.ink, marginTop: space(3) },
  scoreNumUnit: { fontSize: 20, fontWeight: '800', color: colors.inkSoft },
  barRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: space(4) },
  barEnd: { fontSize: 13, fontWeight: '700', color: colors.inkFaint, width: 44 },
  barEndRight: { textAlign: 'right' },
  barEndOn: { color: colors.ju, fontWeight: '900' },
  track: { flex: 1, height: 8, backgroundColor: colors.line, borderRadius: 4, marginHorizontal: space(2.5), position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.ju, borderRadius: 4 },
  dot: { position: 'absolute', top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ju, borderWidth: 3, borderColor: colors.card, marginLeft: -9 },
  // headline + 섹션(LLM)
  headline: { fontSize: 19, fontWeight: '900', color: colors.ink, textAlign: 'center', lineHeight: 28, marginBottom: space(4), paddingHorizontal: space(2) },
  secCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4.5), marginBottom: space(3), ...shadow.card },
  secTitle: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  readTx: { ...font.body, color: colors.ink, lineHeight: 25, fontSize: 15, alignSelf: 'stretch' },
  genWait: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  // 게이트(광고/프리미엄)
  gateCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(6), alignItems: 'center', ...shadow.card },
  gateTitle: { ...font.heading, color: colors.ink },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), marginBottom: space(5), lineHeight: 22 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3.25) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  err: { fontSize: 13, color: colors.ju, marginBottom: space(3), textAlign: 'center' },
  regBtn: { alignSelf: 'center', marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4.5), paddingVertical: space(2.25) },
  regBtnTx: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(5) },
});
