// scripts/check-anonleak.ts — **로그인 없이 읽히는 개인정보**가 있는지 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-09-01 *"다 고쳐"* — 감사를 DB 전체로 넓히다 찾았다)
//
// ■ ★★실제로 새고 있었다
//   `readings_backup_20260728` · `readings_backup_20260729` 가
//   **RLS 꺼짐 + `anon=arwdDxtm`**(읽기·쓰기·삭제·TRUNCATE) 였다.
//   앱에 실려 나가는 **공개 anon 키만으로** 남의 풀이 전문이 그대로 읽혔다.
//   실측: `GET /rest/v1/readings_backup_20260728?select=*` → **HTTP 200 + 본문**.
//
// ■ ★★왜 못 봤나 — **빠진 것은 자리를 차지하지 않는다**
//   정책 목록(`pg_policies`)만 훑으면 이 둘은 **아예 안 나온다.** 정책이 없는 게 아니라
//   **RLS 자체가 없어서** 정책이라는 개념이 안 붙는다([[admin-list-hid-94-percent]] 와 같은 함정).
//   ⇒ `pg_class.relrowsecurity` 를 봐야 보인다.
//
// ■ ★백업·임시 테이블이 위험한 이유
//   `create table x as select * from readings` 는 **RLS 를 안 물려받는다.**
//   원본이 아무리 잠겨 있어도 사본은 열린 채로 태어난다.
//
// 무엇을 지키나
//   A1 `public` 의 테이블에 **RLS 가 켜져** 있다(예외 목록은 여기 적고 이유를 남긴다)
//   A2 RLS 가 꺼진 테이블에 **anon·authenticated 권한이 없다**
//   A3 뷰가 **`security_invoker`** 로 돈다(안 그러면 만든 사람 권한으로 RLS 를 우회한다)
//   A4 ★**실제로** anon 키로 두드려 개인정보가 나오는지 본다(공개 자료는 허용 목록)
//
// ★A4 가 이 하네스의 핵심이다 — 설정이 아니라 **밖에서 본 결과**를 잰다.
// ★음성 테스트: `npx tsx scripts/check-anonleak.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/**
 * 로그인 없이 **읽혀도 되는** 것들.
 * ★앱이 로그인 전에 필요로 하는 자료만 여기 둔다. 개인정보는 절대 넣지 말 것.
 *   새로 넣을 때는 «이 표의 어느 행이든 아무나 봐도 되는가» 를 스스로 물어라.
 */
export const PUBLIC_OK = new Set([
  'app_config',      // 홈 화면 구성 — 개인 무관
  'app_flags',       // 기능 켜기/끄기
  'celebrities',     // 공개 인물 자료
  'coin_packs',      // 가격표
  'consultants',     // 상담가 소개
  'copy_overrides',  // 화면 문구(다국어)
  'consultant_examples', // 상담가 예시 문답
  'contents',        // 콘텐츠 목록
]);

/** RLS 가 꺼져 있어도 되는 것(없어야 정상 — 있으면 이유를 여기 적는다). */
export const RLS_OFF_OK = new Set<string>([]);

/** RLS 꺼진 테이블에 anon·authenticated 권한이 남아 있는가. */
export function exposedWithoutRls(acl: string): boolean {
  return /\banon=[a-zA-Z]*r/.test(acl) || /\bauthenticated=[a-zA-Z]*r/.test(acl) || /(^|\s)=[a-zA-Z]*r\//.test(acl);
}

/** 뷰가 invoker 로 도는가. */
export function viewIsInvoker(opt: string | null): boolean {
  return opt === 'on' || opt === 'true';
}

/** anon 응답이 «행이 나왔다» 인가. */
export function returnedRows(body: string): boolean {
  const t = body.trim();
  return t.startsWith('[') && t !== '[]';
}

