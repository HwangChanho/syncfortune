// src/app/(app)/egenteto.tsx — 에겐 vs 테토 (가볍게 보기) — 점수·설명 모두 온디바이스(LLM 0·무료)
// ─────────────────────────────────────────────────────────────────────────
// daniel stance: 관성·상관·비겁=테토(직진·주도) / 식신·인성=에겐(여유·수용) / 재성=중립.
//   ① 점수(0=에겐~100=테토)·판정 = egenTeto.ts 온디바이스 산출 → 막대로 즉시 표시.
//   ② 성향 설명(headline/성격/관계/요즘 흐름) = egenReading.ts 온디바이스 룰(daniel 2026-06-30: 기존 Edge
//      kind='egen' LLM 제거 → API 0·무료·광고 게이트 제거). EGEN_SYSTEM 톤을 룰로 이관(stance 동일).
//   점수·설명 모두 명식만 있으면 비로그인·오프라인에서도 즉시(서버·캐시 불요). 같은 명식·점수=같은 설명(결정론).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, Pressable, ActivityIndicator, Animated, Easing } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { egenTeto, type EgenTetoResult } from '../../lib/content/egenTeto';
import { buildEgenReading, type EgenReading } from '../../lib/content/egenReading'; // 온디바이스 성향 설명(LLM 0·무료, daniel 2026-06-30)
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ChartPicker } from '../../components/ChartPicker'; // 명식 선택(대표 전환) — 명식별 성향(daniel)
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(앱게이트)

// 에겐↔테토 게이지 — fill·dot이 0→score로 차오르고 이동(daniel #13: 실제 인디케이터 애니).
function EgenBar({ score }: { score: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: score, duration: 950, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [a, score]);
  const w = a.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: w }]} />
      <Animated.View style={[styles.dot, { left: w }]} />
    </View>
  );
}

export default function EgenTetoScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [result, setResult] = useState<EgenTetoResult | null>(null); // 온디바이스 점수(즉시)
  const [reading, setReading] = useState<EgenReading | null>(null);   // 온디바이스 설명(즉시·LLM 0)
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // ChartPicker 로 대표 전환 시 재산출 트리거

  // 대표 명식 → 온디바이스 점수 + 설명 즉시 산출(서버·로그인·광고 불요). 같은 명식·점수 = 같은 결과(결정론).
  useEffect(() => {
    let alive = true;
    setReading(null); setResult(null); setLoaded(false);
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch);
      if (!ch) { setLoaded(true); return; }
      const c = computeChart(ch.input);
      const res = egenTeto(c.saju);               // 점수·유형·근거(온디바이스)
      if (!alive) return;
      setResult(res);
      setReading(buildEgenReading(res));          // 성향 설명(온디바이스 룰 — EGEN_SYSTEM 톤 이관·API 0)
      setLoaded(true);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [reloadKey]);

  // 타입 → 라벨(에겐형/테토형/균형형)
  const typeLabel = (ty: EgenTetoResult['type']) =>
    ty === 'teto' ? t('egen.typeTeto', '테토형') : ty === 'egen' ? t('egen.typeEgen', '에겐형') : t('egen.typeBalanced', '균형형');


  return (
    <ImageBackground source={bgSource} style={styles.bgImage} resizeMode="cover">
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
            <PressableScale style={styles.regBtn} onPress={() => router.push('/register')}>
              <Text style={styles.regBtnTx}>{t('egen.registerBtn', '명식 등록하기')}</Text>
            </PressableScale>
          </View>
        ) : result ? (
          <>
            {/* 점수 비주얼(온디바이스 — 즉시 표시, 게이트 무관) */}
            <View style={styles.scoreCard}>
              <Text style={styles.scoreBadge}>{typeLabel(result.type)}</Text>
              {/* daniel: '테토력' 표기 대신 50% 기준 판정 타입(에겐/테토)의 강도% */}
              <Text style={styles.scoreNum}>{result.type === 'teto' ? t('egen.scaleTeto', '테토') : t('egen.scaleEgen', '에겐')} {result.type === 'teto' ? result.tetoScore : 100 - result.tetoScore}<Text style={styles.scoreNumUnit}>%</Text></Text>
              <View style={styles.barRow}>
                <Text style={[styles.barEnd, result.type === 'egen' && styles.barEndOn]}>{t('egen.scaleEgen', '에겐')}</Text>
                <EgenBar score={result.tetoScore} />
                <Text style={[styles.barEnd, styles.barEndRight, result.type === 'teto' && styles.barEndOn]}>{t('egen.scaleTeto', '테토')}</Text>
              </View>
            </View>

            {reading ? (
              // 성향 설명(온디바이스) — headline + 3섹션. 게이트·광고·LLM 없이 즉시 표시(무료).
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
                {/* 이슈17: 에겐·테토 설명 공유(앱게이트) */}
                <ShareReadingButton kind="egen" title="에겐·테토" content={reading} />
              </>
            ) : null}
          </>
        ) : null}

        <Text style={styles.note}>{t('egen.note', '※ 사주로 가볍게 보는 성향 테스트예요. 재미로 즐겨 주세요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
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
