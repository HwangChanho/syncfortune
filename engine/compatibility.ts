// engine/compatibility.ts — 궁합 결정론 (두 사주 *교차* 상호작용)
// ─────────────────────────────────────────────────────────────────────────
// 규칙2: 사주 단독 궁합만 — 자미·MBTI와 블렌딩 금지(C2에서 셋 독립 평가 후 수렴).
// 결정론으로 가능한 것: 일간 관계(천간합/충/생극) · 교차 합충(내 글자 × 상대 글자) · 용신 상보.
//   '깊은 궁합 stance'(누가 누구를 살리는 인연인가 등)는 LLM 통변 패스 + daniel 검수 영역.
// ⚠️ 발명 금지 — 표준 명리 테이블(천간합 5·천간충·지지 육합/충/삼합)만 사용.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, Stem, Branch, Element, PillarPos } from '../spec/chart';
import { johu2, johuLabel } from './johu2'; // ★조후 축 → 조후용신 오행(G1 · 2026-08-24)

const STEM_ELEM: Record<Stem, Element> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const BRANCH_MAIN: Record<Branch, Stem> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };

// 천간합 5(화 오행) · 천간충 · 지지 육합(화) · 지지충
const STEM_COMBINE: [Stem, Stem, Element][] = [['甲', '己', '土'], ['乙', '庚', '金'], ['丙', '辛', '水'], ['丁', '壬', '木'], ['戊', '癸', '火']];
const STEM_CLASH: [Stem, Stem][] = [['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸']];
const SIXHE: [Branch, Branch, Element][] = [['子', '丑', '土'], ['寅', '亥', '木'], ['卯', '戌', '火'], ['辰', '酉', '金'], ['巳', '申', '水'], ['午', '未', '土']];
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];

// ─── 배우자궁(일지) 충돌 판정용 지지 관계 표준 테이블 (daniel 궁합 기준 2026-07-17) ───
// ⚠️발명 금지: 명리 표준 테이블만. 형/파/해/원진은 통용 판본. 귀문은 daniel 관법상 결정론 제외(사주별 LLM 판정·2026-07-17).
// 삼합국(三合局) — 교차 삼합 완성(G2)용. 표준 표라 발명 아님(파일 머리말 '표준 명리 테이블만 사용').
const SANHE: [Branch, Branch, Branch, Element][] = [['申', '子', '辰', '水'], ['寅', '午', '戌', '火'], ['巳', '酉', '丑', '金'], ['亥', '卯', '未', '木']];
// 삼형(三刑) 세 글자 — 짝 단위 형(HYEONG)과 **따로** 본다. 셋이 다 모이면 무게가 다르다는 게 통설.
const SAMHYEONG: [Branch, Branch, Branch][] = [['寅', '巳', '申'], ['丑', '戌', '未']];
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
  mine: string;   // 내 자리·글자 — **표시용 요약**(예: '년干甲')
  theirs: string; // 상대 자리·글자 — 표시용 요약
  detail: string;
  /**
   * ★참여 글자의 **구조화된 출처**(R46 개정 스펙 4번 '파싱 무결성', 2026-08-15).
   *
   * 왜 문자열(`mine`/`theirs`)로 부족한가: `'시支卯'` 같은 요약은 **되짚어 세기 어렵다.**
   * 실제로 수기 판단 중 상대의 卯 개수를 2개로 오독해 卯酉충이 1:1→2:1 로 바뀌고
   * 결론이 뒤집힌 일이 있었다. 카운트는 **파싱된 차트 객체**에서 나와야 하고,
   * 결과에는 어느 명식 어느 기둥의 어떤 글자였는지가 남아야 한다.
   *
   * ⚠️`mine`/`theirs` 는 소비처(프롬프트·화면)가 이미 쓰므로 **지우지 않는다.** 여기에 덧붙인다.
   */
  refs: { chart: 'self' | 'other'; pillar: '년' | '월' | '일' | '시'; char: string }[];
}

