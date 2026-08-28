// scripts/check-talkpush.ts — ⚠️**답장 알림·배지가 조용히 끊기지 않는가**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-28: *"ai 가 답장하는것도 내가 해당 화면에 있는 상태가 아니면 알림이 와야하고
//   앱에서는 뱃지 카운트로 … 몇건의 텍스트 알림이 쌓여있는지 떠야해. 카운트 기준은 텍스트 갯수고
//   그부분을 확인하면 카운트는 해당 만큼 줄어들고 푸시알림은 탭하면 해당 대화로 넘어가야하고"*
//
// ■ ★왜 기계가 봐야 하나 — 이 기능은 **고장 나도 화면이 멀쩡하다**
//   푸시가 안 가도, 배지가 안 줄어도, 앱은 오류 하나 없이 잘 돈다.
//   («조용한 실패» 의 전형 — [[web-silent-failures]] 와 같은 종류다.)
//   게다가 고리가 **네 곳**(서버 발송 · 앱 표시판정 · 배지 출처 · 화면 이탈)이라
//   하나만 빠져도 증상이 «가끔 알림이 안 와요» 로 나온다 — 사람이 재현을 못 한다.
//
// ■ 재는 것
//   P1 Edge 가 답을 저장한 뒤 **푸시를 보낸다** · route 가 `/talk?c=…` 형태다
//   P2 앱이 **보고 있는 방일 때만** 안 띄운다(`talkConsultant` 비교) · 배지는 **끄지 않는다**
//   P3 배지 숫자의 **출처가 하나**다(앱·Edge 둘 다 `talk_unread_total`) — 각자 세면 갈린다
//   P4 ★실측 — `talk_unread_total` 이 목록 배지(`talk_session_list.unread`) 합과 **같은 수**를 준다
//   P5 화면을 떠나면 «보고 있는 방» 을 **지운다**(안 지우면 다른 탭에서 알림이 사라진다)
//
// ⚠️자격증명이 없으면 P4 만 건너뛴다(빨간불로 만들지 않는다).
// ★음성 테스트: `npx tsx scripts/check-talkpush.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const EDGE = `${ROOT}supabase/functions/talk/index.ts`;
const NOTIF = `${ROOT}app/src/lib/backend/notifications.ts`;
const SCREEN = `${ROOT}app/src/app/(app)/talk.tsx`;

/** `.env` 에서 키 하나. ⚠️값에 `=` 가 들어갈 수 있어 **첫 `=` 에서만** 자른다. */
function envOf(name: string): string | null {
  try {
    for (const line of readFileSync(`${ROOT}.env`, 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0 && line.slice(0, i).trim() === name) return line.slice(i + 1).trim();
    }
  } catch { /* 없으면 없는 것 */ }
  return null;
}

// ── 판정기(순수 함수 — 음성 테스트가 여기를 문다) ──────────────────────────
/**
 * Edge 가 답장 푸시를 **실제로 보내는가**.
 * ★«push 라는 글자가 있다» 로 보지 않는다 — Expo 발송 엔드포인트 호출과
 *   그 본문의 `route`·`talkConsultant` 를 **함께** 본다(하나만 있으면 고리가 끊긴다).
 */
