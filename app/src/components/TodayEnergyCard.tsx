// src/components/TodayEnergyCard.tsx — 홈 주인공 ②: 오늘 기운 × 내 원국
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-18 스펙(경쟁앱 참고 사진): **카드 + 유형명 + 근거 + 주의 등급 + 총운 점수**를 결정론으로.
//   기존 홈의 '오늘/내일 기운 배너'(일진·점수흐름 그래프·한 줄 풀이)와 역할이 다르다 —
//   저쪽은 '오늘 어떤 하루인가(서술)', 이 카드는 **'왜 그런가(근거)와 몇 점인가(등급)'**.
//
// ★명리 판정을 새로 만들지 않았다: lib/content/dailyFortune.ts 의 dailyEnergy()가
//   기존 dailyScore 와 **같은 계산**을 하고 재료(십신 그룹·억부 우호·충합·신살)를 함께 돌려줄 뿐이다.
// ⚠️§4 안전: 낮은 점수도 부정 증폭 금지 — '조심'은 관리축(무리 말고 지키기)으로만 서술한다.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { loadRepChart } from '../lib/engine/myChart';
import { buildSajuChart } from '@engine/saju';
import { getDailyFortune, dailyEnergy, energyReason, ENERGY_LABEL, type DailyEnergy } from '../lib/content/dailyFortune';
import { stemElement, branchElement, elementColor, elementText } from '../lib/engine/ohaeng';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { Stem, Branch } from '@spec/chart';

// 주의 등급 라벨·색 — 점수 구간(dailyEnergy.caution)에 붙는 이름표.
//   ★'조심'에 빨강을 쓰지 않는다(§4 부정 증폭 금지) — 골드/중립 톤으로 낮춰 표시.
const CAUTION: Record<DailyEnergy['caution'], { label: string; tone: string }> = {
  low:  { label: '순조', tone: colors.ju },
  mid:  { label: '보통', tone: colors.inkSoft },
  high: { label: '조심', tone: colors.inkSoft },
};

/**
 * 홈 주인공 카드 ②.
 * @param reloadKey 대표 명식 전환·홈 포커스 시 홈이 올려 재산출
 * @param dateKey   오늘 날짜 문자열 — 자정이 지나면 값이 바뀌어 재산출된다(포커스 없이 앱 복귀만 해도 갱신)
 */
export function TodayEnergyCard({ reloadKey, dateKey }: { reloadKey?: number; dateKey?: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [e, setE] = useState<DailyEnergy | null>(null);
  const [gz, setGz] = useState<string>(''); // 오늘 일진 간지(카드 좌측 네모)

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      if (!ch) { setE(null); return; }
      try {
        const saju = buildSajuChart(ch.input);
        const f = getDailyFortune(0);                       // 오늘 일진
        setGz(f.dayGanZhi);
        setE(dailyEnergy(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch));
      } catch { if (alive) setE(null); }                    // 산출 실패 시 조용히 미노출(홈이 깨지지 않게)
    })().catch(() => { if (alive) setE(null); });
    return () => { alive = false; };
  }, [reloadKey, dateKey]);

  // 명식이 없거나 산출 실패 → 렌더하지 않는다(홈의 '명식 등록' 안내는 아래 배너가 이미 담당).
  if (!e || !gz) return null;

  const label = ENERGY_LABEL[e.group];
  const cau = CAUTION[e.caution];
  const stemEl = stemElement(gz[0]);
  const branchEl = branchElement(gz[1]);

  return (
    <PressableScale style={styles.card} onPress={() => router.push('/today')}>
      <View style={styles.head}>
        <Text style={styles.kicker}>{t('todayEnergy.kicker', '오늘의 기운')}</Text>
        {/* 총운 점수 + 주의 등급 — daniel 스펙의 '총운 점수/주의 등급' */}
        <View style={styles.scoreWrap}>
          <Text style={[styles.score, { color: cau.tone }]}>{e.score}</Text>
          <Text style={styles.scoreUnit}>{t('todayEnergy.point', '점')}</Text>
          <View style={[styles.cautionPill, { borderColor: cau.tone }]}>
            <Text style={[styles.cautionTx, { color: cau.tone }]}>{cau.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.row}>
        {/* 오늘 일진 = 오행색 간지 네모(앱 공통 시각 언어) */}
        <View style={styles.gzRow}>
          <View style={[styles.gzBox, { backgroundColor: elementColor[stemEl] }]}>
            <Text style={[styles.gzTx, { color: elementText[stemEl] }]}>{gz[0]}</Text>
          </View>
          <View style={[styles.gzBox, { backgroundColor: elementColor[branchEl] }]}>
            <Text style={[styles.gzTx, { color: elementText[branchEl] }]}>{gz[1]}</Text>
          </View>
        </View>
        <View style={styles.titleCol}>
          <Text style={[styles.name, { fontSize: fs(18) }]} numberOfLines={1}>{label.name}</Text>
          <Text style={[styles.desc, { fontSize: fs(12.5) }]} numberOfLines={2}>{label.desc}</Text>
        </View>
      </View>

      {/* 근거 — 억부(내 강약 × 오늘 기운). daniel 스펙의 '근거' 칸 */}
      <Text style={[styles.reason, { fontSize: fs(13), lineHeight: fs(19) }]}>{energyReason(e)}</Text>

      {/* 작용·신살 칩 — 이미 판정된 것만(천을귀인·합·충형·공망·도화·역마) */}
      {e.signals.length > 0 && (
        <View style={styles.chips}>
          {e.signals.map((s) => (
            <View key={s.key} style={[styles.chip, s.kind === 'good' ? styles.chipGood : styles.chipCare]}>
              <Text style={[styles.chipTx, s.kind === 'good' && styles.chipTxGood]} numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.more}>{t('todayEnergy.more', '오늘 운세 자세히')} ›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(4), ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(3) },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.4 },
  scoreWrap: { flexDirection: 'row', alignItems: 'baseline', gap: space(1) },
  score: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  scoreUnit: { ...font.caption, color: colors.inkFaint, marginRight: space(1.5) },
  cautionPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.5), alignSelf: 'center' },
  cautionTx: { fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3.5) },
  gzRow: { flexDirection: 'row', gap: space(1) },
  gzBox: { width: 34, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  gzTx: { fontSize: 21, fontWeight: '800', lineHeight: 26 },
  titleCol: { flex: 1 },
  name: { ...font.heading, color: colors.ink, fontWeight: '900' },
  desc: { color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  reason: { ...font.body, color: colors.inkSoft, marginTop: space(3) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2.5) },
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space(2.5), paddingVertical: space(1), maxWidth: '100%' },
  chipGood: { backgroundColor: colors.juSoft, borderColor: colors.juLine },
  chipCare: { backgroundColor: colors.overlay, borderColor: colors.line },
  chipTx: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  chipTxGood: { color: colors.ju },
  more: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: space(2.5), textAlign: 'right' },
});
