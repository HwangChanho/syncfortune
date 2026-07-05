// app/src/components/ReunionRich.tsx — 재회(무료) 리치 콘텐츠 셸 (결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 모델: "무료를 결정론+비주얼로 풍부하게 → 유료 자연 구매". FreeFunnel 의 render 로 주입되는
//   재회 전용 무료 본문. supabase/Edge 절대 호출 안 함 — computeChart 산출 saju 만으로 전부 계산.
//   기존 ReunionTiming(12개월 달력)을 그대로 품고, 그 위에 아래 결정론 요소를 얹어 '언제·가능성·방향'을
//   시각적으로 보여주고 → 골드 CTA(유료 깊은 풀이)로 자연 유도한다.
//
// ▶ 담는 무료 요소(전부 결정론, 한자·용어는 화면 텍스트에 노출 금지 = 일상어):
//   ① 재회 인연 게이지(0~100) — 원국 도화 + 현재 운(대운·세운·올해 월운)의 도화 발동 + 배우자궁(일지)
//      개폐 + 재/관 인연星 발동을 합산한 '재회의 문이 열린 정도'. 애니 게이지 + 경향 라벨(§4 경향·단정 금지).
//   ② 배우자궁 개폐 상태 — 일지 vs 현재 운(세운·대운): 열리는/맺히는/부딪히는/잠잠한 '결'(일상어).
//   ③ 인연 기운 방향·계절 — 원국 도화 왕지 → 방위·계절(子북겨울/午남여름/卯동봄/酉서가을).
//   ④ 연락 개운 미리보기(티저) — 좋은 색·요일 중 딱 하나만 무료 공개, 나머지·구체 실천은 🔒(유료).
//
// ▶ 결정론 근거: 표준 합충/형/도화 테이블(통설) + 엔진 tenGod·HIDDEN(지장간) 재사용. LoveFlowGraph 와
//   같은 결(engine/structure 는 모듈 비공개 → 표준 통설 테이블만 로컬 정의). 발명 아님 — 룰 산출만.
//   ★게이지 가중치는 아래 W 블록(daniel 검수/튜닝 슬롯)에 모아 두었다.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { tenGod, HIDDEN } from '@engine/saju';                 // 십신·지장간 표준표(엔진 재사용)
import type { SajuChart, Branch, Stem, Element, PillarPos, TenGod } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { ReunionTiming } from './ReunionTiming';                // 기존 12개월 '연락이 열리는 달' 달력(그대로 품음)

// ── 표준 통설 테이블 (engine/structure 비공개 → 로컬 정의. LoveFlowGraph 와 동일 값·결). ★daniel 검수 ──
const DOHWA: Branch[] = ['子', '午', '卯', '酉'];                                                              // 도화 = 왕지(끌림의 기운)
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]; // 6충(개방·발동)
const SIXHE: [Branch, Branch][] = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']]; // 육합(결속)
const SANHE: Branch[][] = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];             // 삼합 3국
const WANGZHI: Branch[] = ['子', '午', '卯', '酉'];                                                            // 왕지(반합 성립 핵심)
// 형(刑) — 삼형(둘만 만나도 부분 성립)·상형·자형(같은 글자 만남). 배우자궁 '마찰' 판정용(표준 통설).
const HYEONG_TRIO: Branch[][] = [['寅', '巳', '申'], ['丑', '戌', '未']];
const HYEONG_PAIR: [Branch, Branch][] = [['子', '卯']];
const SELF_HYEONG: Branch[] = ['辰', '午', '酉', '亥'];
const ALL_STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
// 오행 상극(A극B) — 배우자성 오행 산출용(재성=일간이 극 / 관성=일간을 극).
const CONTROLS: Record<Element, Element> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
// 지지 → 월건(節氣) 월 번호(월운 발동 달 계산 — ReunionTiming 과 동일 결정론).
const BRANCH_MONTH: Record<Branch, number> = { 寅: 1, 卯: 2, 辰: 3, 巳: 4, 午: 5, 未: 6, 申: 7, 酉: 8, 戌: 9, 亥: 10, 子: 11, 丑: 12 };
// 도화 왕지 → 방위·계절(일상어). 인연 기운이 무르익는 방향·철.
const DOHWA_DIR: Record<'子' | '午' | '卯' | '酉', { dir: string; season: string }> = {
  子: { dir: '북쪽', season: '겨울' }, 午: { dir: '남쪽', season: '여름' },
  卯: { dir: '동쪽', season: '봄' }, 酉: { dir: '서쪽', season: '가을' },
};
// 오행 → 연락 개운(방위·색·요일, 일상어). 배우자성(인연星) 오행 기준.
const ELEM_GAEUN: Record<Element, { dir: string; color: string; day: string }> = {
  木: { dir: '동쪽', color: '맑은 청록빛', day: '목요일' },
  火: { dir: '남쪽', color: '따뜻한 붉은빛', day: '화요일' },
  土: { dir: '가까운 곳', color: '포근한 노란·베이지빛', day: '토요일' },
  金: { dir: '서쪽', color: '맑은 흰·은빛', day: '금요일' },
  水: { dir: '북쪽', color: '깊은 남색빛', day: '수요일' },
};

