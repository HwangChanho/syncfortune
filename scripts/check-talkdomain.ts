// scripts/check-talkdomain.ts — **자기 분야가 아닌 것을 풀이하지 않는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"사주만 봐야하는 노쎔이 갑자기 자미두수 이야기를 꺼네 자미두수는 최자미만 해야해"*
//
// ■ ★★원인이 셋이었다 — 그중 하나는 «있는 줄 알았던 방어막이 통째로 죽어 있던» 것
//   ① **재료**: `buildTalkChartBlock` 이 상담가를 안 가리고 `[자미두수] 명궁·부처궁…` 을 쥐여 줬다.
//   ② **경계**: 「내 분야가 아닐 때」 명단을 만드는 `rosterBlock` 이
//      `me.tagline ?? '상담'` 인데, **호출부 select 에 `tagline` 이 없었다.**
//      ⇒ 늘 «나는 **상담** 을 본다» 가 나갔다. 그건 경계가 아니라 **아무 말도 아니다** —
//        오히려 «뭐든 답해도 된다» 로 읽힌다. ★초록불처럼 보이는 죽은 방어막.
//   ③ **지시**: 공용 지문(`COACH_SYSTEM`)이 *"사주와 자미두수를 함께 읽고 교차해"* 라고 **시킨다.**
//
// ■ ★어느 하나만 고치면 안 되는 이유
//   ①만 고치면 재료는 없는데 지문이 시켜서 **지어낸다.**
//   ③만 고치면 재료가 있으니 «있는 걸 왜 안 봐» 가 되어 지시가 눌린다.
//   ②만 고치면 넘길 곳은 아는데 여전히 자미 재료를 쥐고 있다.
//   ⇒ **재료를 빼고, 경계를 살리고, 지시로 못 박는다.** 셋 다.
//
// ■ 검사
//   D1 자미 줄이 **담당에게만** 가게 옵션이 있고, 호출부가 그 옵션을 **실제로 넘긴다**
//   D2 상담가 select 가 `tagline`·`specialty` 를 **가져온다**(안 가져오면 경계가 죽는다)
//   D3 `rosterBlock` 이 분야를 모를 때 **가짜 경계를 만들지 않는다**
//   D4 대화 지문이 «자미두수는 담당만» 을 못 박는다
//   D5 ★**데이터로 확인** — 자미 담당이 정확히 최자미 하나인가(DB 조회)
//
// 실행: npm run check:talkdomain
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const TALK = 'supabase/functions/talk/index.ts';
const BUILD = 'supabase/functions/_shared/buildUserPrompt.ts';
const ROSTER = 'supabase/functions/_shared/roster.ts';

/** `rosterBlock` 이 «분야를 모를 때» 빈 문자열을 돌려주는가 — 소스를 실제로 실행해 확인한다. */
export function rosterFallsBackToNothing(src: string): boolean {
  // ★주석을 먼저 걷어낸다 — 첫 판에서 **내가 적은 설명 주석**(`me.tagline ?? '상담'` 이었다)을
  //   하네스가 코드로 읽고 울었다. 같은 일이 전에도 있었다([[talk-system-2026-08-24]]).
  //   ⇒ «무엇을 검사하는가» 는 **실행되는 코드**여야 한다.
  const code = src.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  // `?? '상담'` 같은 «아무 말도 아닌 기본값» 이 남아 있으면 실패
  if (/tagline\s*\?\?\s*'/.test(code)) return false;
  // 분야가 비면 조기 return 하는 구조가 있는가
  return /if \(!mine\)[\s\S]{0,200}return '';/.test(code);
}

const isMain = process.argv[1]?.includes('check-talkdomain');
if (isMain) {
  console.log('\n🔭 자기 분야가 아닌 것을 풀이하는가\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(44)} ${note}`); };

  const talk = readFileSync(TALK, 'utf8');
  const build = readFileSync(BUILD, 'utf8');
  const roster = readFileSync(ROSTER, 'utf8');

  // D1 — 재료
  const hasOpt = /opts\?:\s*\{\s*ziwei\?/.test(build) && /opts\?\.ziwei\s*\?\?\s*true/.test(build);
  const passes = /buildTalkChartBlock\(chartRow, owned, \{ ziwei: ziweiOwner \}\)/.test(talk);
  say(hasOpt && passes, 'D1 자미 줄을 담당에게만 준다',
    hasOpt ? (passes ? '' : '옵션은 있는데 **호출부가 안 넘긴다** — 있으나 마나') : '옵션이 없습니다');

  // D2 — 경계에 필요한 값을 실제로 가져오는가
  const sels = [...talk.matchAll(/\.select\('id, kind, name,([^']*)'\)/g)].map((m) => m[1]);
  const allHave = sels.length >= 2 && sels.every((x) => x.includes('tagline') && x.includes('specialty'));
  say(allHave, 'D2 상담가 select 가 tagline·specialty 를 읽는다',
    allHave ? `${sels.length}곳 확인` : `★안 읽으면 경계가 «나는 상담을 본다» 로 죽는다 (${sels.length}곳 중 일부 누락)`);

  // D3 — 가짜 경계 금지
  say(rosterFallsBackToNothing(roster), 'D3 분야를 모르면 가짜 경계를 안 만든다',
    rosterFallsBackToNothing(roster) ? '' : "`?? '상담'` 같은 기본값이 남아 있습니다");

  // D4 — 지시
  const said = /자미두수.*담당만 본다/.test(talk) && /여기 대화에서는 그 문장보다 이 줄이 위다/.test(talk);
  say(said, 'D4 대화 지문이 «자미두수는 담당만» 을 못 박는다',
    said ? '' : '공용 지문의 «함께 읽어라» 를 덮는 문장이 없습니다');

  // D5 — ★데이터로 확인
  let token = '';
  try { token = readFileSync(`${homedir()}/.supabase/access-token`, 'utf8').trim(); } catch { /* 건너뜀 */ }
  const ref = (() => { try { return /SUPABASE_URL=https:\/\/([a-z0-9]+)\./.exec(readFileSync('.env', 'utf8'))?.[1] ?? ''; } catch { return ''; } })();
  if (token && ref) {
    const sql = `select id, name, tagline, routes, specialty from consultants where kind='live' and enabled`;
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });
    const rows = await res.json().catch(() => null);
    if (Array.isArray(rows)) {
      const owners = rows.filter((r: any) =>
        [...(r.routes ?? []), ...(r.specialty ?? [])].map(String).includes('ziwei'));
      const noTag = rows.filter((r: any) => !String(r.tagline ?? '').trim());
      say(owners.length === 1, 'D5 자미 담당이 정확히 한 사람이다',
        owners.length ? `${owners.map((o: any) => o.name).join(', ')}` : '★아무도 없다 — 자미 질문에 답할 사람이 없어진다');
      say(noTag.length === 0, 'D5b 모든 상담가가 자기 분야를 밝힌다',
        noTag.length ? `tagline 빈 사람: ${noTag.map((r: any) => r.name).join(', ')} — 이 사람은 경계가 없다` : `${rows.length}명 확인`);
    } else console.log('   ⏭  D5 건너뜀 — DB 조회 실패');
  } else console.log('   ⏭  D5 건너뜀 — 토큰/URL 없음');

  if (bad) { console.log(`\n❌ ${bad}건 — 하나만 남아도 **남의 분야를 자기가 풀이합니다**.\n`); process.exit(1); }
  console.log('\n✅ 재료·경계·지시 셋이 모두 담당을 지킵니다\n');
}
