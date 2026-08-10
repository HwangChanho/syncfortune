// engine/johu2.ts — 조후 2축(한난 × 조습) 연속 산출 (결정론 · API 0)
// ─────────────────────────────────────────────────────────────────────────
// 근거: 상담가 판정 2026-08-04 `verify-000-rules` #1 (O) — 원문 그대로
//   > **월지는 한난의 기준**이고, 주변 글자가 온도에 영향을 미친다.
//   > **일지는 조습의 기준**이고, 주변 글자가 습도에 영향을 미친다.
// 같은 세트 #2 (O): *"지금 엔진의 조후 쏠림 게이트(R56)는 **오행 개수 기반이므로 고쳐야 한다**"*
//
// ■ 기존 `app/src/lib/engine/ohaeng.ts` 와 무엇이 다른가
//   기존 johuSkew/joSeupSkew 는 여덟 글자의 **火/水 개수를 세고** 월지에 가중 2를 줬다.
//   즉 ①개수 기반이라 #2 에 걸리고 ②**조습인데 일지가 아니라 월지**에 가중을 준다(#1 과 어긋남).
//   여기서는 **기준 글자(월지·일지)가 값을 정하고, 나머지 글자는 그 값을 흔드는 보정**으로 뒤집는다.
//   ⚠️기존 함수는 **그대로 둔다** — 만세력 화면·countryFit 이 쓰고 있어 같이 바꾸면 표시가 전부 흔들린다.
//     교체는 R56 게이트 수정과 함께 별건으로(스키마와 값 변경을 섞지 말 것 — 전문가).
//
// ■ ★2026-08-11 `verify-000h-magnitude#8`·`#9`(둘 다 O) — **합치는 법이 왔다**
//   `#8`(O) *"두 축이 어긋날 때 그 사람의 조후는 **월지 쪽을 따라** 부른다 — 조습은 그 안에서 덧붙이는 말"*
//   `#9`(O) *"**중화**란 월지도 일지도 치우치지 않은 자리(寅·卯·申·酉 처럼)에 있고,
//            주변 여덟 글자가 찬 쪽과 더운 쪽을 **비슷하게 나눠 가진** 상태"*
//   ⇒ `johuLabel()` 신설. ★임계값을 하나도 안 만들었다 — 판정이 그렇게 짜여 있기 때문이다:
//     · 기준 글자(base)가 치우쳐 있으면 **그 부호가 이름을 정한다**(월지가 정한다 · #8)
//     · 기준 글자가 치우치지 않은 자리면(base=0) 그때만 **주변(surround)이 정한다**
//     · 둘 다 0 = 주변이 양쪽을 비슷하게 나눠 가진 상태 → **중화**(#9 그대로)
//
// ■ ★가중치를 합쳐서 내보내지 않는다
//   `base`(기준 글자)·`surround`(원국 여덟 글자)·`daeun`(현재 대운)을 **셋 다 따로** 돌려준다.
//   어떤 비율로 합칠지는 **여전히 판정 전**이다 — `verify-000d-johu#5`(O) 가 *"월지 쪽이 더 무겁다"* 라고
//   **방향만** 주고 크기는 주지 않았고, `#1`(X) 은 *"독립이 아니다, 기준점이다, 다 같이 봐야 한다"* 라
//   합쳐야 한다는 것까지만 확정했다. 여기서 숫자를 정하면
//   [[attach-indicators-r-attach]] 와 같은 이유로 사후 변명 장치가 된다. 합성은 소비처/회귀의 몫.
//   → 크기는 `verify-000h` C 로 되물었다.
// ─────────────────────────────────────────────────────────────────────────
import { STEM_ELEM } from './saju';   // ★HIDDEN(지장간) 은 쓰지 않는다 — `verify-000d-johu#3`(X) 로 제외 확정
import type { SajuChart, PillarPos, Branch, Element } from '../spec/chart';

const POS: PillarPos[] = ['년', '월', '일', '시'];

/**
 * 지지의 **온도** — 계절 위치에서 정의상 나온다(관법 판정 아님).
 * 子(동지 무렵 한가운데)= -1, 午(하지 무렵 한가운데)= +1 로 두고 열두 자리를 원으로 돌린 코사인 값.
 * ★임의로 고른 숫자가 아니라 **계절의 정의**다 — 월지가 곧 절기이므로 이 값은 계산되는 양이다.
 */
const TEMP: Record<Branch, number> = (() => {
  const ORDER: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const out = {} as Record<Branch, number>;
  ORDER.forEach((b, i) => { out[b] = Math.round(-Math.cos((i / 12) * 2 * Math.PI) * 100) / 100; });
  return out;
})();

/**
 * 지지의 **습도** — 濕(水·습토 辰丑) ↔ 燥(火·조토 未戌).
 * ★새로 만든 분류가 아니라 앱 `joSeupSkew` 가 이미 쓰던 것과 **같은 분류**다(WET_BR/DRY_BR + 水火).
 *   중간(寅卯申酉)은 0. 木·金 의 생발·수렴을 습도로 볼지는 판정 전이라 넣지 않았다.
 */
