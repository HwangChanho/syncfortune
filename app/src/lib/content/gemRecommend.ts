// app/src/lib/content/gemRecommend.ts — R-GEM v0.1 L1 보석 추천 엔진 (온디바이스·결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 무료 바이럴 퍼널: "생일 보석(서양)은 사실 당신 사주와 어긋나요 → 당신을 살리는 진짜 보석은 이거예요".
//   전부 결정론 룰(LLM 아님·API 0). 카피는 gemCopy.ts(온디바이스 템플릿).
//
// ▶ 계약(발명 금지 — 기존 결정론 재사용):
//   · 용신/희신/기신 오행 = computeYongsinApprox(yongsinApprox.ts) 단일 출처.
//       primaryGem=용신 / secondaryGem=희신 / avoidGem=기신. (앱·Edge·골든이 같은 canonical에 위임 = 드리프트 0.)
//   · 보석 데이터 = gemMapping.ts(오행→3티어·서양탄생석→오행). 이 파일은 '조립'만.
//
// ▶ 조후 오버라이드(안 A · 월지 하드코딩 = daniel CONFIRMED):
//   원국이 한난(寒暖)으로 극단이면 억부 용신보다 '조후(기후 균형)'가 급하다 —
//     · 월지 ∈ {亥子丑}(극한) & 원국에 火 부재 → 주보석 = 火(basis='johu_override')
//     · 월지 ∈ {巳午未}(극서) & 원국에 水 부재 → 주보석 = 水(basis='johu_override')
//   secondary/avoid는 오버라이드 시에도 억부(computeYongsinApprox) 결과 유지 — 주보석만 조후로 교체.
//   ※'원국 오행 부재' 판정 = 4주 천간 오행 + 지지 본기 오행에 해당 오행이 하나도 없음.
//
// ▶ matchType = 주보석 오행 === 서양탄생석 오행 ? 'match' : 'debunk'. (대부분 debunk = 바이럴 훅)
// ▶ avoidGem(피하면 좋은 보석)은 '계산만' — 화면 노출 여부는 gem.tsx가 결정(무료 카드는 비노출).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, Element, PillarPos } from '@spec/chart';
import { stemElement, branchElement } from '../engine/ohaeng';         // 천간·지지 → 오행(온디바이스 룰)
import { computeYongsinApprox } from './yongsinApprox';                 // 용신·희신·기신 단일 출처(canonical 위임)
import { ELEMENT_GEMS, westernBirthstoneOf, type GemTiers, type WesternBirthstone } from './gemMapping';

/** 주보석 선택 근거 — 억부 계열 용신 경로(기본) vs 조후 오버라이드(한난 극단 보정). */
//   ※'eokbu' = computeYongsinApprox(억부·병약·조후 등 canonical) 결과를 그대로 쓴 경우 = 조후 오버라이드 미발동.
//     canonical 내부 method 는 병약일 수도 있으나(daniel 辛丑), 이 flag 는 '조후 하드코딩 오버라이드' 발동 여부만 구분한다.
export type GemBasis = 'eokbu' | 'johu_override';

/** 한 오행에 대한 보석 픽(3티어). */
export interface GemPick {
  element: Element;  // 이 픽의 오행
  tiers: GemTiers;   // 프리미엄/스탠다드/버짓 3종
}
/** 주보석 픽 = GemPick + 선택 근거(basis). */
export interface PrimaryGemPick extends GemPick {
  basis: GemBasis;
}

/** recommendGem 출력 스키마(daniel CONFIRMED). */
export interface GemRecommendation {
  primaryGem: PrimaryGemPick;             // 용신(또는 조후 오버라이드) 보석 — 화면 주인공
  secondaryGem: GemPick | null;           // 희신 보석 — 보조(희신 없으면 null)
  avoidGem: GemPick;                       // 기신 보석 — 계산만(무료 카드 비노출)
  westernBirthstone: WesternBirthstone;    // 생월 서양 탄생석(대조용)
  matchType: 'match' | 'debunk';           // 주보석 오행 == 서양탄생석 오행?
}

