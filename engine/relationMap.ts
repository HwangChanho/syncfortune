// engine/relationMap.ts — **내가 등록한 사람들로 그리는 관계 지도**(L1 결정론)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-14: *"내가 등록해둔 명식들을 모아서 관계지도를 만들꺼야"*
//   판정축 = **일간 + 오행 세력**(daniel 선택) · 역할 이름 = **생활어**(daniel 선택)
//   지도·역할·케미는 **무료 결정론**(API 0원), 상세는 기존 궁합(유료)로 잇는다.
//
// ■ 이 파일이 하는 일과 안 하는 일
//   한다: 상대별 **역할 5분류** + **케미 점수** + 그 근거.
//   안 한다: 문구·색·배치 — 그건 앱(L4)의 몫이다. 여기서 문장을 만들면 3개 언어가 엔진에 박힌다.
//
// ■ 역할 5분류 = 십신의 뼈대
//   내 일간 오행을 기준으로 상대 일간 오행이 어디 서는가:
//     상대가 나를 생 → 인성 · 같음 → 비견 · 내가 생 → 식상 · 내가 극 → 재성 · 나를 극 → 관성
//   ⇒ 새로 만든 관법이 아니라 **십신 그 자체**다(Claude 는 명리를 발명하지 않는다 · CLAUDE.md §3.3).
//
// ■ ★세력 보정(daniel 이 「일간 + 오행 세력」을 고른 이유)
//   일간 하나만 보면 거칠다. 상대 원국에 다른 오행이 **과다**(4자 이상)면 그 사람의 체감 기운은
//   일간이 아니라 그쪽이다. 그럴 때만 역할을 그 오행으로 다시 본다.
//   ⚠️보정이 걸리면 **반드시 화면에 밝힌다**(`adjusted`·`basis`) — 근거 없이 바뀌면
//     사용자는 "왜 이 사람이 갑자기 귀인이지?" 하고 신뢰를 잃는다.
//   ⚠️임계값(과다=4자)은 `elementPower` 의 기존 판정을 **그대로 쓴다.** 여기서 새 숫자를 만들지 않는다
//     — 임계값을 내가 정하면 사후 변명 장치가 된다([[attach-indicators-r-attach]] 교훈).
// ═══════════════════════════════════════════════════════════════════════════
import type { SajuChart, Element } from '../spec/chart';
import { elementPower } from './elementPower';
import { analyzeCompatibility, type CompatibilityDx } from './compatibility';
import { classifyStrength } from './structure';

/** 오행 상생: 이 오행이 **낳는** 오행. (木→火→土→金→水→木) */
const SHENG_TO: Record<Element, Element> = { 水: '木', 木: '火', 火: '土', 土: '金', 金: '水' };
/** 오행 상극: 이 오행이 **누르는** 오행. (木→土→水→火→金→木) */
const KE_TO: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 관계 역할 — 십신 5분류. 화면 이름(생활어)은 앱 문구 파일이 정한다. */
export type RelationRole = '인성' | '비견' | '식상' | '재성' | '관성';

/**
 * ★같은 역할이라도 **사람마다 다르게** 만드는 변주 축(daniel 2026-08-14
 *   *"같은 화 일간이라도 원국기준 다양하게 나오게해"*).
 *
 * 왜 필요한가: 역할이 5개뿐이라 61명을 그리면 **17명이 똑같은 문구**가 된다(실측).
 * 일간만 보면 그럴 수밖에 없다 — 그래서 **그 사람 원국**과 **나와의 실제 상호작용**에서
 * 가장 두드러진 것을 뽑아 한 줄을 더 얹는다.
 *
 * 문장은 여기서 만들지 않는다(3개 언어는 앱 몫). 여기서는 **무엇이 두드러지는가**만 고른다.
 */
export type RelationTrait =
  | 'clash'        // 배우자궁(일지)이 부딪힌다 — 가까울수록 마찰
  | 'friction'     // 충·형·파·해가 많다 — 자극이 크다
  | 'fills'        // 내게 없는 지지를 채워 준다
  | 'meshes'       // 합이 많다 — 자연스레 맞물린다
  | 'intense'      // 그 사람 원국에 과다 오행이 있다 — 기세가 한쪽으로 쏠렸다
  | 'sparse'       // 그 사람 원국에 부재 오행이 있다 — 비어 있는 자리가 있다
  | 'sturdy'       // 신강 — 밀도가 높다
  | 'yielding'     // 신약 — 주위를 타는 결
  | 'season';      // 계절이 상보 — 한난이 맞는다

