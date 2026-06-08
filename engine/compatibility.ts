// engine/compatibility.ts — 궁합 결정론 (두 사주 *교차* 상호작용)
// ─────────────────────────────────────────────────────────────────────────
// 규칙2: 사주 단독 궁합만 — 자미·MBTI와 블렌딩 금지(C2에서 셋 독립 평가 후 수렴).
// 결정론으로 가능한 것: 일간 관계(천간합/충/생극) · 교차 합충(내 글자 × 상대 글자) · 용신 상보.
//   '깊은 궁합 stance'(누가 누구를 살리는 인연인가 등)는 LLM 통변 패스 + daniel 검수 영역.
// ⚠️ 발명 금지 — 표준 명리 테이블(천간합 5·천간충·지지 육합/충/삼합)만 사용.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, Stem, Branch, Element, PillarPos } from '../spec/chart';

const STEM_ELEM: Record<Stem, Element> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const BRANCH_MAIN: Record<Branch, Stem> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };

// 천간합 5(화 오행) · 천간충 · 지지 육합(화) · 지지충
const STEM_COMBINE: [Stem, Stem, Element][] = [['甲', '己', '土'], ['乙', '庚', '金'], ['丙', '辛', '水'], ['丁', '壬', '木'], ['戊', '癸', '火']];
const STEM_CLASH: [Stem, Stem][] = [['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸']];
const SIXHE: [Branch, Branch, Element][] = [['子', '丑', '土'], ['寅', '亥', '木'], ['卯', '戌', '火'], ['辰', '酉', '金'], ['巳', '申', '水'], ['午', '未', '土']];
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];

const SHENG: Record<Element, Element> = { 水: '木', 木: '火', 火: '土', 土: '金', 金: '水' }; // X생Y
const KE: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };     // X극Y
const POS: PillarPos[] = ['년', '월', '일', '시'];
const ELEMS: Element[] = ['木', '火', '土', '金', '水'];

const pair = <T extends string>(list: [T, T][], a: T, b: T) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export interface CrossInteraction {
  kind: '천간합' | '천간충' | '지지합' | '지지충';
  mine: string;   // 내 자리·글자
  theirs: string; // 상대 자리·글자
  detail: string;
}

export interface CompatibilityDx {
  dayMasterRelation: { type: '합' | '충' | '상생' | '상극' | '비화'; detail: string };
  crossInteractions: CrossInteraction[];
  usefulGodSupply: { element: Element | null; supply: '강' | '중' | '약' | '없음'; detail: string };
  harmony: string[];  // 조화(합·상생)
  tension: string[];  // 긴장(충·상극)
  note: string;
}

/** 내 용신(동태 ON 오행 또는 정적 오행)을 상대 사주가 얼마나 공급하는가 */
function usefulGodSupply(me: SajuChart, other: SajuChart): CompatibilityDx['usefulGodSupply'] {
  // 동태적 용신에서 'ON/최길/성장' 모드인 오행을 1순위로, 없으면 정적 usefulGod이 오행이면 사용
  const dyn = me.structure?.dynamicUsefulGod?.byIncomingStemElement;
  let target: Element | undefined;
  if (dyn) target = (Object.keys(dyn) as Element[]).find((e) => /ON|최길|성장|상생/.test(dyn[e] ?? ''));
  const stat = me.structure?.usefulGod?.value;
  if (!target && stat && ELEMS.includes(stat as Element)) target = stat as Element;
  if (!target) return { element: null, supply: '없음', detail: '용신 오행 미특정(정적 십신 — 오행 변환 추후)' };

  // 상대 사주의 천간 + 지지 본기에서 target 오행 개수
  let cnt = 0;
  for (const p of POS) {
    if (STEM_ELEM[other.pillars[p].stem] === target) cnt++;
    if (STEM_ELEM[BRANCH_MAIN[other.pillars[p].branch]] === target) cnt++;
  }
  const supply = cnt >= 3 ? '강' : cnt === 2 ? '중' : cnt === 1 ? '약' : '없음';
  return { element: target, supply, detail: `상대 사주에 내 용신 ${target} ${cnt}개(천간+지지본기) → 공급 ${supply}` };
}