/** 조후 오버라이드 트리거 월지(지지). */
const JOHU_WINTER = new Set(['亥', '子', '丑']); // 극한(겨울) → 火 온기 필요
const JOHU_SUMMER = new Set(['巳', '午', '未']); // 극서(여름) → 水 냉기 필요

/**
 * 원국 4주의 '천간 오행 + 지지 본기 오행' 집합을 만든다(조후 오버라이드의 '오행 부재' 판정용).
 * @param saju 원국. 시주가 없을(시각 미상) 수 있어 존재하는 기둥만 집계한다.
 * @returns 원국에 실재하는 오행 Set.
 */
function natalElementSet(saju: SajuChart): Set<Element> {
  const present = new Set<Element>();
  const posList: PillarPos[] = ['년', '월', '일', '시'];
  for (const p of posList) {
    const pd = saju.pillars?.[p];
    if (!pd) continue;                                    // 시각 미상 등으로 기둥이 없으면 건너뜀
    present.add(stemElement(pd.stem) as Element);         // 천간 오행
    present.add(branchElement(pd.branch) as Element);     // 지지 본기 오행
  }
  return present;
}

/**
 * 사주 + 양력 생월 → 보석 추천(결정론·API 0).
 * @param saju 대표 명식의 원국(computeChart(input).saju). 용신·희신·기신은 여기서 computeYongsinApprox로 산출.
 * @param birthMonth 양력 생월(1~12). 서양 탄생석 대조용. (음력 입력은 호출측이 양력으로 변환해 전달 — 백로그)
 * @returns primary/secondary/avoid 보석 + 서양탄생석 + match/debunk 판정.
 */
export function recommendGem(saju: SajuChart, birthMonth: number): GemRecommendation {
  // ── ① 용신·희신·기신 오행(단일 출처) ──────────────────────────────────
  const y = computeYongsinApprox(saju);
  let primaryEl: Element = y.yongsin;       // 주보석 = 용신
  const secondaryEl: Element | null = y.huisin; // 보조 = 희신(없을 수 있음)
  const avoidEl: Element = y.gisin;         // 피할 보석 = 기신

  // ── ② 조후 오버라이드(월지 하드코딩·한난 극단 보정) ──────────────────
  //   주보석만 교체(secondary/avoid는 억부 유지). '원국 오행 부재'일 때만 발동.
  let basis: GemBasis = 'eokbu';
  const monthBranch = saju.pillars?.['월']?.branch as string | undefined;
  const present = natalElementSet(saju);
  if (monthBranch && JOHU_WINTER.has(monthBranch) && !present.has('火')) {
    primaryEl = '火'; basis = 'johu_override';   // 겨울 극한 + 火 없음 → 온기 보석
  } else if (monthBranch && JOHU_SUMMER.has(monthBranch) && !present.has('水')) {
    primaryEl = '水'; basis = 'johu_override';   // 여름 극서 + 水 없음 → 냉기 보석
  }

  // ── ③ 보석 픽 조립 ────────────────────────────────────────────────────
  const primaryGem: PrimaryGemPick = { element: primaryEl, tiers: ELEMENT_GEMS[primaryEl], basis };
  const secondaryGem: GemPick | null = secondaryEl
    ? { element: secondaryEl, tiers: ELEMENT_GEMS[secondaryEl] }
    : null;
  const avoidGem: GemPick = { element: avoidEl, tiers: ELEMENT_GEMS[avoidEl] };

  // ── ④ 서양 탄생석 대조 + match/debunk ────────────────────────────────
  //   범위 밖 월(방어): 3월 아쿠아마린으로 폴백하지 않고, 안전하게 존재 월만 사용 — 여기선 1~12 보장 가정.
  const westernBirthstone = westernBirthstoneOf(birthMonth) ?? WESTERN_FALLBACK;
  const matchType: 'match' | 'debunk' = primaryEl === westernBirthstone.element ? 'match' : 'debunk';

  return { primaryGem, secondaryGem, avoidGem, westernBirthstone, matchType };
}

// 생월이 1~12 밖(잘못된 입력)일 때의 안전 폴백 — UI 크래시 방지용(정상 경로에선 사용 안 됨).
const WESTERN_FALLBACK: WesternBirthstone = { month: 0, gem: 'unknown', ko: '탄생석 정보 없음', element: '土' };
