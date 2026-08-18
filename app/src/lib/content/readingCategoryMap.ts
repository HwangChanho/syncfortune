// app/src/lib/content/readingCategoryMap.ts — `readings.category` → **콘텐츠 한 건**으로 되돌리는 표
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 필요한가 (2026-08-18 실측으로 드러남)
//   `readings` 는 **콘텐츠 1건 = 행 1개가 아니다.**
//     · 사주 원국 풀이 1건 → `성격내면`·`취업운`… **16행**
//     · 자미두수 1건      → `명궁`·`복덕궁`… **12행**
//     · 궁합 1건          → `compat_love_<상대 간지>` (상대마다 다른 행)
//     · 신년운세          → `newyear_2026` (연도가 접미사)
//   보관함(`/myreadings`)이 행을 그대로 나열하면 **한 사람 몫이 28줄**로 뜬다.
//   ⇒ 여기서 category 를 '콘텐츠 키'로 되돌리고, 화면은 그 키로 묶는다.
//
// ■ 이 표가 유일한 출처다
//   화면마다 따로 조건문을 두지 않는다([[duplicate-ui-single-source]]).
//   ⚠️새 유료 콘텐츠를 낼 때 category 가 새로 생기면 **여기 한 줄**을 더한다.
//     빠뜨리면 보관함에 raw 문자열(`year_2026` 같은)이 그대로 뜬다 — `check:readingcat` 이 잡는다.
// ═══════════════════════════════════════════════════════════════════════════

/** 사주 원국 풀이가 쪼개져 저장되는 16영역. */
export const SAJU_AREA_CATEGORIES = [
  '성격내면', '취업운', '직장운', '사업운', '금전소득운', '투자편재운', '재물손재', '연애운',
  '결혼배우자운', '대인사회성', '부모운', '형제운', '자식운', '건강', '학업자기계발', '이동환경',
] as const;

/** 자미두수가 쪼개져 저장되는 12궁. */
export const ZIWEI_PALACE_CATEGORIES = [
  '명궁', '형제궁', '부처궁', '자녀궁', '재백궁', '질액궁',
  '천이궁', '노복궁', '관록궁', '전택궁', '복덕궁', '부모궁',
] as const;

/**
 * category 원문 → 콘텐츠 키(`contentSections` 의 `item.key` 또는 `creditKey`).
 * 접미사가 붙는 것(`compat_love_甲子`·`newyear_2026`)은 여기 두지 않는다 — 아래 `contentKeyOf` 가 잘라 낸다.
 */
const EXPLICIT: Record<string, string> = {
  // 접미사 없이 뜻이 다른 것들만 명시한다
  year: 'newyear',       // 올해의 운세 — 저장 키는 `year_<연도>`
  life: 'lifegraph',     // 인생 그래프 — 저장 키는 `life_<나이>`
  compat_love: 'compat', // 궁합(애정) — 저장 키는 `compat_love_<상대 간지>`
};

/**
 * 보관함에 **쌓이면 안 되는** 캐시 계열.
 *
 * `daily_20260818` · `monthly_202608` 은 오늘/이달 운세의 **날짜별 캐시**다 — 콘텐츠를 '샀다'는 뜻이 아니라
 * 그날 화면을 열었다는 기록이라, 목록에 두면 하루에 한 줄씩 늘어 보관함이 달력이 된다.
 * ⇒ 이름은 있지만 **목록에서는 뺀다**(데이터는 그대로 둔다 — 각 화면이 자기 캐시로 계속 쓴다).
 */
export const ARCHIVE_EXCLUDED_PREFIXES = ['daily', 'monthly'] as const;

/**
 * 보관함 목록에 넣을 것인가.
 * @param category DB 원문
 */
export function showsInArchive(category: string): boolean {
  const root = category.split('_')[0];
  return !(ARCHIVE_EXCLUDED_PREFIXES as readonly string[]).includes(root);
}

/**
 * `readings.category` 를 **콘텐츠 키 하나**로 되돌린다.
 *
 * @param category DB 원문(예: `금전소득운`, `compat_love_壬午甲辰丙寅辛卯`, `newyear_2026`)
 * @returns 콘텐츠 키(예: `reading`, `compat`, `newyear`). 알 수 없으면 `null`
 *
 * 순서: 16영역/12궁 → 명시표 → `_` 를 뒤에서 떼며 재시도.
 */
export function contentKeyOf(category: string): string | null {
  if ((SAJU_AREA_CATEGORIES as readonly string[]).includes(category)) return 'reading';
  if ((ZIWEI_PALACE_CATEGORIES as readonly string[]).includes(category)) return 'ziwei';

  let key = category;
  for (;;) {
    if (EXPLICIT[key]) return EXPLICIT[key];
    const cut = key.lastIndexOf('_');
    if (cut <= 0) return key === category ? key : key;   // 접미사를 다 뗀 뿌리를 후보로 돌려준다
    key = key.slice(0, cut);
  }
}

/**
 * 보관함에서 **같은 줄로 묶을 키**.
 *
 * 궁합처럼 상대가 다르면 별개 콘텐츠이므로 접미사를 살려야 하고,
 * 사주 16영역처럼 한 건이 쪼개진 것은 접미사가 없으니 자연히 하나로 묶인다.
 *
 * @param chartId  주체 명식
 * @param category DB 원문
 */
export function groupKeyOf(chartId: string, category: string): string {
  const base = contentKeyOf(category) ?? category;
  // ★궁합은 **상대마다 다른 풀이**다 — 접미사를 지우면 서로 다른 사람과의 궁합이 한 줄로 합쳐진다
  //   (실물에서 조충희와의 궁합 2건 중 1건이 사라졌다 → [[list-truncation-hides-content]]).
  const suffix = base === 'compat' ? category : '';
  return `${chartId}|${base}|${suffix}`;
}
