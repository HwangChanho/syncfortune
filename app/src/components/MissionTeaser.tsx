// app/src/components/MissionTeaser.tsx — '나의 사명' 무료 온디바이스 티저(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널: 유료 '나의 사명' 딥리포트 '위'에 결정론 무료 '나아갈 방향 결'을 먼저 보여줘 전환 유도.
//   신호 = 용신(用神) 오행 = '내게 필요한 기운' = 나아갈 방향. 온디바이스 computeYongsinApprox(daniel 검수 억부근사).
// ★★daniel 검수 슬롯: 아래 YONG_MISSION 매핑(용신 오행→사명 방향 일상어)은 *후보 초안* — Boss 검수/수정.
//   §4 안전: 전향적('방향'이지 우열 아님)·단정 금지.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { elementColor } from '../lib/engine/ohaeng';
import { computeYongsinApprox } from '../lib/content/yongsinApprox';
import { colors, radius, space, font } from '../lib/theme';

// ★daniel 검수 후보 — 용신 오행 → 사명(나아갈 방향) 일상어. daniel stance(용신=필요기운) 기반 초안.
const YONG_MISSION: Record<string, string> = {
  木: '새로 시작하고 키우는 방향',
  火: '드러내고 이끄는 방향',
  土: '품고 이어주는 방향',
  金: '다듬고 완성하는 방향',
  水: '배우고 통찰하는 방향',
};
const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' };

/** '나의 사명' 무료 티저 — SpecialContentScreen freeHook. 용신 오행 → 나아갈 방향(결정론). */
export function MissionTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  const yong = useMemo(() => {
    try { return computeYongsinApprox(saju, { timeUnknown: !!(saju as any)?.timeUnknown }).yongsin; }
    catch { return null; } // 용신 산출 불가(방어) → 티저 생략
  }, [saju]);

  if (!saju?.pillars || !yong) return null;
  const col = elementColor[yong] ?? colors.ju;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>내게 필요한 기운이 가리키는 방향</Text>
      <Text style={styles.leadSub}>용신(내게 필요한 기운)으로 먼저 무료로 짚어 봤어요.</Text>
      <View style={styles.card}>
        <Text style={styles.cardCap}>나아갈 방향</Text>
        <Text style={[styles.dir, { color: col }]}>{YONG_MISSION[yong]}</Text>
        <Text style={styles.base}>필요한 기운 {yong}({EL_KO[yong]})</Text>
      </View>
      <Text style={styles.funnel}>
        지금은 <Text style={styles.free}>나아갈 방향</Text> 미리보기예요 · 전체 풀이에선 <Text style={styles.paid}>타고난 사명·그 방향을 여는 법·때</Text>까지 짚어 드려요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  lead: { ...font.heading, color: colors.ink, textAlign: 'center' },
  leadSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(3) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), alignItems: 'center' },
  cardCap: { ...font.caption, color: colors.inkSoft },
  dir: { ...font.heading, marginTop: space(2), textAlign: 'center' },
  base: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  funnel: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginTop: space(3), textAlign: 'center' },
  free: { color: colors.ink, fontWeight: '700' },
  paid: { color: colors.ju, fontWeight: '700' },
});
