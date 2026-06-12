// src/app/(app)/month.tsx — 이달의 운세 (무료, 온디바이스 룰)
// ─────────────────────────────────────────────────────────────────────────
// 오늘의 운세와 동일 카테고리(통합·직업·재물·애정·건강), 단 '이번 달 월건 간지'×내 일간으로 푼다(daniel).
//   dailyChartReadings(saju, 월간, 월지) — 같은 룰 엔진에 일진 대신 월건을 먹임 → 월 단위 통변. API 0.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDailyFortune, monthChartReadings, monthFlow, DAILY_AREA_KEYS, type DailyAreaKey } from '../../lib/dailyFortune';
import { loadMyChart } from '../../lib/myChart';
import { buildSajuChart } from '@engine/saju';
import type { SajuChart, Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading } from '../../lib/ohaeng';

export default function MonthScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const f = useMemo(() => getDailyFortune(), []);            // monthGanZhi(이번 달 월건) 사용
  const [saju, setSaju] = useState<SajuChart | null>(null);
  const [area, setArea] = useState<DailyAreaKey>('general');

  useEffect(() => {
    (async () => {
      const input = await loadMyChart();
      if (input) setSaju(buildSajuChart(input));
    })();
  }, []);

  // ★일진 대신 '이번 달 월건' 간지를 룰 엔진에 먹인다 → 월 단위 통변(일→월 프레이밍 치환됨).
  const stem = f.monthGanZhi[0] as Stem;
  const branch = f.monthGanZhi[1] as Branch;
  const areas = useMemo(() => (saju ? monthChartReadings(saju, stem, branch) : null), [saju, stem, branch]);
  const flow = useMemo(() => (saju ? monthFlow(saju, stem) : null), [saju, stem]); // 상순·중순·하순
  const selected = areas?.find((a) => a.key === area);

  const gzChip = (g: string, kind: 'stem' | 'branch') => {
    const el = kind === 'stem' ? stemElement(g) : branchElement(g);
    const ko = kind === 'stem' ? stemReading(g) : branchReading(g);
    return (
      <View style={[styles.gzChip, { backgroundColor: elementColor[el] }]}>
        <Text style={[styles.gzChipTx, { color: elementText[el] }]}>{g}</Text>
        <Text style={[styles.gzChipKo, { color: elementText[el] }]}>{ko}</Text>
      </View>
    );
  };

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bgImage} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* ── 이번 달 월건 — 컴팩트 헤더 ── */}
        <View style={styles.pillarRow}>
          {gzChip(stem, 'stem')}
          {gzChip(branch, 'branch')}
          <View style={styles.pillarInfo}>
            <Text style={styles.pillarTitle}>{t('month.monthPillar')}</Text>
            <Text style={styles.pillarSub}>{f.yearGanZhi}년 {f.monthGanZhi}월</Text>
          </View>
        </View>

        {/* ── 분야별(오늘의 운세와 동일 카테고리) ── */}
        <View style={styles.areaChips}>
          {DAILY_AREA_KEYS.map((k) => (
            <Pressable key={k} style={[styles.areaChip, area === k && styles.areaChipOn]} onPress={() => setArea(k)}>
              <Text style={[styles.areaChipTx, area === k && styles.areaChipTxOn]}>{t(`today.area_${k}`)}</Text>
            </Pressable>
          ))}
        </View>

        {areas && selected ? (
          <View style={styles.readCard}>
            {selected.paragraphs.map((p, i) => (
              <Text key={i} style={[styles.readTx, { fontSize: fs(15), lineHeight: fs(25) }, i > 0 && styles.readTxGap]}>{p}</Text>
            ))}
          </View>
        ) : (
          <View style={styles.readCard}>
            <Text style={styles.readTx}>{t('today.needChart')}</Text>
            <Pressable style={styles.regBtn} onPress={() => router.push('/register')}>
              <Text style={styles.regBtnTx}>{t('today.registerBtn')}</Text>
            </Pressable>
          </View>
        )}

        {/* ── 이번 달 흐름: 상순·중순·하순 ── */}
        {flow && (
          <View style={styles.flowCard}>
            <Text style={styles.flowH}>{t('month.flowTitle')}</Text>
            {flow.map((ph, i) => (
              <View key={i} style={[styles.flowRow, i > 0 && styles.flowRowGap]}>
                <Text style={styles.flowLabel}>{ph.label}</Text>
                <Text style={[styles.flowTx, { fontSize: fs(15), lineHeight: fs(24) }]}>{ph.text}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sub}>{t('month.note')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)' },
  wrap: { padding: space(6), paddingBottom: space(12) },
  pillarRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(2.5),
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    padding: space(3.5), marginBottom: space(4), ...shadow.card,
  },
  gzChip: { width: 40, height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  gzChipTx: { fontSize: 20, fontWeight: '800' },
  gzChipKo: { fontSize: 10, fontWeight: '600', marginTop: -1 },
  pillarInfo: { flex: 1, marginLeft: space(1.5) },
  pillarTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  pillarSub: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  areaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) },
  areaChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  areaChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  areaChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  areaChipTxOn: { color: colors.bg },
  readCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  // 상순·중순·하순 흐름
  flowCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginTop: space(4), ...shadow.card },
  flowH: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(3) },
  flowRow: {},
  flowRowGap: { marginTop: space(4), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  flowLabel: { fontSize: 13, fontWeight: '800', color: colors.ju, marginBottom: space(1.5) },
  flowTx: { ...font.body, color: colors.ink },
  readTx: { ...font.body, color: colors.ink, lineHeight: 25, fontSize: 15 },
  readTxGap: { marginTop: space(3.5) },
  regBtn: { alignSelf: 'flex-start', marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4.5), paddingVertical: space(2.25) },
  regBtnTx: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(5) },
});