// 두 글자가 테이블의 한 쌍(순서 무관)인가
const inPair = <T extends string>(list: [T, T][], a: T, b: T) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
// 반합: 대운/세운 지지 × 일지가 같은 삼합국이고 한쪽이 왕지(결속). ★daniel 검수(왕지 조건)
const halfSanhe = (a: Branch, b: Branch) => a !== b && SANHE.some((g) => g.includes(a) && g.includes(b)) && (WANGZHI.includes(a) || WANGZHI.includes(b));
// 형(마찰) 성립 여부
const inHyeong = (a: Branch, b: Branch): boolean => {
  if (a === b) return SELF_HYEONG.includes(a);                 // 자형 = 같은 글자
  if (inPair(HYEONG_PAIR, a, b)) return true;                  // 상형(子卯)
  return HYEONG_TRIO.some((g) => g.includes(a) && g.includes(b)); // 삼형(둘만 만나도 부분)
};
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// 운(대운·세운) 지지 하나가 원국 도화를 얼마나 '발동'시키는가 → 0~1 정규화 강도.
//   운지지 자체가 왕지(도화)면 배경 끌림장 + 원국 도화를 충하면 강한 열림 + 합하면 맺힘.
const dohwaActivation = (unB: Branch, natalDohwa: Branch[]): number => {
  let s = 0;
  if (DOHWA.includes(unB)) s += 0.5;                                              // 운지지 자체가 도화(끌림장)
  if (natalDohwa.some((d) => inPair(CHONG, d, unB))) s += 1.0;                    // 원국 도화를 충(강한 발동)
  if (natalDohwa.some((d) => inPair(SIXHE, d, unB) || halfSanhe(d, unB))) s += 0.6; // 합(맺힘)
  return Math.min(1, s);
};
// 배우자궁(일지) vs 운지지 상태 — 충(열림)/합(맺힘)/형(마찰). 각각 독립 판정.
const gungState = (dayB: Branch, unB: Branch) => ({
  open: inPair(CHONG, dayB, unB),
  bond: inPair(SIXHE, dayB, unB) || halfSanhe(dayB, unB),
  friction: inHyeong(dayB, unB),
});

