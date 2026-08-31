// scripts/check-chartrefresh.ts — 명식을 고치면 **보던 화면이** 갱신되는가
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31
//   *"지금 명식을 수정하거나 등록하면 기존 뷰에서 갱신되는게 아니고 새로운 뷰가 생성되는데
//     기존 만세력 뷰에서 갱신되게해"*)
//
// ■ ★원인이 **둘**이었다 — 하나만 고치면 증상이 남는다
//   ① 등록·수정이 `router.replace` 로 화면을 **또 쌓았다**
//      ⇒ `router.dismissTo`(react-navigation `POP_TO`) 로 **기존 화면까지 되돌아간다**
//   ② `ChartPicker` 가 `viewOnly` 일 때 변경 구독에서 **통째로 조기 return** 했다
//      ⇒ 만세력이 명식 수정·등록을 **영영 못 들었다**
//   ★이 저장소가 반복해서 겪은 «증상 하나 · 원인 여럿» 이다. 그래서 **둘 다** 규칙으로 박는다.
//
// 무엇을 지키나
//   F1 등록·수정 뒤 만세력으로 갈 때 `replace` 가 아니라 `dismissTo` 를 쓴다
//   F2 만세력 화면이 **변경 소식을 구독**한다(`subscribeRepChange`)
//   F3 `ChartPicker` 의 구독이 `viewOnly` 라도 **목록은 다시 읽는다**
//      (조기 return 이 `reload()` 앞에 있으면 안 된다)
//
// ★음성 테스트: `npx tsx scripts/check-chartrefresh.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
export const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
   .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기 ──────────────────────────────────────────────────────────────────

/** 만세력(`/charts`)으로 가면서 **화면을 쌓는** 코드가 남아 있는가. */
export function stacksOnCharts(src: string): boolean {
  return /router\.(replace|push)\s*\(\s*['"`]\/charts['"`]/.test(strip(src));
}

/** 만세력으로 **되돌아가는** 코드가 있는가. */
export function dismissesToCharts(src: string): boolean {
  return /router\.dismissTo\s*\(\s*['"`]\/charts['"`]/.test(strip(src));
}

/** 변경 소식을 구독하는가. */
export function subscribes(src: string): boolean {
  return /subscribeRepChange\s*\(/.test(strip(src));
}

/**
 * `viewOnly` 조기 return 이 `reload()` **앞**에 있는가(= 목록 갱신을 막는가).
 * @returns true = 막는다(문제) · false = 안 막는다 · null = 구독을 못 찾음
 */
export function viewOnlyBlocksReload(src: string): boolean | null {
  const s = strip(src);
  const i = s.indexOf('subscribeRepChange(');
  if (i < 0) return null;
  const body = s.slice(i, i + 500);
  const guard = body.search(/viewOnlyRef\.current\s*\)\s*return/);
  const reload = body.indexOf('reload()');
  if (guard < 0 || reload < 0) return null;
  return guard < reload;
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const REG = 'app/src/app/(app)/register.tsx';
  const ANA = 'app/src/app/(app)/analyzed.tsx';
  const CHARTS = 'app/src/app/(app)/charts.tsx';
  const PICKER = 'app/src/components/ChartPicker.tsx';

  for (const p of [REG, ANA]) {
    const src = read(p);
    if (!src) { fail('F0', `${p} 를 못 읽었다`); continue; }
    if (stacksOnCharts(src)) {
      fail('F1', `${p} 가 만세력으로 가면서 **화면을 쌓는다**(\`replace\`/\`push\`).\n        `
        + '⇒ `router.dismissTo(\'/charts\')` — 스택을 거슬러 **기존 만세력까지 되돌아간다**.\n        '
        + '★`replace` 는 현재 화면만 바꾼다 — 아래 깔린 옛 만세력이 그대로 남아\n        '
        + '뒤로 가면 옛 명식이 또 나온다(Boss 2026-08-31 지적).');
    }
  }
  const ana = read(ANA);
  if (ana && !dismissesToCharts(ana)) {
    fail('F1', `${ANA} 에 만세력으로 **되돌아가는** 길이 없다 — 등록 뒤 도착지가 사라졌나`);
  }

  const charts = read(CHARTS);
  if (!charts) fail('F0', `${CHARTS} 를 못 읽었다`);
  else if (!subscribes(charts)) {
    fail('F2', `${CHARTS} 가 명식 변경을 **구독하지 않는다**.\n        `
      + '되돌아와도 옛 내용이 남는다 — 화면이 다시 마운트되지 않기 때문이다.\n        '
      + '★`subscribeRepChange` 는 **실제로 바뀔 때만** 운다(포커스마다 읽는 방식과 달리\n        '
      + '«골라 본 명식이 홱 대표로 돌아가는» 부작용이 없다)');
  }

  const picker = read(PICKER);
  if (!picker) fail('F0', `${PICKER} 를 못 읽었다`);
  else if (viewOnlyBlocksReload(picker) === true) {
    fail('F3', `${PICKER} 의 구독이 \`viewOnly\` 에서 **목록 갱신까지 막는다**.\n        `
      + '막으려던 건 «대표가 바뀌어 화면이 홱 넘어가는 것» 하나인데\n        '
      + '조기 return 이 `reload()` 앞에 있어 **만세력이 수정·등록을 못 듣는다**.\n        '
      + '⇒ `reload()` 를 먼저 부르고, 그다음에 `viewOnly` 를 본다');
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const GOOD = `subscribeRepChange(() => { reload(); if (viewOnlyRef.current) return; onChange(); })`;
  const BAD  = `subscribeRepChange(() => { if (viewOnlyRef.current) return; reload(); onChange(); })`;
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'F1 replace 로 쌓으면 문다', run: () => stacksOnCharts(`router.replace('/charts')`) === true },
    { name: 'F1 push 로 쌓아도 문다', run: () => stacksOnCharts(`router.push('/charts')`) === true },
    { name: 'F1 dismissTo 는 통과', run: () => stacksOnCharts(`router.dismissTo('/charts')`) === false },
    { name: 'F1 dismissTo 를 알아본다', run: () => dismissesToCharts(`router.dismissTo('/charts')`) === true },
    { name: 'F1 다른 화면의 replace 는 대상 아님', run: () => stacksOnCharts(`router.replace('/')`) === false },
    { name: 'F1 주석 속 코드에 안 속는다',
      run: () => stacksOnCharts(`// router.replace('/charts')\nconst a=1;`) === false },
    { name: 'F2 구독을 알아본다', run: () => subscribes(`useEffect(() => subscribeRepChange(fn), [])`) === true },
    { name: 'F2 없으면 문다', run: () => subscribes(`useEffect(() => {}, [])`) === false },
    { name: 'F3 reload 가 먼저면 통과', run: () => viewOnlyBlocksReload(GOOD) === false },
    { name: 'F3 조기 return 이 먼저면 문다', run: () => viewOnlyBlocksReload(BAD) === true },
    { name: 'F3 구독을 못 찾으면 단정하지 않는다', run: () => viewOnlyBlocksReload('const a = 1;') === null },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:chartrefresh — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:chartrefresh — 명식을 고치면 기존 만세력 화면이 그 자리에서 갱신된다');
