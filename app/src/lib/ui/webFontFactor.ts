// app/src/lib/ui/webFontFactor.ts — 웹 뷰포트 폭 → 글자 배율 보정 (의존성 0)
// ═══════════════════════════════════════════════════════════════════════════
// 왜 생겼나 (daniel 2026-08-17)
//   *"반응형은 브라우저의 확대 축소 사이즈에 따라서 폰트나 글씨크기를 바꿔서 반응하게 해야지"*
//
//   지금까지 글자 배율은 **설정값 하나**(1.15/1.3/1.45)로 고정이었다. 폰(390px) 기준으로 맞춘 값이라
//   브라우저 창을 줄이거나 확대(zoom in)하면 글자만 그대로 남아 줄바꿈·잘림이 생긴다.
//   ⇒ 폭에 따라 배율을 함께 움직인다. 브라우저 확대는 CSS 픽셀 폭을 줄이므로,
//     이 보정이 있으면 **확대해도 레이아웃이 유지된다**(물리적 글자 크기는 비슷하게 남는다).
//
// ★값이 순수 함수인 이유: 하네스가 **실행해서** 곡선을 검증할 수 있어야 한다
//   (주석이 아니라 값이 근거다 · [[verify-facts-not-memory]]).
// ═══════════════════════════════════════════════════════════════════════════

/** 이 폭 미만은 '폰 웹' — 앱과 똑같이 보이게 보정하지 않는다. */
export const PHONE_MAX = 900;
/** 보정 구간의 양 끝 폭(px). */
export const NARROW_W = 900;
export const WIDE_W = 1600;
/**
 * 보정 배율의 양 끝.
 * ★**1을 넘기지 않는다** — 앱 기본 배율(1.3)은 폰 기준으로 이미 큰 값이고,
 *   daniel 의 지적 두 건이 전부 *"너무 크다 / 넘친다"* 였다(배너·바이오리듬 %).
 *   넓은 화면에서 더 키우면 넘침 위험만 커진다. 좁아질수록 **줄이는** 쪽으로만 움직인다.
 */
export const NARROW_F = 0.88;
export const WIDE_F = 1.0;
/** 배율을 이 간격으로 끊는다 — 창을 드래그할 때 매 픽셀마다 트리가 리마운트되지 않게. */
export const STEP = 0.04;

/**
 * 뷰포트 폭 → 글자 배율 보정치. **최대 1** — 넓다고 키우지 않고, 좁을수록 줄인다.
 *
 * @param width  CSS 픽셀 폭(`useWindowDimensions().width`). 브라우저 확대 시 이 값이 **줄어든다**.
 * @param isWeb  웹인가. 네이티브면 항상 1(앱은 한 픽셀도 안 바뀐다 — daniel *"앱도 병행할꺼야"*).
 * @returns 0.88 ~ 1.0 사이의 값(STEP 단위로 끊음). 폰 폭(<900)에서는 **1**.
 *
 * @example
 * webFontFactor(390, true)   // 1     (폰 웹 = 앱과 동일)
 * webFontFactor(1000, true)  // 0.88  (좁은 창 — 글자를 줄여 레이아웃을 지킨다)
 * webFontFactor(1600, true)  // 1     (넓은 창 — 앱과 동일, 더 키우지 않는다)
 */
export function webFontFactor(width: number, isWeb: boolean): number {
  if (!isWeb) return 1;
  if (!Number.isFinite(width) || width <= 0) return 1;
  if (width < PHONE_MAX) return 1;                       // 폰 웹은 앱과 같은 크기로 둔다
  const t = (width - NARROW_W) / (WIDE_W - NARROW_W);    // 0..1
  const clamped = Math.min(1, Math.max(0, t));
  const raw = NARROW_F + (WIDE_F - NARROW_F) * clamped;
  return Math.round(raw / STEP) * STEP;                  // 계단식 — 리마운트 폭주 방지
}
