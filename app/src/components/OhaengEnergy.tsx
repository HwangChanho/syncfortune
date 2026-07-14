// app/src/components/OhaengEnergy.tsx — 오행 에너지 구슬 인포그래픽(결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 기획서 ①-피드백(2026-07-14): "사주를 모르는 대중을 위해 팔자 8글자를 *한자 중심이 아닌 오행별 색상 에너지*
//   (구슬/그래프)로 먼저 시각화 → 이탈률↓". 예: 화가 많은 사주 = 붉은 에너지 가득.
// ▶ 구성(전부 결정론·8글자 오행 count 기반):
//   ① 발광 구슬 8개 — 오행별로 묶어 색 에너지로(한자 팔자 글자 노출 안 함, 오행 글리프만). '이 사람 = 무슨 색이 많다' 즉시 인지.
//   ② 오행 비율 스택 바 — 다섯 기운 조성 한눈에.
//   ③ 지배 에너지 오브 + 한 줄 성향 + (부족 기운은 '채우면 좋은') — §4 전향적(부족=결핍 아님, 보완축).
// ElementBalance(분석용 막대)와 상호보완 — 이건 '친근한 첫인상' 버전.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, Platform } from 'react-native';
import { stemElement, branchElement, elementColor } from '../lib/engine/ohaeng';
import type { SajuChart } from '@spec/chart';
import { colors, space, radius, font } from '../lib/theme';

const EL = ['木', '火', '土', '金', '水'] as const;
const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' };
const EL_TRAIT: Record<string, string> = {
  木: '성장·기획·추진', 火: '표현·열정·확산', 土: '안정·중재·신뢰', 金: '정밀·결단·원칙', 水: '지혜·유연·소통',
};

/** 오행 에너지 구슬 인포그래픽. saju = computeChart(...).saju. 만세력/명식·자기분석 상단용. */
export function OhaengEnergy({ saju }: { saju: SajuChart }) {
  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of ['년', '월', '일', '시'] as const) {
    const pd = saju?.pillars?.[p];
    if (!pd) continue;
    if (stemElement(pd.stem) in counts) counts[stemElement(pd.stem)]++;
    if (branchElement(pd.branch) in counts) counts[branchElement(pd.branch)]++;
  }
  const total = EL.reduce((s, e) => s + counts[e], 0) || 1;
  const sorted = [...EL].sort((a, b) => counts[b] - counts[a]);
  const dominant = sorted[0];
  const lacking = counts[sorted[sorted.length - 1]] === 0 ? sorted[sorted.length - 1] : null;

  if (!saju?.pillars) return null;

  // 구슬 = 오행별 count 만큼(색 에너지). 오행 순서로 묶어 같은 색이 뭉쳐 보이게.
  const beads: string[] = EL.flatMap((e) => Array(counts[e]).fill(e));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>나를 이루는 다섯 기운</Text>

      {/* ① 발광 구슬 8개(오행 색 에너지) */}
      <View style={styles.beads}>
        {beads.map((e, i) => (
          <View key={i} style={[styles.bead, glow(e), { backgroundColor: elementColor[e] }]}>
            <Text style={[styles.beadGlyph, { color: onColor(e) }]}>{e}</Text>
          </View>
        ))}
      </View>

      {/* ② 오행 비율 스택 바 */}
      <View style={styles.stack}>
        {EL.filter((e) => counts[e] > 0).map((e) => (
          <View key={e} style={{ flex: counts[e], backgroundColor: elementColor[e], height: '100%' }} />
        ))}
      </View>
      <View style={styles.legendRow}>
        {EL.map((e) => (
          <View key={e} style={styles.legend}>
            <View style={[styles.dot, { backgroundColor: elementColor[e] }]} />
            <Text style={styles.legendTx}>{e} {counts[e]}</Text>
          </View>
        ))}
      </View>

      {/* ③ 지배 에너지 오브 + 성향(전향적) */}
      <View style={styles.summary}>
        <View style={[styles.orb, glow(dominant), { backgroundColor: elementColor[dominant] }]}>
          <Text style={[styles.orbGlyph, { color: onColor(dominant) }]}>{dominant}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sumHead}>
            지금 가장 강한 에너지는 <Text style={[styles.sumEl, { color: elementColor[dominant] }]}>{dominant}({EL_KO[dominant]})</Text>
          </Text>
          <Text style={styles.sumTrait}>{EL_TRAIT[dominant]}</Text>
          {lacking ? <Text style={styles.sumLack}>채우면 좋은 기운 · {lacking}({EL_KO[lacking]})</Text> : null}
        </View>
      </View>
    </View>
  );
}

// 오행 색 위 글자색(가독) — 밝은 토·금엔 어두운 글자.
function onColor(e: string): string {
  return e === '土' || e === '金' ? '#15132E' : '#FFFFFF';
}
// 발광(글로우) — 오행 색 그림자. Android elevation 보조.
function glow(e: string) {
  return Platform.select({
    ios: { shadowColor: elementColor[e], shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: 4 },
    default: {},
  });
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(2) },
  title: { ...font.heading, color: colors.ink, textAlign: 'center', marginBottom: space(3) },
  beads: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(2), marginBottom: space(4) },
  bead: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  beadGlyph: { fontSize: 15, fontWeight: '900' },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.sunk },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: space(2), marginBottom: space(3) },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendTx: { ...font.caption, color: colors.inkSoft, fontSize: 11 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(3) },
  orb: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  orbGlyph: { fontSize: 24, fontWeight: '900' },
  sumHead: { ...font.body, color: colors.ink },
  sumEl: { fontWeight: '900' },
  sumTrait: { ...font.caption, color: colors.inkSoft, marginTop: space(0.5) },
  sumLack: { ...font.caption, color: colors.inkFaint, marginTop: space(1) },
});
