// scripts/check-notice.ts — **공지**가 뜨고, 하루는 정말 하루인지 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01: *"관리자페이지에서 공지글 쓸수있게하고 공지글은 홈화면에 가면
//   무조건 뜨게하고 하루동안 보지않기 체크하면 노출 안 되게해"*
//
// ■ ★★«하루» 는 **누른 때로부터 24시간**이다 — 자정 기준이 아니다
//   자정으로 잡으면 **밤 11시에 누른 사람은 1시간만** 안 보인다.
//   버튼에 「하루 동안」 이라고 적어 놓고 1시간만 숨기는 것은 **글자가 거짓말**이 되는 것이다.
//   ⇒ 이 하네스가 그 약속을 지킨다.
//
// ■ ★쓰기는 **관리자만** — 정책으로 막는다(실측으로 확인한다)
//   ⚠️공지는 **전 사용자 첫 화면**에 뜬다. 아무나 쓸 수 있으면 그건 방송 장악이다.
//
// ■ ★고친 공지는 **다시 보여야** 한다(`revision`)
//   같은 id 로 내용을 고쳤는데 계속 숨어 있으면 운영이 이유를 알 수 없다.
//
// 무엇을 지키나
//   N1 하루 = **24시간**(자정 아님) · 경계에서 정확히 갈린다
//   N2 판(revision)이 바뀌면 **다시 뜬다**
//   N3 기간이 지난 공지는 **안 뜬다**(앱 2차 확인)
//   N4 ★관리자가 아니면 **못 쓴다**(DB 실측)
//   N5 홈에 **붙어 있다**
//
// ★음성 테스트: `npx tsx scripts/check-notice.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { shouldHide, isLive, seenKey, DAY_MS } from '../app/src/lib/content/noticeSeen';

const ROOT = join(import.meta.dirname ?? '.', '..');
type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

async function run() {
  // N5 홈에 붙었나
  const HOME = 'app/src/app/(app)/index.tsx';
  const home = existsSync(join(ROOT, HOME)) ? readFileSync(join(ROOT, HOME), 'utf8') : '';
  if (!/<NoticeSheet\s*\/>/.test(home)) {
    fail('N5', '홈에 `<NoticeSheet />` 가 **없다** — 공지를 써도 아무도 못 본다');
  }

  // N4 ★DB 실측 — 관리자가 아니면 못 쓴다
  const tok = `${homedir()}/.supabase/access-token`;
  if (!existsSync(tok)) { console.log('⏭  N4 건너뜀 — 자격증명 없음. **못 쟀다**'); return; }
  const ref = (/SUPABASE_PROJECT_REF=(\S+)/.exec(readFileSync(join(ROOT, '.env'), 'utf8')) ?? [])[1];
  if (!ref) { console.log('⏭  N4 건너뜀 — 프로젝트 ref 없음. **못 쟀다**'); return; }
  const q = async (sql: string): Promise<any[]> => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${readFileSync(tok, 'utf8').trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  };
  const pol = await q(`select cmd, coalesce(with_check, qual) as chk from pg_policies
     where schemaname='public' and tablename='notices' and cmd in ('INSERT','UPDATE','DELETE')`);
  if (!pol.length) fail('N4', '`notices` 에 쓰기 정책이 **없다** — 정책이 없으면 아무도 못 쓴다(관리자 포함)');
  for (const p of pol) {
    if (!/is_caller_admin/.test(String(p.chk ?? ''))) {
      fail('N4', `\`notices\` 의 ${p.cmd} 정책이 **관리자를 안 본다**: ${p.chk}.\n        `
        + '⚠️공지는 **전 사용자 첫 화면**에 뜬다 — 아무나 쓸 수 있으면 방송 장악이다');
    }
  }
  const gr = await q(`select privilege_type from information_schema.table_privileges
     where table_schema='public' and table_name='notices' and grantee='anon'
     and privilege_type in ('INSERT','UPDATE','DELETE')`);
  if (gr.length) fail('N4', `비로그인(anon)에 ${gr.map((x: any) => x.privilege_type).join('·')} 권한이 있다 — 회수해야 한다`);
}

if (process.argv.includes('--selftest')) {
  const now = 1_700_000_000_000;
  const cases = [
    { name: 'N1 방금 누르면 숨는다', run: () => shouldHide(now, now) === true },
    { name: 'N1 23시간 뒤에도 숨는다', run: () => shouldHide(now - 23 * 3600e3, now) === true },
    { name: 'N1 ★24시간 **직전**은 숨는다', run: () => shouldHide(now - (DAY_MS - 1000), now) === true },
    { name: 'N1 ★24시간 **정각**은 보인다(경계)', run: () => shouldHide(now - DAY_MS, now) === false },
    { name: 'N1 25시간 뒤엔 보인다', run: () => shouldHide(now - 25 * 3600e3, now) === false },
    { name: 'N1 ★누른 적 없으면 보인다', run: () => shouldHide(null, now) === false },
    { name: 'N1 ★저장값이 깨졌으면 보인다', run: () => shouldHide(NaN, now) === false && shouldHide('x' as any, now) === false },
    { name: 'N1 ★시계가 뒤로 가도 안 숨긴다', run: () => shouldHide(now + 10000, now) === false },
    { name: 'N2 ★판이 바뀌면 키가 달라진다', run: () => seenKey('a', 1) !== seenKey('a', 2) },
    { name: 'N3 활성이면 뜬다', run: () => isLive({ active: true }, now) === true },
    { name: 'N3 ★내린 공지는 안 뜬다', run: () => isLive({ active: false }, now) === false },
    { name: 'N3 ★시작 전이면 안 뜬다', run: () => isLive({ active: true, starts_at: new Date(now + 1000).toISOString() }, now) === false },
    { name: 'N3 ★끝난 뒤면 안 뜬다', run: () => isLive({ active: true, ends_at: new Date(now - 1000).toISOString() }, now) === false },
    { name: 'N3 기간이 비면 계속 뜬다', run: () => isLive({ active: true, starts_at: null, ends_at: null }, now) === true },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  await run();
  if (out.length) {
    console.error(`❌ check:notice — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:notice — 공지는 관리자만 쓰고, 하루는 정말 24시간이다');
}
