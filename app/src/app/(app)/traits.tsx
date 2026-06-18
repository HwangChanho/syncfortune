// src/app/(app)/traits.tsx — 나의 특징 (대표 명식 기반 성격·강약 요약, 무료 훅)
// ─────────────────────────────────────────────────────────────────────────
// '내 명식' 메뉴 대체 — 등록(ChartPicker)과 중복 해소. 대표 명식의 일간 성향 +
//   격국·신강약·오행 강약을 간단 요약하고, 딥 분석은 프리미엄 풀이로 유도(건당).
// ※ 텍스트 다국어는 추후(현재 한국어). 대표 명식 없으면 등록 유도.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine';
import { loadMyChart } from '../../lib/myChart';
import { dayMasterTraits } from '../../lib/dayMasterTraits';
import { stemElement, branchElement, elementColor } from '../../lib/ohaeng';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';
import { useCallback } from 'react';

export default function TraitsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  // 대표 명식이 바뀔 수 있으니 포커스마다 재로드
  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) { setMe(c); setLoading(false); } });
    return () => { alive = false; };
  }, []));

  const c = useMemo(() => (me ? computeChart(me) : null), [me]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!c) return (
    <View style={styles.center}>
      <Text style={styles.msg}>{t('compat.needChart')}</Text>
      <Pressable style={styles.btn} onPress={() => router.push('/register')}>
        <Text style={styles.btnText}>{t('compat.registerMyChart')}</Text>
      </Pressable>
    </View>
  );

  const dm = c.saju.dayMaster.stem;
  const trait = dayMasterTraits[dm] ?? '';
  // 오행 강약 (천간+지지)
  const elem: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  (['년', '월', '일', '시'] as const).forEach((p) => {
    const d = c.saju.pillars[p];
    if (d) { elem[stemElement(d.stem)]++; elem[branchElement(d.branch)]++; }
  });
  const elemMax = Math.max(...Object.values(elem), 1); // 막대 정규화 기준

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>나의 특징</Text>

      {/* 일간 성향 */}
      <View style={styles.card}>
        <Text style={[styles.dm, { color: elementColor[stemElement(dm)] }]}>{dm} · {c.saju.dayMaster.element}</Text>
        <Text style={styles.trait}>{trait}</Text>
      </View>

      {/* 구조 요약 */}
      <View style={styles.card}>
        <Text style={styles.kv}><Text style={styles.label}>격국</Text>  {c.pattern.candidates.join(', ')}</Text>
        <Text style={styles.kv}><Text style={styles.label}>신강약</Text>  {c.strength.verdict} ({c.strength.score})</Text>
      </View>

      {/* 오행 강약 막대(보는 맛) */}
      <View style={styles.card}>
        <Text style={styles.label}>오행 강약</Text>
        {(['木', '火', '土', '金', '水'] as const).map((el) => (
          <View key={el} style={styles.elemRow}>
            <Text style={[styles.elemEl, { color: elementColor[el] }]}>{el}</Text>
            <View style={styles.elemTrack}>
              <View style={[styles.elemFill, { width: `${(elem[el] / elemMax) * 100}%`, backgroundColor: elementColor[el] }]} />
            </View>
            <Text style={styles.elemCnt}>{elem[el]}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>※ 기본 성향 요약입니다. 영역별(연애·직업·재물 등) 깊은 통변은 프리미엄 풀이에서.</Text>

      {/* 프리미엄 풀이 유도 (건당) */}
      <Pressable style={styles.cta} onPress={() => router.push({ pathname: '/reading', params: { input: JSON.stringify(me) } })}>
        <Text style={styles.ctaText}>{t('myeongsik.readingBtn')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  h: { ...font.title, marginBottom: space(4) },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: space(5), marginBottom: space(4), ...shadow.card,
  },
  dm: { fontSize: 28, fontWeight: '800', marginBottom: space(3) },
  trait: { ...font.body, color: colors.ink, lineHeight: 24 },
  kv: { ...font.body, color: colors.ink, marginTop: space(2), lineHeight: 22 },
  label: { color: colors.inkSoft, fontWeight: '700' },
  // 오행 강약 막대
  elemRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(2.5) },
  elemEl: { fontSize: 16, fontWeight: '800', width: 24 },
  elemTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.sunk, overflow: 'hidden', marginHorizontal: space(2) },
  elemFill: { height: '100%', borderRadius: 5 },
  elemCnt: { ...font.caption, color: colors.inkSoft, width: 16, textAlign: 'right' },
  note: { ...font.caption, marginTop: space(5) },
  cta: {
    backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4),
    alignItems: 'center', marginTop: space(6), ...shadow.card,
  },
  ctaText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
