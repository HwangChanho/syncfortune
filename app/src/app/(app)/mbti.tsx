// src/app/(app)/mbti.tsx — 사주로 보는 내 MBTI (가볍게·무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 원국 십신·음양으로 MBTI 4축·16유형 산출(sajuMbti, API 0·규칙5). 명식 있으면 바로.
//   ⚠️ 매핑·문구 stance = daniel★ 검수(sajuMbti.ts 주석 참고).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, ImageBackground, Animated, Easing } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loadMyChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { sajuMbti } from '../../lib/content/sajuMbti';
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ContentHero } from '../../components/SpecialContentScreen';
import { Reveal } from '../../components/Reveal'; // 카드 순차 등장(daniel 재미)
import { ChartPicker } from '../../components/ChartPicker';
import { ShareReadingButton } from '../../components/ShareReadingButton';
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

// 각 축의 [왼글자, 오른글자] — score(0~100)는 오른글자 비율
const AXIS_ENDS: Record<string, [string, string]> = { EI: ['I', 'E'], SN: ['S', 'N'], TF: ['T', 'F'], JP: ['J', 'P'] };

// 축 게이지 채움 애니(0→score%) — MBTI 고유 재미(daniel ②콘텐츠별 메타포). width %라 useNativeDriver 불가.
function AxisBar({ score }: { score: number }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: score, duration: 850, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [score, w]);
  return <View style={styles.axisBar}><Animated.View style={[styles.axisFill, { width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} /></View>;
}

export default function MbtiScreen() {
  useLogContentVisit('mbti'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [me, setMe] = useState<ChartInput | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) setMe(c); });
    return () => { alive = false; };
  }, []));

  const r = useMemo(() => (me ? sajuMbti(computeChart(me).saju) : null), [me]);


  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용 명식 표시·전환 */}
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />
        <ContentHero image={require('../../../assets/icons/mbti.jpg')} title={t('mbti.title', '사주로 보는 내 MBTI')} sub={t('mbti.sub', '내 사주 구조로 풀어본 성향 유형')} />

        {!r ? (
          <Text style={styles.note}>{t('mbti.empty', '명식을 등록하면 사주로 본 MBTI를 보여드려요.')}</Text>
        ) : (
          <>
            <Reveal delay={0}>
              <View style={styles.typeCard}>
                <Text style={styles.typeBig}>{r.type}</Text>
                <Text style={styles.typeNick}>{r.nickname}</Text>
                <Text style={[styles.typeSummary, { fontSize: fs(14), lineHeight: fs(21) }]}>{r.summary}</Text>
              </View>
            </Reveal>

            {r.axes.map((a, i) => {
              const [L, R] = AXIS_ENDS[a.key];
              return (
                <Reveal key={a.key} delay={150 + i * 90}>
                  <View style={styles.axisCard}>
                    <View style={styles.axisHead}>
                      <Text style={[styles.axisEnd, a.letter === L && styles.axisOn]}>{L}</Text>
                      <AxisBar score={a.score} />
                      <Text style={[styles.axisEnd, a.letter === R && styles.axisOn]}>{R}</Text>
                    </View>
                    <Text style={[styles.axisReason, { fontSize: fs(13), lineHeight: fs(20) }]}>{a.reason}</Text>
                  </View>
                </Reveal>
              );
            })}

            {/* 이슈17: 결과 공유(앱게이트) */}
            <ShareReadingButton kind="mbti" title="사주로 보는 내 MBTI" content={{ type: r.type, nickname: r.nickname, summary: r.summary }} />
          </>
        )}

        <Text style={styles.note}>{t('mbti.note', '※ 사주 구조(지장간·현재 운 포함)로 본 성향이라 시기에 따라 조금씩 달라져요. 심리검사 MBTI와 다를 수 있어요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  typeCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.ju, padding: space(6), marginBottom: space(4), ...shadow.card },
  typeBig: { fontSize: 44, fontWeight: '900', color: colors.ju, letterSpacing: 3 },
  typeNick: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: space(1) },
  typeSummary: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2) },
  axisCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(2.5), ...shadow.card },
  axisHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  axisEnd: { fontSize: 18, fontWeight: '900', color: colors.inkFaint, width: 22, textAlign: 'center' },
  axisOn: { color: colors.ju },
  axisBar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  axisFill: { height: '100%', borderRadius: 4, backgroundColor: colors.ju },
  axisReason: { ...font.body, color: colors.inkSoft, marginTop: space(2.5) },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