/** 지도 위의 한 사람. */
export type RelationNode = {
  id: string;
  /** 역할(십신 5분류) */
  role: RelationRole;
  /** 상대 일간 오행 — 색·아이콘의 기준(보정과 무관하게 '그 사람의 글자') */
  dayElem: Element;
  /** 역할 판정에 실제로 쓰인 오행(보정되면 dayElem 과 다르다) */
  basisElem: Element;
  /** 세력 보정이 걸렸는가 — 걸렸으면 화면이 이유를 밝혀야 한다 */
  adjusted: boolean;
  /** 보정 사유(없으면 null). 예: '일간은 水지만 원국에 土가 과다' */
  adjustNote: string | null;
  /** 케미 0~100 — 궁합 6기준(R47)에서 나온 점수. 역할과 **별개 축**이다 */
  chemi: number;
  /** ★이 사람만의 결 — 강한 순으로 최대 2개(같은 역할끼리 구분되게) */
  traits: RelationTrait[];
  /** 궁합 상세(화면이 '조심할 점' 등을 뽑아 쓴다) */
  dx: CompatibilityDx;
};

/** 지도 전체 요약. */
export type RelationMapSummary = {
  /** 역할별 인원 */
  counts: Record<RelationRole, number>;
  /**
   * 주고받는 균형 — 내가 **주는** 쪽(식상·재성)과 **받는** 쪽(인성)의 인원 차.
   * 양수면 주는 관계가 많다(에너지가 나가는 구성).
   */
  giveTakeGap: number;
  /** 내 원국에서 **부재**(0자)인 오행 — 그 기운을 가진 사람이 귀하다 */
  lackingElems: Element[];
  /** 내 원국에서 과다(4+)인 오행 */
  excessElems: Element[];
};

/**
 * 두 오행의 관계 → 역할.
 * @param mine 내 (일간) 오행 · @param theirs 상대의 (판정) 오행
 */
export function roleOf(mine: Element, theirs: Element): RelationRole {
  if (theirs === mine) return '비견';
  if (SHENG_TO[theirs] === mine) return '인성';   // 상대가 나를 낳는다
  if (SHENG_TO[mine] === theirs) return '식상';   // 내가 상대를 낳는다
  if (KE_TO[mine] === theirs) return '재성';      // 내가 상대를 누른다
  return '관성';                                   // 남은 하나 = 상대가 나를 누른다
}

/**
 * 상대 한 명의 **판정 오행**을 정한다 — 일간이 기본, 원국에 과다 오행이 있으면 그쪽.
 *
 * @returns 판정 오행 + 보정 여부 + 사유
 * ★ '과다' 판정은 `elementPower().labels` 를 그대로 쓴다(임계값을 여기서 새로 만들지 않는다).
 */
function basisElemOf(chart: SajuChart): { elem: Element; adjusted: boolean; note: string | null } {
  const day = chart.dayMaster.element as Element;
  const ep = elementPower(chart, { hap: true, johuGung: true });
  // 과다(4자 이상)인 오행 중 일간과 다른 것 — 여럿이면 세력이 가장 큰 것
  const excess = (Object.entries(ep.labels) as [Element, string][])
    .filter(([el, label]) => label === '과다' && el !== day)
    .sort((a, b) => (ep.power[b[0]] ?? 0) - (ep.power[a[0]] ?? 0));
  if (!excess.length) return { elem: day, adjusted: false, note: null };
  const el = excess[0][0];
  return { elem: el, adjusted: true, note: `일간은 ${day}지만 원국에 ${el}이(가) 과다` };
}

/**
 * 관계 지도를 만든다.
 *
 * @param me      나의 원국
 * @param others  등록해 둔 사람들(id 는 화면이 이름·카테고리와 잇는 열쇠)
 * @returns 케미 높은 순으로 정렬된 노드 + 요약
 *
 * ⚠️상대가 0명이어도 정상 동작한다(빈 지도 + 내 원국 요약) — 화면이 "친구를 더해 보세요"를 띄운다.
 */
/**
 * 이 사람의 결을 강한 순으로 고른다(최대 2개).
 *
 * 순서가 곧 우선순위다 — 위에 있을수록 **관계에서 먼저 체감되는 것**을 놓았다.
 * ⚠️임계값(충 3건·합 2건 등)은 "몇 건이면 눈에 띄나"를 정한 것이고, 명리 판정이 아니다.
 *   판정 자체는 전부 기존 엔진(analyzeCompatibility·elementPower·classifyStrength)이 한다.
 */
