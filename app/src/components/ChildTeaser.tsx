// app/src/components/ChildTeaser.tsx — '자식운' 무료 온디바이스 티저(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ §4 민감 도메인(자녀). 안전가드 준수:
//   · 자녀 유무·수 단정 금지, 부정 증폭 금지, '먼저 들추지 말 것', 진단 동반이면 처방 동반.
//   · freeHook 은 saju 만 넘겨받아 **성별 미상** → 자녀성(식상=女/관=男) 판정 불가 = 여기서 판정하지 않는다.
//   → 이 티저는 *판정 신호 없이* '무엇을 풀어주는지'만 전향적으로 안내하는 안전 퍼널 + 자녀궁(시주) 존재 사실만.
// ★★daniel 검수 슬롯: 자녀 티저에 **결정론 신호를 넣을지/무엇을 넣을지**는 전적으로 Boss 스탠스(§4 최우선).
//   (후보: 성별 입력을 받아 자녀성 통근·시주 상태를 '전향적'으로만 — Boss 판단.) 현재는 안전 최소본.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';

/** '자식운' 무료 티저 — SpecialContentScreen freeHook. §4 민감: 판정 없이 전향적 안내 + 자녀궁 사실만. */
export function ChildTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  if (!saju?.pillars) return null;
  const hasHour = !!(saju as any)?.pillars?.hour && !(saju as any)?.timeUnknown; // 자녀궁=시주. 시 미상이면 안내.

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>자녀와의 인연을 보는 자리</Text>
      <Text style={styles.leadSub}>사주에선 <Text style={styles.em}>자녀궁(시주)</Text>과 자녀성으로 자녀와의 인연 결을 읽어요.</Text>
      <View style={styles.card}>
        {hasHour ? (
          <Text style={styles.body}>당신 사주엔 자녀궁(시주)이 자리해 있어요. 그 결을 <Text style={styles.em}>전향적으로</Text> — 인연의 흐름과 시기 중심으로 풀어 드려요.</Text>
        ) : (
          <Text style={styles.body}>자녀궁은 태어난 <Text style={styles.em}>시(時)</Text>로 봐요. 정확한 시를 넣으면 더 또렷하게 풀 수 있어요.</Text>
        )}
      </View>
      <Text style={styles.funnel}>
        전체 풀이에선 <Text style={styles.paid}>자녀와의 인연 결·좋은 시기·관계를 잇는 법</Text>을 따뜻하게 짚어 드려요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  lead: { ...font.heading, color: colors.ink, textAlign: 'center' },
  leadSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(3) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4) },
  body: { ...font.body, color: colors.ink, textAlign: 'center', lineHeight: 23 },
  em: { color: colors.ju, fontWeight: '700' },
  funnel: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginTop: space(3), textAlign: 'center' },
  paid: { color: colors.ju, fontWeight: '700' },
});
