// app/src/lib/content/readingTabs.ts — 풀이 본문 6탭 (시안 `니운내운.pdf` p10·p11)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 시안이 정한 것
//   본문 상단 탭 = 「전체 · 성향 · 연애 · 직업 · 재물 · 인생」.
//   종전 우리 화면은 세로 아코디언 4그룹(나 / 일·돈 / 관계 / 성장)이었다(daniel b안, 2026-07).
//   Boss 2026-08-18 "전부 다 똑같이" → 시안의 6탭을 따른다.
//
// ■ ⚠️16영역을 하나도 잃지 않는다
//   탭 구성이 바뀌면 **어느 영역이 조용히 빠지는 것**이 가장 위험하다 — 돈을 낸 사람이 산 내용이
//   화면에서 사라지는 것이라([[list-truncation-hides-content]]) `check:readingtabs` 가 전수를 검사한다.
//
// ■ 자미두수 12궁은 이 표를 쓰지 않는다
//   궁은 이름 자체가 분류라 억지로 6탭에 밀어 넣으면 뜻이 흐려진다. 자미는 기존 4그룹을 유지한다.
// ═══════════════════════════════════════════════════════════════════════════
import type { CategoryKey } from '@spec/chart';

/** 탭 하나. `key` 는 i18n·상태에 쓰는 안정된 식별자. */
export type ReadingTab = {
  key: 'all' | 'nature' | 'love' | 'work' | 'money' | 'life';
  /** 이 탭이 펼칠 사주 영역들(순서 = 화면에 나오는 순서) */
  areas: CategoryKey[];
};

/**
 * 시안 6탭 ← 사주 16영역.
 *
 * ★`all`(전체)은 영역을 갖지 않는다 — 명식표·오행 분포·종합이 들어가는 **개요 탭**이다.
 *   나머지 5탭이 16영역을 **빠짐없이 한 번씩** 나눠 갖는다(하네스가 검사).
 */
export const READING_TABS: ReadingTab[] = [
  { key: 'all', areas: [] },
  // 성향 = 나를 이루는 결. 건강은 몸의 기질이라 여기 둔다(질병 예측이 아니라 관리축 — 기획서 §4).
  { key: 'nature', areas: ['성격내면', '건강'] },
  { key: 'love', areas: ['연애운', '결혼배우자운'] },
  { key: 'work', areas: ['취업운', '직장운', '사업운'] },
  { key: 'money', areas: ['금전소득운', '투자편재운', '재물손재'] },
  // 인생 = 사람·배움·이동 — 한 시기에 묶이지 않고 삶 전체에 걸리는 것들
  { key: 'life', areas: ['대인사회성', '부모운', '형제운', '자식운', '학업자기계발', '이동환경'] },
];

/** 탭 키 → 그 탭이 맡은 영역들. */
export function areasOfTab(key: ReadingTab['key']): CategoryKey[] {
  return READING_TABS.find((t) => t.key === key)?.areas ?? [];
}

/**
 * 영역이 속한 탭.
 * @returns 탭 키. 표에 없으면 null(하네스가 잡는다)
 */
export function tabOfArea(area: string): ReadingTab['key'] | null {
  return READING_TABS.find((t) => (t.areas as string[]).includes(area))?.key ?? null;
}