// ══ ★daniel 검수: 재회 인연 게이지 가중치(스탠스 · 전부 튜닝 슬롯). 각 항의 만점(부분점수). 합계 = 100 ══
//   기질(원국)보다 '지금 운'이 크게 움직이도록 배분(무료 훅 = "지금 열려요"가 살아있게).
//   배우자궁 개폐(gungOpen)를 최대 가중 = daniel 애정/결혼 timing 핵심 스탠스(배우자궁 형충회합 개폐).
const W = {
  natalDohwa: 18,   // ① 원국 끌림 기질(도화 개수) — 곡선의 기저(있으면 문이 태생적으로 조금 더 열림)
  daeunDohwa: 16,   // ② 대운(10년 배경)이 도화를 발동
  seunDohwa: 22,    // ③ 올해 세운이 도화를 발동(올해 트리거 — 무료 = 올해 기준이라 가중 높게)
  wolunActive: 12,  // ④ 올해 '연락이 열리는 달' 수(달력 금색 달 개수)
  gungOpen: 24,     // ⑤ 배우자궁(일지) 개폐 — daniel 핵심 스탠스(가장 큰 지렛대)
  inyeonStar: 8,    // ⑥ 재/관 인연星이 현재 운(대운·세운)에 발동
};
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * 재회 인연 게이지(핵심 훅) — 애니 미터 + 숫자 카운트업 + 경향 라벨 + '열려있어요' 글로우.
 * 부모(ReunionRich)와 형제 섹션을 카운트업마다 리렌더시키지 않도록 게이지만 별도 컴포넌트로 격리(단일 책임·성능).
 * @param score    0~100 결정론 점수(부모에서 산출).
 * @param tendency 경향 라벨(열려 있어요 / 서서히 열려요 / 지금은 조용해요).
 * @param bright   '열려 있어요' 상태(글로우·반짝임 on).
 * @param caption  게이지 아래 경향 문구(전향적·처방 동반, 단정 금지).
 */
