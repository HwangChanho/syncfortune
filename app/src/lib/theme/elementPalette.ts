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
/**
 * ★★2026-08-22 **화면 색은 이 하나로 통일한다** (Boss: *"콘티대로 라벤더 한 색"*).
 *
 * ■ 왜 바뀌었나
 *   시안이 둘이었고 **서로 달랐다**:
 *     · `니운내운.pdf`(08-18) = 오행 5색 전면 팔레트 — 아래 `ELEMENT_PALETTE` 가 그것이다
 *     · 콘티 4면(08-21) = **라벤더 한 색** — 네 면 전부 같은 보라다
 *   앱은 앞의 것을 따르고 있었고, Boss 명식이 金이라 화면이 **무채색**으로 보였다
 *   (`金.bg #E8E9E9` · 실측 `colors.ju` = rgb(80,80,78)). 그게 "시안과 다르다"의 정체다.
 *   ⇒ Boss 결정으로 콘티가 정본이 되었다.
 *
 * ■ ⚠️값을 눈으로 고르지 않았다 — **대비를 계산해서** 넣었다
 *   `inkFaint` 는 종전 라벤더 값(#A49EBE)이 카드 위 **2.56** 으로 이 저장소 기준(3.0)에 미달이었다.
 *   오행 팔레트는 08-18 에 이 검사를 거쳐 고쳤는데 **라벤더 베이스는 안 거쳤다** — 그대로 옮겼으면
 *   미달인 채로 나갔을 것이다. ⇒ #908AAA (카드 3.28 · 배경 3.04).
 *   `onJu`(흰 글자) on `ju` = **4.70**(라벤더) → **4.84**(카멜). `check:onaccent` 기준 4.5.
 *
 * ■ ★★2026-08-24 카멜 전환 (Boss *"앱 테마 색상은 카멜로 하자"*)
 *   ⚠️**클래식 카멜(#C19A6B)은 못 쓴다** — 흰 글자 대비 **2.59**. 배너 흰글자로 이미 당한 함정이다.
 *     통과하는 가장 밝은 카멜이 **#96683C = 4.84**.
 *   ★대조군(라벤더)을 같이 재서 **모든 짝에서 같거나 나음**을 확인했다:
 *     흰 on ju 4.70→4.84 · ju on juSoft 4.04→4.47 · inkFaint on card 3.28→3.31 · ink on bg 13.15→13.77
 */
/**
 * ★★**브랜드(로고 파랑)** — 2026-09-02 Boss *"앱 로고 색상에 맞춰서 내부도 바꾸자 색상"*.
 *
 * ■ 강조색 = **앱 아이콘과 같은 `#1B5FE0`** (2026-09-01 Boss *"좀더 쨍한 파란색"* 으로 고른 그 값).
 *   아이콘·`app.json` 알림색·웹 `theme-color` 와 **한 값**이다 — 이제 화면 안까지 같다.
 * ■ 바탕은 «중성 회색을 강조색 쪽으로 아주 살짝 기울인» 종이다. 카멜(따뜻한 종이) 위에 파랑을 얹으면
 *   두 온도가 싸운다 — 그래서 종이도 같이 식혔다. 순회색이 아니라 **파랑기를 아주 조금** 넣었다.
 * ■ ★대조군(카멜)을 같이 재서 **현행보다 나쁘지 않음**을 확인했다(기준 미달 0건):
 *     흰 on ju 4.84→**5.59** · ju on juSoft 4.47→**5.02** · ju on bg 4.53→**5.26**
 *     ink on bg 13.77→**14.65** · inkFaint on card 3.31→**3.80** · juDeep on card 6.82→**7.92**
 *   ⚠️열 짝 중 하나만 아주 조금 내려갔다 — inkSoft on card 6.12→6.03(기준 4.5 라 여유 충분).
 * ■ ⚠️★**지금은 안 쓴다** — 2026-09-02 Boss *"롤백해"* 로 `CAMEL` 로 되돌렸다.
 *   다시 쓰려면 `theme.ts` 의 `const EP` 를 `BRAND` 로 바꾸면 된다(한 줄). 대비 실측은 위 그대로 유효.
 */
export const BRAND: ElementPalette = {
  bg: '#F7F8FB',      // 흰 종이를 파랑 쪽으로 아주 옅게 — 순백이면 카드와 안 갈린다
  card: '#FFFFFF',    // 카드 = 순백(그림자로 띄운다)
  sunk: '#EDF0F6',
  line: '#E0E6F0',
  ink: '#1E2430',     // 차콜에 파랑기 — 순흑보다 파랑 위에서 부드럽다
  inkSoft: '#5A6376',
  inkFaint: '#79839A', // ★계산값 — 카드 위 3.80(카멜 #9A8B78 은 3.31)
  ju: '#1B5FE0',      // ★로고와 **같은 값** — 주조색(워드마크·활성 탭·주버튼)
  juDeep: '#1549B5',  // 눌림·진한 자리
  juSoft: '#EEF3FE',  // 아주 옅은 파랑 면(선택된 줄·칩 배경)
  juLine: '#CFDDFA',
  onJu: '#FFFFFF',    // 파랑 위 흰 글자 = 5.59
};

/** ★현행 팔레트(2026-09-02 롤백으로 복귀). 파랑은 아래 `BRAND` 에 남아 있다. */
export const CAMEL: ElementPalette = {
  bg: '#FAF7F2',      // 흰 종이에 카멜을 아주 옅게
  card: '#FFFFFF',    // 카드 = 순백(그림자로 띄운다)
  sunk: '#F3EDE4',
  line: '#EBE3D8',
  ink: '#2E2720',     // 차콜에 갈색기 — 순흑보다 카멜 위에서 부드럽다
  inkSoft: '#6B6055',
  inkFaint: '#9A8B78', // ★계산값 — 카드 위 3.31(옛 라벤더 #908AAA 는 3.28)
  ju: '#96683C',      // 주조색(워드마크·활성 탭·주버튼)
  juDeep: '#7A5230',
  juSoft: '#FBF5EE',
  juLine: '#E4D3BC',
  onJu: '#FFFFFF',
};
/** @deprecated 2026-08-24 Boss *"앱 테마 색상은 카멜로 하자"* — `CAMEL` 로 교체. 되돌릴 때 쓰라고 남긴다. */
export const LAVENDER: ElementPalette = {
  bg: '#F7F5FD', card: '#FFFFFF', sunk: '#F1EEFA', line: '#E9E4F7',
  ink: '#2C2743', inkSoft: '#6A6486', inkFaint: '#908AAA',
  ju: '#7C5CE0', juDeep: '#5F44BE', juSoft: '#F0EBFE', juLine: '#DDD3F8', onJu: '#FFFFFF',
};

/**
 * ⚠️★**화면에는 더 이상 쓰지 않는다**(2026-08-22 — 위 `LAVENDER` 로 통일).
 *   지우지 않고 남긴 이유: ①`check:onaccent` 등 하네스가 읽어 온 값이라 이력이 끊기고
 *   ②Boss 가 되돌리자고 하면 그때 한 줄(`EP`)만 바꾸면 된다.
 *   ★새로 쓰는 화면이 여기서 색을 가져오면 안 된다 — 색이 두 갈래가 된다.
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
