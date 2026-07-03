// app/src/components/LoveFlowGraph.tsx — 애정·결혼운 흐름 곡선(시기별·대운별)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스 인코딩(발명 아님 — 규칙/엔진 결정론, API 0). 단순 '재성 유무'가 아니라
// *실제 부부자리(일지=배우자궁)가 열리는가*를 축으로 한 복합 점수(composite)로 개선.
//   결혼시기 규칙군을 그대로 반영: R25(결혼시기)·R28(배우자)·R41(혼인 3레이어)·R43(입묘개고).
//   구조적·결정론(엔진 twelveStage/tenGod/HIDDEN + 표준 합충 테이블)로만 산출 — LLM 미사용.
//
// ▶ 대운별 점수 = 다음 항의 합(1~10 범위로 클램프 → SVG y축 매핑):
//   A. baseline(재성 통근·강도)   — 원국 재성이 지장간까지 튼튼히 뿌리내리면 곡선 전체가 avg(5) 위로,
//                                    뿌리 없으면 avg 이하로 (곡선의 '기저선' 이동, 대운마다 동일).
//   B. 재성 12운성 (대운 지지)     — 재성星이 그 대운 지지에서 갖는 기운(장생~제왕 강 / 절·묘 약).
//   C1. 일지 충(冲)               — 배우자궁 '개방·변동' → 강한 애정/결혼 timing.
//   C2. 일지 육합/삼합(반합)       — 배우자궁 '결속'(=일지합) → 강한 애정/결혼 timing.
//   C3. 부부자리 열리며 재성 나옴   — C1/C2로 열릴 때 대운지지(또는 일지) 지장간에 재성이 있으면 가산.
//   D. 일간 干합 (대운 천간)       — 대운 천간이 일간과 干합하는 시점 → 인연·끌림 timing.
//   → 최고점 = 부부자리 개폐(C1/C2) + 재성 활성(B/C3) + 합 timing(D)이 수렴하는 시기.
//
//   ★ 아래 모든 가중치·항목 선택은 daniel 검수/튜닝 슬롯(스탠스, 발명 아님). 표준 합충 테이블은
//     engine/structure.ts 와 동일 값(모듈 비공개라 재사용 불가 → 여기 로컬 정의, 표준 통설).
//   곡선은 마운트 시 좌→우로 그려짐(strokeDashoffset). 현재 대운 지점 강조.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { twelveStage, type TwelveStage } from '@engine/twelve';
import { tenGod, HIDDEN } from '@engine/saju';          // tenGod(십신)·HIDDEN(지장간 표준표) 엔진 재사용
import type { SajuChart, Stem, Branch, TenGod } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ALL_STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 12운성 표준 에너지 강도(1~10) — 텍스트북 통설(제왕 최강·절 최약). ★daniel 검수(튜닝 가능).
const STAGE_STR: Record<TwelveStage, number> = { 장생: 7, 목욕: 5, 관대: 8, 건록: 9, 제왕: 10, 쇠: 6, 병: 4, 사: 3, 묘: 2, 절: 1, 태: 3, 양: 5 };

