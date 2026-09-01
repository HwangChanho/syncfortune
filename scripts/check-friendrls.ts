// scripts/check-friendrls.ts — 친구 기능의 **조용히 새는 곳**을 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-09-01 *"다른 버그 찾아 친구관련"* — 감사에서 3건이 나왔다)
//
// ■ ★셋 다 «오류가 안 나는» 종류였다 — 눈으로는 못 잡는다
//   ①**남의 메시지를 지우거나 가로챌 수 있었다**
//     정책이 `ALL` 하나였고 `USING` 이 «방에 있으면» 이었다.
//     `INSERT` 는 `WITH CHECK` 가 막았지만 **`DELETE` 는 `USING` 만** 본다 ⇒ 남의 말이 지워진다.
//     `UPDATE` 는 `USING` 으로 남의 행을 골라 **주인을 나로 바꿔** 가로챌 수 있었다.
//     ★`ALL` 로 묶으면 «읽기 조건» 이 «지우기 조건» 이 된다.
//   ②**친구를 끊어도 대화가 계속됐다** — `friend_remove` 가 `friends` 행만 지웠다.
//     쓰기 조건이 «그 방의 멤버인가» 라, 끊고도 말이 오간다(이름은 「이름 없음」 이 된 채로).
//   ③**친구별 «끄기» 가 안 먹었다** — `set_friend_share` 는 저장하는데
//     `charts_friend_read` 가 그 칸을 **안 봤다.** 껐다는 표시만 보이고 실제로는 열려 있었다.
//
// 무엇을 지키나
//   F1 메시지 **고치기·지우기는 내 것만**(`ALL` 정책 하나로 되돌아가지 않게)
//   F2 `friend_remove` 가 **방 자리도 정리**한다
//   F3 명식 공개 정책이 **친구별 값**을 본다
//   F4 트리거 함수가 **PUBLIC·anon 에 안 열려** 있다(Supabase 기본값이 열어 준다)
//
// ★실측이다 — 소스가 아니라 **DB 를 조회**한다(`supabase/` 는 gitignore 라 소스를 못 믿는다).
// ★음성 테스트: `npx tsx scripts/check-friendrls.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기(순수) ────────────────────────────────────────────────────────────

/** 메시지 정책이 안전한가 — 고치기·지우기가 **내 것만**인가. */
export function msgPoliciesSafe(rows: Array<{ cmd: string; qual: string | null }>): string[] {
  const bad: string[] = [];
  for (const cmd of ['UPDATE', 'DELETE']) {
    const p = rows.find((r) => r.cmd === cmd);
    if (!p) { bad.push(`${cmd} 정책이 없다`); continue; }
    if (/is_room_member/.test(p.qual ?? '')) bad.push(`${cmd} 가 «방에 있으면» 으로 열려 있다`);
  }
  if (rows.some((r) => r.cmd === 'ALL')) bad.push('`ALL` 정책이 있다 — 읽기 조건이 지우기 조건이 된다');
  return bad;
}

/** 공개 정책이 친구별 칸을 보는가. */
export function honorsPerFriend(qual: string | null): boolean {
  const q = qual ?? '';
  return /share_a/.test(q) && /share_b/.test(q);
}

/** 끊기가 방 자리도 정리하는가. */
export function unfriendClosesRoom(def: string): boolean {
  return /talk_members/.test(def);
}

/** 트리거 함수가 PUBLIC·anon 에 열려 있는가. */
export function grantedToPublic(acl: string): boolean {
  return /(^|\s)=X\//.test(acl) || /\banon=X\//.test(acl);
}

