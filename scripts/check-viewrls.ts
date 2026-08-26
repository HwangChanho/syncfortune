// scripts/check-viewrls.ts — ⚠️**뷰가 RLS 를 우회하지 않는가**
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-27 실측으로 잡은 사고. 사람 방(0050)을 붙이며 «뷰가 RLS 를 타는가» 를 확인하다 걸렸다.
//
// ■ 무슨 일이 있었나
//   `talk_session_list` 뷰에 **`security_invoker` 가 없었다.**
//   뷰는 소유자(`postgres`) 권한으로 돌고, `postgres` 는 `rolbypassrls = true` 다 ⇒ **RLS 통과.**
//   로그인조차 안 한 `anon` 키로 **15행 · 주인 5명 · `preview` 본문까지** 읽혔다.
//   같은 키로 표를 직접 부르면 `[]` 였다 — **표는 멀쩡했고 뷰만 샜다.**
//
// ■ ★★왜 여태 몰랐나 — 이 검사가 존재하는 진짜 이유
//   앱은 늘 **로그인한 상태로** 이 뷰를 읽었고, 화면에는 자기 대화만 보였다.
//   목록을 `owner_id` 로 거르지 않아도 **«자기 것만 있는 것처럼» 보인다.**
//   ⇒ **화면이 맞아 보이는 것은 권한이 맞다는 증거가 아니다.**
//     권한은 «남의 키로 불러 보는 것» 으로만 확인된다.
//
// ■ 재는 것
//   V1  `public` 의 모든 뷰가 `security_invoker = on` 인가
//   V2  ★**실제로 anon 키로 불러 본다** — 정의를 읽는 것으로 끝내지 않는다
//       (정의가 옳아도 권한이 남아 있으면 새고, 그 반대도 있다)
//
// ⚠️환경변수가 없으면 **건너뛴다**(빨간불로 만들지 않는다) — CI 없이 도는 저장소다.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;

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

let fail = 0;
const say = (c: boolean, m: string, d = '') => {
  if (!c) fail++;
  console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(46)} ${d}`);
};

console.log('\n🔐 check:viewrls — 뷰가 RLS 를 우회하지 않는가\n');

const url = envOf('SUPABASE_URL') ?? envOf('EXPO_PUBLIC_SUPABASE_URL');
const anon = envOf('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? envOf('SUPABASE_ANON_KEY');
let mgmt: string | null = null;
try { mgmt = readFileSync(`${homedir()}/.supabase/access-token`, 'utf8').trim(); } catch { /* 없으면 정의 검사 생략 */ }
const ref = url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;

if (!url || !anon) {
  console.log('  ⏭  건너뜀 — .env 에 SUPABASE_URL / ANON_KEY 가 없습니다\n');
  process.exit(0);
}

// ── V1 정의: security_invoker 가 켜져 있는가 ───────────────────────────────
let views: { relname: string; opts: string | null }[] = [];
if (mgmt && ref) {
  const sql = `select c.relname, array_to_string(c.reloptions, ',') as opts
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v','m') order by c.relname`;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgmt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  }).catch(() => null);
  const rows = await res?.json().catch(() => null);
  if (Array.isArray(rows)) {
    views = rows as typeof views;
    const bad = views.filter((v) => !String(v.opts ?? '').includes('security_invoker'));
    say(bad.length === 0, 'V1 모든 뷰가 security_invoker',
      bad.length ? `${bad.map((v) => v.relname).join(', ')} — 소유자(postgres)는 rolbypassrls 라 **RLS 를 통과한다**`
        : `뷰 ${views.length}개`);
  } else {
    console.log('  ⏭  V1 건너뜀 — 관리 API 조회 실패');
  }
} else {
  console.log('  ⏭  V1 건너뜀 — ~/.supabase/access-token 없음');
}

// ── V2 ★실제로 불러 본다 — 정의만 믿지 않는다 ──────────────────────────────
{
  const names = views.length ? views.map((v) => v.relname) : ['talk_session_list', 'coin_balance', 'rag_validation_progress'];
  const leaked: string[] = [];
  for (const v of names) {
    const r = await fetch(`${url}/rest/v1/${v}?select=*&limit=3`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    }).catch(() => null);
    if (!r) continue;
    const body = await r.json().catch(() => null);
    // ★행이 **하나라도** 돌아오면 로그인 없이 읽힌 것이다.
    //   빈 배열(`[]`)·403·404 는 정상(권한이 없거나 내 것이 없다).
    if (Array.isArray(body) && body.length > 0) leaked.push(`${v}(${body.length}행)`);
  }
  say(leaked.length === 0, 'V2 ★anon 키로 실제 조회 — 새는 뷰 없음',
    leaked.length ? `${leaked.join(', ')} — **로그인 없이 남의 데이터가 읽힌다**` : `뷰 ${names.length}개 전부 차단`);
}

console.log(fail === 0 ? '\n✅ 뷰가 부르는 사람의 권한으로 돕니다\n'
  : `\n❌ ${fail}건 — 뷰로 RLS 가 우회됩니다\n`);
process.exit(fail === 0 ? 0 : 1);
