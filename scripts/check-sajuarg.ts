// scripts/check-sajuarg.ts — `SajuChart` 를 받는 함수에 **전체 차트를 넘기지 않는다**
// ═══════════════════════════════════════════════════════════════════════════
// ★2026-09-02 사고 (Boss *"만세력이 안열려"*) — 만세력이 통째로 안 열렸다.
//   원인: `johu2(c as any)`. `johu2` 는 **`saju`** 를 받는데 **전체 차트 `c`** 를 넘겼다.
//   `c.pillars` 가 없어 `saju.pillars['월']` 에서 터진다:
//     `TypeError: Cannot read properties of undefined (reading '월')`
//
// ■ ★왜 아무도 못 잡았나 — **`as any` 가 타입검사를 껐다.**
//   빼고 나니 `tsc` 가 통과했다. 즉 **캐스트만 없었으면 처음부터 잡혔다.**
//   `check:hooks`·`check:webcrash` 는 초록불이었다(그 규칙들이 보는 것이 아니다).
//   화면을 **브라우저로 떠서야** 잡혔다.
//
// ■ 무엇을 지키나
//   J1 ★`SajuChart` 를 받는 엔진 함수의 **첫 인자**가 `saju` 계열이다
//      (`c.saju` · `saju` · `chart.saju` …). 전체 차트를 넘기면 **런타임에만** 터진다.
//   J2 ★그 자리에 **`as any` 를 쓰지 않는다** — 이 사고를 가능하게 한 바로 그것이다.
//
// ■ ⚠️함수 목록은 **엔진 소스에서 뽑는다**(손으로 적으면 새 함수를 놓친다).
//   `export function 이름(첫인자: SajuChart` 인 것을 전부 모은다.
//
// ★음성 테스트: `npx tsx scripts/check-sajuarg.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ENGINE_DIRS = ['engine', 'interpretation/engine'];
const SCAN_DIRS = ['app/src', 'interpretation', 'supabase/functions'];

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석을 지운다 — 주석 속 예시 코드에 하네스가 속지 않게. */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** `export function 이름(첫인자: SajuChart` 인 함수 이름들. */
export function sajuTakers(src: string): string[] {
  const names: string[] = [];
  for (const m of stripComments(src).matchAll(/export\s+function\s+([A-Za-z_$][\w$]*)\s*\(\s*[A-Za-z_$][\w$]*\s*:\s*SajuChart\b/g)) {
    names.push(m[1]);
  }
  return names;
}

/** 인자 하나를 괄호 균형으로 잘라 낸다(중첩 호출·객체 리터럴 방어). */
export function firstArg(src: string, openIdx: number): string {
  let d = 0, i = openIdx;
  for (; i < src.length && i - openIdx < 2000; i++) {
    const ch = src[i];
    if (ch === '(' || ch === '[' || ch === '{') d++;
    else if (ch === ')' || ch === ']' || ch === '}') { d--; if (!d) break; }
    else if (ch === ',' && d === 1) break;      // 최상위 쉼표 = 첫 인자 끝
  }
  return src.slice(openIdx + 1, i).trim();
}

/**
 * 이 인자가 **saju 를 담고 있나** — ★이름이 아니라 **어디서 왔는지**로 판정한다.
 *
 * ■ ⚠️★첫 두 판이 다 틀렸다. 기록해 둔다(하네스는 이름으로 판정하면 반드시 진다):
 *     ①«낱말 경계로 시작하는 saju» 만 봤다 → `meSaju` 를 틀렸다고 잡았다
 *     ②«이름에 saju 가 있으면 통과» 로 넓혔다 → `meChart`(= `computeChart(...).saju`)를 틀렸다고 잡았다
 *   ⇒ 이름은 아무것도 보장하지 않는다. **그 변수가 무엇을 받았는지**를 본다.
 *
 * @param arg   호출에 넘긴 첫 인자 원문
 * @param file  같은 파일 전체(주석 걷어낸 것) — 지역 변수의 출처를 여기서 찾는다
 * @returns     saju 로 보이면 true. **모르겠으면 true**(못 본 것을 틀렸다고 하지 않는다 — 거짓 빨간불 방지)
 */
export function argIsSaju(arg: string, file: string): boolean {
  const a = arg.replace(/\s+as\s+\w+/g, '').trim();       // `c as any` → `c`
  if (/\.saju\b/.test(a) || /^saju$/.test(a)) return true; // 대놓고 saju
  if (/buildSajuChart\s*\(/.test(a)) return true;          // 그 자리에서 만든 것
  // 홑이름이면 **그 변수의 출처**를 같은 파일에서 찾는다
  if (/^[A-Za-z_$][\w$]*$/.test(a)) {
    const m = file.match(new RegExp(`\\b(?:const|let|var)\\s+${a}\\s*(?::[^=]+)?=\\s*([\\s\\S]{0,300})`));
    if (!m) return true;                                  // 못 찾았다 = 모른다 → 통과
    const rhs = m[1];
    if (/\.saju\b/.test(rhs) || /buildSajuChart\s*\(/.test(rhs)) return true;
    if (/computeChart\s*\(/.test(rhs)) return false;      // ★전체 차트를 통째로 받았다 = 이 사고의 모양
    return true;                                          // 그 밖은 모른다 → 통과
  }
  return true;                                            // 복잡한 식은 판단하지 않는다
}

function walk(dir: string, acc: { file: string; text: string }[] = []) {
  let es: string[]; try { es = readdirSync(dir); } catch { return acc; }
  for (const e of es) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e)) acc.push({ file: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') });
  }
  return acc;
}

function run() {
  // ① SajuChart 를 받는 함수 이름을 엔진에서 모은다
  const takers = new Set<string>();
  for (const d of ENGINE_DIRS) for (const { text } of walk(join(ROOT, d))) sajuTakers(text).forEach((n) => takers.add(n));
  if (!takers.size) { fail('J1', 'SajuChart 를 받는 함수를 한 개도 못 찾았다 — **못 쟀다**'); return; }

  // ② 부르는 곳을 훑는다
  for (const d of SCAN_DIRS) {
    for (const { file, text: raw } of walk(join(ROOT, d))) {
      if (/^(engine|interpretation\/engine)\//.test(file)) continue;   // 정의부는 건너뛴다
      const text = stripComments(raw);
      for (const name of takers) {
        for (const m of text.matchAll(new RegExp(`\\b${name}\\s*\\(`, 'g'))) {
          const open = m.index! + m[0].length - 1;
          const arg = firstArg(text, open);
          if (!arg) continue;
          if (/\bas\s+any\b/.test(arg)) {
            fail('J2', `${file} — \`${name}(${arg})\` 에 **as any** 가 있다.\n        `
              + '⚠️이것이 2026-09-02 «만세력이 안 열려» 를 가능하게 한 바로 그 캐스트다.\n        '
              + '  타입검사를 끄면 «전체 차트를 saju 자리에» 넘겨도 tsc 가 통과한다');
          }
          if (!argIsSaju(arg, text)) {
            fail('J1', `${file} — \`${name}(${arg})\` 의 첫 인자가 **saju 가 아니다**.\n        `
              + '⚠️이 함수는 `saju.pillars[…]` 를 읽는다. 전체 차트를 넘기면 **런타임에만** 터진다\n        '
              + '  (`Cannot read properties of undefined`) — 화면이 통째로 안 열린다. `c.saju` 를 넘겨라');
          }
        }
      }
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cs: { name: string; run: () => boolean }[] = [
    { name: 'J1 함수 이름을 뽑는다', run: () => sajuTakers('export function johu2(saju: SajuChart): X {').includes('johu2') },
    { name: 'J1 ★다른 인자형은 안 뽑는다', run: () => sajuTakers('export function f(x: number) {').length === 0 },
    { name: 'J1 ★주석 속 예시는 안 뽑는다', run: () => sajuTakers('// export function fake(saju: SajuChart)').length === 0 },
    { name: '첫 인자를 자른다', run: () => firstArg('johu2(c.saju)', 'johu2'.length) === 'c.saju' },
    { name: '★중첩 호출을 견딘다', run: () => firstArg('f(g(a, b), c)', 1) === 'g(a, b)' },
    { name: '★객체 리터럴을 견딘다', run: () => firstArg('f({ a: 1, b: 2 }, c)', 1) === '{ a: 1, b: 2 }' },
    { name: 'saju 판정 — 대놓고 saju', run: () => argIsSaju('c.saju', '') && argIsSaju('saju', '') },
    { name: '★이름이 아니라 출처로 — meChart 통과', run: () => argIsSaju('meChart', 'const meChart = computeChart(me.input).saju;') },
    { name: '★이름이 아니라 출처로 — me 통과', run: () => argIsSaju('me', 'const me = buildSajuChart(x);') },
    { name: '★★전체 차트를 문다', run: () => !argIsSaju('c', 'const c = computeChart(input);') },
    { name: '★★as any 로 감싼 전체 차트도 문다', run: () => !argIsSaju('c as any', 'const c = computeChart(input);') },
    { name: '★모르는 것은 통과시킨다(거짓 빨간불 금지)', run: () => argIsSaju('x', '') && argIsSaju('f(y)', '') },
    { name: 'J2 ★as any 를 문다', run: () => /\bas\s+any\b/.test('c as any') },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cs) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:sajuarg — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:sajuarg — saju 를 받는 함수에 전체 차트를 넘긴 곳이 없다');
}
