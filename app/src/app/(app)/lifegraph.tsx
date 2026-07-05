// src/app/(app)/lifegraph.tsx — 인생 그래프 (대운별 용신 부합 곡선, LLM·스페셜 콘텐츠)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 점수=용신 부합도(LLM 정식 용신 판정). 10년 단위 대운 곡선 + 변곡점("전환점") + 현재 위치.
//   Edge kind='lifegraph' → {summary, decades:[{startAge,score,note,turning}]}. 점 탭하면 그 시기 해설.
// 접근: 프리미엄=무광고 자동 / 비프리미엄=결제(이용권·관리자)만 — 유료 콘텐츠라 보상형 광고 무료 생성 없음(daniel). 캐시: readings(chart_id × 'lifegraph' × lang).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { ExpiryNote } from '../../components/ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { Image as ExpoImage } from 'expo-image'; // hero 배너 — 다운샘플·디스크캐시(daniel: 이미지 캐시·로딩 가속)
import Svg, { Polyline, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { computeChart } from '../../lib/engine/engine';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/billing/subscription';
import { Alert } from '../../lib/ui/alert';
import { loadCredits } from '../../lib/billing/coupons';
import { isAdmin } from '../../lib/core/admin'; // 스페셜 = 관리자 바로 / 그 외 쿠폰(크레딧)만
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { confirmReadingChart } from '../../lib/ui/confirmChart'; // 생성 전 명식 확인 + 보유 이용권 안내(daniel)
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { invokeFail } from '../../lib/backend/interpretResult'; // 방어: Edge 실패(일시적 불가·결제필요·오류) 정규화
import { assertOnline } from '../../lib/backend/network'; // daniel: 네트워크/서버 미연결 시 풀이 생성 차단
import { logEvent } from '../../lib/backend/logger';
import { setGenProgress } from '../../lib/backend/genProgress'; // 일회성 진행도(daniel 이슈15)
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay'; // unlock 자물쇠 애니 + 그 사이 LLM 분석
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(가드 내장)
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import { LifeGraphTeaser } from '../../components/LifeGraphTeaser'; // 무료 온디바이스 곡선 티저(잠김 상태 퍼널 — 결정론 대운 곡선·전환점)

type Decade = { startAge: number; score: number; note: string; turning: boolean; keyword?: string; focus?: string };
type LifeData = { summary: string; decades: Decade[]; yongsin?: string; peak?: string; caution?: string; advice?: string; headline?: string };

const W = Dimensions.get('window').width - space(5) * 2 - space(5) * 2; // 카드 내부 폭
const H = 170; // 곡선 높이
const APolyline = Animated.createAnimatedComponent(Polyline); // 이슈18: 인생곡선 드로잉 애니

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
  const [expiry, setExpiry] = useState<string | null>(null); // 보유 만료일(생성일+1년) — 캐시 created_at으로 채움(daniel #25)
  const gatingRef = useRef(false); // 결제 구간 연타 차단
  const draw = useRef(new Animated.Value(0)).current; // 이슈18: 인생곡선 드로잉 진행값(0→1)

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
      const { data: row } = await supabase.from('readings').select('content, created_at').eq('chart_id', id).eq('category', 'lifegraph').eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      const cached = (row?.content as LifeData | undefined) ?? null;
      setData(cached);
      // 보유 만료일(daniel #25): 생성(구매)일 + 1년. 캐시 created_at 있을 때만(명식 전환 시 stale 방지 위해 else로 초기화).
      if (row?.created_at) { const d = new Date(row.created_at); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); } else setExpiry(null);
      setLoaded(true);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isPremium, reloadKey]);

  // 이슈18: 통변(곡선) 도착 시 곡선이 그려지는 애니(0→1). strokeDashoffset = useNativeDriver 미지원.
  useEffect(() => {
    if (data?.decades?.length) { draw.setValue(0); Animated.timing(draw, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // invoke 타임아웃/실패 시 readings 캐시를 폴링해 결과 회수(Edge가 서버에서 계속 생성·캐시하므로).
  //   무거운 인생그래프 풀이(대운별 용신 부합)는 Edge 생성이 87~103s → 클라 invoke가 먼저 끊겨도('Failed to send request')
  //   서버는 완료·캐시함. 그 캐시를 폴링해 로딩 유지한 채 결과를 받아온다(멈춤·"갑자기 완료" 해결, daniel 07-02).
  async function pollCachedReading(id: string, maxMs = 135000, everyMs = 3500): Promise<any | null> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, everyMs));
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', 'lifegraph').eq('lang', appLang()).maybeSingle();
      if (data?.content) return data.content;
    }
    return null;
  }

  async function generate(id: string) {
    if (!assertOnline(t)) return; // daniel: 오프라인이면 풀이 진입(Edge 생성) 차단
    if (busy) return;
    setBusy(true); setErr(null);
    setGenProgress({ active: true, total: 1, done: 0, label: '인생 그래프', route: '/lifegraph' }); // 일회성 진행도(daniel 이슈15)
    logEvent('lifegraph_generate', { chartId: id });
    try {
      const { data: res, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category: 'lifegraph', kind: 'lifegraph', tier: 'paid', lang: appLang() },
      });
      const f = invokeFail(res, error); // 방어: 일시적 불가→재시도 안내 / 결제필요·오류 일관 처리
      if (f && f.kind !== 'error') {
        // unavailable/needPayment = 200 빠른 실패(Edge가 긴 생성을 시작 안 함) → 폴링 없이 즉시 친화 문구
        logEvent('lifegraph_fail', { kind: f.kind, message: error?.message }, 'error');
        setErr(f.message);
      } else if (error || !res?.reading) {
        // ★클라 invoke가 끊기거나(무거운 풀이 타임아웃) 응답이 비어도 Edge는 서버에서 완료·캐시 → 캐시 폴링으로 회수(로딩 유지).
        logEvent('lifegraph_fail', { kind: 'timeout', message: error?.message ?? 'no reading', polling: true }, 'error');
        const cached = await pollCachedReading(id);
        if (cached) setData(cached);
        else setErr(f?.message ?? t('life.genFail', '생성에 실패했어요. 잠시 후 다시 시도해 주세요.'));
      } else setData((res?.reading as LifeData) ?? null);
    } catch (e: any) {
      // fetch throw(타임아웃 등)도 동일 — 서버가 완료·캐시했으면 폴링으로 회수, 아니면 오류 표시.
      logEvent('lifegraph_throw', { message: String(e?.message ?? e) }, 'error');
      const cached = await pollCachedReading(id);
      if (cached) setData(cached);
      else setErr(t('life.genFail', '생성에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    }
    setGenProgress({ route: '/lifegraph', done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기'(daniel 이슈15)
    setBusy(false);
  }

  // 생성 전 '이 명식으로 풀이할지' 확인(+보유 이용권) → 확인 시 doStart(daniel 07-02).
  function onStart() {
    if (!chartId || busy || gatingRef.current) return;
    void confirmReadingChart({ chartLabel: saved?.label, creditKind: 'lifegraph', t, onConfirm: () => { void doStart(); } });
  }
  // 결제 게이트(서버 차감 통일·daniel 2026-06): 프리미엄=무료 / 비프리미엄=크레딧 보유시 통과(서버 차감), 없으면 결제→부여.
  //   ★실제 차감·검증은 Edge(consume_credit). 클라는 결제 UI + 사전 보유 확인(UX)만 — 우회·이중차감 방지.
  async function doStart() {
    if (!chartId || busy || gatingRef.current) return;
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
  // 대표 명식 산출(현재 대운 마커 + 무료 티저 곡선 공용) — 한 번만 계산해 재사용.
  const c = useMemo(() => (saved ? computeChart(saved.input) : null), [saved]);
  // 현재 대운(클라 계산 — LLM 출력엔 없음). 곡선에서 '지금 위치' 마커로 강조.
  const curAge = c?.saju.currentLuck?.startAge;
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
  // 이슈18: 곡선 총 길이(드로잉 dash 기준) — 점 사이 거리 합.
  const pathLen = (() => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return Math.max(L, 1); })();
  // ★daniel 07-03: 강조(밴드+나이) 기본값 = 현재 대운(없으면 전환점). sel=null(최초 로드/풀이 직후)에도
  //   그래프 하이라이트가 아래 해설카드(기본 현재/전환점)와 일치하게 — '풀이중엔 하이라이트 없음' 불일치 해소.
  const effSel: number | null = sel != null ? sel
    : (() => { const ci = pts.findIndex((p) => p.current); if (ci >= 0) return ci; const tt = decs.findIndex((d) => (d as any).turning); return tt >= 0 ? tt : null; })();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      {/* 상단 hero 배너(daniel: 인생그래프 썰렁 → 이미지). 가로 1344×768 cover */}
      <ExpoImage source={require('../../../assets/icons/lifegraph-hero.jpg')} style={{ width: '100%', height: 190, borderRadius: radius.lg, marginBottom: space(4) }} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      <UnlockOverlay visible={busy} message={t('life.generating', '인생 흐름을 그리는 중…')} />
      {!loaded ? (
        <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>
      ) : !saved ? (
        <View style={styles.card}>
          <Text style={styles.body}>{t('manse.empty', '먼저 명식을 등록해 주세요.')}</Text>
          <PressableScale style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart', '내 명식 등록')}</Text></PressableScale>
        </View>
      ) : data && n ? (
        <>
          {/* 풀이 보유 만료일 — 공통 컴포넌트(daniel 07-01) */}
          <ExpiryNote expiry={expiry} chartId={chartId} />
          {/* 이슈19 소제목 — 통변 결과 headline 있으면 그래프·섹션 맨 위에 한 줄 강조 */}
          {typeof data.headline === 'string' && data.headline.trim() ? (
            <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: fs(26) }}>{data.headline}</Text>
          ) : null}
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
              {/* 터치 영역 확대 + 선택 시 세로 연한 밴드(daniel 07-01) — 각 시기 '열' 전체가 터치·강조되게 */}
              {pts.map((p) => {
                const half = (n > 1 ? W / (n - 1) : W) / 2;
                const x0 = Math.max(0, p.x - half);
                const x1 = Math.min(W, p.x + half);
                return (
                  <Rect key={`band-${p.i}`} x={x0} y={0} width={Math.max(1, x1 - x0)} height={H + 24}
                    fill={effSel === p.i ? colors.ju : 'transparent'} fillOpacity={effSel === p.i ? 0.12 : 1}
                    onPress={() => setSel(p.i)} />
                );
              })}
              {/* 기준선(50점) */}
              <Line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={colors.line} strokeWidth={1} strokeDasharray="4 4" />
              <APolyline points={polyline} fill="none" stroke={colors.ju} strokeWidth={2.5} strokeDasharray={pathLen} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [pathLen, 0] })} />
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
              {/* x축 나이 라벨 — SVG 안에 점 x 위치 기준 '중앙정렬'(밴드와 정렬 + 밴드 height가 숫자까지 덮음, daniel 07-03).
                  양끝(첫·끝)은 화면 밖 클리핑 방지로 start/end 앵커. 강조 시기는 밴드 정중앙에 굵은 골드로. */}
              {pts.map((p) => (
                <SvgText key={`age-${p.i}`} x={p.x} y={H + 17}
                  fontSize={11} fontWeight={effSel === p.i ? '800' : '400'}
                  fill={effSel === p.i ? colors.ju : colors.inkFaint}
                  textAnchor={p.i === 0 ? 'start' : p.i === n - 1 ? 'end' : 'middle'}
                  onPress={() => setSel(p.i)}>{p.d.startAge}</SvgText>
              ))}
            </Svg>
          </View>
          {/* 선택한(또는 현재) 대운 해설 */}
          {(() => {
            const pick = effSel != null ? decs[effSel] : decs[0]; // 밴드 강조(effSel)와 동일 시기 해설
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
          {/* 풀이 음성 읽기(온디바이스 TTS·무료) — 요약·시기별 해설을 순서대로 읽음(decades 배열은 text 없어 자동 제외) */}
          <TTSButton reading={data} />
          {/* 이슈17: 풀이 결과 공유(content 없거나 error면 컴포넌트가 자체 미노출) */}
          <ShareReadingButton kind="lifegraph" title={t('life.gateTitle', '인생 그래프')} content={data} />
        </>
      ) : (
        <>
          {/* 무료 온디바이스 곡선 티저(daniel 프리미엄 퍼널) — 결정론 대운 곡선·전환점을 잠김 상태에서 먼저 무료로.
              유료(아래 게이트)=각 시기 왜·무엇·전성기 활용·주의 대처(LLM). 재회/애정 티저와 동일 결·API 0. */}
          {c?.saju ? <LifeGraphTeaser saju={c.saju} /> : null}
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>{t('life.gateTitle', '인생 그래프')}</Text>
            <Text style={styles.gateDesc}>{t('life.gateDesc', '위 곡선의 각 시기가 왜 그런지, 지금 무엇을 하면 좋은지, 전성기 활용법과 어려운 때 대처까지 깊이 풀어 드려요.')}</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewHead}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
              {[t('life.pv1', '각 시기가 왜 오르내리는지'), t('life.pv2', '지금 시기에 무엇을 하면 좋은지'), t('life.pv3', '가장 빛나는 시기를 살리는 법'), t('life.pv4', '조심할 시기를 넘기는 법'), t('life.pv5', '평생 지켜갈 삶의 방향')].map((p, i) => <Text key={i} style={styles.previewItem}>· {p}</Text>)}
            </View>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <PressableScale style={styles.gateBtn} onPress={onStart}>
              <Text style={styles.gateBtnTx}>{t('life.seePaid', '인생 그래프 보기 (₩3,900)')}</Text>
            </PressableScale>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 노출
  wrap: { padding: space(6), paddingBottom: space(12) }, // 좌우 여백 표준(space6)으로 — 배너가 타 콘텐츠와 정렬(daniel #8)
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
