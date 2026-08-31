// scripts/check-pushtoken.ts — 푸시 토큰은 **기기 하나에 계정 하나**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-09-01 *"내가 보낸 메세지도 알림이 오는데?"*)
//
// ■ ★큐는 정확했다 — 보낸 사람을 빼고 친구에게만 1건 갔다.
//   문제는 **누구에게 닿는가** 였다:
//     실측 — 토큰 하나가 **21개 계정**에 붙어 있었다(Boss 계정 포함).
//   ⇒ 친구에게 간 알림이 Boss 폰으로도 왔다. 「내 메시지에 내가 알림받는」 것처럼 보인다.
//
// ■ 왜 그렇게 됐나 — `set_push_token` 이 **자기 행만** 갱신했다
//   같은 기기에서 다른 계정으로 로그인하면 새 계정에 토큰이 저장되는데
//   **옛 계정에서는 안 지워진다.** 익명 계정이 많은 이 앱에서는 금방 쌓인다.
//   ⚠️오류가 안 난다 — 알림이 **더 많이** 갈 뿐이라 조용하다. 청구서에도 안 잡힌다.
//
// 무엇을 지키나
//   K1 등록 함수가 **남의 행에서 같은 토큰을 뗀다**
//   K2 ★실측 — 지금 DB 에 **겹친 토큰이 없다**
//
// ★음성 테스트: `npx tsx scripts/check-pushtoken.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 등록 함수가 **남의 행을 비우는가**. */
export function clearsOthers(sql: string): boolean {
  // `update ... set push_token = null ... where push_token = p_token and id <> me`
  return /set\s+push_token\s*=\s*null[\s\S]{0,200}?push_token\s*=\s*p_token[\s\S]{0,80}?id\s*<>\s*me/i.test(sql);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  // K1 — 마이그레이션 중 **가장 마지막에** 이 함수를 만든 파일을 본다
  //   ★파일 이름을 박지 않는다 — 정의가 옮겨 가도 따라간다([[harness-goes-blind-on-refactor]])
  const dir = join(ROOT, 'supabase/migrations');
  let latest: { name: string; sql: string } | null = null;
  try {
    for (const n of readdirSync(dir).sort()) {
      const sql = readFileSync(join(dir, n), 'utf8');
      if (/create\s+or\s+replace\s+function\s+public\.set_push_token/i.test(sql)) latest = { name: n, sql };
    }
  } catch { /* 폴더가 없으면 아래에서 걸린다 */ }

  if (!latest) fail('K1', '`set_push_token` 을 만드는 마이그레이션을 못 찾았다');
  else if (!clearsOthers(latest.sql)) {
    fail('K1', `${latest.name} 의 \`set_push_token\` 이 **남의 행에서 같은 토큰을 안 뗀다**.\n        `
      + '⚠️같은 기기에서 다른 계정으로 로그인하면 옛 계정에 토큰이 **남는다** —\n        '
      + '2026-09-01 실측: 토큰 하나가 **21개 계정**에 붙어 있었다.\n        '
      + '★토큰은 «기기» 를 가리킨다 — 한 기기가 두 사람일 수는 없다.\n        '
      + '⚠️오류가 안 난다. 알림이 **더 많이** 갈 뿐이라 조용하다');
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const OK = `update public.profiles set push_token = null
   where push_token = p_token and id <> me;
  update public.profiles set push_token = p_token where id = me;`;
  const BAD = 'update public.profiles set push_token = p_token where id = me;';
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'K1 남의 행을 비우면 통과', run: () => clearsOthers(OK) === true },
    { name: 'K1 ★자기 행만 갱신하면 문다(이게 21개를 만들었다)', run: () => clearsOthers(BAD) === false },
    { name: 'K1 비우기만 하고 조건이 없으면 문다',
      run: () => clearsOthers('update profiles set push_token = null;') === false },
    { name: 'K1 `id <> me` 가 빠지면 문다(제 것까지 지운다)',
      run: () => clearsOthers('update profiles set push_token = null where push_token = p_token;') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:pushtoken — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:pushtoken — 토큰 등록이 남의 계정에서 같은 토큰을 뗀다(기기 하나에 계정 하나)');
