// app/src/lib/ui/heroSize.ts — 전폭 히어로/배너의 **웹 높이 상한** 단일 소스
// ═══════════════════════════════════════════════════════════════════════════
// 왜 생겼나 (daniel 2026-08-17: *"웹에서 풀이쪽 배너가 너무 커"*)
//   전폭 히어로들은 `width:'100%' + aspectRatio` 로 크기를 잡는다. 폰(390px)에선
//   `390/1.6 ≈ 244px` 로 알맞지만, 데스크톱에선 본문 컬럼이 1120px 라
//   **1120/1.6 = 700px** — 화면 세로(≈800px)를 통째로 먹는다(실측).
//   ⇒ 비율만으로 크기를 정하면 **폭이 커질수록 세로가 같이 폭주한다.**
//
// 해법: 비율은 그대로 두고 **높이에 상한**을 씌운다.
//   CSS 에서 `max-height` 는 `aspect-ratio` 보다 세다 → 폭은 100% 를 유지하면서
//   높이만 잘린다(= 넓은 띠 배너). 이미지는 `contentFit="cover"` 라 가운데가 남는다.
//
// ⚠️**웹 전용이다.** 네이티브에서는 `null` 을 돌려 **오버라이드 객체 자체를 만들지 않는다** —
//   `{maxHeight: undefined}` 를 항상 넘기면 RN 이 원래 스타일을 덮어 버린다
//   (관계지도 `aspectRatio: undefined` 로 한 번 당한 자리 · [[duplicate-ui-single-source]]).
// ═══════════════════════════════════════════════════════════════════════════
import { useWideWeb } from '../../components/WebShell';
import { HERO_CAP as CAPS, PORTRAIT_MAX_WIDTH } from './heroCaps';

export { HERO_CAP } from './heroCaps';   // 값은 순수 모듈에 있다(하네스가 실행해서 읽는다)

/**
 * 넓은 웹에서 전폭 히어로의 높이를 묶는다.
 *
 * @param cap 상한 픽셀. `HERO_CAP.banner`(300) 또는 `HERO_CAP.reading`(400) 을 쓴다.
 * @returns 넓은 웹이면 `{ maxHeight }`, 그 밖(폰 웹·iOS·Android)에서는 **null**.
 *
 * @example
 * const heroCap = useHeroCap(HERO_CAP.banner);
 * <View style={heroCap ? [styles.card, heroCap] : styles.card} />
 *
 * ★반환값을 그대로 배열에 넣지 말고 **위 예시처럼 조건부로** 붙일 것 —
 *   null 을 넣어도 RN 은 무시하지만, 습관을 통일해 두면 `undefined` 덮어쓰기 사고가 안 난다.
 */
export function useHeroCap(cap: number = CAPS.banner): { maxHeight: number } | null {
  const wide = useWideWeb();   // 넓은 웹(≥900px)에서만 true — 네이티브는 항상 false
  return wide ? { maxHeight: cap } : null;
}

/**
 * **세로로 긴** 이미지(타로 카드 등)를 넓은 웹에서 묶는다.
 *
 * ★가로 배너와 반대로 **폭**을 묶는다. 세로 이미지에 `maxHeight` 를 씌우면 `contain` 이
 *   좌우에 빈 여백만 잔뜩 만든다 — 비율을 살리려면 폭을 줄여야 한다.
 *   실측: 타로 카드는 `aspectRatio: 0.58` 이라 760px 컬럼에서 **1310px** 까지 자란다.
 *
 * @param maxWidth 넓은 웹에서의 최대 폭(px). 기본 320 → 높이 약 550px.
 * @returns 넓은 웹이면 `{ maxWidth, alignSelf: 'center' }`, 그 밖에서는 **null**.
 */
export function usePortraitCap(maxWidth: number = PORTRAIT_MAX_WIDTH): { maxWidth: number; alignSelf: 'center' } | null {
  const wide = useWideWeb();
  return wide ? { maxWidth, alignSelf: 'center' } : null;
}
