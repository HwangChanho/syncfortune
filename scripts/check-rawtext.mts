/**
 * scripts/check-rawtext.mts — **<Text> 밖의 날 문자열**을 잡는다 (`check:rawtext`)
 * ═════════════════════════════════════════════════════════════════════════
 * ■ ★왜 필요했나 — 2026-08-27 「대화」 탭이 **자꾸** 죽었다
 *   `Text strings must be rendered within a <Text> component.` · route `/chats` ·
 *   **iOS·Android 에만** 있고 웹엔 없다. react-native-web 은 `<div>` 라 글자를 그냥 그리지만
 *   네이티브는 **터진다.** ⇒ 웹으로 열어 보면 멀쩡해서 **눈으로는 절대 못 찾는다.**
 *
 * ■ 무엇을 잡나 — View 계열의 **직접 자식**이 글자가 되는 경우
 *   ① JSX 안의 날 글자(`<View>안녕</View>`)
 *   ② `{'글자'}` · 백틱 문자열 · `{' '}`
 *   ③ `{cond ? <A/> : '글자'}` — 한쪽 가지만 글자여도 그 가지에서 터진다
 *   ④ ★★`{arr.length && <A/>}` — 0 이면 **숫자 0 이 그려진다**(가장 흔한 사고)
 *
 * ■ ⚠️판정은 «이름» 이 아니라 «표현식» 으로 ([[harness-judge-expression-not-name]])
 *   태그 이름만 보고 «Text 면 통과» 하면, `styles.x` 같은 별칭에 속는다.
 *   ⇒ **글자를 받아도 되는 태그 목록**(TEXTY)을 두고 그 안쪽은 통째로 건너뛴다.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * ★★판정은 «이름» 이 아니라 **타입** 으로 한다.
 *   `{mine && <A/>}` 의 mine 이 boolean 이면 안전하고, number 면 0 이 그려져 **죽는다**.
 *   이름으로는 절대 못 가른다 ⇒ TypeScript 타입체커에게 **직접 묻는다**.
 *   (이름 규칙으로 하던 판정이 음성 테스트에서 66건 중 대부분이 오탐이었다.)
 */

/** 글자를 자식으로 받아도 되는 태그 — 이 안쪽은 검사하지 않는다. */
const TEXTY = new Set(['Text', 'Animated.Text', 'TextInput', 'Trans', 'Marquee']);
/** 글자를 받으면 **네이티브에서 터지는** 태그. ⚠️커스텀 컴포넌트는 못 가리므로 제외한다. */
const HOSTY = new Set([
  'View', 'Animated.View', 'ScrollView', 'Animated.ScrollView', 'SafeAreaView',
  'KeyboardAvoidingView', 'Pressable', 'TouchableOpacity', 'TouchableHighlight',
  'TouchableWithoutFeedback', 'ImageBackground', 'Modal',
  // ★★자식을 **그대로 host 로 넘기는** 우리 래퍼들 — 여기 글자가 들어가도 똑같이 죽는다.
  //   ⚠️처음엔 «커스텀은 못 가린다» 며 뺐는데, `ChatList` 의 줄 전체가 `PressableScale` 이다.
  //   ⇒ 넘기는 게 확인된 것만 **이름을 적어** 넣는다(추측으로 넓히지 않는다).
  'PressableScale', 'AnimatedPressable',
]);

function tagOf(n: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment): string {
  if (ts.isJsxFragment(n)) return '<>';
  const t = ts.isJsxElement(n) ? n.openingElement.tagName : n.tagName;
  return t.getText();
}

type Hit = { file: string; line: number; tag: string; why: string; src: string };
const hits: Hit[] = [];

let checker: ts.TypeChecker;

/** 이 표현식의 타입이 **number·string 을 품는가** — 그렇다면 falsy 일 때 글자가 그려진다. */
function canRenderAsText(e: ts.Expression): boolean {
  try {
    const t = checker.getTypeAtLocation(e);
    const parts = t.isUnion() ? t.types : [t];
    return parts.some((p) => {
      const f = p.getFlags();
      // ⚠️리터럴 타입(`0` · `''`)도 각각 NumberLiteral·StringLiteral 로 온다
      return !!(f & (ts.TypeFlags.Number | ts.TypeFlags.String |
                     ts.TypeFlags.NumberLiteral | ts.TypeFlags.StringLiteral));
    });
  } catch { return false; }   // 타입을 못 구하면 **조용히 통과**시킨다(거짓 빨간불보다 낫다)
}

function walkFile(sf: ts.SourceFile) {
  const file = sf.fileName;
  const at = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const push = (n: ts.Node, tag: string, why: string) =>
    hits.push({ file, line: at(n), tag, why, src: n.getText().replace(/\s+/g, ' ').slice(0, 90) });

  /** 이 표현식이 «글자·숫자로 그려질 수 있는가» 를 본다(재귀 — 삼항·&& 안쪽까지). */
  function textyExpr(e: ts.Expression, n: ts.Node, tag: string) {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)) {
      push(n, tag, '문자열이 그대로 자식으로 들어간다'); return;
    }
    if (ts.isConditionalExpression(e)) { textyExpr(e.whenTrue, n, tag); textyExpr(e.whenFalse, n, tag); return; }
    if (ts.isParenthesizedExpression(e)) { textyExpr(e.expression, n, tag); return; }
    // ★★`{x.length && <A/>}` — 왼쪽이 **숫자**면 0 일 때 «0» 이 그려진다
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      // 왼쪽 값이 **0 이나 빈 문자열**이 될 수 있으면 그 값이 그대로 그려진다.
      if (canRenderAsText(e.left)) {
        push(n, tag, `«${e.left.getText().trim()}» 가 0/'' 이면 그 값이 그대로 그려진다 → 삼항(? :)으로`);
      }
      textyExpr(e.right, n, tag);
    }
  }

  function visit(n: ts.Node) {
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const tag = tagOf(n);
      // ★글자를 받아도 되는 태그 안쪽은 통째로 건너뛴다(자식 검사만 건너뛰고 순회는 계속)
      const check = HOSTY.has(tag);
      if (!TEXTY.has(tag)) {
        for (const c of n.children) {
          if (!check) continue;
          if (ts.isJsxText(c) && c.getText().trim()) push(c, tag, '날 글자가 자식으로 있다');
          else if (ts.isJsxExpression(c) && c.expression) textyExpr(c.expression, c, tag);
        }
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
}

// ★프로그램을 한 번만 만든다 — 파일마다 만들면 몇 분씩 걸린다
const files: string[] = [];
function collect(d: string) {
  for (const e of readdirSync(d)) {
    if (e === 'node_modules' || e === '.expo' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) collect(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
}
collect('app/src');
const program = ts.createProgram(files, {
  jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noEmit: true,
  skipLibCheck: true, allowJs: false, esModuleInterop: true, baseUrl: 'app',
});
checker = program.getTypeChecker();
for (const f of files) { const sf = program.getSourceFile(f); if (sf) walkFile(sf); }
if (!hits.length) { console.log('✅ check:rawtext — <Text> 밖 날 문자열 없음'); process.exit(0); }
console.log(`❌ check:rawtext — ${hits.length}건 (네이티브에서 화면이 통째로 죽는다)`);
for (const h of hits) console.log(`  ${h.file}:${h.line}  <${h.tag}>  — ${h.why}\n      ${h.src}`);
process.exit(1);
