// scripts/check-light.ts — '가볍게 보기'(/light) 계약 하네스
// ─────────────────────────────────────────────────────────────────────────
// 이 화면은 **태어난 시간을 받지 않는다** → `timeAccuracy: '미상'` 으로 계산하므로 **시주가 허수**다.
//   그래서 시주에 의존하는 판정을 쓰면 조용히 틀린 값을 내보낸다(정직성 위반).
//
// ★왜 하네스가 필요한가: 이 화면은 앞으로 반드시 "비어 보인다"는 이유로 살이 붙는다.
//   그때 가장 손이 가는 게 **오늘 기운·모먼트**인데(홈에 이미 있으니 붙여넣기 한 줄), 그게 정확히
//   금지 사항이다. 코드 주석은 지워지지만 하네스는 안 지워진다.
//
// 지키는 것:
//   L1 시주 의존 판정 금지 — dailyEnergy/dailyScore/dailyHeadline/dailyChartReadings/
//      decisionFromEnergy/momentFromEnergy/analyzeSinsal/detectGyeokguk/compatScore 사용 0.
//   L2 시주 무관 콘텐츠는 실재 — personaOf · DAY_PILLAR 를 실제로 렌더한다(빈 화면 방지·역검증).
//   L3 timeAccuracy 는 '미상' 으로 고정 — '정확'/'추정' 으로 계산하면 허수 시주를 진짜처럼 다루게 된다.
//   L4 저장·서버 호출 0 — 규칙5(무료=온디바이스). addChart/supabase 사용 금지.
//   L5 전환 경로 실재 — /register 로 생년월일을 넘기고(preDate), register 가 그 값을 실제로 읽는다.
//   L6 canonical 빌더 사용 — computeChart 로만 계산(엔진 드리프트 방지).
//
// 실행: npm run check:light
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const LIGHT = 'app/src/app/(app)/light.tsx';
const REGISTER = 'app/src/app/(app)/register.tsx';

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const raw = readFileSync(`${ROOT}${LIGHT}`, 'utf8');
// 주석을 걷어낸 '실제 코드'만 본다 — 금지 함수명이 설명 주석에 등장하는 건 정상이다
//   (이 화면 헤더 주석이 바로 "dailyEnergy 는 왜 못 쓰는지"를 설명하고 있다).
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const reg = readFileSync(`${ROOT}${REGISTER}`, 'utf8');

// ── L1 시주 의존 판정 금지 ────────────────────────────────────────────────
console.log('\n[L1] 시주 의존 판정 금지(시간 미상 → 시주 허수)');
const HOUR_DEPENDENT: Array<[string, string]> = [
  ['dailyEnergy', '4주 전부 순회(dailyFortune.ts) — 충형·합 판정이 허수 시주에 오염'],
  ['dailyScore', 'dailyEnergy 위임 — 같은 오염'],
  ['dailyHeadline', '4주 순회'],
  ['dailyChartReadings', '4주 순회'],
  ['decisionFromEnergy', 'dailyEnergy 산출물이 입력'],
  ['momentFromEnergy', 'dailyEnergy 산출물이 입력'],
  ['analyzeSinsal', '원국 전체(시주 포함) 기반 신살'],
  ['detectGyeokguk', '격국 — 원국 전체'],
  ['compatScore', '궁합 — 배우자궁·시주 관여'],
];
let l1 = 0;
for (const [fn, why] of HOUR_DEPENDENT) {
  // 식별자 경계로 매칭(부분 문자열 오탐 방지)
  if (new RegExp(`\\b${fn}\\s*\\(`).test(src) || new RegExp(`\\b${fn}\\b(?=[,}\\s]*from)`).test(src)) {
    bad(`${fn} 사용됨 — ${why}. 시간을 받지 않는 화면에서는 쓸 수 없다.`);
    l1++;
  }
}
if (!l1) ok(`시주 의존 판정 ${HOUR_DEPENDENT.length}종 전부 미사용`);

