// scripts/check-rpconce.ts — **계측이 요청을 두 번 쏘고 있지 않은지** 본다
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-26 실측 사고. `app_logs` 의 **정확히 50%가 같은 lid 중복**이었다.
// 웹 50.0 · 안드 49.8 · iOS 51.0 — 플랫폼을 안 가리고 정확히 절반이라 «가끔 재전송» 이 아니었다.
// 두 행의 시간차는 97%가 100ms 이내 = **재전송이 아니라 동시 2발**.
//
// ■ 범인 — 「thenable 을 두 번 소비했다」
//   `adminTrace.ts` 가 RPC 를 계측하려고 이렇게 썼다:
//       const p = origRpc(fn, params);
//       p.then(res => 로깅);        // ①
//       return p;                    // 호출측이 await → ②
//   `PostgrestBuilder.then()` 은 **Promise 의 then 이 아니다.** 호출될 때마다
//   `executeWithRetry()` 를 새로 돌린다(결과 캐시 없음). ⇒ **HTTP 요청이 두 번 나간다.**
//
// ■ ★교훈 — 「체이닝을 안 깬다」와 「한 번만 나간다」는 다른 이야기다
//   원래 주석은 *"thenable 이라 then 을 걸어도 체이닝을 깨지 않는다"* 였다. 그 말은 **맞았다.**
//   맞는 말이 옆칸을 지켜 주지 않았을 뿐이다. **계측이 관측 대상을 바꿔 놓았다.**
//
// ■ 실제 피해: `content_visits.visits` 가 2배(`visits + 1` 이 두 번).
//   나머지는 운 좋게 전부 멱등이라 데이터가 살아남았다 — **비멱등 RPC 하나만 늘어도 바로 터진다.**
//
// ■ 이 검사가 하는 일 (두 겹)
//   ⓐ **함정이 실재하는지** 가짜 thenable 로 재현한다 — 옛 방식은 2회, 새 방식은 1회여야 한다.
//      (이게 곧 컨트롤이다. 함정을 재현 못 하면 아래 소스 검사도 믿을 게 못 된다.)
//   ⓑ **소스에 그 모양이 남아 있는지** TypeScript AST 로 본다 —
//      「`x.then(...)` 을 값도 안 쓰고 부른 뒤, 같은 함수에서 `return x`」 = 두 번 소비.
//      ★이름이 아니라 **표현식의 모양**으로 잡는다(변수명이 p 든 q 든 걸린다).
//
// 실행: npm run check:rpconce
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

// ── ⓐ 함정 재현 — 「then 을 부를 때마다 실행되는」 가짜 빌더 ─────────────────
/** PostgrestBuilder 를 흉내 낸다: `then` 이 불릴 때마다 요청을 한 번 더 «보낸다». */
function fakeBuilder(counter: { n: number }) {
  return {
    then(onF?: (v: any) => any, onR?: (e: any) => any) {
      counter.n++;                                   // ★여기가 실제 fetch 자리
      return Promise.resolve({ data: 1, error: null }).then(onF, onR);
    },
  };
}

/** 종전 방식 — then 을 걸고 그대로 돌려준다(= 소비 시 2회) */
function oldWay(counter: { n: number }) {
  const p: any = fakeBuilder(counter);
  p.then(() => { /* 로깅 */ });
  return p;
}

/** 지금 방식 — 첫 소비 때 한 번만 흘려보내고 결과를 나눠 쓴다 */
function newWay(counter: { n: number }) {
  const p: any = fakeBuilder(counter);
  const origThen = p.then.bind(p);
  let once: Promise<any> | null = null;
  p.then = (onF: any, onR: any) => {
    let run = once;
    if (!run) { run = origThen((res: any) => res); once = run; }
    return run!.then(onF, onR);
  };
  return p;
}

async function reproduce(): Promise<boolean> {
  const a = { n: 0 }; await oldWay(a);            // 래퍼 1회 + await 1회
  const b = { n: 0 }; await newWay(b);
  const c = { n: 0 }; const q = newWay(c); await q; await q;   // 세 번 소비해도 1회여야 한다
  const ok = a.n === 2 && b.n === 1 && c.n === 1;
  console.log(`   ${ok ? '✅' : '❌'} 함정 재현 — 옛 방식 ${a.n}회 · 지금 방식 ${b.n}회 · 세 번 소비해도 ${c.n}회`);
  if (a.n !== 2) console.log('      ⚠️옛 방식이 2회가 아니면 이 검사는 아무것도 증명하지 못합니다');
  return ok;
}

// ── ⓑ 소스 검사 — 「then 을 걸고 그 변수를 return」 하는 함수를 찾는다 ────────
/**
 * 파일 하나에서 위험한 모양을 찾는다.
 * @returns `{ line, name }[]` — 두 번 소비되는 변수와 줄번호
 *
 * 판정 = **표현식의 모양**이다(변수 이름·함수 이름은 안 본다):
 *   ① 값을 버리는 `X.then(...)` 호출문이 있다 (ExpressionStatement 의 CallExpression)
 *   ② 같은 함수 몸통 안에서 `return X` 를 한다
 *   ⇒ 소비가 두 번(래퍼가 한 번, 호출측이 한 번)
 * `X` 가 진짜 Promise 면 무해하지만, thenable 이면 **요청이 두 번** 나간다.
 * Promise 인지 thenable 인지는 정적으로 못 가르므로 **둘 다 신고**한다 — 이 모양 자체를 쓰지 않는 게 답이다.
 */
