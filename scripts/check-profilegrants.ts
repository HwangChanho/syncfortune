// scripts/check-profilegrants.ts — 앱이 읽는 `profiles` 칸이 **권한상 읽히는가**
// ═══════════════════════════════════════════════════════════════════════════
// ★2026-09-02 사고 — 배포한 웹을 브라우저로 띄우다가 콘솔에서 잡았다:
//   `profiles?select=...` 가 **여덟 번 전부 403**. 그런데 **화면은 멀쩡해 보인다** —
//   값이 안 오면 앱이 기본값으로 떨어질 뿐이라 오류가 안 뜬다.
//   그동안 조용히 이랬다: 광고 제거를 산 사람에게 **광고가 뜨고**(돈), 프리미엄이 인식 안 되고,
//   **관리자 화면에 못 들어가고**, 말투 설정이 되돌아갔다.
//
// ■ 원인 — 정책은 맞는데 **컬럼 GRANT 가 없었다**. authenticated 에 SELECT 가 6칸뿐인데
//   앱은 15칸을 읽었다. 08-28 엔 «정책만 열면 안 된다» 였고 이번엔 **반대쪽**이었다 —
//   자물쇠를 너무 잠가서 주인도 못 열었다.
//
// ■ ★이 하네스는 «권한» 을 직접 못 본다(DB 접속은 preflight 밖). 그래서 **두 갈래**로 문다:
//   ① 앱이 읽는 칸 목록을 소스에서 뽑아, 마이그레이션의 `grant select (…)` 목록과 대조한다.
//   ② 열어서는 **안 되는** 칸(푸시 토큰·성인인증)이 그 목록에 끼어들지 않았는지 본다.
//      친구 정책(`is_friend_of`)이 있어서, 여는 칸은 **수락된 친구도 읽는다**.
//
// 무엇을 지키나
//   P1 앱이 읽는 칸이 **전부** grant 목록에 있다(없으면 그 화면이 조용히 기본값으로 떨어진다)
//   P2 ★열면 안 되는 칸이 grant 에 **없다**(push_token·adult_di_hash·adult_verified_at)
//   P3 ★UPDATE 를 여기서 열지 않았다(is_admin 을 스스로 켜는 문이 그쪽이다)
//   P4 anon 에게 SELECT 를 주지 않았다
//
// ★음성 테스트: `npx tsx scripts/check-profilegrants.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIG = 'supabase/migrations/20260902b_profiles_select_grants.sql';
/** ⚠️친구도 읽게 되므로 **절대 열지 않는다**. */
const NEVER = ['push_token', 'adult_di_hash', 'adult_verified_at', 'suspended_reason', 'suspended_until'];

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 소스에서 `from('profiles')…select('a, b, c')` 의 칸 이름을 모은다. */
export function columnsAppReads(srcs: { file: string; text: string }[]): Map<string, string> {
  const found = new Map<string, string>();   // 칸 → 처음 본 파일
  for (const { file, text } of srcs) {
    // ★`from('profiles')` 와 `.select(...)` 사이에 다른 체이닝이 낄 수 있어 **같은 줄**로 묶지 않는다.
    //   대신 from 위치부터 240자 안의 첫 select 를 본다(호출 하나의 길이).
    for (const m of text.matchAll(/from\(\s*'profiles'\s*\)/g)) {
      const seg = text.slice(m.index!, m.index! + 240);
      const sel = seg.match(/\.select\(\s*'([^']+)'/);
      if (!sel) continue;
      for (const raw of sel[1].split(',')) {
        const col = raw.trim().split(/[\s(:]/)[0];      // `count(...)`·별칭 방어
        if (/^[a-z_][a-z0-9_]*$/.test(col) && col !== '*') found.set(col, file);
      }
    }
  }
  return found;
}

/** 마이그레이션의 `grant select ( … ) on public.profiles` 목록. */
export function grantedColumns(sql: string): string[] {
  const m = sql.match(/grant\s+select\s*\(([^)]+)\)\s*on\s+public\.profiles/i);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

function walk(dir: string, acc: { file: string; text: string }[] = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e)) acc.push({ file: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') });
  }
  return acc;
}

