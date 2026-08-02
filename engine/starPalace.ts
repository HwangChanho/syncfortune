// engine/starPalace.ts — R60 v0.2.0 §2 성궁론(星宮論) 1차 판정
// ─────────────────────────────────────────────────────────────────────────
// 스펙: R60-MIRROR-ROMANCE v0.2.0 (원문 rule_id=R48 · 프로젝트 번호는 **R60**.
//   초안의 R48 은 기존 R48(합충 < 생극제화)과 겹쳐 daniel 2026-07-28 재배정 완료.)
//
// ★v0.2.0 의 핵심 설계 변경:
//   경상명식(8자 전체 치환)은 **고전 원전에 없는 파생 기법**이고, 성궁론(재성=星 / 일지=宮)은 **정통**이다.
//   v0.1.0 은 파생 기법이 단독으로 서 있었다 → v0.2.0 에서 **정통이 상위 판정자, 파생이 하위 묘사자**로 뒤집는다.
//   그래서 이 모듈은 **경상명식 없이 단독으로 동작해야 한다**(스펙 §10 구현 순서).
//
//   星(성) = 배우자를 나타내는 십신(남명 재성 · 여명 관성) → **원하는 상, 욕망의 벡터**(원국 상수)
//   宮(궁) = 일지, 배우자가 앉는 자리                      → **실제로 오는 사람**(충·형·합으로 열림)
//
// ★기존 엔진 표를 재사용한다(HIDDEN·SIXHE·CHONG·tenGod). 표를 새로 만들면 한쪽만 고쳐지는 날 갈라진다.
// ─────────────────────────────────────────────────────────────────────────
import { HIDDEN, BRANCH_MAIN, tenGod } from './saju';
import { SIXHE, CHONG, SANHE, WANGZHI } from './structure';
import type { Stem, Branch, Element, TenGod, PillarPos } from '../spec/chart';

/** 형(刑) — 성궁 이중관계(S5) 판정에 쓴다. 삼형·자형 포함. */
const HYEONG: [Branch, Branch][] = [
  ['寅', '巳'], ['巳', '申'], ['申', '寅'],      // 무은지형
  ['丑', '戌'], ['戌', '未'], ['未', '丑'],      // 지세지형
  ['子', '卯'],                                   // 무례지형
];

export type Relation = 'chung' | 'hap' | 'hyeong';
export type Combo = { with: Branch; kind: Relation; to?: Element };

export type Pillars = Record<PillarPos, { stem: Stem; branch: Branch }>;

const POS: PillarPos[] = ['년', '월', '일', '시'];

/** 삼합의 두 글자(반합)인가 — **왕지(子午卯酉)를 포함해야** 성립(기존 엔진과 같은 기준). */
function isBanhap(a: Branch, b: Branch): Element | undefined {
  if (a === b) return undefined;                       // 같은 글자 = 자형이지 반합 아님
  const g = SANHE.find(([x, y, z]) => [x, y, z].includes(a) && [x, y, z].includes(b));
  if (!g) return undefined;
  return (WANGZHI.includes(a) || WANGZHI.includes(b)) ? g[3] : undefined;
}

/**
 * 두 지지의 관계(합/충/형). 없으면 null.
 * ★반합도 **합**으로 본다(daniel 스펙 PILOT_01 픽스처가 `palace.combos: [酉丑반합, …]` 으로 명시).
 *   육합만 보면 酉丑 을 놓쳐 S5(星/宮 이중관계) 피벗이 엉뚱한 글자로 잡힌다 — 실제로 그랬다.
 */
