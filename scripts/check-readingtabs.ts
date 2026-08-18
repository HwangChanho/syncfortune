// scripts/check-readingtabs.ts — 「풀이 6탭이 16영역을 다 담는가」
// ─────────────────────────────────────────────────────────────────────────
// 왜: 2026-08-18 풀이 본문을 시안의 6탭(전체·성향·연애·직업·재물·인생)으로 바꿨다.
//   탭 구성이 바뀔 때 가장 위험한 것은 **어느 영역이 조용히 빠지는 것**이다 —
//   사용자는 돈을 내고 산 내용이 화면에서 사라진 것으로 겪는다([[list-truncation-hides-content]]).
//   눈으로는 안 보인다(탭마다 뭔가 뜨니까 다 되는 것처럼 보인다).
//
// [T1] 16영역이 **빠짐없이** 어느 탭엔가 있다
// [T2] 같은 영역이 **두 탭에** 있지 않다(중복이면 같은 글이 두 번 팔린 것처럼 보인다)
// [T3] 표에 있는 영역이 전부 실제 카테고리다(오타로 만든 유령 영역이 없다)
// [T4] `all`(개요) 탭은 영역을 갖지 않는다 — 명식표·오행이 들어가는 자리다
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const tabSrc = readFileSync('app/src/lib/content/readingTabs.ts', 'utf8');
const mapSrc = readFileSync('app/src/lib/content/readingCategoryMap.ts', 'utf8');

/** 진짜 16영역(단일 출처 = readingCategoryMap) */
const AREAS = [...(mapSrc.match(/SAJU_AREA_CATEGORIES = \[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** 탭 표에서 { key, areas } 를 뽑는다 */
const tabs = [...tabSrc.matchAll(/\{\s*key:\s*'([a-z]+)'\s*,\s*areas:\s*\[([^\]]*)\]/g)].map((m) => ({
  key: m[1],
  areas: [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]),
}));

const bad: string[] = [];

if (tabs.length === 0) bad.push('탭 표를 읽지 못했다 — readingTabs.ts 형식이 바뀌었는지 확인');

// [T4]
const all = tabs.find((t) => t.key === 'all');
if (!all) bad.push("[T4] 'all'(개요) 탭이 없다");
else if (all.areas.length) bad.push(`[T4] 'all' 탭이 영역을 갖고 있다(${all.areas.join('·')}) — 개요 자리다`);

// [T1] 누락
const covered = new Set(tabs.flatMap((t) => t.areas));
const missing = AREAS.filter((a) => !covered.has(a));
if (missing.length) bad.push(`[T1] 어느 탭에도 없는 영역 ${missing.length}건 — 화면에서 사라진다: ${missing.join(' · ')}`);

// [T2] 중복
const seen = new Map<string, string[]>();
for (const t of tabs) for (const a of t.areas) seen.set(a, [...(seen.get(a) ?? []), t.key]);
for (const [a, ks] of seen) if (ks.length > 1) bad.push(`[T2] '${a}' 가 두 탭에 있다: ${ks.join(' · ')}`);

// [T3] 유령
const ghosts = [...seen.keys()].filter((a) => !AREAS.includes(a));
if (ghosts.length) bad.push(`[T3] 실제 카테고리가 아닌 이름: ${ghosts.join(' · ')}`);

if (process.argv.includes('--selftest')) {
  // 규칙이 실제로 무는지 — 표를 망가뜨린 사본으로 확인
  const broken = tabSrc.replace("'연애운', '결혼배우자운'", "'연애운'");            // 결혼배우자운 누락
  const bTabs = [...broken.matchAll(/\{\s*key:\s*'([a-z]+)'\s*,\s*areas:\s*\[([^\]]*)\]/g)]
    .map((m) => [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])).flat();
  const bMissing = AREAS.filter((a) => !bTabs.includes(a));
  const dup = tabSrc.replace("{ key: 'life', areas: ['대인사회성'", "{ key: 'life', areas: ['건강', '대인사회성'");
  const dTabs = [...dup.matchAll(/areas:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  const dDup = dTabs.filter((a, i) => dTabs.indexOf(a) !== i);
  let n = 0;
  if (bMissing.length !== 1) { n++; console.error(`   ✗ [T1] 누락 1건을 만들었는데 ${bMissing.length}건으로 셌다`); }
  if (dDup.length !== 1) { n++; console.error(`   ✗ [T2] 중복 1건을 만들었는데 ${dDup.length}건으로 셌다`); }
  if (AREAS.length !== 16) { n++; console.error(`   ✗ 기준 영역이 16개가 아니다(${AREAS.length}) — 단일 출처 확인`); }
  console.log(n ? `\n❌ 자가 테스트 ${n}건 실패\n` : `\n✅ 자가 테스트 3건 통과(누락·중복·기준수)\n`);
  process.exit(n ? 1 : 0);
}

console.log(`\n📑 풀이 6탭이 16영역을 다 담는가 (탭 ${tabs.length} · 영역 ${AREAS.length})`);
if (bad.length) {
  console.error(`\n❌ 문제 ${bad.length}건\n`);
  bad.forEach((b) => console.error('   ' + b));
  console.error('\n   ※ 고치는 법: `app/src/lib/content/readingTabs.ts` 의 READING_TABS 를 손본다.\n');
  process.exit(1);
}
console.log(`   ✅ 16영역이 5개 탭에 빠짐없이·중복 없이 나뉘어 있다.\n`);
