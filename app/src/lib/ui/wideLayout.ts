// app/src/lib/ui/wideLayout.ts — **넓은 화면인가** (의존성 0)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-31: *"그리고 패드도 대응해야겠어"* → *"패드는 웹이랑 비슷하게 가도되겠네"*
//
// ■ ★판정을 **여기 한 곳**에 둔다
//   사이드바를 쓸지, 카드를 몇 열로 놓을지가 같은 질문에서 갈라져 나온다.
//   두 곳에서 각자 재면 «사이드바는 나왔는데 열은 하나» 같은 어긋남이 생긴다.
//
// ■ ⚠️★의존성이 0인 이유 — 하네스가 **진짜 함수**를 돌린다
//   `WebShell.tsx` 안에 두면 react-native 를 끌어와 `check:ipad` 가 못 부른다.
//   그러면 하네스는 «사본» 을 검사하게 된다([[shared-block-eats-personality]] 의 교훈,
//   `speechLevel.ts` 와 같은 이유). ⇒ 여기에 RN 을 들이지 마라.
// ═══════════════════════════════════════════════════════════════════════════

/** 사이드바로 넘어가는 폭 — **웹**. 브라우저 창은 아무 크기나 되므로 넉넉히 잡는다. */
export const WEB_WIDE = 900;

/**
 * 사이드바로 넘어가는 폭 — **태블릿**. 웹보다 낮다.
 *
 * ★iPad 는 **세로에서도** 사이드바를 쓴다(Boss: *"패드는 웹이랑 비슷하게"*).
 *   가장 좁은 iPad mini 세로가 744 라 700 이면 전부 걸린다.
 * ⚠️폰은 못 넘는다 — 앱이 **세로 고정**이라 가장 넓은 폰도 440 언저리다(회귀 0).
 */
export const TABLET_WIDE = 700;

/** 카드를 3열로 놓는 폭. */
export const WEB_XWIDE = 1180;

/** 본문 폭 상한 — 한 줄이 길어지면 읽기 힘들다(기기와 무관한 사실). */
export const WEB_BODY = 680;

/**
 * 본문 폭을 제한하기 시작하는 폭 — **사이드바보다 일찍** 건다.
 * iPad 세로는 사이드바를 쓰더라도, 글이 화면을 꽉 채우면 줄이 너무 길다.
 */
export const BODY_CAP_FROM = 700;

/**
 * 폭이 **넓은 축**인가.
 *
 * ⚠️★«면으로 **막는 것**» 과 «면에 따라 **기준을 다르게** 두는 것» 은 다르다.
 *   종전엔 `Platform.OS === 'web' &&` 로 **막아서** iPad 가 이 레이아웃을 아예 못 썼다.
 *   지금은 막지 않는다 — 태블릿도 넓으면 쓴다. 숫자만 다르다.
 *
 * @param width    화면 폭(pt)
 * @param platform `Platform.OS` ('web' | 'ios' | 'android' …)
 */
/**
 * **폰 기준으로 그린 화면**이 넓은 화면에서 늘어나지 않게 가두는 폭.
 *
 * ★왜 필요한가 — 2026-09-01 아이패드 실측(iPad Pro 12.9")에서 온보딩이
 *   아치가 화면 폭만큼 늘어나 **위 절반을 먹고 아래 절반이 통째로 비었다.**
 *   `width="100%"` 는 폰에선 맞고 패드에선 틀리다 — «100%» 가 두 배가 되기 때문이다.
 * ★값은 폰의 넓은 쪽(≈430pt)보다 조금 크게 잡는다 — 패드에서 «폰을 확대한 것» 처럼
 *   보이지 않으면서, 폰에서는 이 상한에 **닿지 않아** 아무것도 안 바뀐다.
 */
export const PHONE_COLUMN = 560;

/**
 * **어느 면에서 도는가** — 웹 · 태블릿 · 폰 셋으로 가른다.
 *
 * ■ ★★왜 셋인가 (Boss 2026-09-01 *"코드에서 웹 패드 모바일 다 다르게 분기처리해둬야할꺼 같은데"*)
 *   종전엔 판단이 둘뿐이었다 — `Platform.OS === 'web'`(웹이냐) 와 `isWideWidth`(넓으냐).
 *   그래서 **아이패드가 어느 쪽에도 딱 안 맞았다**: 넓어서 사이드바는 서는데,
 *   «웹이 아니다» 라는 이유로 폰용 요소까지 같이 그려졌다.
 *   ⚠️실측(2026-09-01 iPad Pro 12.9"): **언어 칩이 두 개** 떴다 —
 *     사이드바 것 하나 + 홈 헤더 것 하나(`Platform.OS !== 'web'` 이 참이라).
 *   ⇒ «웹이냐» 로 면을 정하지 마라. 면은 여기서 한 번 정한다.
 *
 * @param width    창 너비
 * @param platform `Platform.OS`
 */
export type Surface = 'web' | 'tablet' | 'phone';
export function surfaceOf(width: number, platform: string): Surface {
  if (platform === 'web') return 'web';
  return width >= TABLET_WIDE ? 'tablet' : 'phone';
}

/** 사이드바가 서는 면인가 — 웹과 태블릿. ★`isWideWidth` 와 같은 답이어야 한다. */
export function hasSidebar(width: number, platform: string): boolean {
  return surfaceOf(width, platform) !== 'phone';
}

export function isWideWidth(width: number, platform: string): boolean {
  return width >= (platform === 'web' ? WEB_WIDE : TABLET_WIDE);
}

/**
 * 카드를 **몇 열로** 놓을 것인가.
 * @returns 1 = 폰 · 2~3 = 넓은 화면
 */
export function colsFor(width: number, platform: string): number {
  if (!isWideWidth(width, platform)) return 1;
  return width >= WEB_XWIDE ? 3 : 2;
}
