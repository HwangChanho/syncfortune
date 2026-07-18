// scripts/check-dohwa.ts — 도화(桃花) 판정 4갈래 드리프트 가드 (API 0·결정론)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가(2026-07-18 전수조사에서 드러난 구조):
//   도화 판정이 코드베이스에 **4갈래로 복제**돼 있고, 그중 셋은 같은 값이어야 하는데 손복제다.
//     A `engine/sinsal.ts` twelveSinsalAt      = 삼합국 12신살 년살(산식·정본) → 속궁합·신살화면·명식·오늘의운세
//     B `supabase/functions/_shared/buildUserPrompt.ts` DOHWA_OF_BRANCH = A 산식의 인라인 복제 → **재회·짝사랑 유료**
//       (Deno Edge 가 functions/ 밖 engine/ 을 import 못 해 복제한 것 — 원본 주석에 명시)
//     D `app/src/lib/content/auspiciousDate.ts` DOHWA  = 같은 매핑의 3번째 사본 → 택일
//     C `app/src/lib/love/inyeonGauge.ts` + `timingSignals.ts` DOHWA=['子','午','卯','酉']
//       = 왕지 전탐지(개인 삼합국 무관한 광역 '도화 기운') → **무료 티저 전용**(daniel B1 이원화 승인 2026-07-06)
//
//   문제: A 를 고쳐도 B·D 는 자동으로 안 따라온다. `check-engine-copy` 는 interpretation/engine ↔
//   supabase/_shared 의 *동일 파일명 쌍*만 대조하는데 sinsal.ts 는 그 쌍이 없어 **감시망 밖**이었다.
//   → 유료 화면(B 경유)과 무료 화면(A 경유)이 서로 다른 도화를 쓰는 드리프트가 아무 경고 없이 난다.
//   도화 관련 골든·회귀 테스트는 0건이라(전수조사 확인) 이 하네스가 유일한 안전망이다.
//
// ★범위: 이 하네스는 **'값이 서로 일치하는가'만** 본다. 관법 자체(삼합 년살 ↔ R51 세력 도화)의
//   우열은 daniel 판정 사항이며, 2026-07-18 판정 = *통변 서술은 R51(세력) / 유료 timing 결정론은
//   삼합 축 잠정 유지*(세력 도화는 글자가 아니라 상태여서 '도화 글자를 충하는 시점' 판정이 성립 안 함).
//   그 판정이 프롬프트에서 조용히 사라지지 않게 R51 문구 존재도 함께 못 박는다.
//
// 실행: npm run check:dohwa   (preflight 포함)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { twelveSinsalAt } from '../engine/sinsal';
import type { Branch } from '../spec/chart';

let failed = 0;
const fail = (m: string) => { console.error(`  ❌ ${m}`); failed++; };
const pass = (m: string) => console.log(`  ✅ ${m}`);
const ok = (cond: boolean, m: string) => (cond ? pass(m) : fail(m));

const BR: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BRANCH_RE = '[子丑寅卯辰巳午未申酉戌亥]';

const read = (p: string) => readFileSync(p, 'utf8');

/** `{ 申: '酉', 子: '酉', … }` 형태의 지지→지지 매핑 리터럴을 파싱. */
function parseBranchMap(src: string, constName: string, path: string): Record<string, string> {
  // const NAME: <타입>? = { … } — 첫 닫는 중괄호까지(도화 매핑은 중첩 객체가 없다)
  const m = src.match(new RegExp(`const\\s+${constName}\\s*(?::[^=]+)?=\\s*\\{([\\s\\S]*?)\\}`));
  if (!m) { fail(`${path} 에서 ${constName} 을 찾지 못함 — 상수명이 바뀌었다면 이 하네스도 갱신할 것`); return {}; }
  const out: Record<string, string> = {};
  for (const kv of m[1].matchAll(new RegExp(`(${BRANCH_RE})\\s*:\\s*'(${BRANCH_RE})'`, 'g'))) out[kv[1]] = kv[2];
  return out;
}

/** `['子','午','卯','酉']` 형태의 지지 배열 리터럴을 파싱. */
function parseBranchArray(src: string, constName: string, path: string): string[] {
  const m = src.match(new RegExp(`(?:export\\s+)?const\\s+${constName}\\s*(?::[^=]+)?=\\s*\\[([^\\]]*)\\]`));
  if (!m) { fail(`${path} 에서 ${constName} 배열을 찾지 못함`); return []; }
  return [...m[1].matchAll(new RegExp(`'(${BRANCH_RE})'`, 'g'))].map((x) => x[1]);
}

const eqMap = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return ka.length > 0 && ka.join() === kb.join() && ka.every((k) => a[k] === b[k]);
};
const fmt = (m: Record<string, string>) => Object.entries(m).map(([k, v]) => `${k}→${v}`).join(' ');