function ReunionGauge({ score, tendency, bright, caption }: { score: number; tendency: string; bright: boolean; caption: string }) {
  const anim = useRef(new Animated.Value(0)).current;   // 0→1 채움 트윈(마운트 시)
  const glow = useRef(new Animated.Value(0.35)).current; // '열려있어요' 글로우/반짝임 펄스
  const [display, setDisplay] = useState(0);             // 숫자 카운트업(0→score)

  // 마운트 시 게이지 채움 + 숫자 카운트업(SkeletonDot 와 동일 RN Animated — 새 네이티브 의존 없음).
  useEffect(() => {
    anim.setValue(0);
    setDisplay(0);
    // 리스너로 숫자 갱신(값은 게이지 컴포넌트에만 국한 → 형제 섹션 리렌더 없음).
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value * score)));
    Animated.timing(anim, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [anim, score]);

  // '열려있어요'일 때만 은은한 글로우/반짝임 루프(펄스). SkeletonDot 결(opacity 왕복, 네이티브 드라이버).
  useEffect(() => {
    if (!bright) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.9, duration: 900, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.35, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow, bright]);

  // 채움 폭(0%→score%). 레이아웃(width) 애니라 useNativeDriver:false. score 0 이어도 최소 3% 노브 노출.
  const fillW = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(3, score)}%`] });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>재회의 문이 열린 정도</Text>
      {/* 큰 숫자(카운트업) + 경향 라벨(오른쪽) */}
      <View style={styles.gaugeHead}>
        <Text style={styles.gaugeNum}>{display}</Text>
        <Text style={styles.gaugeUnit}> / 100</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.tendencyWrap}>
          <Text style={[styles.tendency, bright && styles.tendencyBright]}>{tendency}</Text>
          {bright && <Animated.Text style={[styles.spark, { opacity: glow }]}>✦</Animated.Text>}
        </View>
      </View>
      {/* 미터: 트랙 + 채움(좌→우) + 열림 상태 글로우 오버레이 */}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: fillW }]}>
          {bright && <Animated.View style={[styles.fillGlow, { opacity: glow }]} />}
        </Animated.View>
      </View>
      {/* 3구간 라벨 */}
      <View style={styles.zones}>
        <Text style={styles.zoneTx}>조용</Text>
        <Text style={styles.zoneTx}>서서히</Text>
        <Text style={styles.zoneTx}>열림</Text>
      </View>
      <Text style={styles.gaugeCaption}>{caption}</Text>
    </View>
  );
}

/**
 * 재회 무료 리치 본문. FreeFunnel 의 render 로 주입(대표 명식 saju).
 * @param saju 대표 명식의 사주(결정론 산출 + timeUnknown/sex 병합됨 — FreeFunnel 참고).
 */
export function ReunionRich({ saju }: { saju: SajuChart }) {
  // 모든 결정론 값은 saju 변경 시에만 1회 산출(성능·단일 소스). 카운트업 리렌더와 분리.
  const d = useMemo(() => {
    // 시각 미상이면 시지(時支) 제외(잘못된 timing 방지) — 코드베이스 관례(FreeFunnel 이 병합).
    const timeUnknown = (saju as any)?.timeUnknown === true;
    const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
    const natalBranches = posList.map((p) => saju.pillars?.[p]?.branch).filter(Boolean) as Branch[];
    const natalDohwa = DOHWA.filter((x) => natalBranches.includes(x));

    const dm = saju.dayMaster.stem;
    const dayEl = saju.dayMaster.element;
    const dayBranch = saju.pillars['일'].branch;   // 일지 = 배우자궁

    // 배우자성(인연星): 남명=재성 / 여명=관성. 성별은 FreeFunnel 이 saju 에 병합(없으면 남명 재성 기본).
    //   ★daniel 검수(배우자星 매핑) — LoveFlowGraph 와 동일 스탠스.
    const isFemale = (saju as any)?.sex === '여';
    const targetGods: TenGod[] = isFemale ? ['정관', '편관'] : ['정재', '편재'];
    const isTarget = (s: Stem) => targetGods.includes(tenGod(dm, s));
    const branchHasTarget = (b: Branch) => HIDDEN[b].some((h) => isTarget(h.stem));
    // 배우자성 오행(개운 티저용): 재성=일간이 극하는 오행 / 관성=일간을 극하는 오행.
    const inyeonEl: Element = isFemale
      ? (Object.keys(CONTROLS) as Element[]).find((k) => CONTROLS[k] === dayEl)!  // 관성(극 일간)
      : CONTROLS[dayEl];                                                          // 재성(일간이 극)

    const daeun = saju.currentLuck;  // 현재 대운(엔진 산출, 폴백 포함 non-null)
    const seun = saju.annual;        // 현재 세운(올해)

    // ④ 올해 '연락이 열리는 달' 수 — 각 원국 도화의 충 짝 월건(절기 고정 = 매년 결정론, ReunionTiming 과 동일).
    const monthSet = new Set<number>();
    natalDohwa.forEach((x) => {
      const partner = CHONG.find(([a, b]) => a === x || b === x);
      if (partner) { const p = partner[0] === x ? partner[1] : partner[0]; monthSet.add(BRANCH_MONTH[p]); }
    });
    const activeMonths = monthSet.size;

    // ②③ 운 도화 발동 강도 + 배우자궁 개폐
    const daeunAct = dohwaActivation(daeun.branch, natalDohwa);
    const seunAct = dohwaActivation(seun.branch, natalDohwa);
    const gSeun = gungState(dayBranch, seun.branch);
    const gDaeun = gungState(dayBranch, daeun.branch);
    // 배우자궁 종합 상태(우선순위 열림>맺힘>마찰>잠잠) — 세운/대운 중 하나라도 성립하면 그 결.
    const gungOpen = gSeun.open || gDaeun.open;
    const gungBond = !gungOpen && (gSeun.bond || gDaeun.bond);
    const gungFriction = !gungOpen && !gungBond && (gSeun.friction || gDaeun.friction);

    // ⑥ 인연星 발동(현재 대운·세운 천간/지장간)
    let inyeon = 0;
    if (isTarget(daeun.stem)) inyeon += 4;
    if (isTarget(seun.stem)) inyeon += 4;
    if (branchHasTarget(daeun.branch)) inyeon += 3;
    if (branchHasTarget(seun.branch)) inyeon += 3;

    // ── 게이지 점수 합산(각 항 부분점수 → 만점 클램프 → 0~100) ──
    const sNatal = Math.min(W.natalDohwa, natalDohwa.length * 9);          // 도화 1개=9, 2개=18(cap)
    const sDaeun = W.daeunDohwa * daeunAct;
    const sSeun = W.seunDohwa * seunAct;
    const sWolun = Math.min(W.wolunActive, activeMonths * 5);              // 달 1개=5 …
    let sGung = 0;                                                         // 세운 개폐 > 대운 개폐(올해 트리거 우선)
    if (gSeun.open) sGung += 14; else if (gSeun.bond) sGung += 12; else if (gSeun.friction) sGung += 6;
    if (gDaeun.open) sGung += 10; else if (gDaeun.bond) sGung += 9; else if (gDaeun.friction) sGung += 5;
    sGung = Math.min(W.gungOpen, sGung);
    const sInyeon = Math.min(W.inyeonStar, inyeon);
    const score = clamp(Math.round(sNatal + sDaeun + sSeun + sWolun + sGung + sInyeon), 0, 100);

    // 경향 라벨/문구(§4 경향·단정 금지 + 처방 동반 + 전향적).
    const tendency = score >= 66 ? '열려 있어요' : score >= 34 ? '서서히 열려요' : '지금은 조용해요';
    const gaugeCaption = score >= 66
      ? '옛 인연과 다시 이어질 문이 열려 있는 흐름이에요. 마음이 있다면 지금 진심을 전해 보세요.'
      : score >= 34
        ? '문이 조금씩 열리는 중이에요. 서두르기보다 결이 무르익는 시기를 노려 보세요.'
        : '지금은 문이 잠잠한 편이에요. 무리한 연락보다 나를 가꾸며 때를 기다리는 게 좋아요.';

    // ② 배우자궁 개폐 '결' 문구(일상어)
    const gungLabel = gungOpen ? '지금 열리는 결이에요'
      : gungBond ? '지금 맺히는 결이에요'
        : gungFriction ? '지금 살짝 부딪히며 움직이는 결이에요'
          : '지금은 잠잠한 결이에요';
    const gungSub = gungOpen ? '인연의 자리가 열리는 시기예요. 다시 마주할 계기가 생기기 쉬워요.'
      : gungBond ? '인연의 자리가 이어지려는 결이에요. 관계를 다시 매듭짓기 좋은 때예요.'
        : gungFriction ? '자리가 흔들리며 움직여요. 감정보다 차분함으로 다가가면 결이 부드러워져요.'
          : '자리가 아직 고요해요. 억지로 열기보다 나를 채우며 다음 흐름을 기다려요.';

    // ③ 인연 기운 방향·계절(원국 도화 있을 때만)
    const dirSeason = natalDohwa.length ? (() => {
      const priority: PillarPos[] = ['일', '월', '년', '시'];  // 배우자궁(일)에 가까운 자리 우선
      const primary = priority.map((p) => saju.pillars?.[p]?.branch).find((b) => b && DOHWA.includes(b as Branch)) as Branch | undefined;
      const seasons = [...new Set(natalDohwa.map((x) => DOHWA_DIR[x as '子' | '午' | '卯' | '酉'].season))];
      const dir = DOHWA_DIR[(primary ?? natalDohwa[0]) as '子' | '午' | '卯' | '酉'].dir;
      return { seasons, dir };
    })() : null;

    // ④ 개운 티저 — 색/요일 중 딱 하나만 공개(방위는 잠금 → §3 방향과 중복 방지). 일간으로 결정론 선택.
    const gaeun = ELEM_GAEUN[inyeonEl];
    const teaser = ALL_STEMS.indexOf(dm) % 2 === 1
      ? { label: '인연이 열리는 요일', value: gaeun.day }
      : { label: '인연을 부르는 색', value: gaeun.color };

    return { score, tendency, gaugeCaption, gungLabel, gungSub, dirSeason, teaser };
  }, [saju]);

  const bright = d.tendency === '열려 있어요';

  return (
    <>
      {/* ① 핵심 훅 — 재회 인연 게이지(애니) */}
      <ReunionGauge score={d.score} tendency={d.tendency} bright={bright} caption={d.gaugeCaption} />

      {/* ② 배우자궁 개폐 상태 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>인연의 자리</Text>
        <Text style={[styles.gungLabel, bright && styles.gungLabelBright]}>{d.gungLabel}</Text>
        <Text style={styles.cardBody}>{d.gungSub}</Text>
      </View>

      {/* ③ 인연 기운 방향·계절(도화 있을 때만) */}
      {d.dirSeason && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>인연 기운의 방향·계절</Text>
          <Text style={styles.cardBody}>
            당신의 인연 기운은 <Text style={styles.accent}>{d.dirSeason.seasons.join('·')}</Text>에 무르익어요.
          </Text>
          <Text style={styles.cardBody}>
            연락은 <Text style={styles.accent}>{d.dirSeason.dir}</Text>이 조금 더 좋아요.
          </Text>
        </View>
      )}

      {/* ④ 재회가 열리는 달 — 기존 12개월 달력(그대로 품음) */}
      <ReunionTiming saju={saju} />

      {/* ⑤ 연락 개운 미리보기(티저) + 잠긴 가치 명시(퍼널) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>연락 개운 미리보기</Text>
        <View style={styles.teaserRow}>
          <Text style={styles.teaserLabel}>{d.teaser.label}</Text>
          <Text style={styles.teaserValue}>{d.teaser.value}</Text>
        </View>
        <Text style={styles.lockNote}>🔒 좋은 방위 · 나머지 색·요일 · 구체 실천법은 깊은 풀이에서</Text>
        <View style={styles.divider} />
        {/* 무료 vs 유료 잠긴 가치 명시(퍼널 훅 — 골드 CTA 바로 위) */}
        <Text style={styles.funnelLine}>무료로는 <Text style={styles.accent}>가능성·시기·방향</Text>까지 볼 수 있어요.</Text>
        <Text style={styles.funnelLine}>깊은 풀이에선 <Text style={styles.accent}>상대의 마음·구체 개운법·다시 이어질 이유</Text>까지 짚어 드려요.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // 공통 카드(ReunionTiming/LoveFlowGraph 와 동일 결 — sunk 배경·라운드·여백·하단 간격)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  cardTitle: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2.5), fontSize: 14 },
  cardBody: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1) },
  accent: { color: colors.ju, fontWeight: '800' },

  // ── 게이지 ──
  gaugeHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: space(2.5) },
  gaugeNum: { color: colors.ju, fontSize: 34, fontWeight: '900', letterSpacing: 0.5, lineHeight: 36 },
  gaugeUnit: { color: colors.inkFaint, fontSize: 13, fontWeight: '700', marginBottom: space(1.5) },
  tendencyWrap: { flexDirection: 'row', alignItems: 'center' },
  tendency: { ...font.caption, color: colors.inkSoft, fontWeight: '800', fontSize: 13 },
  tendencyBright: { color: colors.ju },
  spark: { color: colors.ju, fontSize: 13, marginLeft: space(1), fontWeight: '900' },
  // 트랙 + 채움
  track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.ju, minWidth: 6 },
  fillGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: radius.pill }, // 열림 상태 글로우(펄스) — 반투명 흰빛(은은하게, 과하지 않게)
  zones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(1.5) },
  zoneTx: { ...font.caption, color: colors.inkFaint, fontSize: 10 },
  gaugeCaption: { ...font.caption, color: colors.inkSoft, lineHeight: 18, marginTop: space(2.5), fontSize: 12 },

  // ── 배우자궁 개폐 ──
  gungLabel: { ...font.body, color: colors.inkSoft, fontWeight: '800', fontSize: 15, marginBottom: space(1.5) },
  gungLabelBright: { color: colors.ju },

  // ── 개운 티저 ──
  teaserRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: space(2) },
  teaserLabel: { ...font.caption, color: colors.inkFaint, fontSize: 12 },
  teaserValue: { color: colors.ju, fontSize: 16, fontWeight: '900', marginLeft: space(2) },
  lockNote: { ...font.caption, color: colors.inkFaint, fontSize: 11, lineHeight: 16 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space(3), opacity: 0.6 },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
});
