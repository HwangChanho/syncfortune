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
// ★문자열 조립·적재자격 규칙은 scripts/lib/golden-content.mjs 가 단일 출처다.
//   대조 하네스(check-golden-sync.mjs)와 **같은 모듈**을 써야 규칙 변경 시 오탐이 안 생긴다.
import { readFileSync } from 'node:fs';
import { goldenContent, goldenBody, ingestEligibility, tagForSlug, crossChartTemplateBodies } from './lib/golden-content.mjs';

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

// ★전(全) 세트를 읽는다 — 대상 세트만 봐서는 "이 문장이 다른 명식에도 똑같이 들어가는가"를 알 수 없다(④).
const allSets = await q(`rag_validation_sets?select=id,slug,title`);
const target = allSets.find((s) => s.slug === slug);
if (!target) { console.error(`❌ 검증 세트 '${slug}' 가 없습니다.`); process.exit(1); }
const allItems = await q(`rag_validation_items?select=set_id,seq,section,claim,basis,verdict,base_rate,expert_note&order=seq`);
const items = allItems.filter((it) => it.set_id === target.id);

// ④ 명식 무관(템플릿) 문장 = 여러 차트에 **같은 틀**로 들어가는 본문 → 코퍼스에서 제외.
//    참인 문장이어도(상담가 O) **자리가 틀렸다** — 그런 문장은 전역 규칙이지 이 명식의 골든이 아니다.
//    남겨 두면 어떤 쿼리에도 똑같이 걸려 top-3 자리만 먹고 명식 고유 근거를 밀어낸다.
//    ★2026-08-10: 판정 기준을 **문자열 완전일치 → 골격(干支·십신 마스킹) 일치**로 넓혔다.
//      상담가 `verify-000f-claim#5`(O) *"같은 격국이라도 명식마다 다른 말이 나와야 정상"* —
//      干支만 갈린 문장은 사람 눈에만 다르고 임베딩에는 코사인 0.99 인 같은 문장이었다.
const slugById = new Map(allSets.map((s) => [s.id, s.slug]));
const templateBodies = crossChartTemplateBodies(
  allItems
    .filter((it) => ingestEligibility(it, { strict: true }).ok)
    .map((it) => ({ tag: tagForSlug(slugById.get(it.set_id)), item: it }))
    .filter((x) => x.tag),                     // 규칙(stance) 세트는 애초에 코퍼스 대상이 아님
  { skeleton: true },
);

const kept = [], dropped = [];
for (const it of items) {
  const gate = ingestEligibility(it, { strict: true });  // ①O 판정만 ②base-rate ③엔진 재진술(000f#7) — 규칙은 공용 모듈
  if (!gate.ok) {
    dropped.push(`#${it.seq} ${gate.reason}${it.expert_note ? ` — ${it.expert_note}` : ''}`);
    continue;
  }
  if (templateBodies.has(goldenBody(it))) {    // ④
    dropped.push(`#${it.seq} 명식 무관(다른 차트에도 똑같이 들어가는 문장) — 규칙 후보로 분리`);
    continue;
  }
  kept.push({ kind: 'golden', content: goldenContent(tag, it) });
}

// ③ 빈 적재 금지
if (!kept.length) {
  console.error(`❌ 적재할 O 판정이 0건입니다(총 ${items.length}건). 상담가 판정을 먼저 받으세요.`);
  if (dropped.length) console.error('   제외 사유:\n   - ' + dropped.join('\n   - '));
  process.exit(1);
}

console.error(`✅ ${target.title}\n   적재 ${kept.length}건 / 전체 ${items.length}건`);
if (dropped.length) console.error('   제외:\n   - ' + dropped.join('\n   - '));
process.stdout.write(JSON.stringify({ tag, items: kept }, null, 2) + '\n');
