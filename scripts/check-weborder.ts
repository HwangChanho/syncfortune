// scripts/check-weborder.ts — 웹 결제가 «돈이 새는 두 구멍» 을 구조로 막고 있는지 강제한다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-30 웹 전용 전환)
//   웹 결제에서 돈이 새는 곳은 거의 언제나 둘이다.
//     ① 클라가 보낸 **금액을 믿는다**   → ₩100 에 1,200운이 나간다
//     ② 같은 결제를 **두 번 적립한다**  → 새로고침만으로 무료 운이 생긴다
//   이 둘은 「조심하자」로 막히지 않는다. 리팩터링 한 번이면 조용히 되돌아온다.
//
// ★판정은 «뜻» 으로 한다 — 자리·이름·글자 모양으로 보면 리팩터링에 눈이 먼다
//   (이 저장소가 하루에 세 번 당한 병 · [[harness-goes-blind-on-refactor]]).
//   예: 「`raise` 가 몇 번째 줄인가」 ❌  →  「주문 금액과 승인 금액을 **비교하는 곳이 있는가**」 ⭕
//
// 무엇을 지키나
//   W1 주문 생성은 **금액을 받지 않는다** — 인자에 금액류가 있으면 실패
//   W2 승인은 **주문 금액과 승인 금액을 대조**한다
//   W3 적립의 멱등키는 **주문번호**다(재전송·새로고침이 두 번 주지 못하게)
//   W4 승인 함수는 `anon`·`authenticated` **에서 명시적으로** 회수돼 있다
//      ⚠️`from public` 만으로는 안 뺏긴다 — Supabase 기본권한이 롤에 직접 EXECUTE 를 달아 준다
//   W5 코드 가격표(`coinPrices.ts` 웹가)와 DB 시드(`coin_packs`)가 **같은 값**이다
//   W6 연락처는 `context` 에 **섞이지 않는다**(context 는 통변 프롬프트로 서버에 나간다)
//
// ★음성 테스트: `npx tsx scripts/check-weborder.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { COIN_PACKS, packPriceWon } from '../app/src/lib/billing/coinPrices';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p: string) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } };

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** SQL 주석을 지운다 — 주석에 적힌 예시가 «있는 것» 으로 세어지면 하네스가 거짓 초록불을 낸다. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*--.*$/gm, ' ');
}

/** `create ... function <name>(...)` 의 **인자 목록**만 떼어 온다(본문은 안 본다). */
export function fnArgs(sql: string, name: string): string | null {
  const re = new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?${name}\s*\(([^)]*)\)`, 'i');
  return sql.match(re)?.[1] ?? null;
}

/** `$$ … $$` 로 감싼 **함수 본문**을 떼어 온다. 이름 뒤 첫 `$$` 쌍. */
export function fnBody(sql: string, name: string): string | null {
  const at = sql.search(new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?${name}\s*\(`, 'i'));
  if (at < 0) return null;
  const open = sql.indexOf('$$', at);
  if (open < 0) return null;
  const close = sql.indexOf('$$', open + 2);
  return close < 0 ? null : sql.slice(open + 2, close);
}

// ── 판정기(음성 테스트가 같은 것을 쓴다) ────────────────────────────────────

/** W1 — 인자 이름에 금액류가 섞였는가. `p_pack_id` 만 있으면 통과. */
export function takesMoney(args: string): boolean {
  return /\b\w*(won|amount|price|krw|money|금액)\w*\s+\w/i.test(args);
}

