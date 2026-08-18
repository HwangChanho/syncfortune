// app/src/components/reading/ElementDonut.tsx — 「2. 나를 이루는 다섯 기운」 (시안 p10)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 시안 실측
//   · 좌: 도넛(두꺼운 링) — 가운데는 비어 있고 대표 오행 글리프가 들어간다
//   · 우: 5줄 — 「수(水)」 라벨 + 알약형 막대(회색 트랙 위 색 채움) + 퍼센트
//   · 정렬 = **큰 것부터**. 그래야 "나는 무엇이 많은 사람인가"가 첫 줄에서 읽힌다
//
// ■ 기존 `ElementBalance`(세로 막대)와 무엇이 다른가
//   그건 *분석 화면*의 도구고, 이건 *읽는 지면*의 첫 인상이다. 계산은 같은 규칙(8글자 오행 count)이라
//   숫자가 갈릴 일이 없다 — 세는 방식을 여기서 새로 만들지 않고 같은 규칙을 그대로 쓴다.
//
// ⚠️퍼센트는 **반올림 오차로 합이 100이 안 될 수 있다**. 합계를 억지로 맞추려고 한 줄을 조정하면
//   그 줄만 실제와 어긋난다 — 각 줄은 자기 값을 그대로 두고, 합계를 화면에 쓰지 않는다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { SajuChart } from '@spec/chart';
import { stemElement, branchElement, elementColor } from '../../lib/engine/ohaeng';
import { EL_KO_SHORT } from '../../lib/content/ohaengLabel';
import { colors, radius, space, font } from '../../lib/theme';

const EL = ['木', '火', '土', '金', '水'] as const;
const SIZE = 132;          // 도넛 바깥 지름
const STROKE = 26;         // 링 두께

/**
 * 8글자에서 오행 개수를 센다.
 * ★`ElementBalance` 와 **같은 규칙**(천간·지지 각 1). 두 화면의 숫자가 갈리지 않게 한다.
 */
function countElements(saju: SajuChart): Record<string, number> {
  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pos of ['년', '월', '일', '시'] as const) {
    const p = saju.pillars[pos];
    if (!p) continue;
    const se = stemElement(p.stem), be = branchElement(p.branch);
    if (se in counts) counts[se]++;
    if (be in counts) counts[be]++;
  }
  return counts;
}

/**
 * 오행 분포.
 * @param saju 계산된 사주 원국
 */
export function ElementDonut({ saju }: { saju: SajuChart }) {
  const counts = countElements(saju);
  const total = EL.reduce((s, e) => s + counts[e], 0) || 1;
  const sorted = [...EL].sort((a, b) => counts[b] - counts[a]);
  const dominant = sorted[0];

  // 도넛 — 하나의 원에 dasharray 로 조각을 이어 붙인다(조각마다 Path 를 만들지 않아 가볍다)
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.donutBox}>
        <Svg width={SIZE} height={SIZE}>
          {/* 트랙 — 0인 오행이 있어도 링이 끊겨 보이지 않게 */}
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={colors.sunk} strokeWidth={STROKE} fill="none" />
          {EL.map((e) => {
            const frac = counts[e] / total;
            if (frac <= 0) return null;
            const len = circ * frac;
            const el = (
              <Circle
                key={e}
                cx={SIZE / 2} cy={SIZE / 2} r={r}
                stroke={elementColor[e]} strokeWidth={STROKE} fill="none"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                // 12시 방향에서 시작하도록 회전
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            );
            offset += len;
            return el;
          })}
        </Svg>
        {/* 가운데 — 가장 많은 기운 */}
        <View style={styles.donutCenter} pointerEvents="none">
          <Text style={[styles.domGlyph, { color: elementColor[dominant] }]}>{dominant}</Text>
        </View>
      </View>

      <View style={styles.bars}>
        {sorted.map((e) => {
          const pct = Math.round((counts[e] / total) * 100);
          return (
            <View key={e} style={styles.barRow}>
              <Text style={styles.barLabel}>{EL_KO_SHORT[e]}({e})</Text>
              <View style={styles.track}>
                {/* 0% 도 아주 짧게 그린다 — 칸이 비면 '데이터가 없다'로 읽힌다 */}
                <View style={[styles.fill, { width: `${Math.max(3, pct)}%`, backgroundColor: elementColor[e] }]} />
              </View>
              <Text style={styles.pct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  donutBox: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  domGlyph: { fontSize: 30, lineHeight: 38, fontWeight: '900' },

  bars: { flex: 1, gap: space(2) },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  barLabel: { ...font.caption, color: colors.ink, width: 54, fontWeight: '700' },
  track: { flex: 1, height: 16, borderRadius: radius.pill, backgroundColor: colors.sunk, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  // ⚠️width 36 에서는 '25 %' 로 줄이 갈렸다(글자 확대 배율까지 곱해지면 더 좁아진다) → 넉넉히
  pct: { ...font.caption, color: colors.inkSoft, width: 52, textAlign: 'right', fontWeight: '800' },
});
