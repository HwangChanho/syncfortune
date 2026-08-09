#!/usr/bin/env node
// scripts/check-golden-sync.mjs — 전문가 판정(DB) ↔ 골든 코퍼스(knowledge_vectors) **대조 하네스**.
// ─────────────────────────────────────────────────────────────────────────
// 왜 만들었나(2026-07-31 · 실제로 당한 사고):
//   07-31 인계 메모에 "O 판정 **34건 적재 대기**"라고 적혀 있었지만 실측하니 **12건**이었다.
//   원인 = `rag_validation_items.promoted` 플래그를 **아무도 안 찍었다.** 적재는 되는데 플래그는
//   그대로라 진행률 뷰(`rag_validation_progress.promotable`)가 이미 적재된 22건까지 대기로 셌다.
//   ⇒ 이 하네스는 **플래그를 믿지 않는다.** 판정(DB)에서 기대 문자열을 만들고 코퍼스와 직접 맞춘다.
//      플래그가 썩어도 숫자는 항상 맞는다.
//
// 잡는 결함 2종:
//   ① 미적재(PENDING) — O 판정인데 코퍼스에 없다. (= 해자가 안 쌓임)
//   ② 고아(ORPHAN)   — 코퍼스에 있는데 지금 O 판정이 아니다.
//      ★이게 더 위험하다. daniel 이 O→X 로 판정을 **번복**하거나 문구를 고치면, 이미 적재된
//        옛 문장이 RAG 에 영원히 남아 통변 근거로 되먹임된다(= 코퍼스 오염 · CLAUDE.md §3.2).
//
// 사용:
//   npm run check:goldensync           대조·리포트만(쓰기 0). 드리프트 있으면 exit 1.
//   npm run check:goldensync -- --sync `promoted` 플래그를 실측 코퍼스 상태로 맞춘다(웹 진행률 정상화).
//
// ⚠️ Supabase 조회/갱신만 — Anthropic/LLM API 무관(ABSOLUTE-0 무관).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { goldenContent, goldenBody, ingestEligibility, tagForSlug, crossChartTemplateBodies } from './lib/golden-content.mjs';

const SYNC = process.argv.includes('--sync');

