// src/app/(app)/today.tsx — 오늘의 운세 (무료, 온디바이스 룰)
// ─────────────────────────────────────────────────────────────────────────
// 컴팩트 일진 헤더 + 분야별(통합·직업·재물·애정·건강) 풀이.
//   대표 명식과 엮어 다층 룰(십신·신강약·12운성·합충·공망·신살·부재 — dailyFortune)로 풀되,
//   ★본문은 일상어만(한자·명리 용어 미노출, daniel 지시). 명식 없으면 등록 유도.
// 서버·LLM 0 (무료=룰/템플릿).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDailyFortune, dailyChartReadings, DAILY_AREA_KEYS, type DailyAreaKey } from '../../lib/dailyFortune';
import { loadMyChart } from '../../lib/myChart';
import { buildSajuChart } from '@engine/saju';
import type { SajuChart, Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading } from '../../lib/ohaeng';

export default function TodayScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 본문 글자 크기(설정에서 조절)
  const router = useRouter();
  const f = useMemo(() => getDailyFortune(), []);
  const [saju, setSaju] = useState<SajuChart | null>(null);  // 대표 명식(없으면 null → 등록 유도)
  const [area, setArea] = useState<DailyAreaKey>('general'); // 선택 분야(기본 통합)

  // 대표 명식 로드 → 사주 차트(온디바이스, 자미 불필요라 buildSajuChart만)
  useEffect(() => {
    (async () => {
      const input = await loadMyChart();
      if (input) setSaju(buildSajuChart(input));
    })();
  }, []);

  const stem = f.dayGanZhi[0] as Stem;
  const branch = f.dayGanZhi[1] as Branch;

  // 분야 풀이 — 명식 전체와 엮은 다층 룰(본문은 일상어)
  const areas = useMemo(() => (saju ? dailyChartReadings(saju, stem, branch) : null), [saju, stem, branch]);
  const selected = areas?.find((a) => a.key === area);

  // 일진 미니 칩(오행색) — 정보로만 작게, 통변 본문에는 간지 미노출
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
        {/* ── 오늘 일진 — 컴팩트 한 줄(크게 보여줄 필요 없음 · daniel) ── */}
        <View style={styles.pillarRow}>
          {gzChip(stem, 'stem')}
          {gzChip(branch, 'branch')}
          <View style={styles.pillarInfo}>
            <Text style={styles.pillarTitle}>{t('today.dayPillar')}</Text>
            <Text style={styles.pillarSub}>{f.date} · {f.yearGanZhi}년 {f.monthGanZhi}월</Text>
          </View>
        </View>

        {/* ── 분야별 풀이 (통합·직업·재물·애정·건강) ── */}
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
          // 명식 미등록 — 풀이는 '나' 기준 상대 개념이라 명식 없이는 불가 → 등록 유도
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
  // 일진 컴팩트 헤더
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
  // 분야별 풀이
  areaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) },
  areaChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  areaChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },   // 선택 = 골드 배경(테마 컨벤션)
  areaChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  areaChipTxOn: { color: colors.bg },
  readCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  readTx: { ...font.body, color: colors.ink, lineHeight: 25, fontSize: 15 },
  readTxGap: { marginTop: space(3.5) },
  regBtn: { alignSelf: 'flex-start', marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4.5), paddingVertical: space(2.25) },
  regBtnTx: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(5) },
});