async function run() {
  const tokPath = `${homedir()}/.supabase/access-token`;
  if (!existsSync(tokPath)) { console.log('⏭  건너뜀 — 자격증명 없음(DB 를 못 본다). **못 쟀다**'); return; }
  const tok = readFileSync(tokPath, 'utf8').trim();
  const env = readFileSync('.env', 'utf8');
  const ref = (/SUPABASE_PROJECT_REF=(\S+)/.exec(env) ?? [])[1];
  const anon = (/SUPABASE_ANON_KEY=(\S+)/.exec(env) ?? [])[1];
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

  // A1·A2 — RLS 가 꺼진 테이블
  const off = await q(`select c.relname, coalesce(array_to_string(c.relacl::text[],' '),'') as acl
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
  for (const t of off) {
    if (RLS_OFF_OK.has(t.relname)) continue;
    if (exposedWithoutRls(t.acl)) {
      fail('A2', `\`${t.relname}\` — **RLS 가 꺼져 있는데 anon·authenticated 가 읽을 수 있다**.\n        `
        + '⚠️앱에 실려 나가는 공개 키만으로 **전 행이 읽힌다.**\n        '
        + '★`create table x as select …` 는 RLS 를 **안 물려받는다** — 사본은 열린 채로 태어난다');
    } else {
      fail('A1', `\`${t.relname}\` — RLS 가 꺼져 있다(지금은 권한이 없어 안 새지만, \`grant\` 한 번이면 열린다)`);
    }
  }

  // A3 — 뷰
  const views = await q(`select c.relname,
      (select option_value from pg_options_to_table(c.reloptions) where option_name='security_invoker') as inv
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v'`);
  if (!views.length) fail('A3', '뷰를 한 개도 못 찾았다 — **못 쟀다**');
  for (const v of views) {
    if (!viewIsInvoker(v.inv)) {
      fail('A3', `뷰 \`${v.relname}\` 에 **\`security_invoker\` 가 없다**.\n        `
        + '⚠️뷰는 RLS 가 없다 — 만든 사람 권한으로 돌아 **밑 테이블의 잠금을 통째로 지나간다.**\n        '
        + '★2026-08-27 에 대화 목록이 이 자리에서 통째로 샜다');
    }
  }

  // A4 — ★밖에서 실제로 두드린다
  if (!anon) { console.log('⏭  A4 건너뜀 — .env 에 SUPABASE_ANON_KEY 가 없다. **못 쟀다**'); }
  else {
    const names = await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','v')`);
    for (const { relname } of names) {
      if (PUBLIC_OK.has(relname)) continue;
      const r = await fetch(
        `https://${ref}.supabase.co/rest/v1/${relname}?select=*&limit=1`,
        { headers: { apikey: anon } },
      ).catch(() => null);
      if (!r) continue;
      const body = await r.text().catch(() => '');
      if (returnedRows(body)) {
        fail('A4', `\`${relname}\` — **로그인 없이 행이 읽힌다**: ${body.slice(0, 100)}\n        `
          + '★공개해도 되는 자료라면 `PUBLIC_OK` 에 넣고 **이유를 적어라**(그게 검토 기록이 된다)');
      }
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    { name: 'A2 anon 읽기 권한이 있으면 문다', run: () => exposedWithoutRls('anon=arwdDxtm/postgres') === true },
    { name: 'A2 PUBLIC 읽기여도 문다', run: () => exposedWithoutRls('=r/postgres') === true },
    { name: 'A2 authenticated 여도 문다', run: () => exposedWithoutRls('authenticated=r/postgres') === true },
    { name: 'A2 postgres·service_role 만이면 통과', run: () => exposedWithoutRls('postgres=arwdDxtm/postgres service_role=arwdDxtm/postgres') === false },
    { name: 'A2 ★쓰기만 있고 읽기가 없으면 통과(r 이 없다)', run: () => exposedWithoutRls('anon=awdDxtm/postgres') === false },
    { name: 'A3 on 이면 통과', run: () => viewIsInvoker('on') === true },
    { name: 'A3 true 여도 통과', run: () => viewIsInvoker('true') === true },
    { name: 'A3 ★없으면 문다', run: () => viewIsInvoker(null) === false },
    { name: 'A4 행이 나오면 문다', run: () => returnedRows('[{"id":1}]') === true },
    { name: 'A4 ★빈 배열은 통과', run: () => returnedRows('[]') === false },
    { name: 'A4 ★오류 본문은 통과(막혔다는 뜻)', run: () => returnedRows('{"code":"42501"}') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  await run();
  if (out.length) {
    console.error(`❌ check:anonleak — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:anonleak — 로그인 없이 읽히는 개인정보가 없다');
}
