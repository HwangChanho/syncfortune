// app/src/lib/celebMatch.ts — 유명인 ↔ 나 사주 유사도 점수 (온디바이스·결정론·LLM 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 재미 톤. 단정 금지. 투자·정치 예측 절대 금지.
// ★ 가중치·기준 = daniel 검수 슬롯. Claude 초안이며 명리 stance 정교화는 daniel이 결정.
//
// 유사도 4개 축(시주 제외):
//   A. 일간(日干) 동일·오행 일치 — 핵심 정체성 공유
//   B. 일주(日柱, 천간+지지) 완전 일치 — 가장 강한 닮은꼴
//   C. 오행 분포 근접도 — 팔자(년·월·일 + 각 천간/지지) 오행 프로파일 유사도
//   D. 십신 구조 근접도 — 비겁/식상/재성/관성/인성 5그룹 분포 유사도
//
// 타임라인(대운·세운)은 비교 제외 — 생년이 달라 층이 달라 의미 없음.
// ─────────────────────────────────────────────────────────────────────────
import { computeChart } from '../engine/engine';
import { stemElement, branchElement } from '../engine/ohaeng';
import { analyzeTenGods } from '@engine/structure';
import type { ComputedChart } from '../engine/engine';
import type { CelebEntry } from './celebData';
import { celebChartInput } from './celebData';

// ── 가중치 (★daniel 검수 슬롯: 명리적 적절성 검토 후 조정) ──────────────
//   일주 > 일간·오행 동일 > 십신 구조 > 오행 분포 순으로 가중.
//   시주 제외이므로 시주 비교 없음.
const W_ILJU_FULL   = 40;   // ★ 일주(일간+일지) 완전 일치 — 가장 강한 신호
const W_ILGAN_SAME  = 20;   // ★ 일간(천간) 동일 (일주 불일치 시 단독 가산)
const W_ILGAN_EL    = 10;   // ★ 일간 오행 동일 (甲乙=木 등 같은 오행)
const W_OHAENG_DIST = 20;   // ★ 오행 분포 근접도 (나머지)
const W_TENGOD_DIST = 10;   // ★ 십신 5그룹 분포 근접도

// ── 오행 분포 추출 (년·월·일 기둥, 시주 제외) ───────────────────────────
// 천간 3(년·월·일) + 지지 3(년·월·일) = 6글자의 오행 집계
type OhaengDist = Record<'木' | '火' | '土' | '金' | '水', number>;

const PILLARS_NO_TIME = ['년', '월', '일'] as const;

function ohaengDist(chart: ComputedChart): OhaengDist {
  const d: OhaengDist = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of PILLARS_NO_TIME) {
    const pd = chart.saju.pillars[p];
    const se = stemElement(pd.stem) as keyof OhaengDist;
    const be = branchElement(pd.branch) as keyof OhaengDist;
    if (se in d) d[se]++;
    if (be in d) d[be]++;
  }
  return d;
}

/**
 * 두 오행 분포의 유사도 (0~1).
 * 코사인 유사도: 총 6글자 기준이라 각도 차이가 분포 전체 모양을 잘 잡음.
 * 공집합(둘 다 0인 오행)은 자동으로 기여 0 → 문제 없음.
 */
