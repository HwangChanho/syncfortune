#!/usr/bin/env node
// scripts/check-engine-copy.mjs — canonical(interpretation/engine) ↔ Edge 복사본(supabase/functions/_shared) 동일성 하네스
// ─────────────────────────────────────────────────────────────────────────
// ★왜 만들었나(2026-07-16 실제 사고):
//   앱 온디바이스 용신이 daniel 辛丑에 **水**를 내고 있었다. canonical(골든 검증)은 **土(병약)**, 전문가 재판정도
//   "용신=정인(土) 고정 · 구 水동태 폐기"였는데 **앱만 폐기값을 노출**했다. 원인 = 명리 검수(07-14)가 canonical·Edge
//   에만 반영되고 앱 구현은 뒤처진 것. 사람이 여러 벌을 손으로 맞추는 한 이 사고는 반복된다 → 기계가 잡는다.
//   (앱은 그 뒤 canonical 직접 import 로 바꿔 드리프트가 구조적으로 불가능해졌다. **남은 위험 = Edge(Deno) 복사본**
//    — Deno 는 확장자 붙은 상대 import 라 canonical 을 그대로 못 쓰고 복사본을 유지해야 한다.)
//
// 비교 규칙: import/re-export 줄과 주석을 걷어낸 **코드 본문**이 완전히 같아야 한다.
//   Deno 차이(`./x.ts` vs `./x`)는 import 줄이라 자동 무시된다. 주석·빈 줄 차이는 로직이 아니므로 통과시킨다.
// 실패 시: canonical 을 정본으로 보고 Edge 복사본을 맞춰라(반대 아님 — 골든이 canonical 을 검증한다).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CANON_DIR = 'interpretation/engine';
const EDGE_DIR = 'supabase/functions/_shared';

/** 코드 본문만 남긴다 — import/re-export 줄 제거 + 주석 제거 + 빈 줄 제거. */
function normalize(src) {
  return src
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '')) // 줄 끝 주석(인라인 포함)
    .filter((l) => !/^\s*import\s/.test(l)) // `import ...` 시작 줄
    .filter((l) => !/^\s*export\s.*\sfrom\s+['"]/.test(l)) // re-export(`export { x } from '...'`) — ★`export function` 은 코드라 남긴다
    .filter((l) => !/^\s*\}\s*from\s+['"]/.test(l)) // ★멀티라인 import 의 닫는 줄(`} from "./x"`) — Deno 는 여기만 '.ts' 가 붙는다
    .filter((l) => !/^\s*(export\s+)?type\s+Branch\s*=/.test(l)) // Branch 타입 선언줄(정본=@spec import / Edge·앱코어=인라인 — 로직 아님·동등)
    .filter((l) => !/^\s*(\/\*|\*|\*\/)/.test(l)) // 블록 주석 본문
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
    .join('\n');
}

// canonical 에 있고 Edge 에도 같은 이름이 있는 파일 = 복사본 쌍(.validate/.goldenset/.audit 는 검증 스크립트라 제외)
const dirPairs = readdirSync(CANON_DIR)
  .filter((f) => f.endsWith('.ts') && !/\.(validate|goldenset|audit|test)\.ts$/.test(f))
  .filter((f) => existsSync(join(EDGE_DIR, f)))
  .map((f) => ({ label: f, aPath: join(CANON_DIR, f), bPath: join(EDGE_DIR, f) }));

// canonical 이 interpretation/engine 밖(앱)에 있는 복사본 쌍 — 명시 경로. 정본=앱(그쪽 골든이 검증).
//   R-SPOUSE-DUAL 순수 코어: app/src/lib/love/spouseDualCore.ts(check:spouse-dual 골든이 辛丑 §3.2 라벨로 검증) ↔ Edge 복사본.
//   Deno 가 app/·@spec 을 import 못 해 복사본을 둔다 → 이 쌍이 유료 재회 세운 라벨과 무료(앱) 라벨의 드리프트를 막는다.
const EXTRA_PAIRS = [
  { label: 'spouseDualCore.ts', aPath: 'app/src/lib/love/spouseDualCore.ts', bPath: join(EDGE_DIR, 'spouseDualCore.ts') },
];
const entries = [...dirPairs, ...EXTRA_PAIRS.filter((p) => existsSync(p.aPath) && existsSync(p.bPath))];

console.log('\n🔎 엔진 복사본 동일성(check-engine-copy) — canonical ↔ Edge\n');
if (!entries.length) {
  console.log('   대조할 복사본 쌍 없음 — 스킵.');
  process.exit(0);
}

let bad = 0;
for (const { label, aPath, bPath } of entries) {
  const a = normalize(readFileSync(aPath, 'utf8'));
  const b = normalize(readFileSync(bPath, 'utf8'));
  if (a === b) {
    console.log(`   ✅ ${label}`);
    continue;
  }
  bad++;
  // 첫 불일치 줄을 짚어 준다(어디서 갈렸는지 바로 보이게)
  const la = a.split('\n');
  const lb = b.split('\n');
  let i = 0;
  while (i < Math.min(la.length, lb.length) && la[i] === lb[i]) i++;
  console.log(`   ❌ ${label} — 코드 본문 불일치(정규화 후 ${la.length} vs ${lb.length}줄)`);
  console.log(`      첫 차이 ≈ ${i + 1}번째 코드 줄`);
  console.log(`      canonical: ${(la[i] ?? '(EOF)').trim().slice(0, 100)}`);
  console.log(`      edge     : ${(lb[i] ?? '(EOF)').trim().slice(0, 100)}`);
}

if (bad) {
  console.log(`\n❌ 복사본 드리프트 ${bad}건 — canonical 이 정본(골든이 검증). Edge 복사본을 canonical 에 맞춰라.`);
  console.log('   ⚠️ 방치하면 유료(Edge) 통변과 무료(앱·canonical) 산출이 서로 다른 답을 낸다.\n');
  process.exit(1);
}
console.log(`\n✅ 복사본 ${entries.length}쌍 전부 일치 — 드리프트 0건.\n`);
