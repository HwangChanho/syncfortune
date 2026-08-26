// scripts/check-speaker.ts — 다인방에서 **누가 답하는가**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27:
//   *"노쎔이랑 서윤쏌을 같이 초대했는데 자꾸 노쎔만 말해"*
//   그리고 실제 대화 기록: 「서윤이 먼저 말해」 · 「서윤아」 · 「말해봐」 로 **세 번 지목했는데**
//   계속 노쌤이 답했다.
//
// ■ ★원인은 **둘**이었다
//   ① 이름 판정이 `text.includes('한서윤')` 뿐이라 **성을 뗀 이름·호격**을 하나도 못 잡았다.
//      («서윤이» · «서윤아» · «서윤쌤» 은 사람이 실제로 부르는 방식인데 전부 통과 못 함)
//   ② 아무도 안 걸리면 **언제나 `roster[0]`**(방을 연 사람) 이었다.
//      그래서 주제어가 없는 평범한 말(«말해봐» · «응»)엔 **늘 같은 사람**이 답했다.
//
// ■ ★판정기를 **소스에서 꺼내 실행**한다 — 베끼지 않는다
//   규칙을 여기 다시 적으면 «하네스는 통과인데 서버는 다르게 도는» 일이 생긴다
//   ([[harness-judge-expression-not-name]] · `check:friendmention` 이 쓰는 방식과 같다).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const src = readFileSync(`${ROOT}supabase/functions/talk/index.ts`, 'utf8');

let fail = 0;
const say = (c: boolean, m: string, d = '') => {
  if (!c) fail++;
  console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(48)} ${d}`);
};

console.log('\n🗣  check:speaker — 다인방에서 누가 답하는가\n');

/** 소스에서 함수 본문을 꺼내 **타입만 지우고** 실행 가능한 형태로 만든다. */
function bodyOf(name: string, args: string): (...a: unknown[]) => unknown {
  const re = new RegExp(`function ${name}\\(([\\s\\S]*?)\\)(?::\\s*\\w+)?\\s*\\{`);
  const m = re.exec(src);
  if (!m) throw new Error(`${name} 을 소스에서 못 찾았습니다`);
  // 여는 중괄호부터 짝이 맞는 닫는 중괄호까지
  let i = m.index + m[0].length, depth = 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  const raw = src.slice(m.index + m[0].length, i - 1);
  // ★타입 표기만 지운다(값·정규식은 그대로) — 선언의 `: T` 와 단언의 `as T`
  const js = raw
    .replace(/:\s*Record<[^>]*>\s*=/g, ' =')
    .replace(/\bconst (\w+):\s*[\w.<>[\]| ]+\s*=/g, 'const $1 =')
    .replace(/\blet (\w+):\s*[\w.<>[\]| ]+\s*=/g, 'let $1 =')
    .replace(/ as [\w[\]<>| ]+/g, '');
  // eslint-disable-next-line no-new-func
  return new Function(args, js) as (...a: unknown[]) => unknown;
}

let isCalled: (t: string, n: string) => boolean;
let pick: (q: string, roster: unknown[], last: string | null) => string;
try {
  isCalled = bodyOf('isCalled', 'text, name') as never;
  const rawPick = bodyOf('pickSpeaker', 'q, roster, lastSpeakerId') as never;
  // pickSpeaker 안에서 isCalled 를 부르므로 전역에 얹어 준다
  (globalThis as Record<string, unknown>).isCalled = isCalled;
  pick = rawPick;
} catch (e) {
  console.log(`  ❌ 판정기를 못 꺼냈습니다 — ${(e as Error).message}\n`);
  process.exit(1);
}

const ROSTER = [
  { id: 'nossem', name: '노쌤', routes: ['saju'], specialty: ['saju'] },
  { id: 'love_seoyun', name: '한서윤', routes: ['love'], specialty: ['love'] },
];

// ── ① 이름을 부르면 그 사람 — ★Boss 가 **실제로 쓴 문장**으로 잰다 ──────────
{
  const cases: [string, string | null, string][] = [
    ['서윤이 먼저 말해', null, 'love_seoyun'],       // ← Boss 실제 문장
    ['서윤아', null, 'love_seoyun'],                 // ← Boss 실제 문장
    ['서윤쌤 어때요?', null, 'love_seoyun'],
    ['한서윤 님 생각은?', null, 'love_seoyun'],
    ['노쌤 사주 좀 봐줘', null, 'nossem'],
  ];
  const bad = cases.filter(([q, last, want]) => pick(q, ROSTER, last) !== want);
  say(bad.length === 0, '① 이름을 부르면 **그 사람이** 답한다',
    bad.length ? bad.map(([q, l, w]) => `「${q}」→${pick(q, ROSTER, l)}(기대 ${w})`).join(' · ')
      : `${cases.length}개 통과(Boss 실제 문장 포함)`);
}

// ── ② 주제가 걸리면 담당자 ────────────────────────────────────────────────
{
  const cases: [string, string | null, string][] = [
    ['내 사주 어때', 'love_seoyun', 'nossem'],
    ['연애운 어때', 'nossem', 'love_seoyun'],
  ];
  const bad = cases.filter(([q, last, want]) => pick(q, ROSTER, last) !== want);
  say(bad.length === 0, '② 주제가 걸리면 **담당자가** 답한다',
    bad.length ? '주제 판정이 직전 화자 규칙에 밀렸다' : '사주→노쌤 · 연애→서윤');
}

// ── ③ ★아무도 안 걸려도 **한 사람이 독점하지 않는다** ──────────────────────
{
  const a = pick('응', ROSTER, 'nossem');
  const b = pick('응', ROSTER, 'love_seoyun');
  const c = pick('말해봐 충이야기 할꺼 있다면서', ROSTER, 'nossem');
  const ok = a !== 'nossem' && b !== 'love_seoyun' && c !== 'nossem';
  say(ok, '③ 평범한 말에 **직전 화자를 또 뽑지 않는다**',
    ok ? '「응」·「말해봐」 가 번갈아 간다'
      : `직전 nossem→${a} · 직전 seoyun→${b} · 「말해봐」→${c} — 방장이 독점한다`);
}

// ── ④ 자기검사 — **옛 규칙**을 넣으면 반드시 걸려야 한다 ────────────────────
{
  const old = (q: string, roster: typeof ROSTER) => {
    const called = roster.find((r) => r.name && q.includes(r.name));
    return called ? called.id : roster[0].id;
  };
  const caught = old('서윤아', ROSTER) === 'nossem' && old('응', ROSTER) === 'nossem';
  say(caught, '④ 자기검사 — 옛 규칙이면 노쌤이 독점한다',
    caught ? '대조군 확인(옛 규칙은 「서윤아」·「응」 둘 다 노쌤)' : '대조군이 안 맞는다 — 하네스가 헛돈다');
}

console.log(fail === 0 ? '\n✅ 이름을 부르면 그 사람이 답하고, 한 사람이 독점하지 않습니다\n'
  : `\n❌ ${fail}건 — 다인방이 «한 사람만 말하는 방» 이 됩니다\n`);
process.exit(fail === 0 ? 0 : 1);
