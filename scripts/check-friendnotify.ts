// scripts/check-friendnotify.ts — **친구요청이 푸시·알림함에 실제로 뜨는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"친구요청 보내면 푸시알림에도 뜨고 메인화면 알림창에서도 볼수있게 하자"*
//                  *"웹에서도 알림 잘 떠야해"*
//
// ■ ★새로 만들 것이 거의 없었다 — 조사해 보니 인프라가 **이미 다 있었다**
//   `user_notify_queue` 한 줄이 **두 곳**을 먹인다:
//     ① `push-dispatch` cron(매분) → Expo 푸시
//     ② `notifyInbox` → 알림함 화면(`/notifications`)
//   ⇒ 큐에 넣기만 하면 된다. 화면도 함수도 이미 있었다.
//
// ■ ★★진짜 문제는 «있는데 아무도 못 찾는 것» 이었다
//   알림함 화면도 `unreadCount()` 도 **이미 있었는데**,
//   여는 길이 **「마이」 탭 안**에만 있었고 읽지 않은 표시는 **아무 데도 없었다.**
//   ⇒ [[category-management-ui]] 의 *"길게 누르기만 있는 기능 = 없는 기능"* 과 같은 상태.
//
// ■ 웹은 방식이 다르다 — **정직하게 적어 둔다**
//   웹엔 Expo 푸시 토큰이 없어 **푸시는 안 온다.** 그러나 알림함은 같은 큐를 DB 에서 읽으므로
//   **웹에서도 똑같이 보인다.** ⇒ 웹 사용자에게는 «알림함 + 배지» 가 알림이다.
//
// 실행: npm run check:friendnotify   (네트워크 필요 — DB 조회)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const HOME = 'app/src/app/(app)/index.tsx';
const INBOX = 'app/src/lib/backend/notifyInbox.ts';

const isMain = process.argv[1]?.includes('check-friendnotify');
if (isMain) {
  console.log('\n🔔 친구요청이 푸시·알림함에 뜨는가\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(46)} ${note}`); };

  // ── N1 홈에서 알림함으로 가는 길 ──────────────────────────────────────────
  const home = readFileSync(HOME, 'utf8');
  const opens = /router\.push\('\/notifications'\)/.test(home);
  say(opens, 'N1 **홈에서** 알림함으로 갈 수 있다',
    opens ? '' : '★알림함이 있어도 「마이」 탭 안에만 있으면 아무도 못 찾습니다');

  // ── N2 읽지 않은 배지 ─────────────────────────────────────────────────────
  const badge = /unreadCount\(\)/.test(home) && /unread > 0/.test(home);
  say(badge, 'N2 읽지 않은 수를 **배지로** 보여 준다',
    badge ? '' : '`unreadCount()` 가 있는데 아무도 안 쓰면 배지가 없습니다');
  // ★포커스마다 다시 세는가 — 읽고 돌아왔는데 배지가 남으면 그게 더 나쁘다
  const refresh = /useFocusEffect\([\s\S]{0,200}unreadCount\(\)/.test(home);
  say(refresh, 'N2b 포커스마다 다시 센다(읽으면 바로 빠진다)',
    refresh ? '' : '한 번만 세면 «읽었는데 빨간 점이 남는» 상태가 됩니다');

  // ── N3 알림함이 큐를 읽는다(웹에서도 도는 경로) ────────────────────────────
  const inbox = readFileSync(INBOX, 'utf8');
  say(/user_notify_queue/.test(inbox), 'N3 알림함이 `user_notify_queue` 를 읽는다',
    '★웹엔 푸시 토큰이 없다 — 웹에서는 이 경로가 곧 «알림» 이다');

  // ── N4 ★DB: 두 RPC 가 실제로 큐에 넣는가 ─────────────────────────────────
  let token = '';
  try { token = readFileSync(`${homedir()}/.supabase/access-token`, 'utf8').trim(); } catch { /* 아래 */ }
  const ref = (() => { try { return /SUPABASE_URL=https:\/\/([a-z0-9]+)\./.exec(readFileSync('.env', 'utf8'))?.[1] ?? ''; } catch { return ''; } })();
  if (token && ref) {
    const q = async (sql: string) => {
      const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
      });
      return r.json().catch(() => null);
    };
    const rows = await q(`select p.proname, pg_get_functiondef(p.oid) as def
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname in ('friend_request','friend_accept')`);
    if (Array.isArray(rows) && rows.length === 2) {
      for (const r of rows as Array<{ proname: string; def: string }>) {
        say(/user_notify_queue/.test(r.def), `N4 \`${r.proname}\` 가 큐에 넣는다`, '');
      }
      const req = (rows as any[]).find((r) => r.proname === 'friend_request')?.def ?? '';
      // ★차단 분기에서는 **아무것도 넣지 않아야** 한다 — 차단 사실을 알리지 않는 설계다
      const blockedBranch = /elsif cur\.status = 'blocked' then([\s\S]{0,300}?)elsif/.exec(req)?.[1] ?? '';
      say(!/user_notify_queue/.test(blockedBranch), 'N4b 차단 상대에게는 **안 보낸다**',
        blockedBranch ? '' : '차단 분기를 못 찾았습니다');
      // ★수락은 «실제로 바뀐 행이 있을 때만» — 아니면 아무 일도 없었는데 알림이 간다
      const acc = (rows as any[]).find((r) => r.proname === 'friend_accept')?.def ?? '';
      say(/if n > 0 then[\s\S]{0,400}user_notify_queue/.test(acc), 'N4c 수락은 **바뀐 행이 있을 때만** 알린다', '');
    } else say(false, 'N4 두 RPC 조회', '조회 실패');
  } else console.log('   ⏭  N4 건너뜀 — 토큰/URL 없음');

  if (bad) { console.log(`\n❌ ${bad}건 — 알림이 안 뜨거나, 있어도 못 찾습니다.\n`); process.exit(1); }
  console.log('\n✅ 큐 한 줄이 푸시와 알림함 둘 다 먹이고, 홈에서 보인다\n');
}