export function relationOf(a: Branch, b: Branch): Relation | null {
  if (CHONG.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 'chung';
  if (SIXHE.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 'hap';
  if (isBanhap(a, b)) return 'hap';
  if (HYEONG.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return 'hyeong';
  return null;
}

/** 합의 귀결 오행(육합 화 · 반합 국). 없으면 undefined. */
function hapTo(a: Branch, b: Branch): Element | undefined {
  const six = SIXHE.find(([x, y]) => (x === a && y === b) || (x === b && y === a))?.[2];
  return six ?? isBanhap(a, b);
}

// ── 星 (배우자성) ────────────────────────────────────────────────────────
export type StarProfile = {
  /** 가장 유력한 배우자성이 앉은 지지(없으면 null = 원국 지지에 배우자성 없음) */
  primaryBranch: Branch | null;
  /** 合化 **이전**의 星 십신(A2 대조용 — 귀결 십신은 transformedTenGod) */
  primaryTenGod?: TenGod;
  starTenGods: TenGod[];                 // 이 명식에서 배우자성으로 보는 십신(남=재성·여=관성)
  strength: number;                      // 0~1 — 통근·투출 기준 근사
  combos: Combo[];                       // 星이 맺는 합충형
  transformedTo?: Element;               // ★S1 합화 시 귀결 오행
  transformedTenGod?: TenGod;            // 귀결 오행이 일간에게 무슨 십신인가(경고 문구의 근거)
  contaminatedBy: TenGod[];              // ★S2 재인합 등 오염
};

/** 오행 → 대표 천간(양간/음간). 합화 귀결의 십신을 정할 때 쓴다. */
const ELEM_STEMS: Record<Element, [Stem, Stem]> = {
  木: ['甲', '乙'], 火: ['丙', '丁'], 土: ['戊', '己'], 金: ['庚', '辛'], 水: ['壬', '癸'],
};

/**
 * 합화 귀결 오행이 일간에게 무슨 십신인가.
 * ★★음양을 임의로 정하지 않는다 — **원국 천간에 실재하는 글자를 우선** 본다.
 *   PILOT_01: 卯戌합화 火 인데 원국 천간에 丁(음화)이 둘 투간해 있다 →
 *   그 火 는 丁 으로 발현되므로 辛 일간에게 **편관**이다(양간 丙 을 쓰면 정관이 되어 스펙과 어긋난다).
 *   원국에 그 오행의 천간이 없으면 양간을 대표로 쓴다(폴백).
 */
function transformedTenGodOf(elem: Element, day: Stem, p: Pillars): TenGod {
  const [yang, yin] = ELEM_STEMS[elem];
  const inChart = POS.map((q) => p[q].stem).find((st) => st === yin || st === yang);
  return tenGod(day, inChart ?? yang);
}

/**
 * ★R48-S1/S2 — 星 추출 + 합화 추적 + 재인합 오염 탐지.
 * @param sex 남=재성(정재·편재) · 여=관성(정관·편관)이 배우자성
 */
export function extractStar(p: Pillars, sex: '남' | '여'): StarProfile {
  const day = p['일'].stem;
  const starSet: TenGod[] = sex === '남' ? ['정재', '편재'] : ['정관', '편관'];

  // 지지 중 본기가 배우자성인 자리를 후보로. 월지(월령)에 가중을 준다.
  const cands: { branch: Branch; pos: PillarPos; score: number }[] = [];
  for (const pos of POS) {
    const br = p[pos].branch;
    const tg = tenGod(day, BRANCH_MAIN[br]);
    if (!starSet.includes(tg)) continue;
    let score = 0.5;
    if (pos === '월') score += 0.3;                                   // 월령 = 세력의 뿌리
    if (POS.some((q) => tenGod(day, p[q].stem) === tg)) score += 0.2;  // 천간 투출
    cands.push({ branch: br, pos, score });
  }
  cands.sort((a, b) => b.score - a.score);
  const primary = cands[0] ?? null;

  // 星이 맺는 합충형
  const combos: Combo[] = [];
  let transformedTo: Element | undefined;
  if (primary) {
    for (const pos of POS) {
      const other = p[pos].branch;
      if (other === primary.branch && pos === primary.pos) continue;
      const rel = relationOf(primary.branch, other);
      if (!rel) continue;
      const to = rel === 'hap' ? hapTo(primary.branch, other) : undefined;
      combos.push({ with: other, kind: rel, to });
      if (to && !transformedTo) transformedTo = to;                   // ★S1 첫 합화를 귀결로
    }
  }

  // ★S2 재인합 — 星이 인성과 합·근접하면 오염(이성을 '결핍의 상'으로 투사)
  const contaminatedBy: TenGod[] = [];
  if (primary) {
    for (const c of combos) {
      const tg = tenGod(day, BRANCH_MAIN[c.with]);
      if ((tg === '정인' || tg === '편인') && !contaminatedBy.includes(tg)) contaminatedBy.push(tg);
    }
  }

  return {
    primaryBranch: primary?.branch ?? null,
    primaryTenGod: primary ? tenGod(day, BRANCH_MAIN[primary.branch]) : undefined,
    starTenGods: starSet,
    strength: primary ? Math.min(1, primary.score) : 0,
    combos,
    transformedTo,
    transformedTenGod: transformedTo ? transformedTenGodOf(transformedTo, day, p) : undefined,
    contaminatedBy,
  };
}

// ── 宮 (일지) ────────────────────────────────────────────────────────────
export type PalaceProfile = {
  branch: Branch;
  hidden: { stem: Stem; tenGod: TenGod; role: string }[];
  /** ★S3 궁 안에 배우자성이 있는가 — false 면 인연이 '재성적 매력이 아닌 경로'로 온다 */
  hasSpouseStar: boolean;
  johu: number;                          // -1(한랭) ~ +1(온난)
  combos: Combo[];
  /** ★S4 충으로 개고되면 나오는 배우자성(= 인연 발동 신호) */
  chungOpensTo: Stem[];
};

/** 조후 지수 — 지지의 한난(스펙 D3 와 같은 축). */
const BRANCH_TEMP: Record<Branch, number> = {
  子: -1, 丑: -0.6, 寅: 0.3, 卯: 0.4, 辰: 0.1, 巳: 0.8,
  午: 1, 未: 0.6, 申: -0.2, 酉: -0.4, 戌: 0, 亥: -0.8,
};

/** ★R48-S3/S4 — 宮 추출 + 배우자성 부재 탐지 + 충 개고 추적. */
export function extractPalace(p: Pillars, sex: '남' | '여'): PalaceProfile {
  const day = p['일'].stem;
  const br = p['일'].branch;
  const starSet: TenGod[] = sex === '남' ? ['정재', '편재'] : ['정관', '편관'];

  const hidden = (HIDDEN[br] ?? []).map((h) => ({ stem: h.stem, tenGod: tenGod(day, h.stem), role: h.role }));
  const hasSpouseStar = hidden.some((h) => starSet.includes(h.tenGod));

  const combos: Combo[] = [];
  for (const pos of POS) {
    if (pos === '일') continue;
    const rel = relationOf(br, p[pos].branch);
    if (rel) combos.push({ with: p[pos].branch, kind: rel, to: rel === 'hap' ? hapTo(br, p[pos].branch) : undefined });
  }

  // ★S4 — 일지가 충을 받으면 **상대 지지**의 지장간이 열린다. 거기서 배우자성이 나오는지.
  const chungPartner = CHONG.find(([x, y]) => x === br || y === br);
  const opp = chungPartner ? (chungPartner[0] === br ? chungPartner[1] : chungPartner[0]) : null;
  const chungOpensTo = opp
    ? (HIDDEN[opp] ?? []).filter((h) => starSet.includes(tenGod(day, h.stem))).map((h) => h.stem)
    : [];

  return { branch: br, hidden, hasSpouseStar, johu: BRANCH_TEMP[br], combos, chungOpensTo };
}

// ── ★R48-S5 星/宮 이중 관계 ──────────────────────────────────────────────
export type DualRelation = { pivot: Branch; toStar: Relation; toPalace: Relation };

/**
 * 동일한 제3의 글자가 星은 치고 宮은 붙잡는(또는 반대) 배치.
 * ★스펙 §5: INVERTED 서사의 **원국 내부 근거** — 사용자 체감 설득력이 가장 높은 구조라
 *   존재하면 서사 최상단에 놓는다.
 */
export function detectDualRelation(p: Pillars, star: Branch | null, palace: Branch): DualRelation | null {
  if (!star) return null;
  const cands: DualRelation[] = [];
  for (const pos of POS) {
    const j = p[pos].branch;
    if (j === star || j === palace) continue;
    const toStar = relationOf(j, star);
    const toPalace = relationOf(j, palace);
    if (toStar && toPalace && toStar !== toPalace) cands.push({ pivot: j, toStar, toPalace });
  }
  if (!cands.length) return null;
  // ★스펙 §2.3 은 "星은 **충**하고 宮은 **합**하는(또는 반대)"를 정의로 든다 → 충↔합 조합이 정본.
  //   형(刑)이 섞인 조합도 '다른 관계'이긴 하나 서사 강도가 다르고, 무엇보다
  //   합으로 이미 **S1 합화**에 쓰인 글자가 피벗으로 잡히면 같은 사실을 두 번 말하게 된다
  //   (PILOT_01: 戌 은 卯 와 합해 火 로 化하는 당사자다 — 피벗이 아니라 변환 요인이다).
  const chungHap = cands.find((c) =>
    (c.toStar === 'chung' && c.toPalace === 'hap') || (c.toStar === 'hap' && c.toPalace === 'chung'));
  return chungHap ?? cands[0];
}

// ── 통합 산출 ────────────────────────────────────────────────────────────
export type StarPalaceReport = {
  star: StarProfile;
  palace: PalaceProfile;
  dualRelation: DualRelation | null;
  flags: string[];
};

/**
 * 성궁론 1차 판정 — **경상명식 없이 단독으로 성립한다**(스펙 §10).
 * @returns flags 에 S1~S5 발동 내역이 담긴다(L2 프롬프트가 이걸 근거로 서술).
 */
export function analyzeStarPalace(p: Pillars, sex: '남' | '여'): StarPalaceReport {
  const star = extractStar(p, sex);
  const palace = extractPalace(p, sex);
  const dualRelation = detectDualRelation(p, star.primaryBranch, palace.branch);

  const flags: string[] = [];
  if (star.transformedTo) {
    flags.push(`S1_STAR_TRANSFORM:${star.transformedTo}:${star.transformedTenGod ?? ''}`);
  }
  if (star.contaminatedBy.length) flags.push(`S2_STAR_CONTAMINATED:${star.contaminatedBy.join(',')}`);
  if (!palace.hasSpouseStar) flags.push('S3_PALACE_NO_SPOUSE_STAR');
  if (palace.chungOpensTo.length) flags.push(`S4_PALACE_OPENS:${palace.chungOpensTo.join(',')}`);
  if (dualRelation) flags.push(`S5_DUAL:${dualRelation.pivot}:${dualRelation.toStar}/${dualRelation.toPalace}`);

  return { star, palace, dualRelation, flags };
}
