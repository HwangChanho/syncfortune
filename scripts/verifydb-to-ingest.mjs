#!/usr/bin/env node
// scripts/verifydb-to-ingest.mjs — 웹 검증(DB) 판정 → 적재 후보(ingest JSON)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29: "O 11건 골든 적재해"
//
// verify-to-ingest.mjs 의 **DB 판**이다. 판정을 마크다운이 아니라 웹 페이지(ADR-060)에서 받으므로
// 원본이 `rag_validation_items` 테이블에 있다. 안전 규칙은 **그대로 승계**한다:
//   ① `verdict='O'` 인 항목만 통과 — X·△·? 는 전부 제외하고 이유를 출력한다.
//      (검증 안 된 내 추론을 적재하면 RAG 가 그걸 근거로 되먹임해 **해자가 아니라 부채**가 된다.)
//   ② base_rate 가 '예'면 제외 — 누구에게나 참인 문장은 검색 변별력을 떨어뜨린다(코퍼스 희석).
//   ③ 통과가 0건이면 **빈 파일을 만들지 않고 실패** — 빈 적재가 --replace 와 만나면
//      기존 골든을 지우고 아무것도 안 넣는 사고가 된다.
//
// 사용:
//   node scripts/verifydb-to-ingest.mjs verify-003 --tag chart-003 > golden/ingest-003.json
//   npm run golden:ingest -- golden/ingest-003.json --replace
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const tag = args[args.indexOf('--tag') + 1];
if (!slug || !args.includes('--tag') || !tag || tag.startsWith('--')) {
  console.error('사용: node scripts/verifydb-to-ingest.mjs <slug> --tag <차트태그>');
  process.exit(1);
}

// .env 에서 접속 정보(golden-ingest.mjs 와 같은 규약)
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }),
);
const BASE = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error('❌ .env 에서 SUPABASE_URL / SERVICE_ROLE 키를 찾지 못했습니다.'); process.exit(1); }

const q = async (path) => {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) { console.error('❌ 조회 실패', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  return r.json();
};

const sets = await q(`rag_validation_sets?slug=eq.${encodeURIComponent(slug)}&select=id,title`);
if (!sets.length) { console.error(`❌ 검증 세트 '${slug}' 가 없습니다.`); process.exit(1); }
const items = await q(`rag_validation_items?set_id=eq.${sets[0].id}&select=seq,section,claim,basis,verdict,base_rate,expert_note&order=seq`);

const kept = [], dropped = [];
for (const it of items) {
  if (it.verdict !== 'O') { dropped.push(`#${it.seq} 판정 '${it.verdict ?? '미판정'}'${it.expert_note ? ` — ${it.expert_note}` : ''}`); continue; }
  if (String(it.base_rate ?? '').trim() === '예') { dropped.push(`#${it.seq} base-rate(누구에게나 참) 제외`); continue; }
  const claim = String(it.claim).replace(/\*\*/g, '').trim();
  const basis = String(it.basis ?? '').replace(/\*\*/g, '').trim();
  kept.push({
    kind: 'golden',
    content: `[${tag} 골든 · ${it.section ?? '판정'}] ${claim}${basis ? ` — 근거: ${basis}` : ''}`,
  });
}

// ③ 빈 적재 금지
if (!kept.length) {
  console.error(`❌ 적재할 O 판정이 0건입니다(총 ${items.length}건). 상담가 판정을 먼저 받으세요.`);
  if (dropped.length) console.error('   제외 사유:\n   - ' + dropped.join('\n   - '));
  process.exit(1);
}

console.error(`✅ ${sets[0].title}\n   적재 ${kept.length}건 / 전체 ${items.length}건`);
if (dropped.length) console.error('   제외:\n   - ' + dropped.join('\n   - '));
process.stdout.write(JSON.stringify({ tag, items: kept }, null, 2) + '\n');
