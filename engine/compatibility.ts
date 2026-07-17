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

// ─── 배우자궁(일지) 충돌 판정용 지지 관계 표준 테이블 (daniel 궁합 기준 2026-07-17) ───
// ⚠️발명 금지: 명리 표준 테이블만. 형/파/해/원진은 통용 판본. 귀문은 daniel 관법상 결정론 제외(사주별 LLM 판정·2026-07-17).
const HYEONG: [Branch, Branch][] = [['寅', '巳'], ['巳', '申'], ['寅', '申'], ['丑', '戌'], ['戌', '未'], ['丑', '未'], ['子', '卯']]; // 삼형(寅巳申·丑戌未)+상형(子卯)
const SELF_HYEONG: Branch[] = ['辰', '午', '酉', '亥']; // 자형(같은 글자끼리 — 두 사람 일지가 동일)
const PA: [Branch, Branch][] = [['子', '酉'], ['午', '卯'], ['申', '巳'], ['寅', '亥'], ['辰', '丑'], ['戌', '未']]; // 六破
const HAE: [Branch, Branch][] = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']]; // 六害
const WONJIN: [Branch, Branch][] = [['子', '未'], ['丑', '午'], ['寅', '酉'], ['卯', '申'], ['辰', '亥'], ['巳', '戌']]; // 원진(표준)
// 귀문관살 — ★daniel 관법(2026-07-17 노션): "귀문 만드는 글자·해소 글자를 **사주별로** 판정, 대체로 발동하는 사주는 없다."
//   = 단순 지지쌍 테이블 자동 감점은 부적절 → **결정론 궁합에서 제외**(LLM 통변 판정 영역·R35 예민보스와 같은 결). 배우자궁 감점은 형·충·파·해·원진까지만.

// 계절(월지) 한난(寒暖) 상보 — daniel: "월지 계절이 다른지, 봄여름이면 가을겨울". 봄여름(暖) vs 가을겨울(寒)이 다르면 상보.
const WARM: Branch[] = ['寅', '卯', '辰', '巳', '午', '未']; // 봄(寅卯辰)·여름(巳午未)
const seasonGroup = (b: Branch): '봄여름' | '가을겨울' => (WARM.includes(b) ? '봄여름' : '가을겨울');

const SHENG: Record<Element, Element> = { 水: '木', 木: '火', 火: '土', 土: '金', 金: '水' }; // X생Y
const KE: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };     // X극Y
const POS: PillarPos[] = ['년', '월', '일', '시'];
const ELEMS: Element[] = ['木', '火', '土', '金', '水'];

