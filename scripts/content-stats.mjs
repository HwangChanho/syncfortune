// scripts/content-stats.mjs — 콘텐츠가 실제로 얼마나 열리고 팔리는지 (npm run stats:content)
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나(2026-08-10):
//   콘텐츠가 51종인데 **무엇이 열리는지 아무 기록도 없었다.** `app_logs` 실측 결과가
//   `app_active` 996건 · `admin_*` 4건이 전부였다 — 프로덕션에 나가도 "뭐가 팔리는지"를
//   영영 모르는 상태였고, 그래서 신규 기획을 **추측으로** 하게 됐다.
//   ⇒ `_layout.tsx` 가 `event='screen'` 으로 경로를 남기게 하고, 여기서 읽는다.
//
// ★ dev/prod 를 갈라 본다 — 내 시뮬 클릭이 실사용 통계를 오염시키면 그 숫자는 근거가 아니다.
//   (`logEvent` 가 detail.env 에 'dev'|'prod' 를 자동으로 넣는다.)
// ★ '조회'와 '결제'를 나란히 놓는다 — 많이 열리는데 안 팔리는 것과, 적게 열려도 팔리는 것은
//   완전히 다른 신호다. 하나만 보면 잘못된 기획으로 간다.
//
// 실행: npm run stats:content            (prod 만 · 기본)
//       npm run stats:content -- --all   (dev 포함)
//       npm run stats:content -- --days 7
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const ARGS = process.argv.slice(2);
const INCLUDE_DEV = ARGS.includes('--all');
const DAYS = Number(ARGS[ARGS.indexOf('--days') + 1]) || 0;

const env = Object.fromEntries(
  readFileSync(`${ROOT}.env`, 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }),
);
const BASE = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('❌ .env 에 SUPABASE 자격증명이 없습니다.'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** PostgREST 는 한 번에 1000행이 상한 — 전건이 필요하니 페이지네이션한다(자르면 통계가 거짓말이 된다). */
const all = async (path) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20_000);
    let j;
    try {
      const r = await fetch(`${BASE}/rest/v1/${path}&limit=1000&offset=${from}`, { headers: H, signal: ac.signal });
      if (!r.ok) { console.error('❌ 조회 실패', r.status, (await r.text()).slice(0, 150)); process.exit(1); }
      j = await r.json();
    } finally { clearTimeout(t); }
    out.push(...j);
    if (j.length < 1000) return out;
  }
};

/** contentSections.ts 에서 route → key 를 뽑는다(이름을 여기 또 적으면 드리프트한다 — 단일 출처에서 읽는다). */
const routeToKey = (() => {
  const src = readFileSync(`${ROOT}app/src/lib/content/contentSections.ts`, 'utf8');
  const m = new Map();
  // 한 항목 안의 key ↔ route 만 짝짓는다.
  // ⚠️처음엔 `key:...[\s\S]{0,400}?route:` 로 썼다가 **항목 경계를 넘어** 잘못 짝지었다
  //   (실측: `/reunionAsk` 가 앞 항목의 key `love` 로 붙었다). 라벨이 틀리면 통계를 오해하게 된다.
  //   → 다음 `key:` 가 나오기 전까지만 훑는다.
  for (const x of src.matchAll(/key:\s*'([^']+)'((?:(?!key:)[\s\S])*?)route:\s*'([^']+)'/g)) {
    if (!m.has(x[3])) m.set(x[3], x[1]);
  }
  return m;
})();

const since = DAYS ? new Date(Date.now() - DAYS * 864e5).toISOString() : null;
const inRange = (t) => !since || t > since;

