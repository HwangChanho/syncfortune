// src/app/(app)/selfanalysis.tsx — '나 분석' 종합 자기분석 대시보드 (App Store 4.3 · daniel 2026-07-13)
// ─────────────────────────────────────────────────────────────────────────
// 목적: 앱 정체성을 '운세'가 아니라 '자기분석 도구'로 각인 — 흩어진 자기이해 지표(에겐/테토·성격유형·사주MBTI·오행밸런스)를
//   *하나의 리치한 분석 프로필*로 모아 성격분석 앱(16Personalities류)처럼 읽히게. 전부 온디바이스 결정론(사주 엔진)·API 0·무료.
//   ★신설 로직 아님 — 기존 egenTeto/classifyPersona/sajuMbti 재사용, 오행밸런스만 신규 시각화. 각 축의 상세는 전용 화면으로.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { ElementBalance } from '../../components/ElementBalance';
import { OhaengEnergy } from '../../components/OhaengEnergy'; // 오행 에너지 구슬 인포그래픽(친근한 첫인상·daniel 기획서①)
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { egenTeto } from '../../lib/content/egenTeto';
import { classifyPersona } from '../../lib/content/personaType';
import { sajuMbti } from '../../lib/content/sajuMbti';
import { colors, space, radius, font, shadow } from '../../lib/theme';

// 에겐↔테토 게이지(egenteto.tsx EgenBar 동일 톤)
function EgenBar({ score }: { score: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: score, duration: 900, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [a, score]);
  const w = a.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: w }]} />
      <Animated.View style={[styles.dot, { left: w }]} />
    </View>
  );
}

