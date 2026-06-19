// src/app/(app)/newyear.tsx — 신년운세 패키지 (스페셜) — 신년 전용 LLM(연운과 분리)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-06 '신년 전용 차별화': 타임라인(연도 탐색)과 포지션 분리. 올해 1년에만 몰입한 시즌 상품.
//   = 올해의 키워드 + 새해 총평 + 분야 5(통합·직업·재물·애정·건강) + 12개월 캘린더 + 삼재 대처 + 올해 다짐.
//   Edge kind='newyear'(NEWYEAR_READING_SYSTEM) · 캐시 category='newyear_YYYY'(연운 year_YYYY와 안 겹침).
//   삼재(lib/samjae 온디바이스)는 배지로 즉시 표시 + body로 Edge에 전달(LLM 대처문 samjaeAdvice 생성).
//   접근: 프리미엄=무광고 자동 / 무료=보상형 광고 1회. §4 안전: 삼재=흉 단정 금지(전향적).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDailyFortune } from '../../lib/dailyFortune';
import { loadRepChart, type SavedChart } from '../../lib/myChart';
import { ensureServerChartId } from '../../lib/prewarmReadings';
import { computeChart } from '../../lib/engine';
import { samjaeStatus } from '../../lib/samjae';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/subscription';
import { Alert } from '../../lib/alert';
import { loadCredits } from '../../lib/coupons';
import { isAdmin } from '../../lib/admin'; // 스페셜 = 관리자 바로 / 그 외 쿠폰(크레딧)만
import { requireLoginForPurchase } from '../../lib/requireLogin';
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { logEvent } from '../../lib/logger';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay'; // unlock 자물쇠 애니 + 그 사이 LLM 분석
import { ContentHero } from '../../components/SpecialContentScreen'; // 공용 히어로
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { NewyearWheel } from '../../components/contentMotifs'; // 12달 수레바퀴 모티프
import { useFontScale } from '../../lib/fontScale';

// 신년 패키지 분야 8(daniel: 컨텐츠 강화 — 통합·직업·재물·애정·건강·대인·배움·이동)
const AREAS: { key: string; ko: string }[] = [
  { key: 'general', ko: '통합' }, { key: 'work', ko: '직업' }, { key: 'money', ko: '재물' },
  { key: 'love', ko: '애정' }, { key: 'marriage', ko: '결혼' }, { key: 'health', ko: '건강' },
  { key: 'social', ko: '대인' }, { key: 'growth', ko: '배움' }, { key: 'move', ko: '이동' },
];