// ── ① 화면 조회 ────────────────────────────────────────────────────────────
// ⚠️★★로거가 **같은 항목을 두 번 전송한다**(2026-08-10 실측 · 아직 미수정):
//   두 행의 `detail.at`(발생 시각)이 **완전히 동일**했다 — `logEvent` 는 한 번 불렸는데
//   큐의 같은 항목이 두 번 올라간다. `app_active` 996건도 실제로는 약 498회다.
//   ⇒ 여기서 **(at, path) 기준으로 중복을 접는다.** 안 그러면 모든 수치가 정확히 2배가 되어
//     통계가 조용히 거짓말을 한다(숫자가 나오니 맞는 줄 알게 된다).
//   ★근본 수정은 `app/src/lib/backend/logger.ts` 쪽 별건 — 고쳐지면 이 dedup 은 무해하게 남는다
//     (진짜로 같은 순간 같은 화면을 두 번 열 수는 없으므로 정상 데이터를 깎지 않는다).
const dedupe = (rows) => {
  const seen = new Set();
  return rows.filter((r) => {
    const k = `${r.detail?.at ?? r.created_at}|${r.detail?.path ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const rawLogs = (await all(`app_logs?select=detail,created_at&event=eq.screen&order=created_at.desc`))
  .filter((r) => inRange(r.created_at))
  .filter((r) => INCLUDE_DEV || r.detail?.env === 'prod');
const logs = dedupe(rawLogs);
if (rawLogs.length !== logs.length) {
  console.log(`   ℹ️ 로거 중복 ${rawLogs.length - logs.length}건 접음(원본 ${rawLogs.length} → ${logs.length}) — logger.ts 이중 전송 버그`);
}

console.log(`\n📊 콘텐츠 통계  ${DAYS ? `최근 ${DAYS}일` : '전체 기간'} · ${INCLUDE_DEV ? 'dev 포함' : 'prod 만'}\n`);

if (!logs.length) {
  console.log('   화면 조회 로그가 아직 없습니다.');
  console.log('   → `_layout.tsx` 의 screen 로깅이 들어간 빌드가 배포·사용된 뒤부터 쌓입니다.');
  console.log(`   (dev 로그까지 보려면 --all)\n`);
} else {
  const byPath = new Map();
  logs.forEach((r) => { const p = r.detail?.path; if (p) byPath.set(p, (byPath.get(p) ?? 0) + 1); });
  const rows = [...byPath.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0][1];
  console.log(`■ 화면 조회 ${logs.length}건 · 경로 ${rows.length}종`);
  rows.slice(0, 40).forEach(([p, n]) => {
    const key = routeToKey.get(p);
    console.log(`   ${p.padEnd(20)} ${String(n).padStart(5)}  ${'█'.repeat(Math.max(1, Math.round((n / max) * 30)))}${key ? `  (${key})` : ''}`);
  });
  // ★한 번도 안 열린 콘텐츠 — 이게 '무엇을 뺄까'의 근거가 된다(열리는 것만 보면 안 보인다).
  const never = [...routeToKey.entries()].filter(([r]) => !byPath.has(r));
  if (never.length) {
    console.log(`\n   ⚠️ 한 번도 안 열린 콘텐츠 ${never.length}종: ${never.map(([, k]) => k).join(', ')}`);
  }
}

// ── ② 생성된 풀이 ──────────────────────────────────────────────────────────
const reads = (await all('readings?select=category,tier,created_at')).filter((r) => inRange(r.created_at));
const cat = new Map();
reads.forEach((r) => cat.set(r.category, (cat.get(r.category) ?? 0) + 1));
console.log(`\n■ 생성된 풀이 ${reads.length}건 (상위 12)`);
[...cat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, v]) => console.log(`   ${String(k).padEnd(22)} ${v}`));

// ── ③ 결제 ─────────────────────────────────────────────────────────────────
const led = (await all('coin_ledger?select=delta,reason,kind,created_at')).filter((r) => inRange(r.created_at));
const spend = led.filter((x) => Number(x.delta) < 0);
const byKind = new Map();
spend.forEach((r) => {
  const k = r.kind ?? '(없음)';
  const cur = byKind.get(k) ?? { n: 0, sum: 0 };
  byKind.set(k, { n: cur.n + 1, sum: cur.sum + Math.abs(Number(r.delta)) });
});
console.log(`\n■ 운 지출 ${spend.length}건 — 무엇에 돈을 쓰는가`);
[...byKind.entries()].sort((a, b) => b[1].sum - a[1].sum).slice(0, 15)
  .forEach(([k, v]) => console.log(`   ${String(k).padEnd(18)} ${String(v.n).padStart(3)}회 · ${String(v.sum).padStart(5)}운`));
console.log(`   충전 ${led.filter((x) => Number(x.delta) > 0).length}건`);

console.log('\n※ 조회와 결제를 나란히 볼 것 — "많이 열리는데 안 팔린다"와 "적게 열려도 팔린다"는 완전히 다른 신호다.\n');
