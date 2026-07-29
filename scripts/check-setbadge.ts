// scripts/check-setbadge.ts — 세트형 콘텐츠의 '보유중' 배지 매칭 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29: "풀이탭에서 보유중이나 이런건 알수가 없는데" / "자미두수도 그래"
//
// ★왜 하네스인가: 이 결함은 **에러가 없다.** 배지가 그냥 안 뜰 뿐이라, 화면만 보면
//   "아직 안 샀나 보다"로 읽힌다. 실제로는 사주 카드의 creditKey='reading' 인데
//   저장된 category 는 '금전소득운'·'연애운'… 이라 `r.category === ck` 매칭이
//   **구조적으로 영원히 0건**이었다(자미도 동일: 'ziwei' vs '명궁'…).
//
// 지키는 것: 세트형 creditKey 는 ContentGrid.SET_CATEGORIES 에 영역 목록이 있어야 한다.
//   그리고 그 목록은 실제 생성 카테고리(단일출처)와 일치해야 한다.
//
// 실행: npm run check:setbadge
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(`${ROOT}${p}`, 'utf8');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

console.log('\n🔎 세트형 보유 배지 매칭\n');

const grid = read('app/src/components/ContentGrid.tsx');
const prewarm = read('app/src/lib/backend/prewarmReadings.ts');

// ── ① 세트 creditKey 가 SET_CATEGORIES 에 등록돼 있나 ──────────────────────
// interpret 의 SET_KIND 와 같은 집합(saju→reading · ziwei→ziwei). timeline 은
// category 가 'life_'/'year_' 접두사 체계라 기존 startsWith 경로가 이미 맞는다.
const SET_KEYS = ['reading', 'ziwei'];
const setBlock = grid.slice(grid.indexOf('SET_CATEGORIES'), grid.indexOf('SET_CATEGORIES') + 900);
for (const k of SET_KEYS) {
  if (new RegExp(`(^|[^\\w])${k}\\s*:`, 'm').test(setBlock)) ok(`SET_CATEGORIES 에 '${k}' 등록됨`);
  else bad(`세트 creditKey '${k}' 가 SET_CATEGORIES 에 없다 — 배지가 영원히 안 뜬다(에러 없음)`);
}

// ── ② badgeFor 가 실제로 그 매핑을 쓰나 ──────────────────────────────────
if (/const setCats = SET_CATEGORIES\[ck\]/.test(grid) && /setCats\s*\n?\s*\?\s*readingRows\.filter/.test(grid)) {
  ok('badgeFor 가 세트 매핑을 사용한다');
} else bad('badgeFor 가 SET_CATEGORIES 를 쓰지 않는다 — 매핑만 있고 적용이 빠졌다');

// ── ③ 사주 목록이 단일출처(prewarmReadings)에서 오나 ──────────────────────
if (/reading:\s*SAJU_READING_CATEGORIES/.test(grid)) ok('사주 영역은 단일출처(SAJU_READING_CATEGORIES) 참조');
else bad('사주 영역을 하드코딩했다 — 단일출처와 갈라진다');

// ── ④ 자미 12궁 개수 ─────────────────────────────────────────────────────
const ziweiList = setBlock.match(/ziwei:\s*\[([^\]]+)\]/)?.[1] ?? '';
const nZiwei = (ziweiList.match(/'/g) ?? []).length / 2;
if (nZiwei === 12) ok(`자미 12궁 전부 등록(${nZiwei}종)`);
else bad(`자미 궁이 ${nZiwei}종 — 12궁이어야 한다(빠진 궁은 배지 판정에서 누락)`);

// ── ⑤ 단일출처 사주 16영역 ───────────────────────────────────────────────
const nSaju = (prewarm.slice(prewarm.indexOf('SAJU_READING_CATEGORIES')).match(/'[가-힣]+'/g) ?? []).slice(0, 20).length;
if (nSaju >= 16) ok(`사주 영역 단일출처 ${nSaju}종`);
else bad(`SAJU_READING_CATEGORIES 를 ${nSaju}종밖에 못 읽었다 — 하네스가 헛돈다`);

console.log(fail ? `\n❌ check:setbadge 실패 ${fail}건` : '\n✅ check:setbadge 통과');
process.exit(fail ? 1 : 0);
