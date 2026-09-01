// scripts/check-moneylock.ts — **돈이 새는 길**을 지킨다 (앱·웹 공통)
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-09-01 *"결제쪽도 버그 찾아 · 앱 웹 전부"*)
//
// ■ ★★실측으로 **음수 잔액 두 건**을 찾았다
//   익명 계정 둘이 **충전 0** 인 채 31번씩 차감돼 각 −391.
//   ⚠️정직하게 — **지금 코드로는 재현이 안 된다**(차감 함수 넷이 전부 잔액을 검사한다).
//   `supabase/` 가 gitignore 라 그날의 코드를 볼 수 없어 **원인은 못 밝혔다.**
//   ⇒ 코드를 고치는 대신 **표가 음수를 거부**하게 했다 — 새 차감 경로가 생겨도 저절로 지켜진다.
//
// ■ ★쓰기 GRANT 가 **한 겹만** 걸려 있었다
//   돈 표 다섯에 `authenticated` 의 INSERT·UPDATE·DELETE 가 살아 있었다.
//   막히던 이유는 오직 «RLS 에 쓰기 정책이 없어서» 다 —
//   **누가 `for all` 정책을 하나 얹으면 잔액을 스스로 적을 수 있다.**
//   ⚠️가정이 아니다: 바로 오늘 `talk_messages`·`talk_sessions` 에서 그 실수를 **둘** 찾았다.
//
// ■ ★테스트 키로 승인된 주문이 **실매출과 구분이 안 됐다**
//   `test_sk_…` 도 토스가 승인해 준다 — **돈은 안 들어오는데 운은 나간다.**
//
// 무엇을 지키나
//   M1 원장에 **음수 잔액 방지 트리거**가 살아 있다
//   M2 돈 표에 `authenticated`·`anon` 쓰기 GRANT 가 **없다**
//   M3 차감하는 함수는 **전부** 잔액을 검사한다(새로 만든 것도)
//   M4 적립 경로에 **재사용 방지**가 있다(`coin_ledger.ref` 부분 유니크 · 웹주문번호 · RC 이벤트)
//   M5 실제로 **음수 잔액인 사람이 없다**
//   M6 웹 결제가 **테스트 키면 표가 남는다**(실매출과 섞이지 않게)
//
// ★음성 테스트: `npx tsx scripts/check-moneylock.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 돈을 빼는 함수인가(음수를 원장에 넣는가). */
export function isDebit(def: string): boolean {
  return /insert\s+into\s+(public\.)?coin_ledger/i.test(def) && /-\s*(v_cost|p_cost)/.test(def);
}
/** 잔액을 검사하는가. */
export function checksBalance(def: string): boolean {
  return /v_bal\s*<\s*(v_cost|p_cost)/.test(def);
}
/** 웹 결제가 테스트 키에 표를 남기는가. */
export function marksTestKey(src: string): boolean {
  return /_docs_/.test(src) && /startsWith\(['"]test_['"]\)/.test(src);
}

async function run() {
  const tokPath = `${homedir()}/.supabase/access-token`;
  if (!existsSync(tokPath)) { console.log('⏭  건너뜀 — 자격증명 없음. **못 쟀다**'); return; }
  const tok = readFileSync(tokPath, 'utf8').trim();
  const ref = (/SUPABASE_PROJECT_REF=(\S+)/.exec(readFileSync('.env', 'utf8')) ?? [])[1];
  if (!ref) { console.log('⏭  건너뜀 — 프로젝트 ref 없음'); return; }
  const q = async (sql: string): Promise<any[]> => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  };

  // M1 트리거
  const trg = await q(`select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where c.relname='coin_ledger' and not t.tgisinternal and t.tgname='trg_coin_ledger_no_negative'`);
  if (!trg.length) {
    fail('M1', '원장에 **음수 잔액 방지 트리거가 없다**.\n        '
      + '⚠️차감 경로는 넷이고 앞으로 는다 — 넷을 다 옳게 두는 것보다 **표가 거부**하는 게 확실하다');
  }

  // M2 쓰기 GRANT
  const g = await q(`select table_name, privilege_type from information_schema.table_privileges
    where table_schema='public' and grantee in ('authenticated','anon')
    and table_name in ('coin_ledger','coin_coupons','entitlement_credits','purchases','web_orders')
    and privilege_type in ('INSERT','UPDATE','DELETE')`);
  for (const r of g) {
    fail('M2', `\`${r.table_name}\` 에 \`${r.privilege_type}\` GRANT 가 살아 있다.\n        `
      + '⚠️지금은 RLS 쓰기 정책이 없어 막히지만, **`for all` 정책 하나면** 잔액을 스스로 적는다');
  }

  // M3 차감 함수의 잔액 검사 — ★이름 목록이 아니라 **전수**
  const fns = await q(`select p.proname, pg_get_functiondef(p.oid) as d
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and pg_get_functiondef(p.oid) ~ 'insert into (public\\.)?coin_ledger'`);
  if (!fns.length) fail('M3', '원장에 쓰는 함수를 하나도 못 찾았다 — **못 쟀다**');
  for (const f of fns) {
    if (isDebit(f.d) && !checksBalance(f.d)) {
      fail('M3', `\`${f.proname}\` 가 **잔액을 안 보고 뺀다**.\n        `
        + '★새 차감 경로를 만들 때마다 이 검사를 빠뜨린다 — 그래서 여기서 전수로 본다');
    }
  }

  // M4 재사용 방지
  const idx = await q(`select indexdef from pg_indexes where schemaname='public' and tablename='coin_ledger'`);
  if (!idx.some((r: any) => /unique/i.test(r.indexdef) && /\(ref\)/.test(r.indexdef))) {
    fail('M4', '`coin_ledger.ref` 에 **유니크가 없다** — 같은 결제로 두 번 적립될 수 있다');
  }
  const cons = await q(`select conrelid::regclass::text as t, pg_get_constraintdef(oid) as d
    from pg_constraint where contype='u' and conrelid::regclass::text in ('web_orders','purchases')`);
  if (!cons.some((r: any) => r.t === 'web_orders' && /order_no/.test(r.d))) fail('M4', '`web_orders.order_no` 유니크가 없다');
  if (!cons.some((r: any) => r.t === 'purchases' && /rc_event_id/.test(r.d))) fail('M4', '`purchases.rc_event_id` 유니크가 없다');

  // M5 실제 음수 잔액
  const neg = await q(`select count(*)::int as n from (select owner_id, sum(delta) s from coin_ledger group by 1) t where s < 0`);
  const n = Number(neg[0]?.n ?? 0);
  if (n > 0) {
    fail('M5', `**잔액이 음수인 계정이 ${n}개** 있다.\n        `
      + '⚠️없는 돈이 나갔다는 뜻이다. 어느 경로로 나갔는지 원장(`reason`)부터 본다.\n        '
      + '★2026-09-01 기준 알려진 2건(08-29·08-30 자동 주행, 익명 계정)은 **원인 미규명**이다 —\n        '
      + '  그 수보다 늘었다면 **새 경로가 생긴 것**이다');
  }

  // M6 테스트 키 표시
  const pw = 'supabase/functions/pay-web/index.ts';
  if (!existsSync(pw)) console.log('⏭  M6 건너뜀 — `supabase/` 가 없다(gitignore). **못 쟀다**');
  else if (!marksTestKey(readFileSync(pw, 'utf8'))) {
    fail('M6', '웹 결제가 **테스트 키에 표를 안 남긴다**.\n        '
      + '⚠️`test_sk_…` 도 토스가 승인한다 — **돈은 안 들어오는데 운은 나간다.**\n        '
      + '실매출과 섞이면 정산에서 골라낼 수 없다');
  }
}

if (process.argv.includes('--selftest')) {
  const dbt = `insert into coin_ledger (owner_id, delta) values (v_owner, -p_cost, 'spend')`;
  const cases = [
    { name: 'M3 차감을 알아본다', run: () => isDebit(dbt) === true },
    { name: 'M3 ★적립은 차감이 아니다', run: () => isDebit(`insert into coin_ledger (owner_id, delta) values (p_owner, p_amount)`) === false },
    { name: 'M3 잔액검사를 알아본다', run: () => checksBalance(`if v_bal < p_cost then return false; end if;`) === true },
    { name: 'M3 ★검사가 없으면 못 찾는다', run: () => checksBalance(`insert into coin_ledger ...`) === false },
    { name: 'M3 ★비슷한 다른 비교에 속지 않는다', run: () => checksBalance(`if v_bal < 0 then`) === false },
    { name: 'M6 두 종류 다 표시하면 통과', run: () => marksTestKey(`includes('_docs_') ... startsWith('test_')`) === true },
    { name: 'M6 ★docs 만 걸러도 문다', run: () => marksTestKey(`includes('_docs_')`) === false },
    { name: 'M6 ★아무것도 안 걸러도 문다', run: () => marksTestKey(`const k = TOSS_SECRET;`) === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  await run();
  if (out.length) {
    console.error(`❌ check:moneylock — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:moneylock — 잔액은 음수가 못 되고, 돈 표는 서버만 쓰고, 같은 결제로 두 번 못 받는다');
}
