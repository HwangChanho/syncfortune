// src/app/(app)/love.tsx — 콘텐츠 '나의 애정흐름' (LLM·사주+자미 교차, 건당 유료)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 이상형 ↔ 실제 만나는 사람(외모·행동·습관)을 사주+자미 둘 다 크로스체킹해 아주 디테일하게.
//   건당 ₩4,900(가격 마킹), 1회 생성→캐시(영구·재과금 0). 결제 미연동 → 'love' 이용권 or 안내.
//   Edge kind='love'(category='love'), 운한 포함 최신 자미명반은 body로 전달.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { computeChart } from '../../lib/engine';
import { loadRepChart, type SavedChart } from '../../lib/myChart';
import { ensureServerChartId } from '../../lib/prewarmReadings';
import { useAuth } from '../../lib/useAuth';
import { useFontScale } from '../../lib/fontScale';
import { useCredit } from '../../lib/coupons';
import { requireLoginForPurchase } from '../../lib/requireLogin';
import { assertOnline } from '../../lib/network';
import { purchaseConsumableRC, purchasesEnabled, PRODUCT_UNLOCK_4900 } from '../../lib/purchases';
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { colors, radius, space, shadow, font } from '../../lib/theme';

// 건당 가격 — 정가 → 할인가로 마킹(daniel). 결제 연동 시 조율.
export const LOVE_PRICE = '₩4,900';
export const LOVE_PRICE_ORIG = '₩9,900';
export const LOVE_DISCOUNT = Math.round((1 - 4900 / 9900) * 100); // 51% 할인

// 9개 상세 항목(Edge 응답 키 ↔ i18n 라벨). 순서대로 스택 표시.
const SECTIONS: { key: string; tk: string }[] = [
  { key: 'idealType', tk: 'love.idealType' },
  { key: 'appearance', tk: 'love.appearance' },
  { key: 'personality', tk: 'love.personality' },
  { key: 'behavior', tk: 'love.behavior' },
  { key: 'howWeMeet', tk: 'love.howWeMeet' },
  { key: 'dynamic', tk: 'love.dynamic' },
  { key: 'timing', tk: 'love.timing' },
  { key: 'caution', tk: 'love.caution' },
  { key: 'advice', tk: 'love.advice' },
];

export default function LoveScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { fs } = useFontScale();
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [reading, setReading] = useState<any>(null);     // 캐시/생성된 통변(9항목)
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);           // 캐시 로드 완료
  const c = useMemo(() => (savedChart ? computeChart(savedChart.input) : null), [savedChart]);

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
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', 'love').eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      setReading(data?.content ?? null);
      setLoaded(true);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [session]);

  // 생성 — 로그인 게이트 → 이용권('love') 우선 → 없으면 건당 결제(₩4,900). 1회 생성 후 캐시.
  async function generate() {
    if (!chartId || !c || busy) return;
    if (!assertOnline(t)) return;                                                  // 오프라인 = 생성 차단
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return; // 구매는 계정 귀속·저장
    let unlocked = await useCredit('love');                                        // 무료 이용권(쿠폰) 우선
    if (!unlocked) {
      if (!purchasesEnabled()) { Alert.alert(t('love.gateTitle'), t('purchase.preparing')); return; } // RC 키 미설정
      try { unlocked = await purchaseConsumableRC(PRODUCT_UNLOCK_4900); }
      catch (e) { Alert.alert(t('love.gateTitle'), (e as Error).message); return; }
      if (!unlocked) return;                                                       // 사용자 취소
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('interpret', {
        body: { chartId, category: 'love', kind: 'love', tier: 'paid', ziwei: c.ziwei, lang: appLang() },
      });
      setReading(error ? { error: error.message } : data?.reading);
    } catch (e) { setReading({ error: (e as Error).message }); }
    setBusy(false);
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{t('love.title')}</Text>
      <Text style={styles.sub}>{t('love.sub')}</Text>

      {busy ? (
        <View style={styles.card}><ActivityIndicator color={colors.ju} /><Text style={styles.busyTx}>{t('love.generating')}</Text></View>
      ) : reading?.error ? (
        <View style={styles.card}><Text style={styles.err}>{String(reading.error)}</Text></View>
      ) : reading ? (
        // ── 9개 상세 섹션 ──
        SECTIONS.map((s) => (typeof reading[s.key] === 'string' && reading[s.key] ? (
          <View key={s.key} style={styles.card}>
            <Text style={styles.secLabel}>{t(s.tk)}</Text>
            <Text style={[styles.body, bodyDyn]}>{reading[s.key]}</Text>
          </View>
        ) : null))
      ) : (
        // ── 가격 게이트(미생성) — 정가 취소선 → 할인가 + % 배지 ──
        <View style={[styles.card, styles.gate]}>
          <View style={styles.priceRow}>
            <View style={styles.discBadge}><Text style={styles.discBadgeTx}>{LOVE_DISCOUNT}%</Text></View>
            <Text style={styles.priceOrig}>{LOVE_PRICE_ORIG}</Text>
            <Text style={styles.gatePrice}>{LOVE_PRICE}</Text>
          </View>
          <Text style={styles.gateDesc}>{t('love.gateDesc')}</Text>
          <Pressable style={styles.cta} onPress={generate}><Text style={styles.ctaTx}>{t('love.see', { price: LOVE_PRICE })}</Text></Pressable>
          <Text style={styles.gateNote}>{t('love.cacheNote')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5), lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  secLabel: { fontSize: 16, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  err: { fontSize: 13, color: colors.ju },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  // 가격 게이트 — 할인 배지 + 정가 취소선 + 할인가
  gate: { alignItems: 'center', borderColor: colors.ju, borderStyle: 'dashed', paddingVertical: space(7) },
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
