// app/src/lib/ui/lineHeightRule.ts — 최소 줄간격 판정(순수 로직)
// ─────────────────────────────────────────────────────────────────────────
// ★react-native 를 import 하지 않는다 — 하네스(check:lineheight)가 런타임 없이 이 규칙만
//   직접 불러 검증할 수 있게 분리했다(coinPrices.ts 와 같은 이유).
//   실제 적용(Text.render 패치)은 textLineHeight.ts.
// ─────────────────────────────────────────────────────────────────────────

/** 글자 크기대별 최소 줄높이 비율 — 본문은 넉넉히, 큰 제목은 촘촘히(1.5 를 주면 제목이 떠 보인다). */
export function lineHeightRatio(size: number): number {
  if (size >= 24) return 1.25;
  if (size >= 19) return 1.38;
  return 1.5;
}

/**
 * ★글자 크기대별 **최대** 줄높이 비율(daniel 2026-07-30 IMG_8311 "행간 좀 줄여주고").
 *
 * 왜 최소만으로는 부족했나: 최소는 '너무 붙는 것'만 막는다. 큰 배율에서는 반대 방향이 문제였다 —
 *   ①화면들이 `lineHeight: 25`(15px 기준 1.67배)처럼 **작은 글자를 기준으로 넉넉히** 잡아 뒀고
 *   ②그 값이 배율만큼 함께 커지면서 큰 글자에서는 문단이 성기게 흩어졌다(한 화면에 6~7줄).
 *   글자가 커지면 필요한 *상대* 줄간격은 오히려 **줄어든다**(같은 비율이면 여백이 절대적으로 과해진다).
 *
 * ⚠️이 상한은 이중적용(ls()로 이미 배율을 먹인 lineHeight 를 전역 패치가 또 곱하던 127곳)에 대한
 *   **2차 방어선**도 된다. 1차 방어는 `npm run check:lineheight`(lineHeight 에 ls() 금지).
 */
export function lineHeightMaxRatio(size: number): number {
  if (size >= 24) return 1.35;
  if (size >= 19) return 1.5;
  return 1.7;
}

/** 이 비율보다 촘촘하면 '의도한 디자인'이 아니라 짝(fontSize↔lineHeight)이 어긋난 것으로 본다. */
export const TOO_TIGHT_RATIO = 1.15;

/**
 * 이 텍스트에 보정을 넣어야 하는가 — 넣어야 하면 적용할 lineHeight, 아니면 null.
 * @param size 최종 fontSize(px)
 * @param current 현재 lineHeight(없으면 undefined)
 * @param numberOfLines RN numberOfLines — 1이면 줄간격과 무관하므로 보정하지 않는다
 * @returns 적용할 lineHeight 또는 null(그대로 둠)
 *
 * ★단일 행(numberOfLines===1)을 제외하는 이유: 배지·칩·버튼 라벨은 줄이 감기지 않아
 *   줄간격 이득이 없는데 높이만 늘어나 정렬이 틀어진다.
 */
export function resolveLineHeight(
  size: number | undefined,
  current: number | undefined,
  numberOfLines?: number,
): number | null {
  if (numberOfLines === 1) return null;
  if (typeof size !== 'number' || !(size > 0)) return null;
  const min = Math.round(size * lineHeightRatio(size));
  const max = Math.round(size * lineHeightMaxRatio(size));
  if (typeof current === 'number') {
    if (current > max) return max;                          // ★너무 성김(큰 배율) — 상한까지 내림
    if (current >= min) return null;                        // 적정 — 디자인 의도 존중
    return min;                                             // 좁음(짝 어긋남 포함) — 바닥값
  }
  return min;                                               // 지정 없음 — 바닥값(대부분 여기)
}