function ohaengSim(a: OhaengDist, b: OhaengDist): number {
  const keys: (keyof OhaengDist)[] = ['木', '火', '土', '金', '水'];
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    dot += a[k] * b[k];
    na += a[k] * a[k];
    nb += b[k] * b[k];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ── 십신 5그룹 분포 추출 (년·월·일 기둥 기반, 시주 제외) ─────────────
// analyzeTenGods는 4기둥 기준이지만 유사도만 필요하므로 전체 계산 후 사용.
// (4기둥 전체 vs 시주 제외 차이: 시주 포함 쪽이 정확하나 비교 대상도 시주=미상이라 동등히 계산)
type TenGodDist = Record<string, number>; // 비겁·식상·재성·관성·인성

function tenGodDist(chart: ComputedChart): TenGodDist {
  // analyzeTenGods의 distribution 사용(5그룹)
  return chart.tenGods.distribution;
}

/**
 * 두 십신 분포의 유사도 (0~1). 코사인 유사도.
 * 부재·과다 구조 차이를 자연스럽게 반영.
 */
function tenGodSim(a: TenGodDist, b: TenGodDist): number {
  const keys = ['비겁', '식상', '재성', '관성', '인성'];
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    const av = a[k] ?? 0, bv = b[k] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ── 유사도 상세 (매칭 이유 생성용) ──────────────────────────────────────
export type CelebMatchReason = {
  type:
    | 'ilju_exact'      // 일주 완전 일치 (가장 강한 공통점)
    | 'ilgan_same'      // 일간 동일 (같은 천간·정체성)
    | 'ilgan_elem'      // 일간 오행 동일 (같은 뿌리 오행)
    | 'ohaeng_close'    // 오행 분포 유사 (비슷한 에너지 조성)
    | 'tengod_close'    // 십신 구조 유사 (비슷한 삶의 패턴)
    | 'dominant_match'; // 지배 오행 일치 (가장 강한 오행이 같음)
  label: string;   // "일주 동일(庚申)" 등 — UI 뱃지·문구에 사용
  strength: '강' | '중' | '약';
};

// ── 지배 오행(가장 많이 나타난 오행) ─────────────────────────────────
function dominantElement(dist: OhaengDist): string {
  return Object.entries(dist).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';
}

// ── 단일 유명인 점수 계산 ─────────────────────────────────────────────
export type CelebMatchResult = {
  celeb: CelebEntry;
  score: number;          // 0~100 (정수)
  reasons: CelebMatchReason[];
};

/** 나의 chart vs 유명인 chart → 유사도 점수 + 이유 */
function scoreSingle(myChart: ComputedChart, celebChart: ComputedChart, celeb: CelebEntry): CelebMatchResult {
  const reasons: CelebMatchReason[] = [];
  let score = 0;

  const myDay = myChart.saju.pillars['일'];
  const cDay = celebChart.saju.pillars['일'];

  // A. 일주(日柱) 완전 일치 — 천간+지지 둘 다 같아야 함
  const iljuFull = myDay.stem === cDay.stem && myDay.branch === cDay.branch;
  if (iljuFull) {
    score += W_ILJU_FULL;
    reasons.push({ type: 'ilju_exact', label: `일주 동일(${myDay.stem}${myDay.branch})`, strength: '강' });
  } else {
    // B. 일간 동일 (일주 불일치 시 단독 가산)
    const ilganSame = myDay.stem === cDay.stem;
    if (ilganSame) {
      score += W_ILGAN_SAME;
      reasons.push({ type: 'ilgan_same', label: `일간 동일(${myDay.stem})`, strength: '강' });
    } else {
      // C. 일간 오행 동일 (甲=乙=木 등)
      const myEl = stemElement(myDay.stem);
      const cEl = stemElement(cDay.stem);
      if (myEl === cEl) {
        score += W_ILGAN_EL;
        reasons.push({ type: 'ilgan_elem', label: `일간 오행 동일(${myEl})`, strength: '중' });
      }
    }
  }

  // D. 오행 분포 유사도
  const myOh = ohaengDist(myChart);
  const cOh = ohaengDist(celebChart);
  const ohSim = ohaengSim(myOh, cOh);
  const ohPts = Math.round(ohSim * W_OHAENG_DIST);
  score += ohPts;
  if (ohSim > 0.85) reasons.push({ type: 'ohaeng_close', label: `오행 구성 매우 유사`, strength: '강' });
  else if (ohSim > 0.65) reasons.push({ type: 'ohaeng_close', label: `오행 구성 비슷`, strength: '중' });

  // 지배 오행 일치 보너스 (★단순 가산: 오행 분포 가장 많은 오행이 같을 때)
  const myDom = dominantElement(myOh);
  const cDom = dominantElement(cOh);
  if (myDom && myDom === cDom && !reasons.some((r) => r.type === 'ohaeng_close' && r.strength === '강')) {
    score += 5; // 소량 보너스
    reasons.push({ type: 'dominant_match', label: `주된 기운 동일(${myDom})`, strength: '약' });
  }

  // E. 십신 구조 유사도 (인생 패턴)
  const myTg = tenGodDist(myChart);
  const cTg = tenGodDist(celebChart);
  const tgSim = tenGodSim(myTg, cTg);
  const tgPts = Math.round(tgSim * W_TENGOD_DIST);
  score += tgPts;
  if (tgSim > 0.85) reasons.push({ type: 'tengod_close', label: `십신 구조 매우 유사`, strength: '강' });
  else if (tgSim > 0.65) reasons.push({ type: 'tengod_close', label: `십신 패턴 비슷`, strength: '중' });

  // 최종 클램프 [0, 100]
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return { celeb, score: finalScore, reasons };
}

// ── 전체 랭킹 ───────────────────────────────────────────────────────────
/**
 * 나의 computedChart vs 전체 유명인 → 유사도 내림차순 정렬.
 * 각 유명인 chart는 인자로 받아 캐시는 호출처(celebMatch hook)에서 관리.
 * @param myChart — computeChart(내 ChartInput) 결과
 * @param celebs  — CelebEntry 배열 (CELEB_DB)
 * @returns 점수 내림차순 CelebMatchResult[]
 */
export function rankCelebs(myChart: ComputedChart, celebs: CelebEntry[]): CelebMatchResult[] {
  return celebs
    .map((c) => {
      const cc = computeChart(celebChartInput(c));
      return scoreSingle(myChart, cc, c);
    })
    .sort((a, b) => b.score - a.score);
}

// ── 룰 기반 매칭 문구 생성 ────────────────────────────────────────────
// ⚠️ 재미 톤, 추정 허용, 단정 금지 (★§4: 부정 증폭 금지·투자/정치 예측 금지)
/**
 * 유사도 결과 → "당신과 ○○은 △△가 닮았다" 패턴 룰 문구 1~2문장.
 * reasons 중 가장 강한 신호를 우선.
 */
export function matchHeadline(result: CelebMatchResult): string {
  const { celeb, reasons } = result;
  const top = reasons[0];

  if (!top) {
    return `${celeb.name}과(와) 사주 구조를 견주어봤어요. 닮은 면보다 차이에서 배울 게 많은 인연이에요.`;
  }

  switch (top.type) {
    case 'ilju_exact':
      return `${celeb.name}과(와) 일주(${top.label.match(/\(.+\)/)?.[0] ?? ''})가 똑같아요. 사주 중 가장 핵심인 일주가 겹치는 건 드문 인연입니다.`;
    case 'ilgan_same': {
      const stem = top.label.match(/\((.+)\)/)?.[1] ?? '';
      return `두 분 모두 일간이 ${stem}이에요. 핵심 기질과 삶을 대하는 에너지의 뿌리가 닮았을 수 있어요.`;
    }
    case 'ilgan_elem': {
      const el = top.label.match(/\((.+)\)/)?.[1] ?? '';
      return `일간 오행이 모두 ${el}이에요. 같은 오행 계열의 기운이 흐르는 사주예요.`;
    }
    case 'ohaeng_close':
      return `팔자 오행 구성이 비슷해요. 비슷한 에너지 조합이 삶의 방향이나 기질에 공통점을 만들 수 있어요.`;
    case 'dominant_match': {
      const el = top.label.match(/\((.+)\)/)?.[1] ?? '';
      return `두 분 사주에서 ${el} 기운이 가장 두드러져요. 같은 핵심 에너지를 가진 인연이에요.`;
    }
    case 'tengod_close':
      return `십신 구조가 닮아 있어요. 관계·행동·역할 방식의 패턴에 비슷한 면이 있을 수 있어요.`;
    default:
      return `${celeb.name}과(와) 사주 에너지를 비교해봤어요. 서로 다른 면에서 배울 게 있는 흥미로운 비교예요.`;
  }
}

/**
 * 점수 → 닮음 등급 라벨 (재미·긍정 톤)
 * ★daniel 검수: 컷오프·라벨 문구 조정.
 */
export function matchGrade(score: number): { label: string; emoji: string; color: string } {
  if (score >= 75) return { label: '사주 동류', emoji: '✨', color: '#C9A14A' };
  if (score >= 55) return { label: '닮은 기운', emoji: '💫', color: '#8A7FBF' };
  if (score >= 35) return { label: '공통 에너지', emoji: '🔮', color: '#5A8A7F' };
  return { label: '다른 빛깔', emoji: '🌗', color: '#7A6A5A' };
}
