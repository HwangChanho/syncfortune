// scripts/check-nosteering.ts — 앱 안에서 **외부 결제로 유도하는 것**을 막는다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"웹 충전 카드 빼"*)
//   충전 화면에 「웹에서 충전하면 더 많이 받아요」 + 「웹에서 충전하기」 버튼이 있었다.
//   ⚠️**Apple 3.1.1(안티스티어링)이 금지하는 형태**다 — 외부 결제 페이지로 가는 버튼 +
//   「더 싸다」는 문구. 이 앱은 이미 **두 번 리젝**됐고, 심사는 한 번 걸리면 며칠이 날아간다.
//
// ■ ★2026-08-31 부터 전제가 바뀌었다 — **앱·웹 둘 다 판다**(앱=정가 · 웹 −28%).
//   앱에서도 살 수 있으니 그 카드가 없어도 사용자가 막히지 않는다. 즉 **위험만 남는다.**
//
// 무엇을 지키나
//   N1 앱 코드가 **우리 웹의 결제 화면**을 열지 않는다(`Linking.openURL` 로 `/coins` 등)
//   N2 앱 문구에 **웹이 더 싸다·웹에서 사라**는 안내가 없다
//
// ★웹 코드는 대상이 아니다 — 웹에서 웹 결제로 가는 건 당연하다.
//   `Platform.OS === 'web'` 가지에 있는 것도 문제가 아니지만, **정적으로 가르기 어렵다** ⇒
//   그래서 «우리 웹 도메인 + 결제 경로» 라는 **아주 좁은 조건**만 본다(오탐이 하네스를 죽인다).
// ★음성 테스트: `npx tsx scripts/check-nosteering.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
export const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

type Finding = { rule: string; msg: string };
const out: Finding[] = [];

// ── 판정기 ──────────────────────────────────────────────────────────────────

/** 우리 웹의 **결제 화면**을 여는 코드가 있는가. */
export function opensWebCheckout(src: string): boolean {
  const s = strip(src);
  // niwoon2.pages.dev/coins · /market 처럼 «우리 도메인 + 결제 경로» 만 본다
  return /openURL\s*\([^)]*['"`]https?:\/\/[^'"`]*niwoon[^'"`]*\/(coins|market|pay|checkout)/i.test(s)
      || /['"`]https?:\/\/[^'"`]*niwoon[^'"`]*\/(coins|market|pay|checkout)[^'"`]*['"`]/i.test(s);
}

/** 「웹이 더 싸다 / 웹에서 사라」는 안내 문구가 있는가. */
export function saysBuyOnWeb(src: string): boolean {
  const s = strip(src);
  return /웹에서\s*(충전|결제|구매|사)/.test(s)
      || /(웹|web)[^.\n]{0,20}(더\s*(싸|많|저렴)|수수료가?\s*없)/.test(s);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const walk = (dir: string): string[] => {
    let acc: string[] = [];
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) acc = acc.concat(walk(p));
      else if (/\.(tsx|ts)$/.test(n)) acc.push(p);
    }
    return acc;
  };
  const files = [
    ...walk(join(ROOT, 'app/src/app')),
    ...walk(join(ROOT, 'app/src/components')),
    ...walk(join(ROOT, 'app/src/screens')),
  ];
  for (const f of files) {
    const src = read(f);
    if (!src) continue;
    const rel = f.replace(ROOT, '');
    if (opensWebCheckout(src)) {
      out.push({ rule: 'N1', msg: `${rel} — 앱에서 **우리 웹 결제 화면**을 연다.\n        `
        + '⚠️Apple 3.1.1 안티스티어링이 금지하는 형태다(외부 결제 유도). 이 앱은 이미 두 번 리젝됐다.\n        '
        + '앱·웹 둘 다 파는 지금은 **위험만 남는다** — 앱에서도 살 수 있다' });
    }
    if (saysBuyOnWeb(src)) {
      out.push({ rule: 'N2', msg: `${rel} — 「웹에서 사라 / 웹이 더 싸다」는 안내가 있다.\n        `
        + '버튼이 없어도 **문구만으로 steering** 이 된다. 앱 안에서는 웹 가격을 알리지 않는다' });
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'N1 우리 웹 결제 링크를 문다',
      run: () => opensWebCheckout(`Linking.openURL('https://niwoon2.pages.dev/coins')`) === true },
    { name: 'N1 상수로 빼 둬도 문다',
      run: () => opensWebCheckout(`const U = 'https://niwoon2.pages.dev/coins';`) === true },
    { name: 'N1 결제와 무관한 우리 웹 주소는 통과',
      run: () => opensWebCheckout(`const U = 'https://niwoon2.pages.dev/join/abc';`) === false },
    { name: 'N1 남의 사이트는 대상 아님',
      run: () => opensWebCheckout(`Linking.openURL('https://youtube.com/@x')`) === false },
    { name: 'N2 「웹에서 충전」 문구를 문다', run: () => saysBuyOnWeb(`<Text>웹에서 충전하기</Text>`) === true },
    { name: 'N2 「웹이 수수료가 없어」도 문다', run: () => saysBuyOnWeb(`<Text>웹은 수수료가 없어요</Text>`) === true },
    { name: 'N2 평범한 «웹» 언급은 통과', run: () => saysBuyOnWeb(`<Text>웹에서도 이어서 볼 수 있어요</Text>`) === false },
    { name: '주석 속 코드에 안 속는다',
      run: () => opensWebCheckout(`// Linking.openURL('https://niwoon2.pages.dev/coins')\nconst a=1;`) === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:nosteering — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:nosteering — 앱 안에 외부 결제로 가는 길·문구가 없다');