export interface CompatibilityDx {
  dayMasterRelation: { type: '합' | '충' | '상생' | '상극' | '비화'; detail: string };
  crossInteractions: CrossInteraction[];
  usefulGodSupply: {
    element: Element | null;
    supply: '강' | '중' | '약' | '없음';
    /** 용신 오행을 **무엇으로 정했는가** — 화면·통변이 근거를 말할 수 있게 */
    source: '동태' | '정적오행' | '정적십신→오행' | '조후' | '미특정';
    detail: string;
  };
  harmony: string[];  // 조화(합·상생)
  tension: string[];  // 긴장(충·상극)
  // ── daniel 궁합 기준(2026-07-17) — 결정론 재료. 점수 가중치는 compatScore.ts(★검수 슬롯). ──
  seasonComplement: { mineGroup: '봄여름' | '가을겨울'; theirsGroup: '봄여름' | '가을겨울'; complementary: boolean; detail: string }; // 월지 한난 상보
  partnerToMe: { tenGod: '비겁' | '식상' | '재성' | '인성' | '관성'; favorable: boolean; detail: string }; // 상대 일간이 나에게 재/관(내 관점)
  /**
   * 배우자궁 충돌. **★2026-08-24 범위 확대**(Boss 지시 *"범위 넓혀"*, 전문가 케이스 노트 근거).
   *
   * 종전엔 **두 사람의 일지끼리만** 봤다. 그런데 전문가 판정은 상대의 **월지·시지**가
   * 내 배우자궁을 치는 것도 배우자궁 상호작용으로 셌다(케이스 003: B 일지 丑 ↔ A 월지·시지 未 = 丑未沖 ×2).
   * 일지끼리만 보면 그 케이스가 **'충돌 없음'** 으로 나온다 — 실제로는 두 번 맞고 있는데.
   *
   * ⇒ 이제 **각자의 일지(배우자궁)가 상대 차트의 어느 지지와든** 형충파해원진을 이루면 잡는다.
   * ⚠️귀문은 daniel 관법상 LLM 판정 → 결정론에서 제외(종전 그대로).
   */
  spousePalace: {
    /** 종류 목록 — **건수만큼 반복된다**(丑未沖 ×2 면 '충' 두 개). 기존 소비처 계약 유지 */
    afflictions: ('형' | '충' | '파' | '해' | '원진')[];
    /** 어디서 났는가 — 화면·통변이 "무엇이 무엇을 쳤는지" 말할 수 있게 */
    hits: { kind: '형' | '충' | '파' | '해' | '원진'; palace: 'mine' | 'theirs'; mine: Branch; theirs: Branch; at: PillarPos }[];
    clean: boolean;
    detail: string;
  };
  missingFill: { chars: Branch[]; detail: string }; // 상대가 채워주는 내 결핍 지지 글자
  /**
   * ★**교차 삼합 완성**(G2 · 2026-08-24 · 전문가 케이스 노트).
   * 내 원국만으로는 반합·대기 상태인 국(局)을, **상대의 지지가 채워 완성**시키는 경우.
   * 케이스 003: 亥卯未(A 亥·未 + B 卯) · 巳酉丑(A 巳 + B 酉·丑) — 전문가가 배우자성 90점을 준 근거.
   * ⚠️혼자서 이미 3자를 다 가진 국은 **교차가 아니다**(상대가 기여한 게 없다) → 제외.
   */
  crossSanhe: {
    /** 국 세 글자 */ guk: [Branch, Branch, Branch];
    /** 국의 오행 */ element: Element;
    /** 내가 낸 글자 */ mine: Branch[];
    /** 상대가 낸 글자 */ theirs: Branch[];
    /** 국 오행이 내 일간 기준 무슨 십신인가 */ tenGod: '비겁' | '식상' | '재성' | '관성' | '인성';
    /**
     * 그 십신이 **내 배우자성**인가(곤명=관성 · 건명=재성) — 노트: 배우자성이면 최고 가중.
     * ⚠️`null` = **성별을 몰라 판정하지 않았다**. `SajuChart` 에는 성별이 없어서,
     *   호출측이 알려 주지 않으면 여기서 지어내지 않는다(추측한 배우자성은 틀리면 아무도 모른다).
     */
    spouseStar: boolean | null;
    detail: string;
  }[];
  /**
   * ★**교차 삼형 성립**(G3 · 2026-08-24 · 전문가 케이스 노트).
   * 짝 단위 형(刑)은 종전에도 잡았지만, **세 글자가 다 모이는 삼형**은 무게가 다르다.
   * 케이스 003: A 未·未 + B 戌·丑 → `丑戌未` 성립. 전문가가 갈등 구조를 55점으로 본 근거 중 하나.
   * ⚠️혼자 이미 셋을 다 가졌으면 교차가 아니다 → 제외(상대 기여 0).
   */
  crossSamhyeong: { guk: [Branch, Branch, Branch]; mine: Branch[]; theirs: Branch[]; detail: string }[];
  note: string;
}

