// src/app/(app)/love.tsx — 콘텐츠 '나의 애정흐름' (LLM·사주+자미 교차, 건당 유료)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 이상형 ↔ 실제 만나는 사람(외모·행동·습관)을 사주+자미 둘 다 크로스체킹해 아주 디테일하게.
//   건당 ₩4,900(가격 마킹), 1회 생성→캐시(영구·재과금 0). 결제 미연동 → 'love' 이용권 or 안내.
//   Edge kind='love'(category='love'), 운한 포함 최신 자미명반은 body로 전달.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { ExpiryNote } from '../../components/ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { computeChart } from '../../lib/engine/engine';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { useAuth } from '../../lib/useAuth';
import { useFontScale } from '../../lib/ui/fontScale';
import { useSubscription } from '../../lib/billing/subscription'; // 프리미엄=자동 생성(타 스페셜과 통일)
import { loadCredits } from '../../lib/billing/coupons';
import { isAdmin } from '../../lib/core/admin'; // 스페셜 = 관리자 바로 진입 / 그 외 쿠폰(크레딧)만 unlock(결제 미연동)
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { confirmReadingChart } from '../../lib/ui/confirmChart'; // 생성 전 명식 확인 + 보유 이용권 안내(daniel)
import { assertOnline } from '../../lib/backend/network';
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { readingFromInvoke } from '../../lib/backend/interpretResult'; // 방어: Edge 응답 정규화(일시적 불가·결제필요·오류 친화 처리)
import { logEvent } from '../../lib/backend/logger'; // DB 로그(app_logs) — 단계별 추적(네이티브 크래시 직전 지점)
import { setGenProgress } from '../../lib/backend/genProgress'; // 일회성 진행도(daniel 이슈15)
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay'; // unlock 자물쇠 애니 + 그 사이 LLM 분석
import { ContentHero, cardAnim } from '../../components/SpecialContentScreen'; // 공용 히어로 + 섹션 stagger
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(가드 내장)
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import { LoveThread } from '../../components/contentMotifs'; // 인연의 실 모티프
import { LoveFlowGraph } from '../../components/LoveFlowGraph'; // 애정(재성) 흐름 곡선(daniel B·R29)
import { PossibilityGauge } from '../../components/PossibilityGauge'; // 공용 인연 가능성 게이지(재회와 공유 — 애니 미터)
import { loveInyeonGauge } from '../../lib/love/inyeonGauge'; // 인연 가능성 점수(결정론·온디바이스·재회와 동일 신호)

// 건당 가격 — 정가 → 할인가로 마킹(daniel). 결제 연동 시 조율.
export const LOVE_PRICE = '₩9,900';
export const LOVE_PRICE_ORIG = '₩9,900';
export const LOVE_DISCOUNT = Math.round((1 - 4900 / 9900) * 100); // 51% 할인

// 9개 상세 항목(Edge 응답 키 ↔ i18n 라벨). 순서대로 스택 표시.
const SECTIONS: { key: string; tk: string }[] = [
  { key: 'idealType', tk: 'love.idealType' },
  { key: 'appearance', tk: 'love.appearance' },
  { key: 'personality', tk: 'love.personality' },
  { key: 'behavior', tk: 'love.behavior' },
  { key: 'ageGap', tk: 'love.ageGap' }, // #40 배우자 나이차(R8 연배) — 만날 사람과 나의 나이차 경향(연상/또래/연하·폭)
  { key: 'howWeMeet', tk: 'love.howWeMeet' },
  { key: 'elementMatch', tk: 'love.elementMatch' },
  { key: 'dynamic', tk: 'love.dynamic' },
  { key: 'timing', tk: 'love.timing' },
  { key: 'caution', tk: 'love.caution' },
  { key: 'advice', tk: 'love.advice' },
];

const LOVE_PINK = '#E5749B'; // 애정 테마색(인연 실 모티프와 통일)

// love 결과(Edge 응답 JSON) — SECTIONS 키로 동적 접근. 런타임 JSON이라 인덱스 시그니처로 느슨하게 두되,
//   알려진 키는 명시해 문서화한다. #40 배우자 나이차(R8 연배) = ageGap 섹션(옵셔널).
type LoveReading = { [section: string]: string | undefined; headline?: string; ageGap?: string; error?: string };

