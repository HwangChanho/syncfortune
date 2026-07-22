// app/src/lib/content/gemMapping.ts — R-GEM v0.1 정적 데이터(오행→보석 · 서양 탄생석→오행)
// ─────────────────────────────────────────────────────────────────────────
// R-GEM 모듈(용신 기반 보석 추천)의 '발명 없는' 정적 매핑 테이블. daniel CONFIRMED 스펙 그대로 인코딩.
//   · 오행(五行) → 보석 3티어(프리미엄/스탠다드/버짓) = 재물 그릇·예산대별 추천의 근거 데이터.
//   · 서양 탄생석(월별) → 오행 = "생일 보석 vs 사주 보석" 대조(디벙킹/매치)의 근거 데이터.
// ★이 파일은 순수 데이터만 — 판정 로직(용신 산출·조후 오버라이드·매치판정)은 gemRecommend.ts.
// ★★daniel 검수 슬롯: 서양 탄생석의 오행 배정 중 2·6·10월(자수정/진주·문스톤/오팔·투르말린)은
//    색·상징 해석이 갈릴 수 있어 stance 확인 필요(아래 표에 [검수] 표시). 오행→보석 3티어 배정도 검수 대상.
// ─────────────────────────────────────────────────────────────────────────
import type { Element } from '@spec/chart';

/** 보석 1종 — 영문 키(에셋·분석 식별자)와 한글 표시명. */
export interface Gem {
  key: string; // 영문 식별자(이미지 파일명·로깅 키·안정 참조). 예: 'imperial_topaz'
  ko: string;  // 한글 표시명(카드·화면 노출). 예: '임페리얼 토파즈'
}

/** 보석 3티어 — 같은 오행 안에서 예산대별 대표석(프리미엄>스탠다드>버짓). */
export type GemTier = 'premium' | 'standard' | 'budget';
export type GemTiers = Record<GemTier, Gem>;

// ── ① 오행 → 보석 3티어(daniel CONFIRMED) ────────────────────────────────
//   각 오행의 색·기운을 대표하는 보석을 고가→저가 3티어로. '대표석' = standard(중간가·가장 흔한 추천).
//   ※ 효능 단정 아님 — 어디까지나 '오행 기운과 색이 통하는 돌'(전통적 상징). 화면 카피에서 의료/재물 효능 단정 금지.
export const ELEMENT_GEMS: Record<Element, GemTiers> = {
  // 木(목) = 성장·초록. 에메랄드 / 페리도트 / 그린 아벤투린
  木: {
    premium: { key: 'emerald', ko: '에메랄드' },
    standard: { key: 'peridot', ko: '페리도트' },
    budget: { key: 'green_aventurine', ko: '그린 아벤투린' },
  },
  // 火(화) = 열정·붉음. 루비 / 가넷 / 카넬리안
  火: {
    premium: { key: 'ruby', ko: '루비' },
    standard: { key: 'garnet', ko: '가넷' },
    budget: { key: 'carnelian', ko: '카넬리안' },
  },
  // 土(토) = 안정·황금. 임페리얼 토파즈 / 시트린 / 타이거아이
  土: {
    premium: { key: 'imperial_topaz', ko: '임페리얼 토파즈' },
    standard: { key: 'citrine', ko: '시트린' },
    budget: { key: 'tigers_eye', ko: '타이거아이' },
  },
  // 金(금) = 결단·백색. 다이아몬드 / 화이트 사파이어 / 클리어 쿼츠
  金: {
    premium: { key: 'diamond', ko: '다이아몬드' },
    standard: { key: 'white_sapphire', ko: '화이트 사파이어' },
    budget: { key: 'clear_quartz', ko: '클리어 쿼츠' },
  },
  // 水(수) = 지혜·청색. 블루 사파이어 / 아쿠아마린 / 라피스 라줄리
  水: {
    premium: { key: 'blue_sapphire', ko: '블루 사파이어' },
    standard: { key: 'aquamarine', ko: '아쿠아마린' },
    budget: { key: 'lapis_lazuli', ko: '라피스 라줄리' },
  },
};

/** 오행의 '대표석'(카드·요약에 쓰는 1종) = standard 티어. 예: 土 → 시트린. */
export function representativeGem(el: Element): Gem {
  return ELEMENT_GEMS[el].standard;
}

// ── ② 서양 탄생석(월) → 오행(daniel CONFIRMED) ───────────────────────────
//   "생일 보석(서양 달력)"을 사주 오행으로 환산해, 내 용신 보석과 같은지(match) 다른지(debunk)를 대조한다.
//   색·상징 기준의 오행 배정 — [검수]는 daniel stance 확인 슬롯(색 해석이 갈릴 수 있는 월).
export interface WesternBirthstone {
  month: number;   // 1~12(양력 생월)
  gem: string;     // 영문 키(안정 참조)
  ko: string;      // 한글 표시명
  element: Element;// 이 탄생석을 사주 오행으로 환산한 값
}

export const WESTERN_BIRTHSTONE: Record<number, WesternBirthstone> = {
  1: { month: 1, gem: 'garnet', ko: '가넷', element: '火' },                    // 1월 가넷 = 붉은빛 → 火
  2: { month: 2, gem: 'amethyst', ko: '자수정', element: '火' },                // 2월 자수정 = 火 [검수: 보라색 → 火/水 갈림]
  3: { month: 3, gem: 'aquamarine', ko: '아쿠아마린', element: '水' },          // 3월 아쿠아마린 = 물빛 → 水
  4: { month: 4, gem: 'diamond', ko: '다이아몬드', element: '金' },             // 4월 다이아몬드 = 무색·강도 → 金
  5: { month: 5, gem: 'emerald', ko: '에메랄드', element: '木' },               // 5월 에메랄드 = 초록 → 木
  6: { month: 6, gem: 'pearl', ko: '진주·문스톤', element: '金' },              // 6월 진주/문스톤 = 金 [검수: 흰빛 → 金/水 갈림]
  7: { month: 7, gem: 'ruby', ko: '루비', element: '火' },                      // 7월 루비 = 붉은빛 → 火
  8: { month: 8, gem: 'peridot', ko: '페리도트', element: '木' },               // 8월 페리도트 = 연두 → 木
  9: { month: 9, gem: 'sapphire', ko: '사파이어', element: '水' },              // 9월 사파이어 = 청색 → 水
  10: { month: 10, gem: 'opal', ko: '오팔·투르말린', element: '金' },           // 10월 오팔/투르말린 = 金 [검수: 유색·다색 → 金/水 갈림]
  11: { month: 11, gem: 'topaz', ko: '토파즈·시트린', element: '土' },          // 11월 토파즈/시트린 = 황금빛 → 土
  12: { month: 12, gem: 'turquoise', ko: '터콰이즈·탄자나이트', element: '水' },// 12월 터콰이즈/탄자나이트 = 청록 → 水
};

/** 양력 생월(1~12) → 서양 탄생석. 범위 밖이면 undefined(호출측에서 방어). */
export function westernBirthstoneOf(month: number): WesternBirthstone | undefined {
  return WESTERN_BIRTHSTONE[month];
}