/** 내 용신(동태 ON 오행 또는 정적 오행)을 상대 사주가 얼마나 공급하는가 */
function usefulGodSupply(me: SajuChart, other: SajuChart): CompatibilityDx['usefulGodSupply'] {
  // 동태적 용신에서 'ON/최길/성장' 모드인 오행을 1순위로, 없으면 정적 usefulGod이 오행이면 사용
  const dyn = me.structure?.dynamicUsefulGod?.byIncomingStemElement;
  let target: Element | undefined;
  let source: CompatibilityDx['usefulGodSupply']['source'] = '미특정';
  if (dyn) {
    target = (Object.keys(dyn) as Element[]).find((e) => /ON|최길|성장|상생/.test(dyn[e] ?? ''));
    if (target) source = '동태';
  }
  const stat = me.structure?.usefulGod?.value;
  if (!target && stat && ELEMS.includes(stat as Element)) { target = stat as Element; source = '정적오행'; }
  // ★십신으로만 적힌 용신을 **오행으로 바꾼다**(G1). 십신은 일간 기준 상대 관계라 변환은 결정론이다.
  //   (명리 판정이 아니라 좌표 변환이다 — 무엇이 용신인가는 이미 정해져 있고, 그걸 오행으로 읽을 뿐이다.)
  if (!target && stat) {
    const t = String(stat);
    const dmE = STEM_ELEM[me.pillars['일'].stem];
    const rel: Record<string, Element> = {
      비겁: dmE, 식상: SHENG[dmE], 재성: KE[dmE],
      관성: (Object.keys(KE) as Element[]).find((e) => KE[e] === dmE)!,
      인성: (Object.keys(SHENG) as Element[]).find((e) => SHENG[e] === dmE)!,
    };
    const grp = /비견|겁재|비겁/.test(t) ? '비겁' : /식신|상관|식상/.test(t) ? '식상'
      : /정재|편재|재성/.test(t) ? '재성' : /정관|편관|관성|칠살/.test(t) ? '관성'
      : /정인|편인|인성|인수/.test(t) ? '인성' : '';
    if (grp) { target = rel[grp]; source = '정적십신→오행'; }
  }
  // ★★structure 가 아예 없을 때(온디바이스 궁합의 기본 상태) — **조후 축**으로 정한다.
  //   근거: 전문가 케이스 노트 2026-08-24. A(未월 己土)는 한난 暖 + 조습 燥 로 **두 축이 같은 방향**이라
  //   조후용신 水 가 나오고, 전문가 판정 `조후용신 癸水` 와 정확히 일치했다(골든 003).
  //   ⚠️**두 축이 어긋나면(crossed) 단정하지 않는다.** 케이스의 B 가 그랬고, 전문가도 B 에는
  //     조후용신을 쓰지 않고 '살인상생 의존'이라 했다. 모르면 모른다고 두는 편이 맞다.
  //   ⚠️이건 **조후 관점 하나**다 — 억부·병약 용신은 여기서 정하지 않는다([[yongsin-app-engine-drift]]).
  if (!target) {
    const j = johu2(me);
    const l = johuLabel(j);
    if (!l.crossed) {
      // 덥다(暖)·마르다(燥) → 적시는 水 · 춥다(寒)·습하다(濕) → 말리고 덥히는 火
      if (l.hanNan === '暖' || l.joSeup === '燥') target = '水';
      else if (l.hanNan === '寒' || l.joSeup === '濕') target = '火';
      if (target) source = '조후';
    }
  }
  if (!target) return { element: null, supply: '없음', source: '미특정', detail: '용신 오행 미특정(조후 두 축이 어긋나 단정하지 않음)' };

  // 상대 사주의 천간 + 지지 본기에서 **직접 공급**(용신 오행 그 자체)과 **생조 공급**(용신을 생하는 오행 = 희신)
  //   ★생조를 세는 이유(전문가 케이스 노트 2026-08-24): A 의 조후용신은 水 인데 B 사주에 水 가 **0개**다.
  //     그런데 전문가 판정은 *"B→A: **金生水** 조후 생조"* 로 이 항목을 95점으로 봤다.
  //     직접 개수만 세면 이 케이스가 **공급 없음(0점)** 이 된다 — 실제로는 희신이 두 개(辛·酉) 있는데.
  //   ⚠️같은 무게로 세지 않는다. 직접 1.0 · 생조 0.5 — 생조는 한 단계 건너온 것이다.
  const helper = (Object.keys(SHENG) as Element[]).find((e) => SHENG[e] === target)!; // 용신을 생하는 오행(희신)
  let direct = 0, indirect = 0;
  for (const p of POS) {
    for (const e of [STEM_ELEM[other.pillars[p].stem], STEM_ELEM[BRANCH_MAIN[other.pillars[p].branch]]]) {
      if (e === target) direct++;
      else if (e === helper) indirect++;
    }
  }
  const weighted = direct + indirect * 0.5;
  const supply = weighted >= 3 ? '강' : weighted >= 2 ? '중' : weighted >= 1 ? '약' : '없음';
  return {
    element: target, supply, source,
    detail: `내 용신 ${target}(${source}) · 상대 사주에 직접 ${direct}개`
      + (indirect ? ` + 희신 ${helper} ${indirect}개(생조)` : '')
      + ` → 공급 ${supply}`,
  };
}

