// app/src/components/reading/NatalTable.tsx — 풀이 본문의 「1. 나의 사주팔자」
// ═══════════════════════════════════════════════════════════════════════════
// ■ ★★틀은 **기존 만세력 그대로**다 (Boss 2026-08-18 "만세력 틀은 기존대로 가야해 디자인만 시안대로")
//   `MyeongsikScreen.renderPillars` 와 **같은 세로 순서**를 지킨다:
//     기둥명 → 천간 십신 → 천간(한자 + 독음·음양) → 지지(한자 + 독음·음양) → 지지 십신
//   처음엔 시안 그림만 보고 라벨→한자→십신 순의 **다른 표**를 만들었는데, 그러면 만세력과 풀이가
//   같은 명식을 서로 다른 배열로 보여 준다 — 사용자는 둘을 대조하며 읽는다.
//   ⇒ 시안에서 가져오는 것은 **디자인**(카드 테두리·일주 강조면·오행 범례)이지 배열이 아니다.
//
// ■ 만세력과 다른 점은 딱 하나 — 여기서는 **읽기 전용**이다
//   글자 탭 → 용어 설명, 합충 호, 한자↔한글 토글, 신살 표는 만세력 화면의 몫이다.
//   풀이 본문은 '지금 내 명식이 이렇다'를 보여 주는 자리라, 조작 요소를 얹으면 글 읽기를 끊는다.
//   더 보고 싶으면 만세력으로 간다(그 길은 이미 여러 곳에 있다).
//
// ⚠️시각을 모르는 명식은 시주가 **실제 시주가 아니다**(`timeUnknown`). 흐리게 + '시간 미상'을 적는다 —
//   아무 표시 없이 보여 주면 사용자는 그것도 자기 것으로 읽는다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { PILLAR_DISPLAY_ORDER } from '../../lib/ui/pillarOrder';
import {
  stemElement, branchElement, elementColor,
  stemReading, branchReading, stemYinYang, branchYinYang,
} from '../../lib/engine/ohaeng';
import { EL_KO_SHORT } from '../../lib/content/ohaengLabel';
import { colors, radius, space, font } from '../../lib/theme';

/** 범례에 쓰는 오행 순서(상생) */
const EL = ['木', '火', '土', '金', '水'] as const;

/**
 * 명식표(읽기 전용).
 * @param saju 계산된 사주 원국
 */
export function NatalTable({ saju }: { saju: SajuChart }) {
  const unknownTime = !!(saju as any).timeUnknown;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {PILLAR_DISPLAY_ORDER.map((pos) => {
          const p = saju.pillars[pos];
          if (!p) return null;
          const isDay = pos === '일';
          const dim = unknownTime && pos === '시';
          const elStem = stemElement(p.stem);
          const elBranch = branchElement(p.branch);
          return (
            <View key={pos} style={[styles.col, isDay && styles.colDay, dim && styles.colDim]}>
              {/* ── 기존 만세력과 같은 세로 순서 ── */}
              <Text style={[styles.pos, isDay && styles.posDay]} numberOfLines={1}>
                {pos}주{isDay ? ' (본원)' : ''}
              </Text>

              <Text style={styles.tenGod} numberOfLines={1}>{p.stemTenGod}</Text>
              <Text style={[styles.glyph, { color: elementColor[elStem] }]}>{p.stem}</Text>
              <Text style={styles.reading} numberOfLines={1}>{stemReading(p.stem)} · {stemYinYang(p.stem)}</Text>

              <Text style={[styles.glyph, { color: elementColor[elBranch] }]}>{p.branch}</Text>
              <Text style={styles.reading} numberOfLines={1}>{branchReading(p.branch)} · {branchYinYang(p.branch)}</Text>
              <Text style={styles.tenGod} numberOfLines={1}>{p.branchMainTenGod}</Text>

              {dim ? <Text style={styles.dimNote}>시간 미상</Text> : null}
            </View>
          );
        })}
      </View>

      {/* 오행 범례 — 위 한자들이 왜 그 색인지 알려 준다(시안 p10) */}
      <View style={styles.legend}>
        {EL.map((e) => (
          <View key={e} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: elementColor[e] }]} />
            <Text style={styles.legendTx}>{EL_KO_SHORT[e]}({e})</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.juLine, overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  col: { flex: 1, alignItems: 'center', paddingVertical: space(3), paddingHorizontal: space(1), gap: 2 },
  // 일주 = 본원(나 자신). 시안은 이 칸만 면으로 세운다
  colDay: { backgroundColor: colors.juSoft, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.juLine },
  colDim: { opacity: 0.45 },
  pos: { ...font.caption, color: colors.inkFaint, marginBottom: space(1) },
  posDay: { color: colors.ju, fontWeight: '800' },
  tenGod: { ...font.caption, color: colors.inkSoft, fontSize: 11 },
  glyph: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  reading: { ...font.caption, color: colors.inkFaint, fontSize: 10.5, marginBottom: space(1) },
  dimNote: { ...font.caption, color: colors.inkFaint, marginTop: space(1) },

  legend: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: space(2), backgroundColor: colors.sunk,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  legendDot: { width: 8, height: 3, borderRadius: 2 },
  legendTx: { ...font.caption, color: colors.inkSoft, fontSize: 11 },
});