export default function NewYearScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const f = useMemo(() => getDailyFortune(), []);
  const year = Number(f.date.slice(0, 4));
  const yearBranch = f.yearGanZhi[1]; // 올해 지지(삼재 판정용)
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [area, setArea] = useState('general');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // ChartPicker 로 대표 전환 시 재로드 트리거
  const gatingRef = useRef(false); // 결제 구간 연타 차단

  const category = `newyear_${year}`; // 연운(year_YYYY)과 분리된 신년 전용 캐시
  // 삼재(온디바이스) — 태어난 해 지지 vs 올해 지지
  const samjae = useMemo(() => {
    if (!saved) return null;
    const yb = computeChart(saved.input).saju.pillars['년']?.branch;
    return yb ? samjaeStatus(yb, yearBranch) : null;
  }, [saved, yearBranch]);

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null); setLoaded(false);
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const c = computeChart(ch.input);
      const id = await ensureServerChartId(c, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      const { data: row } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', category).eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      const cached = (row?.content as Record<string, any> | undefined) ?? null;
      setData(cached);
      setLoaded(true);
      if (isPremium && !cached) generate(id);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, category, isPremium, reloadKey]);

  async function generate(id: string) {
    if (busy) return;
    setBusy(true); setErr(null);
    logEvent('newyear_generate', { chartId: id, category });
    try {
      // 신년 전용 — kind='newyear' + 삼재(온디바이스 계산값) body 전달
      const { data: res, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category, kind: 'newyear', samjae: samjae ?? undefined, tier: 'paid', lang: appLang(), ...(saved?.context ? { context: saved.context } : {}) },
      });
      if (error) { logEvent('newyear_error', { message: error.message }, 'error'); setErr(t('today.genFail', '생성에 실패했어요. 잠시 후 다시 시도해 주세요.')); }
      else setData((res?.reading as Record<string, any>) ?? null);
    } catch (e: any) { logEvent('newyear_throw', { message: String(e?.message ?? e) }, 'error'); setErr(t('today.genFail', '생성에 실패했어요. 잠시 후 다시 시도해 주세요.')); }
    setBusy(false);
  }

  // 결제 게이트(서버 차감 통일·daniel 2026-06): 프리미엄=무료 / 비프리미엄=크레딧 보유시 통과(서버 차감), 없으면 결제→부여.
  //   ★실제 차감·검증은 Edge(consume_credit). 클라는 결제 UI + 사전 보유 확인(UX)만 — 우회·이중차감 방지.
  async function onStart() {
    if (!chartId || busy || gatingRef.current) return;
    if (isPremium) { generate(chartId); return; }
    gatingRef.current = true;                                                       // 게이트 구간 연타 차단
    try {
      const admin = await isAdmin();                                                // 관리자 = 바로 진입
      if (!admin) {
        if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
        const credits = await loadCredits();                                        // 쿠폰(이용권)만 unlock — 결제 미연동
        if ((credits['newyear'] ?? 0) <= 0) { Alert.alert(t('newyear.title', '신년운세'), t('special.couponOnly', '쿠폰(이용권)으로 열 수 있어요. 설정에서 쿠폰을 등록하거나 관리자에게 문의하세요.')); return; }
      }
    } catch (e: any) { logEvent('newyear_gate_error', { message: String(e?.message ?? e) }, 'error'); return; }
    finally { gatingRef.current = false; }
    generate(chartId);                                                              // 관리자·프리미엄=우회 / 크레딧=서버 차감
  }

  const months: string[] = Array.isArray(data?.months) ? data!.months : [];

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        <UnlockOverlay visible={busy} message={t('newyear.generating', '올 한 해를 풀어내는 중…')} />
        <ContentHero motif={<NewyearWheel />} image={require('../../../assets/icons/newyear-hero.jpg')} title={`${year}${t('newyear.title', '년 신년운세')}`} sub={t('newyear.heroSub', '올 한 해의 큰 흐름을 한눈에')} themeColor={colors.ju} />

        {/* 삼재 배지(온디바이스 즉시 — 생성 전에도 노출, 전향적 표현) */}
        {samjae && (
          <View style={[styles.samjae, samjae.isSamjae ? styles.samjaeOn : styles.samjaeOff]}>
            <Text style={styles.samjaeTx}>
              {samjae.isSamjae ? '⚠ 올해는 새 일보다 정비·건강·관계를 다지면 좋은 해예요' : '✓ 올해는 무난히 흘러가는 해예요'}
            </Text>
          </View>
        )}

        {!loaded ? (
          <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>
        ) : !saved ? (
          <View style={styles.card}>
            <Text style={styles.body}>{t('manse.empty', '먼저 명식을 등록해 주세요.')}</Text>
            <Pressable style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart', '내 명식 등록')}</Text></Pressable>
          </View>
        ) : data ? (
          <>
            {/* 올해의 키워드 + 총평 */}
            {typeof data.keyword === 'string' && (
              <View style={styles.keyCard}>
                <Text style={styles.keyLabel}>{t('newyear.keyword', '올해의 키워드')}</Text>
                <Text style={[styles.keyTx, { fontSize: fs(18) }]}>{data.keyword}</Text>
              </View>
            )}
            {typeof data.summary === 'string' && (
              <View style={styles.card}><Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.summary}</Text></View>
            )}
            {/* 올해의 행운 포인트 */}
            {typeof data.luckyPoints === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>{t('newyear.lucky', '올해의 행운 포인트')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.luckyPoints}</Text>
              </View>
            )}

            {/* 분야 8 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {AREAS.map((a) => (
                <Pressable key={a.key} style={[styles.chip, area === a.key && styles.chipOn]} onPress={() => setArea(a.key)}>
                  <Text style={[styles.chipTx, area === a.key && styles.chipTxOn]}>{a.ko}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.card}>
              <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{typeof data[area] === 'string' ? data[area] : t('today.genFail', '생성 실패')}</Text>
            </View>

            {/* 상·하반기 흐름 */}
            {(typeof data.firstHalf === 'string' || typeof data.secondHalf === 'string') && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.halves', '상반기 · 하반기')}</Text>
                {typeof data.firstHalf === 'string' && <Text style={[styles.halfTx, { fontSize: fs(14), lineHeight: fs(23) }]}><Text style={styles.halfLabel}>상반기  </Text>{data.firstHalf}</Text>}
                {typeof data.secondHalf === 'string' && <Text style={[styles.halfTx, { fontSize: fs(14), lineHeight: fs(23), marginTop: space(2.5) }]}><Text style={styles.halfLabel}>하반기  </Text>{data.secondHalf}</Text>}
              </View>
            )}

            {/* 12개월 캘린더 */}
            {months.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.months', '달별 캘린더')}</Text>
                {months.map((m, i) => (
                  <Text key={i} style={[styles.monthTx, { fontSize: fs(14), lineHeight: fs(22) }]}>{m}</Text>
                ))}
              </View>
            )}

            {/* 삼재 대처(LLM) */}
            {typeof data.samjaeAdvice === 'string' && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.samjaeAdvice', '올해 특히 챙길 점')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.samjaeAdvice}</Text>
              </View>
            )}

            {/* 올해 다짐 */}
            {typeof data.resolution === 'string' && (
              <View style={[styles.card, styles.resoCard]}>
                <Text style={styles.sectH}>{t('newyear.resolution', '올해를 이렇게')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.resolution}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.gate}>
            <Text style={styles.gateTitle}>{year}{t('newyear.title', '년 신년운세')}</Text>
            <Text style={styles.gateDesc}>{t('newyear.gateDesc', '올해의 키워드부터 분야별 운, 열두 달 캘린더, 새해 다짐까지 한 번에 정리해 드려요.')}</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewHead}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
              {[t('newyear.pv1', '올해의 키워드'), t('newyear.pv2', '분야별 운 8가지'), t('newyear.pv3', '열두 달 캘린더'), t('newyear.pv4', '상·하반기 흐름'), t('newyear.pv5', '올해 다질 점·새해 다짐')].map((p, i) => <Text key={i} style={styles.previewItem}>· {p}</Text>)}
            </View>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Pressable style={styles.gateBtn} onPress={onStart}>
              <Text style={styles.gateBtnTx}>{isPremium ? t('newyear.see', '신년운세 보기') : t('newyear.seePaid', '신년운세 보기 (₩6,900)')}</Text>
            </Pressable>
          </View>
        )}
        <Text style={styles.note}>{t('newyear.bottomNote', '※ 올 한 해의 큰 흐름이에요. 매일의 운세는 \'오늘의 운세\'에서 확인하세요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)' },
  wrap: { padding: space(6), paddingBottom: space(12) },
  h: { ...font.title, color: colors.ink, marginBottom: space(3) },
  samjae: { borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(4), marginBottom: space(4), borderWidth: 1 },
  samjaeOn: { backgroundColor: 'rgba(229,72,77,0.12)', borderColor: '#E5484D' },
  samjaeOff: { backgroundColor: 'rgba(34,31,68,0.6)', borderColor: colors.line },
  samjaeTx: { ...font.body, color: colors.ink, fontWeight: '700', fontSize: 14 },
  keyCard: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(5), marginBottom: space(3), ...shadow.card },
  keyLabel: { fontSize: 12, fontWeight: '800', color: colors.bg, opacity: 0.8, marginBottom: space(1.5), letterSpacing: 1 },
  keyTx: { fontSize: 18, fontWeight: '900', color: colors.bg, lineHeight: 26 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  resoCard: { borderColor: colors.ju, borderWidth: 1.5 },
  body: { ...font.body, color: colors.ink, lineHeight: 26, fontSize: 15 },
  sectH: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(3) },
  luckyCard: { borderColor: colors.ju, borderWidth: 1.5 },
  halfTx: { ...font.body, color: colors.ink },
  halfLabel: { color: colors.ju, fontWeight: '800' },
  chips: { gap: space(2), paddingVertical: space(1), marginBottom: space(2) },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTxOn: { color: colors.bg },
  monthTx: { ...font.body, color: colors.ink, marginBottom: space(2) },
  wait: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  gate: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(6), alignItems: 'center', ...shadow.card },
  gateTitle: { ...font.heading, color: colors.ink },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), marginBottom: space(5), lineHeight: 22 },
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', color: colors.ju, marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3.25) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  err: { fontSize: 13, color: colors.ju, marginBottom: space(3), textAlign: 'center' },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6), marginTop: space(4), alignSelf: 'center' },
  ctaTx: { color: colors.bg, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4) },
});
