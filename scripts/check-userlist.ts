// scripts/check-userlist.ts — ⚠️**「전체 유저목록」이 정말 전체인가**
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-28 실측으로 잡은 사고. Boss: *"어드민 웹에서 전체 유저목록도 볼수 있어야해"*
//
// ■ 무슨 일이 있었나
//   `admin_list_users()` 안에 `where not coalesce(u.is_anonymous, false)` 가 있었다.
//   그래서 **auth.users 162명 중 10명**만 목록에 떴다 — 익명(게스트) 152명이 통째로 빠졌다.
//   ★같은 화면 위쪽 「현황」 탭은 그동안 «전체 유저 **162**» 라고 적고 있었다.
//     두 숫자가 서로를 반증하는데도 아무도 못 봤다.
//
// ■ ★왜 눈으로는 안 잡히나 — 이 검사가 존재하는 진짜 이유
//   목록은 **채워져 있었다.** 오류도 빈 화면도 아니었다. 10줄이 멀쩡히 그려졌다.
//   «빠진 것» 은 화면에 자리를 차지하지 않는다 ⇒ **없는 것은 보이지 않는다.**
//   보이는 것과 대조할 **모집단**(auth.users)을 따로 세지 않으면 영원히 모른다.
//
// ■ 재는 것 (U1~U4 = 실제 호출 · U5 = 화면 · U6 = 두 화면의 모집단)
//   U1 ★관리자 자격으로 **정말 불러 본다** — `total_count` 가 `count(*) from auth.users` 와 같은가
//   U2 셈이 서로 모순되지 않는가 (`member + guest = total`)
//   U3 범위(all/member/guest)가 **서버에서** 갈리는가 · 갈린 뒤에도 회원·게스트 수는 그대로인가
//   U4 페이징(`p_limit`·`p_offset`)이 실제로 창을 옮기는가 — 총계는 창과 무관하게 유지되는가
//   U5 웹이 **서버 범위·서버 총계**를 쓰는가 (브라우저 필터링으로 되돌아가면 잡는다)
//   U6 「현황」의 전체 유저 수(profiles)와 목록의 모집단(auth.users)이 **같은 사람들**인가
//
// ⚠️환경변수가 없으면 **건너뛴다**(빨간불로 만들지 않는다) — CI 없이 도는 저장소다.
// ★음성 테스트: `npx tsx scripts/check-userlist.ts --selftest`
//   ([[harness-judge-expression-not-name]] — 하네스를 만들면 반드시 «틀린 것을 무는지» 부터 본다)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const WEB = `${ROOT}docs/admin/index.html`;

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

// ── 화면 판정(순수 함수 — 음성 테스트가 여기를 문다) ───────────────────────
/**
 * 관리자 웹이 **서버가 거른 목록**을 쓰는가.
 *
 * ★이름이 아니라 **호출의 모양**으로 판정한다. 「p_scope 라는 글자가 어딘가 있다」는
 *   주석에도 걸린다 — 반드시 `rpc('admin_list_users', { … p_scope … })` 형태를 본다.
 *
 * @param html `docs/admin/index.html` 전문
 * @returns ok=통과 · missing=어긋난 항목 설명
 */