/** 1:1 궁합 결정론 분석 (me에 structure 권장 — 용신 상보용) */
/**
 * @param meSex ★'나'의 성별 — **배우자성 판정에만** 쓴다(곤명=관성 · 건명=재성).
 *   `SajuChart` 에 성별이 없어서 받는다. 안 주면 배우자성을 `null`(미판정)로 둔다.
 */
export function analyzeCompatibility(me: SajuChart, other: SajuChart, meSex?: '남' | '여'): CompatibilityDx {
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
    const stemRefs = () => ([{ chart: 'self' as const, pillar: pa, char: sa }, { chart: 'other' as const, pillar: pb, char: sb }]);
    if (c) cross.push({ kind: '천간합', mine: `${pa}干${sa}`, theirs: `${pb}干${sb}`, detail: `${sa}${sb}合化${c[2]}`, refs: stemRefs() });
    if (pair(STEM_CLASH, sa, sb)) cross.push({ kind: '천간충', mine: `${pa}干${sa}`, theirs: `${pb}干${sb}`, detail: `${sa}${sb}冲`, refs: stemRefs() });
    const ba = me.pillars[pa].branch, bb = other.pillars[pb].branch;
    const h = SIXHE.find(([x, y]) => (x === ba && y === bb) || (x === bb && y === ba));
    const branchRefs = () => ([{ chart: 'self' as const, pillar: pa, char: ba }, { chart: 'other' as const, pillar: pb, char: bb }]);
    if (h) cross.push({ kind: '지지합', mine: `${pa}支${ba}`, theirs: `${pb}支${bb}`, detail: `${ba}${bb}合化${h[2]}`, refs: branchRefs() });
    if (pair(CHONG, ba, bb)) cross.push({ kind: '지지충', mine: `${pa}支${ba}`, theirs: `${pb}支${bb}`, detail: `${ba}${bb}冲`, refs: branchRefs() });
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
  const hits: CompatibilityDx['spousePalace']['hits'] = [];
  /**
   * 배우자궁 한 자리를 상대 차트 **네 지지 전부**와 맞춰 본다(위 타입 주석의 범위 확대).
   * @param palaceBranch 배우자궁 글자(일지) / @param opp 상대 차트 / @param whose 누구의 궁인가
   */
  const scanPalace = (palaceBranch: Branch, opp: SajuChart, whose: 'mine' | 'theirs') => {
    for (const p of POS) {
      const b = opp.pillars[p].branch;
      // ★★한 **글자쌍**에서는 **가장 무거운 것 하나만** 센다(충 > 형 > 파 > 해 > 원진).
      //   ⚠️丑未 처럼 충이면서 형인 쌍이 있다. 종류별로 다 세면 **한 쌍이 두 번 감점**된다 —
      //     케이스 003 에서 실제로 그랬다(丑未 두 자리 × 2종 = 4건). 전문가는 `丑未沖` **2건**으로 셌다.
      //   ⇒ 과잉 계상 수정이지 stance 변경이 아니다(무엇이 났는지는 그대로, 몇 번 세느냐만 고친다).
      const kinds: ('충' | '형' | '파' | '해' | '원진')[] = [];
      if (pair(CHONG, palaceBranch, b)) kinds.push('충');
      if (pair(HYEONG, palaceBranch, b) || (palaceBranch === b && SELF_HYEONG.includes(palaceBranch))) kinds.push('형');
      if (pair(PA, palaceBranch, b)) kinds.push('파');
      if (pair(HAE, palaceBranch, b)) kinds.push('해');
      if (pair(WONJIN, palaceBranch, b)) kinds.push('원진');
      if (kinds.length) {
        const kind = kinds[0];   // 위 순서가 곧 무게 서열이다
        affl.push(kind);
        hits.push({ kind, palace: whose, mine: palaceBranch, theirs: b, at: p });
      }
    }
  };
  scanPalace(dbA, other, 'mine');     // 내 배우자궁 ↔ 상대 네 지지
  scanPalace(dbB, me, 'theirs');      // 상대 배우자궁 ↔ 내 네 지지
  const spousePalace: CompatibilityDx['spousePalace'] = {
    afflictions: affl, hits, clean: affl.length === 0,
    detail: affl.length
      ? `배우자궁 ${dbA}·${dbB} → ` + hits.map((h) => `${h.mine}${h.theirs}${h.kind}(${h.at}지)`).join(' · ')
      : `배우자궁 ${dbA}·${dbB} — 충돌 없음(안정)`,
  };
  // 5-c2) ★교차 삼합 완성(G2) — 상대 지지가 내 반합·대기를 **국으로 완성**시키는가
  //   ⚠️혼자 이미 3자를 다 가졌으면 교차가 아니다(상대 기여 0) → 건너뛴다.
  const myB = POS.map((p) => me.pillars[p].branch);
  const otB = POS.map((p) => other.pillars[p].branch);
  const crossSanhe: CompatibilityDx['crossSanhe'] = [];
  for (const [x, y, z, elem] of SANHE) {
    const trio: Branch[] = [x, y, z];
    const mineHas = trio.filter((b) => myB.includes(b));
    const theirsHas = trio.filter((b) => otB.includes(b));
    const union = new Set([...mineHas, ...theirsHas]);
    if (union.size < 3) continue;               // 국이 안 선다
    if (mineHas.length === 3) continue;         // ★내가 이미 다 가졌다 = 교차가 아니다
    if (theirsHas.length === 0) continue;       // 상대 기여가 없다
    const tg = tenGodOf(STEM_ELEM[me.pillars['일'].stem], elem);
    // 배우자성 — 곤명은 관성, 건명은 재성(daniel 관법 · R-SPOUSE 계열과 같은 기준)
    const spouseStar = meSex == null ? null : meSex === '여' ? tg === '관성' : tg === '재성';
    crossSanhe.push({
      guk: [x, y, z], element: elem,
      mine: mineHas, theirs: theirsHas.filter((b) => !mineHas.includes(b)), tenGod: tg, spouseStar,
      detail: `${x}${y}${z} ${elem}국 완성 — 내 ${mineHas.join('') || '없음'} + 상대 ${theirsHas.filter((b) => !mineHas.includes(b)).join('') || '없음'}`
        + ` (내 기준 ${tg}${spouseStar ? ' · **배우자성**' : spouseStar === null ? ' · 배우자성 여부는 성별 미상' : ''})`,
    });
  }

  // 5-c3) ★교차 삼형 성립(G3)
  const crossSamhyeong: CompatibilityDx['crossSamhyeong'] = [];
  for (const trio of SAMHYEONG) {
    const mineHas = trio.filter((b) => myB.includes(b));
    const theirsHas = trio.filter((b) => otB.includes(b));
    if (new Set([...mineHas, ...theirsHas]).size < 3) continue;
    if (mineHas.length === 3) continue;      // 내 원국만으로 이미 성립 = 교차가 아니다
    if (theirsHas.length === 0) continue;
    const added = theirsHas.filter((b) => !mineHas.includes(b));
    crossSamhyeong.push({
      guk: trio, mine: mineHas, theirs: added,
      detail: `${trio.join('')} 삼형 성립 — 내 ${mineHas.join('') || '없음'} + 상대 ${added.join('')}`,
    });
  }

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
    seasonComplement, partnerToMe, spousePalace, missingFill, crossSanhe, crossSamhyeong,
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
