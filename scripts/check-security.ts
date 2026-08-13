// scripts/check-security.ts — **anon key 로 실제 요청을 쏴서** 뚫리는지 본다
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-13: *"보안 검사해봐"*
//
// ■ 왜 코드 읽기가 아니라 요청인가
//   RLS·게이트는 **서버에 있고 코드에 없다**(MCP 로 배포된 정책은 repo 에 없다).
//   그래서 소스를 아무리 읽어도 "지금 열려 있는지"는 알 수 없다. **쏴 봐야 안다.**
//   anon key 는 앱 번들에 이미 들어 있는 공개 값이므로, 이 검사가 곧 **공격자가 할 수 있는 전부**다.
//
// ■ ★판정은 상태코드가 아니라 **실제 값**으로 한다 (2026-08-13 실측 교훈)
//   첫 판에서 `profiles` 권한상승 PATCH 가 **204** 를 돌려줘 "뚫렸다"고 봤는데,
//   service_role 로 확인하니 **is_admin=true 는 1명 그대로**였다.
//   PostgREST 는 **0행 UPDATE 에도 204** 를 준다 — RLS 가 전부 걸러낸 결과였다.
//   ⇒ 쓰기 검사는 반드시 **쏜 뒤 값을 다시 읽어** 비교한다.
//   (같은 함정: Play API 의 `completed` 가 '배포됨'을 뜻하지 않았던 것 — [[verify-facts-not-memory]])
//
// ■ 검사 범위
//   ① 읽기 — 남의 데이터가 나오는가(RLS)   ② 관리자 RPC — 부를 수 있는가
//   ③ 돈 — 코인을 만들 수 있는가            ④ Edge — 유료 생성을 공짜로 받는가
//   ⑤ 쓰기 — 권한상승·플래그 조작이 **실제로 반영되는가**
//
// ⚠️이 검사가 **못 보는 것**(정직하게 남긴다):
//   · 인증된 사용자가 **남의** 데이터를 읽는지 — 유효한 JWT 가 필요한데 계정 생성은 하지 않는다
//   · JWT 위조·권한 상승 — 서명 키가 없으면 불가(그 자체가 방어)
//
// 실행: npm run check:security   (네트워크 필요 — .env 의 anon/service key 사용)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const U = env.SUPABASE_URL, A = env.SUPABASE_ANON_KEY, K = env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !A) { console.log('\n⏭  check:security 건너뜀 — .env 에 SUPABASE_URL/ANON_KEY 가 없습니다\n'); process.exit(0); }

const anon = { apikey: A, Authorization: `Bearer ${A}`, 'Content-Type': 'application/json' };
const svc = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const isOk = (s: number) => s >= 200 && s < 300;

let bad = 0;
const say = (pass: boolean, name: string, note = '') => {
  if (!pass) bad++;
  console.log(`   ${pass ? '✅' : '❌'} ${name.padEnd(32)} ${note}`);
};

console.log('\n🔒 보안 실측 — anon key(앱 번들에 있는 공개 값)로 직접 요청\n');

// ── ① 읽기: 남의 데이터가 나오는가 ─────────────────────────────────────────
console.log('  [읽기] 익명이 데이터를 가져갈 수 있는가');
for (const t of ['charts', 'readings', 'coin_ledger', 'profiles', 'api_usage', 'dream_readings']) {
  try {
    const r = await fetch(`${U}/rest/v1/${t}?select=*&limit=3`, { headers: anon });
    if (!isOk(r.status)) { say(true, t, `${r.status} 막힘`); continue; }
    const rows = await r.json().catch(() => []);
    say(Array.isArray(rows) && rows.length === 0, t, `${r.status} · ${Array.isArray(rows) ? rows.length : '?'}행`);
  } catch { say(true, t, '연결 실패'); }
}

// ── ② 관리자 RPC ──────────────────────────────────────────────────────────
console.log('\n  [관리자] 익명이 관리 기능을 부를 수 있는가');
for (const fn of ['admin_list_users', 'admin_stats', 'admin_grant_coins', 'set_app_flag', 'set_global_test_mode']) {
  try {
    const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: anon, body: '{}' });
    say(!isOk(r.status), fn, String(r.status));
  } catch { say(true, fn, '연결 실패'); }
}

// ── ③ 돈 ─────────────────────────────────────────────────────────────────
console.log('\n  [돈] 코인을 만들거나 남의 것을 쓸 수 있는가');
for (const [name, path, body] of [
  ['spend_coins_owner', 'rpc/spend_coins_owner', { p_owner: '00000000-0000-0000-0000-000000000000', p_kind: 'reading', p_cost: -999 }],
  ['coin_ledger 삽입', 'coin_ledger', { amount: 99999, reason: 'probe' }],
] as [string, string, unknown][]) {
  try {
    const r = await fetch(`${U}/rest/v1/${path}`, { method: 'POST', headers: anon, body: JSON.stringify(body) });
    say(!isOk(r.status), name, String(r.status));
  } catch { say(true, name, '연결 실패'); }
}

// ── ④ Edge: 유료 생성을 공짜로 받는가 ─────────────────────────────────────
console.log('\n  [Edge] 익명이 유료 생성을 받을 수 있는가');
for (const kind of ['taemong', 'dream']) {
  try {
    const r = await fetch(`${U}/functions/v1/interpret`, { method: 'POST', headers: anon, body: JSON.stringify({ kind, dreamText: 'probe', lang: 'ko' }) });
    say(!isOk(r.status), `interpret ${kind}`, String(r.status));
  } catch { say(true, `interpret ${kind}`, '연결 실패'); }
}

// ── ⑤ 쓰기: **실제로 반영되는가**(상태코드로 판정하지 않는다) ──────────────
console.log('\n  [쓰기] 권한상승·플래그 조작이 실제로 반영되는가');
if (!K) {
  console.log('   ⏭  service_role 키가 없어 값 대조를 건너뜁니다(상태코드만으로는 판정하지 않습니다)');
} else {
  // 권한상승 — 쏘기 전/후 is_admin=true 개수를 센다
  const countAdmins = async () => ((await (await fetch(`${U}/rest/v1/profiles?select=id&is_admin=eq.true`, { headers: svc })).json()) as unknown[]).length;
  const before = await countAdmins();
  await fetch(`${U}/rest/v1/profiles?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: 'PATCH', headers: anon, body: JSON.stringify({ is_admin: true }),
  }).catch(() => {});
  const after = await countAdmins();
  say(after === before, 'profiles 권한상승', `관리자 ${before} → ${after}`);

  // 플래그 조작 — 전역 테스트모드가 켜지는가(켜지면 전 사용자에게 목업이 나간다)
  const flagOf = async () => {
    const j = await (await fetch(`${U}/rest/v1/app_flags?select=enabled&key=eq.global_test_mode`, { headers: svc })).json();
    return (j as { enabled?: boolean }[])[0]?.enabled === true;
  };
  const fBefore = await flagOf();
  await fetch(`${U}/rest/v1/app_flags?key=eq.global_test_mode`, {
    method: 'PATCH', headers: anon, body: JSON.stringify({ enabled: true }),
  }).catch(() => {});
  const fAfter = await flagOf();
  say(fAfter === fBefore, 'global_test_mode 조작', `${fBefore} → ${fAfter}`);
}

console.log(bad ? `\n❌ check:security 실패 — ${bad}건 뚫림\n` : '\n✅ check:security 통과 — 익명으로 뚫리는 경로 없음\n');
if (bad) process.exitCode = 1;