// ── L2 시주 무관 콘텐츠 실재(역검증) ──────────────────────────────────────
console.log('\n[L2] 시주 무관 콘텐츠는 실제로 렌더된다(빈 화면 방지)');
if (/\bpersonaOf\s*\(/.test(src)) ok('personaOf(일간, 월지) 사용 — 시주 참조 0');
else bad('personaOf 미사용 — 시주 무관 콘텐츠가 없으면 이 화면의 존재 이유가 사라진다');
if (/\bDAY_PILLAR\b/.test(src) && /\bdayPillarKey\s*\(/.test(src)) ok('DAY_PILLAR[일간+일지] 사용 — 시주 무관');
else bad('일주론(DAY_PILLAR/dayPillarKey) 미사용');

// ★역검증: personaType 이 정말 시주를 안 보는지 매번 확인한다.
//   (엔진이 나중에 시주를 참조하도록 바뀌면 이 화면의 전제가 무너지는데, 그걸 여기서 잡는다.)
const personaSrc = readFileSync(`${ROOT}app/src/lib/engine/personaType.ts`, 'utf8');
if (/['"]시['"]/.test(personaSrc)) bad("personaType.ts 가 '시'(시주)를 참조하기 시작함 — 이 화면의 전제(시주 무관)가 깨졌다");
else ok("personaType.ts 시주 참조 0건(전제 유효)");

// ── L3 timeAccuracy 고정 ─────────────────────────────────────────────────
console.log("\n[L3] timeAccuracy = '미상' 고정");
if (/timeAccuracy:\s*['"]미상['"]/.test(src)) ok("timeAccuracy: '미상'");
else bad("timeAccuracy 가 '미상' 이 아니다 — 허수 시주를 진짜처럼 다루게 된다");
if (/timeAccuracy:\s*['"](정확|추정)['"]/.test(src)) bad("timeAccuracy 에 '정확'/'추정' 이 있다");

// ── L4 저장·서버 호출 0 ──────────────────────────────────────────────────
console.log('\n[L4] 저장·서버 호출 0(규칙5 무료=온디바이스)');
for (const banned of ['addChart', 'setRepresentative', 'supabase']) {
  if (new RegExp(`\\b${banned}\\b`).test(src)) bad(`${banned} 사용됨 — 가볍게 보기는 저장·로그인·서버 없이 돌아야 한다`);
}
if (!/\baddChart\b|\bsetRepresentative\b|\bsupabase\b/.test(src)) ok('명식 저장·서버 호출 없음');

// ── L5 전환 경로 실재(양쪽 다 확인) ───────────────────────────────────────
console.log('\n[L5] 전환 경로 — 생년월일을 등록 폼으로 넘기고, 등록 폼이 그걸 읽는다');
const sends = /preDate:/.test(src) && /['"]\/register['"]/.test(src);
const reads = /\bpreDate\b/.test(reg) && /prefill/.test(reg);
if (sends) ok('/light → /register 로 preDate 전달');
else bad('/light 가 생년월일을 등록 폼으로 넘기지 않는다 — 같은 걸 또 묻는 순간이 이탈 지점이다');
if (reads) ok('/register 가 preDate 를 읽어 prefill');
else bad('/register 가 preDate 를 무시한다 — 넘겨도 다시 묻게 된다(반쪽 배선)');
// 시각은 일부러 안 넘긴다 — 사용자가 채우는 게 이 전환의 이유(넘기면 전환 명분이 사라진다)
if (/preTime|preSijin/.test(src)) bad('시각을 prefill 하고 있다 — 시각을 채우는 것이 전환의 이유인데 명분이 사라진다');

// ── L6 canonical 빌더 ────────────────────────────────────────────────────
console.log('\n[L6] canonical 빌더(computeChart)로만 계산');
if (/\bcomputeChart\s*\(/.test(src)) ok('computeChart 사용');
else bad('computeChart 미사용 — 엔진 드리프트 위험(직접 buildFullChart/자체 계산 금지)');

console.log(fail ? `\n❌ check:light 실패 ${fail}건` : '\n✅ check:light 통과 — 시주의존금지·콘텐츠실재·미상고정·무저장·전환배선·canonical OK');
process.exit(fail ? 1 : 0);