export default function SelfAnalysisRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const [input, setInput] = useState<any>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setInput(ch?.input ?? null); setLabel(ch?.label ?? null); setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // 4개 분석 축 산출(온디바이스·결정론) — 하나의 프로필로 모음
  const data = useMemo(() => {
    if (!input) return null;
    try {
      const c = computeChart(input);
      const egen = egenTeto(c.saju);
      const persona = classifyPersona({
        dayStem: c.saju.dayMaster.stem,
        monthBranch: c.saju.pillars['월']?.branch ?? '',
        strengthVerdict: c.strength.verdict,
        strengthScore: c.strength.score,
        pillars: c.saju.pillars,
      });
      const mbti = sajuMbti(c.saju);
      return { saju: c.saju, egen, persona, mbti };
    } catch { return null; }
  }, [input]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!data) return (
    <View style={styles.center}>
      <Text style={styles.emptyMsg}>{t('selfHero.emptySub', '생년월일시를 넣으면 사주 엔진이 성격·기질·강점을 분석해요')}</Text>
      <PressableScale style={styles.emptyBtn} onPress={() => router.push('/register')}><Text style={styles.emptyBtnTx}>{t('selfHero.emptyCta', '+ 나를 분석받기')}</Text></PressableScale>
    </View>
  );

  const { egen, persona, mbti, saju } = data;
  const egenLabel = egen.type === 'teto' ? t('egen.typeTeto', '테토형') : egen.type === 'egen' ? t('egen.typeEgen', '에겐형') : t('egen.typeBalanced', '균형형');
  const egenPct = egen.type === 'teto' ? egen.tetoScore : 100 - egen.tetoScore;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.kicker}>{t('selfAnalysis.kicker', '사주 엔진이 분석한 나')}</Text>
      <Text style={styles.title}>{label ? `${label}${t('selfAnalysis.titleSuffix', '님 분석')}` : t('selfAnalysis.title', '나 분석')}</Text>
      <Text style={styles.sub}>{t('selfAnalysis.sub', '타고난 사주를 엔진으로 계산한 다섯 갈래 자기분석 — 운세가 아니라 나를 이해하는 지표예요.')}</Text>

      {/* ① 에겐 ↔ 테토 성향 */}
      <PressableScale style={styles.card} onPress={() => router.push('/egenteto')}>
        <View style={styles.cardHead}><Text style={styles.cardLabel}>{t('menu.egenteto', '에겐·테토 성향')}</Text><Text style={styles.badge}>{egenLabel} {egenPct}%</Text></View>
        <View style={styles.barRow}>
          <Text style={[styles.barEnd, egen.type === 'egen' && styles.barEndOn]}>{t('egen.scaleEgen', '에겐')}</Text>
          <EgenBar score={egen.tetoScore} />
          <Text style={[styles.barEnd, styles.barEndRight, egen.type === 'teto' && styles.barEndOn]}>{t('egen.scaleTeto', '테토')}</Text>
        </View>
        <Text style={styles.more}>{t('selfAnalysis.more', '자세히 보기 ›')}</Text>
      </PressableScale>

      {/* ② 성격유형 */}
      <PressableScale style={styles.card} onPress={() => router.push('/persona')}>
        <Text style={styles.cardLabel}>{t('menu.persona', '성격유형')}</Text>
        <Text style={styles.personaName}>{persona.name}</Text>
        <Text style={styles.personaDesc} numberOfLines={3}>{persona.desc}</Text>
        <Text style={styles.more}>{t('selfAnalysis.more', '자세히 보기 ›')}</Text>
      </PressableScale>

      {/* ③ 사주 MBTI */}
      <PressableScale style={styles.card} onPress={() => router.push('/mbti')}>
        <View style={styles.cardHead}><Text style={styles.cardLabel}>{t('menu.mbti', '사주 MBTI')}</Text><Text style={styles.badge}>{mbti.type}</Text></View>
        <Text style={styles.personaName}>{mbti.nickname}</Text>
        <Text style={styles.personaDesc} numberOfLines={2}>{mbti.summary}</Text>
        <Text style={styles.more}>{t('selfAnalysis.more', '자세히 보기 ›')}</Text>
      </PressableScale>

      {/* ④ 오행 밸런스(신규 분석 축) */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t('selfAnalysis.elements', '오행 밸런스 — 나를 이루는 다섯 기운')}</Text>
        {/* 오행 에너지 구슬(친근한 첫인상) → 아래 ElementBalance(분석용 막대)와 상호보완 */}
        <View style={{ marginTop: space(2) }}><OhaengEnergy saju={saju} /></View>
        <View style={{ marginTop: space(2) }}><ElementBalance saju={saju} /></View>
      </View>

      {/* ⑤ 나의 특징(강점·기질) 진입 */}
      <PressableScale style={[styles.card, styles.traitsCard]} onPress={() => router.push('/traits')}>
        <Text style={styles.traitsTx}>{t('menu.traits', '나의 특징')} · {t('selfAnalysis.strengths', '강점과 기질 자세히')}</Text>
        <Text style={styles.traitsArrow}>›</Text>
      </PressableScale>

      <Text style={styles.footNote}>{t('selfAnalysis.footNote', '※ 모두 사주 엔진(만세력)으로 계산한 온디바이스 분석이에요. 예언이 아니라 나를 이해하는 참고예요.')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6), backgroundColor: colors.bg },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.5, marginBottom: space(1) },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, marginBottom: space(2) },
  sub: { ...font.body, color: colors.inkSoft, lineHeight: 21, marginBottom: space(5) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(4.5), marginBottom: space(4), ...shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { ...font.caption, color: colors.ju, fontWeight: '800' },
  badge: { fontSize: 12, fontWeight: '900', color: colors.bg, backgroundColor: colors.badgeGold, paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, overflow: 'hidden' },
  personaName: { fontSize: 19, fontWeight: '900', color: colors.ink, marginTop: space(2) },
  personaDesc: { ...font.body, color: colors.inkSoft, lineHeight: 21, marginTop: space(1.5) },
  more: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2.5) },
  barRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(3.5) },
  barEnd: { ...font.caption, color: colors.inkFaint, width: 38, fontWeight: '700' },
  barEndRight: { textAlign: 'right' },
  barEndOn: { color: colors.ju, fontWeight: '900' },
  track: { flex: 1, height: 8, backgroundColor: colors.line, borderRadius: 4, marginHorizontal: space(2.5), position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.ju, borderRadius: 4 },
  dot: { position: 'absolute', top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ju, borderWidth: 3, borderColor: colors.card, marginLeft: -9 },
  traitsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  traitsTx: { ...font.body, color: colors.ink, fontWeight: '700' },
  traitsArrow: { fontSize: 22, color: colors.ju, fontWeight: '800' },
  footNote: { ...font.caption, color: colors.inkFaint, lineHeight: 17, marginTop: space(2) },
  emptyMsg: { ...font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 21, marginBottom: space(4) },
  emptyBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6) },
  emptyBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
});
