// src/app/(app)/personatype.tsx — 나의 성격유형 120종 (가볍게·무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 홈 주인공 카드(PersonaTypeHero)의 상세. 산출 = engine/personaType.ts (일간10 × 월지12 = 120종, API 0).
//   축 근거: 전문가 검수 "전체 기운은 월지만 봐도 된다 · 기준점은 월지의 계절"(2026-07-14) + 일간=나 자신.
//
// ★화면이 명리 어휘를 새로 지어내지 않는다 — 아래 3축 카드는 전부 엔진이 넘겨준 persona.parts 값
//   (STEM·BRANCH·GYEOK 22개 항목)을 그대로 배치만 한다. 그래야 daniel 검수 대상이 22개로 유지된다.
// ⚠️§4 안전: 단정·부정 증폭 금지. '이런 결을 타고났다 + 그래서 이렇게 쓴다'까지만.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ImageBackground } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loadMyChart } from '../../lib/engine/myChart';
import { personaFromRepChart } from '../../components/PersonaTypeHero'; // 명식 → 유형 산출(홈 히어로와 동일 경로 = 정합)
import { PersonaImage } from '../../components/PersonaImage'; // 성격유형 카드 이미지(서버 fetch·실패 시 오행색 폴백)
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ContentHero } from '../../components/SpecialContentScreen';
import { Reveal } from '../../components/Reveal'; // 카드 순차 등장(daniel 재미)
import { ChartPicker } from '../../components/ChartPicker';
import { ShareReadingButton } from '../../components/ShareReadingButton';
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계 — 진입 1회 기록

export default function PersonaTypeScreen() {
  useLogContentVisit('personatype');
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [me, setMe] = useState<ChartInput | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) setMe(c); });
    return () => { alive = false; };
  }, []));

  const p = useMemo(() => (me ? personaFromRepChart(me) : null), [me]);

  // 3축 카드 — 일간(나라는 재료) / 월지(내가 놓인 계절) / 격(삶의 무게중심).
  //   격은 못 구할 수 있어(구버전 차트) 값이 있을 때만 넣는다 — 없는 걸 지어내지 않는다.
  const axes = p ? [
    { key: 'stem',   label: t('persona120.axisStem', '나라는 재료'),      head: p.parts.stemImage, body: `${p.parts.stemTrait}. ${p.parts.stemTone} 결이에요.` },
    { key: 'season', label: t('persona120.axisSeason', '내가 놓인 계절'), head: p.season,          body: `${p.parts.seasonMood} 계절에 태어났어요. 계절은 그 사람 기운의 기준점이 돼요.` },
    ...(p.parts.gyeokLabel ? [{ key: 'gyeok', label: t('persona120.axisGyeok', '삶의 무게중심'), head: p.parts.gyeokLabel, body: `${p.parts.gyeokAxis} 쪽에 무게가 실려 있어요.` }] : []),
  ] : [];

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용 명식 표시·전환 */}
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />
        <ContentHero
          image={require('../../../assets/icons/persona.jpg')}
          title={t('persona120.title', '나의 성격유형')}
          sub={t('persona120.sub', '일간 10 × 월지 12 = 120가지 중 나는 어떤 유형일까')}
        />

        {!p ? (
          <Text style={styles.note}>{t('persona120.empty', '명식을 등록하면 120가지 중 내 유형을 보여드려요.')}</Text>
        ) : (
          <>
            <Reveal delay={0}>
              <View style={styles.typeCard}>
                {/* 성별맞춤 카드 이미지(서버 fetch) — URL 없음/로드 실패 시 오행색 네모 폴백(PersonaImage 내부) */}
                <PersonaImage dayStem={p.dayStem} monthBranch={p.monthBranch} sex={me?.sex} width={224} height={288} />
                <Text style={[styles.typeName, { fontSize: fs(24) }]}>{p.name}</Text>
                <View style={styles.chips}>
                  {p.keywords.map((k) => <View key={k} style={styles.chip}><Text style={styles.chipTx}>{k}</Text></View>)}
                </View>
                <Text style={[styles.typeSummary, { fontSize: fs(14), lineHeight: fs(21) }]}>{p.summary}</Text>
              </View>
            </Reveal>

            {/* 3축 분해 — 이 유형이 '왜' 그렇게 나왔는지(근거 노출 = 룰 기반 신뢰) */}
            {axes.map((a, i) => (
              <Reveal key={a.key} delay={150 + i * 90}>
                <View style={styles.axisCard}>
                  <Text style={styles.axisLabel}>{a.label}</Text>
                  <Text style={[styles.axisHead, { fontSize: fs(17) }]}>{a.head}</Text>
                  <Text style={[styles.axisBody, { fontSize: fs(13.5), lineHeight: fs(20) }]}>{a.body}</Text>
                </View>
              </Reveal>
            ))}

            <ShareReadingButton kind="personatype" title="나의 성격유형" content={{ name: p.name, keywords: p.keywords.join(' · '), summary: p.summary }} />
          </>
        )}

        <Text style={styles.note}>
          {t('persona120.note', '※ 일간(나 자신)과 월지(태어난 계절)로 나눈 120가지 결이에요. 타고난 결을 보는 것이라 좋고 나쁨이 아니고, 같은 유형이어도 나머지 글자와 지금 운에 따라 쓰임이 달라져요.')}
        </Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  typeCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.ju, padding: space(6), marginBottom: space(4), ...shadow.card },
  typeName: { fontWeight: '900', color: colors.ju, letterSpacing: 0.5, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(1.5), marginTop: space(2.5) },
  chip: { backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(1) },
  chipTx: { fontSize: 12, fontWeight: '800', color: colors.ju },
  typeSummary: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(3) },
  axisCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(2.5), ...shadow.card },
  axisLabel: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.3 },
  axisHead: { fontWeight: '900', color: colors.ink, marginTop: space(1) },
  axisBody: { ...font.body, color: colors.inkSoft, marginTop: space(1.5) },
  note: { ...font.caption, color: colors.inkFaint, lineHeight: 18, marginTop: space(4) },
});