function run() {
  const abs = join(ROOT, MIG);
  if (!existsSync(abs)) { fail('P1', `권한 마이그레이션이 없다: ${MIG}`); return; }
  const sql = readFileSync(abs, 'utf8');
  const granted = grantedColumns(sql);
  if (!granted.length) { fail('P1', '`grant select ( … ) on public.profiles` 를 못 찾았다'); return; }

  // P1 — 앱이 읽는 칸이 전부 열려 있나
  const reads = columnsAppReads(walk(join(ROOT, 'app/src')));
  for (const [col, file] of reads) {
    if (!granted.includes(col)) {
      fail('P1', `앱이 읽는 \`${col}\` 이 grant 에 없다 (${file}).\n        `
        + '⚠️403 이 나는데 **화면은 멀쩡해 보인다** — 값이 안 오면 기본값으로 떨어질 뿐이다');
    }
  }
  // P2 — 열면 안 되는 칸이 끼었나
  for (const c of NEVER) {
    if (granted.includes(c)) {
      fail('P2', `\`${c}\` 이 grant 에 있다 — 친구 정책(is_friend_of) 때문에 **수락된 친구가 읽는다**`);
    }
  }
  // P3 — 여기서 UPDATE 를 열지 않았나
  if (/grant\s+update/i.test(sql)) {
    fail('P3', '이 마이그레이션이 UPDATE 를 연다 — `is_admin` 을 스스로 켜는 문이 그쪽이다(읽기만 열 것)');
  }
  // P4 — anon
  if (/grant\s+select[^;]*to\s+anon/i.test(sql)) {
    fail('P4', 'anon 에게 SELECT 를 준다 — anon 이 보는 행은 0 이라 줄 이유가 없다(최소권한)');
  }
}

if (process.argv.includes('--selftest')) {
  const S = (text: string) => [{ file: 'x.ts', text }];
  const cases: { name: string; run: () => boolean }[] = [
    { name: 'P1 칸을 뽑는다', run: () => { const r = columnsAppReads(S("supabase.from('profiles').select('is_admin, ad_free_until')")); return r.has('is_admin') && r.has('ad_free_until'); } },
    { name: 'P1 ★줄이 갈려도 뽑는다', run: () => columnsAppReads(S("from('profiles')\n  .eq('id', x)\n  .select('speech_casual')")).has('speech_casual') },
    { name: 'P1 ★다른 표는 안 뽑는다', run: () => columnsAppReads(S("from('charts').select('saju')")).size === 0 },
    { name: 'P1 ★`*` 는 칸이 아니다', run: () => !columnsAppReads(S("from('profiles').select('*')")).has('*') },
    { name: 'P1 ★멀리 떨어진 select 는 다른 호출로 본다', run: () => columnsAppReads(S("from('profiles')" + ' '.repeat(300) + ".select('zzz')")).size === 0 },
    { name: 'grant 목록을 읽는다', run: () => { const g = grantedColumns('grant select (id, is_admin) on public.profiles to authenticated;'); return g.length === 2 && g.includes('is_admin'); } },
    { name: '★grant 가 없으면 빈 목록', run: () => grantedColumns('revoke select on public.profiles from anon;').length === 0 },
    { name: 'P2 ★막아야 할 칸 목록이 비어 있지 않다', run: () => NEVER.includes('push_token') && NEVER.includes('adult_di_hash') },
    { name: 'P3 ★update 문을 문다', run: () => /grant\s+update/i.test('grant update (nickname) on public.profiles to authenticated;') },
    { name: 'P4 ★anon select 를 문다', run: () => /grant\s+select[^;]*to\s+anon/i.test('grant select (id) on public.profiles to anon;') },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:profilegrants — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:profilegrants — 앱이 읽는 칸이 전부 열려 있고, 열면 안 되는 칸은 닫혀 있다');
}