function traitsOf(dx: CompatibilityDx, theirs: SajuChart): RelationTrait[] {
  const out: RelationTrait[] = [];
  const ep = elementPower(theirs, { hap: true, johuGung: true });
  const has = (l: string) => Object.values(ep.labels).includes(l as never);

  if (dx.spousePalace.afflictions.length) out.push('clash');      // 가장 먼저 체감된다
  if (dx.tension.length >= 3) out.push('friction');
  if (dx.missingFill.chars.length >= 2) out.push('fills');
  if (dx.harmony.length >= 2) out.push('meshes');
  if (has('과다')) out.push('intense');
  const st = classifyStrength(theirs).type;
  if (st === '신강' || st === '신왕') out.push('sturdy');
  else if (st === '신약') out.push('yielding');
  if (has('부재')) out.push('sparse');
  if (dx.seasonComplement.complementary) out.push('season');

  return out.slice(0, 2);
}

export function buildRelationMap(
  me: SajuChart,
  others: { id: string; chart: SajuChart }[],
): { nodes: RelationNode[]; summary: RelationMapSummary } {
  const mineElem = me.dayMaster.element as Element;

  const nodes: RelationNode[] = others.map((o) => {
    const b = basisElemOf(o.chart);
    const dx = analyzeCompatibility(me, o.chart);
    return {
      id: o.id,
      role: roleOf(mineElem, b.elem),
      dayElem: o.chart.dayMaster.element as Element,
      basisElem: b.elem,
      adjusted: b.adjusted,
      adjustNote: b.note,
      chemi: chemiOf(dx),
      traits: traitsOf(dx, o.chart),
      dx,
    };
  }).sort((a, b) => b.chemi - a.chemi);

  // ── 요약 ────────────────────────────────────────────────────────────────
  const counts: Record<RelationRole, number> = { 인성: 0, 비견: 0, 식상: 0, 재성: 0, 관성: 0 };
  for (const n of nodes) counts[n.role]++;

  const myEp = elementPower(me, { hap: true, johuGung: true });
  const lackingElems = (Object.entries(myEp.labels) as [Element, string][])
    .filter(([, l]) => l === '부재').map(([el]) => el);
  const excessElems = (Object.entries(myEp.labels) as [Element, string][])
    .filter(([, l]) => l === '과다').map(([el]) => el);

  return {
    nodes,
    summary: {
      counts,
      // 주는 쪽(식상=내가 쏟는 · 재성=내가 다루는) − 받는 쪽(인성=날 채워주는)
      giveTakeGap: counts['식상'] + counts['재성'] - counts['인성'],
      lackingElems,
      excessElems,
    },
  };
}

/**
 * 케미 0~100 — 궁합 6기준(R47)을 지도용으로 환산한다.
 *
 * ★왜 `compatScore` 를 안 부르나: 그건 앱(`app/src/lib/content`)에 있어서 엔진이 의존하면
 *   방향이 거꾸로 선다(L1 이 L4 를 참조). 대신 **같은 6기준·같은 서열**을 쓴다 —
 *   가중치가 갈리면 "궁합 78점인데 지도엔 62"처럼 앱 안에서 말이 어긋난다.
 *   ⚠️`compatScore` 를 고치면 여기도 같이 고쳐야 한다(check:relationmap 이 이 정합을 본다).
 */
function chemiOf(dx: CompatibilityDx): number {
  const dmBonus =
    dx.dayMasterRelation.type === '충' ? 7 :
    dx.dayMasterRelation.type === '상생' ? 5 :
    dx.dayMasterRelation.type === '합' ? 4 :
    dx.dayMasterRelation.type === '비화' ? 2 : 0;
  const supply = { 강: 8, 중: 5, 약: 2, 없음: 0 }[dx.usefulGodSupply.supply] ?? 0;

  const raw = 50
    + (dx.seasonComplement.complementary ? 8 : 0)      // 계절 한난 상보
    + (dx.partnerToMe.favorable ? 10 : 0)              // 상대→나 재/관
    + Math.min(dx.missingFill.chars.length, 3) * 3     // 결핍 지지 보완
    + dmBonus + supply
    + Math.min(dx.harmony.length, 4) * 2               // 합
    - Math.min(dx.tension.length, 4) * 2               // 충형파해
    - Math.min(dx.spousePalace.afflictions.length, 3) * 3; // 배우자궁 흉

  return Math.max(1, Math.min(99, Math.round(raw)));   // 0·100 은 쓰지 않는다(단정 회피)
}
