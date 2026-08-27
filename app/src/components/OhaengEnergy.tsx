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
  // ★어느 층을 셀지 — **원국만**(Boss 2026-08-27 «원국 운세에서는 대운 세운 추가할 필요 없어»).
  //   ⚠️상태를 지우지 않고 `false` 로 고정해 둔다 — 아래 세는 식이 그대로 남아,
  //     시점 고르기(#59)가 붙을 때 배선만 이어 주면 된다(세는 방식은 관법이라 안 건드린다).
  const withDaeun = false, withSewoon = false;
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

      {/* ⚠️★대운·세운 **켜기 칩을 뺐다**(Boss 2026-08-27
            *"원국 운세에서는 대운 세운 추가할필요 없어 저건 뺴"*).
          이 자리는 «타고난 것» 을 보여 주는 곳이다. 지금 운을 섞으면 두 가지가 한 그림에 겹쳐
          «이 숫자가 원국인지 지금인지» 가 흐려진다 — 그건 만세력 쪽에서 시점을 골라 보면 된다(#59).
          ★세는 코드는 남겨 뒀다(`withDaeun`·`withSewoon`) — 시점 고르기가 붙을 자리다. */}
      {/* ① 발광 구슬 8개(오행 색 에너지) */}
      <View style={styles.beads}>
        {beads.map((e, i) => (
          <View key={i} style={[styles.bead, glow(e), { backgroundColor: elementColor[e] }]}>
            <Text style={[styles.beadGlyph, { color: onColor(e) }]}>{e}</Text>
          </View>
        ))}
      </View>

      {/* ② 오행 비율 스택 바 — ★★칸 **안에** 글자와 개수를 넣는다(Boss 2026-08-27
            *"색상 바 앞에 해당 색에 맞는 오행이랑 갯수숫자가 나오게하고 없는건 제일 오른쪽에 두고"*).
          종전엔 바 아래 별도 줄이라 **어느 색이 무엇인지** 눈이 두 번 오갔다.
          ⚠️★★2026-08-27 — 종전엔 `counts >= 2` 일 때만 글자를 그렸다. 그런데 «없는 기운» 줄은
            **0개인 것만** 보여 준다 ⇒ **1개짜리는 어디에도 안 나왔다**
            (Boss 화면: 木·土·水 가 각 1개인데 바에 아무 글자도 없었다 — *"오행 하나만 있는건 안나와"*).
          ⇒ 1개도 **글자는 그린다.** 다만 칸이 좁으니 **숫자를 뺀다**(「木」 · 「火 2」).
            한자 한 글자는 1/8 칸(≈12%)에도 들어간다 — 잘리는 건 «글자+숫자» 였다. */}
      <View style={styles.stack}>
        {EL.filter((e) => counts[e] > 0).map((e) => (
          <View key={e} style={[styles.seg, { flex: counts[e], backgroundColor: elementColor[e] }]}>
            <Text style={[styles.segTx, { color: onColor(e) }]} numberOfLines={1}>
              {counts[e] >= 2 ? `${e} ${counts[e]}` : e}
            </Text>
          </View>
        ))}
      </View>
      {/* ★**없는 기운만** 따로 오른쪽에(Boss 지정). 있는 것은 이미 바 안에 적혀 있으므로 다시 안 적는다 —
          두 번 적으면 «어느 쪽이 맞나» 를 눈이 확인하게 된다. */}
      {EL.some((e) => counts[e] === 0) ? (
        <View style={styles.zeroRow}>
          {EL.filter((e) => counts[e] === 0).map((e) => (
            <View key={e} style={styles.legend}>
              {/* ★★2026-08-27 (2차) — **바(bar)와 같은 색 쓰임**으로 맞춘다.
                  Boss *"여기 아직도 없는오행에 맞는 색상이 아니잖아"* — 화면을 실측하니 테두리 색은
                  **맞았다**(#3E4D76 ≈ elementColor[水]). 틀린 건 색이 아니라 **잉크의 양**이었다:
                  11px 링에 1.5px 테두리라 옆의 큼직한 색 블록과 나란히 두면 «색» 으로 읽히지 않는다.
                  ⚠️처음엔 `opacity: 0.35`(흐리게) → 그다음 «빈 링» 으로 갔는데, 둘 다 **색을 지우는**
                    방향이라 같은 지적을 두 번 받았다.
                  ⇒ 방향을 뒤집는다 — 바의 칸과 **똑같이** 칠하고 글자도 `onColor` 로 얹는다.
                    金(`#D2CCBA`)이 크림 배경에 묻히던 문제도 이걸로 같이 풀린다(바가 이미 푼 방식).
                  ★«없다» 는 **숫자 0 과 자리**(바 밖 오른쪽)가 말한다 — Boss 지정 배치가 그것이다. */}
              <View style={[styles.zeroChip, { backgroundColor: elementColor[e] }]}>
                <Text style={[styles.zeroChipTx, { color: onColor(e) }]}>{e} 0</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

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
  wrap: { marginBottom: space(2) },
  title: { ...font.heading, color: colors.ink, textAlign: 'center', marginBottom: space(3) },
  beads: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(2), marginBottom: space(4) },
  bead: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  beadGlyph: { fontSize: 15, fontWeight: '900' },
  stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.sunk },
  // 바 한 칸 — 글자를 가운데. `overflow:hidden` 이 있어야 좁은 칸에서 글자가 밖으로 안 삐져나온다
  seg: { height: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  segTx: { fontSize: 11, fontWeight: '800' },
  // 없는 기운 — **오른쪽 끝**에 모은다
  zeroRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: space(2), marginBottom: space(3) },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  // ★없는 기운 칩 — **바의 칸과 같은 문법**(제 색으로 채우고 `onColor` 로 글자).
  //   높이는 바(10)보다 살짝 크게 둬서 «바의 일부» 로 오해되지 않게 한다.
  zeroChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  zeroChipTx: { fontSize: 11, fontWeight: '800' },
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
