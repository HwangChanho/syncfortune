// app/src/lib/content/newyearCategoryFlow.ts — 신년 카테고리별 12개월 흐름(결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-08 stance: 카테고리 곡선 = **관련 십성의 활성도 × 그 십성의 희기 부호**(이중 구조).
//   ★"관련 십성이 오면 +"인 원시 매핑 금지. 재다신약 차트에 재운 오면 재물 곡선은 내려가야 한다(쟁재·부담).
//   → 카테고리 매핑은 "어떤 십성을 볼지(활성 필터)"만 정하고, **부호는 기존 희기 벡터(scoreOf)가 정한다**.
//     scoreOf(오행) = CLASS_SCORE[yongsinToClass5(오행, ya)] = 용신+2/희신+1/한신0/구신−1/기신−2 → 신강 재=희(+)·신약 재=기(−).
//     즉 "재가 있어도 일간이 힘이 있어야 취한다"(daniel 독트린)가 희기 벡터에 이미 인코딩됨 = 일간 강약 게이트.
//   ★ newyearGauge.ts 와 동일 소스(computeYongsinApprox·yongsinToClass5·월운 luckCycles[].annuals[].months) 재사용.
//
// ── daniel 2026-07-08 매핑 스탠스(구조 hook·검수 반영) ─────────────────────────
//   재물   = 재성 주축(1.0) + 식상 보조(0.5)   ← 식상생재 유통이 재물의 절반(재성만 보면 무재성·식상생재형 놓침).
//   사업   = 재성 + 식상(동등)                  ← 재물과 동일 희기 게이트 공유.
//   애정·결혼 = ★성별 분리 필수. 남명=재 주축+식상 보조 / 여명=관 주축+재 보조(재생관). 재관 통합 금지(남명 관운이 애정 밀어올림 오류).
//   직업   = 관 0.6 + 인 0.4                    ← 관인상생. (식상격 직업축은 v2)
//   대인   = 비겁 주축(1.0) + 식상 보조(0.5)     ← 인성 제거(수용·문서·윗사람은 대인 일반과 거리). 사교·표현=식상. 비겁=신약 귀인/신강 쟁재라 이중 구조 필수.
//   배움   = 인성                               ← 이견 없음.
//   이동   = 역마 지지(寅申巳亥)                 ← v1 근사(실제 이동 절반은 일지·월지 충 → v2 백로그).
//   통합   = 전체 부합                          / 건강 = 통합 재사용 + LOW 신뢰도 마킹(v2 분리: 조후 이탈도 + 용신 오행 훼손 + 일지 충극).
// ─── v2 백로그: 애정 R46.8 인다 예외 오버라이드(남명 인다=식상운/여명 인다=재관운) · 직업 격국 가중 · 이동 지지 충 · 건강 독립 산식.
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, branchElement } from '../engine/ohaeng';
import { computeYongsinApprox, yongsinToClass5, type HuiGiClass } from './yongsinApprox';
import type { SajuChart, Element, Stem, Branch } from '@spec/chart';

const GEN: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const CLASS_SCORE: Record<HuiGiClass, number> = { 용신: 2, 희신: 1, 한신: 0, 구신: -1, 기신: -2 };
const YEOKMA = new Set<Branch>(['寅', '申', '巳', '亥']);

export type NewyearCategory =
  | 'general' | 'work' | 'business' | 'money' | 'love'
  | 'marriage' | 'health' | 'social' | 'growth' | 'move';

export const NEWYEAR_FLOW_CATEGORIES: NewyearCategory[] =
  ['general', 'work', 'business', 'money', 'love', 'marriage', 'health', 'social', 'growth', 'move'];

/** 활성 필터 = 볼 십성 오행 + 가중(주축 1.0·보조 0.5). 부호는 scoreOf(희기)가 정한다(이중 구조). */
type Weighted = { el: Element; w: number }[];

function sipseongElements(dayEl: Element) {
  const gwan = (Object.keys(KE) as Element[]).find((e) => KE[e] === dayEl)!;   // 나를 극 = 관성
  const inseong = (Object.keys(GEN) as Element[]).find((e) => GEN[e] === dayEl)!; // 나를 생 = 인성
  return { 비겁: dayEl, 식상: GEN[dayEl], 재성: KE[dayEl], 관성: gwan, 인성: inseong };
}

