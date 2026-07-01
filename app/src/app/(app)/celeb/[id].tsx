// src/app/(app)/celeb/[id].tsx — 유명인 1인 ↔ 나 사주 유사도 상세 (결정론 v2)
// ─────────────────────────────────────────────────────────────────────────
// LLM/Edge 호출 없음. computeChart(나) vs computeChart(유명인) → 결정론 유사도.
// ⚠️ 재미·추정 콘텐츠. 투자·정치 단정 절대 금지. 명예 존중.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, ImageBackground,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { computeChart } from '../../../lib/engine/engine';
import { loadMyChart } from '../../../lib/engine/myChart';
import { CELEB_DB, celebChartInput } from '../../../lib/content/celebData';
import { rankCelebs, matchHeadline, matchGrade, type CelebMatchResult } from '../../../lib/content/celebMatch';
import { stemElement } from '../../../lib/engine/ohaeng';
import { bgSource, colors, radius, space, shadow, font } from '../../../lib/theme';
import { ChartPicker } from '../../../components/ChartPicker';
import type { ChartInput } from '@spec/chart';

export default function CelebDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [myInput, setMyInput] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  // 화면 포커스마다 대표 명식 재로딩(명식 교체 동기화)
  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) { setMyInput(c); setLoading(false); } });
    return () => { alive = false; };
  }, []));

  // 대상 유명인 찾기
  const celeb = CELEB_DB.find((c) => c.id === id);

  // 결정론 유사도 계산 (메모이즈: myInput 바뀔 때만 재계산)
  const result: CelebMatchResult | null = useMemo(() => {
    if (!myInput || !celeb) return null;
    const myChart = computeChart(myInput);
    // rankCelebs 전체 대신 단일 인물만 계산 → 빠름
    const ranks = rankCelebs(myChart, [celeb]);
    return ranks[0] ?? null;
  }, [myInput, celeb]);

  // 유명인 명식 (일간·오행 표시용)
  const celebChart = useMemo(() => (celeb ? computeChart(celebChartInput(celeb)) : null), [celeb]);

  // ── 로딩·에러 상태 ──────────────────────────────────────────────────────
  if (!celeb) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>인물 정보를 찾을 수 없어요.</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnTx}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }

  if (!myInput) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('compat.needChart', '먼저 명식을 등록해 주세요.')}</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/register')}>
          <Text style={styles.btnTx}>{t('compat.registerMyChart', '내 명식 등록')}</Text>
        </Pressable>
      </View>
    );
  }

  // ── 결과 준비 ────────────────────────────────────────────────────────────
  const myChart = computeChart(myInput);
  const myDay = myChart.saju.pillars['일'];
  const myElem = stemElement(myDay.stem);

  const cDay = celebChart?.saju.pillars['일'];
  const cElem = cDay ? stemElement(cDay.stem) : '';

  const grade = result ? matchGrade(result.score) : matchGrade(0);
  const headline = result ? matchHeadline(result) : '';

  // 재미 설명 문구 — 오행/일간 기반 룰 (★daniel 검수: 문구·톤 조정 슬롯)
  const myPillarsDesc = `일간 ${myDay.stem}(${myElem})`;
  const cPillarsDesc = cDay ? `일간 ${cDay.stem}(${cElem})` : '';

  // 십신 분포 요약 — 내 과다·부재 (재미 포인트)
  const myTg = myChart.tenGods;
  const excess = myTg.excess.join('·') || '없음';
  const absent = myTg.absent.join('·') || '없음';

  // 유명인 십신
  const cTg = celebChart ? celebChart.tenGods : null;
  const cExcess = cTg ? (cTg.excess.join('·') || '없음') : '-';

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>

        {/* 상단 명식 헤더 — 다른 명식으로 전환 가능 */}
        <ChartPicker onChange={() => loadMyChart().then(setMyInput)} />

        {/* 히어로: 유명인 이름·역할 */}
        <View style={styles.hero}>
          <Text style={styles.heroFlag}>{celeb.flag}</Text>
          <Text style={styles.heroName}>{celeb.name}</Text>
          <Text style={styles.heroRole}>{celeb.role}</Text>
          <Text style={styles.heroBlurb}>{celeb.blurb}</Text>
        </View>

        {/* 닮음 점수 뱃지 */}
        {result && (
          <View style={[styles.scoreBadge, { borderColor: grade.color }]}>
            <Text style={[styles.scoreGrade, { color: grade.color }]}>
              {grade.emoji} {grade.label}
            </Text>
            <Text style={styles.scoreNum}>{result.score}점</Text>
            <Text style={styles.scoreNote}>재미로 보는 사주 유사도</Text>
          </View>
        )}

        {/* 핵심 매칭 문구 */}
        {headline ? (
          <View style={styles.card}>
            <Text style={styles.cardHead}>{t('celeb.matchHead', '닮은 점')}</Text>
            <Text style={styles.body}>{headline}</Text>
          </View>
        ) : null}

        {/* 이유 뱃지들 */}
        {result && result.reasons.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardHead}>{t('celeb.reasons', '공통 구조')}</Text>
            <View style={styles.tagRow}>
              {result.reasons.map((r, i) => (
                <View
                  key={i}
                  style={[
                    styles.tag,
                    r.strength === '강' && styles.tagStrong,
                    r.strength === '중' && styles.tagMid,
                  ]}
                >
                  <Text style={[styles.tagTx, r.strength === '강' && styles.tagTxStrong]}>
                    {r.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 나 vs 유명인 — 일간·오행 비교 (재미 카드) */}
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('celeb.compare', '일간·오행 비교')}</Text>
          <View style={styles.compareRow}>
            {/* 나 */}
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>나</Text>
              <Text style={styles.compareStem}>{myDay.stem}</Text>
              <Text style={styles.compareElem}>{myElem}</Text>
              <Text style={styles.compareSub}>{myPillarsDesc}</Text>
            </View>
            {/* 구분 */}
            <View style={styles.compareDivider}><Text style={styles.vs}>vs</Text></View>
            {/* 유명인 */}
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>{celeb.name}</Text>
              {cDay ? (
                <>
                  <Text style={styles.compareStem}>{cDay.stem}</Text>
                  <Text style={styles.compareElem}>{cElem}</Text>
                  <Text style={styles.compareSub}>{cPillarsDesc}</Text>
                </>
              ) : <Text style={styles.compareSub}>시각 미상</Text>}
            </View>
          </View>
        </View>

        {/* 내 십신 요약 — 공통 맥락 */}
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('celeb.myTenGod', '내 십신 구조 요약')}</Text>
          <Text style={styles.body}>
            과다: {excess} · 부재: {absent}
          </Text>
          {cTg && (
            <Text style={[styles.body, { marginTop: space(2), color: colors.inkSoft }]}>
              {celeb.name}: 과다 {cExcess}
            </Text>
          )}
        </View>

        {/* 재미 안내 */}
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('celeb.funNote', '재미로 보기')}</Text>
          <Text style={styles.body}>
            사주 유사도는 팔자 구조를 가볍게 견주는 재미예요.
            같은 일주를 가졌다고 같은 인생을 산다는 뜻은 아니에요.
            시대·환경·노력이 사주보다 훨씬 큰 영향을 미칩니다.
          </Text>
        </View>

        {/* 면책 */}
        <Text style={styles.disclaimer}>
          * 공개된 생년월일 기반·출생 시각 미상(시주 제외)의 재미·추정 콘텐츠입니다.{'\n'}
          투자·정치·진로 판단의 근거로 사용하지 마세요.
        </Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6) },
  btnTx: { color: colors.bg, fontSize: 15, fontWeight: '700' },

  // 히어로
  hero: { alignItems: 'center', paddingVertical: space(5), marginBottom: space(2) },
  heroFlag: { fontSize: 56, marginBottom: space(2) },
  heroName: { fontSize: 24, fontWeight: '900', color: colors.ink },
  heroRole: { ...font.label, color: colors.ju, marginTop: 4 },
  heroBlurb: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center', lineHeight: 18 },

  // 점수 뱃지
  scoreBadge: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space(5),
    marginBottom: space(4),
    backgroundColor: colors.juSoft,
    ...shadow.card,
  },
  scoreGrade: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  scoreNum: { fontSize: 36, fontWeight: '900', color: colors.ink, marginTop: space(1) },
  scoreNote: { ...font.caption, color: colors.inkSoft, marginTop: space(1) },

  // 공통 카드
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.juLine,
    padding: space(5),
    marginBottom: space(4),
    ...shadow.card,
  },
  cardHead: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink, lineHeight: 24 },

  // 이유 뱃지
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  tag: {
    backgroundColor: 'rgba(201,161,74,0.12)',
    borderRadius: radius.pill,
    paddingVertical: space(1.5),
    paddingHorizontal: space(3),
    borderWidth: 1,
    borderColor: 'rgba(201,161,74,0.3)',
  },
  tagStrong: { backgroundColor: 'rgba(201,161,74,0.2)', borderColor: colors.ju },
  tagMid: { backgroundColor: 'rgba(138,127,191,0.15)', borderColor: 'rgba(138,127,191,0.4)' },
  tagTx: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  tagTxStrong: { color: colors.ju },

  // 비교 카드
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: space(2),
  },
  compareCol: { alignItems: 'center', flex: 1 },
  compareDivider: { paddingHorizontal: space(2) },
  vs: { fontSize: 13, fontWeight: '700', color: colors.inkFaint },
  compareLabel: { ...font.caption, color: colors.inkSoft, marginBottom: space(1.5) },
  compareStem: { fontSize: 36, fontWeight: '900', color: colors.ink },
  compareElem: { fontSize: 15, fontWeight: '700', color: colors.ju, marginTop: 2 },
  compareSub: { ...font.caption, color: colors.inkFaint, marginTop: space(1), textAlign: 'center' },

  disclaimer: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(2), lineHeight: 17 },
});
