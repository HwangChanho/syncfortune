// src/app/(app)/country.tsx — '내가 살기 좋은 곳'(daniel 2026-06-24, 무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 원국 조후(더움/추움)·성별 음양으로 기운을 보완해 줄 기후·방위의 나라를 추천(국기 emoji). API 0.
//   ※ '이주 권유'가 아니라 기운 보완 관점의 재미 안내. 국가 매핑 stance = daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { Image as ExpoImage } from 'expo-image'; // 상단 히어로 — 자동 다운샘플·디스크캐시(daniel: 이미지 노출)
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { countryFit, type CountryRec } from '../../lib/content/countryFit';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ChartPicker } from '../../components/ChartPicker';

export default function CountryScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => { setSaved(await loadRepChart()); setLoaded(true); })().catch(() => setLoaded(true));
  }, [reloadKey]);

  const fit = useMemo(() => {
    if (!saved) return null;
    try { return countryFit(computeChart(saved.input).saju, saved.input.sex); } catch { return null; }
  }, [saved]);

  const card = (c: CountryRec, kind: 'rec' | 'caution') => (
    <View key={c.name} style={[styles.row, kind === 'caution' && styles.rowCaution]}>
      <Text style={styles.flag}>{c.flag}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{c.name}</Text>
        <Text style={[styles.reason, { fontSize: fs(13), lineHeight: fs(19) }]}>{c.reason}</Text>
      </View>
    </View>
  );


  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      {/* 전용 히어로(daniel ⑥) — 달·나침반·산수 모티프. 어두운 풀배경 대신 밝게 보이는 배너로(다른 콘텐츠와 일관). */}
      <ExpoImage source={require('../../../assets/icons/country.jpg')} style={styles.hero} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" transition={150} />
      <Text style={styles.title}>{t('country.title', '내가 살기 좋은 곳')}</Text>
      <Text style={styles.sub}>{t('country.sub', '타고난 기운(조후)을 보완해 줄 기후·방위의 나라를 짚어 드려요')}</Text>

        {!loaded ? null : !saved ? (
          <View style={styles.card}>
            <Text style={styles.body}>{t('country.needChart', '먼저 명식을 등록해 주세요.')}</Text>
            <PressableScale style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart', '명식 등록하기')}</Text></PressableScale>
          </View>
        ) : fit ? (
          <>
            <View style={[styles.card, styles.headCard]}>
              <Text style={styles.johuBadge}>조후: {fit.johu} (따뜻 {fit.warm} · 차가움 {fit.cold})</Text>
              <Text style={[styles.headline, { fontSize: fs(15), lineHeight: fs(24) }]}>{fit.headline}</Text>
            </View>
            <Text style={styles.h}>살기 좋은 곳</Text>
            <View style={styles.card}>{fit.recommend.map((c) => card(c, 'rec'))}</View>
            {fit.caution.length > 0 && (<>
              <Text style={styles.h}>주의할 결</Text>
              <View style={styles.card}>{fit.caution.map((c) => card(c, 'caution'))}</View>
            </>)}
            <Text style={styles.note}>{fit.note}</Text>
            <Text style={styles.disclaimer}>* 기운 보완 관점의 안내예요(이주·이민 조언 아님). 정확한 풀이는 원국 전체로.</Text>
          </>
        ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' }, // 전역 배경 노출
  hero: { width: '100%', height: 170, borderRadius: radius.lg, marginBottom: space(4), backgroundColor: colors.sunk }, // 전용 배너(달·나침반 산수)
  wrap: { padding: space(6), paddingBottom: space(12) },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), marginBottom: space(4), lineHeight: 19 },
  h: { ...font.heading, color: colors.ju, marginTop: space(5), marginBottom: space(2) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(2), ...shadow.card },
  headCard: { borderColor: colors.ju, borderWidth: 1.5 },
  johuBadge: { ...font.label, color: colors.ju, marginBottom: space(2) },
  headline: { ...font.body, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowCaution: { opacity: 0.85 },
  flag: { fontSize: 34 },
  name: { ...font.heading, color: colors.ink },
  reason: { ...font.caption, color: colors.inkSoft, marginTop: 2 },
  body: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(3) },
  note: { ...font.body, color: colors.inkSoft, marginTop: space(3), lineHeight: 22 },
  disclaimer: { ...font.caption, color: colors.inkFaint, marginTop: space(3) },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6), alignSelf: 'center' },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 15 },
});
