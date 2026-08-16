// app/src/lib/web/rnwStyleShim.ts — react-native-web 호환 shim: **중첩 <Text> 크래시 무해화**
// ═══════════════════════════════════════════════════════════════════════════
// 증상 (2026-08-16~17 실측)
//   웹에서 `<Text>바깥<Text>안쪽</Text></Text>` 처럼 **Text 안에 Text** 를 넣으면
//   react-dom 이 `node.style[0] = …` 를 시도하다 죽는다:
//     `TypeError: Failed to set an indexed property [0] on 'CSSStyleDeclaration'`
//   에러 바운더리가 없으면 **앱 전체가 백지**가 된다(사이드바까지 사라진다).
//   이 패턴은 앱 32개 파일이 쓴다 — 홈 카드(LuckyTodayCard·BiorhythmCard)·오행 에너지 등.
//   ⇒ 명식이 있는 사용자는 홈에서 바로 이걸 밟는다. 웹 전환의 최대 블로커였다.
//
// 원인 (좁힌 데까지)
//   RNW(0.19.13) 의 Text 는 텍스트 조상이 있으면 `<span>` 으로 그리면서
//   `styles.textHasAncestor$raw` 를 얹는다. 그 경로에서 인라인 스타일 자리에
//   **스타일 객체가 아닌 배열**(`["[object Object]", ""]`)이 흘러들어간다.
//   react-dom 은 그 배열을 `for…in` 으로 돌며 `style["0"]`·`style["1"]` 에 대입 →
//   CSSStyleDeclaration 은 인덱스 setter 가 없어 그 자리에서 던진다.
//
// ★왜 '버려도 되는가' — 추측이 아니라 실측이다
//   · 진짜 스타일은 **className 으로 이미 적용**된다(DOM 확인: `class="css-textHasAncestor-1jxf684"`)
//   · 넘어오는 값은 CSS 가 아니라 쓰레기다: `[0]="[object Object]"`(문자열) · `[1]=""`
//   ⇒ 숫자 키 대입만 삼키면 화면은 그대로이고 크래시만 사라진다.
//
// ⚠️**웹 전용이다.** 네이티브(iOS·Android)는 이 코드를 타지 않는다 — 앱은 그대로 간다.
// ⚠️숫자 키가 **아닌** 대입은 전부 원래대로 통과시킨다(정상 스타일을 건드리지 않는다).
// ⚠️RNW 가 이 버그를 고치면 이 shim 은 그냥 아무 일도 안 하게 된다(제거해도 되는 시점을 로그로 안다).
// ═══════════════════════════════════════════════════════════════════════════
import { Platform } from 'react-native';

/** 한 번만 설치한다(HMR·재마운트에도 중복 래핑 금지). */
let installed = false;
/** 이 세션에서 삼킨 횟수 — 진단용. 0 이면 RNW 가 고쳐졌거나 중첩 Text 를 안 쓴 것. */
let swallowed = 0;

/** 지금까지 무해화한 대입 횟수(진단·회귀 감시용). */
export function rnwStyleShimHits(): number {
  return swallowed;
}

/**
 * 중첩 `<Text>` 가 유발하는 인덱스 스타일 대입을 무해화한다.
 *
 * 동작: `document.createElement` 를 감싸, 만들어진 엘리먼트의 `style` 을 프록시로 바꾼다.
 *       숫자 키(`'0'`·`'1'`…) 대입만 삼키고 나머지는 그대로 통과시킨다.
 *
 * @returns 설치 여부(웹이 아니거나 이미 설치돼 있으면 false)
 *
 * ★`CSSStyleDeclaration.prototype` 에 setter 를 다는 방법은 **안 통한다** — 플랫폼 객체의
 *   인덱스 대입은 프로토타입 체인을 보기 전에 자체 경로에서 던진다(실측으로 확인함).
 *   그래서 엘리먼트 인스턴스의 `style` 자체를 갈아 끼운다.
 */
export function installRnwStyleShim(): boolean {
  if (Platform.OS !== 'web') return false;                 // ★네이티브는 무관
  if (installed) return false;
  if (typeof document === 'undefined') return false;
  installed = true;

  const origCreateElement = document.createElement.bind(document);
  (document as any).createElement = function (tagName: string, options?: ElementCreationOptions) {
    const el = origCreateElement(tagName, options);
    try {
      const real = (el as HTMLElement).style as any;
      const proxy = new Proxy(real, {
        set(target: any, key: any, value: any): boolean {
          // 숫자 키 = RNW 가 잘못 넘긴 배열. 진짜 스타일은 className 으로 이미 붙어 있다.
          if (typeof key === 'string' && key.length > 0 && key.charCodeAt(0) >= 48 && key.charCodeAt(0) <= 57) {
            swallowed++;
            return true;
          }
          target[key] = value;
          return true;
        },
        get(target: any, key: any) {
          const v = target[key];
          // CSSStyleDeclaration 의 메서드(setProperty 등)는 원본에 바인딩해야 동작한다
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
      Object.defineProperty(el, 'style', { get: () => proxy, configurable: true });
    } catch {
      /* 프록시 실패 = 그냥 원래 엘리먼트. shim 이 앱을 막지는 않는다 */
    }
    return el;
  };
  return true;
}
