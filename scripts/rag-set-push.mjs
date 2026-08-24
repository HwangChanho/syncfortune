/**
 * scripts/rag-set-push.mjs — **전문가 검수 세트를 올린다**
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 만들었나 (2026-08-24): 세트가 15개나 쌓여 있는데 **올리는 스크립트가 없었다.**
 *   그동안 매번 손으로 만들었다는 뜻이고, 다음 세션도 형식을 다시 알아내야 한다.
 *   ⇒ 원본을 `knowledge/validation-sets/<slug>.{set,items}.json` 에 두고 여기서 올린다.
 *
 * ■ 쓰는 법
 *     node scripts/rag-set-push.mjs verify-000p-compat-weights
 *
 * ■ ★두 번 눌러도 안전하다
 *   같은 slug 가 이미 있으면 **아무것도 하지 않는다.** 세트가 둘 생기면 전문가 화면에
 *   같은 질문이 두 번 뜨고, 판정이 갈려 어느 쪽이 정본인지 알 수 없게 된다.
 *
 * ■ 전문가가 보는 곳
 *   Edge `rag-review?t=<RAG_REVIEW_TOKEN>` (ADR-060). `s=` 없이 열면
 *   **남은 문항이 많은 세트가 맨 위**라, 새로 올리면 링크를 다시 보낼 필요가 없다.
 *
 * ■ 문항 형식 (기존 세트를 실측해 맞춘 것)
 *   { section, claim, basis, flag }  — `basis` 는 HTML(`<b>`·`<br>`) 을 쓴다.
 *   `seq` 는 배열 순서대로 1부터 붙는다. `base_rate` 는 '아니오' 고정, `confidence` 는 null.
 *   ★갈래는 **서로 배타적으로** 적는다 — O/X 로 답하는 화면이라, 겹치면 판정이 못 갈린다.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';

const slug = process.argv[2];
if (!slug) { console.error('사용법: node scripts/rag-set-push.mjs <slug>'); process.exit(1); }

const DIR = 'knowledge/validation-sets';
const setPath = `${DIR}/${slug}.set.json`;
const itemsPath = `${DIR}/${slug}.items.json`;
for (const p of [setPath, itemsPath]) {
  if (!fs.existsSync(p)) { console.error(`원본이 없습니다: ${p}`); process.exit(1); }
}

/** .env 파싱 — 다른 DB 스크립트와 같은 규약. */
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const BASE = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('.env 에 SUPABASE_URL · SERVICE_ROLE 키가 필요합니다'); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
// ★타임아웃을 반드시 건다 — fetch 는 기본 타임아웃이 없다(session-2026-07-31-handoff)
const q = (p, o = {}) => fetch(`${BASE}/rest/v1/${p}`, { headers: H, signal: AbortSignal.timeout(20_000), ...o });

const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
if (set.slug !== slug) { console.error(`slug 가 파일 내용과 다릅니다: ${set.slug} ≠ ${slug}`); process.exit(1); }

const ex = await (await q(`rag_validation_sets?select=id&slug=eq.${slug}`)).json();
if (ex.length) { console.log(`이미 있습니다 (${ex[0].id}) — 아무것도 하지 않았습니다.`); process.exit(0); }

const r = await q('rag_validation_sets', { method: 'POST', body: JSON.stringify({ ...set, status: 'open' }) });
if (!r.ok) { console.error('세트 생성 실패', r.status, await r.text()); process.exit(1); }
const setId = (await r.json())[0].id;

const rows = items.map((it, i) => ({
  set_id: setId, seq: i + 1, section: it.section, claim: it.claim, basis: it.basis,
  base_rate: '아니오', flag: it.flag ?? null, confidence: null,
}));
const r2 = await q('rag_validation_items', { method: 'POST', body: JSON.stringify(rows) });
if (!r2.ok) { console.error('문항 등록 실패', r2.status, await r2.text()); process.exit(1); }

console.log(`✅ ${slug} — 세트 ${setId} · 문항 ${(await r2.json()).length}건`);
console.log('   전문가 링크는 그대로 두면 됩니다 — 남은 문항이 많은 세트가 맨 위에 뜹니다(ADR-060).');
