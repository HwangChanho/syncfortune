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
// ■ ★가중치를 합쳐서 내보내지 않는다
//   `base`(기준 글자)와 `surround`(주변 보정)를 **따로** 돌려준다.
//   둘을 어떤 비율로 합칠지는 아직 판정 전이고([[verify-000d-johu]] N1), 여기서 정하면
//   [[attach-indicators-r-attach]] 와 같은 이유로 사후 변명 장치가 된다. 합성은 소비처/회귀의 몫.
// ─────────────────────────────────────────────────────────────────────────
import { STEM_ELEM, HIDDEN } from './saju';
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

/** 한 축의 산출 결과 — base 와 surround 를 **합치지 않고** 함께 돌려준다. */
export type JohuAxis = {
  /** 기준 글자(한난=월지 · 조습=일지)가 정하는 값. -1 ~ +1 */
  base: number;
  /** 주변 글자들이 그 값을 흔드는 방향·크기의 **합**. 정규화하지 않은 raw 합계. */
  surround: number;
  /** 기준이 된 글자(추적용). */
  anchor: Branch;
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
 * @param saju 원국. 대운·세운은 쓰지 않는다 — 상담가 `verify-000-rules` #5(O)
 *             *"세운은 조후 축을 바꾸지 못한다 — 조후는 원국 + 대운으로 본다"*.
 *             대운 층은 별도 모듈로 뺀다(여기서 섞으면 trait/state 가 꼬인다).
 * @returns 두 축 각각의 {base, surround, anchor}. **합성값은 내지 않는다**(위 주석 참조).
 *
 * ⚠️조작화 미확정 2건 — [[verify-000d-johu]] N1 판정 대기. 판정이 오면 여기만 고치면 된다:
 *   · N1-2 '주변 글자' 범위 = 여덟 글자 전부인가, 기준에 **인접한 자리만**인가
 *     → 지금은 **전부**(기준 글자 자신만 제외). 인접만으로 판정되면 `surroundOf` 의 필터만 바꾼다.
 *   · N1-3 **지장간 포함** 여부 → 지금은 **미포함**(드러난 여덟 글자만). 포함으로 판정되면 아래 HIDDEN 루프를 켠다.
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
      // ⚠️N1-3 판정이 '지장간 포함'으로 오면 아래 주석을 푼다(지금은 미포함이 기본값):
      //   for (const h of HIDDEN[saju.pillars[p].branch]) s += (stMap[STEM_ELEM[h.stem]] ?? 0) * (h.role === '본기' ? 1 : 0.5);
    }
    return Math.round(s * 100) / 100;
  };

  return {
    hanNan: { base: TEMP[wolBr] ?? 0, surround: surroundOf('월', TEMP, STEM_TEMP), anchor: wolBr },
    joSeup: { base: HUMID[ilBr] ?? 0, surround: surroundOf('일', HUMID, STEM_HUMID), anchor: ilBr },
  };
}

// HIDDEN 은 위 N1-3 스위치에서 쓴다 — 판정 전이라 지금은 참조만 해 둔다(미사용 import 방지).
void HIDDEN;
