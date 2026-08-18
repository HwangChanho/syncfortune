// scripts/check-readingcat.ts — 「보관함이 풀이 이름을 못 읽는 경우」를 미리 잡는다
// ─────────────────────────────────────────────────────────────────────────
// 왜: 2026-08-18 보관함(/myreadings)을 만들고 **실제 DB 를 띄워 보니** 목록에
//   `compat_love_壬午甲辰丙寅辛卯` · `newyear_2026` · `year_2026` 같은 **raw 문자열**이 그대로 떠 있었다.
//   `readings.category` 는 콘텐츠 키가 아니라 *저장 편의로 만든 키*라(영역·궁·상대·연도가 섞인다)
//   화면이 그걸 그대로 믿으면 사용자에게 내부 식별자가 노출된다.
//
// 무엇을 보는가 — 코드가 **실제로 저장하는** category 리터럴을 긁어, 전부 이름을 찾을 수 있는지 본다.
//   [R1] `useResumeReading(chartId, '<리터럴>')` · `category: '<리터럴>'` 로 쓰이는 값
//   [R2] 사주 16영역 · 자미 12궁 상수
//   ⇒ 각각 `contentKeyOf()` 를 태워 `contentSections` 에서 카드가 잡히는지 확인한다.
//
// ★이 하네스가 없으면 새 유료 콘텐츠를 낼 때마다 보관함에서만 조용히 깨진다
//   (그 화면은 잘 되므로 아무도 모른다 — 실제로 `year_2026` 이 그랬다).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = 'app/src';

/** 재귀로 .ts/.tsx 파일 모으기 */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk(APP);

