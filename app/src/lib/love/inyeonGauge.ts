// app/src/lib/love/inyeonGauge.ts — 인연 가능성 게이지 결정론 엔진 (온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스 인코딩(발명 아님 — 표준 통설 테이블 + 엔진 tenGod/HIDDEN 재사용, LLM 미사용).
//   원래 ReunionRich(재회 무료 리치)에 인라인돼 있던 '인연 게이지' 산출 로직을 이 모듈로 단일화한다.
//   → 재회(ReunionRich)와 애정흐름(love.tsx)이 같은 신호·같은 가중치로 게이지를 산출(중복 제거·단일 소스).
//
// ▶ 게이지가 합산하는 신호(전부 결정론, daniel APPROVED = love-timing-baeuja 스탠스):
//   ① 원국 도화(끌림 기질)               — 원국 지지의 도화(왕지) 개수.
//   ② 대운(10년 배경)의 도화 발동         — 현재 대운 지지가 원국 도화를 충/합/자체 왕지로 얼마나 깨우나.
//   ③ 세운(올해)의 도화 발동              — 올해 세운 지지의 도화 발동(올해 트리거 = 가중 높게).
//   ④ 올해 '인연이 열리는 달' 수          — 원국 도화의 충 짝 월건(절기 고정 = 매년 결정론).
//   ⑤ 배우자궁(일지) 개폐                 — 일지 vs 현재 대운·세운의 충(열림)/합(맺힘)/형(마찰). ★핵심 지렛대.
//   ⑥ 인연星(남명 재성/여명 관성) 발동    — 현재 대운·세운 천간/지장간에 배우자성이 뜨는가 + 강약.
//
// ▶ 결정론 근거: 표준 합충/형/도화 테이블(통설) + 엔진 tenGod·HIDDEN(지장간) 재사용. 발명 아님(룰 산출만).
//   ★가중치는 아래 W 블록(daniel 검수/튜닝 슬롯) — ReunionRich가 쓰던 값 그대로 이관(결과 동일 보장).
// ─────────────────────────────────────────────────────────────────────────
import { tenGod, HIDDEN } from '@engine/saju';                        // 십신·지장간 표준표(엔진 재사용)
import type { SajuChart, Branch, Stem, Element, PillarPos, TenGod } from '@spec/chart';

// ── 표준 통설 테이블 (engine/structure 비공개 → 로컬 정의. LoveFlowGraph/ReunionRich와 동일 값·결). ★daniel 검수 ──
export const DOHWA: Branch[] = ['子', '午', '卯', '酉'];                                                          // 도화 = 왕지(끌림의 기운)
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]; // 6충(개방·발동)
const SIXHE: [Branch, Branch][] = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']]; // 육합(결속)
const SANHE: Branch[][] = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];             // 삼합 3국
const WANGZHI: Branch[] = ['子', '午', '卯', '酉'];                                                              // 왕지(반합 성립 핵심)
// 형(刑) — 삼형(둘만 만나도 부분 성립)·상형·자형(같은 글자 만남). 배우자궁 '마찰' 판정용(표준 통설).
const HYEONG_TRIO: Branch[][] = [['寅', '巳', '申'], ['丑', '戌', '未']];
const HYEONG_PAIR: [Branch, Branch][] = [['子', '卯']];
const SELF_HYEONG: Branch[] = ['辰', '午', '酉', '亥'];
// 오행 상극(A극B) — 배우자성 오행 산출용(재성=일간이 극 / 관성=일간을 극).
const CONTROLS: Record<Element, Element> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
// 지지 → 월건(節氣) 월 번호(월운 발동 달 계산 — ReunionTiming과 동일 결정론).
const BRANCH_MONTH: Record<Branch, number> = { 寅: 1, 卯: 2, 辰: 3, 巳: 4, 午: 5, 未: 6, 申: 7, 酉: 8, 戌: 9, 亥: 10, 子: 11, 丑: 12 };

