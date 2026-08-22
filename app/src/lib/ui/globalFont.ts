// app/src/lib/ui/globalFont.ts — 전역 Pretendard 폰트 적용(트렌디·가독성 — daniel 기획서 UX 2026-07-14)
// ─────────────────────────────────────────────────────────────────────────
// RN은 '전역 기본 폰트'가 없어(각 Text가 시스템 폰트) Text·TextInput의 render를 1회 패치해
//   그 텍스트의 fontWeight → 해당 Pretendard 웨이트 패밀리를 자동 주입한다.
//   웨이트 매핑(3웨이트로 계층 유지, 앱 용량 절약): 100~500=Regular · 600=SemiBold · 700~900/bold=Bold.
//   폰트 자체는 expo-font useFonts 로 로드(_layout). 로드 전엔 시스템 폰트로 우아하게 폴백.
//   ※ 명시적으로 fontFamily를 지정한 텍스트는 그 값을 존중(우리 주입값을 style 배열 '앞'에 둠 → 명시값이 이김).
// ─────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Text, TextInput, StyleSheet, Platform } from 'react-native';
import { Asset } from 'expo-asset';

// fontWeight(문자열/숫자) → Pretendard 웨이트 패밀리 키(useFonts 로드 키와 일치).
const FAMILY: Record<string, string> = {
  '100': 'Pretendard-Regular', '200': 'Pretendard-Regular', '300': 'Pretendard-Regular',
  '400': 'Pretendard-Regular', normal: 'Pretendard-Regular', '500': 'Pretendard-Regular',
  '600': 'Pretendard-SemiBold',
  '700': 'Pretendard-Bold', '800': 'Pretendard-Bold', '900': 'Pretendard-Bold', bold: 'Pretendard-Bold',
};

function familyFor(style: any): string {
  const flat = (StyleSheet.flatten(style) || {}) as { fontWeight?: unknown };
  const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  return FAMILY[w] ?? 'Pretendard-Regular';
}

/**
 * ⚠️★**웹에서는 위 패치가 듣지 않는다**(2026-08-22 실측).
 *
 * react-native-web 의 `Text.render` 는 이미 **DOM 엘리먼트**(className 이 계산된 div)를 돌려준다.
 * 거기에 `style={[{fontFamily}, ...]}` 를 얹어도 RN-web 의 스타일 처리 단계를 지난 뒤라 무시된다 —
 * 실측: 텍스트 노드 클래스에 `r-color-…`·`r-fontWeight-…` 는 있는데 **`r-fontFamily-…` 가 없었고**,
 * 계산된 폰트는 RN-web 기본 시스템 스택이었다. 즉 **웹은 지금까지 Pretendard 를 한 번도 안 썼다.**
 * (`Text.render` 는 정상적으로 패치돼 있었다 — 그래서 로그만 봐서는 멀쩡해 보였다.)
 *
 * ⇒ 웹은 **CSS 로 직접** 건다. expo-font 가 이미 `Pretendard-Regular/SemiBold/Bold` 세 패밀리를
 *   `@font-face` 로 등록해 두므로(document.fonts 로 확인), 그것들을 **하나의 `Pretendard` 패밀리**로
 *   묶어 주는 규칙만 얹으면 브라우저가 `font-weight` 로 알아서 고른다.
 *   ⚠️★`local()` 로는 안 된다(한 번 시도했다) — `local()` 은 **시스템에 설치된 폰트**를 찾는 것이라
 *     다른 `@font-face` 패밀리를 가리킬 수 없다. 실측: `document.fonts` 에 `Pretendard error` 가 뜨고
 *     글자 폭이 시스템 폰트와 **완전히 같았다**(379px = 379px → 폴백). ⇒ 파일 URL 로 건다.
 */
function applyWebFont(): void {
  if (Platform.OS !== 'web') return;
  const d = (globalThis as any).document;
  if (!d || d.getElementById('pretendard-web')) return;
  // 파일 URL — 번들러가 내보낸 실제 주소를 받는다(경로를 손으로 적으면 배포에서 깨진다)
  const uri = (mod: number) => { try { return Asset.fromModule(mod).uri; } catch { return ''; } };
  const reg = uri(require('../../../assets/fonts/Pretendard-Regular.ttf'));
  const semi = uri(require('../../../assets/fonts/Pretendard-SemiBold.ttf'));
  const bold = uri(require('../../../assets/fonts/Pretendard-Bold.ttf'));
  if (!reg || !semi || !bold) return;            // 하나라도 못 찾으면 손대지 않는다(시스템 폰트가 낫다)
  const st = d.createElement('style');
  st.id = 'pretendard-web';
  st.textContent = `
@font-face { font-family: Pretendard; font-weight: 100 500; font-style: normal; font-display: swap; src: url('${reg}') format('truetype'); }
@font-face { font-family: Pretendard; font-weight: 600;     font-style: normal; font-display: swap; src: url('${semi}') format('truetype'); }
@font-face { font-family: Pretendard; font-weight: 700 900; font-style: normal; font-display: swap; src: url('${bold}') format('truetype'); }
/* ★RN-web 은 폰트를 클래스로 건다. 우리 규칙이 그걸 이기도록 넉넉히 잡되,
   \`!important\` 는 쓰지 않는다 — 아이콘 폰트(있다면)까지 덮어써 글리프가 깨진다. */
html, body, #root, input, textarea, button, select { font-family: Pretendard, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
[class*="css-text-"], [class*="css-textHasAncestor-"] { font-family: Pretendard, -apple-system, 'Apple SD Gothic Neo', sans-serif; }
`;
  d.head.appendChild(st);
}

let patched = false;
/** Text·TextInput 에 fontWeight별 Pretendard 패밀리를 전역 주입(멱등·1회). _layout 최상단에서 호출. */
export function applyGlobalFont(): void {
  if (patched) return;
  patched = true;
  applyWebFont();     // ★웹은 CSS 로(위 주석) — 아래 render 패치는 네이티브용이다
  for (const Comp of [Text, TextInput] as any[]) {
    const orig = Comp?.render;
    if (typeof orig !== 'function') continue;              // forwardRef render 없으면 스킵(안전)
    Comp.render = function patchedRender(props: any, ref: any) {
      const el = orig.call(this, props, ref);
      // ★방어: 폰트 주입이 어떤 이유로든 실패해도 절대 크래시하지 않고 원본 엘리먼트로 폴백(최악=시스템 폰트).
      try {
        if (!el || !el.props) return el;
        const fam = familyFor(el.props.style);
        // 우리 fontFamily를 '앞'에 → 명시 fontFamily가 있으면 뒤 스타일이 이겨 존중됨.
        return React.cloneElement(el, { style: [{ fontFamily: fam }, el.props.style] });
      } catch {
        return el;
      }
    };
  }
}
