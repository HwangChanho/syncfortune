// app/src/components/RootsTeaser.tsx — 명식의 뿌리(통근·투출) 무료 온디바이스 티저 (결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널(모든 유료 콘텐츠 공통): 유료 '명식의 뿌리'(roots·LLM) 위에 '뿌리 강도'를
//   무료로 먼저 보여준다 → 재회(ReunionRich)/애정(LoveFlowGraph)/인생그래프(LifeGraphTeaser)와 동일 결.
//   · 무료 = 네 자리(년월일시)의 뿌리 강도를 한눈에 · 전체 단단함 — 온디바이스·API 0.
//   · 유료 = 각 뿌리가 삶에서 뭘 뜻하는지 · 겉과 속의 차이 · 약한 뿌리 보완법(LLM).
//
// ▶ 결정론 근거(발명 아님 — 룰 산출만):
//   ① 통근(通根) 강도 = MyeongsikScreen 의 통근 로직을 그대로 재사용한다.
//      "각 기둥의 천간(겉으로 드러난 = 투출된 글자)이 어느 지지 지장간(속 기운)에 같은 오행으로 뿌리내렸나."
//      강도 가중은 엔진이 이미 담은 HiddenStem.role(본기>중기>여기)로 매김(고전 통근 강도) + 자좌(앉은 자리) 가중.
//   ② 전체 단단함 = 엔진 classifyStrength(saju)의 득령·득지·득세 개수(재계산 아님, 순수함수 재호출).
//   ★화면 텍스트엔 한자(천간·지지 글자)·십신 용어를 절대 노출하지 않는다 = 일상어.
//     년월일시는 사주 고전 '근묘화실(根苗花實)' 프레임으로 뿌리·줄기·꽃·열매로 표기(자연스러운 나무 결).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import type { SajuChart, PillarPos, HiddenStem } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { stemElement, elementColor } from '../lib/engine/ohaeng'; // 통근 판정용 오행 매핑(MyeongsikScreen 과 동일 소스)
import { classifyStrength } from '@engine/structure';             // 득령·득지·득세(원국 강약) — 엔진 결정론 재사용(재계산 X)

const ROOT_GREEN = elementColor['木']; // roots.tsx themeColor(木)와 통일 — 뿌리·나무 결

// 근묘화실(根苗花實) — 년월일시를 뿌리·줄기·꽃·열매로(사주 고전 프레임). 한자·십신 노출 없이 일상어로.
//   위→아래 = 초년(뿌리) → 말년(열매) 흐름. 일주(꽃) = '지금의 나'(일간).
const LIFE_PART: Record<PillarPos, { part: string; sub: string }> = {
  년: { part: '뿌리', sub: '타고난 바탕' },
  월: { part: '줄기', sub: '자라온 터전' },
  일: { part: '꽃', sub: '지금의 나' },
  시: { part: '열매', sub: '맺어갈 결실' },
};
const ORDER: PillarPos[] = ['년', '월', '일', '시']; // 근묘화실 순서(위→아래)

// 통근 강도 역할 가중 — 엔진 HiddenStem.role 재사용(본기근 > 중기근 > 여기근 = 고전 통근 강도).
const ROLE_W: Record<HiddenStem['role'], number> = { 본기: 3, 중기: 2, 여기: 1 };

// 통근 점수 → 일상어 tier + 막대 비율. §4 웰빙 가드: 뿌리 약함도 '떠 있음'으로 부드럽게(부정 증폭 X).
function rootTier(score: number): { label: string; frac: number } {
  if (score <= 0) return { label: '떠 있어요', frac: 0.07 };        // 통근 없음 = 겉에만 드러나고 속뿌리 없음
  if (score <= 2) return { label: '뿌리가 얕아요', frac: 0.32 };
  if (score <= 4) return { label: '뿌리가 있어요', frac: 0.56 };
  if (score <= 6.5) return { label: '뿌리가 단단해요', frac: 0.8 };
  return { label: '뿌리가 아주 깊어요', frac: 1 };
}