export function judgeEdge(src: string): string[] {
  const bad: string[] = [];
  if (!/exp\.host\/--\/api\/v2\/push\/send/.test(src)) bad.push('Expo 발송 호출이 없다 — 답장 푸시를 아무도 안 보낸다');
  // route 는 화면이 `c` 파라미터로 방을 연다 → 이 형태를 벗어나면 탭해도 목록만 열린다
  // ★2026-08-28 판정을 넓혔다 — 종전엔 `route:` **바로 뒤**의 템플릿만 봐서,
  //   같은 값을 변수(`const route = ...`)로 뽑자 **멀쩡한 코드에서 빨간불**이 났다.
  //   ⇒ ①그 주소를 만드는 곳이 있고 ②그 값이 `data` 로 실리는가 를 따로 본다(자리 아닌 «뜻»).
  if (!/`\/talk\?c=\$\{/.test(src)) bad.push('`/talk?c=…` 를 만드는 곳이 없다 — 탭해도 그 대화로 안 간다');
  if (!/data:\s*\{[\s\S]{0,240}?\broute\b/.test(src)) bad.push('그 주소가 푸시 data.route 로 안 실린다 — 앱이 이동할 곳을 모른다');
  if (!/talkConsultant:/.test(src)) bad.push('data.talkConsultant 가 없다 — 앱이 «보고 있는 방» 을 견줄 수 없다');
  if (!/rpc\(\s*['"]talk_unread_total['"]/.test(src)) bad.push('배지 수를 talk_unread_total 로 안 받는다 — 서버가 따로 세면 앱과 갈린다');
  return bad;
}

/** 앱이 **보고 있는 방일 때만** 알림을 접는가 · 배지를 켜 두는가. */
export function judgeNotif(src: string): string[] {
  const bad: string[] = [];
  const m = /handleNotification[\s\S]{0,900}?talkConsultant[\s\S]{0,900}?shouldSetBadge:\s*(true|false)/.exec(src);
  if (!m) bad.push('handleNotification 이 talkConsultant 를 안 본다 — 늘 띄우거나 늘 감춘다');
  else if (m[1] !== 'true') bad.push('shouldSetBadge 가 false 다 — 안 읽은 수가 아이콘에 안 쌓인다');
  if (!/rpc\(\s*['"]talk_unread_total['"]/.test(src)) bad.push('앱이 talk_unread_total 을 안 쓴다 — 배지 숫자를 앱이 따로 세면 갈린다');
  if (!/setBadgeCountAsync/.test(src)) bad.push('setBadgeCountAsync 호출이 없다 — 아이콘 배지가 안 바뀐다');
  return bad;
}

/** 화면이 떠날 때 «보고 있는 방» 을 지우는가(안 지우면 다른 탭에서 알림이 사라진다). */
export function judgeScreen(src: string): string[] {
  const bad: string[] = [];
  if (!/setOpenTalk\(/.test(src)) bad.push('setOpenTalk 을 안 부른다 — 서버는 늘 보내는데 앱이 늘 띄운다');
  // 정리(cleanup)에서 null 로 지우는가 — `return () => setOpenTalk(null)` 꼴
  if (!/return\s*\(\)\s*=>\s*setOpenTalk\(null\)/.test(src)) {
    bad.push('화면 이탈 시 setOpenTalk(null) 로 안 지운다 — 다른 탭에 있어도 그 방 알림이 조용히 사라진다');
  }
  if (!/refreshTalkBadge\(/.test(src)) bad.push('읽은 뒤 refreshTalkBadge 를 안 부른다 — 확인해도 숫자가 안 줄어든다');
  return bad;
}

// ── 음성 테스트 ────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  // ★변수로 뽑은 형태(실제 코드 모양)로 둔다 — 「route: 바로 뒤」만 보던 판정이 여기서 깨졌었다
  const okEdge = 'fetch("https://exp.host/--/api/v2/push/send"…) const route = `/talk?c=${x}`;'
    + ' data: { route, talkConsultant: c.id } rpc(\'talk_unread_total\'';
  const okNotif = 'handleNotification: async (n) => { const d=n.request.content.data; const same = d.talkConsultant === open;'
    + ' return { shouldShowAlert: !same, shouldSetBadge: true }; }  rpc(\'talk_unread_total\')  setBadgeCountAsync(n)';
  const okScreen = 'setOpenTalk(cur?.id ?? null); return () => setOpenTalk(null); void refreshTalkBadge();';
  const cases: [string, () => string[], boolean][] = [
    ['Edge 정상', () => judgeEdge(okEdge), true],
    ['Edge 발송 삭제', () => judgeEdge(okEdge.replace('https://exp.host/--/api/v2/push/send', 'x')), false],
    ['Edge route 형식 붕괴', () => judgeEdge(okEdge.replace('`/talk?c=${x}`', '"/talk"')), false],
    ['route 를 data 에 안 실음', () => judgeEdge(okEdge.replace('data: { route,', 'data: { zzz,')), false],
    ['Edge 가 배지를 자체 계산', () => judgeEdge(okEdge.replace("rpc('talk_unread_total'", 'count(')), false],
    ['앱 정상', () => judgeNotif(okNotif), true],
    ['배지 꺼짐', () => judgeNotif(okNotif.replace('shouldSetBadge: true', 'shouldSetBadge: false')), false],
    ['방 비교 삭제(늘 띄움)', () => judgeNotif(okNotif.replace(/talkConsultant/g, 'zzz')), false],
    ['화면 정상', () => judgeScreen(okScreen), true],
    ['이탈 시 안 지움', () => judgeScreen(okScreen.replace('return () => setOpenTalk(null);', '')), false],
    ['읽어도 배지 그대로', () => judgeScreen(okScreen.replace('void refreshTalkBadge();', '')), false],
  ];
  let bad = 0;
  for (const [name, run, expect] of cases) {
    const got = run().length === 0;
    if (got !== expect) { bad++; console.log(`  ❌ 음성테스트 «${name}» — 기대 ${expect}, 실제 ${got}`); }
    else console.log(`  ✅ 음성테스트 «${name}»`);
  }
  console.log(bad ? `\n❌ 판정기가 ${bad}건을 못 뭅니다\n` : '\n✅ 판정기가 열 경우를 전부 가릅니다\n');
  process.exit(bad ? 1 : 0);
}

let fail = 0;
const say = (c: boolean, m: string, d = '') => {
  if (!c) fail++;
  console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(46)} ${d}`);
};
const read = (f: string) => { try { return readFileSync(f, 'utf8'); } catch { return null; } };

