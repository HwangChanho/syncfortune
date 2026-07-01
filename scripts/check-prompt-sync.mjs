#!/usr/bin/env node
// scripts/check-prompt-sync.mjs — 배포 전 프리플라이트: 명리 규칙 단일출처 동기화 검증
// ─────────────────────────────────────────────────────────────────────────
// 배경(왜 필요한가):
//   · interpretation/prompts/myeongri-core.ts = 최신 canonical SSoT(R1~R34, daniel 검수).
//   · supabase/functions/_shared/prompts.ts   = Deno Edge 배포 소스. Deno 의 .ts import 규칙
//     때문에 interpretation/ 을 직접 import 못 해 MYEONGRI_RULES 를 *복사*해 들고 있다.
//   · SSoT 를 갱신하고 이 복사본 동기화를 빠뜨리면, 배포된 통변이 *옛 규칙*으로 나간다.
//     (2026-07-01 실제 사고: 06-30 R16 습토 본기우선 갱신이 배포본에 반영 안 된 채 라이브.)
//   → 이 스크립트가 두 복사본의 MYEONGRI_RULES 를 대조해 그 drift 를 *배포 전에* 잡는다.
//
// 사용:
//   node scripts/check-prompt-sync.mjs        # 검증만(불일치 시 exit 1) — 배포 전 실행 권장
//   node scripts/check-prompt-sync.mjs --fix  # SSoT → 배포본으로 MYEONGRI_RULES 동기화
//
// ⚠️ 범위: 이 하네스는 **MYEONGRI_RULES 블록만** 본다(myeongri-core = 명확한 단일출처).
//   SAJU_READING_SYSTEM 등 reading-system.ts 와 공유되는 다른 상수는 *역방향 drift*(배포본이
//   더 최신인 경우)가 있어 여기서 다루지 않는다 — 그건 daniel 이 canonical 을 정한 뒤 별도 정리.
import { readFileSync, writeFileSync } from 'node:fs';

const SSOT = 'interpretation/prompts/myeongri-core.ts';   // 단일출처(canonical)
const DEPLOY = 'supabase/functions/_shared/prompts.ts';   // 배포 복사본
const RE = /export const MYEONGRI_RULES = `([\s\S]*?)`;/;  // 템플릿 리터럴 본문 추출(파일당 1개)

// MYEONGRI_RULES 템플릿 리터럴 본문을 통째로 뽑는다.
function body(path) {
  const m = readFileSync(path, 'utf8').match(RE);
  if (!m) { console.error(`✖ ${path} 에서 MYEONGRI_RULES 를 찾지 못함`); process.exit(2); }
  return m[1];
}

const ssot = body(SSOT);
const deploy = body(DEPLOY);

if (ssot === deploy) {
  console.log('✅ MYEONGRI_RULES 동기화됨 — SSoT 와 배포본 일치.');
  process.exit(0);
}

// 불일치 → 어느 규칙(R#)이 어긋났는지 리포트(- R# 로 시작하는 줄 기준 분할).
const split = (b) => {
  const map = {}; let cur = null, buf = [];
  for (const line of b.split('\n')) {
    const mm = line.match(/^- (R\d+) /);
    if (mm) { if (cur) map[cur] = buf.join('\n'); cur = mm[1]; buf = [line]; }
    else if (cur) buf.push(line);
  }
  if (cur) map[cur] = buf.join('\n');
  return map;
};
const a = split(ssot), c = split(deploy);
const keys = [...new Set([...Object.keys(a), ...Object.keys(c)])].sort((x, y) => +x.slice(1) - +y.slice(1));
const diff = keys.filter((k) => a[k] !== c[k]);
console.error(`✖ MYEONGRI_RULES drift — 불일치 규칙: ${diff.join(', ') || '(헤더/기타 영역)'}`);

// --fix: SSoT 본문으로 배포본의 MYEONGRI_RULES 블록만 덮어쓴다(다른 상수는 불변).
//   교체값을 함수로 넘겨 $ 특수치환을 회피(본문에 $ 가 있어도 안전).
if (process.argv.includes('--fix')) {
  const fixed = readFileSync(DEPLOY, 'utf8').replace(RE, () => 'export const MYEONGRI_RULES = `' + ssot + '`;');
  writeFileSync(DEPLOY, fixed);
  console.log(`↻ ${DEPLOY} 의 MYEONGRI_RULES 를 SSoT 로 동기화함 — 재실행해 확인 후 배포하세요.`);
  process.exit(0);
}
console.error('  → 고치려면: node scripts/check-prompt-sync.mjs --fix  (그 후 재배포)');
process.exit(1);