// 전체 단단함(득령·득지·득세 개수 0~3) → 일상어 한 줄. §4: 약해도 '유연·섬세'로 전향 프레이밍.
function overallLine(deukCnt: number): { head: string; sub: string } {
  if (deukCnt >= 3) return { head: '타고난 기운이 아주 단단히 뿌리내렸어요', sub: '웬만한 흔들림엔 크게 휘둘리지 않는 힘이에요.' };
  if (deukCnt === 2) return { head: '기운이 단단하게 자리 잡은 편이에요', sub: '중심이 서 있어 밀어붙이는 힘이 있어요.' };
  if (deukCnt === 1) return { head: '기운이 부드럽고 유연한 편이에요', sub: '주변 흐름을 잘 읽고 맞춰가는 힘이 있어요.' };
  return { head: '기운이 가볍고 유연해서 변화에 잘 맞춰가요', sub: '틀에 얽매이지 않고 상황에 맞춰 흐르는 결이에요.' };
}

/**
 * 명식의 뿌리 무료 티저. SpecialContentScreen 의 freeHook 으로 주입(대표 명식 saju).
 * @param saju 대표 명식의 사주(결정론 산출 + timeUnknown 병합됨 — SpecialContentScreen freeHook 참고).
 */
export function RootsTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  const grow = useRef(new Animated.Value(0)).current; // 막대가 좌→우로 차오르는 마운트 애니(0→1)

  // 모든 결정론 값은 saju 변경 시에만 1회 산출(성능·단일 소스).
  const d = useMemo(() => {
    const P = saju.pillars;
    const timeUnknown = !!saju.timeUnknown;
    // MyeongsikScreen 통근 로직 재사용 — 시각 미상 시 시주(열매) 제외(시각 모르면 시주 불가).
    const visiblePos = ORDER.filter((p) => !(p === '시' && timeUnknown));

    // 각 기둥: '드러난(투출) 천간'이 어느 지지 지장간(속 기운)에 같은 오행으로 뿌리내렸나 = 통근 강도.
    const rows = visiblePos.map((p) => {
      const gEl = stemElement(P[p].stem);              // 이 기둥 천간(겉 글자)의 오행
      let score = 0;
      for (const q of visiblePos) {
        // 이 지지의 지장간 중 천간과 동일 오행인 것들의 '최강 역할'(본기>중기>여기)만 취함
        let best = 0;
        for (const h of P[q].hiddenStems) if (stemElement(h.stem) === gEl) best = Math.max(best, ROLE_W[h.role]);
        if (best > 0) score += q === p ? best + 2 : best; // 자좌(앉은 자리) 뿌리 = 가장 강함(+2 가중)
      }
      const tier = rootTier(score);
      return { p, ...LIFE_PART[p], rooted: score > 0, ...tier };
    });

    // 전체 단단함 = 득령·득지·득세 개수(엔진 classifyStrength 재사용 — 순수함수 재호출, 재계산 부담 미미).
    const sc = classifyStrength(saju);
    const deukCnt = [sc.deukryeong, sc.deukji, sc.deukse].filter(Boolean).length;
    const rootedCnt = rows.filter((r) => r.rooted).length;
    return { rows, timeUnknown, ...overallLine(deukCnt), rootedCnt, total: rows.length };
  }, [saju]);

  // 마운트 시 막대 차오름(0→1). width 애니라 useNativeDriver:false(PossibilityGauge 와 동일 결).
  useEffect(() => {
    grow.setValue(0);
    Animated.timing(grow, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [grow, d]);

  if (!saju?.pillars || d.rows.length === 0) return null; // 방어 — 명식 없으면 티저 생략

  return (
    <View style={styles.wrap}>
      {/* 리드(일상어) — 무엇을 보여주는지 + 유도 */}
      <Text style={styles.lead}>타고난 기운이 얼마나 단단히 뿌리내렸는지</Text>
      <Text style={styles.leadSub}>뿌리가 깊을수록 흔들림이 적어요. 네 자리의 뿌리 강도를 미리 그려 봤어요.</Text>

      {/* ① 4기둥(근묘화실) 뿌리 강도 막대 — 핵심 무료 훅 */}
      <View style={styles.barCard}>
        {d.rows.map((r) => (
          <View key={r.p} style={styles.barItem}>
            <View style={styles.barHead}>
              <Text style={styles.barPart}>{r.part} <Text style={styles.barSub}>· {r.sub}</Text></Text>
              <Text style={[styles.barTier, { color: r.rooted ? ROOT_GREEN : colors.inkFaint }]}>{r.label}</Text>
            </View>
            <View style={styles.barTrack}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: r.rooted ? ROOT_GREEN : colors.inkFaint,
                    // 좌→우 차오름: 0 → 이 자리 비율(frac). 최소 노브(7%)로 '떠 있음'도 흔적은 보이게.
                    width: grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.round(r.frac * 100)}%`] }),
                  },
                ]}
              />
            </View>
          </View>
        ))}
        {/* 범례(일상어) — 막대 = 겉으로 드러난 기운(투출)이 속뿌리(통근)에 닿은 정도 */}
        <Text style={styles.legend}>막대가 길수록 겉으로 드러난 기운이 속뿌리까지 단단히 닿아 있어요. 짧으면 겉에만 떠 있는 기운이에요.</Text>
      </View>

      {/* ② 전체 단단함 요약(득령·득지·득세 → 일상어) */}
      <View style={styles.card}>
        <Text style={styles.overallHead}>{d.head}</Text>
        <Text style={styles.overallSub}>{d.sub}</Text>
        <View style={styles.divider} />
        <Text style={styles.overallCount}>
          {d.total}자리 중 <Text style={styles.accent}>{d.rootedCnt}곳</Text>이 속뿌리에 닿아 있어요.
        </Text>
        {d.timeUnknown ? <Text style={styles.tuNote}>태어난 시각을 몰라 열매(시) 자리는 뺐어요.</Text> : null}
      </View>

      {/* ── 무료 vs 유료 가치 명시(퍼널 훅) — 곧바로 아래 게이트(유료 CTA)로 이어진다 ── */}
      <View style={styles.card}>
        <Text style={styles.funnelLine}>무료로는 <Text style={styles.accent}>네 자리의 뿌리 강도</Text>를 한눈에 볼 수 있어요.</Text>
        <Text style={styles.funnelLine}>깊은 풀이에선 <Text style={styles.accent}>각 뿌리가 삶에서 무엇을 뜻하는지, 겉과 속의 차이, 약한 뿌리를 단단히 키우는 법</Text>까지 짚어 드려요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  // 리드
  lead: { ...font.body, fontWeight: '800', color: ROOT_GREEN, fontSize: 16, marginBottom: space(1.5) },
  leadSub: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(3), fontSize: 12 },
  // 공통 카드(ReunionRich/LifeGraphTeaser 와 동일 결 — sunk 배경·라운드·여백·하단 간격)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(3) },
  // ① 뿌리 강도 막대 카드
  barCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3) },
  barItem: { marginBottom: space(3.5) },
  barHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space(1.5) },
  barPart: { ...font.body, color: colors.ink, fontWeight: '800', fontSize: 14 },
  barSub: { ...font.caption, color: colors.inkFaint, fontWeight: '400', fontSize: 11 },
  barTier: { ...font.caption, fontWeight: '800', fontSize: 12 }, // 색은 rooted 여부로 주입(ROOT_GREEN/inkFaint)
  barTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill, minWidth: 6 }, // 색은 rooted 여부로 주입
  legend: { ...font.caption, color: colors.inkFaint, fontSize: 10.5, lineHeight: 15, marginTop: space(1.5) },
  // ② 전체 단단함 요약
  overallHead: { ...font.body, color: colors.ink, fontWeight: '800', fontSize: 15, marginBottom: space(1.5), lineHeight: 21 },
  overallSub: { ...font.caption, color: colors.inkSoft, lineHeight: 19, fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space(3), opacity: 0.6 },
  overallCount: { ...font.caption, color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  tuNote: { ...font.caption, color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: space(2) },
  // 퍼널 가치 명시
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
  accent: { color: ROOT_GREEN, fontWeight: '800' },
});