export function judgeWeb(html: string): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  // ①범위를 서버로 넘기는가 — 호출 인자 객체 안에 p_scope 가 있어야 한다
  if (!/rpc\(\s*['"]admin_list_users['"]\s*,\s*\{[^}]*\bp_scope\s*:/s.test(html)) {
    missing.push('rpc(\'admin_list_users\', { … p_scope … }) 호출이 없다 — 범위를 서버가 안 가른다');
  }
  // ②무인자 호출이 남아 있으면 그 경로는 **필터도 페이징도 없이** 전건을 브라우저로 끌어온다
  if (/rpc\(\s*['"]admin_list_users['"]\s*\)/.test(html)) {
    missing.push('무인자 rpc(\'admin_list_users\') 호출이 남아 있다 — 300행 상한에 조용히 잘린다');
  }
  // ③화면에 적는 «전체 N명» 이 서버가 준 수인가 — 받은 배열 길이로 세면 페이징에서 거짓말이 된다
  if (!/\btotal_count\b/.test(html)) {
    missing.push('total_count 를 화면이 안 쓴다 — 받은 배열 길이로 세면 「더 보기」마다 숫자가 틀린다');
  }
  return { ok: missing.length === 0, missing };
}

// ── 음성 테스트 ────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const good = `const { data } = await sb.rpc('admin_list_users', { p_q: null, p_scope: s, p_limit: 200, p_offset: 0 });
    userTally = { total: rows[0].total_count };`;
  const cases: [string, string, boolean][] = [
    ['정상', good, true],
    ['무인자 호출로 되돌아감', `const { data } = await sb.rpc('admin_list_users');\n// total_count`, false],
    ['범위를 브라우저에서 거름', `sb.rpc('admin_list_users', { p_q: q })\n rows.filter(u=>u.email)\n total_count`, false],
    ['총계를 배열 길이로 셈', good.replace('total_count', 'length'), false],
    ['주석에만 p_scope 가 있음', `// p_scope 를 넘겨야 한다\nsb.rpc('admin_list_users');`, false],
  ];
  let bad = 0;
  for (const [name, src, expect] of cases) {
    const got = judgeWeb(src).ok;
    if (got !== expect) { bad++; console.log(`  ❌ 음성테스트 «${name}» — 기대 ${expect}, 실제 ${got}`); }
    else console.log(`  ✅ 음성테스트 «${name}»`);
  }
  console.log(bad ? `\n❌ 판정기가 ${bad}건을 못 뭅니다\n` : '\n✅ 판정기가 다섯 경우를 전부 가릅니다\n');
  process.exit(bad ? 1 : 0);
}

let fail = 0;
const say = (c: boolean, m: string, d = '') => {
  if (!c) fail++;
  console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(48)} ${d}`);
};

console.log('\n👥 check:userlist — 「전체 유저목록」이 정말 전체인가\n');

// ── U5 화면 (자격증명 없이도 볼 수 있다 — 먼저 본다) ───────────────────────
{
  const html = (() => { try { return readFileSync(WEB, 'utf8'); } catch { return null; } })();
  if (!html) say(false, 'U5 관리자 웹 파일', `${WEB} 없음`);
  else {
    const v = judgeWeb(html);
    say(v.ok, 'U5 웹이 서버 범위·서버 총계를 쓴다', v.ok ? '' : v.missing.join(' / '));
  }
}

// ── 자격증명 ───────────────────────────────────────────────────────────────
const url = envOf('SUPABASE_URL') ?? envOf('EXPO_PUBLIC_SUPABASE_URL');
const ref = envOf('SUPABASE_PROJECT_REF') ?? url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
let mgmt: string | null = null;
try { mgmt = readFileSync(`${homedir()}/.supabase/access-token`, 'utf8').trim(); } catch { /* 파일이 없으면 .env 로 */ }
mgmt = mgmt || envOf('SUPABASE_ACCESS_TOKEN');

if (!mgmt || !ref) {
  console.log('  ⏭  U1~U4·U6 건너뜀 — 관리 API 자격증명이 없습니다(~/.supabase/access-token)\n');
  process.exit(fail === 0 ? 0 : 1);
}

/**
 * 관리 API 로 SQL 을 돌린다.
 * ★여러 문장을 한 번에 보내면 **마지막 결과**만 온다 — 이 성질을 이용해
 *   `set_config('request.jwt.claims', …)` 로 **관리자인 척** 한 뒤 함수를 실제로 부른다.
 *   (`is_caller_admin()` 은 `auth.uid()` = 그 설정값을 읽는다.)
 * ⚠️타임아웃 필수 — fetch 는 기본 상한이 없다([[session-2026-07-31-handoff]]).
 */
async function sql<T = any>(query: string): Promise<T[] | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST', signal: ac.signal,
      headers: { Authorization: `Bearer ${mgmt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? (j as T[]) : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

/** 관리자 자격을 흉내 낸 뒤 뒤 문장을 돌린다. */
const asAdmin = (tail: string) => sql(
  `select set_config('request.jwt.claims',
     json_build_object('sub', (select id::text from profiles where is_admin order by created_at limit 1),
                       'role', 'authenticated')::text, false);
   ${tail}`);

// ── 모집단 ─────────────────────────────────────────────────────────────────
const pop = await sql<{ auth_total: number; profile_total: number; admins: number }>(
  `select (select count(*)::int from auth.users) as auth_total,
          (select count(*)::int from profiles)  as profile_total,
          (select count(*)::int from profiles where is_admin) as admins`);
if (!pop?.length) {
  console.log('  ⏭  U1~U4·U6 건너뜀 — 관리 API 조회 실패\n');
  process.exit(fail === 0 ? 0 : 1);
}
const { auth_total, profile_total, admins } = pop[0];
if (!admins) {
  console.log('  ⏭  U1~U4 건너뜀 — is_admin 계정이 없어 관리자 호출을 흉내 낼 수 없습니다');
} else {
  // ── U1·U2 전건 ──────────────────────────────────────────────────────────
  const all = await asAdmin(
    `select count(*)::int as got, max(total_count) as total, max(member_count) as member, max(guest_count) as guest
       from public.admin_list_users(null, 'all', 1000, 0);`);
  const a = all?.[0];
  if (!a) say(false, 'U1 관리자 자격으로 목록 호출', '호출 실패 — 함수 시그니처를 확인하세요(마이그레이션 미적용?)');
  else {
    say(a.total === auth_total, 'U1 ★«전체» 가 정말 전건인가',
      a.total === auth_total ? `${a.total}명 = auth.users ${auth_total}명`
        : `목록 total_count ${a.total} ≠ auth.users ${auth_total} — **${auth_total - a.total}명이 조용히 빠진다**`);
    say(a.member + a.guest === a.total, 'U2 셈이 서로 모순되지 않는다',
      `회원 ${a.member} + 게스트 ${a.guest} ${a.member + a.guest === a.total ? '=' : '≠'} 전체 ${a.total}`);

    // ── U3 범위 ───────────────────────────────────────────────────────────
    const gu = (await asAdmin(
      `select count(*)::int as got, max(total_count) as total, max(member_count) as member, max(guest_count) as guest,
              bool_and(is_guest) as all_guest from public.admin_list_users(null, 'guest', 1000, 0);`))?.[0];
    const me = (await asAdmin(
      `select count(*)::int as got, max(total_count) as total, bool_or(is_guest) as any_guest
         from public.admin_list_users(null, 'member', 1000, 0);`))?.[0];
    const scopeOk = !!gu && !!me
      && gu.total === a.guest && (gu.got === 0 || gu.all_guest === true)
      && me.total === a.member && me.any_guest !== true
      && gu.member === a.member && gu.guest === a.guest;   // 걸러도 칩 숫자는 살아 있어야 한다
    say(scopeOk, 'U3 범위가 서버에서 갈린다',
      scopeOk ? `게스트 ${gu!.total} · 회원 ${me!.total} (칩 숫자 유지)`
        : `게스트 ${gu?.total}/${a.guest} · 회원 ${me?.total}/${a.member} · 섞임 ${gu?.all_guest === false || me?.any_guest === true}`);

    // ── U4 페이징 ─────────────────────────────────────────────────────────
    const p0 = (await asAdmin(`select id::text as id, total_count from public.admin_list_users(null,'all',1,0);`))?.[0];
    const p1 = (await asAdmin(`select id::text as id, total_count from public.admin_list_users(null,'all',1,1);`))?.[0];
    const pageOk = !!p0 && !!p1 && p0.id !== p1.id && p0.total_count === auth_total && p1.total_count === auth_total;
    say(pageOk, 'U4 페이징이 창을 옮긴다 · 총계는 그대로',
      pageOk ? `창 2개가 서로 다른 행 · 총계 ${p0!.total_count}` : `offset 0/1 이 같은 행이거나 총계가 흔들린다`);
  }
}

// ── U6 두 화면의 모집단 ────────────────────────────────────────────────────
say(profile_total === auth_total, 'U6 「현황」과 목록이 같은 사람들을 센다',
  profile_total === auth_total ? `${auth_total}명`
    : `현황(profiles) ${profile_total} ≠ 목록(auth.users) ${auth_total} — 한 화면 안에서 두 숫자가 어긋난다`);

console.log(fail === 0 ? '\n✅ 「전체 유저목록」이 전건입니다\n'
  : `\n❌ ${fail}건 — 목록이 조용히 일부만 보여 줍니다\n`);
process.exit(fail === 0 ? 0 : 1);
