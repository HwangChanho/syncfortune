// scripts/check-refundnotice.ts — 환불 고지가 **결제 화면에 남아 있는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"환불은 운 구매후 7일 이내에만 환불 가능하게 미사용분만"*
//              · *"결제 환불 관련해서 법적 검토 해보고 알맞게 적용해"*)
//
// ■ ★이건 «있으면 좋은 문구» 가 아니라 **법적 요건**이다
//   전자상거래법 **제17조 제6항** — 청약철회를 제한하려면 그 사실을
//   「소비자가 쉽게 알 수 있는 곳에 **명확하게 표시**」해야 한다.
//   ⇒ 표시가 없으면 **제한 자체가 무효**가 되어, 이미 쓴 운까지 전액 환불 대상이 될 수 있다.
//   화면 정리하다 무심코 지우면 **돈이 나가는 쪽으로** 조용히 바뀐다 — 그래서 규칙으로 못 박는다.
//
// 무엇을 지키나
//   R1 충전 화면이 환불 고지 문구를 그린다
//   R2 그 고지가 **상품 목록 아래**에 있다(약관 깊숙이가 아니라 결제 직전 눈에 드는 자리)
//   R3 정책 문서로 가는 길이 있다(고지만 있고 근거가 없으면 «명확한 표시» 로 보기 어렵다)
//   R4 세 언어(ko·en·ja)에 그 문구가 다 있다 — 한 언어라도 비면 그 나라 사용자에겐 표시가 없는 것
//
// ★음성 테스트: `npx tsx scripts/check-refundnotice.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
export const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기 ──────────────────────────────────────────────────────────────────

/** 고지 문구 키를 그리는가. */
export function showsNotice(src: string): boolean {
  return /coins\.refundNotice/.test(strip(src));
}

/** 고지가 **상품 목록 뒤**에 오는가(자리 = 요건이다). */
export function noticeAfterPacks(src: string): boolean | null {
  const s = strip(src);
  const packs = s.indexOf('COIN_PACKS.map');
  const notice = s.indexOf('coins.refundNotice');
  if (packs < 0 || notice < 0) return null;   // 못 찾으면 단정하지 않는다
  return notice > packs;
}

/** 정책 문서로 가는 길이 있는가. */
export function linksPolicy(src: string): boolean {
  const s = strip(src);
  return /refund-(ko|en|ja)\.html/.test(s) && /coins\.refundPolicy/.test(s);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const P = 'app/src/app/(app)/coins.tsx';
  const src = read(P);
  if (!src) fail('R0', `${P} 를 못 읽었다 — 충전 화면 경로가 바뀌었나`);
  else {
    if (!showsNotice(src)) {
      fail('R1', `${P} 에 환불 고지가 없다.\n        `
        + '⚠️전자상거래법 제17조 제6항 — 표시가 없으면 **청약철회 제한이 무효**가 되어\n        '
        + '이미 사용한 운까지 환불해야 할 수 있다. 문구 하나가 아니라 **돈이 걸린 자리**다');
    }
    if (noticeAfterPacks(src) === false) {
      fail('R2', `${P} 의 환불 고지가 **상품 목록보다 위**에 있다.\n        `
        + '「쉽게 알 수 있는 곳」은 결제 직전이다 — 목록 아래에 둘 것');
    }
    if (!linksPolicy(src)) {
      fail('R3', `${P} 에 취소·환불 정책으로 가는 길이 없다.\n        `
        + '고지만 있고 근거 문서를 못 보면 «명확한 표시» 로 보기 어렵다');
    }
  }
  for (const lang of ['ko', 'en', 'ja']) {
    const c = read(`app/src/copy/${lang}.ts`);
    if (!c) { fail('R4', `copy/${lang}.ts 를 못 읽었다`); continue; }
    for (const key of ['refundNotice', 'refundPolicy']) {
      if (!new RegExp(`${key}\\s*:`).test(c)) {
        fail('R4', `copy/${lang}.ts 에 \`${key}\` 가 없다 — 그 언어 사용자에겐 **표시가 없는 것**이다`);
      }
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const OK = `{COIN_PACKS.map((p) => (<Pack/>))}\n<Text>{t('coins.refundNotice', '…')}</Text>\n`
    + `<Text>{t('coins.refundPolicy', '…')}</Text>\nconst U = 'https://x/legal/refund-ko.html';`;
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'R1 고지가 있으면 통과', run: () => showsNotice(OK) === true },
    { name: 'R1 고지가 없으면 문다', run: () => showsNotice('{COIN_PACKS.map(x)}') === false },
    { name: 'R2 목록 뒤면 통과', run: () => noticeAfterPacks(OK) === true },
    { name: 'R2 목록 앞이면 문다',
      run: () => noticeAfterPacks(`{t('coins.refundNotice')}\n{COIN_PACKS.map(x)}`) === false },
    { name: 'R2 못 찾으면 단정하지 않는다', run: () => noticeAfterPacks('const a = 1;') === null },
    { name: 'R3 정책 링크가 있으면 통과', run: () => linksPolicy(OK) === true },
    { name: 'R3 문구만 있고 링크가 없으면 문다',
      run: () => linksPolicy(`{t('coins.refundPolicy')}`) === false },
    { name: '주석 속 문구에 안 속는다',
      run: () => showsNotice("// {t('coins.refundNotice')}\nconst a = 1;") === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:refundnotice — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:refundnotice — 환불 고지가 결제 직전 자리에 있고, 세 언어와 정책 문서가 갖춰져 있다');
