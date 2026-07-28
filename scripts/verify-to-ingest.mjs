#!/usr/bin/env node
// scripts/verify-to-ingest.mjs — 상담가 판정표 → 적재 후보(ingest JSON) 변환기
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "rag 강화 전략으로 전문가랑 교차검증하는거 저번에 기획해둔거 해보자"
//
// ★이 스크립트가 존재하는 이유 = **오염 방지를 사람 기억이 아니라 기계에 맡기려고.**
//   원칙(rag-expert-validation): "상담가가 O 한 판정만 코퍼스에 넣는다."
//   검증되지 않은 내 추론을 적재하면 RAG 가 그걸 근거로 되먹임해 **해자가 아니라 부채**가 된다.
//   그런데 판정표는 마크다운 표이고 항목은 수십 개다 — 손으로 옮기면 언젠가 X 가 섞여 들어간다.
//   그 사고는 조용히 일어나고(에러 없음), 한 번 들어가면 어느 항목이 오염인지 되짚기 어렵다.
//
// 동작:
//   ① verify-XXX.md 의 판정 표를 파싱( | # | 판정 | 근거 | 확신 | base-rate? | 판정 | )
//   ② **판정 칸이 정확히 'O' 인 행만** 통과. X·△·?·빈칸은 전부 제외하고 이유를 출력한다.
//   ③ base-rate='예' 인 행도 제외 — 누구에게나 참인 문장은 검색 변별력을 **떨어뜨린다**(코퍼스 희석).
//   ④ golden:ingest 가 먹는 형식으로 출력. content 는 `[<tag> 골든 · <섹션>] 판정 — 근거` 형태.
//
// 사용:
//   node scripts/verify-to-ingest.mjs golden/verify-003-claude-reading.md --tag chart-003 > golden/ingest-003.json
//   npm run golden:ingest -- golden/ingest-003.json --replace
//
// ⚠️판정이 하나도 없으면(=아직 상담가에게 안 받음) **빈 파일을 만들지 않고 실패**한다.
//   빈 적재는 --replace 와 만나면 기존 골든을 지우고 아무것도 안 넣는 사고가 된다.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const tag = args[args.indexOf('--tag') + 1];
if (!file || !args.includes('--tag') || !tag || tag.startsWith('--')) {
  console.error('사용: node scripts/verify-to-ingest.mjs <verify-XXX.md> --tag <차트태그>');
  process.exit(1);
}

const md = readFileSync(file, 'utf8');
const lines = md.split('\n');

let section = '(미분류)';
const passed = [];
const rejected = [];

for (const raw of lines) {
  const line = raw.trim();
  // 섹션 제목 추적 — content 라벨에 쓴다(검색 시 영역이 드러나야 유용하다)
  const h = line.match(/^##+\s+(?:[\d.\-b]+\.?\s*)?(.+?)\s*$/);
  if (h && !line.startsWith('###')) { section = h[1].replace(/\s*\(.*?\)\s*$/, '').trim(); continue; }

  // 판정 표 행: | # | 판정 | 근거 | 확신 | base-rate? | 판정 |
  if (!line.startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 6) continue;
  if (!/^\d+$/.test(cells[0])) continue;                       // 헤더·구분선 제외

  const [no, claim, basis, confidence, baseRate, verdict] = cells;
  const clean = (x) => x.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  if (verdict !== 'O') {
    rejected.push({ no, why: verdict === '' ? '미판정(빈칸)' : `판정 '${verdict}'` });
    continue;
  }
  if (/^예$/.test(baseRate)) {
    rejected.push({ no, why: 'base-rate(누구에게나 참) — 코퍼스 희석' });
    continue;
  }
  passed.push({
    content: `[${tag} 골든 · ${section}] ${clean(claim)} — 근거: ${clean(basis)} (상담가 확인 · Claude 확신 ${clean(confidence)})`,
  });
}

// ⚠️빈 적재 방지 — --replace 와 만나면 기존 골든만 지우는 사고가 된다
if (passed.length === 0) {
  console.error(`❌ 'O' 판정이 한 건도 없습니다(총 ${rejected.length}행 검사).`);
  console.error('   상담가 판정을 아직 안 받았거나, 판정 칸 표기가 다릅니다(정확히 대문자 O 여야 합니다).');
  for (const r of rejected.slice(0, 20)) console.error(`   · #${r.no}: ${r.why}`);
  process.exit(1);
}

// 사람이 읽을 요약은 stderr 로(stdout 은 JSON 전용 — 리다이렉트해도 깨지지 않게)
console.error(`✅ 적재 후보 ${passed.length}건 / 제외 ${rejected.length}건`);
for (const r of rejected) console.error(`   – #${r.no} 제외: ${r.why}`);

process.stdout.write(JSON.stringify({ tag, items: passed }, null, 2) + '\n');
