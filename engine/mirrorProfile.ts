// engine/mirrorProfile.ts — R60 경상명식 L2 프로파일·GAP 산출
// ─────────────────────────────────────────────────────────────────────────
// 스펙 R60-MIRROR-ROMANCE.md §3(프로파일 추출) · §3.3(GAP)
//
// ★경상명식을 **사람의 사주로 통변하지 않는다**(스펙 §3 첫 줄). 인물 스타일 벡터만 뽑는다.
//   그래서 여기서 나오는 건 '해석 문장'이 아니라 **차원별 코드값**이고,
//   문장화(EEL)는 L2 프롬프트가 이 코드를 받아서 한다. 이 파일은 전부 결정론이다.
//
// ★★기존 엔진 표를 재사용한다(tenGod·HIDDEN·STEM_ELEM·BRANCH_MAIN).
//   경상명식은 생년월일이 없고 4주 간지만 있으므로 buildSajuChart 를 쓸 수 없다 —
//   대신 순수 함수만 조합해 필요한 축을 직접 계산한다.
// ─────────────────────────────────────────────────────────────────────────
import { tenGod, STEM_ELEM, BRANCH_MAIN } from './saju';
import { detectInteractionsAmong } from './structure';
import type { Stem, Element, TenGod, PillarPos, ChartPosition } from '../spec/chart';
import type { MirrorChart } from './mirrorRomance';

const POS: PillarPos[] = ['년', '월', '일', '시'];

/** 십신 → 5군(비겁·식상·재성·관성·인성) */
const GROUP_OF: Record<TenGod, string> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성',
  편인: '인성', 정인: '인성',
};
const GROUPS = ['비겁', '식상', '재성', '관성', '인성'] as const;
type Group = (typeof GROUPS)[number];

/** 조후 지수 — 한난(寒暖). +면 따뜻(火·木 계열), −면 서늘(水·金). 스펙 D3_TEMP. */
const TEMP_W: Record<Element, number> = { 火: 1, 木: 0.4, 土: 0, 金: -0.4, 水: -1 };

export type MirrorProfile = {
  ilgan: Stem;
  ilganElement: Element;
  ilganYang: boolean;
  /** D1 — 일간 오행(기질의 뼈대) */
  D1_TEMPER: Element;
  /** D2 — 월지 본기 십신(사회적 상). 격 이름이 아니라 축만 — 격국 판정은 원국 전용이다. */
  D2_ROLE: TenGod;
  /** D3 — 조후 지수(-1 ~ +1) */
  D3_TEMP: number;
  /** D4 — 십신 5군 분포(정규화 벡터) */
  D4_BEHAVIOR: Record<Group, number>;
  /** D4 상위 2군(편중) */
  D4_TOP2: Group[];
  /** D5 — 원국 내 합충형해 라벨 */
  D5_RISK: string[];
  /** D7 — 결핍 투영: 원국에 천간 부재였던 오행이 경상 천간에 뜬 것(스펙 §7 관측·§9 승격 검토) */
  D7_DEFICIT_PROJECTION: Element[];
  /** ★천간(일간 제외) 십신 — v0.2.0 D0 대조(A4·A6)가 **천간 기준**이다.
   *   스펙 §7.1: "丑중 편인·식신 ↔ 癸水 편인 兩透" — 지지까지 합산하면 이 대조가 흐려진다. */
  stemTenGods: TenGod[];
};

/** 경상명식 4주 → 프로파일(결정론). @param natalStems 원국 천간(결핍 투영 판정용) */
export function profileOf(c: MirrorChart, natalStems?: Stem[]): MirrorProfile {
  const day = c['일'].stem;

  // D4 — 십신 5군 분포. 천간 3자리(일간 제외) + 지지 본기 4자리.
  const counts: Record<Group, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const p of POS) {
    if (p !== '일') counts[GROUP_OF[tenGod(day, c[p].stem)] as Group] += 1;
    counts[GROUP_OF[tenGod(day, BRANCH_MAIN[c[p].branch])] as Group] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const D4: Record<Group, number> = { ...counts };
  for (const g of GROUPS) D4[g] = counts[g] / total;
  const D4_TOP2 = [...GROUPS].sort((a, b) => counts[b] - counts[a]).slice(0, 2);

  // D3 — 조후: 8자 오행의 가중 평균(천간 + 지지 본기)
  let temp = 0, n = 0;
  for (const p of POS) {
    temp += TEMP_W[STEM_ELEM[c[p].stem]]; n++;
    temp += TEMP_W[STEM_ELEM[BRANCH_MAIN[c[p].branch]]]; n++;
  }
  const D3 = Math.round((temp / n) * 100) / 100;

  // D5 — 합충형해(기존 결정론 재사용). 경상명식은 시간층이 없으므로 원국 4주끼리만.
  const items = POS.map((p) => ({ pos: p as ChartPosition, stem: c[p].stem, branch: c[p].branch }));
  const D5 = detectInteractionsAmong(items).map((i) => i.detail);

  // D7 — 결핍 투영: 원국 천간에 없던 오행이 경상 천간에 떴나
  let D7: Element[] = [];
  if (natalStems?.length) {
    const natalEls = new Set(natalStems.map((s) => STEM_ELEM[s]));
    const mirrorEls = new Set(POS.map((p) => STEM_ELEM[c[p].stem]));
    D7 = [...mirrorEls].filter((e) => !natalEls.has(e));
  }

  return {
    ilgan: day,
    ilganElement: STEM_ELEM[day],
    ilganYang: ['甲', '丙', '戊', '庚', '壬'].includes(day),
    D1_TEMPER: STEM_ELEM[day],
    D2_ROLE: tenGod(day, BRANCH_MAIN[c['월'].branch]),
    D3_TEMP: D3,
    D4_BEHAVIOR: D4,
    D4_TOP2,
    D5_RISK: D5,
    D7_DEFICIT_PROJECTION: D7,
    stemTenGods: POS.filter((q) => q !== '일').map((q) => tenGod(day, c[q].stem)),
  };
}