console.log('\n🔔 check:talkpush — 답장 알림·배지가 끊기지 않는가\n');

for (const [label, file, judge] of [
  ['P1 Edge 가 답장 푸시를 보낸다', EDGE, judgeEdge],
  ['P2 앱이 보고 있는 방만 접는다', NOTIF, judgeNotif],
  ['P5 떠나면 «보는 방» 을 지운다', SCREEN, judgeScreen],
] as [string, string, (s: string) => string[]][]) {
  const src = read(file);
  if (!src) { say(false, label, `${file} 없음`); continue; }
  const bad = judge(src);
  say(bad.length === 0, label, bad.join(' / '));
}

// ── P3 배지 숫자의 출처가 하나인가 ─────────────────────────────────────────
{
  const e = read(EDGE) ?? '', n = read(NOTIF) ?? '';
  const both = /talk_unread_total/.test(e) && /talk_unread_total/.test(n);
  say(both, 'P3 배지 숫자의 출처가 하나', both ? 'Edge·앱 모두 talk_unread_total' : '한쪽이 따로 센다 — 반드시 갈린다');
}

// ── P4 ★실측 — 같은 수를 주는가 ────────────────────────────────────────────
const ref = envOf('SUPABASE_PROJECT_REF');
let mgmt: string | null = null;
try { mgmt = readFileSync(`${homedir()}/.supabase/access-token`, 'utf8').trim(); } catch { /* .env 로 */ }
mgmt = mgmt || envOf('SUPABASE_ACCESS_TOKEN');

if (!mgmt || !ref) {
  console.log('  ⏭  P4 건너뜀 — 관리 API 자격증명이 없습니다(~/.supabase/access-token)');
} else {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);   // ⚠️상한 필수 — fetch 는 기본값이 없다
  let rows: any[] | null = null;
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST', signal: ac.signal,
      headers: { Authorization: `Bearer ${mgmt}`, 'Content-Type': 'application/json' },
      // 세션이 있는 회원 전원에 대해 «함수가 준 수» 와 «목록 배지 합» 을 맞대 본다
      body: JSON.stringify({
        query: `select count(*)::int as owners,
                       count(*) filter (where fn <> lst)::int as mismatched,
                       coalesce(sum(fn),0)::int as fn_total, coalesce(sum(lst),0)::int as list_total
                  from (select s.owner_id,
                               public.talk_unread_total(s.owner_id) as fn,
                               sum(v.unread)::int                    as lst
                          from talk_sessions s
                          join talk_session_list v on v.id = s.id
                         group by s.owner_id) t`,
      }),
    });
    rows = await r.json().catch(() => null);
  } catch { rows = null; } finally { clearTimeout(timer); }

  const a = Array.isArray(rows) ? rows[0] : null;
  if (!a) console.log('  ⏭  P4 건너뜀 — 조회 실패(마이그레이션 미적용일 수 있습니다)');
  else {
    say(a.mismatched === 0, 'P4 ★함수와 목록 배지가 같은 수',
      a.mismatched === 0 ? `회원 ${a.owners}명 · 합계 ${a.fn_total}`
        : `${a.mismatched}명이 어긋난다 (함수 ${a.fn_total} ≠ 목록 ${a.list_total})`);
  }
}

console.log(fail === 0 ? '\n✅ 답장 알림·배지 고리가 이어져 있습니다\n'
  : `\n❌ ${fail}건 — 알림·배지가 조용히 끊깁니다\n`);
process.exit(fail === 0 ? 0 : 1);