// ── [R1] 코드가 저장/조회하는 category 리터럴 ────────────────────────────
const found = new Map<string, string>();   // category → 처음 본 파일:줄
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((ln, i) => {
    for (const re of [
      /useResumeReading\([^,]+,\s*'([^']+)'/g,
      /\.eq\('category',\s*'([^']+)'\)/g,
      /category:\s*'([^']+)'/g,
      // ★템플릿으로 만드는 것도 잡는다 — `daily_${…}` · `compat_love_${…}` 처럼 **접두사만** 코드에 있다.
      //   이걸 안 보면 하네스가 리터럴 4종만 보고 초록불을 준다(첫 판에서 실제로 그랬다).
      /category\s*=\s*`([a-z_]+?)_\$\{/g,
      /category\s*=\s*[^`\n]*`([a-z_]+?)_\$\{/g,
    ]) {
      for (const m of ln.matchAll(re)) {
        const v = m[1];
        // 템플릿·변수·명백한 비-category 는 건너뛴다
        if (!v || v.includes('${') || v.length > 40) continue;
        if (!found.has(v)) found.set(v, `${f}:${i + 1}`);
      }
    }
  });
}

// ── 매핑 로드(런타임 코드를 그대로 읽어 판정한다 — 주석이 아니라 값이 근거) ──
const mapSrc = readFileSync('app/src/lib/content/readingCategoryMap.ts', 'utf8');
const areaList = [...mapSrc.matchAll(/SAJU_AREA_CATEGORIES = \[([\s\S]*?)\]/g)][0]?.[1] ?? '';
const palaceList = [...mapSrc.matchAll(/ZIWEI_PALACE_CATEGORIES = \[([\s\S]*?)\]/g)][0]?.[1] ?? '';
const explicit = [...mapSrc.matchAll(/^\s{2}(\w+):\s*'([^']+)',/gm)].map((m) => [m[1], m[2]] as const);
const AREAS = [...areaList.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const PALACES = [...palaceList.matchAll(/'([^']+)'/g)].map((m) => m[1]);

/** 화면 코드와 같은 규칙으로 콘텐츠 키를 만든다(readingCategoryMap.contentKeyOf 의 사본이 아니라 같은 순서). */
function contentKeyOf(category: string): string {
  if (AREAS.includes(category)) return 'reading';
  if (PALACES.includes(category)) return 'ziwei';
  let key = category;
  for (;;) {
    const hit = explicit.find(([k]) => k === key);
    if (hit) return hit[1];
    const cut = key.lastIndexOf('_');
    if (cut <= 0) return key;
    key = key.slice(0, cut);
  }
}

// ── contentSections 의 키 집합 ────────────────────────────────────────────
const secSrc = readFileSync('app/src/lib/content/contentSections.ts', 'utf8');
const KEYS = new Set<string>([
  ...[...secSrc.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((m) => m[1]),
  ...[...secSrc.matchAll(/creditKey:\s*'([^']+)'/g)].map((m) => m[1]),
]);

// ── 판정 ──────────────────────────────────────────────────────────────────
// 저장 category 중 '풀이 본문'으로 보이는 것만 검사한다.
//   ⚠️`category:` 는 커뮤니티 글머리·섹션에도 쓰인다 — 그건 readings 가 아니다.
//     그래서 **콘텐츠 키로 잡히지 않는 것 중** 사주 16영역/12궁/명시표에도 없는 값만 문제 삼는다.
const IGNORE = new Set<string>([
  // 커뮤니티·목록 UI 가 쓰는 값(readings.category 아님)
  'all', 'free', 'money', 'work', 'tool', 'today', 'hot', 'etc',
]);

// ★2026-08-18 **운영 DB 실측** — 실제로 저장돼 있던 category 뿌리들.
//   코드 grep 만으로는 상수 배열·템플릿을 다 못 잡아서, 실측값을 회귀 기준으로 함께 박아 둔다.
//   (하네스가 '무엇을 검사하는지'를 값으로 못 박아야 조용히 빈 검사가 되지 않는다.)
const SEEN_IN_PROD = [
  '성격내면', '취업운', '직장운', '사업운', '금전소득운', '투자편재운', '재물손재', '연애운',
  '결혼배우자운', '대인사회성', '부모운', '형제운', '자식운', '건강', '학업자기계발', '이동환경',
  '명궁', '형제궁', '부처궁', '자녀궁', '재백궁', '질액궁', '천이궁', '노복궁', '관록궁', '전택궁', '복덕궁', '부모궁',
  'compat_love_壬午甲辰丙寅辛卯', 'newyear_2026', 'year_2026', 'life_27',
  'crush', 'talent', 'image', 'love', 'reunion', 'astrology',
];
for (const c of SEEN_IN_PROD) if (!found.has(c)) found.set(c, '운영 DB 실측(2026-08-18)');

// 보관함에서 아예 빼는 캐시 계열(readingCategoryMap.ARCHIVE_EXCLUDED_PREFIXES) — 이름이 없어도 문제되지 않는다
const EXCLUDED = [...(mapSrc.match(/ARCHIVE_EXCLUDED_PREFIXES = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

const bad: string[] = [];
for (const [cat, where] of found) {
  if (IGNORE.has(cat)) continue;
  if (EXCLUDED.includes(cat.split('_')[0])) continue;
  const key = contentKeyOf(cat);
  if (!KEYS.has(key)) bad.push(`${cat}  →  '${key}' 로 풀렸지만 contentSections 에 없다   (${where})`);
}

const selftest = process.argv.includes('--selftest');
if (selftest) {
  // 음성 테스트 — 규칙이 실제로 작동하는지(적발/통과 양쪽)
  const cases: Array<[string, string]> = [
    ['금전소득운', 'reading'],
    ['명궁', 'ziwei'],
    ['compat_love_壬午甲辰丙寅辛卯', 'compat'],
    ['newyear_2026', 'newyear'],
    ['year_2026', 'newyear'],
    ['life_27', 'lifegraph'],
    ['talent', 'talent'],
  ];
  let n = 0;
  for (const [input, want] of cases) {
    const got = contentKeyOf(input);
    if (got !== want) { n++; console.error(`   ✗ ${input} → 기대 '${want}' / 실제 '${got}'`); }
  }
  console.log(n ? `\n❌ 자가 테스트 ${n}건 실패\n` : `\n✅ 자가 테스트 ${cases.length}건 통과\n`);
  process.exit(n ? 1 : 0);
}

console.log(`\n📚 보관함이 풀이 이름을 읽을 수 있는가 (category ${found.size}종)`);
if (bad.length) {
  console.error(`\n❌ 이름을 못 찾는 category ${bad.length}건 — 보관함에 내부 식별자가 그대로 뜬다\n`);
  bad.forEach((b) => console.error('   ' + b));
  console.error('\n   ※ 고치는 법: `app/src/lib/content/readingCategoryMap.ts` 의 EXPLICIT 에 한 줄 더하거나,');
  console.error('     그 콘텐츠 카드를 `contentSections` 에 등록한다.\n');
  process.exit(1);
}
console.log('   ✅ 저장되는 category 가 전부 콘텐츠 이름으로 풀린다.\n');
