// app/src/lib/theme/elementPalette.ts — 오행 5색 **전면 팔레트** (의존성 0 · 시안에서 뽑은 실제 색)
// ═══════════════════════════════════════════════════════════════════════════
// 출처: daniel 제공 시안 `니운내운.pdf`(43p). 눈대중이 아니라 렌더한 페이지에서
//   **픽셀을 직접 읽어** 만들었다(배경·카드·주버튼 지점을 좌표로 지정해 샘플링).
//     水 p04 · 木 p21 · 火 p33 · 土 p13 · 金 p38
//
// ★시안의 규칙(다섯 장에서 공통으로 관찰된 것):
//   ① 페이지 배경 = 그 오행의 **옅은 틴트**   ② 카드 = 거의 흰색(틴트가 살짝 섞인)
//   ③ 주버튼·강조 = 그 오행의 **깊은 색**     ④ 글자는 그 오행 계열의 아주 어두운 색
//   ⇒ 화면 전체가 그 사람의 오행으로 물든다(daniel 2026-08-18 "시안대로 전면 틴트").
//
// ⚠️이력: 2026-08-07 에 **전면 틴트를 한 번 걷어냈다**("오행마다 앱이 다른 앱처럼 보였다" —
//   그때는 정체성을 종이·먹·금으로 고정하려던 방향). 이번엔 시안 자체가 전면 틴트라 전제가 바뀌었다.
//
// ★값이 순수 데이터인 이유: 하네스(`check:elementtheme`)가 **명암 대비를 실제로 계산해서**
//   다섯 벌 전부 읽히는지 검증한다. 색을 눈으로 고르고 "괜찮아 보인다"로 끝내지 않는다.
// ═══════════════════════════════════════════════════════════════════════════

/** 오행 다섯 글자. */
export type ThemeElement = '木' | '火' | '土' | '金' | '水';

/** 한 오행이 갖는 전면 색 세트. 화면 토큰(`colors`)이 이걸로 채워진다. */
export type ElementPalette = {
  /** 페이지 배경 — 그 오행의 옅은 틴트 */
  bg: string;
  /** 카드 면 — 거의 흰색(틴트가 살짝) */
  card: string;
  /** 한 단계 눌린 면(입력창·구분 영역) */
  sunk: string;
  /** 경계선 */
  line: string;
  /** 본문 글자 — 그 오행 계열의 아주 어두운 색 */
  ink: string;
  /** 보조 글자 */
  inkSoft: string;
  /** 흐린 글자(캡션) */
  inkFaint: string;
  /** 강조·주버튼 — 그 오행의 깊은 색 */
  ju: string;
  /** 강조 눌림 */
  juDeep: string;
  /** 강조의 옅은 배경(칩·선택 상태) */
  juSoft: string;
  /** 강조 계열 경계선 */
  juLine: string;
  /** 강조 위에 올라가는 글자색 */
  onJu: string;
};

/**
 * 오행별 전면 팔레트.
 *
 * ★`bg`·`card`·`ju` 는 **시안에서 읽은 실측값**이다(주석의 hex 가 어느 페이지 어느 지점인지 표기).
 *   나머지(sunk·line·ink·inkSoft…)는 그 세 값에서 같은 규칙으로 파생했다 —
 *   규칙을 코드가 아니라 값으로 박아 둔 이유는 하네스가 **읽어서 검증**할 수 있어야 하기 때문이다.
 */
export const ELEMENT_PALETTE: Record<ThemeElement, ElementPalette> = {
  水: {
    bg: '#D3E6EF',      // p04 페이지배경(실측)
    card: '#F5FAFC',    // p04 카드안쪽(실측)
    sunk: '#E3EFF5',
    line: '#BFD5E0',
    ink: '#1B2E3F',
    inkSoft: '#456079',
    // ★#7D97AB → #74909F (2026-08-18): 대비를 **계산해 보니** 카드 위에서 2.90 으로
    //   캡션 기준(3.0)에 못 미쳤다. 다섯 오행 중 水만 걸렸다 — 눈으로는 다 비슷해 보였다.
    inkFaint: '#74909F',
    ju: '#39609D',      // p04 주버튼(실측)
    juDeep: '#2A4A7C',
    juSoft: '#E7EFF8',
    juLine: '#A9C0DC',
    onJu: '#FFFFFF',
  },
  木: {
    bg: '#D4DEBE',      // p21 페이지배경(실측)
    card: '#FAFAE9',    // p21 카드안쪽(실측)
    sunk: '#E6EBD4',
    line: '#BCC9A5',
    ink: '#1E2C1F',
    inkSoft: '#4A5C46',
    inkFaint: '#7E9078',
    ju: '#366038',      // p21 주버튼(실측)
    juDeep: '#274828',
    juSoft: '#E8EFE0',
    juLine: '#A8BC9C',
    onJu: '#FFFFFF',
  },
  火: {
    bg: '#F8D5CC',      // p33 페이지배경(실측)
    card: '#FFFFFE',    // p33 카드안쪽(실측)
    sunk: '#FBE8E3',
    line: '#EAB9AE',
    ink: '#2D2624',     // p33 히스토그램(실측)
    inkSoft: '#6B4F4A',
    inkFaint: '#A3817A',
    ju: '#A8373F',      // p33 히스토그램(실측)
    juDeep: '#87272E',
    juSoft: '#FBEAE7',
    juLine: '#DFAFA9',
    onJu: '#FFFFFF',
  },
  土: {
    bg: '#F5DCBA',      // p13 페이지배경(실측)
    card: '#FFF5EB',    // p13 카드안쪽(실측)
    sunk: '#F7E6CE',
    line: '#DEC29C',
    ink: '#2B2118',
    inkSoft: '#6B563C',
    inkFaint: '#A08869',
    ju: '#775631',      // p13 주버튼(실측)
    juDeep: '#5D4225',
    juSoft: '#F7EADA',
    juLine: '#CFB18A',
    onJu: '#FFFFFF',
  },
  金: {
    bg: '#E8E9E9',      // p38 페이지배경(실측)
    card: '#FAFAFA',
    sunk: '#EFEFEF',
    line: '#CFD0CF',
    ink: '#272927',     // p38 히스토그램(실측)
    inkSoft: '#585A58',
    inkFaint: '#8C8E8C',
    ju: '#50504E',      // p38 히스토그램(실측)
    juDeep: '#3A3A38',
    juSoft: '#EDEDED',
    juLine: '#BDBEBD',
    onJu: '#FFFFFF',
  },
};

/** 오행이 정해지지 않았을 때(명식 없음·설정 '기본') 쓰는 세트 — 시안의 무채색 화면과 같은 결. */
export const DEFAULT_ELEMENT: ThemeElement = '金';

/** 이 팔레트가 다루는 오행 목록(하네스·설정 UI 가 함께 쓴다). */
export const THEME_ELEMENTS: ThemeElement[] = ['木', '火', '土', '金', '水'];

/**
 * hex → 상대 휘도(WCAG). 대비 계산에 쓴다.
 * @param hex `#RRGGBB`
 */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

/**
 * 두 색의 명암 대비(WCAG). 1(같음) ~ 21(흑백).
 * @returns 대비비. 본문 글자는 4.5 이상, 큰 글자·보조는 3 이상이 기준이다.
 */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
