// scripts/check-paysplit.ts — **앱은 스토어 · 웹은 PG** 가 섞이지 않게
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"다음은 결제 붙이고 테스트하자 앱웹 둘다"* 로 웹 결제를 붙이며)
//
// ■ ★두 길을 **합치면 안 된다** — 합치는 순간 둘 다 위험해진다
//   · 앱에서 PG 로 사면 **스토어 심사에서 걸린다**(외부 결제). 이 앱은 이미 두 번 리젝됐다.
//   · 웹에서 스토어 결제를 부르면 **아무 일도 안 일어난다**(RevenueCat 은 웹에서 false).
//     ⚠️그게 조용해서 더 나쁘다 — 「눌러도 반응 없음」 이 되고 원인이 안 보인다.
//     (2026-08-31 실측: 웹 결제를 붙이기 전 웹에서 팩을 누르면 정확히 그랬다.)
//
// 무엇을 지키나
//   S1 충전 화면이 **면을 갈라** 부른다 — `webPayEnabled` 로 분기하고 두 갈래가 다 있다
//   S2 웹 결제 모듈이 **웹에서만** 열린다(`Platform.OS === 'web'`)
//   S3 스토어 결제(`purchaseCoinPack`)를 **웹 갈래에서 부르지 않는다**
//   S4 값·보너스를 **채널과 함께** 읽는다 — 채널을 안 주면 웹에 스토어 정가가 찍힌다
//      (2026-08-31 실측: 화면 ₩9,900 · 청구 ₩7,200 으로 **돈에 관해 화면이 거짓말**했다)
//
// ★음성 테스트: `npx tsx scripts/check-paysplit.ts --selftest`
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

/** 면을 갈라 부르는가 — 웹 갈래와 스토어 갈래가 **둘 다** 있는가. */
export function splitsByChannel(src: string): boolean {
  const s = strip(src);
  return /if\s*\(\s*webPayEnabled\s*\)/.test(s)
      && /buyOnWeb\s*\(/.test(s)
      && /purchaseCoinPack\s*\(/.test(s);
}

/** 스토어 결제가 **웹 갈래 안**에 있는가(있으면 안 된다). */
export function storeCallInWebBranch(src: string): boolean {
  const s = strip(src);
  const i = s.search(/if\s*\(\s*webPayEnabled\s*\)/);
  if (i < 0) return false;
  const j = s.indexOf('} else {', i);
  if (j < 0) return /purchaseCoinPack\s*\(/.test(s.slice(i, i + 600));
  return /purchaseCoinPack\s*\(/.test(s.slice(i, j));
}

/** 웹 결제 모듈이 웹에서만 열리는가. */
export function webOnlyGate(src: string): boolean {
  return /webPayEnabled\s*=\s*Platform\.OS\s*===\s*'web'/.test(strip(src));
}

/** 값·보너스를 **채널과 함께** 읽는가. */
export function pricesUseChannel(src: string): boolean {
  const s = strip(src);
  const price = /packPriceWon\s*\([^)]*webPayEnabled/.test(s);
  const bonus = /packBonusPct\s*\([^)]*webPayEnabled/.test(s);
  return price && bonus;
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const COINS = 'app/src/app/(app)/coins.tsx';
  const WEBPAY = 'app/src/lib/billing/webPay.ts';
  const coins = read(COINS), webpay = read(WEBPAY);

  if (!coins) fail('S0', `${COINS} 를 못 읽었다`);
  else {
    if (!splitsByChannel(coins)) {
      fail('S1', `${COINS} 가 결제를 **면에 따라 가르지 않는다**.\n        `
        + '앱=스토어 · 웹=PG 두 갈래가 다 있어야 한다.\n        '
        + '⚠️웹에서 스토어 결제를 부르면 **아무 일도 안 난다**(RevenueCat 이 웹에서 false) —\n        '
        + '조용해서 「눌러도 반응 없음」 이 되고 원인이 안 보인다');
    }
    if (storeCallInWebBranch(coins)) {
      fail('S3', `${COINS} 의 **웹 갈래 안**에서 스토어 결제를 부른다 — 웹에서는 안 된다`);
    }
    if (!pricesUseChannel(coins)) {
      fail('S4', `${COINS} 가 값·보너스를 **채널 없이** 읽는다.\n        `
        + '⚠️2026-08-31 실측: 웹인데 스토어 정가(₩9,900)를 찍고 청구는 웹가(₩7,200)였다 —\n        '
        + '**돈에 관해 화면이 거짓말**한다. 손님에게 유리한 방향이라 더 늦게 발견된다.\n        '
        + '⇒ `packPriceWon(id, webPayEnabled ? \'web\' : \'store\')` · `packBonusPct` 도 같이');
    }
  }

  if (!webpay) fail('S0', `${WEBPAY} 를 못 읽었다`);
  else if (!webOnlyGate(webpay)) {
    fail('S2', `${WEBPAY} 의 \`webPayEnabled\` 가 **웹 전용**이 아니다.\n        `
      + '⚠️앱에서 PG 로 사면 **스토어 심사에서 걸린다**(외부 결제). 이 앱은 이미 두 번 리젝됐다');
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const OK = `if (webPayEnabled) {\n  const g = await buyOnWeb(packId, name);\n  if (g == null) return;\n} else {\n  const ok = await purchaseCoinPack(packId);\n}\n`
    + `packPriceWon(p.id, webPayEnabled ? 'web' : 'store')\npackBonusPct(p.id, webPayEnabled ? 'web' : 'store')`;
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'S1 두 갈래가 다 있으면 통과', run: () => splitsByChannel(OK) === true },
    { name: 'S1 분기가 없으면 문다', run: () => splitsByChannel('await purchaseCoinPack(packId);') === false },
    { name: 'S1 웹 갈래만 있으면 문다', run: () => splitsByChannel('if (webPayEnabled) { buyOnWeb(x); }') === false },
    { name: 'S3 웹 갈래가 깨끗하면 통과', run: () => storeCallInWebBranch(OK) === false },
    { name: 'S3 웹 갈래에서 스토어를 부르면 문다',
      run: () => storeCallInWebBranch('if (webPayEnabled) { await purchaseCoinPack(x); } else { y(); }') === true },
    { name: 'S2 웹 전용 게이트면 통과',
      run: () => webOnlyGate("export const webPayEnabled = Platform.OS === 'web';") === true },
    { name: 'S2 무조건 켜면 문다', run: () => webOnlyGate('export const webPayEnabled = true;') === false },
    { name: 'S4 채널을 넘기면 통과', run: () => pricesUseChannel(OK) === true },
    { name: 'S4 값만 채널이고 보너스는 아니면 문다',
      run: () => pricesUseChannel("packPriceWon(p.id, webPayEnabled ? 'web':'store')\npackBonusPct(p.id)") === false },
    { name: 'S4 둘 다 채널이 없으면 문다',
      run: () => pricesUseChannel('packPriceWon(p.id)\npackBonusPct(p.id)') === false },
    { name: '주석 속 코드에 안 속는다',
      run: () => splitsByChannel(OK.split('\n').map((l) => `// ${l}`).join('\n')) === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:paysplit — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:paysplit — 앱은 스토어 · 웹은 PG 로 갈려 있고, 값도 채널을 따른다');
