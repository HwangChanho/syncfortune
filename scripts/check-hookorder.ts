#!/usr/bin/env tsx
/**
 * check:hookorder — 훅이 **조기 return 뒤**에 있는 곳을 잡는다(React 규칙 1).
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (2026-08-19 실제 크래시)
 *   `SpecialContentScreen` 에서 `useReadBody()` 가 `if (!loaded) return …` **아래**에 있었다.
 *   → 로딩 중에는 훅이 하나 적게 돌고, 로드가 끝나면 하나 늘어난다
 *   → React 가 **"Rendered more hooks than during the previous render"** 로 화면을 통째로 죽인다.
 *   증상은 「화면을 그리다 문제가 생겼어요」 — 별자리·이미지 등 그 컴포넌트를 쓰는 화면 전부.
 *
 *   ⚠️**타입체크도 린트도 이걸 못 잡았다.** 문법은 완벽하고, 터지는 건 실행 중 특정 순서일 때뿐이다.
 *   그래서 하네스가 필요하다 — 훅 호출과 조기 return 의 **줄 순서**를 직접 본다.
 *
 * 규칙
 *   H1 컴포넌트(대문자로 시작하는 함수) 본문에서, **조기 return 뒤에 오는 훅 호출**은 실패다.
 *      · '조기 return' = 컴포넌트 본문 최상위 깊이의 `return` 중 **마지막이 아닌** 것
 *      · 훅 = `use[A-Z]…(` 호출
 *
 * 한계(정직하게)
 *   · 정규식 기반이라 중첩 함수 안의 return 은 들여쓰기 깊이로 구분한다(본문 최상위 = 공백 2칸).
 *   · 콜백 안(`useEffect(() => { … return … })`)의 return 은 깊이가 달라 걸리지 않는다.
 *   · 조건부 훅(`if (x) useFoo()`)은 H1 로는 안 잡힌다 — 그건 eslint 규칙의 영역이고
 *     여기서는 **실제로 우리를 죽인 패턴**만 확실히 막는다.
 *
 * 사용: npm run check:hookorder · 자가테스트: npx tsx scripts/check-hookorder.ts --selftest
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'app/src');

type Fail = { file: string; line: number; hook: string; retLine: number };

/** 주석·문자열을 지운 줄 — 주석 안의 `return` 에 속지 않게. */
function stripLine(l: string): string {
  return l.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
}

/**
 * 한 파일에서 '조기 return 뒤의 훅'을 찾는다.
 *
 * @param src  파일 원문
 * @param file 표시용 경로
 * @returns 위반 목록
 */
