// scripts/check-inapp.ts — `getProducts` 를 **타입 없이** 부르지 못하게 막는다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 (2026-08-09 · 안드로이드 결제가 한 번도 성공하지 못한 근본 원인):
//   `Purchases.getProducts(ids, type?)` 의 **기본값은 `subs`(구독)** 다.
//   우리 상품은 코인 4종 = 전부 **일회성(inapp)** 이라, 타입을 빼먹으면 Play 가 구독 카탈로그에서
//   찾다가 못 찾고 **빈 배열**을 준다. 그런데 `getProducts` 는 **throw 하지 않는다** →
//   "상품을 불러오지 못했어요"만 뜨고 원인이 어디에도 안 남는다.
//   ★iOS 는 이 구분이 없어 그대로 동작했다 → 플랫폼 문제로 보여 Play·RevenueCat 설정을 며칠 뒤졌다.
//     (설정은 처음부터 전부 정상이었다.)
//
// 검사: `getProducts(` 호출에 **두 번째 인자가 있는지**. 없으면 실패.
//   ★주석·문자열을 지운 **코드만** 보고 판정한다(주석 속 예시 코드에 걸리지 않게).
//
// ★음성 테스트: `npx tsx scripts/check-inapp.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOT = 'app/src';

/** 주석·문자열 리터럴을 지운 '코드만'. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * `getProducts(` 호출 중 **인자가 하나뿐**인 것을 찾는다.
 * 괄호 균형을 세어 인자 목록을 통째로 뽑고, 최상위 콤마가 있는지로 판정한다
 * (`getProducts([a, b])` 처럼 배열 안의 콤마에 속지 않으려고).
 * @returns 위반한 호출의 원문 스니펫 목록
 */
export function findUntypedCalls(src: string): string[] {
  const code = codeOnly(src);
  const out: string[] = [];
  const re = /getProducts\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    let depth = 0, i = m.index + m[0].length - 1, topComma = false;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) break; }
      else if (c === ',' && depth === 1) topComma = true;
    }
    if (!topComma) out.push(code.slice(m.index, Math.min(i + 1, m.index + 90)));
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function selftest(): number {
  const cases: { name: string; src: string; bad: boolean }[] = [
    { name: '타입 있음', src: 'await Purchases.getProducts([id], PRODUCT_TYPE_INAPP);', bad: false },
    { name: '타입 있음(리터럴)', src: "await Purchases.getProducts(['a','b'], 'inapp');", bad: false },
    { name: '타입 없음', src: 'await Purchases.getProducts([productId]);', bad: true },
    { name: '배열 콤마에 속지 않기', src: "await Purchases.getProducts(['a', 'b', 'c']);", bad: true },
    { name: '주석 속 예시', src: '// await Purchases.getProducts([id]);', bad: false },
    { name: '문자열 속 예시', src: "const s = 'getProducts([id])';", bad: false },
  ];
  let fail = 0;
  for (const c of cases) {
    const hit = findUntypedCalls(c.src).length > 0;
    const ok = hit === c.bad;
    if (!ok) fail++;
    console.log(`  ${ok ? '✓' : '✗'} ${c.name.padEnd(20)} 기대=${c.bad ? '적발' : '통과'} 실제=${hit ? '적발' : '통과'}`);
  }
  return fail;
}

const main = () => {
  if (process.argv.includes('--selftest')) {
    console.log('🧪 check:inapp — 음성 테스트');
    const f = selftest();
    console.log(f ? `\n❌ 음성 테스트 ${f}건 실패` : '\n✅ 음성 테스트 전건 통과');
    process.exit(f ? 1 : 0);
  }
  console.log('🛒 check:inapp — getProducts 상품 타입 명시');
  const bad: string[] = [];
  for (const f of walk(ROOT)) {
    for (const snip of findUntypedCalls(fs.readFileSync(f, 'utf8'))) bad.push(`${f} — ${snip}`);
  }
  if (!bad.length) { console.log('  ✓ 모든 getProducts 호출에 상품 타입이 있습니다'); process.exit(0); }
  for (const b of bad) console.log(`  ✗ 타입 누락 → 기본값 'subs' 로 조회됩니다: ${b}`);
  console.log(`\n❌ check:inapp 실패 ${bad.length}건 — 일회성 상품은 'inapp' 을 넘겨야 합니다`);
  process.exit(1);
};
main();
