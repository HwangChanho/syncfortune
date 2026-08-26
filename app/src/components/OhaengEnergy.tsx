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
import { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { PressableScale } from './PressableScale';
import { stemElement, branchElement, elementColor } from '../lib/engine/ohaeng';
import type { SajuChart } from '@spec/chart';
import { useFontScale } from '../lib/ui/fontScale';   // ★원 크기를 글자 배율에서 파생(daniel 07-28)
import { colors, space, radius, font } from '../lib/theme';
import { EL_KO } from '../lib/content/ohaengLabel';   // ★오행 이름표 단일 소스(사본 만들지 말 것)

const EL = ['木', '火', '土', '金', '水'] as const;
const EL_TRAIT: Record<string, string> = {
  木: '성장·기획·추진', 火: '표현·열정·확산', 土: '안정·중재·신뢰', 金: '정밀·결단·원칙', 水: '지혜·유연·소통',
};

/** 오행 에너지 구슬 인포그래픽. saju = computeChart(...).saju. 만세력/명식·자기분석 상단용. */
/**
 * 오행 에너지 카드.
 *
 * ★★2026-08-26 Boss *"만세력에서 대운세운 같이해서 오행분포 볼때 대운이랑 세운을 선택가능해야해"*
 *   종전엔 **원국 여덟 글자만** 셌다. 그런데 «지금 어떤가» 를 보려면 대운·세운이 같이 들어가야 한다.
 *   ⇒ 두 칸을 **켜고 끌 수 있게** 한다. 기본은 **끔** — 원국 분포는 그 사람의 바탕이라
 *     그게 기본값이어야 하고, 켜는 순간 «지금의 분포» 로 바뀐다는 걸 눈으로 알 수 있다.
 *   ⚠️합쳐서 하나로 보여 주지 않는다. **무엇이 켜져 있는지**가 늘 보여야 숫자를 오해하지 않는다.
 */
export function OhaengEnergy({ saju }: { saju: SajuChart }) {
  // ★어느 층을 셀지 — 기본은 원국만(종전 동작 그대로)
  const [withDaeun, setWithDaeun] = useState(false);
  const [withSewoon, setWithSewoon] = useState(false);
  // ★원(orb)·글자를 같은 배율에서 만든다(daniel 2026-07-28 IMG_8266 "글씨 크기에 따라 동그라미 사이즈도 안맞아").
  //   종전엔 원 38/48px·글자 17/22px 이 **전부 고정**이라 앱 글자 배율을 바꿔도 이 카드만 따라오지 않았다.
  //   원 지름 = 글자 크기 × 2.2 로 묶어 두면 어떤 배율에서도 비율이 유지된다.
  const { fs } = useFontScale();
  const orbGlyph = fs(17), orbGlyphTop = fs(22);
  const orb = Math.round(orbGlyph * 2.2), orbTop = Math.round(orbGlyphTop * 2.2);
  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const add = (stem?: string, branch?: string) => {
    if (stem && stemElement(stem as never) in counts) counts[stemElement(stem as never)]++;
    if (branch && branchElement(branch as never) in counts) counts[branchElement(branch as never)]++;
  };
  for (const p of ['년', '월', '일', '시'] as const) {
    const pd = saju?.pillars?.[p];
    if (!pd) continue;
    add(pd.stem, pd.branch);
  }
  // ★켜져 있을 때만 더한다. 대운·세운도 **천간+지지 두 글자**라 원국 글자와 같은 무게로 센다
  //   (여기서 가중치를 다르게 주면 그건 관법 판정이라 내가 정할 것이 아니다 — 세는 방식은 그대로).
  const lc: any = saju?.currentLuck;
  const an: any = saju?.annual;
  if (withDaeun && lc?.stem) add(lc.stem, lc.branch);
  if (withSewoon && an?.stem) add(an.stem, an.branch);
  const sorted = [...EL].sort((a, b) => counts[b] - counts[a]);
  const lacking = counts[sorted[sorted.length - 1]] === 0 ? sorted[sorted.length - 1] : null;

  if (!saju?.pillars) return null;

  // 구슬 = 오행별 count 만큼(색 에너지). 오행 순서로 묶어 같은 색이 뭉쳐 보이게.
  const beads: string[] = EL.flatMap((e) => Array(counts[e]).fill(e));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>나를 이루는 다섯 기운</Text>

      {/* ★대운·세운 켜기 (Boss 2026-08-26) — **무엇이 켜져 있는지가 늘 보인다.**
          합쳐서 하나로만 보여 주면 «이 숫자가 원국인지 지금인지» 를 알 수 없다. */}
      <View style={styles.layerRow}>
        {([['대운', withDaeun, setWithDaeun, lc], ['세운', withSewoon, setWithSewoon, an]] as const).map(
          ([lab, on, set, src]) => (
            <PressableScale
              key={lab}
              // ⚠️값이 없으면 **안 눌린다** — 켰는데 아무 변화가 없으면 고장으로 보인다
              disabled={!src?.stem}
              style={[styles.layerChip, on && styles.layerChipOn, !src?.stem && styles.layerChipOff]}
              onPress={() => set(!on)}
            >
              <Text style={[styles.layerTx, on && styles.layerTxOn]}>
                {on ? '✓ ' : '+ '}{lab}{src?.stem ? ` ${src.stem}${src.branch}` : ' (없음)'}
              </Text>
            </PressableScale>
          ))}
      </View>

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

      {/* ③ 대표기운 순위 1~5(daniel 2026-07-24 '2~5순위까지 다 나오게') — 세력 순으로 다섯 기운 전부 + 성향. 1위 강조. */}
      <View style={styles.rankCard}>
        {sorted.map((e, i) => (
          <View key={e} style={[styles.rankRow, i > 0 && styles.rankRowBorder]}>
            <Text style={[styles.rankNum, i === 0 && styles.rankNumTop]}>{i + 1}</Text>
            <View style={[styles.rankOrb, glow(e), { backgroundColor: elementColor[e] },
              i === 0 ? { width: orbTop, height: orbTop, borderRadius: orbTop / 2 } : { width: orb, height: orb, borderRadius: orb / 2 }]}>
              <Text style={[styles.rankOrbGlyph, { color: onColor(e), fontSize: i === 0 ? orbGlyphTop : orbGlyph }]} numberOfLines={1}>{e}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rankEl, { fontSize: fs(15) }, i === 0 && styles.rankElTop, i === 0 && { fontSize: fs(17) }]}>
                {e}({EL_KO[e]}){i === 0 ? <Text style={styles.rankBadge}>  · 가장 강함</Text> : null}
              </Text>
              <Text style={[styles.rankTrait, { fontSize: fs(12) }]}>{EL_TRAIT[e]}</Text>
            </View>
            <Text style={[styles.rankCnt, { color: elementColor[e] }]}>{counts[e]}</Text>
          </View>
        ))}
        {lacking ? <Text style={styles.sumLack}>채우면 좋은 기운 · {lacking}({EL_KO[lacking]})</Text> : null}
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
  // 층 토글(대운·세운) — ★상태를 **글자로도** 준다(✓ / +). 색만 쓰면 색약인 사람에게 안 보인다.
  layerRow: { flexDirection: 'row', gap: space(2), marginBottom: space(3), flexWrap: 'wrap' },
  layerChip: {
    paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: 999,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
  },
  layerChipOn: { borderColor: colors.juLine, backgroundColor: colors.sunk },
  layerChipOff: { opacity: 0.45 },
  layerTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  layerTxOn: { color: colors.ju, fontWeight: '800' },
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
  // 대표기운 1~5 랭킹 리스트(daniel 07-24) — 1위는 오브·글자 키워 강조.
  rankCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(4), paddingVertical: space(1) },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5) },
  rankRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rankNum: { width: 18, textAlign: 'center', color: colors.inkFaint, fontWeight: '800', fontSize: 14 },
  rankNumTop: { color: colors.ju, fontSize: 16 },
  rankOrb: { alignItems: 'center', justifyContent: 'center' },   // 크기 = 인라인(글자 배율 파생)
  rankOrbGlyph: { fontWeight: '900' },   // fontSize = 인라인
  rankEl: { ...font.body, color: colors.ink, fontWeight: '700', fontSize: 15 },
  rankElTop: { fontWeight: '900', fontSize: 17 },
  rankBadge: { color: colors.ju, fontWeight: '800', fontSize: 12 },
  rankTrait: { ...font.caption, color: colors.inkSoft, marginTop: 2, fontSize: 12 },
  rankCnt: { fontWeight: '900', fontSize: 19, minWidth: 22, textAlign: 'right' },
  sumLack: { ...font.caption, color: colors.inkFaint, textAlign: 'center', paddingVertical: space(2.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
