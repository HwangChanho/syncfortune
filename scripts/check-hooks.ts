// scripts/check-hooks.ts — 훅 순서가 무너져 **화면이 통째로 죽는 길**을 막는다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-26 · 웹 접근 불가 사고)
//   `ChatList` 가 `if (rows === null) return <스피너/>` **아래**에 `useState` 를 하나 두고 있었다.
//     · 로딩 렌더 → 훅 8개 · 목록 렌더 → 훅 9개
//     · React 는 훅을 **호출 순서**로만 식별한다 ⇒ 개수가 늘면
//       #310 «Rendered more hooks than during the previous render» 를 던진다.
//     · 전역 바운더리가 받아 «화면을 그리다 문제가 생겼어요» 만 남았다 = 사실상 백지.
//   ⚠️웹만의 문제가 아니다 — 같은 React 규칙이라 **네이티브 대화 탭도 같이 죽는다.**
//   ★eslint(react-hooks/rules-of-hooks)가 이 저장소엔 **없다.** 그래서 파서로 직접 본다.
//
// 무엇을 지키나 (컴포넌트/커스텀훅 본문의 **최상위**만 본다 — 중첩 함수는 콜백이라 제외)
//   H1. 조기 return/throw **뒤에** 훅을 부르지 않는다      (개수가 렌더마다 달라진다)
//   H2. if/for/while/삼항/&&·|| **안에서** 훅을 부르지 않는다 (조건부 호출)
//
// ★이름이 아니라 **AST 구조**로 판정한다 — 주석·문자열에 안 걸린다
//   ([[harness-judge-expression-not-name]]).
// ★음성 테스트: `npx tsx scripts/check-hooks.ts --selftest`
//   (일부러 깨뜨린 소스를 넣어 **잡히는지** 확인한다 — 통과만 보면 아무것도 검사 안 해도 초록불이다)
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = 'app/src';

export type Finding = { file: string; line: number; hook: string; rule: 'H1' | 'H2'; why: string };

/** `useState` 처럼 use + 대문자로 시작하는 호출만 훅으로 본다(`used`·`useful` 같은 변수는 아니다) */
function hookNameOf(node: ts.Node): string | null {
  if (!ts.isCallExpression(node)) return null;
  const e = node.expression;
  // `useState(...)` · `React.useState(...)` 둘 다 받는다
  const id = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null;
  if (!id) return null;
  return /^use[A-Z]/.test(id) ? id : null;
}

/** 컴포넌트(대문자 시작) 또는 커스텀 훅(use 시작)의 본문인가 */
function isHookScopeName(name: string | undefined): boolean {
  if (!name) return false;
  return /^[A-Z]/.test(name) || /^use[A-Z]/.test(name);
}

/** 이 노드 아래에 return/throw 가 **직접** 있는가(중첩 함수 안은 세지 않는다) */
function hasExit(node: ts.Node): boolean {
  let found = false;
  const walk = (n: ts.Node) => {
    if (found) return;
    if (isFunctionLike(n)) return;                 // 중첩 함수의 return 은 이 함수의 탈출이 아니다
    if (ts.isReturnStatement(n) || ts.isThrowStatement(n)) { found = true; return; }
    ts.forEachChild(n, walk);
  };
  ts.forEachChild(node, walk);
  return found;
}

function isFunctionLike(n: ts.Node): boolean {
  return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)
    || ts.isMethodDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n);
}

/** 이 노드 아래의 훅 호출 — **중첩 함수 안은 빼고**(콜백은 정상) */
function topLevelHooksIn(node: ts.Node): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  const walk = (n: ts.Node) => {
    if (isFunctionLike(n)) return;
    if (hookNameOf(n)) out.push(n as ts.CallExpression);
    ts.forEachChild(n, walk);
  };
  walk(node);
  return out;
}

/** 컴포넌트 본문 하나를 검사한다 */
function scanBody(body: ts.Block, src: ts.SourceFile, file: string, out: Finding[]): void {
  let exitedAt: number | null = null;              // 조기 탈출을 본 줄(1-base)

  for (const stmt of body.statements) {
    const hooks = topLevelHooksIn(stmt);

    // ── H1. 조기 탈출 **뒤**의 훅 ───────────────────────────────────────────
    if (exitedAt !== null) {
      for (const h of hooks) {
        out.push({
          file,
          line: src.getLineAndCharacterOfPosition(h.getStart(src)).line + 1,
          hook: hookNameOf(h)!,
          rule: 'H1',
          why: `${exitedAt}행의 조기 return 아래에 있다 — 렌더마다 훅 개수가 달라져 React #310 으로 화면이 죽는다`,
        });
      }
    } else {
      // ── H2. 조건/반복 **안**의 훅 ─────────────────────────────────────────
      //   (탈출 전에만 본다 — 탈출 뒤는 이미 H1 으로 더 정확히 잡았다)
      for (const h of hooks) {
        let p: ts.Node | undefined = h.parent;
        let guard: string | null = null;
        while (p && p !== stmt.parent) {
          if (ts.isIfStatement(p)) { guard = 'if'; break; }
          if (ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)) { guard = 'for'; break; }
          if (ts.isWhileStatement(p) || ts.isDoStatement(p)) { guard = 'while'; break; }
          if (ts.isConditionalExpression(p)) { guard = '삼항(?:)'; break; }
          if (ts.isBinaryExpression(p)
            && (p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
              || p.operatorToken.kind === ts.SyntaxKind.BarBarToken
              || p.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) { guard = '단축평가(&&·||)'; break; }
          if (ts.isCatchClause(p) || ts.isTryStatement(p)) { guard = 'try/catch'; break; }
          p = p.parent;
        }
        if (guard) {
          out.push({
            file,
            line: src.getLineAndCharacterOfPosition(h.getStart(src)).line + 1,
            hook: hookNameOf(h)!,
            rule: 'H2',
            why: `${guard} 안에서 부른다 — 조건이 바뀌면 훅 순서가 어긋나 화면이 죽는다`,
          });
        }
      }
    }

    // 이 문장이 **이번 함수를 탈출**시키는가 (if 안의 return 포함)
    if (exitedAt === null) {
      const exits = ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)
        || ((ts.isIfStatement(stmt) || ts.isTryStatement(stmt) || ts.isSwitchStatement(stmt)) && hasExit(stmt));
      if (exits) exitedAt = src.getLineAndCharacterOfPosition(stmt.getStart(src)).line + 1;
    }
  }
}

