// scripts/check-domain.ts — 상담가가 **자기 분야를 거절하지 않게**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"성태현한테 점성학 봐달라했는데 자기자리가 아니래"*)
//
// ■ ★원인은 «금지만 있고 허용이 없었던 것»
//   공용 지문:   「여기는 그런 자리가 아니라고 부드럽게 말하고 넘어가라」(코딩·번역 거절용)
//   동료 명단:   「내 분야가 아니면 담당자를 안내하라」
//   그런데 **«내 분야가 무엇인가» 를 말해 주는 곳이 없었다.**
//   ⇒ 모델은 안전한 쪽으로 기울어 사주 밖 주제(점성술·수비학·타로…)를 전부 밀어냈다.
//   ★DB 에는 담당이 **있었다** — `astro_taehyun`(성태현)의 routes 에 `astrology` 가 있다.
//     자료가 아니라 **지문**이 빠져 있었다.
//
// 무엇을 지키나
//   D1 「내가 보는 것」 블록이 **시스템 프롬프트에 실린다**
//   D2 그 블록이 `specialty` 를 **사람 말**로 옮긴다(키를 그대로 뱉지 않는다)
//   D3 ★블록이 **금지선보다 먼저** 온다 — 할 수 있는 것을 먼저 알아야 금지가 예외로 읽힌다
//   D4 활성 상담가의 `specialty` 가 **전부 이름표를 갖는다** — 빠지면 그 사람만 조용히 거절한다
//
// ★음성 테스트: `npx tsx scripts/check-domain.ts --selftest`
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

/** 「내가 보는 것」 블록을 만들어 **싣는가**. */
export function shipsDomainBlock(src: string): boolean {
  const s = strip(src);
  return /function\s+domainBlock\s*\(/.test(s) && /voice\.push\(\s*dom\s*\)/.test(s);
}

/** `specialty` 키를 **사람 말**로 옮기는 표가 있는가. */
export function hasLabelTable(src: string): boolean {
  return /SPECIALTY_LABEL\s*:\s*Record<string,\s*string>/.test(strip(src));
}

/** 분야 블록이 **금지선보다 먼저** 실리는가. */
export function domainBeforeGuardrails(src: string): boolean | null {
  const s = strip(src);
  const dom = s.indexOf('voice.push(dom)');
  const guard = s.indexOf('이 상담사가 말하지 않을 것');
  if (dom < 0 || guard < 0) return null;
  return dom < guard;
}

/** 표가 아는 `specialty` 키들. */
export function labelKeys(src: string): string[] {
  const m = /SPECIALTY_LABEL[^{]*\{([\s\S]*?)\n\};/.exec(strip(src));
  if (!m) return [];
  return [...m[1].matchAll(/(\w+)\s*:/g)].map((x) => x[1]);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const P = 'supabase/functions/talk/index.ts';
  const src = read(P);
  if (!src) fail('D0', `${P} 를 못 읽었다`);
  else {
    if (!shipsDomainBlock(src)) {
      fail('D1', `${P} 가 「내가 보는 것」 블록을 안 싣는다.\n        `
        + '⚠️금지만 적고 **할 수 있는 것**을 안 적으면 모델은 안전한 쪽(거절)으로 기운다 —\n        '
        + '2026-08-31 실측: 점성술 담당이 「제 자리가 아니다」 라고 답했다(담당은 DB 에 있었다)');
    }
    if (!hasLabelTable(src)) {
      fail('D2', `${P} 에 \`SPECIALTY_LABEL\` 표가 없다 — 키(\`astro\`)를 그대로 뱉으면 회원이 못 읽는다`);
    }
    if (domainBeforeGuardrails(src) === false) {
      fail('D3', `${P} 의 분야 블록이 **금지선보다 뒤**에 온다.\n        `
        + '할 수 있는 것을 먼저 알아야 금지가 «예외» 로 읽힌다 — 순서가 반대면 전부를 거절 신호로 읽는다');
    }
    // D4 ★활성 상담가의 specialty 는 전부 이름표를 가져야 한다
    const known = new Set(labelKeys(src));
    const USED = ['saju', 'ziwei', 'tarot', 'astro', 'love', 'wealth', 'today', 'self', 'guide',
      'beauty', 'color', 'car', 'travel', 'heal', 'all'];
    const missing = USED.filter((k) => !known.has(k));
    if (missing.length) {
      fail('D4', `이름표 없는 분야: ${missing.join(', ')}\n        `
        + '⚠️빠진 분야의 상담가만 **조용히** 자기 자리를 거절한다 — 한 명씩 새는 종류다');
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const OK = 'const SPECIALTY_LABEL: Record<string, string> = {\n  saju: 사, astro: 점,\n};\n'
    + 'function domainBlock(spec, t) { return x; }\n'
    + 'voice.push(dom)\nvoice.push(`# 이 상담사가 말하지 않을 것`)';
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'D1 만들고 싣는다', run: () => shipsDomainBlock(OK) === true },
    { name: 'D1 만들기만 하고 안 실으면 문다',
      run: () => shipsDomainBlock('function domainBlock(a){}') === false },
    { name: 'D1 싣기만 하고 함수가 없으면 문다', run: () => shipsDomainBlock('voice.push(dom)') === false },
    { name: 'D2 표가 있으면 통과', run: () => hasLabelTable(OK) === true },
    { name: 'D2 없으면 문다', run: () => hasLabelTable('const X = {}') === false },
    { name: 'D3 분야가 먼저면 통과', run: () => domainBeforeGuardrails(OK) === true },
    { name: 'D3 금지선이 먼저면 문다',
      run: () => domainBeforeGuardrails('voice.push(`# 이 상담사가 말하지 않을 것`)\nvoice.push(dom)') === false },
    { name: 'D3 못 찾으면 단정하지 않는다', run: () => domainBeforeGuardrails('const a=1;') === null },
    { name: 'D4 표의 키를 읽는다', run: () => labelKeys(OK).join(',') === 'saju,astro' },
    { name: '주석 속 코드에 안 속는다',
      run: () => shipsDomainBlock('// function domainBlock(a){}\n// voice.push(dom)') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:domain — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:domain — 상담가가 자기 분야를 «내 자리» 로 안다');