/** 카테고리 → 가중 십성(활성 필터). null = 전체 부합(general/health). [] = 특수(move=역마). 애정/결혼은 성별 분리. */
function categoryElements(S: ReturnType<typeof sipseongElements>, cat: NewyearCategory, male: boolean): Weighted | null {
  switch (cat) {
    case 'general': return null;                                           // 통합 = 전체 부합
    case 'health': return null;                                           // 건강 = 통합 재사용(LOW conf·v2 분리)
    case 'work': return [{ el: S.관성, w: 0.6 }, { el: S.인성, w: 0.4 }];  // 직업 = 관인
    case 'business': return [{ el: S.재성, w: 1.0 }, { el: S.식상, w: 0.5 }]; // 사업 = 재+식상
    case 'money': return [{ el: S.재성, w: 1.0 }, { el: S.식상, w: 0.5 }]; // 재물 = 재성 주축 + 식상 보조(식상생재)
    case 'love':
    case 'marriage':
      return male ? [{ el: S.재성, w: 1.0 }, { el: S.식상, w: 0.5 }]        // 남명 = 재 주축 + 식상 보조
                  : [{ el: S.관성, w: 1.0 }, { el: S.재성, w: 0.5 }];       // 여명 = 관 주축 + 재 보조(재생관)
    case 'social': return [{ el: S.비겁, w: 1.0 }, { el: S.식상, w: 0.5 }]; // 대인 = 비겁 + 식상(인성 제거)
    case 'growth': return [{ el: S.인성, w: 1.0 }];                        // 배움 = 인성
    case 'move': return [];                                                // 이동 = 역마 지지(특수)
  }
}

export interface NewyearCategoryFlow {
  year: number;
  hasMonths: boolean;
  flows: Record<NewyearCategory, number[]>;   // 카테고리별 12개월 점수(이중 구조·활성×희기부호)
  lowConf: NewyearCategory[];                  // 신뢰도 낮음(v1 근사) — 건강(통합 재사용) 등. UI 마킹용.
  usefulEl: Element;
  hasUseful: boolean;
}

/**
 * 신년 카테고리별 12개월 흐름(이중 구조: 활성 필터 × 희기 부호). daniel 07-08 stance.
 * @param saju 대표 명식(원국 + luckCycles[].annuals[].months).
 * @param year 대상 신년.
 * @param opts.gender 남/여(애정·결혼 성별 분리 필수). 미상 시 남명 취급(neutral 폴백).
 * @param opts.timeUnknown 시각 미상 → 억부 그룹강도 반영.
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

  let months: { stem: Stem; branch: Branch }[] = [];
  for (const lc of saju.luckCycles ?? []) {
    const a = (lc.annuals ?? []).find((x) => x.year === year);
    if (a?.months?.length) { months = a.months; break; }
  }
  const hasMonths = months.length === 12;

  const flows = {} as Record<NewyearCategory, number[]>;
  for (const cat of NEWYEAR_FLOW_CATEGORIES) {
    const weighted = categoryElements(S, cat, male);
    flows[cat] = months.map((m) => {
      const se = stemElement(m.stem) as Element, be = branchElement(m.branch) as Element;
      if (cat === 'move') return YEOKMA.has(m.branch) ? scoreOf(se) + scoreOf(be) : 0; // 역마 활성 × 그 달 부합
      if (weighted === null) return scoreOf(se) + scoreOf(be);                          // 통합/건강 = 전체 부합
      // 이중 구조: 활성(그 십성 오행이 월운 천간/지지에 있음) × 부호(그 오행의 희기 scoreOf) × 가중.
      let sc = 0;
      for (const { el, w } of weighted) {
        if (se === el) sc += scoreOf(se) * w;
        if (be === el) sc += scoreOf(be) * w;
      }
      return sc;
    });
  }

  return { year, hasMonths, flows, lowConf: ['health'], usefulEl: ya.yongsin, hasUseful: !ya.jonggyeokHold };
}
