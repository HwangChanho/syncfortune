// src/app/(app)/today.tsx — 오늘의 운세 (무료, 온디바이스 룰)
// ─────────────────────────────────────────────────────────────────────────
// 오늘 일진 카드 + 분야별(통합·직업·재물·애정·건강) 풀이.
//   대표 명식이 있으면 *내 일간* 대비 오늘 일진의 십신으로 분야 풀이(dailyFortune 룰),
//   없으면 일진만 보여주고 명식 등록을 유도한다. 서버·LLM 0 (무료=룰/템플릿).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDailyFortune, dailyAreaReadings, DAILY_AREA_KEYS, type DailyAreaKey } from '../../lib/dailyFortune';
import { loadMyChart } from '../../lib/myChart';
import { buildSajuChart } from '@engine/saju';
import type { Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading } from '../../lib/ohaeng';

function CornerPattern({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position.startsWith('t');
  const isLeft = position.endsWith('l');
  return (
    <View style={[
      styles.corner,
      isTop ? { top: 10 } : { bottom: 10 },
      isLeft ? { left: 10 } : { right: 10 },
      { transform: [{ rotate: isTop ? (isLeft ? '0deg' : '90deg') : (isLeft ? '270deg' : '180deg') }] }
    ]}>
      <Text style={styles.cornerText}>﹃</Text>
    </View>
  );
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const f = useMemo(() => getDailyFortune(), []);
  const [myStem, setMyStem] = useState<Stem | null>(null);   // 대표 명식의 일간(없으면 null)
  const [area, setArea] = useState<DailyAreaKey>('general'); // 선택 분야(기본 통합)

  // 대표 명식 → 내 일간 (온디바이스 — saju만 계산, 자미 불필요)
  useEffect(() => {
    (async () => {
      const input = await loadMyChart();
      if (input) setMyStem(buildSajuChart(input).dayMaster.stem as Stem);
    })();
  }, []);

  const stem = f.dayGanZhi[0] as Stem;
  const branch = f.dayGanZhi[1] as Branch;
  const el = stemElement(stem);
  const bgColor = elementColor[el];
  const txtColor = elementText[el];

  // 분야 풀이 — 내 일간이 있을 때만(십신은 '나' 기준 상대 개념)
  const daily = useMemo(() => (myStem ? dailyAreaReadings(myStem, stem, branch) : null), [myStem, stem, branch]);
  const selected = daily?.areas.find((a) => a.key === area);

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bgImage} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* ── 오늘 일진 카드 ── */}
        <View style={styles.card}>
          <CornerPattern position="tl" />
          <CornerPattern position="tr" />
          <CornerPattern position="bl" />
          <CornerPattern position="br" />

          <Text style={styles.date}>{f.date}</Text>
          <Text style={styles.title}>{t('today.dayPillar')}</Text>

          <View style={styles.pillarContainer}>
            <View style={[styles.gzBox, { backgroundColor: bgColor }]}>
              <Text style={[styles.gzChar, { color: txtColor }]}>{stem}</Text>
              <Text style={[styles.gzKo, { color: txtColor }]}>{stemReading(stem)}</Text>
            </View>
            <View style={[styles.gzBox, { backgroundColor: elementColor[branchElement(branch)] }]}>
              <Text style={[styles.gzChar, { color: elementText[branchElement(branch)] }]}>{branch}</Text>
              <Text style={[styles.gzKo, { color: elementText[branchElement(branch)] }]}>{branchReading(branch)}</Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.ganzhiText}>{f.dayGanZhi} ({t('myeongsik.dayPillar')})</Text>
          <Text style={styles.infoText}>{f.yearGanZhi}년 {f.monthGanZhi}월</Text>
        </View>

        {/* ── 분야별 풀이 (통합·직업·재물·애정·건강) ── */}
        <Text style={styles.areaH}>{t('today.areas')}</Text>
        <View style={styles.areaChips}>
          {DAILY_AREA_KEYS.map((k) => (
            <Pressable key={k} style={[styles.areaChip, area === k && styles.areaChipOn]} onPress={() => setArea(k)}>
              <Text style={[styles.areaChipTx, area === k && styles.areaChipTxOn]}>{t(`today.area_${k}`)}</Text>
            </Pressable>
          ))}
        </View>

        {daily && selected ? (
          <View style={styles.readCard}>
            {/* 글라스박스 — 왜 이런 풀이인지: 오늘 일진이 나의 어떤 십신인지 표기 */}
            <Text style={styles.tgLine}>
              {t('today.myTg')} <Text style={styles.tgStrong}>{daily.stemTg}</Text>
              <Text style={styles.tgSub}>  (천간 {daily.stemTg} · 지지 {daily.branchTg})</Text>
            </Text>
            <Text style={styles.readTx}>{selected.reading}</Text>
          </View>
        ) : (
          // 명식 미등록 — 십신은 '나' 기준이라 일간 없이는 분야 풀이 불가 → 등록 유도
          <View style={styles.readCard}>
            <Text style={styles.readTx}>{t('today.needChart')}</Text>
            <Pressable style={styles.regBtn} onPress={() => router.push('/register')}>
              <Text style={styles.regBtnTx}>{t('today.registerBtn')}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sub}>{t('today.note')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)' },
  wrap: { padding: space(6), paddingBottom: space(12) },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space(7),
    alignItems: 'center',
    ...shadow.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  corner: { position: 'absolute' },
  cornerText: { color: colors.ju, fontSize: 24, fontWeight: '300', opacity: 0.6 },
  date: { ...font.caption, color: colors.ju, marginBottom: space(1), fontWeight: '700' },
  title: { ...font.title, marginBottom: space(6) },
  pillarContainer: { flexDirection: 'row', gap: space(4), marginBottom: space(6) },
  gzBox: {
    width: 80,
    height: 110,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.soft,
  },
  gzChar: { fontSize: 42, fontWeight: '800' },
  gzKo: { fontSize: 14, fontWeight: '600', marginTop: space(1) },
  divider: { width: 40, height: 2, backgroundColor: colors.line, marginBottom: space(4) },
  ganzhiText: { ...font.heading, color: colors.ink, marginBottom: space(1.5) },
  infoText: { ...font.caption, color: colors.inkFaint },
  // 분야별 풀이
  areaH: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: space(6), marginBottom: space(3) },
  areaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) },
  areaChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  areaChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },   // 선택 = 골드 배경(테마 컨벤션)
  areaChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  areaChipTxOn: { color: colors.bg },
  readCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  tgLine: { ...font.caption, color: colors.inkSoft, marginBottom: space(2.5) },
  tgStrong: { color: colors.ju, fontWeight: '800', fontSize: 15 },
  tgSub: { color: colors.inkFaint, fontSize: 11 },
  readTx: { ...font.body, color: colors.ink, lineHeight: 24 },
  regBtn: { alignSelf: 'flex-start', marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4.5), paddingVertical: space(2.25) },
  regBtnTx: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(5) },
});