// ── GAP 산출(스펙 §3.3) ───────────────────────────────────────────────────
const ELEM_ORDER: Element[] = ['木', '火', '土', '金', '水'];

/** 오행 거리 — 같음 0 / 상생 0.2 / 무관 0.5 / 상극 1.0 (스펙 가중치 표). */
export function elementDistance(a: Element, b: Element): number {
  if (a === b) return 0;
  const ia = ELEM_ORDER.indexOf(a), ib = ELEM_ORDER.indexOf(b);
  const d = (ib - ia + 5) % 5;
  if (d === 1 || d === 4) return 0.2;   // 상생(어느 방향이든 이웃)
  return d === 2 || d === 3 ? 1.0 : 0.5; // 상극(2칸)
}

/** 십신 벡터 코사인 거리(0~1). */
function cosineDistance(a: Record<Group, number>, b: Record<Group, number>): number {
  let dot = 0, na = 0, nb = 0;
  for (const g of GROUPS) { dot += a[g] * b[g]; na += a[g] ** 2; nb += b[g] ** 2; }
  if (na === 0 || nb === 0) return 1;
  return Math.max(0, Math.min(1, 1 - dot / (Math.sqrt(na) * Math.sqrt(nb))));
}

export type NarrativeKey = 'ALIGNED' | 'TENSIONED' | 'INVERTED';
export type GapReport = {
  gap_score: number;
  narrative_key: NarrativeKey;
  divergent_dims: string[];
  aligned_dims: string[];
  axis_bonus: boolean;   // 음간 남명 / 양간 여명 보정이 걸렸나
};

/**
 * 이상형(합경) vs 실배우자(충경) 차이.
 * @param sex 명주 성별 — 스펙 §1.1: 음간 남명·양간 여명은 합신이 배우자성이 아니라
 *   이상형이 '자기 투사'로 왜곡된다 → gap_score +0.10 보정.
 */
export function gapOf(ideal: MirrorProfile, real: MirrorProfile, sex?: '남' | '여'): GapReport {
  const dTemper = elementDistance(ideal.D1_TEMPER, real.D1_TEMPER);
  const dTemp = Math.min(1, Math.abs(ideal.D3_TEMP - real.D3_TEMP) / 2);   // -1~+1 범위 → 0~1 정규화
  const dBehavior = cosineDistance(ideal.D4_BEHAVIOR, real.D4_BEHAVIOR);
  const dRole = ideal.D2_ROLE === real.D2_ROLE ? 0 : 1;
  const dRisk = ideal.D5_RISK.join('|') === real.D5_RISK.join('|') ? 0 : 1;

  const W = { temper: 0.25, temp: 0.25, behavior: 0.30, role: 0.10, risk: 0.10 };
  let score = dTemper * W.temper + dTemp * W.temp + dBehavior * W.behavior + dRole * W.role + dRisk * W.risk;

  // ★§1.1 보정 — 명주 일간 음양 기준(경상 일간이 아니라 **원국 일간**의 음양이 기준이다).
  //   ideal 은 합경이므로 ideal.ilgan 의 음양은 원국 일간의 **반대**다(합은 음양을 뒤집는다).
  //   따라서 원국 일간 음양 = !ideal.ilganYang.
  const natalYang = !ideal.ilganYang;
  const axis_bonus = (sex === '남' && !natalYang) || (sex === '여' && natalYang);
  if (axis_bonus) score += 0.10;

  score = Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
  const narrative_key: NarrativeKey = score < 0.30 ? 'ALIGNED' : score <= 0.60 ? 'TENSIONED' : 'INVERTED';

  const divergent: string[] = [];
  const aligned: string[] = [];
  ([['D1_TEMPER', dTemper], ['D3_TEMP', dTemp], ['D4_BEHAVIOR', dBehavior], ['D2_ROLE', dRole], ['D5_RISK', dRisk]] as [string, number][])
    .forEach(([k, v]) => (v >= 0.5 ? divergent : aligned).push(k));

  return { gap_score: score, narrative_key, divergent_dims: divergent, aligned_dims: aligned, axis_bonus };
}
