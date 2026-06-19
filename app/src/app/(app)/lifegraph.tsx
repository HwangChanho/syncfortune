// src/app/(app)/lifegraph.tsx — 인생 그래프 (대운별 용신 부합 곡선, LLM·스페셜 콘텐츠)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 점수=용신 부합도(LLM 정식 용신 판정). 10년 단위 대운 곡선 + 변곡점("전환점") + 현재 위치.
//   Edge kind='lifegraph' → {summary, decades:[{startAge,score,note,turning}]}. 점 탭하면 그 시기 해설.
// 접근: 프리미엄=무광고 자동 / 무료=보상형 광고 1회 → 생성. 캐시: readings(chart_id × 'lifegraph' × lang).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Dimensions, Image } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loadRepChart, type SavedChart } from '../../lib/myChart';
import { ensureServerChartId } from '../../lib/prewarmReadings';
import { computeChart } from '../../lib/engine';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/subscription';
import { Alert } from '../../lib/alert';
import { loadCredits } from '../../lib/coupons';
import { isAdmin } from '../../lib/admin'; // 스페셜 = 관리자 바로 / 그 외 쿠폰(크레딧)만
import { requireLoginForPurchase } from '../../lib/requireLogin';
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { logEvent } from '../../lib/logger';
import { useFontScale } from '../../lib/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay'; // unlock 자물쇠 애니 + 그 사이 LLM 분석
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환

type Decade = { startAge: number; score: number; note: string; turning: boolean; keyword?: string; focus?: string };
type LifeData = { summary: string; decades: Decade[]; yongsin?: string; peak?: string; caution?: string; advice?: string };

const W = Dimensions.get('window').width - space(5) * 2 - space(5) * 2; // 카드 내부 폭
const H = 170; // 곡선 높이