/** 상대 일간(오행 otherElem)이 내 일간(meElem) 기준 무슨 십신인가. daniel: 재성·관성이면 좋은 궁합(양방향 동일 점수). */
function tenGodOf(meElem: Element, otherElem: Element): '비겁' | '식상' | '재성' | '인성' | '관성' {
  if (otherElem === meElem) return '비겁';        // 동일 오행
  if (SHENG[meElem] === otherElem) return '식상'; // 내가 생하는
  if (SHENG[otherElem] === meElem) return '인성'; // 나를 생하는
  if (KE[meElem] === otherElem) return '재성';    // 내가 극하는(財)
  return '관성';                                   // 나를 극하는(官) = KE[otherElem]===meElem
}

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
  // ── daniel 궁합 기준(2026-07-17) — 결정론 재료. 점수 가중치는 compatScore.ts(★검수 슬롯). ──
  seasonComplement: { mineGroup: '봄여름' | '가을겨울'; theirsGroup: '봄여름' | '가을겨울'; complementary: boolean; detail: string }; // 월지 한난 상보
  partnerToMe: { tenGod: '비겁' | '식상' | '재성' | '인성' | '관성'; favorable: boolean; detail: string }; // 상대 일간이 나에게 재/관(내 관점)
  spousePalace: { afflictions: ('형' | '충' | '파' | '해' | '원진')[]; clean: boolean; detail: string }; // 두 사람 일지(배우자궁) 충돌(귀문은 daniel 관법상 LLM 판정 → 제외)
  missingFill: { chars: Branch[]; detail: string }; // 상대가 채워주는 내 결핍 지지 글자
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

  // 5) daniel 궁합 기준 4축(결정론 재료)
  // 5-a) 계절 한난 상보 — 두 사람 월지가 봄여름 vs 가을겨울로 갈리면 상보
  const myMonth = me.pillars['월'].branch, otMonth = other.pillars['월'].branch;
  const mg = seasonGroup(myMonth), og = seasonGroup(otMonth);
  const seasonComplement: CompatibilityDx['seasonComplement'] = {
    mineGroup: mg, theirsGroup: og, complementary: mg !== og,
    detail: mg !== og ? `내 월지 ${myMonth}(${mg}) ↔ 상대 ${otMonth}(${og}) — 한난 상보` : `둘 다 ${mg}(${myMonth}·${otMonth}) — 같은 계절군`,
  };
  // 5-b) 상대 일간이 나에게 재/관인가(내 관점 — 재관 동일 점수)
  const tg = tenGodOf(eA, eB);
  const partnerToMe: CompatibilityDx['partnerToMe'] = {
    tenGod: tg, favorable: tg === '재성' || tg === '관성',
    detail: `상대 일간 ${dmB}(${eB})는 내 일간 ${dmA}(${eA}) 기준 ${tg}` + (tg === '재성' || tg === '관성' ? ' — 내 재/관(끌림·성취)' : ''),
  };
  // 5-c) 배우자궁(두 사람 일지) 형충파해원진 — 없어야 좋음(귀문은 daniel 관법상 LLM 판정 → 결정론 제외)
  const dbA = me.pillars['일'].branch, dbB = other.pillars['일'].branch;
  const affl: CompatibilityDx['spousePalace']['afflictions'] = [];
  if (pair(HYEONG, dbA, dbB) || (dbA === dbB && SELF_HYEONG.includes(dbA))) affl.push('형');
  if (pair(CHONG, dbA, dbB)) affl.push('충');
  if (pair(PA, dbA, dbB)) affl.push('파');
  if (pair(HAE, dbA, dbB)) affl.push('해');
  if (pair(WONJIN, dbA, dbB)) affl.push('원진');
  const spousePalace: CompatibilityDx['spousePalace'] = {
    afflictions: affl, clean: affl.length === 0,
    detail: affl.length ? `일지 ${dbA}·${dbB} → ${affl.join('·')}(배우자궁 충돌)` : `일지 ${dbA}·${dbB} — 충돌 없음(안정)`,
  };
  // 5-d) 상대가 내 결핍 지지 글자를 채우는가(글자 기준)
  const myBranches = new Set<Branch>(POS.map((p) => me.pillars[p].branch));
  const otherBranches = [...new Set<Branch>(POS.map((p) => other.pillars[p].branch))];
  const fillChars = otherBranches.filter((b) => !myBranches.has(b));
  const missingFill: CompatibilityDx['missingFill'] = {
    chars: fillChars,
    detail: fillChars.length ? `상대가 내게 없는 지지 ${fillChars.join('·')} 보유 — 결핍 보완` : '상대 지지가 모두 내 원국에 이미 있음',
  };

  return {
    dayMasterRelation: dmRel, crossInteractions: cross, usefulGodSupply: supply, harmony, tension,
    seasonComplement, partnerToMe, spousePalace, missingFill,
    note: '사주 단독 궁합(규칙2) — 자미·MBTI는 독립 평가 후 C2에서 수렴. 깊은 통변은 LLM 패스 + daniel 검수.',
  };
}

/** 1:N — 나 1 + 상대 N → 각 궁합 + 간이 점수 랭킹. daniel 기준(계절·재관·결핍·일간관계·용신·배우자궁)과 정합. */
export function analyzeOneToMany(
  me: SajuChart,
  others: { id: string; chart: SajuChart }[],
): { id: string; dx: CompatibilityDx; score: number }[] {
  const supplyW = { 강: 3, 중: 2, 약: 1, 없음: 0 } as const;
  const dmW = { 충: 4, 상생: 3, 합: 2, 비화: 1, 상극: 0 } as const; // 일간충=발전형(compatScore와 동일 서열)
  return others
    .map((o) => {
      const dx = analyzeCompatibility(me, o.chart);
      const score =
        (dx.seasonComplement.complementary ? 3 : 0) +   // 계절 한난 상보
        (dx.partnerToMe.favorable ? 4 : 0) +            // 상대→나 재/관
        Math.min(dx.missingFill.chars.length, 3) +      // 결핍 지지 보완
        dmW[dx.dayMasterRelation.type] +                // 일간관계
        supplyW[dx.usefulGodSupply.supply] -            // 용신공급
        Math.min(dx.spousePalace.afflictions.length, 3) * 2; // 배우자궁 흉
      return { id: o.id, dx, score };
    })
    .sort((a, b) => b.score - a.score);
}