// ── 표준 합충 테이블 (표준 통설 · engine/structure.ts와 동일 값 재현 — 모듈 비공개라 로컬 정의). ★daniel 검수 ──
const SIXHE: [Branch, Branch][] = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];         // 육합
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];         // 충(七冲)
const SANHE: Branch[][] = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];                     // 삼합 3국
const WANGZHI: Branch[] = ['子', '午', '卯', '酉'];                                                                          // 왕지(반합 성립 핵심 — 엔진 스탠스 일치)
const STEM_COMBINE: [Stem, Stem][] = [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']];                   // 천간 오합(干합)

// 두 글자가 테이블의 한 쌍(순서 무관)에 해당하는가
const inPair = <T extends string>(list: [T, T][], a: T, b: T) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
// 대운지지 × 일지가 같은 삼합국에 속하고(서로 다른 글자) 한쪽이 왕지 = 반합(결속). ★daniel 검수(왕지 조건)
const halfSanhe = (a: Branch, b: Branch) => a !== b && SANHE.some((g) => g.includes(a) && g.includes(b)) && (WANGZHI.includes(a) || WANGZHI.includes(b));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ── ★daniel 검수: 복합 점수 가중치(스탠스 · 전부 튜닝 슬롯). 수렴 시 avg 위로 뚜렷이, 불모기는 avg 아래로. ──
const BASELINE_AVG = 5;      // 곡선 중앙(중간 점선)과 일치 — avg 기준선
const ROLE_W: Record<'본기' | '중기' | '여기', number> = { 본기: 1.0, 중기: 0.6, 여기: 0.3 }; // 지장간 role별 통근 가중
const TOUCHUL_W = 0.8;       // 재성 천간 투출(투간) 완성 시 통근 가산
const W_BASE = 0.6;          // 통근강도 → baseline 이동 계수
const BASE_REF = 1.5;        // 통근강도 중립 기준(이 값이면 baseline=avg)
const W_STAGE = 0.35;        // 재성 12운성 항 계수 (stage - STAGE_MID)
const STAGE_MID = 5.5;       // 12운성 중립값(이보다 강하면 +, 약하면 −)
const W_CHUNG = 1.6;         // 일지 충(배우자궁 개방)
const W_HAP_DAY = 1.8;       // 일지 육합/삼합(배우자궁 결속 = 일지합)
const W_OPEN_JAE = 1.4;      // 부부자리 열리며 지장간에 재성이 나옴
const W_GANHAP = 1.2;        // 일간 干합(인연 timing)

const LOVE_PINK = '#E5749B';

/**
 * 애정·결혼운 흐름 곡선.
 * @param saju   본인 사주(원국 + 대운). 결정론 산출값.
 * @param gender 성별. 있으면 여명=배우자성 관성, 남명=재성으로 판정. ★daniel 검수(배우자星 매핑).
 *               ⚠️ SajuChart에는 성별이 없어 optional — 현재 호출부(love.tsx)는 미전달 → 재성(남명) 기본.
 *               (호출부에서 gender={input.sex} 전달 시 여명 관성 자동 적용 — 후속 배선.)
 */
export function LoveFlowGraph({ saju, gender }: { saju: SajuChart; gender?: '남' | '여' }) {
  const dash = useRef(new Animated.Value(0)).current;
  const dm = saju.dayMaster.stem;
  const dayBranch = saju.pillars['일'].branch;   // 일지 = 배우자궁(부부자리)

  // ★daniel 검수: 배우자성 = 남명 재성(정/편재), 여명 관성(정/편관). 부부자리(일지) 개폐·干합 로직은 성별 공통.
  //   재성 broadly(정재 AND 편재) — 정재만이 아니라 재성 전체를 배우자星으로 본다.
  const isFemale = gender === '여';
  const targetGods: TenGod[] = isFemale ? ['정관', '편관'] : ['정재', '편재'];
  const isTarget = (s: Stem) => targetGods.includes(tenGod(dm, s));         // 이 천간이 배우자성인가
  const targetStems = ALL_STEMS.filter(isTarget);                          // 배우자성 천간 2개(오행 1개의 양·음)
  const branchHasTarget = (b: Branch) => HIDDEN[b].some((h) => isTarget(h.stem)); // 지지 지장간에 배우자성이 있는가

  // ── A. baseline(재성 통근·강도) — 곡선 전체 기저선 (대운마다 동일) ──
  //   원국 4지지의 지장간에서 배우자성이 뿌리내린 정도를 role 가중 합산 + 천간 투출 완성 보너스.
  let rootScore = 0;
  (['년', '월', '일', '시'] as const).forEach((p) => {
    HIDDEN[saju.pillars[p].branch].forEach((h) => { if (isTarget(h.stem)) rootScore += ROLE_W[h.role]; });
  });
  // 투출: 배우자성이 원국 천간에도 드러나면(일간=비견은 자동 제외) 통근 완성 → 가산.
  const tuChul = (['년', '월', '일', '시'] as const).some((p) => isTarget(saju.pillars[p].stem));
  if (tuChul && rootScore > 0) rootScore += TOUCHUL_W;
  const baseline = BASELINE_AVG + clamp(W_BASE * (rootScore - BASE_REF), -1.5, 1.5); // 통근 강 → avg 위 / 약 → avg 아래

  const cycles = (saju.luckCycles ?? []).slice(0, 9); // 대운 ~9개(약 80세까지)
  const curAge = saju.currentLuck?.startAge;

  const W = 300, H = 150, padL = 14, padR = 14, padT = 16, padB = 26;
  const pts = cycles.map((c, i) => {
    const cb = c.branch;   // 대운 지지
    const cs = c.stem;     // 대운 천간
    // B. 재성 12운성(대운 지지) — 배우자성 천간 중 최강 기운.
    const stage12 = targetStems.length
      ? Math.max(...targetStems.map((s) => STAGE_STR[twelveStage(s, cb)] ?? 5))
      : 5;
    // C1/C2. 부부자리(일지) 개폐 — 충=개방 / 육합·삼합(반합)=결속(일지합).
    const chong = inPair(CHONG, cb, dayBranch);
    const dayHap = inPair(SIXHE, cb, dayBranch) || halfSanhe(cb, dayBranch);
    const opened = chong || dayHap;
    // C3. 열리면서 지장간에 재성이 나오는가(대운지지 또는 열린 일지).
    const jaeSurfaces = opened && (branchHasTarget(cb) || branchHasTarget(dayBranch));
    // D. 일간 干합(대운 천간 × 일간).
    const ganHap = inPair(STEM_COMBINE, cs, dm);

    const raw = baseline
      + W_STAGE * (stage12 - STAGE_MID)   // B
      + (chong ? W_CHUNG : 0)             // C1
      + (dayHap ? W_HAP_DAY : 0)          // C2 (=일지합)
      + (jaeSurfaces ? W_OPEN_JAE : 0)    // C3
      + (ganHap ? W_GANHAP : 0);          // D
    const v = clamp(raw, 1, 10);          // SVG y축 매핑 범위로 클램프

    const x = padL + (i * (W - padL - padR)) / Math.max(1, cycles.length - 1);
    const y = H - padB - ((v - 1) / 9) * (H - padT - padB);
    return { x, y, age: c.startAge, cur: c.startAge === curAge };
  });
  // 경로 + 길이(드로잉 애니용)
  let d = '', len = 0;
  pts.forEach((p, i) => { d += i === 0 ? `M${p.x},${p.y}` : ` L${p.x},${p.y}`; if (i > 0) { const dx = p.x - pts[i - 1].x, dy = p.y - pts[i - 1].y; len += Math.sqrt(dx * dx + dy * dy); } });

  useEffect(() => {
    dash.setValue(0);
    Animated.timing(dash, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [dash, d]);
  const offset = dash.interpolate({ inputRange: [0, 1], outputRange: [len, 0] });

  if (cycles.length < 3) return null; // 대운 부족 시 미표시

  return (
    <View style={styles.box}>
      <Text style={styles.title}>애정·결혼운 흐름 <Text style={styles.titleSub}>(배우자궁 개폐·재성·합 종합)</Text></Text>
      <Svg width={W} height={H} style={{ alignSelf: 'center' }}>
        {/* 기준 점선(avg=5) — baseline이 이 선 위/아래냐가 재성 통근을 반영 */}
        <Line x1={padL} y1={H - padB - ((5 - 1) / 9) * (H - padT - padB)} x2={W - padR} y2={H - padB - ((5 - 1) / 9) * (H - padT - padB)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        {/* 곡선(좌→우 드로잉) */}
        <AnimatedPath d={d} stroke={LOVE_PINK} strokeWidth={2.5} fill="none" strokeDasharray={len} strokeDashoffset={offset} strokeLinejoin="round" strokeLinecap="round" />
        {/* 대운 점 + 나이 + 현재 강조 */}
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={p.cur ? 5 : 3} fill={p.cur ? '#E9C77B' : LOVE_PINK} stroke={p.cur ? '#fff' : 'none'} strokeWidth={p.cur ? 1.5 : 0} />
        ))}
        {pts.map((p, i) => (
          <SvgText key={`a${i}`} x={p.x} y={H - 8} fontSize={9} fill={p.cur ? '#E9C77B' : 'rgba(230,220,245,0.5)'} textAnchor="middle">{p.age}</SvgText>
        ))}
      </Svg>
      <Text style={styles.note}>※ 높은 지점 = 배우자궁(일지)이 충·육합·삼합으로 열리고 재성(애정星)이 살아나며 합이 겹치는 시기. 노란 점 = 현재 대운.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  title: { ...font.body, fontWeight: '800', color: LOVE_PINK, marginBottom: space(2), fontSize: 14 },
  titleSub: { ...font.caption, color: colors.inkFaint, fontWeight: '600' },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(2), textAlign: 'center', fontSize: 11 },
});