export default function LifeGraphScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 본문(읽는 글) 글자 크기 전역 배율
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [data, setData] = useState<LifeData | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // ChartPicker 로 대표 전환 시 재로드 트리거
  const gatingRef = useRef(false); // 결제 구간 연타 차단

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null); setLoaded(false); setSel(null);
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const c = computeChart(ch.input);
      const id = await ensureServerChartId(c, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      const { data: row } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', 'lifegraph').eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      const cached = (row?.content as LifeData | undefined) ?? null;
      setData(cached);
      setLoaded(true);
      if (isPremium && !cached) generate(id);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isPremium, reloadKey]);

  async function generate(id: string) {
    if (busy) return;
    setBusy(true); setErr(null);
    logEvent('lifegraph_generate', { chartId: id });
    try {
      const { data: res, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category: 'lifegraph', kind: 'lifegraph', tier: 'paid', lang: appLang() },
      });
      if (error) { logEvent('lifegraph_error', { message: error.message }, 'error'); setErr(t('life.genFail', '생성에 실패했어요. 잠시 후 다시 시도해 주세요.')); }
      else setData((res?.reading as LifeData) ?? null);
    } catch (e: any) { logEvent('lifegraph_throw', { message: String(e?.message ?? e) }, 'error'); setErr(t('life.genFail', '생성에 실패했어요. 잠시 후 다시 시도해 주세요.')); }
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
        if ((credits['lifegraph'] ?? 0) <= 0) { Alert.alert(t('life.gateTitle', '인생 그래프'), t('special.couponOnly', '쿠폰(이용권)으로 열 수 있어요. 설정에서 쿠폰을 등록하거나 관리자에게 문의하세요.')); return; }
      }
    } catch (e: any) { logEvent('lifegraph_gate_error', { message: String(e?.message ?? e) }, 'error'); return; }
    finally { gatingRef.current = false; }
    generate(chartId);                                                              // 관리자·프리미엄=우회 / 크레딧=서버 차감
  }

  // ── 곡선 좌표 계산 ──
  const decs = data?.decades ?? [];
  const n = decs.length;
  // 현재 대운(클라 계산 — LLM 출력엔 없음). 곡선에서 '지금 위치' 마커로 강조.
  const curAge = useMemo(() => (saved ? computeChart(saved.input).saju.currentLuck?.startAge : undefined), [saved]);
  // 진폭 확대(daniel): 점수를 0~100 그대로 매핑하면 30~80에 몰려 밋밋 → 보이는 min~max 를 위아래로 stretch.
  const scoreVals = decs.map((d) => Math.max(0, Math.min(100, d.score)));
  const sLo = scoreVals.length ? Math.min(...scoreVals) : 0;
  const sHi = scoreVals.length ? Math.max(...scoreVals) : 100;
  const PAD = 0.1; // 위아래 10% 여백(점·라벨 안 잘리게)
  const normY = (s: number) => (sHi > sLo ? (s - sLo) / (sHi - sLo) : 0.5);
  const pts = decs.map((d, i) => ({
    x: n <= 1 ? W / 2 : (i / (n - 1)) * W,
    y: H - (PAD + normY(Math.max(0, Math.min(100, d.score))) * (1 - 2 * PAD)) * H,
    d, i, current: d.startAge === curAge,
  }));
  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      {/* 상단 hero 배너(daniel: 인생그래프 썰렁 → 이미지). 가로 1344×768 cover */}
      <Image source={require('../../../assets/icons/lifegraph-hero.png')} style={{ width: '100%', height: 160, borderRadius: radius.lg, marginBottom: space(4) }} resizeMode="cover" />
      <UnlockOverlay visible={busy} message={t('life.generating', '인생 흐름을 그리는 중…')} />
      {!loaded ? (
        <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>
      ) : !saved ? (
        <View style={styles.card}>
          <Text style={styles.body}>{t('manse.empty', '먼저 명식을 등록해 주세요.')}</Text>
          <Pressable style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart', '내 명식 등록')}</Text></Pressable>
        </View>
      ) : data && n ? (
        <>
          <Text style={[styles.summary, { fontSize: fs(15), lineHeight: fs(24) }]}>{data.summary}</Text>
          {/* 나에게 필요한 기운(용신) */}
          {data.yongsin ? (
            <View style={styles.yongsinCard}>
              <Text style={styles.yongsinLabel}>{t('life.yongsin', '나에게 필요한 기운')}</Text>
              <Text style={[styles.yongsinTx, { fontSize: fs(15), lineHeight: fs(23) }]}>{data.yongsin}</Text>
            </View>
          ) : null}
          {/* 곡선 차트 */}
          <View style={styles.chartCard}>
            <Svg width={W} height={H + 24}>
              {/* 기준선(50점) */}
              <Line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={colors.line} strokeWidth={1} strokeDasharray="4 4" />
              <Polyline points={polyline} fill="none" stroke={colors.ju} strokeWidth={2.5} />
              {pts.map((p) => (
                <Circle
                  key={p.i} cx={p.x} cy={p.y}
                  r={p.d.turning ? 7 : 5}
                  fill={p.current ? colors.bg : p.d.turning ? '#E5484D' : colors.ju}
                  stroke={p.current ? colors.ju : p.d.turning ? '#E5484D' : colors.ju}
                  strokeWidth={p.current ? 3 : 1}
                  onPress={() => setSel(p.i)}
                />
              ))}
            </Svg>
            {/* x축 나이 라벨(처음·중간·끝만 — 겹침 방지) */}
            <View style={styles.axisRow}>
              {pts.map((p) => (
                <Text key={p.i} style={[styles.axisTx, sel === p.i && styles.axisTxOn]} onPress={() => setSel(p.i)}>{p.d.startAge}</Text>
              ))}
            </View>
          </View>
          {/* 선택한(또는 현재) 대운 해설 */}
          {(() => {
            const pick = sel != null ? decs[sel] : decs.find((d) => (d as any).turning) ?? decs[0];
            if (!pick) return null;
            return (
              <View style={styles.noteCard}>
                <Text style={styles.noteAge}>{pick.startAge}~{pick.startAge + 9}세 · {pick.score}점{pick.turning ? ' · 전환점' : ''}</Text>
                {pick.keyword ? <Text style={styles.noteKeyword}>{pick.keyword}</Text> : null}
                <Text style={[styles.noteTx, { fontSize: fs(15), lineHeight: fs(23) }]}>{pick.note}</Text>
                {pick.focus ? <Text style={styles.noteFocus}>{t('life.focus', '집중')}: {pick.focus}</Text> : null}
              </View>
            );
          })()}
          <Text style={styles.hint}>{t('life.hint', '곡선의 점을 눌러 그 시기를 자세히 볼 수 있어요.')}</Text>
          {/* 전성기 · 다지는 시기 · 평생 조언 */}
          {data.peak ? (
            <View style={[styles.infoCard, styles.peakCard]}>
              <Text style={styles.infoLabel}>✦ {t('life.peak', '가장 빛나는 시기')}</Text>
              <Text style={[styles.infoTx, { fontSize: fs(15), lineHeight: fs(23) }]}>{data.peak}</Text>
            </View>
          ) : null}
          {data.caution ? (
            <View style={[styles.infoCard, styles.cautionCard]}>
              <Text style={[styles.infoLabel, { color: '#E5484D' }]}>● {t('life.caution', '다지고 조심할 시기')}</Text>
              <Text style={[styles.infoTx, { fontSize: fs(15), lineHeight: fs(23) }]}>{data.caution}</Text>
            </View>
          ) : null}
          {data.advice ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{t('life.advice', '평생 이렇게')}</Text>
              <Text style={[styles.infoTx, { fontSize: fs(15), lineHeight: fs(23) }]}>{data.advice}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.gateCard}>
          <Text style={styles.gateTitle}>{t('life.gateTitle', '인생 그래프')}</Text>
          <Text style={styles.gateDesc}>{t('life.gateDesc', '타고난 기운에 필요한 흐름을 기준으로, 10년 단위 인생 곡선과 전환점을 그려 드려요.')}</Text>
          <View style={styles.previewBox}>
            <Text style={styles.previewHead}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
            {[t('life.pv1', '나에게 필요한 기운'), t('life.pv2', '10년 단위 인생 곡선'), t('life.pv3', '인생의 전환점'), t('life.pv4', '가장 빛나는 시기'), t('life.pv5', '다지고 조심할 시기')].map((p, i) => <Text key={i} style={styles.previewItem}>· {p}</Text>)}
          </View>
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <Pressable style={styles.gateBtn} onPress={onStart}>
            <Text style={styles.gateBtnTx}>{isPremium ? t('life.see', '인생 그래프 보기') : t('life.seePaid', '인생 그래프 보기 (₩3,900)')}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(6), alignItems: 'center', ...shadow.card },
  body: { ...font.body, color: colors.ink, textAlign: 'center' },
  summary: { ...font.body, color: colors.ink, lineHeight: 24, marginBottom: space(4) },
  chartCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(2) },
  axisTx: { ...font.caption, color: colors.inkFaint, fontSize: 10 },
  axisTxOn: { color: colors.ju, fontWeight: '800' },
  noteCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(4), marginTop: space(4), ...shadow.card },
  noteAge: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(1.5) },
  noteTx: { ...font.body, color: colors.ink, lineHeight: 23 },
  hint: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4) },
  wait: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  gateCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(6), alignItems: 'center', ...shadow.card },
  gateTitle: { ...font.heading, color: colors.ink },
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', color: colors.ju, marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), marginBottom: space(5), lineHeight: 22 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3.25) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  err: { fontSize: 13, color: colors.ju, marginBottom: space(3), textAlign: 'center' },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6), marginTop: space(4) },
  ctaTx: { color: colors.bg, fontWeight: '800' },
  yongsinCard: { backgroundColor: colors.juSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(4), marginBottom: space(4) },
  yongsinLabel: { fontSize: 12, fontWeight: '800', color: colors.ju, marginBottom: space(1.5), letterSpacing: 1 },
  yongsinTx: { ...font.body, color: colors.ink, lineHeight: 23 },
  noteKeyword: { fontSize: 17, fontWeight: '900', color: colors.ju, marginVertical: space(1.5) },
  noteFocus: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginTop: space(3) },
  peakCard: { borderColor: colors.ju, borderWidth: 1.5 },
  cautionCard: { borderColor: '#E5484D', borderWidth: 1.5 },
  infoLabel: { fontSize: 13, fontWeight: '800', color: colors.ju, marginBottom: space(1.5) },
  infoTx: { ...font.body, color: colors.ink, lineHeight: 23 },
});