export function audit(src: string, file = '?'): Fail[] {
  const out: Fail[] = [];
  const lines = src.split('\n');

  // ★경계 = **들여쓰기 0의 함수 선언 전부**(대소문자 무관).
  //   ⚠️처음엔 '대문자로 시작하는 함수'만 경계로 봤다가 `useSheetLayout` 같은 **커스텀 훅**을
  //     놓쳐, 그 안의 훅이 앞 컴포넌트 것으로 잘못 붙어 오탐이 났다(2026-08-19 실측).
  //     어떤 최상위 함수든 앞 함수를 끝낸다 — 이름 모양으로 거르면 안 된다.
  const bounds: number[] = [];
  lines.forEach((l, i) => {
    if (/^(export\s+)?(default\s+)?(async\s+)?function\s+\w/.test(l)) bounds.push(i);
    else if (/^(export\s+)?(const|let)\s+\w+\s*[:=][^=]*=>/.test(l)) bounds.push(i);
    else if (/^(export\s+)?class\s+\w/.test(l)) bounds.push(i);
  });
  // 그중 **컴포넌트/훅**(대문자 시작 or use 로 시작)만 검사 대상
  const compStarts = bounds.filter((i) => /(function|const|let|class)\s+([A-Z]\w*|use[A-Z]\w*)/.test(lines[i]));

  for (let ci = 0; ci < compStarts.length; ci++) {
    const from = compStarts[ci];
    const nextBound = bounds.find((b) => b > from);   // ★다음 **아무** 최상위 함수까지가 이 함수의 몸통
    const to = nextBound ?? lines.length;

    // 본문 최상위 깊이의 return 줄 — 들여쓰기 2칸(컴포넌트 본문)
    const rets: number[] = [];
    const hooks: Array<{ line: number; name: string }> = [];
    for (let i = from + 1; i < to; i++) {
      const raw = stripLine(lines[i]);
      if (/^ {2}(if\s*\(.*\)\s*)?return\b/.test(raw)) rets.push(i);
      const m = raw.match(/^\s*(?:const|let|var)?\s*.*?\b(use[A-Z]\w*)\s*\(/);
      // ★훅 '정의'가 아니라 '호출'만 — `function useFoo(` 는 제외
      if (m && !/^\s*(export\s+)?function\s+use/.test(raw)) hooks.push({ line: i, name: m[1] });
    }
    if (rets.length < 2) continue;                 // return 이 하나면 그게 마지막 = 조기 return 없음
    const lastRet = rets[rets.length - 1];
    const early = rets.filter((r) => r !== lastRet);
    if (!early.length) continue;

    for (const h of hooks) {
      const before = early.filter((r) => r < h.line);
      if (before.length) out.push({ file, line: h.line + 1, hook: h.name, retLine: before[before.length - 1] + 1 });
    }
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx$/.test(f)) acc.push(p);
  }
  return acc;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const bad = `
export function Screen() {
  const [a, setA] = useState(0);
  if (!a) return <View />;
  const cap = useReadBody();
  return <View />;
}`;
  const good = `
export function Screen() {
  const [a, setA] = useState(0);
  const cap = useReadBody();
  if (!a) return <View />;
  return <View />;
}`;
  const oneRet = `
export function Screen() {
  const [a, setA] = useState(0);
  const cap = useReadBody();
  return <View />;
}`;
  const inCallback = `
export function Screen() {
  const [a, setA] = useState(0);
  useEffect(() => {
    if (!a) return;
    doThing();
  }, [a]);
  if (!a) return <View />;
  return <View />;
}`;
  const helperNotComp = `
function makeStuff() {
  if (x) return null;
  const y = useless(1);
  return y;
}`;
  const cases: Array<[string, number]> = [
    ['조기 return 뒤 훅(실제 크래시 모양)', audit(bad).length],
    ['훅이 위에 있음(정상)', audit(good).length],
    ['return 하나뿐(정상)', audit(oneRet).length],
    ['콜백 안 return(정상 — 오탐이면 안 된다)', audit(inCallback).length],
    ['소문자 함수는 컴포넌트가 아니다(정상)', audit(helperNotComp).length],
  ];
  const want = [1, 0, 0, 0, 0];
  let bads = 0;
  cases.forEach(([name, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${name} → ${got}건 (기대 ${want[i]})`);
    if (!ok) bads++;
  });
  console.log(bads ? `\n❌ 자가테스트 ${bads}건 실패` : '\n✅ check:hookorder 자가테스트 통과 (5케이스)');
  process.exit(bads ? 1 : 0);
}

const fails = walk(SRC).flatMap((p) => audit(readFileSync(p, 'utf8'), relative(ROOT, p)));
if (fails.length) {
  console.error(`❌ check:hookorder — ${fails.length}건 · 훅이 조기 return 뒤에 있다(React 규칙 1)`);
  for (const f of fails) {
    console.error(`  ${f.file}:${f.line}  ${f.hook}()  — ${f.retLine} 행의 조기 return 뒤에 있다`);
    console.error(`    → 그 훅을 **조기 return 위**로 올릴 것. 안 그러면 상태가 바뀌는 순간 화면이 통째로 죽는다.`);
  }
  process.exit(1);
}
console.log('✅ check:hookorder — 조기 return 뒤의 훅 없음');