// 두 글자가 테이블의 한 쌍(순서 무관)인가
const inPair = <T extends string>(list: [T, T][], a: T, b: T) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
// 반합: 대운/세운 지지 × 일지가 같은 삼합국이고 한쪽이 왕지(결속). ★daniel 검수(왕지 조건)
const halfSanhe = (a: Branch, b: Branch) => a !== b && SANHE.some((g) => g.includes(a) && g.includes(b)) && (WANGZHI.includes(a) || WANGZHI.includes(b));
// 형(마찰) 성립 여부
const inHyeong = (a: Branch, b: Branch): boolean => {
  if (a === b) return SELF_HYEONG.includes(a);                        // 자형 = 같은 글자
  if (inPair(HYEONG_PAIR, a, b)) return true;                         // 상형(子卯)
  return HYEONG_TRIO.some((g) => g.includes(a) && g.includes(b));     // 삼형(둘만 만나도 부분)
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
//   ★export(2026-07-16): 짝사랑 timing(timingSignals.crushTiming)이 **이 함수를 그대로 재사용**한다.
//     daniel 지시 = "재회/짝사랑 판정 기준이 미묘하게 어긋나면 유저가 두 기능을 비교했을 때 모순으로 보인다 →
//     이미 있는 일지 개폐 판정 함수를 import 해 쓸 것". 운지지 자리에 **월운 지지**를 넣어도 판정 규칙은 동일하다.
export const gungState = (dayB: Branch, unB: Branch) => ({
  open: inPair(CHONG, dayB, unB),
  bond: inPair(SIXHE, dayB, unB) || halfSanhe(dayB, unB),
  friction: inHyeong(dayB, unB),
});

// ══ ★daniel 검수: 인연 게이지 가중치(스탠스 · 전부 튜닝 슬롯). 각 항의 만점(부분점수). 합계 = 100 ══
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

/** 게이지 색·글로우를 가르는 톤(점수 밴드). open=활짝(글로우 on) / warming=서서히 / quiet=잠잠. */
export type GaugeTone = 'open' | 'warming' | 'quiet';

/** 점수(0~100) → 톤. 66↑ open / 34↑ warming / 그 외 quiet (ReunionRich 기존 경계와 동일). */
export function toneFromScore(score: number): GaugeTone {
  return score >= 66 ? 'open' : score >= 34 ? 'warming' : 'quiet';
}

/** computeInyeonSignals 결과 — 게이지 점수 + 톤 + 하위 신호(호출부가 문구를 얹을 때 재사용). */
export interface InyeonSignals {
  score: number;           // 0~100 결정론 점수
  tone: GaugeTone;         // 점수 밴드(색·글로우)
  natalDohwa: Branch[];    // 원국 도화(방향·계절 문구용)
  gungOpen: boolean;       // 배우자궁 '열림'(충) — 세운/대운 중 하나라도 성립
  gungBond: boolean;       // 배우자궁 '맺힘'(합) — 열림이 아닐 때만
  gungFriction: boolean;   // 배우자궁 '마찰'(형) — 열림·맺힘이 아닐 때만
  inyeonEl: Element;       // 배우자성(인연星) 오행(개운 티저용)
  dm: Stem;                // 일간(개운 티저 짝/홀 선택용)
}

/** sex/timeUnknown 은 SajuChart에 없는 부가정보 — 호출부가 넘기거나 saju에 병합된 값을 읽는다. */
type Opts = { sex?: string; timeUnknown?: boolean };

/**
 * 인연 게이지 신호 산출(결정론) — 재회·애정 공통. ReunionRich가 인라인으로 쓰던 계산을 그대로 이관.
 * @param saju 대표 명식의 사주(원국 + 현재 대운/세운). 결정론 산출값.
 * @param opts sex(배우자성 매핑: 여=관성/남=재성) · timeUnknown(시각 미상 → 시지 제외). 미전달 시 saju 병합값을 읽음.
 * @returns 점수·톤 + 하위 신호(문구는 호출부가 얹음 — 재회/애정 카피가 다르므로 여기서 하드코딩하지 않음).
 */
export function computeInyeonSignals(saju: SajuChart, opts?: Opts): InyeonSignals {
  // 시각 미상이면 시지(時支) 제외(잘못된 timing 방지) — 코드베이스 관례(FreeFunnel이 saju에 병합).
  const timeUnknown = opts?.timeUnknown ?? (saju as any)?.timeUnknown === true;
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const natalBranches = posList.map((p) => saju.pillars?.[p]?.branch).filter(Boolean) as Branch[];
  const natalDohwa = DOHWA.filter((x) => natalBranches.includes(x));

  const dm = saju.dayMaster.stem;
  const dayEl = saju.dayMaster.element;
  const dayBranch = saju.pillars['일'].branch;                        // 일지 = 배우자궁

  // 배우자성(인연星): 남명=재성 / 여명=관성. 성별은 opts.sex(love) 또는 saju.sex(FreeFunnel 병합) — 없으면 남명 재성 기본.
  //   ★daniel 검수(배우자星 매핑) — LoveFlowGraph와 동일 스탠스.
  const isFemale = (opts?.sex ?? (saju as any)?.sex) === '여';
  const targetGods: TenGod[] = isFemale ? ['정관', '편관'] : ['정재', '편재'];
  const isTarget = (s: Stem) => targetGods.includes(tenGod(dm, s));
  const branchHasTarget = (b: Branch) => HIDDEN[b].some((h) => isTarget(h.stem));
  // 배우자성 오행(개운 티저용): 재성=일간이 극하는 오행 / 관성=일간을 극하는 오행.
  const inyeonEl: Element = isFemale
    ? (Object.keys(CONTROLS) as Element[]).find((k) => CONTROLS[k] === dayEl)!  // 관성(극 일간)
    : CONTROLS[dayEl];                                                          // 재성(일간이 극)

  const daeun = saju.currentLuck;  // 현재 대운(엔진 산출, 폴백 포함 non-null)
  const seun = saju.annual;        // 현재 세운(올해)

  // ④ 올해 '인연이 열리는 달' 수 — 각 원국 도화의 충 짝 월건(절기 고정 = 매년 결정론, ReunionTiming과 동일).
  const monthSet = new Set<number>();
  natalDohwa.forEach((x) => {
    const partner = CHONG.find(([a, b]) => a === x || b === x);
    if (partner) { const p = partner[0] === x ? partner[1] : partner[0]; monthSet.add(BRANCH_MONTH[p]); }
  });
  const activeMonths = monthSet.size;

  // ②③ 운 도화 발동 강도 + ⑤ 배우자궁 개폐
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

  return { score, tone: toneFromScore(score), natalDohwa, gungOpen, gungBond, gungFriction, inyeonEl, dm };
}

/** 애정(love) 게이지 표시 데이터 — PossibilityGauge에 바로 넘기는 { score, tone, label, caption }. */
export interface LoveGauge {
  score: number;
  tone: GaugeTone;
  label: string;    // 경향 라벨(열려 있어요 / 서서히 열려요 / 지금은 조용해요)
  caption: string;  // 한 줄 일상어 읽기(전향적·처방 동반, 단정 금지)
}

/**
 * 애정흐름(love.tsx) 인연 가능성 게이지 — computeInyeonSignals 점수에 애정 카피를 입힌다(재회와 신호 동일·문구만 다름).
 *   §4 경향·단정 금지 + 처방 동반 + 전향적. 화면 텍스트에 한자·명리 용어 노출 금지(일상어).
 * @param saju 대표 명식의 사주(원국 + 현재 대운/세운).
 * @param opts sex(배우자성) · timeUnknown(시각 미상). love.tsx는 savedChart.input에서 넘긴다.
 */
export function loveInyeonGauge(saju: SajuChart, opts?: Opts): LoveGauge {
  const { score, tone } = computeInyeonSignals(saju, opts);
  const label = tone === 'open' ? '열려 있어요' : tone === 'warming' ? '서서히 열려요' : '지금은 조용해요';
  const caption = tone === 'open'
    ? '지금 인연 기운이 활짝 열려, 새로운 만남이 무르익기 좋은 흐름이에요. 좋은 자리에 나를 두어 보세요.'
    : tone === 'warming'
      ? '지금 인연 기운이 서서히 데워지고 있어요. 자연스러운 자리에 나를 두면 만남이 한 걸음씩 가까워져요.'
      : '지금은 인연 기운이 차분한 편이에요. 나를 가꾸며 흐름이 무르익는 때를 준비하면 좋아요.';
  return { score, tone, label, caption };
}
