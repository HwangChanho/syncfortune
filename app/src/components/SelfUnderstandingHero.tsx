// src/components/SelfUnderstandingHero.tsx
// ─────────────────────────────────────────────────────────────────────────
// 홈 최상단 "나는 어떤 사람인가" 히어로 (App Store 4.3 대응 · daniel 2026-07-12).
//   목적: 홈 첫 화면을 '운세 목록'이 아니라 '나를 분석하는 도구'로 각인 —
//   대표 명식으로 에겐·테토 성향을 *온디바이스 즉시* 산출(LLM 0·무료·오프라인)해 게이지 + 한 줄 요약을 바로 보여주고,
//   성격유형·사주 MBTI·나의 특징(자기이해 클러스터)으로 빠르게 잇는다. 명식 없으면 '나를 분석받기' 등록 유도.
//   ★로직 신설 아님 — egenteto.tsx 산출 패턴(loadRepChart→computeChart→egenTeto→buildEgenReading) 재사용, 노출만 최상단으로.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { loadRepChart } from '../lib/engine/myChart';
import { computeChart } from '../lib/engine/engine';
import { egenTeto, type EgenTetoResult } from '../lib/content/egenTeto';
import { buildEgenReading, type EgenReading } from '../lib/content/egenReading';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';

// 에겐↔테토 게이지 — fill·dot이 0→score로 차오른다(egenteto.tsx EgenBar 동일 톤).
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

// 자기이해 클러스터 빠른 진입(전부 무료·온디바이스). 라우트·라벨키는 index.tsx SECTIONS 와 동일. ★이모지 미사용(daniel).
const CLUSTER: { route: string; labelKey: string; fallback: string }[] = [
  { route: '/personatype', labelKey: 'menu.persona', fallback: '성격유형' }, // 성격유형=120종 단일화(daniel 2026-07-20)
  { route: '/mbti', labelKey: 'menu.mbti', fallback: '사주 MBTI' },
  { route: '/traits', labelKey: 'menu.traits', fallback: '나의 특징' },
];

