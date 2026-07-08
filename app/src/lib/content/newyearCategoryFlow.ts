// app/src/lib/content/newyearCategoryFlow.ts — 신년 카테고리별 12개월 흐름(결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-08 stance: 카테고리 곡선 = **관련 십성의 활성도 × 그 십성의 희기 부호**(이중 구조).
//   ★"관련 십성이 오면 +"인 원시 매핑 금지. 재다신약 재운 오면 재물 곡선은 내려가야 한다(쟁재·부담).
//   부호는 억부 희기 벡터(scoreOf=용신+2/희신+1/한신0/구신−1/기신−2)가 정한다 → "재가 있어도 일간이 힘이 있어야 취한다"가 인코딩됨.
//
// ▶ ★3레이어 위계(daniel 2026-07-08 — 고전 대운>세운>월운, R45 세운 체인 정합):
//     month = 월운(AC 진동 ×1.0) + 대운 backdrop(DC ×1.0) + 세운 backdrop(DC ×0.6)
//   · DC(대운·세운) = 그 해의 기준선 → 연도 간 순위 결정(대운 > 세운이라야 "壬申이라서 좋은 해"가 "세운이 좋아서"에 안 짐).
//   · AC(월운) = 연내 질감만(진동). 대운/세운 없이 월운만 합치면 같은 대운 10년이 동일 곡선(2026≠2029 구분).
//   · 스케일 통일: 천간·지지 기여를 layer마다 동일 스케일로 두고 layer 가중(1.0/0.6/1.0)으로만 위계 형성.
//
// ▶ 대운 채점 2보정(daniel):
//   ① 전후반 위상 전환 — 간지 합산 상수로 뭉개지 말고 전반5년 천간0.7/지지0.3, 후반5년 지지0.7/천간0.3(비율).
//      "몇 살에 피크냐"를 가르는 정보(대운수 7이면 壬申 전반=壬 상관 색, 후반=申 뿌리 쪽).
//   ② 착근 부스트 — Q5 무근 진폭감쇄의 역방향. 대운 천간이 대운 지지 지장간에 통근하면 그 천간 세력 부스트.
//      ★daniel 辛丑: 壬이 申에 통근(申 중기 壬水)한 채 오는 게 壬申을 구조적 피크로. 착근 없이 천간만 매기면 壬 단독 세운급 과소평가.
//   ─ v2 백로그: 대운·세운 합충 상호작용(세운이 대운 지지 충) · 애정 R46.8 인다예외 · 직업 격국 · 이동 지지충 · 건강 독립산식.
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, branchElement } from '../engine/ohaeng';
import { computeYongsinApprox, yongsinToClass5, type HuiGiClass } from './yongsinApprox';
import { HIDDEN } from '@engine/saju';                                        // 지장간(여기/중기/본기) — 착근 판정 재사용
import type { SajuChart, Element, Stem, Branch } from '@spec/chart';

const GEN: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const CLASS_SCORE: Record<HuiGiClass, number> = { 용신: 2, 희신: 1, 한신: 0, 구신: -1, 기신: -2 };
const YEOKMA = new Set<Branch>(['寅', '申', '巳', '亥']);

// 레이어 가중(DC 위계·AC 진동) + 대운 위상(비율 7:3, 천간+지지 합=2 로 스케일 통일) + 착근 부스트(통근 깊이).
const DAEUN_W = 1.0, SEUN_W = 0.6, WOLUN_W = 1.0;
const PHASE_EARLY: [number, number] = [1.4, 0.6];   // 전반: 천간 우세(7:3 → 합 2)
const PHASE_LATE: [number, number] = [0.6, 1.4];    // 후반: 지지 우세
const ROOT_BOOST: Record<'본기' | '중기' | '여기', number> = { 본기: 1.4, 중기: 1.25, 여기: 1.1 };

export type NewyearCategory =
  | 'general' | 'work' | 'business' | 'money' | 'love'
  | 'marriage' | 'health' | 'social' | 'growth' | 'move';

export const NEWYEAR_FLOW_CATEGORIES: NewyearCategory[] =
  ['general', 'work', 'business', 'money', 'love', 'marriage', 'health', 'social', 'growth', 'move'];

type Weighted = { el: Element; w: number }[];

function sipseongElements(dayEl: Element) {
  const gwan = (Object.keys(KE) as Element[]).find((e) => KE[e] === dayEl)!;
  const inseong = (Object.keys(GEN) as Element[]).find((e) => GEN[e] === dayEl)!;
  return { 비겁: dayEl, 식상: GEN[dayEl], 재성: KE[dayEl], 관성: gwan, 인성: inseong };
}

/** 카테고리 → 가중 십성(활성 필터). null = 전체 부합(general/health). [] = 특수(move=역마). 애정/결혼 성별 분리. */
function categoryElements(S: ReturnType<typeof sipseongElements>, cat: NewyearCategory, male: boolean): Weighted | null {
  switch (cat) {
    case 'general': return null;
    case 'health': return null;                                           // 통합 재사용(LOW conf·v2 분리)
    case 'work': return [{ el: S.관성, w: 0.6 }, { el: S.인성, w: 0.4 }];
    case 'business': return [{ el: S.재성, w: 1.0 }, { el: S.식상, w: 0.5 }];
    case 'money': return [{ el: S.재성, w: 1.0 }, { el: S.식상, w: 0.5 }]; // 재성 주축 + 식상 보조(식상생재)
    case 'love':
    case 'marriage':
      return male ? [{ el: S.재성, w: 1.0 }, { el: S.식상, w: 0.5 }]        // 남명 재 주축 + 식상 보조
                  : [{ el: S.관성, w: 1.0 }, { el: S.재성, w: 0.5 }];       // 여명 관 주축 + 재 보조(재생관)
    case 'social': return [{ el: S.비겁, w: 1.0 }, { el: S.식상, w: 0.5 }]; // 비겁 + 식상(인성 제거)
    case 'growth': return [{ el: S.인성, w: 1.0 }];
    case 'move': return [];
  }
}

