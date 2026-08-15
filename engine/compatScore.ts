// engine/compatScore.ts — 궁합 결정론 점수(daniel 6기준·R47) **단일 출처**
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 이 파일이 생겼나 (2026-08-15)
//   같은 두 사람인데 **관계 지도는 65, 궁합 화면은 76**이었다(실측 최대 11점 차).
//   원인: 산식이 두 벌이었다 —
//     · `app/src/lib/content/compatScore.ts`  … daniel 이 2026-07-17 승인한 6기준 가중치
//     · `engine/relationMap.ts` 의 `chemiOf`  … "엔진이 앱을 참조하면 방향이 거꾸로 선다"는 이유로
//                                                내가 **비슷하게 다시 쓴 것**(승인받지 않은 가중치)
//   주석에는 "같은 6기준·같은 서열을 쓴다 · check:relationmap 이 정합을 본다"고 적혀 있었지만
//   **그 하네스는 존재하지 않았고**, 실제 숫자는 갈려 있었다.
//   ⇒ 주석의 '같다'는 보장이 아니다([[duplicate-ui-single-source]]).
//
// ■ 그래서 어떻게 풀었나
//   방향을 뒤집는 대신 **산식을 L1(엔진)으로 내렸다.** 앱(L4)은 이 함수를 부르고 등급·이미지만 얹는다.
//   · 남긴 가중치 = **daniel 승인분**(app 쪽). 내가 지어낸 chemiOf 가중치는 버린다
//     — 명리 stance 는 daniel 것이고, 승인 안 된 두 번째 산식이 살아 있을 이유가 없다(CLAUDE.md §3.3).
//   · 등급 컷(COMPAT_TIERS)·라벨·이미지는 화면 표현이라 앱에 그대로 둔다.
//
// ■ 불변식은 `npm run check:relationmap` 이 지킨다(이번엔 진짜로 만들었다).
// ═══════════════════════════════════════════════════════════════════════════
import type { CompatibilityDx } from './compatibility';

/** 용신 공급 정도 → 가점. daniel ⑤(보완성·보조). */
const SUPPLY_W: Record<string, number> = { 강: 12, 중: 7, 약: 3, 없음: 0 };

/**
 * 점수와 **그 근거**. 화면이 "왜 이 점수인가"를 그대로 읽어 쓸 수 있게 재료를 함께 돌려준다
 * (숫자만 주면 화면이 dx 를 또 뒤져야 하고, 그러다 기준이 갈린다).
 */
export type CompatScoreBreakdown = {
  /** 0~100 (실제로는 [15,97] 클램프 — §4 부정 증폭 금지) */
  score: number;
  /** 조화(합·상생) 작용 수 */
  harmony: number;
  /** 긴장(충·상극) 작용 수 */
  tension: number;
  /** 일간 관계 */
  dmType: CompatibilityDx['dayMasterRelation']['type'];
  /** 상대가 내 용신을 채워주는 정도 */
  supply: CompatibilityDx['usefulGodSupply']['supply'];
  /** ① 계절(월지) 한난 상보 */
  seasonComplement: boolean;
  /** ② 상대 일간이 나에게 재/관이면 그 십신(아니면 null) */
  jaegwan: '재성' | '관성' | null;
  /** ⑥ 배우자궁(두 일지) 형충파해원진 */
  spouseAfflictions: string[];
  /** ③ 상대가 채워주는 내 결핍 지지 글자 */
  fillChars: string[];
};

/**
 * 궁합 결정론 점수. **같은 쌍이면 항상 같은 값**(온디바이스·API 0원).
 *
 * ★가중치 = daniel 명리 stance(2026-07-17 *"일단 너가 제시한 걸로"* 잠정 승인). 6기준:
 *   ① 계절 한난 상보(월지 봄여름↔가을겨울)          +7
 *   ② 상대 일간이 나에게 재/관(내 관점, 재관 동일)    +8
 *   ③ 결핍 지지 글자 보완(상대가 내게 없는 지지)      글자당 +3 (최대 +9)
 *   ④ 일간관계 — "충이 발전형, 합은 좋으나 정체":     충 +7 / 상생 +5 / 합 +4 / 비화 +2 / 상극 0
 *      ⇒ 여기 '충'은 **일간(천간)충**. 일지(지지)충은 ⑥에서 감점 — daniel "충은 일간 말한거야".
 *   ⑤ 용신공급(보조) 강 +12 / 중 +7 / 약 +3  + 교차합(끌림) 합당 +2 (최대 +6)
 *   ⑥ 배우자궁(두 일지) 형충파해원진 없어야:          종류당 −5 (최대 −15)
 *   기준 55 → [15,97] 클램프(극단 회피).
 *
 * @param dx `analyzeCompatibility(me, other)` 결과 — 판정은 전부 그쪽이 한다(여기선 가중합만).
 * @returns 점수 + 근거(화면이 그대로 읽어 쓴다)
 * ⚠️가중치·서열을 바꾸면 `check:compat`(기준 반영)·`check:relationmap`(지도↔궁합 동일)이 함께 운다.
 */
export function compatScoreOf(dx: CompatibilityDx): CompatScoreBreakdown {
  const harmony = dx.harmony.length;
  const tension = dx.tension.length;
  const supply = SUPPLY_W[dx.usefulGodSupply.supply] ?? 0;
  const dmType = dx.dayMasterRelation.type;
  // ④ 일간(천간) 관계 — 충>상생>합>비화>상극. 일간충은 발전형이라 가점(일지충 감점과 별개 축).
  const dmBonus =
    dmType === '충' ? 7 :
    dmType === '상생' ? 5 :
    dmType === '합' ? 4 :
    dmType === '비화' ? 2 : 0; // 상극
  const season = dx.seasonComplement.complementary ? 7 : 0;                 // ①
  const jaegwan = dx.partnerToMe.favorable ? 8 : 0;                         // ②
  const fill = Math.min(dx.missingFill.chars.length, 3) * 3;                // ③ 0~9
  const crossHe = dx.crossInteractions.filter((c) => c.kind.includes('합')).length;
  const heBonus = Math.min(crossHe, 3) * 2;                                 // ⑤ 교차합 0~6
  const spouseMinus = Math.min(dx.spousePalace.afflictions.length, 3) * 5;  // ⑥ 0~15
  let s = 55 + season + jaegwan + fill + dmBonus + supply + heBonus - spouseMinus;
  s = Math.max(15, Math.min(97, Math.round(s)));
  return {
    score: s,
    harmony,
    tension,
    dmType,
    supply: dx.usefulGodSupply.supply,
    seasonComplement: dx.seasonComplement.complementary,
    jaegwan: dx.partnerToMe.favorable ? (dx.partnerToMe.tenGod as '재성' | '관성') : null,
    spouseAfflictions: dx.spousePalace.afflictions,
    fillChars: dx.missingFill.chars,
  };
}
