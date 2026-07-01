// src/app/(app)/gaeun.tsx — '맞춤 개운법' (LLM·명식+지금 대운·세운, 건당 유료, daniel #18)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 지금 운(대운·세운)을 보고 운을 살리는 *구체 실천*이 주인공. 재파→나눔/기부·조후→이사·음양→리듬·흉살→살풀이.
//   기존 풀이의 개운법은 '곁들임' → 여기선 개운법이 주인공(실천 중심). Edge kind='gaeun'. 건당 유료, 1회 생성→캐시(영구).
//   career.tsx 게이트/생성 패턴 차용. 이미지(hero)는 배치 생성 후 연결(현재 텍스트 히어로).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Alert } from '../../lib/ui/alert';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { computeChart } from '../../lib/engine/engine';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
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
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay';
import { ChartPicker } from '../../components/ChartPicker';
import { ShareReadingButton } from '../../components/ShareReadingButton';
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)

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
  const { t } = useTranslation();
  const router = useRouter();
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
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', 'gaeun').eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      setReading(data?.content ?? null);
      setLoaded(true);
      if (isPremium && !(data?.content)) generate(id); // 프리미엄=자동 생성(타 스페셜과 통일)
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [session, isPremium, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(idArg?: string) {
    const id = idArg ?? chartId;
    if (!id || busy) return;
    setBusy(true);
    setGenProgress({ active: true, total: 1, done: 0, label: '맞춤 개운법', route: '/gaeun' });
    logEvent('gaeun_invoke_start', { chartId: id });
    try {
      const { data, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category: 'gaeun', kind: 'gaeun', tier: 'paid', lang: appLang() },
      });
      if (error) logEvent('gaeun_invoke_error', { message: error.message }, 'error');
      else if ((data as any)?.unavailable) logEvent('gaeun_unavailable', { retryAt: (data as any)?.retryAt }, 'error');
      else if ((data as any)?.needPayment) logEvent('gaeun_need_payment', {}, 'error');
      else logEvent('gaeun_invoke_ok');
      setReading(readingFromInvoke(data, error));
    } catch (e) { logEvent('gaeun_invoke_throw', { message: (e as Error).message }, 'error'); setReading({ error: (e as Error).message }); }
    setGenProgress({ route: '/gaeun', done: 1, total: 1 });
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
        <Pressable style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart')}</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <ExpoImage source={bgSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        <UnlockOverlay visible={busy} message={t('gaeun.generating', '지금 운에 맞는 개운법을 찾는 중…')} />
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
          {SECTIONS.map((s) => (typeof reading[s.key] === 'string' && reading[s.key] ? (
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
            <Pressable style={styles.cta} onPress={onStart}><Text style={styles.ctaTx}>{t('special.unlock', '쿠폰으로 열기')}</Text></Pressable>
            <Text style={styles.gateNote}>{t('special.couponHint', '관리자 계정 또는 쿠폰(이용권)으로 열려요')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
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