const HUMID: Partial<Record<Branch, number>> = {
  子: +1, 亥: +1, 辰: +0.8, 丑: +0.8,   // 水 · 습토
  午: -1, 巳: -1, 未: -0.8, 戌: -0.8,   // 火 · 조토
};

/** 천간의 온도/습도 기여 — 火=덥고 건조, 水=춥고 습함. 나머지 0(土金木은 축에 직접 안 걸린다). */
const STEM_TEMP: Partial<Record<Element, number>> = { 火: +1, 水: -1 };
const STEM_HUMID: Partial<Record<Element, number>> = { 火: -1, 水: +1 };

/** 한 축의 산출 결과 — base·surround·daeun 을 **합치지 않고** 함께 돌려준다. */
export type JohuAxis = {
  /** 기준 글자(한난=월지 · 조습=일지)가 정하는 값. -1 ~ +1 */
  base: number;
  /** **원국 여덟 글자**가 그 값을 흔드는 방향·크기의 **합**. 정규화하지 않은 raw 합계. */
  surround: number;
  /**
   * **현재 대운** 干支의 기여 — `verify-000d-johu#2`(O) 코멘트 *"★대운도 봐야 한다"*.
   * ★surround 에 **더하지 않고 따로** 낸다. 대운 한 기둥이 원국 여덟 글자와 같은 무게인지는
   *   판정에 없고, 여기서 합치면 기존 소비처(attachAxes 등 원국 전용 층)의 값이 조용히 바뀐다.
   * 대운을 못 읽으면 0.
   */
  daeun: number;
  /** 기준이 된 글자(추적용). */
  anchor: Branch;
};

/** 조후 한 축의 이름. `중화` = 기준도 주변도 치우치지 않은 상태(`000h#9`). */
export type JohuSide<A extends string, B extends string> = A | B | '중화';

/** 조후를 한 문장으로 부를 때 쓰는 이름 — `000h#8`·`#9`. */
export type JohuLabel = {
  /** **먼저 말하는 것** = 한난(월지 기준). `000h#8` *"월지 쪽을 따라 부른다"*. */
  hanNan: JohuSide<'寒', '暖'>;
  /** 그 안에서 **덧붙이는 말** = 조습(일지 기준). */
  joSeup: JohuSide<'燥', '濕'>;
  /** 두 축이 서로 다른 쪽을 가리키는가(어긋남) — `#8` 이 다루던 바로 그 상황. */
  crossed: boolean;
};

export type Johu2 = {
  /** 한난(寒暖) — 음수=寒 · 양수=暖. 기준 = **월지**. */
  hanNan: JohuAxis;
  /** 조습(燥濕) — 음수=燥 · 양수=濕. 기준 = **일지**. */
  joSeup: JohuAxis;
};

/**
 * 조후 2축 산출.
 *
 * @param saju 원국 + `currentLuck`(현재 대운). **세운은 쓰지 않는다** — `verify-000-rules#5`(O)
 *             *"세운은 조후 축을 바꾸지 못한다"*. 대운은 `verify-000d-johu#2` 코멘트로 포함이 확정됐으나
 *             **별도 필드**로 낸다(무게 미판정 — JohuAxis.daeun 주석 참조).
 * @returns 두 축 각각의 {base, surround, daeun, anchor}. **합성값은 내지 않는다**(위 주석 참조).
 *
 * ■ 조작화 확정 (상담가 판정 2026-08-10 `verify-000d-johu`) — 옛 'N1 대기' 자리를 채운 답이다
 *   · `#2`(O) '주변 글자' 범위 = **원국 여덟 글자 전부**(기준에 인접한 자리만이 아니다) → 기존 구현이 맞았다.
 *     + 코멘트 *"★대운도 봐야 한다"* → `daeun` 필드 신설.
 *   · `#3`(X) 지장간 포함 → **기각**. 코멘트 *"★지장간은 보지 않는다"* → 대기용 HIDDEN 스위치를 걷어냈다.
 *
 * ⚠️아직 답이 없는 것 — `verify-000h` C 로 되물었다. 여기서 내가 정하면 발명이다:
 *   · `#1`(X) *"독립이 아니다. **기준점**이다. 다 같이 봐야 한다"* → 두 축을 **어떻게** 합쳐 한 문장으로 말하는가
 *   · `#4`(O) **중화**(어느 상한도 아닌 상태)의 경계가 어디인가
 *   · `#5`(O) 월지(한난)가 일지(조습)보다 **더 무겁다** — 얼마나 무거운지는 없다
 */