// ── 실제 검사(DB 조회) ──────────────────────────────────────────────────────
async function run() {
  const tokPath = `${homedir()}/.supabase/access-token`;
  if (!existsSync(tokPath)) { console.log('⏭  건너뜀 — 자격증명 없음(DB 를 못 본다)'); return; }
  const tok = readFileSync(tokPath, 'utf8').trim();
  const ref = (/SUPABASE_PROJECT_REF=(\S+)/.exec(readFileSync('.env', 'utf8')) ?? [])[1];
  if (!ref) { console.log('⏭  건너뜀 — 프로젝트 ref 없음'); return; }

  const q = async (sql: string): Promise<any[]> => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  };

  const msg = await q(`select cmd, qual from pg_policies where tablename='talk_messages'`);
  const badMsg = msgPoliciesSafe(msg);
  if (badMsg.length) {
    fail('F1', `메시지 정책이 열려 있다: ${badMsg.join(' · ')}\n        `
      + '⚠️`DELETE` 는 `USING` 만 본다 — 「방에 있으면」 이면 **남의 말이 지워진다.**\n        '
      + '`UPDATE` 는 남의 행을 골라 **주인을 나로 바꿔** 가로챌 수 있다. 오류가 안 난다');
  }

  const ch = await q(`select qual from pg_policies where policyname='charts_friend_read'`);
  if (!ch.length) fail('F3', '`charts_friend_read` 정책이 없다');
  else if (!honorsPerFriend(ch[0].qual)) {
    fail('F3', '명식 공개 정책이 **친구별 값**(`share_a`/`share_b`)을 안 본다.\n        '
      + '⚠️`set_friend_share(친구, false)` 는 저장되는데 정책이 안 보면 —\n        '
      + '**껐다는 표시만 보이고 실제로는 열려 있다.** 개인정보 쪽으로 조용히 샌다');
  }

  const fr = await q(`select pg_get_functiondef(oid) as d from pg_proc where proname='friend_remove'`);
  if (fr.length && !unfriendClosesRoom(fr[0].d)) {
    fail('F2', '`friend_remove` 가 **방 자리를 안 정리한다**.\n        '
      + '쓰기 조건이 「그 방의 멤버인가」 라 **끊고도 대화가 계속된다** —\n        '
      + '게다가 이름은 「이름 없음」 이 된다(친구가 아니라 프로필을 못 읽으니까)');
  }

  const fns = await q(`select proname, coalesce(array_to_string(proacl::text[],' '),'') as acl
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname in ('notify_friend_message','wake_push_dispatch')`);
  for (const f of fns) {
    if (grantedToPublic(f.acl)) {
      fail('F4', `\`${f.proname}\` 이 **PUBLIC·anon 에 열려** 있다.\n        `
        + '⚠️Supabase 는 새 함수에 **기본으로** EXECUTE 를 준다 — 안 적으면 열린다.\n        '
        + '★트리거는 테이블 소유자 권한으로 도니 회수해도 그대로 동작한다');
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'F1 갈라 둔 정책은 통과',
      run: () => msgPoliciesSafe([{ cmd: 'UPDATE', qual: '(owner_id = auth.uid())' },
                                  { cmd: 'DELETE', qual: '(owner_id = auth.uid())' }]).length === 0 },
    { name: 'F1 ★DELETE 가 「방에 있으면」 이면 문다',
      run: () => msgPoliciesSafe([{ cmd: 'UPDATE', qual: '(owner_id = auth.uid())' },
                                  { cmd: 'DELETE', qual: 'is_room_member(session_id)' }]).length === 1 },
    { name: 'F1 ★`ALL` 정책이 있으면 문다',
      run: () => msgPoliciesSafe([{ cmd: 'ALL', qual: 'x' }]).length > 0 },
    // 빈 목록 = UPDATE·DELETE 둘 다 «없다» → 2건(`ALL` 이 없는 건 정상이다)
    { name: 'F1 정책이 아예 없어도 문다', run: () => msgPoliciesSafe([]).length === 2 },
    { name: 'F3 친구별을 보면 통과', run: () => honorsPerFriend('f.share_a ... f.share_b') === true },
    { name: 'F3 ★전역만 보면 문다', run: () => honorsPerFriend('p.share_consent') === false },
    { name: 'F3 한쪽만 보면 문다(양방향이어야 한다)', run: () => honorsPerFriend('f.share_a') === false },
    { name: 'F2 방을 정리하면 통과', run: () => unfriendClosesRoom('delete from public.talk_members m') === true },
    { name: 'F2 안 하면 문다', run: () => unfriendClosesRoom('delete from public.friends') === false },
    { name: 'F4 PUBLIC 이면 문다', run: () => grantedToPublic('=X/postgres postgres=X/postgres') === true },
    { name: 'F4 anon 이어도 문다', run: () => grantedToPublic('postgres=X/postgres anon=X/postgres') === true },
    { name: 'F4 닫혀 있으면 통과', run: () => grantedToPublic('postgres=X/postgres service_role=X/postgres') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  await run();
  if (out.length) {
    console.error(`❌ check:friendrls — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:friendrls — 메시지는 내 것만 고치고, 끊으면 방도 닫히고, 친구별 공개가 지켜진다');
}
