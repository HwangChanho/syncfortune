// app/src/lib/content/newyearCategoryFlow.ts — 신년 카테고리별 12개월 흐름(결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-08: 신년운세에 "월별 감정 흐름"을 카테고리별 그래프로. 스코어링 = **합성(활성 × 부합)**.
//   · 활성(activation): 그 달 월운 오행(천간/지지)이 그 카테고리의 십성 오행이면 그 영역이 '켜진' 달.
//   · 부합(direction) : 그 오행이 억부용신 5단(용신+2/희신+1/한신0/구신−1/기신−2)에서 길/흉 어디인지.
//   · score = 활성인 오행의 부합 점수 합. 활성 아니면 0(그 영역이 조용한 달). → 곡선 = 그 영역이 '언제 얼마나 좋게/나쁘게 움직이나'.
//   ★ newyearGauge.ts 와 동일 소스(computeYongsinApprox·yongsinToClass5·월운 luckCycles[].annuals[].months) 재사용 — 발명 아님.
//     차이는 딱 하나: newyearGauge 는 카테고리 무관 전체 부합(천간+지지 합), 여기는 카테고리 십성으로 '활성 필터'를 건다.
//
// ⚠️ 카테고리→십성 매핑은 daniel 제안(구조 hook·판정 슬롯). general/health = 활성 필터 없이 전체 부합(용신층).
//    love/marriage 는 재/관 오행(도화·배우자궁 정밀화는 v2), move 는 역마 지지(寅申巳亥) 활성(충 정밀화 v2).
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, branchElement } from '../engine/ohaeng';                 // 천간·지지 → 오행(木火土金水)
import { computeYongsinApprox, yongsinToClass5, type HuiGiClass } from './yongsinApprox'; // 억부용신 방향 소스(newyearGauge 와 단일 소스)
import type { SajuChart, Element, Stem, Branch } from '@spec/chart';

// 오행 상생/상극(십성 오행 도출용) — R2 준거. 재성=일간이 극, 식상=일간이 생, 관성=일간을 극, 인성=일간을 생.
const GEN: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
// 5단 → 점수(newyearGauge W 와 동일 스케일 ±2/±1 유지).
const CLASS_SCORE: Record<HuiGiClass, number> = { 용신: 2, 희신: 1, 한신: 0, 구신: -1, 기신: -2 };
const YEOKMA = new Set<Branch>(['寅', '申', '巳', '亥']);                       // 역마 지지(이동 활성)

export type NewyearCategory =
  | 'general' | 'work' | 'business' | 'money' | 'love'
  | 'marriage' | 'health' | 'social' | 'growth' | 'move';

export const NEWYEAR_FLOW_CATEGORIES: NewyearCategory[] =
  ['general', 'work', 'business', 'money', 'love', 'marriage', 'health', 'social', 'growth', 'move'];

/** 일간 오행 기준 5분류 십성 오행. */
function sipseongElements(dayEl: Element) {
  const gwan = (Object.keys(KE) as Element[]).find((e) => KE[e] === dayEl)!;   // 나를 극하는 오행 = 관성
  const inseong = (Object.keys(GEN) as Element[]).find((e) => GEN[e] === dayEl)!; // 나를 생하는 오행 = 인성
  return { 비겁: dayEl, 식상: GEN[dayEl], 재성: KE[dayEl], 관성: gwan, 인성: inseong };
}

/** 카테고리 → 활성 오행 세트(daniel 제안 hook). null = 활성 필터 없이 전체 부합(general/health). move = 특수(역마 지지). */
function categoryElements(S: ReturnType<typeof sipseongElements>, cat: NewyearCategory): Element[] | null {
  switch (cat) {
    case 'general': return null;                 // 통합 = 용신 부합(전체)
    case 'health': return null;                  // 건강 = 일간 강약 ≈ 용신 부합(v2 정밀화)
    case 'work': return [S.관성, S.인성];        // 직업 = 관인상생
    case 'business': return [S.재성, S.식상];    // 사업 = 식신생재
    case 'money': return [S.재성];               // 재물 = 재성
    case 'love': return [S.재성, S.관성];        // 애정 = 재/관(도화 v2)
    case 'marriage': return [S.재성, S.관성];    // 결혼 = 배우자성 재/관(일지 v2)
    case 'social': return [S.비겁, S.인성];      // 대인 = 비겁·인성
    case 'growth': return [S.인성];              // 배움 = 인성
    case 'move': return [];                       // 이동 = 역마 지지(아래 특수 처리)
  }
}

export interface NewyearCategoryFlow {
  year: number;                                   // 대상 신년
  hasMonths: boolean;                             // 12월운 확보 여부(false=그래프 생략)
  /** 카테고리별 12개월 점수(1월~12월, 절기월 기준 정렬은 소비처가 라벨링). general/health ≈ −4~+4, 그 외 활성 스파이크. */
  flows: Record<NewyearCategory, number[]>;
  usefulEl: Element;                              // 쓴 용신 오행(검수용)
  hasUseful: boolean;                             // 억부 신뢰도(false=종격 후보 보류)
}

/**
 * 신년 카테고리별 12개월 흐름(합성 활성×부합). NewyearTeaser/유료 newyear 화면이 이 결과로 카테고리 선택형 곡선을 그린다.
 * @param saju 대표 명식(원국 + luckCycles[].annuals[].months). computeChart 산출값.
 * @param year 대상 신년(예 2027). 그 해 월운을 luckCycles 에서 찾는다.
 * @param opts timeUnknown(시각 미상 → 억부 그룹강도에 반영).
 */
export function newyearCategoryFlow(saju: SajuChart, year: number, opts?: { timeUnknown?: boolean }): NewyearCategoryFlow {
  const timeUnknown = opts?.timeUnknown ?? (saju as any)?.timeUnknown === true;
  const ya = computeYongsinApprox(saju, { timeUnknown });
  const scoreOf = (el: Element) => CLASS_SCORE[yongsinToClass5(el, ya)];
  const dayEl = stemElement(saju.pillars['일'].stem) as Element;
  const S = sipseongElements(dayEl);

  // 대상 신년의 12월운(절기월) — newyearGauge 와 동일 조회 경로.
  let months: { stem: Stem; branch: Branch }[] = [];
  for (const lc of saju.luckCycles ?? []) {
    const a = (lc.annuals ?? []).find((x) => x.year === year);
    if (a?.months?.length) { months = a.months; break; }
  }
  const hasMonths = months.length === 12;

  const flows = {} as Record<NewyearCategory, number[]>;
  for (const cat of NEWYEAR_FLOW_CATEGORIES) {
    const els = categoryElements(S, cat);
    flows[cat] = months.map((m) => {
      const se = stemElement(m.stem) as Element, be = branchElement(m.branch) as Element;
      if (cat === 'move') {
        // 이동: 지지 역마 활성 × 방향(그 달 전체 부합). 역마 아니면 0.
        return YEOKMA.has(m.branch) ? scoreOf(se) + scoreOf(be) : 0;
      }
      if (els === null) return scoreOf(se) + scoreOf(be);   // general/health = 전체 부합(−4~+4)
      // 활성 × 부합: 천간/지지 오행이 카테고리 십성일 때만 그 오행의 희기 가산(그 외 오행은 0).
      let sc = 0;
      if (els.includes(se)) sc += scoreOf(se);
      if (els.includes(be)) sc += scoreOf(be);
      return sc;
    });
  }

  return { year, hasMonths, flows, usefulEl: ya.yongsin, hasUseful: !ya.jonggyeokHold };
}