/** W2 — 본문 어딘가에서 «주문의 금액» 과 «승인된 금액» 을 비교하는가(연산자·순서 무관). */
export function comparesAmount(body: string, paidParam: string): boolean {
  const cmp = String.raw`(?:=|<>|!=|is\s+distinct\s+from)`;
  const won = String.raw`[\w.]*\bwon\b`;
  const paid = paidParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${won}\\s*${cmp}\\s*${paid}`, 'i').test(body)
      || new RegExp(`${paid}\\s*${cmp}\\s*${won}`, 'i').test(body);
}

/** W3 — 적립 호출의 **ref 자리**에 주문번호가 들어가는가. */
export function refIsOrderNo(body: string): boolean {
  const call = body.match(/grant_coins\s*\(([^)]*)\)/i)?.[1];
  if (!call) return false;
  const args = call.split(',').map((s) => s.trim());
  // grant_coins(p_owner, p_amount, p_reason, p_ref, p_kind) — 넷째가 ref
  return !!args[3] && /order_no/i.test(args[3]);
}

/** W4 — 그 함수가 `anon`·`authenticated` 에서 **명시적으로** 회수됐는가. */
export function revokedFromRoles(sql: string, name: string): { anon: boolean; authed: boolean } {
  const lines = sql.split(/;/).filter((s) => /revoke/i.test(s) && new RegExp(name, 'i').test(s));
  const joined = lines.join(' ');
  return { anon: /\banon\b/i.test(joined), authed: /\bauthenticated\b/i.test(joined) };
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const MIG = 'supabase/migrations/20260830a_web_orders.sql';
  const raw = read(MIG);
  if (!raw) {
    fail('W0', `${MIG} 이 없다 — 웹 주문 마이그레이션이 사라졌거나 이름이 바뀌었다`);
  } else {
    const sql = stripSqlComments(raw);

    // W1
    const args = fnArgs(sql, 'create_web_order');
    if (args == null) fail('W1', 'create_web_order 를 찾지 못했다');
    else if (takesMoney(args)) {
      fail('W1', `create_web_order 가 **금액을 인자로 받는다**: (${args.trim()})\n        `
        + '금액은 서버가 `coin_packs` 에서 읽어 박아야 한다 — 받을 통로를 만들면 조작이 성립한다');
    }

    // W2 · W3
    const body = fnBody(sql, 'settle_web_order');
    if (!body) fail('W2', 'settle_web_order 본문을 찾지 못했다');
    else {
      const sArgs = fnArgs(sql, 'settle_web_order') ?? '';
      const paid = sArgs.split(',').map((s) => s.trim().split(/\s+/)[0]).find((n) => /won|amount|paid/i.test(n)) ?? 'p_paid_won';
      if (!comparesAmount(body, paid)) {
        fail('W2', `settle_web_order 가 **승인 금액을 대조하지 않는다**(${paid} 와 주문의 won 을 비교하는 곳이 없다).\n        `
          + 'PG 가 얼마를 승인했든 그대로 적립하면, 결제창 파라미터를 바꿔 ₩100 에 1,200운을 받는다');
      }
      if (!refIsOrderNo(body)) {
        fail('W3', 'grant_coins 의 **ref 자리(넷째 인자)가 주문번호가 아니다**.\n        '
          + 'ref 가 멱등키다 — 주문번호를 넣어야 재전송·새로고침이 두 번 지급하지 못한다');
      }
    }

    // W4
    const rv = revokedFromRoles(sql, 'settle_web_order');
    if (!rv.authed || !rv.anon) {
      fail('W4', `settle_web_order 권한 회수가 부족하다(anon=${rv.anon ? 'ok' : '없음'} · authenticated=${rv.authed ? 'ok' : '없음'}).\n        `
        + '⚠️`revoke ... from public` 만으로는 안 뺏긴다 — Supabase 는 새 함수마다 그 롤들에 EXECUTE 를 **직접** 달아 준다.\n        '
        + '롤 이름을 적어서 회수하지 않으면 로그인만 하면 결제 없이 운이 생긴다');
    }

    // W5 — 코드 웹가 ↔ DB 시드
    const seed = sql.match(/insert\s+into\s+public\.coin_packs[\s\S]*?values([\s\S]*?)on\s+conflict/i)?.[1] ?? '';
    const rows = [...seed.matchAll(/\(\s*'([^']+)'\s*,\s*(\d+)\s*,\s*(\d+)/g)]
      .map((m) => ({ id: m[1], coins: Number(m[2]), won: Number(m[3]) }));
    if (!rows.length) fail('W5', 'coin_packs 시드를 읽지 못했다 — 가격이 DB 에 안 들어갔을 수 있다');
    for (const pack of COIN_PACKS) {
      const row = rows.find((r) => r.id === pack.id);
      const web = packPriceWon(pack.id, 'web');
      if (!row) { fail('W5', `${pack.id} 가 coin_packs 시드에 없다 — 웹에서 못 판다`); continue; }
      if (row.won !== web) {
        fail('W5', `${pack.id} 가격이 갈렸다 — 코드(웹가) ${web.toLocaleString('ko-KR')}원 ≠ DB 시드 ${row.won.toLocaleString('ko-KR')}원.\n        `
          + '결제창에 그리는 값과 서버가 대조하는 값이 다르면 **정상 결제가 금액 불일치로 거절**된다');
      }
      if (row.coins !== pack.coins) fail('W5', `${pack.id} 운 수량이 갈렸다 — 코드 ${pack.coins} ≠ DB ${row.coins}`);
    }
  }

  // W6 — 연락처가 통변으로 나가지 않는가
  const reg = read('app/src/screens/ChartRegisterScreen.tsx');
  if (reg) {
    // `context: (…) ? { … } : undefined` 의 **중괄호 안** 만 본다
    const ctxObj = reg.match(/context:\s*\([^)]*\)\s*\?\s*\{([^}]*)\}/)?.[1] ?? '';
    if (/email|phone|contact/i.test(ctxObj)) {
      fail('W6', `연락처가 \`context\` 안에 들어 있다: {${ctxObj.trim().slice(0, 80)}…}\n        `
        + '`context` 는 통변 프롬프트로 **서버에 실려 나간다**(interpret 의 contextBlock). 연락처는 나가면 안 된다(ADR-005)');
    }
    if (!/contact:\s*\(/.test(reg)) {
      fail('W6', '연락처 필드(`contact:`)가 buildInput 에 없다 — 화면에만 있고 저장이 안 되는 상태일 수 있다');
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'W1: 팩 id 만 받으면 통과', run: () => takesMoney('p_pack_id text') === false },
    { name: 'W1: won 을 받으면 문다', run: () => takesMoney('p_pack_id text, p_won integer') === true },
    { name: 'W1: amount 를 받아도 문다', run: () => takesMoney('p_pack_id text, p_amount integer') === true },
    { name: 'W1: pack_id 안의 「id」에 속지 않는다', run: () => takesMoney('p_pack_id text, p_note text') === false },
    { name: 'W2: 비교가 있으면 통과', run: () => comparesAmount('if v_ord.won <> p_paid_won then', 'p_paid_won') === true },
    { name: 'W2: 순서를 뒤집어도 통과', run: () => comparesAmount('if p_paid_won != v_ord.won then', 'p_paid_won') === true },
    { name: 'W2: 비교가 없으면 문다', run: () => comparesAmount('update web_orders set status=\'paid\';', 'p_paid_won') === false },
    { name: 'W3: ref 가 order_no 면 통과', run: () => refIsOrderNo("perform grant_coins(v.owner_id, v.coins, 'purchase', v.order_no, null);") === true },
    { name: 'W3: ref 가 딴 값이면 문다', run: () => refIsOrderNo("perform grant_coins(v.owner_id, v.coins, 'purchase', 'web', null);") === false },
    { name: 'W3: 적립 호출이 없으면 문다', run: () => refIsOrderNo('update web_orders set granted_at = now();') === false },
    { name: 'W4: 두 롤을 적으면 통과', run: () => { const r = revokedFromRoles('revoke all on function public.settle_web_order(text) from public, anon, authenticated;', 'settle_web_order'); return r.anon && r.authed; } },
    { name: 'W4: public 만 적으면 문다', run: () => { const r = revokedFromRoles('revoke all on function public.settle_web_order(text) from public;', 'settle_web_order'); return !r.anon && !r.authed; } },
    { name: '주석은 «있는 것» 으로 세지 않는다', run: () => !/p_won/.test(stripSqlComments('-- 예전엔 p_won 을 받았다\ncreate function f(p_pack_id text)')) },
    { name: 'fnBody 가 본문만 떼어 온다', run: () => (fnBody('create function public.g(a int) as $$ begin return 1; end; $$;', 'g') ?? '').includes('return 1') },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:weborder — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:weborder — 주문 생성은 금액을 안 받고 · 승인은 금액을 대조하고 · 멱등키는 주문번호 · `
  + `승인 함수는 클라에서 회수됨 · 코드↔DB 가격 ${COIN_PACKS.length}팩 일치 · 연락처는 통변으로 안 나감`);
