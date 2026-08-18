// app/src/components/reading/NatalTable.tsx — 「1. 나의 사주팔자」 명식표 (시안 p10)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 시안 실측
//   · 4열 — **시주 / 일주(본원) / 월주 / 년주**. 오른쪽으로 갈수록 과거다(년주가 맨 오른쪽).
//     ★이 순서는 이미 앱 전체에 맞춰 둔 것과 같다(`pillarOrder.ts` — daniel 2026-08-15 지시).
//   · 칸마다 : 작은 라벨 → 한자(오행색·큼) → 십신(아주 작게). 위=천간 / 아래=지지
//   · **일주 칸만** 테두리 + 옅은 배경으로 강조(= 본원, 나 자신)
//   · 표 아래 오행 범례 5개
//
// ■ 십신은 엔진 값을 그대로 쓴다
//   `stemTenGod` · `branchMainTenGod` 이 이미 계산돼 있다. 화면에서 다시 계산하지 않는다
//   (같은 값을 두 번 구하면 언젠가 갈린다 — 이 프로젝트에서 반복해 겪은 것).
//
// ⚠️시각을 모르는 명식은 시주가 **실제 시주가 아니다**(`timeUnknown`). 그 칸은 흐리게 하고
//   '시간 미상'을 적는다 — 아무 표시 없이 보여 주면 사용자는 그것도 자기 것으로 읽는다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { PILLAR_DISPLAY_ORDER } from '../../lib/ui/pillarOrder';
import { stemElement, branchElement, elementColor } from '../../lib/engine/ohaeng';
import { EL_KO_SHORT } from '../../lib/content/ohaengLabel';
import { colors, radius, space, font } from '../../lib/theme';

/** 범례에 쓰는 오행 순서(상생) */
const EL = ['木', '火', '土', '金', '水'] as const;

/** 기둥 라벨 — 일주만 '(본원)' 을 달아 나 자신임을 알린다. */
const POS_LABEL: Record<string, string> = { 시: '시주', 일: '일주 (본원)', 월: '월주', 년: '년주' };

/**
 * 명식표.
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
          // 시간 미상이면 시주는 실제 값이 아니다 — 흐리게 해서 '이건 확실하지 않다'를 형태로 알린다
          const dim = unknownTime && pos === '시';
          return (
            <View key={pos} style={[styles.col, isDay && styles.colDay, dim && styles.colDim]}>
              <Text style={styles.posLabel} numberOfLines={1}>{POS_LABEL[pos] ?? pos}</Text>

              <View style={styles.cell}>
                <Text style={[styles.glyph, { color: elementColor[stemElement(p.stem)] }]}>{p.stem}</Text>
                <Text style={styles.tenGod} numberOfLines={1}>{isDay ? '본원' : p.stemTenGod}</Text>
              </View>

              <View style={[styles.cell, styles.cellLower]}>
                <Text style={[styles.glyph, { color: elementColor[branchElement(p.branch)] }]}>{p.branch}</Text>
                <Text style={styles.tenGod} numberOfLines={1}>{p.branchMainTenGod}</Text>
              </View>

              {dim ? <Text style={styles.dimNote}>시간 미상</Text> : null}
            </View>
          );
        })}
      </View>

      {/* 오행 범례 — 위 한자들이 왜 그 색인지 알려 준다 */}
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
  col: { flex: 1, alignItems: 'center', paddingVertical: space(2.5), paddingHorizontal: space(1) },
  // 일주 = 본원. 시안은 이 칸만 테두리로 세운다
  colDay: { backgroundColor: colors.juSoft, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.juLine },
  colDim: { opacity: 0.45 },
  posLabel: { ...font.caption, color: colors.inkFaint, marginBottom: space(1.5) },
  cell: { alignItems: 'center', paddingVertical: space(1.5) },
  cellLower: { borderTopWidth: 1, borderTopColor: colors.line, width: '100%' },
  glyph: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  tenGod: { ...font.caption, color: colors.inkFaint, marginTop: 1 },
  dimNote: { ...font.caption, color: colors.inkFaint, marginTop: space(1) },

  legend: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: space(2), backgroundColor: colors.sunk,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  legendDot: { width: 8, height: 3, borderRadius: 2 },
  legendTx: { ...font.caption, color: colors.inkSoft, fontSize: 11 },
});
