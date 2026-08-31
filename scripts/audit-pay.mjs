// scripts/audit-pay.mjs — 결제 **대조 쿼리** (D0 · 매일 돌린다)
// ═══════════════════════════════════════════════════════════════════════════
// 웹 결제가 열리면 «돈은 나갔는데 운이 없다» 와 «운은 줬는데 결제가 없다» 를
// **사람이 눈치채기 전에** 잡아야 한다. 화면으로는 안 보이는 종류라 쿼리로만 보인다.
//
// 실행: npm run audit:pay
// ★읽기 전용이다 — 고치지 않는다. 무엇이 어긋났는지만 말한다.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
let token = null;
try { token = fs.readFileSync(path.join(os.homedir(), '.supabase', 'access-token'), 'utf8').trim(); } catch { /* .env 로 */ }
token = token || env.SUPABASE_ACCESS_TOKEN;

const q = async (sql) => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);   // ⚠️상한 필수 — fetch 는 기본값이 없다
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
      method: 'POST', signal: ac.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });
    const t = await r.text();
    if (!r.ok) throw new Error(`SQL ${r.status} ${t.slice(0, 300)}`);
    return JSON.parse(t);
  } finally { clearTimeout(timer); }
};

/** 각 검사 = [이름, SQL, 정상값 설명, 정상 판정] */
const CHECKS = [
  ['고아 결제 — 돈은 받고 운을 안 줌',
   `select count(*)::int n from web_orders where status='paid' and granted_at is null`, '0건', (r) => r.n === 0],
  ['유령 적립 — 주문 없이 지급됨',
   `select count(*)::int n from coin_ledger l where l.reason='purchase' and l.ref like 'W2026%'
      and not exists (select 1 from web_orders o where o.order_no = l.ref)`, '0건', (r) => r.n === 0],
  ['이중 적립 — 같은 주문으로 두 번',
   `select count(*)::int n from (select ref from coin_ledger where ref is not null and delta>0
      group by ref having count(*)>1) x`, '0건', (r) => r.n === 0],
  ['금액 불일치로 거절된 주문(공격 흔적일 수 있다)',
   `select count(*)::int n from web_orders where status='failed' and fail_reason like '금액 불일치%'`,
   '추세 감시', () => true],
  ['미결 주문 — 30분 넘게 pending',
   `select count(*)::int n from web_orders where status='pending' and created_at < now() - interval '30 minutes'`,
   '추세 감시', () => true],
  ['환불 가능 창이 열린 주문(7일 이내 · 미사용분 있음)',
   `select count(*)::int n from web_orders o where o.status='paid' and o.paid_at > now() - interval '7 days'`,
   '참고', () => true],
];

let bad = 0;
console.log('\n💳 결제 대조 — 읽기 전용\n');
for (const [name, sql, expect, ok] of CHECKS) {
  try {
    const row = (await q(sql))[0] ?? {};
    const good = ok(row);
    if (!good) bad++;
    console.log(`  ${good ? '✅' : '❌'} ${name.padEnd(40)} ${String(row.n).padStart(5)}  (정상: ${expect})`);
  } catch (e) {
    bad++;
    console.log(`  ❌ ${name.padEnd(40)}  조회 실패 — ${String(e.message).slice(0, 80)}`);
  }
}
console.log(bad ? `\n❌ ${bad}건 — 결제 장부가 어긋나 있습니다.\n` : '\n✅ 장부가 맞습니다.\n');
process.exit(bad ? 1 : 0);