export function johu2(saju: SajuChart): Johu2 {
  const wolBr = saju.pillars['월'].branch;   // 한난의 기준
  const ilBr = saju.pillars['일'].branch;    // 조습의 기준

  /**
   * 기준 글자를 뺀 나머지 글자들의 기여 합.
   * @param anchorPos 기준이 되는 자리(그 **지지**만 제외 — 같은 기둥의 천간은 주변으로 센다)
   * @param brMap 지지 → 기여값 표
   * @param stMap 천간 오행 → 기여값 표
   */
  const surroundOf = (
    anchorPos: PillarPos,
    brMap: Partial<Record<Branch, number>>,
    stMap: Partial<Record<Element, number>>,
  ): number => {
    let s = 0;
    for (const p of POS) {
      // 천간 — 기준 자리의 천간도 '주변'에 넣는다(기준은 *지지* 하나다).
      s += stMap[STEM_ELEM[saju.pillars[p].stem]] ?? 0;
      // 지지 — 기준 글자 자신은 base 로 이미 셌으므로 제외(이중 계상 방지).
      if (p === anchorPos) continue;
      s += brMap[saju.pillars[p].branch] ?? 0;
      // ★지장간은 세지 않는다 — `verify-000d-johu#3`(X) *"지장간은 보지 않는다"*(2026-08-10 확정).
      //   판정 전에는 여기 '켤 수 있는 스위치'가 주석으로 남아 있었으나, 기각됐으므로 걷어냈다.
    }
    return Math.round(s * 100) / 100;
  };

  /**
   * 현재 대운 한 기둥(干 + 支)의 기여 — `#2` 코멘트 *"★대운도 봐야 한다"*.
   * @param brMap 지지 → 기여값 표 / @param stMap 천간 오행 → 기여값 표
   * @returns 대운 干支 기여 합. `currentLuck` 이 없으면(픽스처·경량 차트) 0.
   */
  const daeunOf = (
    brMap: Partial<Record<Branch, number>>,
    stMap: Partial<Record<Element, number>>,
  ): number => {
    const lk = saju.currentLuck;
    // ⚠️경량 픽스처·입운 전 차트는 currentLuck 이 비어 있다(`{}` 로만 채워진 경우 포함) → 0.
    //   여기서 조용히 undefined 를 계산에 태우면 NaN 이 축을 오염시킨다.
    if (!lk?.stem || !lk?.branch) return 0;
    const v = (stMap[STEM_ELEM[lk.stem]] ?? 0) + (brMap[lk.branch] ?? 0);
    return Math.round(v * 100) / 100;
  };

  return {
    hanNan: {
      base: TEMP[wolBr] ?? 0,
      surround: surroundOf('월', TEMP, STEM_TEMP),
      daeun: daeunOf(TEMP, STEM_TEMP),
      anchor: wolBr,
    },
    joSeup: {
      base: HUMID[ilBr] ?? 0,
      surround: surroundOf('일', HUMID, STEM_HUMID),
      daeun: daeunOf(HUMID, STEM_HUMID),
      anchor: ilBr,
    },
  };
}

/**
 * 조후를 **한 문장으로 부르는 이름** — `verify-000h-magnitude#8`·`#9`(둘 다 O).
 *
 * @param j `johu2()` 결과
 * @returns 한난(먼저) · 조습(덧붙임) · 두 축이 어긋났는지
 *
 * ★임계값이 하나도 없다. 판정이 이렇게 짜여 있어서다:
 *   1. 기준 글자가 치우쳐 있으면(base ≠ 0) **그 부호가 이름**이다 — 월지/일지가 정한다.
 *   2. 기준 글자가 치우치지 않은 자리면(base = 0 · 寅卯申酉 등) 그때만 **주변이 정한다**.
 *   3. 기준도 주변도 0 = 주변이 양쪽을 비슷하게 나눠 가진 것 → **중화**(`#9` 정의 그대로).
 * ⚠️`daeun` 은 여기 안 쓴다 — 대운을 이름에 섞을지는 판정에 없다(원국의 이름이 먼저다).
 *
 * @example
 *   johuLabel(johu2(saju))   // { hanNan: '寒', joSeup: '燥', crossed: true } = "찬데 마른 명식"
 */
export function johuLabel(j: Johu2): JohuLabel {
  /** 한 축의 이름 — 위 1~3 규칙. */
  const side = <A extends string, B extends string>(ax: JohuAxis, neg: A, pos: B): JohuSide<A, B> => {
    const v = ax.base !== 0 ? ax.base : ax.surround;   // 기준이 먼저, 없을 때만 주변
    return v === 0 ? '중화' : v < 0 ? neg : pos;
  };
  const hanNan = side(j.hanNan, '寒', '暖');
  const joSeup = side(j.joSeup, '燥', '濕');   // 조습은 음수=燥(마름) · 양수=濕(젖음)
  // 어긋남 = 한쪽은 차가운데 다른 쪽은 마른 식으로 서로 다른 방향을 가리킬 때.
  //   ★중화가 끼면 어긋난 것이 아니다(가리키는 방향이 아예 없다).
  const crossed = hanNan !== '중화' && joSeup !== '중화'
    && ((hanNan === '寒') !== (joSeup === '濕'));   // 寒↔濕 · 暖↔燥 가 같은 결. 엇갈리면 crossed
  return { hanNan, joSeup, crossed };
}
