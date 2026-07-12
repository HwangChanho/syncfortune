// src/app/(app)/gaeun.tsx — '맞춤 개운법' (LLM·명식+지금 대운·세운, 건당 유료, daniel #18)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 지금 운(대운·세운)을 보고 운을 살리는 *구체 실천*이 주인공. 재파→나눔/기부·조후→이사·음양→리듬·흉살→살풀이.
//   기존 풀이의 개운법은 '곁들임' → 여기선 개운법이 주인공(실천 중심). Edge kind='gaeun'. 건당 유료, 1회 생성→캐시(영구).
//   career.tsx 게이트/생성 패턴 차용. 이미지(hero)는 배치 생성 후 연결(현재 텍스트 히어로).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { Image as ExpoImage } from 'expo-image';
import { Alert } from '../../lib/ui/alert';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { computeChart } from '../../lib/engine/engine';
import { loadRepChart, listCharts, setRepresentative, getRepresentativeId, type SavedChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { useAuth } from '../../lib/useAuth';
import { useFontScale } from '../../lib/ui/fontScale';
import { useSubscription } from '../../lib/billing/subscription';
import { loadCredits } from '../../lib/billing/coupons';
import { isAdmin } from '../../lib/core/admin';
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { assertOnline } from '../../lib/backend/network';
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { readingFromInvoke } from '../../lib/backend/interpretResult';
import { logEvent } from '../../lib/backend/logger';
import { setGenProgress } from '../../lib/backend/genProgress';
import { acquireGen, releaseGen, isGenActive } from '../../lib/backend/genLock'; // 크로스마운트 이중 생성 잠금(② 이중 LLM 방지)
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay';
import { DoorReveal } from '../../components/DoorReveal'; // 풀이 공개 순간 골드 명조 문 열림 영상(daniel 07-06)
import { ChartPicker } from '../../components/ChartPicker';
import { ShareReadingButton } from '../../components/ShareReadingButton';
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

// 섹션(Edge GAEUN_SYSTEM 응답 키 ↔ 라벨). 순서대로 스택. ※ headline 은 별도(맨 위 강조).
const SECTIONS: { key: string; tk: string; def: string }[] = [
  { key: 'nowLuck', tk: 'gaeun.nowLuck', def: '지금 운에 오는 것' },
  { key: 'coreRemedies', tk: 'gaeun.coreRemedies', def: '핵심 개운법 3가지' },
  { key: 'money', tk: 'gaeun.money', def: '재물·일 개운법' },
  { key: 'relation', tk: 'gaeun.relation', def: '관계·인연 개운법' },
  { key: 'lifestyle', tk: 'gaeun.lifestyle', def: '생활 처방(색·방향·음식·환경)' },
  { key: 'salpuli', tk: 'gaeun.salpuli', def: '살풀이 — 흉살·부딪힘 풀기' },
  { key: 'stress', tk: 'gaeun.stress', def: '맞춤 스트레스 해소' },
];

export default function GaeunScreen() {
  useLogContentVisit('gaeun'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const { t } = useTranslation();
  const router = useRouter();
  const { chartId: chartIdParam } = useLocalSearchParams<{ chartId?: string }>(); // ★M1 재진입 바인딩(배너/푸시 route 의 chartId)
  const { session } = useAuth();
  const { fs } = useFontScale();
  const { isPremium } = useSubscription();
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [reading, setReading] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const c = useMemo(() => (savedChart ? computeChart(savedChart.input) : null), [savedChart]);
  const gatingRef = useRef(false);
  const lastAppliedChartId = useRef<string | null>(null); // ★M1 적용한 chartId param 추적(재진입 중복 setRepresentative 방지·reading.tsx 38-43)
  const genSeq = useRef(0);        // ① 생성 세대 토큰 — 명식 전환/재로드 시 ++ 로 진행 중 gen 무효화(stale setReading 폐기)
  const chartIdRef = useRef<string | null>(null); // ① 현재 로드된 serverChartId — generate 결과 명식 대조(남의 풀이 표시 차단)
  const [doorPlaying, setDoorPlaying] = useState(false); // 풀이 공개 순간 골드 명조 문 열림 영상(daniel 07-06)
  const doorShown = useRef(false);                       // 유효 통변 최초 공개 1회 가드(재렌더·명식전환 시 재생 방지)

  // ★유효 통변(reading)이 실제로 공개되는 순간 = 골드 명조 문 열림 연출 1회(daniel 07-06). 캐시 로드/생성 완료로 처음 뜰 때만(ref 가드).
  useEffect(() => {
    if (reading && !reading.error && !doorShown.current) { doorShown.current = true; setDoorPlaying(true); }
  }, [reading]);

  useEffect(() => {
    let alive = true;
    genSeq.current++;   // ① 재로드(진입·명식전환) = 진행 중 generate 무효화(그 결과가 이 화면에 setReading 되지 않게)
    setBusy(false);     // ① 무효화한 gen 의 로딩 상태 정리(자물쇠가 남지 않게)
    (async () => {
      // ★M1(재진입 바인딩): 배너/푸시 route 의 chartId → 그 명식을 대표로 1회 전환(reading.tsx 38-43 패턴). 중복가드(ref)+이미 대표면 skip.
      if (chartIdParam && chartIdParam !== lastAppliedChartId.current) {
        lastAppliedChartId.current = chartIdParam;
        const cs = await listCharts();
        const target = cs.find((sc) => sc.id === chartIdParam) ?? null;
        if (target && (await getRepresentativeId()) !== target.id) await setRepresentative(target.id);
      }
      const ch = await loadRepChart();
      if (!alive) return;
      setSavedChart(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const cc = computeChart(ch.input);
      const id = await ensureServerChartId(cc, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      chartIdRef.current = id;   // ① 현재 명식 확정 — 이후 도착하는 generate 결과의 명식 대조 기준
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', 'gaeun').eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      setReading(data?.content ?? null);
      setLoaded(true);
      if (isPremium && !(data?.content)) generate(id); // 프리미엄=자동 생성(타 스페셜과 통일)
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [session, isPremium, reloadKey, chartIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(idArg?: string) {
    const id = idArg ?? chartId;
    if (!id || busy) return;
    // ② 크로스마운트 이중 LLM 방지 — 이미 이 명식 gaeun 이 생성 중이면 2차 호출하지 않는다(과금 0).
    const lockKey = `gaeun:${id}`;
    const myGen = genSeq.current;    // ① 이 생성의 세대 스냅샷(읽기만) — 재로드/명식전환(load effect)이 genSeq 를 올리면 stale
    const myChart = id;              // ① 대상 명식
    const isStale = () => myGen !== genSeq.current || myChart !== chartIdRef.current; // ① 결과 쓰기 직전 대조
    // A4(daniel 2026-07-08): 이미 다른 마운트가 생성 중이면 2차 LLM 막고(과금0) 로딩 유지·완료까지 대기 후 재시도(Edge 캐시 히트=과금0). daniel: 풀이중 진입차단 허용.
    if (!acquireGen(lockKey)) {
      setBusy(true);
      for (let i = 0; i < 45 && isGenActive(lockKey); i++) await new Promise((r) => setTimeout(r, 3000));
      setBusy(false);
      if (isStale() || isGenActive(lockKey)) return;
      return generate(idArg);
    }
    setBusy(true);
    // ③ 배너/푸시 명식 식별 — route 에 chartId(로컬 savedChart.id) + chartLabel. 재진입 바인딩은 ★M1 로 load effect 상단에 구현됨(reading.tsx 38-43 패턴).
    const gpRoute = savedChart?.id ? `/gaeun?chartId=${savedChart.id}` : '/gaeun';
    setGenProgress({ active: true, total: 1, done: 0, label: '맞춤 개운법', chartLabel: savedChart?.label, route: gpRoute });
    logEvent('gaeun_invoke_start', { chartId: id });
    let ok = false; // ★L2: 실제 성공(정상 reading 객체) 여부 — 완료 배너·푸시는 이때만(오완료 '완성' 푸시 방지)
    try {
      const { data, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category: 'gaeun', kind: 'gaeun', tier: 'paid', lang: appLang() },
      });
      if (isStale()) return;   // ① 생성 사이 명식 전환됨 → 폐기
      if (error) logEvent('gaeun_invoke_error', { message: error.message }, 'error');
      else if ((data as any)?.unavailable) logEvent('gaeun_unavailable', { retryAt: (data as any)?.retryAt }, 'error');
      else if ((data as any)?.needPayment) logEvent('gaeun_need_payment', {}, 'error');
      else logEvent('gaeun_invoke_ok');
      const r = readingFromInvoke(data, error);
      setReading(r);
      ok = !!r && typeof r === 'object' && !r.error; // 정상 통변 객체(error·unavailable·needPayment 아님)만 완료
    } catch (e) {
      logEvent('gaeun_invoke_throw', { message: (e as Error).message }, 'error');
      if (isStale()) return;
      setReading({ error: (e as Error).message });
    } finally {
      releaseGen(lockKey);   // ② 완료·중단·오류·폐기 모두 잠금 해제
    }
    if (isStale()) return;   // ① 완료 처리도 현재 명식일 때만
    // ★L2: 실제 성공만 완료 전이(배너+완료 푸시). 실패(오류·unavailable·needPayment)면 배너 제거 → 오완료 '완성' 푸시 방지.
    if (ok) setGenProgress({ route: gpRoute, done: 1, total: 1 });
    else setGenProgress({ route: gpRoute, active: false });
    setBusy(false);
  }

  // 게이트(서버 차감 통일·타 스페셜과 동일): 프리미엄=바로 / 관리자=바로 / 그 외 쿠폰('gaeun') 보유 시만.
  async function onStart() {
    if (!chartId || busy || gatingRef.current) return;
    logEvent('gaeun_generate_tap', { chartId });
    if (!assertOnline(t)) { logEvent('gaeun_offline'); return; }
    if (isPremium) { generate(chartId); return; }
    gatingRef.current = true;
    try {
      const admin = await isAdmin();
      if (!admin) {
        if (!requireLoginForPurchase(session, () => router.push('/login'), t)) { logEvent('gaeun_need_login'); return; }
        const credits = await loadCredits();
        logEvent('gaeun_credit_check', { has: credits['gaeun'] ?? 0 });
        if ((credits['gaeun'] ?? 0) <= 0) { Alert.alert(t('gaeun.title', '맞춤 개운법'), t('special.couponOnly', '쿠폰(이용권)으로 열 수 있어요. 설정에서 쿠폰을 등록하거나 관리자에게 문의하세요.')); return; }
      }
    } catch (e) { logEvent('gaeun_gate_error', { message: (e as Error).message }, 'error'); return; }
    finally { gatingRef.current = false; }
    generate(chartId);
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
    <View style={styles.bg}>
      {/* 전역 ContentBackdrop 이 배경(한지/달밤+별)을 제공 — 화면별 bgSource 이미지·스크림 제거(daniel 07-02) */}
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        <UnlockOverlay visible={busy} message={t('gaeun.generating', '지금 운에 맞는 개운법을 찾는 중…')} />
        {/* 풀이 공개 순간 골드 명조 문 열림 영상 — 1회 재생 후 페이드아웃하며 풀이 노출(daniel 07-06) */}
        <DoorReveal visible={doorPlaying} onDone={() => setDoorPlaying(false)} />
        <View style={styles.hero}>
          <ExpoImage source={require('../../../assets/icons/gaeun.jpg')} style={styles.heroImg} contentFit="cover" cachePolicy="memory-disk" transition={150} />
          <Text style={styles.title}>{t('gaeun.title', '맞춤 개운법')}</Text>
          <Text style={styles.sub}>{t('gaeun.sub', '지금 운(대운·세운)에 맞춰 운을 살리는 구체적인 방법을 짚어 드려요')}</Text>
        </View>

        {reading?.error ? (
          <View style={styles.card}><Text style={styles.err}>{String(reading.error)}</Text></View>
        ) : reading ? (
          <>
          {typeof reading.headline === 'string' && reading.headline.trim() ? (
            <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: fs(26) }}>{reading.headline}</Text>
          ) : null}
          {/* ★근본 '풀이 안 보임'(daniel 07-11): base 폴백 형식이면 구조화 섹션 키가 비어 화면이 텅 빔 → base 있으면 통째로 표시. */}
          {typeof reading.base === 'string' && reading.base.trim() ? (
            <View style={[styles.card, styles.cardAccent]}><Text style={[styles.body, bodyDyn]}>{reading.base}</Text></View>
          ) : SECTIONS.map((s) => (typeof reading[s.key] === 'string' && reading[s.key] ? (
            <View key={s.key} style={[styles.card, styles.cardAccent]}>
              <Text style={styles.secLabel}>{t(s.tk, s.def)}</Text>
              <Text style={[styles.body, bodyDyn]}>{reading[s.key]}</Text>
            </View>
          ) : null))}
          {/* 풀이 음성 읽기(온디바이스 TTS·무료) — SECTIONS 순서로 읽음 */}
          <TTSButton reading={reading} sections={SECTIONS} />
          <ShareReadingButton kind="gaeun" title={t('gaeun.title', '맞춤 개운법')} content={reading} />
          </>
        ) : (
          // 잠김(미생성) — 쿠폰(이용권)/관리자로 unlock
          <View style={[styles.card, styles.gate]}>
            <Text style={styles.gateTitle}>{t('gaeun.title', '맞춤 개운법')}</Text>
            <Text style={styles.gateDesc}>{t('gaeun.gateDesc', '지금 운에 무엇이 오는지 보고, 재물·관계·건강을 살리는 실천과 살풀이까지 짚어 드려요.')}</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewHead}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
              {SECTIONS.map((s) => <Text key={s.key} style={styles.previewItem}>· {t(s.tk, s.def)}</Text>)}
            </View>
            <PressableScale style={styles.cta} onPress={onStart}><Text style={styles.ctaTx}>{t('special.unlock', '쿠폰으로 열기')}</Text></PressableScale>
            <Text style={styles.gateNote}>{t('special.couponHint', '관리자 계정 또는 쿠폰(이용권)으로 열려요')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },                 // ★전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02)
  overlay: { flex: 1, backgroundColor: 'transparent' },            // 스크롤 컨텐츠 루트 — 투명(스크림 제거)
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' },
  msg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  hero: { alignItems: 'center', paddingVertical: space(4), marginBottom: space(3) },
  heroImg: { width: '100%', height: 190, borderRadius: radius.md, marginBottom: space(3) },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  sub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  cardAccent: { borderLeftWidth: 3, borderLeftColor: colors.ju },
  secLabel: { fontSize: 16, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink },
  err: { fontSize: 13, color: colors.ju },
  gate: { alignItems: 'center', borderStyle: 'dashed', borderColor: colors.ju, paddingVertical: space(7) },
  gateTitle: { ...font.heading, color: colors.ink, marginBottom: space(2), textAlign: 'center' },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginBottom: space(5), lineHeight: 22 },
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', color: colors.ju, marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  gateNote: { ...font.caption, color: colors.inkFaint, marginTop: space(3) },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(7) },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
});