console.log('§도화 4갈래 드리프트 가드');

// ── A. 정본 산식에서 base별 도화 글자를 도출(산식 자체를 실행해 역검증) ──────────────
const engineMap: Record<string, string> = {};
for (const base of BR) {
  const target = BR.find((t) => twelveSinsalAt(base, t) === '도화');
  if (target) engineMap[base] = target;
}
ok(Object.keys(engineMap).length === 12, `A engine/sinsal.ts — 12지지 전부에서 도화 글자 도출(${Object.keys(engineMap).length}/12)`);
// 삼합국 년살 관법의 정의상 도화는 왕지(子午卯酉) 넷 중 하나로만 나온다 — 산식이 깨지면 여기서 걸린다.
ok(new Set(Object.values(engineMap)).size === 4 && Object.values(engineMap).every((v) => '子午卯酉'.includes(v)),
  `A 도화 치역 = 왕지 4개(子午卯酉) — ${[...new Set(Object.values(engineMap))].join('')}`);

// ── B. Edge 유료 경로(재회·짝사랑) 인라인 복제본이 A와 같은가 ────────────────────
const B_PATH = 'supabase/functions/_shared/buildUserPrompt.ts';
const bSrc = read(B_PATH);
const bMap = parseBranchMap(bSrc, 'DOHWA_OF_BRANCH', B_PATH);
ok(eqMap(engineMap, bMap), `B ${B_PATH} DOHWA_OF_BRANCH ≡ A 산식`);
if (!eqMap(engineMap, bMap)) { console.error(`     A: ${fmt(engineMap)}`); console.error(`     B: ${fmt(bMap)}`); }

// ── D. 택일 복제본이 A와 같은가 ─────────────────────────────────────────────
const D_PATH = 'app/src/lib/content/auspiciousDate.ts';
const dSrc = read(D_PATH);
const dMap = parseBranchMap(dSrc, 'DOHWA', D_PATH);
ok(eqMap(engineMap, dMap), `D ${D_PATH} DOHWA ≡ A 산식`);
if (!eqMap(engineMap, dMap)) { console.error(`     A: ${fmt(engineMap)}`); console.error(`     D: ${fmt(dMap)}`); }

// ── C. 무료 티저 왕지 셋 — 두 복제본이 서로 같은가 ─────────────────────────────
//   C2(timingSignals)는 C1(inyeonGauge)을 import 하지 않고 값만 복붙한 상태라 가장 취약하다.
const C1_PATH = 'app/src/lib/love/inyeonGauge.ts';
const C2_PATH = 'app/src/lib/content/timingSignals.ts';
const c1 = parseBranchArray(read(C1_PATH), 'DOHWA', C1_PATH);
const c2 = parseBranchArray(read(C2_PATH), 'DOHWA', C2_PATH);
ok(c1.length === 4 && c1.join() === c2.join(), `C 무료 티저 왕지 셋 일치 — inyeonGauge[${c1.join('')}] ≡ timingSignals[${c2.join('')}]`);

// ── ★ daniel B1 스탠스 보호: 광역 왕지 셋이 유료 Edge 경로로 새어들지 않았는가 ──────
//   B1(2026-07-06) = "왕지 전탐지는 개인 삼합국과 무관한 광역 신호 → 유료 재회·짝사랑 timing 엔 부적합,
//   무료 티저에서만 쓴다". 유료 경로에 왕지 배열 상수가 생기면 그 이원화가 깨진 것.
ok(!/const\s+DOHWA\s*(?::[^=]+)?=\s*\[/.test(bSrc),
  `★B1 이원화 — 유료 Edge(${B_PATH})에 광역 왕지 도화 배열 없음(삼합 Record 만 사용)`);

// ── ★ 2026-07-18 daniel 판정이 프롬프트에 살아있는가 ────────────────────────────
//   판정: 통변 서술=R51(세력 도화) / 유료 timing 결정론=삼합 축 잠정 유지.
//   누가 R51 문구를 정리하다 이 카브아웃을 지우면, LLM 이 엔진이 준 삼합 도화 신호를 부정하기 시작한다.
const CORE_PATH = 'interpretation/prompts/myeongri-core.ts';
const core = read(CORE_PATH);
ok(/- R51 도화/.test(core), `R51(도화 판정) 규칙이 canonical 프롬프트에 존재`);
ok(/daniel 판정\(2026-07-18\)/.test(core) && /삼합 축을 잠정 유지/.test(core),
  `★R51 timing 카브아웃 유지 — "통변은 세력 / 유료 timing 은 삼합 잠정 유지" 판정 문구 보존`);

console.log(failed === 0 ? '\n✅ 도화 4갈래 동기화됨 — 드리프트 없음.' : `\n✖ 도화 드리프트 ${failed}건 — 위 항목을 맞춘 뒤 재실행하세요.`);
process.exit(failed === 0 ? 0 : 1);
