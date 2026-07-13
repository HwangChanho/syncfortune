// app/src/components/ElementBalance.tsx — 오행 밸런스(목·화·토·금·수 분포) 세로 막대 시각화
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-13(4.3 자기분석 허브): 팔자 8글자(천간4+지지4)의 오행 분포를 막대로 — '나를 이루는 다섯 기운의 조성'.
//   가장 강한 기운·비어있는 기운을 짚어 '이 사람의 에너지 조성'을 분석적으로 보여줌(운세 아님·성향 분석 축). 온디바이스·결정론.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { stemElement, branchElement, elementColor } from '../lib/engine/ohaeng';
import type { SajuChart } from '@spec/chart';
import { colors, space, radius, font } from '../lib/theme';

const EL = ['木', '火', '土', '金', '水'] as const;
const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' };
// 오행별 성향 한 줄(표준 명리 물상 — 분석 톤)
const EL_TRAIT: Record<string, string> = {
  木: '성장·기획·추진', 火: '표현·열정·확산', 土: '안정·중재·신뢰', 金: '정밀·결단·원칙', 水: '지혜·유연·소통',
};

/** 팔자 오행 분포 막대 + '강한/빈 기운' 요약. saju = computeChart(...).saju */
export function ElementBalance({ saju }: { saju: SajuChart }) {
  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of ['년', '월', '일', '시'] as const) {
    const pd = saju.pillars[p];
    if (!pd) continue;
    const se = stemElement(pd.stem), be = branchElement(pd.branch);
    if (se in counts) counts[se]++;
    if (be in counts) counts[be]++;
  }
  const max = Math.max(...EL.map((e) => counts[e]), 1);
  const sorted = [...EL].sort((a, b) => counts[b] - counts[a]);
  const dominant = sorted[0];
  const lacking = counts[sorted[sorted.length - 1]] === 0 ? sorted[sorted.length - 1] : null;

  return (
    <View>
      <View style={styles.barsRow}>
        {EL.map((e) => (
          <View key={e} style={styles.barCol}>
            <Text style={styles.count}>{counts[e]}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { height: `${Math.max(6, (counts[e] / max) * 100)}%`, backgroundColor: elementColor[e] }]} />
            </View>
            <Text style={[styles.elGlyph, { color: elementColor[e] }]}>{e}</Text>
            <Text style={styles.elKo}>{EL_KO[e]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        가장 강한 기운 <Text style={[styles.noteStrong, { color: elementColor[dominant] }]}>{dominant}({EL_KO[dominant]})</Text> — {EL_TRAIT[dominant]}
        {lacking ? <Text style={styles.noteDim}>{'  ·  '}비어있는 기운 {lacking}({EL_KO[lacking]})</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 116, marginBottom: space(2) },
  barCol: { alignItems: 'center', flex: 1 },
  count: { ...font.caption, color: colors.inkSoft, fontWeight: '800', marginBottom: space(1) },
  track: { width: 22, height: 78, backgroundColor: colors.sunk, borderRadius: radius.sm, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: radius.sm },
  elGlyph: { fontSize: 15, fontWeight: '900', marginTop: space(1.5) },
  elKo: { ...font.caption, color: colors.inkFaint, fontSize: 10 },
  note: { ...font.caption, color: colors.inkSoft, textAlign: 'center', lineHeight: 18 },
  noteStrong: { fontWeight: '800' },
  noteDim: { color: colors.inkFaint },
});
