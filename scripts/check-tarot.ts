// scripts/check-tarot.ts — 대화 타로가 **지어내지 않게**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-09-01 기획 — *"카드가 실제로 뽑히는 상담"*)
//
// ■ ★기획의 뿌리에 규칙 하나가 있다 — **모델이 카드를 뽑지 않는다**
//   모델에게 「카드를 뽑아라」 하면 **매번 좋은 카드를 뽑는다.**
//   나쁜 카드로는 좋은 이야기를 만들기 어려우니, 그럴듯한 쪽으로 기운다.
//   ⇒ 뽑기는 **우리가**(앱의 `lib/tarot.ts` 한 벌) 하고 모델은 **읽기만** 한다.
//   ⚠️이게 풀리면 **오류 없이** 타로가 «항상 좋은 점» 이 된다 — 눈으로는 안 잡힌다.
//
// ■ ★덱을 **복사하지 않는다**
//   Edge 로 옮기면 사본이 둘이 되어 카드 뜻이 화면과 대화에서 갈린다.
//   ⇒ Edge 는 **결과 줄만** 받는다.
//
// 무엇을 지키나
//   T1 앱이 카드를 뽑아 **보낸다**(`askLive` 에 실린다)
//   T2 뽑기가 **`lib/tarot.ts` 한 곳**에서만 일어난다(사본 금지)
//   T3 지문이 **「네가 뽑지 마라」** 를 명시한다
//   T4 안전 세 줄이 들어 있다 — 역방향 · 다시 뽑기 · 블렌딩 금지
//   T5 ★**타로 담당에게, 물었을 때만** 뽑는다(아무 때나 뽑으면 그게 «뜬금없음»)
//
// ★음성 테스트: `npx tsx scripts/check-tarot.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wantsCards, THREE, cardLine } from '../app/src/lib/talk/tarotAsk';   // ★의존성 0 — 진짜 함수를 돌린다

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
export const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
   .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기 ──────────────────────────────────────────────────────────────────