export interface NewyearCategoryFlow {
  year: number;
  hasMonths: boolean;
  daeunPhase: 'early' | 'late' | null;                 // 대운 전/후반(검수: 후반 피크 확인용)
  flows: Record<NewyearCategory, number[]>;
  lowConf: NewyearCategory[];
  usefulEl: Element;
  hasUseful: boolean;
}

/**
 * 신년 카테고리별 12개월 흐름(3레이어: 월운 AC + 대운/세운 DC · 이중 구조 활성×희기). daniel 07-08 stance.
 * @param opts.gender 남/여(애정·결혼 성별 분리). 미상 시 남명 폴백.
 */
export function newyearCategoryFlow(
  saju: SajuChart, year: number, opts?: { gender?: '남' | '여'; timeUnknown?: boolean },
): NewyearCategoryFlow {
  const timeUnknown = opts?.timeUnknown ?? (saju as any)?.timeUnknown === true;
  const male = opts?.gender !== '여';
  const ya = computeYongsinApprox(saju, { timeUnknown });
  const scoreOf = (el: Element) => CLASS_SCORE[yongsinToClass5(el, ya)];   // ★부호 소스(이중 구조)
  const dayEl = stemElement(saju.pillars['일'].stem) as Element;
  const S = sipseongElements(dayEl);

  // 대상 신년이 속한 대운 + 세운(월운 포함) + 전후반 위상 확정.
  let dae: { stem: Stem; branch: Branch } | null = null;
  let seun: { stem: Stem; branch: Branch } | null = null;
  let months: { stem: Stem; branch: Branch }[] = [];
  let phase: 'early' | 'late' | null = null;
  for (const lc of saju.luckCycles ?? []) {
    const idx = (lc.annuals ?? []).findIndex((x) => x.year === year);
    if (idx >= 0) {
      const a = lc.annuals![idx];
      dae = { stem: lc.stem, branch: lc.branch };
      seun = { stem: a.stem, branch: a.branch };
      months = a.months ?? [];
      phase = idx < 5 ? 'early' : 'late';                                  // 대운 10년 중 전반(0~4)/후반(5~9)
      break;
    }
  }
  const hasMonths = months.length === 12;

  // 干支 → 카테고리 점수(활성 × 희기 × 가중). cheonW/jiW = 천간·지지 스케일(대운 위상용), rootBoost = 대운 착근(천간).
  const score = (stem: Stem, branch: Branch, weighted: Weighted | null, cheonW: number, jiW: number, rootBoost: number, isMove: boolean): number => {
    const se = stemElement(stem) as Element, be = branchElement(branch) as Element;
    if (isMove) return YEOKMA.has(branch) ? scoreOf(se) * cheonW + scoreOf(be) * jiW : 0;
    if (weighted === null) return scoreOf(se) * cheonW + scoreOf(be) * jiW;   // general/health = 전체 부합
    let sc = 0;
    for (const { el, w } of weighted) {
      if (se === el) sc += scoreOf(se) * w * cheonW * rootBoost;             // 천간 활성(착근 부스트는 천간 세력)
      if (be === el) sc += scoreOf(be) * w * jiW;                            // 지지 활성
    }
    return sc;
  };

  // 대운 천간 착근 depth(대운 지지 지장간에 대운 천간 오행 통근) → 천간 세력 부스트.
  const daeRootBoost = (() => {
    if (!dae) return 1;
    const se = stemElement(dae.stem);
    const hit = (HIDDEN[dae.branch] ?? []).find((h) => stemElement(h.stem) === se);
    return hit ? ROOT_BOOST[hit.role] : 1;
  })();
  const [pcE, pjE] = phase === 'late' ? PHASE_LATE : PHASE_EARLY;           // 대운 위상 천간/지지 스케일

  const flows = {} as Record<NewyearCategory, number[]>;
  for (const cat of NEWYEAR_FLOW_CATEGORIES) {
    const weighted = categoryElements(S, cat, male);
    const isMove = cat === 'move';
    // DC backdrop(그 해 상수): 대운(위상+착근) + 세운(단순).
    const daeBd = dae ? score(dae.stem, dae.branch, weighted, pcE, pjE, daeRootBoost, isMove) * DAEUN_W : 0;
    const seBd = seun ? score(seun.stem, seun.branch, weighted, 1, 1, 1, isMove) * SEUN_W : 0;
    flows[cat] = months.map((m) => score(m.stem, m.branch, weighted, 1, 1, 1, isMove) * WOLUN_W + daeBd + seBd);
  }

  return { year, hasMonths, daeunPhase: phase, flows, lowConf: ['health'], usefulEl: ya.yongsin, hasUseful: !ya.jonggyeokHold };
}
