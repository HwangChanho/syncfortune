// app/src/lib/content/nextStep.ts — '다음 단계' 추천(퍼널 진입점·결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-26: "너무 리스트 카드형식으로 나열되어 있어서 가시성이 떨어져. 콘텐츠를 타고타고
//   들어가서 자연스럽게 유저한테 다음 걸 구매하게 유도하고 싶어."
//
// 문제 진단: **인프라는 이미 있는데 진입점이 없다.**
//   · 콘텐츠 *상세 하단*에는 `RelatedContent`(RELATED 큐레이션 맵)가 "이어서 볼 것"을 이미 제안한다.
//   · 그런데 풀이 탭은 35장을 **평면 나열**할 뿐이라, 흐름이 시작되질 않는다(어디부터 볼지 유저가 판단).
//   → 풀이 탭 맨 위에 **"당신의 다음 단계" 한 장**을 놓아 저니를 시작시킨다. 그 뒤는 기존 상세 하단
//     크로스셀이 이어받아 '타고타고' 굴러간다.
//
// ★새 큐레이션을 만들지 않는다: 추천 경로는 `relatedMap.RELATED` **그대로 재사용**한다(상세 하단 크로스셀과 동일).
//   진입점과 상세 하단이 서로 다른 동선을 제안하면 흐름이 끊기기 때문(단일 출처).
// ★결정론: 같은 보유 상태 = 같은 추천(Math.random 없음). 비용 0.
// ⚠️ 순서·문구는 마케팅/UX 판단(명리 아님) — Claude 초안, daniel 조정 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { RELATED } from './relatedMap';

/** 추천 결과. from 이 있으면 "○○를 보셨으니 다음은 ○○" 맥락을 붙일 수 있다. */
export type NextStep = {
  key: string;        // 추천 콘텐츠 키(유료 creditKey 또는 무료 item.key)
  reason: string;     // 왜 이걸 추천하는지 한 줄(§4: 부담 주지 않는 톤)
  fromLabel?: string; // 직전에 본 콘텐츠 라벨(맥락 문구용)
};

/**
 * 시작점 — 아직 아무 풀이도 없는 사람에게 권할 첫 콘텐츠.
 * 사주 원국이 나머지 모든 해석의 바탕이라 여기서 출발하는 게 자연스럽다.
 */
const ENTRY_KEY = 'reading';

/**
 * 보유 상태로 '다음 한 걸음'을 고른다.
 *
 * @param owned    이미 본 콘텐츠 키 집합(readings.category 기준 — `celeb_123` 처럼 접미사가 붙은 건 앞부분만)
 * @param labelOf  키 → 표시 라벨(호출부가 i18n/CREDIT_KINDS 로 해석)
 * @param lastKey  가장 최근에 본 콘텐츠 키(있으면 그 지점에서 이어 간다)
 * @returns 추천 1건. 더 권할 게 없으면 null(전부 봤거나 매핑 없음).
 *
 * @remarks 우선순위
 *   ① 아무것도 안 봤다 → 사주 원국(시작점)
 *   ② 최근에 본 것의 RELATED 중 아직 안 본 첫 항목 ("방금 본 것 → 다음"이 가장 자연스러운 연결)
 *   ③ 그게 다 소진됐으면, 본 것들 전체의 RELATED 를 순회해 안 본 첫 항목
 *   ④ 그래도 없으면 null
 */
/** 선택된 카테고리의 항목(호출측이 SECTIONS 에서 baseKey 적용해 넘긴다).
 *  ★이 모듈은 **순수 로직**이라 react-native 를 끌어오는 모듈(contentSections→remoteAsset)을 import 하지 않는다 —
 *    하네스(check:nextstep)가 Node 에서 그대로 실행하기 때문. 2026-08-06 실제로 여기서 빌드가 깨졌다. */
export type CategoryItem = { key: string; creditKey?: string };

export function pickNextStep(
  owned: Set<string>,
  labelOf: (key: string) => string,
  lastKey?: string,
  categoryItems?: CategoryItem[],
): NextStep | null {
  // ⓪ ★카테고리 코너 안이면 **그 코너의 상품**을 권한다(daniel 2026-08-06).
  //   비유(daniel): 홈 배너 = 백화점 밖 사람을 금액 없이 들어오게 하는 것 /
  //                 풀이탭 배너 = **매장에 들어온 사람에게 상품을 권하는 것**.
  //   연애 코너에 들어왔는데 재물 상품을 권하면 그 비유가 깨진다 — 선택된 주제 안에서 고른다.
  //   그 코너에 권할 게 없으면(전부 봤거나 유료가 없으면) 아래 일반 규칙으로 떨어진다.
  if (categoryItems?.length) {
    const items = categoryItems;
    // ★코너에 들어와서도 **무료가 먼저**다(daniel: "매장 안도 처음에는 무료, 거길 들어가면
    //   그때 깊은 통변을 유료로 유도"). 들어오자마자 값을 부르면 매장 밖으로 도로 나간다.
    for (const m of items) {
      if (m.creditKey || owned.has(m.key)) continue;    // 무료만 · 이미 본 것 제외
      return { key: m.key, reason: '먼저 무료로 가볍게 확인해 보세요' };
    }
    // 무료를 다 본 뒤에야 유료 상세를 권한다(퍼널의 마지막 단).
    for (const m of items) {
      if (!m.creditKey || owned.has(m.key)) continue;
      return { key: m.key, reason: '이 주제를 더 깊이 보고 싶다면' };
    }
  }

  // ① 앵커(또는 최근 본 것)에서 이어 가기 — ★시작점 제안보다 **먼저** 본다(daniel 2026-08-06).
  //   풀이탭 상단이 '이달의 운세'(무료) 배너이므로, 그 바로 아래 제안이 그것과 이어져야 화면이 한 흐름이 된다.
  //   종전엔 아무것도 안 본 사람에게 곧장 시작점(사주 원국풀이 = 유료)을 권해 "들어오자마자 값"이 됐다.
  const tryFrom = (from: string): NextStep | null => {
    for (const cand of RELATED[from] ?? []) {
      if (!owned.has(cand)) {
        return { key: cand, reason: `방금 본 ${labelOf(from)} 와 이어지는 이야기예요`, fromLabel: labelOf(from) };
      }
    }
    return null;
  };
  if (lastKey) {
    const hit = tryFrom(lastKey);
    if (hit) return hit;
  }

  // ② 시작점 — 이어 갈 게 없을 때만.
  if (owned.size === 0) {
    return { key: ENTRY_KEY, reason: '여기서 시작하면 나머지 풀이가 훨씬 잘 읽혀요' };
  }

  // ③ 본 것들 전체에서 이어 가기 — owned 를 정렬해 순회(결정론: Set 순회 순서에 기대지 않는다)
  for (const from of [...owned].sort()) {
    const hit = tryFrom(from);
    if (hit) return { ...hit, reason: `${labelOf(from)} 를 보셨으니, 이건 어떠세요` };
  }

  // ④ 더 권할 것 없음
  return null;
}

/**
 * readings.category 목록 → 보유 키 집합.
 * `celeb_123`·`compat_친구` 처럼 접미사가 붙는 카테고리가 있어 **첫 세그먼트만** 취한다.
 * (ContentGrid.badgeFor 의 `startsWith(ck + '_')` 판정과 같은 결.)
 */
export function ownedKeysFrom(categories: string[]): Set<string> {
  return new Set(categories.map((c) => c.split('_')[0]).filter(Boolean));
}