/** 1:1 궁합 결정론 분석 (me에 structure 권장 — 용신 상보용) */
export function analyzeCompatibility(me: SajuChart, other: SajuChart): CompatibilityDx {
  // 1) 일간 관계
  const dmA = me.dayMaster.stem, dmB = other.dayMaster.stem;
  const eA = STEM_ELEM[dmA], eB = STEM_ELEM[dmB];
  let dmRel: CompatibilityDx['dayMasterRelation'];
  const comb = STEM_COMBINE.find(([x, y]) => (x === dmA && y === dmB) || (x === dmB && y === dmA));
  if (comb) dmRel = { type: '합', detail: `일간 ${dmA}${dmB}合化${comb[2]} — 끌림·결합` };
  else if (pair(STEM_CLASH, dmA, dmB)) dmRel = { type: '충', detail: `일간 ${dmA}${dmB}冲 — 대립·긴장` };
  else if (eA === eB) dmRel = { type: '비화', detail: `일간 동일 오행 ${eA} — 비견(동질·경쟁)` };
  else if (SHENG[eA] === eB) dmRel = { type: '상생', detail: `내 일간 ${eA} → 상대 ${eB} 생(내가 베풂)` };
  else if (SHENG[eB] === eA) dmRel = { type: '상생', detail: `상대 ${eB} → 내 일간 ${eA} 생(내가 받음)` };
  else if (KE[eA] === eB) dmRel = { type: '상극', detail: `내 일간 ${eA} → 상대 ${eB} 극(내가 주도)` };
  else dmRel = { type: '상극', detail: `상대 ${eB} → 내 일간 ${eA} 극(내가 눌림)` };

  // 2) 교차 합충 (천간·지지)
  const cross: CrossInteraction[] = [];
  for (const pa of POS) for (const pb of POS) {
    const sa = me.pillars[pa].stem, sb = other.pillars[pb].stem;
    const c = STEM_COMBINE.find(([x, y]) => (x === sa && y === sb) || (x === sb && y === sa));
    if (c) cross.push({ kind: '천간합', mine: `${pa}干${sa}`, theirs: `${pb}干${sb}`, detail: `${sa}${sb}合化${c[2]}` });
    if (pair(STEM_CLASH, sa, sb)) cross.push({ kind: '천간충', mine: `${pa}干${sa}`, theirs: `${pb}干${sb}`, detail: `${sa}${sb}冲` });
    const ba = me.pillars[pa].branch, bb = other.pillars[pb].branch;
    const h = SIXHE.find(([x, y]) => (x === ba && y === bb) || (x === bb && y === ba));
    if (h) cross.push({ kind: '지지합', mine: `${pa}支${ba}`, theirs: `${pb}支${bb}`, detail: `${ba}${bb}合化${h[2]}` });
    if (pair(CHONG, ba, bb)) cross.push({ kind: '지지충', mine: `${pa}支${ba}`, theirs: `${pb}支${bb}`, detail: `${ba}${bb}冲` });
  }

  // 3) 용신 상보
  const supply = usefulGodSupply(me, other);

  // 4) 조화/긴장 집계
  const harmony = cross.filter((c) => c.kind.includes('합')).map((c) => `${c.mine}×${c.theirs} ${c.detail}`);
  const tension = cross.filter((c) => c.kind.includes('충')).map((c) => `${c.mine}×${c.theirs} ${c.detail}`);
  if (dmRel.type === '합' || dmRel.type === '상생') harmony.unshift(`일간: ${dmRel.detail}`);
  if (dmRel.type === '충' || dmRel.type === '상극') tension.unshift(`일간: ${dmRel.detail}`);

  return {
    dayMasterRelation: dmRel, crossInteractions: cross, usefulGodSupply: supply, harmony, tension,
    note: '사주 단독 궁합(규칙2) — 자미·MBTI는 독립 평가 후 C2에서 수렴. 깊은 통변은 LLM 패스 + daniel 검수.',
  };
}

/** 1:N — 나 1 + 상대 N → 각 궁합 + 간이 점수 랭킹(조화−긴장+용신공급) */
export function analyzeOneToMany(
  me: SajuChart,
  others: { id: string; chart: SajuChart }[],
): { id: string; dx: CompatibilityDx; score: number }[] {
  const supplyW = { 강: 2, 중: 1, 약: 0, 없음: 0 } as const;
  return others
    .map((o) => {
      const dx = analyzeCompatibility(me, o.chart);
      const score = dx.harmony.length - dx.tension.length + supplyW[dx.usefulGodSupply.supply];
      return { id: o.id, dx, score };
    })
    .sort((a, b) => b.score - a.score);
}
