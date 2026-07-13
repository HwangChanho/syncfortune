// app/src/components/ImageTeaser.tsx — '비치는 나(남에게 보이는 인상)' 무료 온디바이스 티저(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널: 유료 '비치는 나' 딥리포트 '위'에 결정론 무료 '첫인상 결'을 먼저 보여줘 전환 유도.
//   신호 = 일간(日干) 오행(saju.dayMaster.element) — 본질이 밖으로 드러나는 기본 톤. 온디바이스·Edge 호출 0.
// ★★daniel 검수 슬롯: 아래 EL_IMAGE 매핑(일간 오행→첫인상 일상어)은 *후보 초안* — Boss 검수/수정.
//   §4 안전: 긍정·중립 프레이밍(전향적)·단정 금지.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { elementColor } from '../lib/engine/ohaeng';
import { colors, radius, space, font } from '../lib/theme';

// ★daniel 검수 후보 — 일간 오행 → 남에게 비치는 첫인상 결(일상어). 표준 물상 기반 초안.
const EL_IMAGE: Record<string, string> = {
  木: '부드럽게 뻗어가는·성장하는 인상',
  火: '밝고 표현이 살아있는 인상',
  土: '듬직하고 신뢰가 가는 인상',
  金: '단정하고 명료한 인상',
  水: '유연하고 깊이가 느껴지는 인상',
};
const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' };

/** '비치는 나' 무료 티저 — SpecialContentScreen freeHook. 일간 오행 → 첫인상 결(결정론). */
export function ImageTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  const el: string = (saju as any)?.dayMaster?.element;
  if (!saju?.pillars || !el) return null;
  const col = elementColor[el] ?? colors.ju;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>남에게 처음 비치는 나의 결</Text>
      <Text style={styles.leadSub}>일간(나의 본질)으로 먼저 무료로 짚어 봤어요.</Text>
      <View style={styles.card}>
        <Text style={styles.cardCap}>첫인상 톤</Text>
        <Text style={[styles.image, { color: col }]}>{EL_IMAGE[el]}</Text>
        <Text style={styles.base}>바탕 기운 {el}({EL_KO[el]})</Text>
      </View>
      <Text style={styles.funnel}>
        지금은 <Text style={styles.free}>첫인상 톤</Text> 미리보기예요 · 전체 풀이에선 <Text style={styles.paid}>상황별로 비치는 모습·강점으로 쓰는 법</Text>까지 짚어 드려요.
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
  image: { ...font.heading, marginTop: space(2), textAlign: 'center' },
  base: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  funnel: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginTop: space(3), textAlign: 'center' },
  free: { color: colors.ink, fontWeight: '700' },
  paid: { color: colors.ju, fontWeight: '700' },
});