export default function LoveScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { fs } = useFontScale();
  const { isPremium } = useSubscription();
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [reading, setReading] = useState<LoveReading | null>(null);     // 캐시/생성된 통변(10항목 — #40 ageGap 포함)
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);           // 캐시 로드 완료
  const [reloadKey, setReloadKey] = useState(0);         // ChartPicker 로 대표 전환 시 재로드 트리거
  const [expiry, setExpiry] = useState<string | null>(null); // 보유 만료일(생성일+1년) — 캐시 created_at으로 채움(daniel #25)
  const c = useMemo(() => (savedChart ? computeChart(savedChart.input) : null), [savedChart]);
  // 인연 가능성 게이지(무료·결정론·API 0) — 재회와 동일 신호(배우자궁 개폐·도화·인연星 발동+강약)로 산출, 애정 카피만 다름.
  //   LoveFlowGraph(흐름 곡선) '위'에 얹어 '지금 인연 기운'을 0~100 + 한 줄로(무료 훅) → 아래 유료 깊은 풀이로 유도.
  const loveGauge = useMemo(
    () => (c?.saju ? loveInyeonGauge(c.saju, { sex: savedChart?.input?.sex, timeUnknown: savedChart?.input?.timeAccuracy === '미상' }) : null),
    [c, savedChart],
  );
  const gatingRef = useRef(false); // 결제 구간(모달) 연타 차단 — busy(생성중)와 별개
  const reveal = useRef(new Animated.Value(0)).current; // 섹션 순차 등장

  // 대표 명식 로드 → 서버차트ID 확보 → 'love' 캐시 조회(생성 없이 즉시 표시)
  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSavedChart(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const cc = computeChart(ch.input);
      const id = await ensureServerChartId(cc, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      const { data } = await supabase.from('readings').select('content, created_at').eq('chart_id', id).eq('category', 'love').eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      // 방어(daniel: 풀이가 'true'로 뜨던 버그) — 캐시 content가 정상 통변 '객체'가 아니거나(boolean·배열·문자열),
      //   error 플래그가 박힌 비정상 저장분이면 무효 처리 → 재생성 유도(이전 실패 응답이 캐시에 굳어 String(error)='true'로 노출되던 것 차단).
      const raw = data?.content ?? null;
      const cached = raw && typeof raw === 'object' && !Array.isArray(raw) && !(raw as any).error ? raw : null;
      setReading(cached);
      // 보유 만료일(daniel #25): 생성(구매)일 + 1년. 캐시 created_at 있을 때만(명식 전환 시 stale 방지 위해 else로 초기화).
      if (data?.created_at) { const d = new Date(data.created_at); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); } else setExpiry(null);
      setLoaded(true);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [session, isPremium, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 통변 도착(캐시·생성 완료) → 섹션 순차 등장(stagger)
  useEffect(() => {
    if (reading && !reading.error) { reveal.setValue(0); Animated.timing(reveal, { toValue: 1, duration: 500 + SECTIONS.length * 110, useNativeDriver: true }).start(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  // invoke 타임아웃/실패 시 readings 캐시를 폴링해 결과 회수(Edge가 서버에서 계속 생성·캐시하므로).
  //   무거운 애정 풀이(사주+자미 교차)는 Edge 생성이 87~103s → 클라 invoke가 먼저 끊겨도('Failed to send request')
  //   서버는 완료·캐시함. 그 캐시를 폴링해 로딩 유지한 채 결과를 받아온다(멈춤·"갑자기 완료" 해결, daniel 07-02).
  async function pollCachedReading(id: string, maxMs = 135000, everyMs = 3500): Promise<any | null> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, everyMs));
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', 'love').eq('lang', appLang()).maybeSingle();
      if (data?.content) return data.content;
    }
    return null;
  }

  // 순수 생성(LLM) — 게이트 통과 후 호출. idArg/ziweiArg = useEffect 자동생성용(state 갱신 전 직접 전달).
  async function generate(idArg?: string, ziweiArg?: any) {
    const id = idArg ?? chartId;
    const zw = ziweiArg ?? c?.ziwei;
    if (!id || !zw || busy) return;
    setBusy(true);
    setGenProgress({ active: true, total: 1, done: 0, label: '나의 애정흐름', route: '/love' }); // 일회성 진행도(daniel 이슈15)
    logEvent('love_invoke_start', { chartId: id });
    try {
      const { data, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category: 'love', kind: 'love', tier: 'paid', ziwei: zw, lang: appLang(), sex: savedChart?.input?.sex, ...(savedChart?.context ? { context: savedChart.context } : {}) }, // sex=배우자성(남재성/여관성, refined timing)
      });
      if (error || !data) {
        // ★클라 invoke가 끊겨도(무거운 풀이 타임아웃) Edge는 서버에서 완료·캐시 → 캐시 폴링으로 회수(로딩 유지).
        logEvent('love_invoke_error', { message: error?.message ?? 'no data', polling: true }, 'error');
        const cached = await pollCachedReading(id);
        setReading(cached ?? readingFromInvoke(data, error));
      } else if ((data as any)?.unavailable) {
        logEvent('love_unavailable', { retryAt: (data as any)?.retryAt }, 'error'); // LLM 일시적 불가(사용량 한도 등) — 빠른 실패라 폴링 없이 친화 문구
        setReading(readingFromInvoke(data, error));
      } else if ((data as any)?.needPayment) {
        logEvent('love_need_payment', {}, 'error');   // 크레딧 stale 방어 — 빠른 실패
        setReading(readingFromInvoke(data, error));
      } else {
        logEvent('love_invoke_ok');
        setReading(readingFromInvoke(data, error)); // 정상 도착(성공 경로 그대로)
      }
    } catch (e) {
      // fetch throw(타임아웃 등)도 동일 — 서버가 완료·캐시했으면 폴링으로 회수, 아니면 오류 표시.
      logEvent('love_invoke_throw', { message: (e as Error).message }, 'error');
      const cached = await pollCachedReading(id);
      setReading(cached ?? { error: (e as Error).message });
    }
    setGenProgress({ route: '/love', done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기'(daniel 이슈15)
    setBusy(false);
  }

  // 생성 전 '이 명식으로 풀이할지' 확인(+보유 이용권) → 확인 시 doStart(daniel 07-02).
  function onStart() {
    if (!chartId || busy || gatingRef.current) return;
    void confirmReadingChart({ chartLabel: savedChart?.label, creditKind: 'love', t, onConfirm: () => { void doStart(); } });
  }
  // 게이트(서버 차감 통일·타 스페셜과 동일): 프리미엄=바로 / 관리자=바로 / 그 외 쿠폰('love') 보유시만 — 결제 미연동.
  async function doStart() {
    if (!chartId || busy || gatingRef.current) return;
    logEvent('love_generate_tap', { chartId });                                    // ← 진입(크래시 직전 추적 기준점)
    if (!assertOnline(t)) { logEvent('love_offline'); return; }                    // 오프라인 = 생성 차단
    gatingRef.current = true;                                                       // 게이트 구간 연타 차단
    try {
      const admin = await isAdmin();                                               // 관리자 = 바로 진입(테스트)
      if (!admin) {
        if (!requireLoginForPurchase(session, () => router.push('/login'), t)) { logEvent('love_need_login'); return; }
        const credits = await loadCredits();                                       // 쿠폰(이용권) 크레딧만 unlock — 결제 미연동
        logEvent('love_credit_check', { has: credits['love'] ?? 0 });
        if ((credits['love'] ?? 0) <= 0) { Alert.alert(t('love.gateTitle'), t('special.couponOnly', '쿠폰(이용권)으로 열 수 있어요. 설정에서 쿠폰을 등록하거나 관리자에게 문의하세요.')); return; }
      }
    } catch (e) { logEvent('love_gate_error', { message: (e as Error).message }, 'error'); return; }
    finally { gatingRef.current = false; }
    generate(chartId);                                                              // 관리자·크레딧 통과 → 생성(서버 차감)
  }

  const bodyDyn = { fontSize: fs(15), lineHeight: fs(25) };

  if (!loaded) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!savedChart) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('manse.empty')}</Text>
        <PressableScale style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart')}</Text></PressableScale>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      <UnlockOverlay visible={busy} message={t('love.generating', '애정 흐름을 풀어내는 중…')} />
      <ContentHero motif={<LoveThread />} image={require('../../../assets/icons/love-hero.jpg')} title={t('love.title')} sub={t('love.sub')} themeColor={LOVE_PINK} />
      {/* 인연 가능성 게이지(무료·결정론) — 흐름 곡선 '위'에 얹는 핵심 훅. 지금 인연 기운을 0~100 + 한 줄 일상어로. */}
      {loveGauge && (
        <PossibilityGauge score={loveGauge.score} label={loveGauge.label} tone={loveGauge.tone} title="인연이 무르익는 흐름" caption={loveGauge.caption} accent={LOVE_PINK} />
      )}
      {/* 애정 흐름 곡선(재성 12운성·시기별) — 무료 온디바이스 티저(daniel B). 깊은 통변은 아래 유료 */}
      {c?.saju && <LoveFlowGraph saju={c.saju} gender={savedChart?.input?.sex} />}

      {reading?.error ? (
        <View style={styles.card}><Text style={styles.err}>{String(reading.error)}</Text></View>
      ) : reading ? (
        // ── 소제목 + 9개 상세 섹션 ──
        <>
          {/* 풀이 보유 만료일 — 공통 컴포넌트(daniel 07-01) */}
          <ExpiryNote expiry={expiry} chartId={chartId} />
          {/* 이슈19 소제목 — 통변 결과 headline 있으면 섹션들 맨 위에 한 줄 강조 */}
          {typeof reading.headline === 'string' && reading.headline.trim() ? (
            <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: fs(26) }}>{reading.headline}</Text>
          ) : null}
          {SECTIONS.map((s, i) => (typeof reading[s.key] === 'string' && reading[s.key] ? (
          <Animated.View key={s.key} style={[styles.card, styles.cardAccent, { borderLeftColor: LOVE_PINK }, cardAnim(reveal, i, SECTIONS.length)]}>
            <Text style={[styles.secLabel, { color: LOVE_PINK }]}>{t(s.tk)}</Text>
            <Text style={[styles.body, bodyDyn]}>{reading[s.key]}</Text>
          </Animated.View>
        ) : null))}
          {/* 풀이 음성 읽기(온디바이스 TTS·무료) — SECTIONS 순서로 읽음 */}
          <TTSButton reading={reading} sections={SECTIONS} />
          {/* 이슈17: 풀이 결과 공유(content 없거나 error면 컴포넌트가 자체 미노출) */}
          <ShareReadingButton kind="love" title={t('love.title')} content={reading} />
        </>
      ) : (
        // ── 잠김(미생성) — 스페셜은 쿠폰(이용권)/관리자로 unlock(결제 미연동, 타 스페셜과 통일) ──
        <View style={[styles.card, styles.gate, { borderColor: LOVE_PINK }]}>
          <Text style={styles.gateTitle}>{t('love.title')}</Text>
          <Text style={styles.gateDesc}>{t('love.gateDesc')}</Text>
          {/* 미리보기 — 궁금해할 핵심 항목 보여주고 unlock 유도(daniel) */}
          <View style={styles.previewBox}>
            <Text style={[styles.previewHead, { color: LOVE_PINK }]}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
            {SECTIONS.map((s) => <Text key={s.key} style={styles.previewItem}>· {t(s.tk)}</Text>)}
          </View>
          <PressableScale style={[styles.cta, { backgroundColor: LOVE_PINK }]} onPress={onStart}><Text style={styles.ctaTx}>{t('special.unlock', '쿠폰으로 열기')}</Text></PressableScale>
          <Text style={styles.gateNote}>{t('special.couponHint', '관리자 계정 또는 쿠폰(이용권)으로 열려요')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  wrap: { padding: space(6), paddingBottom: space(12) }, // 콘텐츠 좌우여백 통일(daniel)
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5), lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  secLabel: { fontSize: 16, fontWeight: '800', marginBottom: space(2) },
  cardAccent: { borderLeftWidth: 3 },
  body: { ...font.body, color: colors.ink },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  err: { fontSize: 13, color: colors.ju },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  // 가격 게이트 — 할인 배지 + 정가 취소선 + 할인가
  gate: { alignItems: 'center', borderColor: colors.ju, borderStyle: 'dashed', paddingVertical: space(7) },
  gateTitle: { ...font.heading, color: colors.ink, marginBottom: space(2) },
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  discBadge: { backgroundColor: '#E5484D', borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(1) },
  discBadgeTx: { color: '#fff', fontSize: 14, fontWeight: '900' },
  priceOrig: { fontSize: 16, color: colors.inkFaint, textDecorationLine: 'line-through' },
  gatePrice: { fontSize: 30, fontWeight: '900', color: colors.ju },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(3), marginBottom: space(5), lineHeight: 22 },
  gateNote: { ...font.caption, color: colors.inkFaint, marginTop: space(3) },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(7) },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
});