/** 앱이 뽑아서 보내는가. */
export function sendsDrawnCards(src: string): boolean {
  const s = strip(src);
  return /drawThree\s*\(\s*\)/.test(s) && /wantsCards\s*\(/.test(s);
}

/** ★타로 담당에게, 물었을 때만 뽑는가(둘 다 걸려야 한다). */
export function gatedByRoleAndAsk(src: string): boolean {
  const s = strip(src);
  return /specialty\?\.includes\('tarot'\)\s*&&\s*wantsCards\s*\(/.test(s);
}

/** Edge 가 덱을 **복사**해 갖고 있지 않은가. */
export function edgeHasNoDeck(src: string): boolean {
  const s = strip(src);
  // 78장 덱의 흔적 — 카드 이름이 여럿 박혀 있으면 사본이다
  const names = ['The Fool', '바보', 'The Magician', '마법사', 'Wands', '완드'];
  return names.filter((n) => s.includes(n)).length < 2;
}

/** 지문이 「네가 뽑지 마라」를 명시하는가. */
export function saysDoNotDraw(src: string): boolean {
  return /네가 뽑지 마라/.test(strip(src));
}

/** 안전 세 줄. @returns 빠진 것들 */
export function missingSafety(src: string): string[] {
  const s = strip(src);
  const need: Array<[string, RegExp]> = [
    // ⚠️«…» 는 지문에 못 쓴다(`check:dash` — 답변에 새어 나간 이력) ⇒ 낱말로만 본다
    ['역방향을 나쁜 카드로 읽지 마라', /역은 막힘·안쪽·아직이지/],
    ['다시 뽑기를 권하지 마라', /다시 뽑기를 권하지 마라/],
    ['사주로 카드를 설명하지 마라(블렌딩 금지)', /사주로 카드를 설명하지 마라/],
  ];
  return need.filter(([, re]) => !re.test(s)).map(([n]) => n);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const TALK = 'app/src/app/(app)/talk.tsx';
  const EDGE = 'supabase/functions/talk/index.ts';
  const DRAW = 'app/src/lib/talk/tarotDraw.ts';

  const talk = read(TALK), edge = read(EDGE), draw = read(DRAW);

  if (!talk) fail('T0', `${TALK} 를 못 읽었다`);
  else {
    if (!sendsDrawnCards(talk)) {
      fail('T1', `${TALK} 가 카드를 **뽑아 보내지 않는다**.\n        `
        + '⚠️안 보내면 모델이 제 지식으로 **지어낸다** — 그리고 매번 좋은 카드를 뽑는다\n        '
        + '(나쁜 카드로는 좋은 이야기를 만들기 어려우니 그럴듯한 쪽으로 기운다)');
    }
    if (!gatedByRoleAndAsk(talk)) {
      fail('T5', `${TALK} 가 **아무 때나** 뽑는다 — 담당·물음 두 조건이 다 걸려야 한다.\n        `
        + '★타로 담당이 아닌 상담가가 카드를 꺼내거나, 안 물었는데 카드가 나오면\n        '
        + '그게 Boss 가 이미지에서 걱정한 «뜬금없음» 과 같은 종류다');
    }
  }

  if (!draw) fail('T0', `${DRAW} 를 못 읽었다`);
  else if (!/from '\.\.\/tarot'/.test(strip(draw))) {
    fail('T2', `${DRAW} 가 덱을 \`lib/tarot.ts\` 에서 안 가져온다 — **사본을 만들지 마라**`);
  }

  if (!edge) fail('T0', `${EDGE} 를 못 읽었다`);
  else {
    if (!edgeHasNoDeck(edge)) {
      fail('T2', `${EDGE} 안에 **덱 사본**이 있다.\n        `
        + '카드 뜻이 두 곳에 있으면 화면과 대화가 갈린다 — Edge 는 **결과 줄만** 받을 것');
    }
    if (!saysDoNotDraw(edge)) {
      fail('T3', `${EDGE} 의 지문이 **「네가 뽑지 마라」** 를 말하지 않는다.\n        `
        + '카드를 줘도 모델은 «한 장 더» 를 지어낸다 — 명시해야 멈춘다');
    }
    const miss = missingSafety(edge);
    if (miss.length) {
      fail('T4', `타로 안전 문장이 빠졌다: ${miss.join(' · ')}\n        `
        + '★역방향은 막힘·안쪽·아직이지 불행이 아니다 · 다시 뽑기는 점이 아니라 뽑기다 ·\n        '
        + '  사주로 카드를 설명하면 그건 블렌딩이다(기획서 §9-2 와 같은 결)');
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'T1 뽑아 보내면 통과', run: () => sendsDrawnCards('wantsCards(q) ? drawThree() : null') === true },
    { name: 'T1 안 보내면 문다', run: () => sendsDrawnCards('askLive(a, b, c)') === false },
    { name: 'T5 두 조건이 다 걸리면 통과',
      run: () => gatedByRoleAndAsk("(cur.specialty?.includes('tarot') && wantsCards(q)) ? drawThree() : null") === true },
    { name: 'T5 ★물음만 보면 문다(담당이 아닌 사람도 뽑는다)',
      run: () => gatedByRoleAndAsk('wantsCards(q) ? drawThree() : null') === false },
    { name: 'T2 덱 사본이 없으면 통과', run: () => edgeHasNoDeck('const x = 1;') === true },
    { name: 'T2 덱 사본이 있으면 문다',
      run: () => edgeHasNoDeck("const DECK = [{ name: 'The Fool' }, { name: 'The Magician' }];") === false },
    { name: 'T3 「네가 뽑지 마라」가 있으면 통과', run: () => saysDoNotDraw('★**이미 뽑혔다. 네가 뽑지 마라.**') === true },
    { name: 'T3 없으면 문다', run: () => saysDoNotDraw('카드를 읽어라') === false },
    { name: 'T4 세 줄이 다 있으면 빈 배열',
      run: () => missingSafety('역은 막힘·안쪽·아직이지\n다시 뽑기를 권하지 마라\n사주로 카드를 설명하지 마라').length === 0 },
    { name: 'T4 하나 빠지면 잡는다',
      run: () => missingSafety('역은 막힘·안쪽·아직이지\n다시 뽑기를 권하지 마라').length === 1 },
    { name: '★자리가 세 곳이다', run: () => THREE.length === 3 && new Set(THREE).size === 3 },
    { name: '★카드 줄에 자리·이름·방향이 다 있다',
      run: () => cardLine('지금 자리', '바보', true) === '지금 자리: 바보 (역방향)' },
    { name: '★정방향도 적는다', run: () => cardLine('a', 'b', false).includes('정방향') },
    { name: '물음 판정 — 「타로 봐 주세요」는 뽑는다', run: () => wantsCards('타로 봐 주세요') === true },
    { name: '물음 판정 — 「카드 하나만」도 뽑는다', run: () => wantsCards('카드 하나만') === true },
    { name: '★물음 판정 — 「안녕하세요」는 안 뽑는다', run: () => wantsCards('안녕하세요') === false },
    { name: '★빈 말은 안 뽑는다', run: () => wantsCards('') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:tarot — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:tarot — 카드는 우리가 뽑고, 모델은 읽기만 하고, 덱은 한 벌이다');