export function doubleConsume(src: string, file: string): Array<{ line: number; name: string }> {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const out: Array<{ line: number; name: string }> = [];

  /** 이 함수 몸통 안에서 `return <ident>` 로 돌려주는 이름들 */
  const returnedNames = (body: ts.Node): Set<string> => {
    const names = new Set<string>();
    const walk = (n: ts.Node) => {
      // 중첩 함수의 return 은 그 함수 것이다 — 건너뛴다
      if (n !== body && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n))) return;
      if (ts.isReturnStatement(n) && n.expression && ts.isIdentifier(n.expression)) names.add(n.expression.text);
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(body, walk);
    return names;
  };

  /** 이 함수 몸통 안에서 값을 버리고 `<ident>.then(...)` 을 부른 것들 */
  const discardedThen = (body: ts.Node): Array<{ line: number; name: string }> => {
    const hits: Array<{ line: number; name: string }> = [];
    const walk = (n: ts.Node) => {
      if (n !== body && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n))) return;
      if (ts.isExpressionStatement(n)) {
        let e: ts.Expression = n.expression;
        while (ts.isVoidExpression(e) || ts.isAwaitExpression(e)) e = e.expression;   // `void p.then(...)` 도 같은 모양
        if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'then') {
          let recv: ts.Expression = e.expression.expression;
          while (ts.isParenthesizedExpression(recv) || ts.isAsExpression(recv)) recv = recv.expression;
          if (ts.isIdentifier(recv)) {
            hits.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, name: recv.text });
          }
        }
      }
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(body, walk);
    return hits;
  };

  const visit = (node: ts.Node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && node.body) {
      const rets = returnedNames(node.body);
      for (const h of discardedThen(node.body)) if (rets.has(h.name)) out.push(h);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

// ── 자기 검사(음성 테스트) ────────────────────────────────────────────────
const SELF_BAD = `
function wrap() {
  const p = rpc('x');
  p.then((r) => log(r));
  return p;
}`;
const SELF_OK = `
function wrap() {
  const p = rpc('x');
  const orig = p.then.bind(p);
  let once = null;
  p.then = (f, r) => { if (!once) once = orig((x) => x); return once.then(f, r); };
  return p;
}`;
const SELF_OK2 = `
async function wrap() {
  const p = rpc('x');
  const res = await p;      // 한 번만 소비 — 안전
  log(res);
  return res;
}`;

function selftest(): boolean {
  const a = doubleConsume(SELF_BAD, 'a.ts');
  const b = doubleConsume(SELF_OK, 'b.ts');
  const c = doubleConsume(SELF_OK2, 'c.ts');
  const ok = a.length === 1 && a[0].name === 'p' && b.length === 0 && c.length === 0;
  console.log(`   ${ok ? '✅' : '❌'} 자기검사 — 위험한 것 ${a.length}건 · 고친 것 ${b.length}건 · await 방식 ${c.length}건`);
  return ok;
}

// ── main ──────────────────────────────────────────────────────────────────
const isMain = process.argv[1]?.includes('check-rpconce');
if (isMain) {
  console.log('\n🧪 계측이 요청을 두 번 쏘는가 — thenable 이중 소비\n');
  let bad = 0;
  if (!(await reproduce())) { console.log('\n❌ 함정 재현 실패 — 이 검사는 믿을 게 못 됩니다\n'); process.exit(1); }
  if (!selftest()) { console.log('\n❌ 하네스 자신이 고장났습니다\n'); process.exit(1); }

  const roots = ['app/src', 'supabase/functions'];
  const files: string[] = [];
  const walk = (d: string) => {
    let ents: string[]; try { ents = readdirSync(d); } catch { return; }
    for (const e of ents) {
      if (e === 'node_modules' || e.startsWith('.')) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  roots.forEach(walk);

  console.log(`\n  소스 ${files.length}개를 본다\n`);
  for (const f of files) {
    for (const h of doubleConsume(readFileSync(f, 'utf8'), f)) {
      bad++;
      console.log(`   ❌ ${f}:${h.line}  「${h.name}」 을 then 으로 한 번, return 으로 또 한 번 소비합니다`);
    }
  }

  if (bad) {
    console.log(`\n❌ ${bad}곳 — thenable 이면 **요청이 두 번** 나갑니다.`);
    console.log('   처방: 첫 소비 때 한 번만 흘려보내고 그 Promise 를 나눠 쓰세요(adminTrace.ts 의 `once` 참고).\n');
    process.exit(1);
  }
  console.log('\n✅ 두 번 소비하는 곳 없음\n');
}
