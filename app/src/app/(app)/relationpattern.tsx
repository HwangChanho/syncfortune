// src/app/(app)/relationpattern.tsx — '관계 패턴 분석'(왜 내 관계는 반복되는가) · App Store 4.3 신규 moat(daniel 2026-07-13)
// ─────────────────────────────────────────────────────────────────────────
// 궁합 '운세'가 아니라, 타고난 원국 구조(배우자궁·인연星·도화)로 *반복되는 관계 결*을 읽는 심리 통찰.
//   전부 온디바이스 결정론(사주 엔진)·API 0·무료. 일반 운세앱에 없는 자기이해형 관계 분석 = 4.3 차별점.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { relationPattern } from '../../lib/content/relationPattern';
import { colors, space, radius, font, shadow } from '../../lib/theme';

export default function RelationPatternRoute() {
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

  const data = useMemo(() => {
    if (!input) return null;
    try {
      const c = computeChart(input);
      const g = input.gender ?? (c.saju as any).gender;
      const gender = (g === '남' || g === 'male' || g === 'M') ? 'male' as const : (g === '여' || g === 'female' || g === 'F') ? 'female' as const : undefined;
      return relationPattern(c.saju, gender);
    } catch { return null; }
  }, [input]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!data) return (
    <View style={styles.center}>
      <Text style={styles.emptyMsg}>{t('selfHero.emptySub', '생년월일시를 넣으면 사주 엔진이 성격·기질·강점을 분석해요')}</Text>
      <PressableScale style={styles.emptyBtn} onPress={() => router.push('/register')}><Text style={styles.emptyBtnTx}>{t('selfHero.emptyCta', '+ 나를 분석받기')}</Text></PressableScale>
    </View>
  );

  const SECTIONS = [
    { key: 'drawnTo', label: t('relPattern.drawnTo', '반복해 끌리는 사람의 결'), body: data.drawnTo },
    { key: 'dynamic', label: t('relPattern.dynamic', '나의 관계 역학'), body: data.dynamic },
    { key: 'attraction', label: t('relPattern.attraction', '매력·인연의 밀도'), body: data.attraction },
    { key: 'myStyle', label: t('relPattern.myStyle', '관계에서 나의 방식'), body: data.myStyle },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.kicker}>{t('relPattern.kicker', '사주 엔진으로 보는 관계 심리')}</Text>
      <Text style={styles.title}>{label ? `${label}${t('relPattern.titleSuffix', '님의 관계 패턴')}` : t('relPattern.title', '나의 관계 패턴')}</Text>
      <Text style={styles.sub}>{t('relPattern.sub', '왜 비슷한 관계가 반복될까요? 궁합 운세가 아니라, 타고난 사주 구조에서 반복되는 관계의 결을 읽어요.')}</Text>

      {SECTIONS.map((s) => (
        <View key={s.key} style={styles.card}>
          <Text style={styles.cardLabel}>{s.label}</Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}

      {/* 실제 궁합(상대와의 작용)은 유료 궁합으로 유도 — 이건 '나' 분석, 궁합은 '둘' 분석 */}
      <PressableScale style={styles.linkCard} onPress={() => router.push('/compat')}>
        <Text style={styles.linkTx}>{t('relPattern.compatCta', '특정 상대와의 궁합이 궁금하다면 →')}</Text>
      </PressableScale>

      <Text style={styles.footNote}>{t('relPattern.footNote', '※ 배우자궁(일지)·인연星·도화 등 원국 구조를 사주 엔진으로 계산한 온디바이스 분석이에요. 예언이 아니라 나를 이해하는 참고예요.')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 비쳐 보이게(07-21 배경통일)
  wrap: { padding: space(5), paddingBottom: space(10) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6), backgroundColor: 'transparent' },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.5, marginBottom: space(1) },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, marginBottom: space(2) },
  sub: { ...font.body, color: colors.inkSoft, lineHeight: 21, marginBottom: space(5) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, borderLeftWidth: 3, borderLeftColor: colors.ju, padding: space(4.5), marginBottom: space(4), ...shadow.card },
  cardLabel: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(2) },
  body: { ...font.body, color: colors.ink, lineHeight: 23 },
  linkCard: { backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(3), alignItems: 'center' },
  linkTx: { ...font.body, color: colors.ju, fontWeight: '700' },
  footNote: { ...font.caption, color: colors.inkFaint, lineHeight: 17, marginTop: space(1) },
  emptyMsg: { ...font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 21, marginBottom: space(4) },
  emptyBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6) },
  emptyBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
});
