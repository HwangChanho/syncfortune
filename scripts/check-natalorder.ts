// scripts/check-natalorder.ts — 「명식표 배열이 만세력과 갈리지 않는가」
// ─────────────────────────────────────────────────────────────────────────
// 왜: 2026-08-18 풀이 본문에 명식표를 붙이며 처음엔 시안 그림만 보고
//   **라벨 → 한자 → 십신** 순의 다른 표를 만들었다. 만세력은
//   **기둥명 → 천간십신 → 천간 → 지지 → 지지십신** 이다.
//   같은 명식을 두 화면이 서로 다른 배열로 보여 주면 사용자는 대조하다 혼란에 빠진다
//   ([[duplicate-ui-single-source]]). Boss 지시: "만세력 틀은 기존대로, 디자인만 시안대로".
//
// 무엇을 보는가 — 두 파일에서 **세로 순서**를 뽑아 비교한다.
//   [N1] 십신이 천간 **위**, 지지 **아래**에 온다(만세력 배열)
//   [N2] 기둥 순서가 `PILLAR_DISPLAY_ORDER`(시→일→월→년) 단일 출처를 쓴다
//   [N3] 독음·음양이 함께 표시된다(만세력이 주는 정보를 풀이에서 잃지 않는다)
//
// ★눈으로는 안 잡힌다 — 두 화면을 나란히 놓고 봐야 알 수 있는 종류의 어긋남이라 코드가 지킨다.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const NATAL = 'app/src/components/reading/NatalTable.tsx';
const src = readFileSync(NATAL, 'utf8');
const bad: string[] = [];

/** 렌더 본문에서 의미 있는 줄의 등장 순서를 뽑는다(주석·빈 줄 제외). */
function orderOf(text: string): string[] {
  const marks: Array<[string, RegExp]> = [
    ['pos', /styles\.pos\b/],
    ['stemTenGod', /p\.stemTenGod/],
    ['stem', /\{p\.stem\}/],
    ['stemReading', /stemReading\(p\.stem\)/],
    ['branch', /\{p\.branch\}/],
    ['branchReading', /branchReading\(p\.branch\)/],
    ['branchTenGod', /p\.branchMainTenGod/],
  ];
  const out: string[] = [];
  for (const ln of text.split('\n')) {
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) continue;
    for (const [name, re] of marks) if (re.test(ln) && !out.includes(name)) out.push(name);
  }
  return out;
}

const order = orderOf(src);

// [N1] 만세력 배열 — 십신이 천간 위 / 지지 아래
const WANT = ['pos', 'stemTenGod', 'stem', 'stemReading', 'branch', 'branchReading', 'branchTenGod'];
if (order.join('>') !== WANT.join('>')) {
  bad.push(`[N1] 세로 순서가 만세력과 다르다\n         지금: ${order.join(' → ') || '(못 읽음)'}\n         만세력: ${WANT.join(' → ')}`);
}

// [N2] 기둥 순서를 단일 출처에서 가져온다
if (!/PILLAR_DISPLAY_ORDER/.test(src)) {
  bad.push('[N2] 기둥 순서를 `PILLAR_DISPLAY_ORDER` 에서 가져오지 않는다 — 표시 순서가 앱마다 갈린다');
}

// [N3] 만세력이 주는 정보를 잃지 않는다
for (const [what, re] of [['독음', /stemReading|branchReading/], ['음양', /YinYang/]] as const) {
  if (!re.test(src)) bad.push(`[N3] ${what} 표시가 없다 — 만세력에 있는 정보가 풀이에서 사라진다`);
}

if (process.argv.includes('--selftest')) {
  const cases: Array<[string, string[], boolean]> = [
    ['만세력 배열', WANT, true],
    ['시안 배열(십신이 둘 다 아래)', ['pos', 'stem', 'stemTenGod', 'branch', 'branchTenGod'], false],
    ['십신 없음', ['pos', 'stem', 'branch'], false],
  ];
  let n = 0;
  for (const [name, ord, want] of cases) {
    const ok = ord.join('>') === WANT.join('>');
    if (ok !== want) { n++; console.error(`   ✗ ${name} — 기대 ${want ? '통과' : '적발'} / 실제 ${ok ? '통과' : '적발'}`); }
  }
  console.log(n ? `\n❌ 자가 테스트 ${n}건 실패\n` : `\n✅ 자가 테스트 ${cases.length}건 통과\n`);
  process.exit(n ? 1 : 0);
}

console.log('\n🧭 풀이 명식표가 만세력 틀을 지키는가');
if (bad.length) {
  console.error(`\n❌ 문제 ${bad.length}건 — 같은 명식이 두 화면에서 다르게 보인다\n`);
  bad.forEach((b) => console.error('   ' + b));
  console.error('\n   ※ Boss 2026-08-18: "만세력 틀은 기존대로 가야해 디자인만 시안대로"\n');
  process.exit(1);
}
console.log('   ✅ 기둥명 → 천간십신 → 천간(독음·음양) → 지지(독음·음양) → 지지십신 — 만세력과 같다.\n');
