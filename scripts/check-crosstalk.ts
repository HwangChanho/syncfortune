// scripts/check-crosstalk.ts — AI 끼리 **티키타카**가 도는가 · ⚠️**안 시켰는데 돈이 나가지 않는가**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"AI끼리 붙이면 티키타카 5턴 이상 + 운 소모"*
//
// ■ ★어디서 나온 요구인가 — 실제 기록이 있다
//   08-26 20:02 회원: *"서윤이랑 노쎔이랑 둘이 한국어로 대화해봐"*
//   → 한 사람이 **한 번** 답하고 끝났다(DB 로 확인). 회원은 둘이 주고받기를 기대했다.
//
// ■ ⚠️★이 하네스가 가장 신경 쓰는 것은 **오탐**이다
//   티키타카 턴은 **운을 뺀다**(묶음 하나를 당겨 쓴다). 그래서 «안 시켰는데 발동» 은
//   기능 오작동이 아니라 **돈 사고**다([[double-charge-unlock-claim]]·[[pay-alert-must-show-numbers]]).
//   ⇒ 음성 케이스를 **양성보다 많이** 넣는다. 같은 방 기록에 실제로 있던 문장을 쓴다.
//
// ■ 검사
//   C1 Boss 실제 문장을 잡는다
//   C2 ★★안 시킨 말에는 **안 걸린다**(그 방의 실제 문장들 포함)
//   C3 대사 마커를 떼어 내고, **방에 없는 사람**은 버린다
//   C4 대사 상한을 넘지 않는다
//   C5 ★저장 **전에** 뗀다(남기면 이력에 실려 모델이 따라 쓴다)
//   C6 ★본문이 비어도 대사가 있으면 **통과**시킨다(서버·앱 **둘 다**)
//   C7 ★과금이 티키타카를 **묶음 중간에도** 받는다 · ⚠️무료 구간은 여전히 무료
//   C8 자기검사 — 판정을 «항상 참» 으로 두면 C2 가 깨져야 한다
//
// 실행: npm run check:crosstalk
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const EDGE = 'supabase/functions/talk/index.ts';
const LIVE = 'app/src/lib/talk/liveTalk.ts';
const src = readFileSync(EDGE, 'utf8');