// ── 접속 정보(다른 golden 스크립트와 같은 규약: 루트 .env) ──
function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch { /* 없으면 아래 가드 */ }
  return env;
}
const env = loadEnv();
const BASE = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('❌ 루트 .env 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요'); process.exit(1); }

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const get = async (path) => {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers });
  if (!r.ok) { console.error('❌ 조회 실패', path, r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  return r.json();
};

// ── 원본 3종 ──
const sets = await get('rag_validation_sets?select=id,slug,title&order=slug');
const items = await get('rag_validation_items?select=id,set_id,seq,section,claim,basis,verdict,base_rate,promoted&order=seq');
const corpus = await get('knowledge_vectors?select=content&kind=eq.golden');

// 코퍼스를 태그별로 쪼갠다 — 접두 `[<tag> 골든 ·` 파싱(golden-status.mjs 와 동일 규약).
const corpusByTag = new Map();
for (const r of corpus) {
  const content = String(r.content ?? '');
  const m = content.match(/^\[\s*(.+?)\s+골든\s*·/);
  const tag = m ? m[1].trim() : '(태그 규격 밖)';
  if (!corpusByTag.has(tag)) corpusByTag.set(tag, new Set());
  corpusByTag.get(tag).add(content);
}

// 세트별 항목 묶기
const itemsBySet = new Map();
for (const it of items) {
  if (!itemsBySet.has(it.set_id)) itemsBySet.set(it.set_id, []);
  itemsBySet.get(it.set_id).push(it);
}

// 명식 무관(템플릿) 문장 — 적재본 생성기와 **같은 규칙**으로 계산해야 기대값이 어긋나지 않는다.
const slugById = new Map(sets.map((s) => [s.id, s.slug]));
const templateBodies = crossChartTemplateBodies(
  items
    .filter((it) => ingestEligibility(it).ok)
    .map((it) => ({ tag: tagForSlug(slugById.get(it.set_id)), item: it }))
    .filter((x) => x.tag),
);

console.log('\n🔎 골든 동기화 대조  (전문가 판정 DB ↔ RAG 코퍼스)\n');

let pendingTotal = 0, orphanTotal = 0, unjudgedTotal = 0;
const promoteTrue = [], promoteFalse = [];   // --sync 대상
const dbTags = new Set();

for (const s of sets) {
  const own = itemsBySet.get(s.id) ?? [];
  const tag = tagForSlug(s.slug);
  const unjudged = own.filter((it) => !it.verdict).length;
  unjudgedTotal += unjudged;

  // 규칙(stance) 세트 — 특정 명식의 골든이 아니라 전역 규칙 재료라 코퍼스 대조 대상이 아니다.
  if (!tag) {
    const ok = own.filter((it) => it.verdict === 'O').length;
    console.log(`   · ${s.slug.padEnd(22)} [규칙 세트] O ${ok} / 전체 ${own.length}${unjudged ? ` · 미판정 ${unjudged}` : ''}`);
    console.log(`     └ 코퍼스 대조 안 함 — 규칙 승격 대상(knowledge/rules)`);
    continue;
  }
  dbTags.add(tag);

  // 기대(expected) = 적재 자격을 통과하고 **명식 무관 템플릿이 아닌** 판정들의 content 집합
  const expected = new Map();  // content → item
  for (const it of own) {
    if (!ingestEligibility(it).ok) continue;
    if (templateBodies.has(goldenBody(it))) continue;   // 여러 차트에 똑같이 들어가는 문장 = 이 명식의 골든 아님
    expected.set(goldenContent(tag, it), it);
  }
  const actual = corpusByTag.get(tag) ?? new Set();

  const pending = [...expected].filter(([c]) => !actual.has(c));
  const orphan = [...actual].filter((c) => !expected.has(c));
  pendingTotal += pending.length;
  orphanTotal += orphan.length;

  // 플래그 동기화 대상 수집 — 코퍼스에 실제로 있는 것만 promoted=true
  for (const it of own) {
    const should = ingestEligibility(it).ok && actual.has(goldenContent(tag, it));
    if (should && !it.promoted) promoteTrue.push(it.id);
    if (!should && it.promoted) promoteFalse.push(it.id);
  }

  const mark = pending.length || orphan.length ? '⚠️ ' : '✅ ';
  console.log(`   ${mark}${s.slug.padEnd(20)} → ${tag.padEnd(11)} 적재 ${actual.size} / 기대 ${expected.size}${unjudged ? ` · 미판정 ${unjudged}` : ''}`);
  for (const [c, it] of pending) console.log(`     ▸ 미적재 #${it.seq} ${c.slice(0, 84)}…`);
  for (const c of orphan) console.log(`     ▸ 고아   ${c.slice(0, 84)}…`);
}

// DB 세트에서 안 나온 코퍼스 태그 = 수기 엔트리(golden/entry-XXX.md 경로). 고아가 아니라 정상.
const manual = [...corpusByTag.keys()].filter((t) => !dbTags.has(t));
if (manual.length) {
  console.log('');
  for (const t of manual) console.log(`   · ${t.padEnd(22)} ${corpusByTag.get(t).size}건 — 수기 엔트리(DB 판정 밖 · 대조 제외)`);
}

// ── 코퍼스 검색 변별력(RPC golden_corpus_quality) ──
//    벡터 **수**만 세면 ADR-060 의 목적(동질 코퍼스 탈출) 달성 여부를 알 수 없다.
//    다른 차트끼리 코사인이 0.97 을 넘으면 아무리 넣어도 검색이 안 갈린다 = 문장 설계 문제(수량 문제 아님).
try {
  const r = await fetch(`${BASE}/rest/v1/rpc/golden_corpus_quality`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (r.ok) {
    const q = await r.json();
    console.log(`\n   ── 검색 변별력 ──`);
    console.log(`   벡터 ${q.total_vectors} · 태그 ${q.tags} · 다른 차트와 코사인 ≥0.97 인 벡터 ${q.near_dupe_097}건(≥0.95 ${q.near_dupe_095}건)`);
    console.log(`   top-3 검색 결과 중 다른 차트에서 오는 비율 ${q.top3_cross_pct}%`);
    if (q.exact_dupe_groups > 0) {
      console.log(`   ⚠️ **완전중복** ${q.exact_dupe_groups}종 / ${q.exact_dupe_vectors}벡터 — 태그만 다르고 본문이 같습니다.`);
      for (const d of q.exact_dupes ?? []) console.log(`      · [${d.tags}] ${d.body.slice(0, 70)}…`);
      console.log(`      → 여러 명식에 똑같이 들어가는 문장은 그 명식의 골든이 아닙니다(전역 규칙 자리).`);
      console.log(`        해당 태그를 재적재하면 자동 제외됩니다(생성기 ④ 게이트).`);
    }
    if (q.near_dupe_097 > q.total_vectors * 0.2) {
      console.log(`   ⚠️ 준중복 비율이 높습니다 — 검증 세트의 claim 이 **템플릿**이라 干支만 갈리고 문장이 같다는 뜻입니다.`);
      console.log(`      벡터를 더 넣어도 변별력은 안 오릅니다. 다음 세트의 문항을 명식 고유 서술로 바꾸세요.`);
    }
  }
} catch { /* 품질 측정 실패는 대조 결과를 막지 않는다(부가 정보) */ }

// ── 신(新) 적재 규칙으로 보면 몇 건이 부적격인가 (2026-08-10 · 정보 출력 전용) ──
//    상담가 `verify-000f-claim` 판정으로 신규 적재 게이트가 둘 늘었다(#7 엔진 재진술 · #5 골격 중복).
//    ⚠️ **기존 적재분을 지우지 않는다** — 같은 세트 `#8`(O) *"이미 쌓인 골든은 그대로 둬도 된다"*.
//    그래서 대조(위)는 옛 규칙 그대로 두고, 여기서는 **앞으로 무엇이 걸리는지만** 보여 준다.
//    이 숫자가 코퍼스 품질의 상한을 말해 준다 — 재적재하면 이만큼 빠진다.
{
  const eligibleNow = items.filter((it) => ingestEligibility(it).ok && tagForSlug(slugById.get(it.set_id)));
  const skelTemplates = crossChartTemplateBodies(
    eligibleNow.map((it) => ({ tag: tagForSlug(slugById.get(it.set_id)), item: it })),
    { skeleton: true },
  );
  const restated = eligibleNow.filter((it) => !ingestEligibility(it, { strict: true }).ok);
  const skelDupe = eligibleNow.filter((it) => skelTemplates.has(goldenBody(it)));
  const both = new Set([...restated, ...skelDupe]);
  if (both.size) {
    console.log(`\n   ── 새 적재 규칙 기준(정보) ──`);
    console.log(`   현행 적재분 ${eligibleNow.length}건 중 **${both.size}건**이 새 규칙에서는 부적격입니다`
      + ` (엔진 재진술 ${restated.length} · 골격 중복 ${skelDupe.length}, 중복 포함).`);
    console.log(`   → 지우지 않습니다(상담가 000f#8 "섞어도 된다"). **다음 세트부터** 명식 고유 서술로 씁니다.`);
  }
}

// ── 플래그 동기화 ──
if (SYNC && (promoteTrue.length || promoteFalse.length)) {
  const patch = async (ids, value) => {
    if (!ids.length) return;
    const r = await fetch(`${BASE}/rest/v1/rag_validation_items?id=in.(${ids.join(',')})`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ promoted: value }),
    });
    if (!r.ok) { console.error('❌ promoted 갱신 실패', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  };
  await patch(promoteTrue, true);
  await patch(promoteFalse, false);
  console.log(`\n   🔧 promoted 플래그 동기화: true ${promoteTrue.length}건 · false ${promoteFalse.length}건`);
} else if (promoteTrue.length || promoteFalse.length) {
  console.log(`\n   ℹ️  promoted 플래그가 실측과 다름(true로 바꿀 것 ${promoteTrue.length} · false로 ${promoteFalse.length})`);
  console.log(`      웹 진행률(rag_validation_progress.promotable)이 틀리게 보입니다 → npm run check:goldensync -- --sync`);
}

// ── 요약·판정 ──
console.log(`\n   ── 요약 ──`);
console.log(`   미적재(PENDING) ${pendingTotal}건 · 고아(ORPHAN) ${orphanTotal}건 · 미판정(전문가 대기) ${unjudgedTotal}건`);
if (orphanTotal) {
  console.log(`   ⚠️ 고아 = 지금 기준으로는 적재되면 안 되는 문장이 코퍼스에 남아 있다는 뜻(RAG 오염).`);
  console.log(`      원인은 셋 중 하나 — ①판정 O→X 번복 ②claim 문구 수정 ③명식 무관(템플릿) 문장 게이트에 걸림.`);
  console.log(`      해당 세트를 재적재하세요: node scripts/verifydb-to-ingest.mjs <slug> --tag <tag> > golden/ingest-XXX.json`);
  console.log(`                              npm run golden:ingest -- golden/ingest-XXX.json --replace`);
}
if (pendingTotal) console.log(`   ▶ 미적재 해소도 위와 같은 재적재 절차(--replace 는 멱등).`);
if (!pendingTotal && !orphanTotal) console.log(`   ✅ 판정과 코퍼스가 정확히 일치합니다.`);
console.log('');

process.exit(pendingTotal || orphanTotal ? 1 : 0);
