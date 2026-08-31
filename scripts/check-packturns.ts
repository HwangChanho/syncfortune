// scripts/check-packturns.ts — 대화 묶음 값이 **앱과 서버에서 같은가**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"마진률 90위로 다 잡아"* 로 5턴 → 2턴)
//
// ■ ★이 값은 **두 곳에 있다** — 그리고 하는 일이 다르다
//   · `supabase/functions/talk/index.ts` 의 `PACK_TURNS` = **실제로 운을 빼는 값**(권위)
//   · `app/src/lib/billing/coinPrices.ts` 의 `TALK_PACK.turns` = **화면에 적는 값**
//   어긋나면 화면은 「10운에 5턴」이라 말하고 서버는 2턴마다 뺀다 —
//   ⚠️**돈에 관해 화면이 거짓말한다.** 오류도 안 나고, 사용자가 세어 보기 전엔 아무도 모른다.
//   ★이 저장소가 반복해서 데인 «두 곳이 서로를 모른다» 부류다
//     (빌드번호·궁합 숫자·배너 스펙 … 매번 같은 모양으로 돌아왔다).
//
// 무엇을 지키나
//   T1 두 값이 같다
//   T2 마진 기준을 지킨다 — 가장 불리한 팩에서도 **평균 마진 90% 이상**
//      (Boss 기준. 원가는 실측값을 상수로 박아 두고, 값이 바뀌면 이 검사가 먼저 운다)
//
// ★음성 테스트: `npx tsx scripts/check-packturns.ts --selftest`
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

/** 실측 상수 — 2026-08-30 `talk_messages` 기준. 바뀌면 여기를 고치고 근거를 적는다. */
export const COST_PER_TURN_WON = 20.7;   // 1:1 평균. p90 는 43.9(참고)
export const MIN_MARGIN = 0.90;          // Boss 2026-08-31 기준

// ── 판정기 ──────────────────────────────────────────────────────────────────

