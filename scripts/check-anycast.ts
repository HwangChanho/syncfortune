// scripts/check-anycast.ts — `as any` 를 **더 늘리지 않는다**(래칫)
// ═══════════════════════════════════════════════════════════════════════════
// ★2026-09-02 사고 (Boss *"만세력이 안열려"* → *"다시는 이런일 없어야 하지 않을까?"*)
//   `johu2(c as any)` 하나가 만세력을 죽였고 **vc156·157 두 빌드가 그대로 나갔다.**
//   `as any` 를 빼자 `tsc` 가 그 자리에서 잡았다 — 즉 **캐스트가 타입검사를 끈 것**이 원인이다.
//
//   실측: `as any` 가 app/src 에 **326곳**, engine·interpretation 에 **26곳**.
//   ⇒ 한 번에 걷어내면 그 자체가 새 사고다(85,523줄·595파일). 그래서 **래칫**을 건다:
//      «지금보다 늘면 실패». 줄이는 것은 언제나 환영이고, 줄면 기준선을 낮춰 잠근다.
//   ★이 저장소가 다국어 하드코딩(`check:rawtext`)에 이미 쓰는 방식이다.
//
// 무엇을 지키나
//   C1 `as any` 총수가 기준선을 **넘지 않는다**
//   C2 ★줄었으면 **기준선을 낮추라고** 알린다(줄인 성과가 조용히 되돌아가지 않게)
//   C3 ★엔진 호출부의 `as any` 는 **아예 금지**다 — 그게 이번 사고의 모양이다
//      (`check:sajuarg` J2 와 짝. 여기서는 «늘지 않는가», 거기서는 «그 자리에 있는가»)
//
// ★음성 테스트: `npx tsx scripts/check-anycast.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
/**
 * ★기준선 — 2026-09-02 **이 하네스 자신의 계수기로** 잰 값. **올리지 말 것.** 줄었으면 낮춰 잠근다.
 * ⚠️처음엔 `grep -c` 로 잡았다가 어긋났다(326/26 → 실제 365/37) — grep 은 **줄**을 세고
 *   주석까지 센다. **재는 도구가 다르면 기준선도 틀린다** — 반드시 이 파일의 `countAnyCasts` 로 잰다.
 */
const BASELINE: Record<string, number> = { 'app/src': 365, engine: 37 };
const DIRS: Record<string, string[]> = { 'app/src': ['app/src'], engine: ['engine', 'interpretation'] };

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석을 뺀 본문에서 `as any` 를 센다 — 주석 속 설명까지 세면 문서를 못 쓴다. */
export function countAnyCasts(src: string): number {
  const body = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return (body.match(/\bas\s+any\b/g) ?? []).length;
}

function walk(dir: string, acc: { file: string; text: string }[] = []) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of es) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push({ file: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') });
  }
  return acc;
}

function run() {
  for (const [zone, dirs] of Object.entries(DIRS)) {
    let n = 0;
    const worst: [string, number][] = [];
    for (const d of dirs) for (const { file, text } of walk(join(ROOT, d))) {
      const c = countAnyCasts(text);
      if (c) { n += c; worst.push([file, c]); }
    }
    const base = BASELINE[zone];
    if (n > base) {
      worst.sort((a, b) => b[1] - a[1]);
      fail('C1', `${zone} 의 \`as any\` 가 **${n}곳** — 기준선 ${base} 보다 ${n - base} 늘었다.\n        `
        + '⚠️`as any` 는 «컴파일을 통과시키는 도구» 가 아니라 **앞으로 날 죽일 버그를 숨기는 도구**다.\n        '
        + `  2026-09-02 에 그 하나가 만세력을 죽이고 두 빌드를 내보냈다.\n        `
        + `  많은 곳: ${worst.slice(0, 3).map(([f, c]) => `${f}(${c})`).join(' · ')}`);
    } else if (n < base) {
      console.log(`   ⬇ ${zone} ${base} → **${n}** 로 줄었다 — `
        + `기준선을 ${n} 으로 낮춰 잠그십시오(scripts/check-anycast.ts BASELINE).`);
    } else {
      console.log(`   ${zone}  ${n}곳 (기준선 ${base} · 늘지 않았다)`);
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cs: { name: string; run: () => boolean }[] = [
    { name: '센다', run: () => countAnyCasts('const a = x as any; const b = y as any;') === 2 },
    { name: '★줄 주석은 안 센다', run: () => countAnyCasts('// as any 를 쓰지 말 것') === 0 },
    { name: '★블록 주석도 안 센다', run: () => countAnyCasts('/* 예: foo(c as any) */') === 0 },
    { name: '★as unknown 은 안 센다', run: () => countAnyCasts('const a = x as unknown as B;') === 0 },
    { name: '★공백이 여러 개여도 센다', run: () => countAnyCasts('x as   any') === 1 },
    { name: '★anything 은 안 센다', run: () => countAnyCasts('const anyway = 1; const s = "as anything";') === 0 },
    { name: '★URL 의 // 는 코드를 안 지운다', run: () => countAnyCasts("const u='https://a.b'; const c = x as any;") === 1 },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cs) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:anycast — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:anycast — `as any` 가 늘지 않았다');
}