let fail = 0;
const say = (c: boolean, m: string, d = '') => { if (!c) fail++; console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(48)} ${d}`); };
console.log('\n🗣  check:crosstalk — AI 끼리 티키타카 · 안 시켰는데 돈이 나가지 않는가\n');

/** 소스에서 함수 본문을 꺼내 **실제로 돌린다** — 규칙을 여기 베끼지 않는다. */
function bodyOf(name: string, args: string): (...a: unknown[]) => unknown {
  // ⚠️★2026-08-27 실측: 종전 식은 **반환 타입 안의 중괄호**를 본문 시작으로 봤다 —
  //   `): { body: string; lines: { name: string; line: string }[] } {` 에서 두 번째 `{` 에 멈춰
  //   본문 대신 «타입 조각» 을 꺼내 `string is not defined` 로 죽었다.
  //   ⇒ 본문 여는 중괄호는 **뒤에 개행이 온다**. 타입 안의 중괄호는 한 줄에 이어진다. 그걸로 가른다.
  const re = new RegExp(`function ${name}\\(([\\s\\S]*?)\\)(?::[^\\n]*?)?\\s*\\{\\n`);
  const m = re.exec(src);
  if (!m) throw new Error(`${name} 을 소스에서 못 찾았습니다`);
  let i = m.index + m[0].length, depth = 1;
  while (i < src.length && depth > 0) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}') depth--; i++; }
  // ★타입 표기만 지운다(값·정규식은 그대로).
  //   ⚠️2026-08-27: 종전 식은 `const lines: { name: string; line: string }[] = []` 를 **못 지웠다**
  //     — 중괄호 안에 `;` 가 들어간 형태를 안 봤다. ⇒ 선언은 **첫 `=` 까지**를 통째로 걷어낸다.
  const js = src.slice(m.index + m[0].length, i - 1)
    .replace(/\b(const|let)\s+(\w+)\s*:[^=\n]+=/g, '$1 $2 =')   // 선언의 타입
    .replace(/(\(|,)\s*(\w+)\s*:\s*string\b/g, '$1 $2')          // 파라미터의 타입
    .replace(/\)\s*:\s*\{[^}]*\}\s*=>/g, ') =>')                 // 화살표 반환 타입
    .replace(/ as [\w[\]<>| ]+/g, '');
  // eslint-disable-next-line no-new-func
  return new Function(args, js) as (...a: unknown[]) => unknown;
}

let wants: (t: string) => boolean;
let split: (t: string, names: string[]) => { body: string; lines: { name: string; line: string }[] };
try {
  wants = bodyOf('wantsCrosstalk', 'text') as never;
  const MAX = Number(/const CROSSTALK_MAX = (\d+)/.exec(src)?.[1] ?? 8);
  (globalThis as Record<string, unknown>).CROSSTALK_MAX = MAX;
  split = bodyOf('splitCrosstalk', 'text, names') as never;
} catch (e) { console.log(`  ❌ 판정기를 못 꺼냈습니다 — ${(e as Error).message}\n`); process.exit(1); }

// ── C1 시켰을 때 ─────────────────────────────────────────────────────────
{
  const yes = [
    '서윤이랑 노쎔이랑 둘이 한국어로 대화해봐',   // ← Boss 실제 문장(08-26 20:02)
    '너희끼리 얘기 좀 해봐',
    '둘이 서로 이야기해 보세요',
    '선생님들끼리 토론해 주세요',
  ];
  const miss = yes.filter((q) => !wants(q));
  say(miss.length === 0, 'C1 시키면 **잡는다**', miss.length ? `못 잡음: ${miss.join(' · ')}` : `${yes.length}개(Boss 실제 문장 포함)`);
}

// ── C2 ★★안 시켰을 때 — 여기가 **돈**이다 ────────────────────────────────
{
  const no = [
    '말해봐 충이야기 할꺼 있다면서',        // ← 같은 방 실제 문장. 티키타카가 **아니다**
    '서윤아',                              // ← 실제 문장
    '서윤이 먼저 말해',                     // ← 실제 문장(한 사람을 지목한 것)
    '내 사주 얘기 좀 해줘',                 // «얘기» 는 있지만 상대 지시가 없다
    '영어로 말해줘',
    '이번에는 이탈리아어로 말해줘',
    '올해 이사가도되나요',
    '나는 언제 애인이생길까?',
    '오늘 운세 알려줘',
    '연애운 어때',
  ];
  const wrong = no.filter((q) => wants(q));
  say(wrong.length === 0, 'C2 ★안 시킨 말에는 **안 걸린다**(=돈이 안 나간다)',
    wrong.length ? `⚠️걸림: ${wrong.join(' · ')}` : `${no.length}개 전부 통과(실제 대화 문장 포함)`);
}

// ── C3·C4 마커 분리 ──────────────────────────────────────────────────────
{
  const names = ['노쌤', '한서윤'];
  const raw = ['[[말::노쌤]]서윤 님, 이 사람 卯酉冲 어떻게 봐?',
    '[[말::한서윤]]관계 쪽이 먼저 흔들려요.',
    '[[말::최자미]]저도 한마디…',              // ← 방에 **없는 사람**
    '[[말::노쌤]]나는 일 쪽으로 보이는데.'].join('\n');
  const r = split(raw, names);
  say(r.lines.length === 3 && r.lines.every((l) => names.includes(l.name)),
    'C3 마커를 떼고 **방에 없는 사람은 버린다**', `${r.lines.length}줄 · ${r.lines.map((l) => l.name).join('→')}`);
  say(r.body === '', 'C3b 본문에 마커가 **안 남는다**', r.body ? `남음: 「${r.body.slice(0, 30)}」` : '깨끗함');

  const many = Array.from({ length: 20 }, (_, i) => `[[말::노쌤]]${i}번째 말`).join('\n');
  const cap = Number(/const CROSSTALK_MAX = (\d+)/.exec(src)?.[1] ?? 8);
  say(split(many, names).lines.length === cap, 'C4 대사 상한을 넘지 않는다', `20줄 → ${split(many, names).lines.length}줄 (상한 ${cap})`);
}

// ── C5 저장 전에 떼는가 ──────────────────────────────────────────────────
{
  const at = src.indexOf('splitCrosstalk(answer');
  const save = src.indexOf("from('talk_messages').insert({\n        session_id: sid, owner_id: uid, role: 'assistant', body: answer");
  const anySave = save > 0 ? save : src.indexOf("role: 'assistant', body: answer");
  say(at > 0 && anySave > 0 && at < anySave, 'C5 ★저장 **전에** 뗀다',
    at < 0 ? '안 부른다' : at < anySave ? '저장보다 앞선다' : '⚠️저장 뒤 — 이력에 마커가 남는다');
}

// ── C6 본문이 비어도 통과 (서버·앱 둘 다) ────────────────────────────────
{
  const server = /if \(!answer && !crossLines\.length\) return json\(\{ error: 'empty'/.test(src);
  const live = readFileSync(LIVE, 'utf8');
  const app = /if \(!data\?\.answer && !cross\.length\)/.test(live);
  say(server && app, 'C6 ★본문이 비어도 대사가 있으면 통과',
    `${server ? '서버✓' : '서버✗'} ${app ? '앱✓' : '앱✗'}` + (server && app ? '' : ' — 운 내고 아무것도 못 본다'));
}

// ── C7 과금 ──────────────────────────────────────────────────────────────
{
  // ★★조건을 **문자열로 통째 비교하지 않는다** — 항의 순서만 바꿔도 깨지는 검사는
  //   «이름으로 판정하는» 것과 같다([[harness-judge-expression-not-name]]).
  //   ⇒ `check:talkcoin` ⑤ 와 **같은 방식**: 운을 실제로 빼는 자리를 집고, 그 `if` 의 조건을
  //     괄호 짝을 맞춰 꺼내 **항이 들어 있는지**만 본다. 주석이 몇 줄이든, 순서가 어떻든 선다.
  const spend = src.search(/rpc\(\s*'spend_coins_owner'/);
  let guard = '';
  if (spend > 0) {
    const open = src.lastIndexOf('if (', spend);
    if (open >= 0) {
      let i = open + 4, d = 1;
      while (i < src.length && d > 0) { const ch = src[i]; if (ch === '(') d++; else if (ch === ')') d--; i++; }
      if (d === 0) guard = src.slice(open + 4, i - 1);
    }
  }
  const group = /const crosstalkTurn = isGroup && wantsCrosstalk\(/.test(src);
  say(/\bcrosstalkTurn\b/.test(guard), 'C7 티키타카는 **묶음 중간에도** 낸다',
    /\bcrosstalkTurn\b/.test(guard) ? `차감 조건에 있다: 「${guard.slice(0, 52)}」` : '묶음 중간이면 공짜로 5턴어치가 나간다');
  say(/\boverFree\b/.test(guard) && /coinCost\s*>\s*0/.test(guard), 'C7b ⚠️무료 구간은 **여전히 무료**',
    /\boverFree\b/.test(guard) ? '차감 조건이 overFree·coinCost 를 본다' : '⚠️무료라면서 뺀다');
  say(group, 'C7c ⚠️**여럿이 있는 방**에서만 발동', group ? '`isGroup &&`' : '1:1 에서도 걸린다');
}

// ── C8 자기검사 ──────────────────────────────────────────────────────────
{
  const always = () => true;
  const no = ['말해봐 충이야기 할꺼 있다면서', '영어로 말해줘'];
  const caught = no.every((q) => always() && !wants(q));
  say(caught, 'C8 자기검사 — 「항상 참」이면 C2 가 깨진다', caught ? '대조군 확인' : '대조군이 안 맞는다 — 하네스가 헛돈다');
}

console.log(fail === 0 ? '\n✅ 시키면 티키타카가 돌고, 안 시키면 운이 나가지 않습니다\n'
  : `\n❌ ${fail}건\n`);
process.exit(fail === 0 ? 0 : 1);