/** 서버 권위값. */
export function serverTurns(src: string): number | null {
  const m = strip(src).match(/const\s+PACK_TURNS\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** 앱 표기값. */
export function appTurns(src: string): number | null {
  const m = strip(src).match(/TALK_PACK\s*=\s*\{[^}]*turns\s*:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** 묶음 값. */
export function appCost(src: string): number | null {
  const m = strip(src).match(/TALK_PACK\s*=\s*\{[^}]*cost\s*:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** 팩 목록 + 웹 가격을 읽어 **운 1개당 실수령**의 최솟값을 구한다. */
export function worstWonPerCoin(src: string): number | null {
  const s = strip(src);
  const packs = [...s.matchAll(/id:\s*'(coin_\d+)',\s*coins:\s*(\d+),\s*won:\s*(\d+)/g)]
    .map((m) => ({ id: m[1], coins: Number(m[2]), won: Number(m[3]) }));
  if (!packs.length) return null;
  const web = new Map<string, number>();
  for (const m of s.matchAll(/(coin_\d+):\s*\{\s*web:\s*(\d+)/g)) web.set(m[1], Number(m[2]));
  let worst = Infinity;
  for (const p of packs) {
    worst = Math.min(worst, (p.won * 0.70) / p.coins);                       // 스토어 수수료 30%
    const w = web.get(p.id);
    if (w) worst = Math.min(worst, (w * 0.97) / p.coins);                    // 웹 PG 3%
  }
  return Number.isFinite(worst) ? worst : null;
}

/** 가장 불리한 팩의 평균 마진. */
export function worstMargin(wonPerCoin: number, cost: number, turns: number): number {
  const revPerTurn = wonPerCoin * (cost / turns);
  return revPerTurn > 0 ? 1 - COST_PER_TURN_WON / revPerTurn : -Infinity;
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const EDGE = 'supabase/functions/talk/index.ts';
  const APP = 'app/src/lib/billing/coinPrices.ts';
  const edge = read(EDGE), app = read(APP);

  if (!edge) fail('T0', `${EDGE} 를 못 읽었다`);
  if (!app) fail('T0', `${APP} 를 못 읽었다`);

  if (edge && app) {
    const st = serverTurns(edge), at = appTurns(app), ac = appCost(app);
    if (st === null) fail('T1', `${EDGE} 에서 \`PACK_TURNS\` 를 못 읽었다`);
    else if (at === null) fail('T1', `${APP} 에서 \`TALK_PACK.turns\` 를 못 읽었다`);
    else if (st !== at) {
      fail('T1', `묶음 턴 수가 **어긋났다** — 서버 ${st}턴 · 화면 ${at}턴.\n        `
        + '⚠️화면이 돈에 관해 거짓말한다(서버가 실제로 뺀다). 오류가 안 나는 종류다.\n        '
        + `서버 ${EDGE} \`PACK_TURNS\` · 화면 ${APP} \`TALK_PACK.turns\``);
    }

    const wpc = worstWonPerCoin(app);
    if (wpc === null) fail('T2', `${APP} 에서 팩 가격을 못 읽었다`);
    else if (st !== null && ac !== null) {
      const m = worstMargin(wpc, ac, st);
      if (m < MIN_MARGIN) {
        fail('T2', `가장 불리한 팩의 평균 마진이 **${(m * 100).toFixed(1)}%** — 기준 ${MIN_MARGIN * 100}% 미달.\n        `
          + `(운당 실수령 ₩${wpc.toFixed(1)} × ${ac}운/${st}턴 = 턴당 ₩${(wpc * ac / st).toFixed(0)} · 원가 ₩${COST_PER_TURN_WON})\n        `
          + 'Boss 2026-08-31 *"마진률 90위로 다 잡아"*.\n        '
          + '⚠️값을 내리거나 보너스를 키우면 여기가 먼저 운다 — 그게 이 검사의 목적이다');
      }
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const APP_OK = `export const COIN_PACKS = [\n`
    + `  { id: 'coin_100', coins: 100, won: 9900, bonusPct: 0 },\n`
    + `  { id: 'coin_1200', coins: 1200, won: 89900, bonusPct: 32 },\n];\n`
    + `export const PRICE_DIVERGENCE = { coin_100: { web: 7200 }, coin_1200: { web: 65000 } };\n`
    + `export const TALK_PACK = { cost: 10, turns: 2 } as const;`;
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'T1 서버 값을 읽는다', run: () => serverTurns('const PACK_TURNS = 2;') === 2 },
    { name: 'T1 앱 값을 읽는다', run: () => appTurns(APP_OK) === 2 },
    { name: 'T1 묶음 값을 읽는다', run: () => appCost(APP_OK) === 10 },
    { name: 'T1 어긋나면 다르게 나온다',
      run: () => serverTurns('const PACK_TURNS = 5;') !== appTurns(APP_OK) },
    { name: 'T1 주석 속 값에 안 속는다',
      run: () => serverTurns('// const PACK_TURNS = 9;\nconst PACK_TURNS = 2;') === 2 },
    { name: 'T2 가장 불리한 팩을 고른다(coin_1200 ≈ ₩52.4)',
      run: () => Math.abs((worstWonPerCoin(APP_OK) ?? 0) - 52.44) < 0.2 },
    { name: 'T2 2턴이면 90% 이상',
      run: () => worstMargin(52.44, 10, 2) >= 0.90 },
    { name: 'T2 3턴이면 90% 미만 — 실제로 문다',
      run: () => worstMargin(52.44, 10, 3) < 0.90 },
    { name: 'T2 5턴이면 크게 미달',
      run: () => worstMargin(52.44, 10, 5) < 0.85 },
    { name: 'T2 웹 가격도 본다(스토어만 보면 놓친다)',
      run: () => { const only = worstWonPerCoin(APP_OK.replace(/PRICE_DIVERGENCE[\s\S]*?;\n/, ''));
                   return only !== null && (worstWonPerCoin(APP_OK) ?? 0) <= only; } },
    { name: 'T2 보너스를 키우면(가격 동결·운 증가) 마진이 떨어져 잡힌다',
      run: () => worstMargin((89900 * 0.70) / 2000, 10, 2) < 0.90 },
    { name: '못 읽으면 단정하지 않는다', run: () => serverTurns('const a = 1;') === null },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:packturns — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:packturns — 묶음 값이 앱·서버에서 같고, 가장 불리한 팩도 마진 90% 이상');
