#!/usr/bin/env node
// scripts/golden-ingest.mjs — 골든 엔트리 → RAG 코퍼스(knowledge_vectors) 적재. daniel 2026-07-25 축적 워크플로.
// ─────────────────────────────────────────────────────────────────────────
// 사용: npm run golden:ingest -- golden/ingest-XXX.json [--replace] [--dry-run]
//   파일 = { "tag": "<차트이름>", "items": [ { "content": "[<tag> 골든 · <영역>] ..." }, ... ] }
//   --replace : 같은 tag 의 기존 골든을 먼저 삭제(★멱등 — 같은 엔트리를 몇 번 재적재해도 코퍼스가 중복으로 안 늚).
//   --dry-run : 검증·미리보기만(쓰기 0).
//
// 적재 경로(둘 다 Supabase 만 — Anthropic/LLM 무관·ABSOLUTE-0 무관):
//   ① --replace 삭제 = PostgREST DELETE(service_role=RLS 우회, content 접두 `[<tag> 골든 ·` 매칭)
//   ② 임베딩 + 삽입   = ingest-golden Edge(Supabase 내장 gte-small 384차원). 파일 items 를 그대로 POST.
// ★멱등의 핵심 = 모든 item content 가 `[<tag> 골든 · ...]` 로 시작해야 삭제가 정확히 덮는다(아래서 검증·경고).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch { /* noop */ }
  return env;
}

// ── 인자 파싱 ──
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const replace = args.includes('--replace');
const dryRun = args.includes('--dry-run');
if (!file) {
  console.error('사용: node scripts/golden-ingest.mjs <ingest-XXX.json> [--replace] [--dry-run]');
  process.exit(1);
}

const env = loadEnv();
const BASE = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('❌ 루트 .env 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }

// ── 파일 로드·검증 ──
let doc;
try { doc = JSON.parse(readFileSync(file, 'utf8')); }
catch (e) { console.error(`❌ ${file} 읽기/파싱 실패:`, e.message); process.exit(1); }

const tag = String(doc.tag || '').trim();
const items = Array.isArray(doc.items) ? doc.items : [];
if (!items.length) { console.error('❌ items 가 비었습니다'); process.exit(1); }
if (!tag) { console.error('❌ tag(차트 이름) 가 필요합니다 — 멱등 삭제·현황 집계 기준'); process.exit(1); }

const prefix = `[${tag} 골든 ·`;
const bad = items.filter((it) => !String(it?.content || '').trim().startsWith(prefix));
const empty = items.filter((it) => !String(it?.content || '').trim());
console.log(`\n📥 골든 적재  tag="${tag}"  items=${items.length}  ${replace ? '(replace=멱등)' : '(append)'}${dryRun ? '  [DRY-RUN]' : ''}`);
if (empty.length) { console.error(`❌ 빈 content ${empty.length}개 — 제거 후 재시도`); process.exit(1); }
if (bad.length) {
  console.error(`⚠️  content 접두가 "${prefix} …]" 가 아닌 항목 ${bad.length}개:`);
  bad.slice(0, 5).forEach((it) => console.error(`     · ${String(it.content).slice(0, 60)}…`));
  console.error(`   → --replace 삭제가 이들을 못 덮어 '고아(orphan)'가 생깁니다. 접두를 "[${tag} 골든 · <영역>]" 로 맞추세요.`);
  if (replace && !dryRun) { console.error('   (--replace 인데 규격 밖 항목이 있어 중단. --dry-run 으로 먼저 점검하세요.)'); process.exit(1); }
}

// ── 현재 이 tag 로 몇 개 적재돼 있나(삭제 대상 미리보기) ──
const likePat = encodeURIComponent(prefix) + '*'; // PostgREST like: * = 와일드카드
const cntRes = await fetch(`${BASE}/rest/v1/knowledge_vectors?kind=eq.golden&content=like.${likePat}&select=content`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
const existing = cntRes.ok ? (await cntRes.json()).length : 0;
console.log(`   기존 "${tag}" 골든 = ${existing}개${replace ? ` → 삭제 후 ${items.length}개로 교체` : ` (+${items.length} append → 중복 주의)`}`);

if (dryRun) {
  console.log('\n   [DRY-RUN] 쓰기 없음. 영역 미리보기:');
  items.forEach((it) => {
    const m = String(it.content).match(/^\[[^·]*·\s*(.*?)\s*\]/);
    console.log(`     · ${(m ? m[1] : '?').padEnd(12)} ${String(it.content).slice(0, 50)}…`);
  });
  console.log('\n   실제 적재: 위 명령에서 --dry-run 을 빼고 실행\n');
  process.exit(0);
}

// ── ① replace 삭제(PostgREST·service_role) ──
let deleted = 0;
if (replace) {
  const del = await fetch(`${BASE}/rest/v1/knowledge_vectors?kind=eq.golden&content=like.${likePat}`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'return=representation' },
  });
  if (!del.ok) { console.error('❌ 기존 삭제 실패', del.status, (await del.text()).slice(0, 200)); process.exit(1); }
  deleted = (await del.json()).length;
  console.log(`   🗑  삭제 ${deleted}개`);
}

// ── ② 임베딩 + 삽입(ingest-golden Edge·Supabase 내장 gte-small) ──
const post = await fetch(`${BASE}/functions/v1/ingest-golden`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: items.map((it) => ({ content: it.content, kind: it.kind || 'golden' })) }),
});
if (!post.ok) { console.error('❌ ingest-golden 실패', post.status, (await post.text()).slice(0, 300)); process.exit(1); }
const r = await post.json();
console.log(`   ✅ 적재 ok=${r.ok} failed=${r.failed}${r.noEmbed ? ` noEmbed=${r.noEmbed}(임베딩 실패=검색 제외)` : ''}\n`);
if (r.failed) process.exit(1);
console.log('   현황 확인: npm run golden:status\n');