/** 홈 최상단 자기이해 히어로. reloadKey = 대표 명식 전환/포커스 시 홈이 올려 재산출(에겐테토 갱신). */
export function SelfUnderstandingHero({ reloadKey }: { reloadKey?: number }) {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const [result, setResult] = useState<EgenTetoResult | null>(null);
  const [reading, setReading] = useState<EgenReading | null>(null);
  const [hasChart, setHasChart] = useState<boolean | null>(null); // null=로딩 중(렌더 보류)

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      if (!ch) { setHasChart(false); setResult(null); setReading(null); return; }
      try {
        const c = computeChart(ch.input);
        const res = egenTeto(c.saju);           // 온디바이스 점수·유형
        if (!alive) return;
        setResult(res); setReading(buildEgenReading(res)); setHasChart(true);
      } catch { if (alive) { setHasChart(true); setResult(null); } } // 산출 실패해도 클러스터는 노출
    })().catch(() => { if (alive) setHasChart(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // 명식 없음 → '나를 분석받기' 등록 유도(자기이해 프레이밍 — 운세 아님)
  if (hasChart === false) {
    return (
      <PressableScale style={styles.emptyCard} onPress={() => router.push('/register')}>
        <Text style={styles.kicker}>{t('selfHero.kicker', '나는 어떤 사람인가')}</Text>
        <Text style={[styles.emptyTitle, { fontSize: fs(17) }]}>{t('selfHero.emptyTitle', '나를 분석해 드릴게요')}</Text>
        <Text style={[styles.emptySub, { fontSize: fs(13) }]}>{t('selfHero.emptySub', '생년월일시를 넣으면 사주 엔진이 성격·기질·강점을 분석해요')}</Text>
        <View style={styles.emptyBtn}><Text style={styles.emptyBtnTx}>{t('selfHero.emptyCta', '+ 나를 분석받기')}</Text></View>
      </PressableScale>
    );
  }
  if (hasChart === null) return null; // 로딩 — 깜빡임 방지(홈의 다른 영역이 먼저 뜬다)

  const typeLabel = result ? (result.type === 'teto' ? t('egen.typeTeto', '테토형') : result.type === 'egen' ? t('egen.typeEgen', '에겐형') : t('egen.typeBalanced', '균형형')) : '';
  const pct = result ? (result.type === 'teto' ? result.tetoScore : 100 - result.tetoScore) : 0;

  return (
    // ★카드 크롬 통일(daniel 2026-07-23 '다른 카드들이랑 비슷하게') — 최상위를 형제 카드(BiorhythmCard/TodayRelationCard)와
    //   동일한 단일 카드 View(colors.card·radius.md·shadow.card·padding space(4)·marginBottom space(4))로 감싼다.
    //   게이지는 카드 '안'의 누를 수 있는 영역(→ /selfanalysis), 클러스터 칩도 같은 카드 안으로 넣어 홈에서 한 세트로 보이게.
    //   ★최상위는 순수 View(BiorhythmCard 방식) — 게이지·칩이 각각 다른 라우트라 외곽을 pressable로 감싸면 제스처가 중첩되므로.
    <View style={styles.card}>
      {/* 카드 헤더 — 형제 카드 kicker 와 동일 토큰(font.caption·colors.ju·800·letterSpacing 0.4) */}
      <Text style={styles.cardKicker}>{t('selfHero.kicker', '나는 어떤 사람인가')}</Text>
      {result ? (
        <PressableScale style={styles.gauge} onPress={() => router.push('/selfanalysis')}>
          <View style={styles.badgeRow}>
            <Text style={styles.badge}>{typeLabel}</Text>
            <Text style={styles.pctTx}>{result.type === 'teto' ? t('egen.scaleTeto', '테토') : t('egen.scaleEgen', '에겐')} {pct}%</Text>
          </View>
          <View style={styles.barRow}>
            <Text style={[styles.barEnd, result.type === 'egen' && styles.barEndOn]}>{t('egen.scaleEgen', '에겐')}</Text>
            <EgenBar score={result.tetoScore} />
            <Text style={[styles.barEnd, styles.barEndRight, result.type === 'teto' && styles.barEndOn]}>{t('egen.scaleTeto', '테토')}</Text>
          </View>
          {reading?.headline ? <Text style={[styles.headline, { fontSize: fs(15) }]} numberOfLines={2}>{reading.headline}</Text> : null}
          <Text style={styles.more}>{t('selfHero.more', '나 분석 종합 보기 ›')}</Text>
        </PressableScale>
      ) : null}
      {/* 자기이해 클러스터 — 성격유형·MBTI·특징(무료·온디바이스). 카드 '안'으로 이동(붕 뜬 칩 → 한 세트) */}
      <View style={styles.clusterRow}>
        {CLUSTER.map((c) => (
          <PressableScale key={c.route} style={styles.chip} onPress={() => router.push(c.route as any)}>
            <Text style={[styles.chipTx, { fontSize: fs(11) }]} numberOfLines={1}>{t(c.labelKey, c.fallback)}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ★카드 크롬 = 형제 카드(BiorhythmCard)와 동일 토큰 — 배경·모서리(radius.md)·그림자(shadow.card)·패딩 space(4)·하단마진 space(4) 일치.
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(4), ...shadow.card },
  gauge: { alignSelf: 'stretch' }, // 카드 안 누를 수 있는 게이지 영역(→ /selfanalysis) — 카드 크롬 없음(외곽 card 가 소유)
  kicker: { fontSize: 12, fontWeight: '800', color: colors.ju, letterSpacing: 0.5, marginBottom: space(2), textAlign: 'center' }, // 명식 없음(등록 유도) 카드 헤더 — 중앙정렬
  cardKicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.4, marginBottom: space(2.5) }, // 카드 헤더 — 형제 카드 kicker 와 동일 토큰(font.caption·ju·800·0.4)
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { fontSize: 13, fontWeight: '800', color: colors.bg, backgroundColor: colors.badgeGold, paddingHorizontal: space(3), paddingVertical: space(1), borderRadius: radius.pill, overflow: 'hidden' },
  pctTx: { fontSize: 15, fontWeight: '900', color: colors.ink },
  barRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: space(3.5) },
  barEnd: { fontSize: 12, fontWeight: '700', color: colors.inkFaint, width: 38 },
  barEndRight: { textAlign: 'right' },
  barEndOn: { color: colors.ju, fontWeight: '900' },
  track: { flex: 1, height: 8, backgroundColor: colors.line, borderRadius: 4, marginHorizontal: space(2.5), position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.ju, borderRadius: 4 },
  dot: { position: 'absolute', top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ju, borderWidth: 3, borderColor: colors.card, marginLeft: -9 },
  headline: { fontWeight: '800', color: colors.ink, lineHeight: 22, marginTop: space(3.5), textAlign: 'center' },
  more: { fontSize: 12, fontWeight: '700', color: colors.ju, textAlign: 'center', marginTop: space(3) },
  // 자기이해 클러스터 칩
  clusterRow: { flexDirection: 'row', gap: space(2), marginTop: space(2.5) },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1.5), backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: space(2.5), paddingHorizontal: space(1) },
  chipEmoji: { fontSize: 14 },
  chipTx: { fontWeight: '700', color: colors.inkSoft, flexShrink: 1 },
  // 명식 없음(등록 유도)
  emptyCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(5), alignItems: 'center', marginBottom: space(4), ...shadow.card }, // 등록 유도 CTA(점선) — 모서리만 형제와 통일(radius.md)
  emptyTitle: { fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(1) },
  emptySub: { color: colors.inkSoft, textAlign: 'center', marginTop: space(2), lineHeight: 19 },
  emptyBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(3.5) },
  emptyBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
});
