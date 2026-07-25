#!/usr/bin/env node
// scripts/golden-status.mjs — 골든 RAG 코퍼스 현황(knowledge_vectors) 조회. daniel 2026-07-25 축적 워크플로.
// ─────────────────────────────────────────────────────────────────────────
// 사용: npm run golden:status   (= node scripts/golden-status.mjs)
// 루트 .env 의 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 로 PostgREST 조회(service_role=RLS 우회).
//   ⚠️ Supabase 조회만 — Anthropic/LLM API 무관(ABSOLUTE-0 무관). 읽기 전용(안전).
// 목적: "코퍼스가 얼마나·무엇으로 쌓였나"를 한눈에 → 축적 진척·다양성 점검(동질 코퍼스는 검색 변별력↓).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

// 루트 .env 파싱(의존성 없이) — KEY=VALUE 라인만.
function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch { /* .env 없음 → 아래 가드에서 안내 */ }
  return env;
}

const env = loadEnv();
const BASE = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error('❌ 루트 .env 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const res = await fetch(`${BASE}/rest/v1/knowledge_vectors?select=content,embedding,updated_at&kind=eq.golden`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!res.ok) {
  console.error('❌ 조회 실패', res.status, (await res.text()).slice(0, 200));
  process.exit(1);
}
const rows = await res.json();

// 태그(차트)별 집계 — content 접두 `[<tag> 골든 · <영역>]` 파싱.
const byTag = new Map();
let noEmbed = 0;
for (const r of rows) {
  if (r.embedding == null) noEmbed++;
  const m = String(r.content || '').match(/^\[\s*(.+?)\s+골든\s*·\s*(.*?)\s*\]/);
  const tag = m ? m[1].trim() : '(태그 규격 밖)';
  const area = m ? m[2].trim() : '';
  if (!byTag.has(tag)) byTag.set(tag, { count: 0, areas: new Set(), latest: '' });
  const e = byTag.get(tag);
  e.count++;
  if (area) e.areas.add(area);
  if ((r.updated_at || '') > e.latest) e.latest = r.updated_at || '';
}

console.log(`\n📚 골든 RAG 코퍼스 현황  (knowledge_vectors · kind=golden)`);
console.log(`   총 ${rows.length} 벡터 · ${byTag.size} 엔트리(태그)${noEmbed ? ` · ⚠️ 임베딩 없음 ${noEmbed}개(검색 제외)` : ''}\n`);
for (const [tag, e] of [...byTag].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`   • ${tag.padEnd(14)} ${String(e.count).padStart(2)} 영역   (최근 ${String(e.latest).slice(0, 10) || '-'})`);
}
console.log('');
if (byTag.size <= 1) {
  console.log('   ⚠️ 태그(차트)가 1개뿐 — 동질 코퍼스라 검색 변별력이 낮습니다(임베딩이 좁은 cone).');
  console.log('      다른 사람의 골든 엔트리(다양한 차트)를 여러 개 쌓을수록 RAG가 실제로 힘을 냅니다.\n');
}
console.log('   ▶ 적재:  npm run golden:ingest -- golden/ingest-XXX.json --replace');
console.log('   ▶ 템플릿: golden/ingest-TEMPLATE.json · golden/entry-TEMPLATE.md · 절차 golden/WORKFLOW.md\n');