/** 파일 하나 — 컴포넌트/커스텀훅 본문을 모두 찾아 검사한다 */
export function scanSource(code: string, file: string): Finding[] {
  const src = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Finding[] = [];

  const visit = (n: ts.Node) => {
    let name: string | undefined;
    let body: ts.Node | undefined;

    if (ts.isFunctionDeclaration(n) && n.name) { name = n.name.text; body = n.body; }
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
      && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      name = n.name.text; body = n.initializer.body;
      // `const X = memo(() => {…})` · `forwardRef(…)` 처럼 한 겹 감싼 것도 본다
      if (!body && ts.isCallExpression(n.initializer as any)) body = undefined;
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
      && ts.isCallExpression(n.initializer) && n.initializer.arguments.length) {
      const a = n.initializer.arguments[0];
      if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) { name = n.name.text; body = a.body; }
    }

    if (name && body && ts.isBlock(body) && isHookScopeName(name)) {
      scanBody(body, src, file, out);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walkFiles(p, acc); }
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const bad = `
    import { useState } from 'react';
    export function Broken({ x }: { x: number }) {
      const [a, setA] = useState(0);
      if (a === 0) { return null; }
      const [b, setB] = useState(1);              // H1 이 잡아야 한다
      return <View>{b}</View>;
    }
    export function Conditional({ x }: { x: number }) {
      if (x) { const [c] = useState(2); }         // H2 가 잡아야 한다
      return null;
    }
    export function Fine() {
      const [a] = useState(0);
      const cb = () => { const inner = useState; return inner; };   // 중첩 함수 = 오탐이면 안 된다
      if (!a) return null;
      return <View onLayout={() => setTimeout(() => {}, 0)} />;
    }
  `;
  const got = scanSource(bad, 'selftest.tsx');
  const h1 = got.filter((f) => f.rule === 'H1' && f.hook === 'useState').length;
  const h2 = got.filter((f) => f.rule === 'H2' && f.hook === 'useState').length;
  const falsePos = got.filter((f) => f.line >= 15).length;   // `Fine` 구간
  const ok = h1 === 1 && h2 === 1 && falsePos === 0;
  console.log(ok ? '✅ selftest 통과 — H1 1건 · H2 1건 잡고, 정상 컴포넌트엔 오탐 0'
    : `❌ selftest 실패 — H1=${h1}(기대 1) H2=${h2}(기대 1) 오탐=${falsePos}(기대 0)\n${JSON.stringify(got, null, 1)}`);
  process.exit(ok ? 0 : 1);
}

// ── 본검사 ──────────────────────────────────────────────────────────────────
// ⚠️★**직접 실행일 때만** 돈다. 이 가드가 없으면 `scanSource` 를 import 하는 쪽(대조군 테스트 등)에서
//   본검사가 먼저 돌고 `process.exit(0)` 으로 호출자를 죽여 «검사한 척» 하게 된다(실제로 당했다).
const isMain = /check-hooks\.ts$/.test(process.argv[1] ?? '');
if (!isMain) { /* import 된 것 — 아래를 돌리지 않는다 */ } else {

const findings: Finding[] = [];
for (const f of walkFiles(ROOT)) findings.push(...scanSource(fs.readFileSync(f, 'utf8'), f));

if (!findings.length) {
  console.log(`✅ check:hooks — ${walkFiles(ROOT).length}개 파일에서 훅 순서 위반 없음`);
  process.exit(0);
}
console.error(`❌ check:hooks — 훅 순서 위반 ${findings.length}건 (화면이 통째로 죽는 버그다)\n`);
for (const f of findings) console.error(`  [${f.rule}] ${f.file}:${f.line}  ${f.hook}()  — ${f.why}`);
console.error('\n  고치는 법: 훅을 **모든 조기 return 위**로 올린다. 조건은 훅 «안»에서 처리한다.');
process.exit(1);
}
