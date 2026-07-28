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
  if (typeof current === 'number') {
    if (current >= min) return null;                       // 이미 넉넉 — 존중
    if (current >= size * TOO_TIGHT_RATIO) return min;     // 조금 좁음 — 바닥값까지 올림
    return min;                                            // 명백히 좁음(짝 어긋남) — 바닥값
  }
  return min;                                              // 지정 없음 — 바닥값(대부분 여기)
}
