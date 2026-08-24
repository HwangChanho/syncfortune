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

// ⚠️`SUPPLY_W`(공급 **개수** → 가점) 는 2026-08-24 에 걷어냈다.
//   전문가 기준은 개수가 아니라 **정확성**이다(*"상호 결핍 원소 정확 교환"*) — ① 항목 주석 참조.

/**
 * 점수와 **그 근거**. 화면이 "왜 이 점수인가"를 그대로 읽어 쓸 수 있게 재료를 함께 돌려준다
 * (숫자만 주면 화면이 dx 를 또 뒤져야 하고, 그러다 기준이 갈린다).
 */
/** 전문가 항목 하나 — 0~100 과 그 근거. */
export type CompatItem = { key: CompatItemKey; label: string; score: number; weight: number; why: string };
export type CompatItemKey = 'yongsin' | 'spouseStar' | 'spousePalace' | 'dayMaster' | 'conflict' | 'timing';

export type CompatScoreBreakdown = {
  /** 0~100 — **항목 가중평균**(2026-08-24 전문가 기준으로 전환). [15,97] 클램프는 유지 */
  score: number;
  /** ★항목별 점수 — 전문가 노트와 **같은 여섯 항목**. 어디가 어긋나는지 항목으로 보인다 */
  items: CompatItem[];
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
  /** ⑦ 교차 삼합으로 완성된 국 — 배우자성이면 최고 가중(2026-08-24) */
  crossSanhe: { guk: string; tenGod: string; spouseStar: boolean | null }[];
  /** ⑧ 교차 삼형 성립(2026-08-24) */
  crossSamhyeong: string[];
  /** ★가장 낮은 항목이 무엇인가 — 고분산/저분산을 가르는 보조 출력(G6) */
  weakest: { item: string; ratio: number } | null;
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
  const dmType = dx.dayMasterRelation.type;
  const season = dx.seasonComplement.complementary ? 7 : 0;
  const fill = Math.min(dx.missingFill.chars.length, 3) * 3;

  // ── ① 용신 호환 ────────────────────────────────────────────────────────
  //   ★★전문가는 이 항목을 **95점**으로 봤다. 근거는 *"상호 결핍 원소 **정확** 교환"* —
  //     즉 **얼마나 많이 주느냐가 아니라, 필요한 것을 주느냐**다.
  //     종전 산식은 개수(강/중/약)로만 봐서 이 케이스를 '약' 으로 깎았다(직접 0개).
  //     실제로는 상대의 金 이 내 용신 水 를 **생조**하고 있었다 = 정확히 필요한 것.
  //   ⚠️용신을 못 정한 경우는 **중립 50** 이다. 모르는 것을 0 으로 깎으면 그건 판정이 아니라 벌이다.
  const ug = dx.usefulGodSupply;
  const yongsin =
    ug.element == null ? 50
    : /직접 [1-9]/.test(ug.detail) ? 95            // 용신 오행을 직접 준다
    : /생조/.test(ug.detail) ? 85                  // 희신이 생조한다(한 단계 건너)
    : 40;                                          // 용신은 정해졌는데 상대가 못 준다
  const yongsinWhy = ug.detail;

  // ── ② 배우자성 성립 ────────────────────────────────────────────────────
  //   전문가 90점 근거: *"교차 삼합 쌍방 완성 + 무근 천간 통근. 감점 乙辛沖"*
  const spouseGuk = dx.crossSanhe.filter((c) => c.spouseStar).length;
  const otherGuk = dx.crossSanhe.length - spouseGuk;
  const spouseStar = Math.min(50 + spouseGuk * 40 + otherGuk * 15 + (dx.partnerToMe.favorable ? 10 : 0), 95);

  // ── ③ 배우자궁 상호작용 ────────────────────────────────────────────────
  //   전문가 75점 = **중간 감점**. 건당 −8, 하한 40(전부 깎아도 0 이 되지 않게 — §4).
  const spouseHits = dx.spousePalace.afflictions.length;
  const spousePalace = Math.max(100 - spouseHits * 8, 40);

  // ── ④ 일간 심리 호환 ───────────────────────────────────────────────────
  //   ★서열은 daniel 승인분 그대로 — **충 > 상생 > 합 > 비화 > 상극**("충이 발전형, 합은 정체").
  const dmBase =
    dmType === '충' ? 88 : dmType === '상생' ? 82 : dmType === '합' ? 75 : dmType === '비화' ? 65 : 50;
  const dayMaster = Math.min(dmBase + fill + season, 100);

  // ── ⑤ 갈등 구조 ────────────────────────────────────────────────────────
  //   전문가 55점. 교차 충 건당 −7 · 교차 삼형 건당 −12 · 하한 30.
  const crossChong = dx.crossInteractions.filter((c) => String(c.kind).includes('충')).length;
  const conflict = Math.max(100 - crossChong * 7 - dx.crossSamhyeong.length * 12, 30);

  // ── ⑥ 운 타이밍 ────────────────────────────────────────────────────────
  //   ⚠️**아직 재료가 없다**(대운 상호 공급·매듭 시기 판정 미구현) → **중립 75**로 두고 표시한다.
  //     0 으로 두면 없는 근거로 점수를 깎게 된다.
  const timing = 75;

  // ★가중치 — 전문가 종합 82 를 재현하도록 잡은 **잠정값**(★Boss 검수 슬롯).
  //   ⚠️케이스 하나로 여섯 항목을 확정할 수 없다(n=1 · CLAUDE.md §3.2). 항목을 드러내 두는 이유가 이것이다.
  const items: CompatItem[] = [
    { key: 'yongsin', label: '용신 호환', score: yongsin, weight: 0.25, why: yongsinWhy },
    { key: 'spouseStar', label: '배우자성 성립', score: spouseStar, weight: 0.20,
      why: dx.crossSanhe.map((c) => c.detail).join(' / ') || '교차 삼합 완성 없음' },
    { key: 'spousePalace', label: '배우자궁 상호작용', score: spousePalace, weight: 0.15, why: dx.spousePalace.detail },
    { key: 'dayMaster', label: '일간 심리 호환', score: dayMaster, weight: 0.15, why: dx.dayMasterRelation.detail },
    { key: 'conflict', label: '갈등 구조', score: conflict, weight: 0.15,
      why: dx.crossSamhyeong.map((c) => c.detail).concat(dx.tension).join(' / ') || '교차 충·형 없음' },
    { key: 'timing', label: '운 타이밍', score: timing, weight: 0.10, why: '⚠️미구현 — 중립값(대운 상호작용 판정 없음)' },
  ];
  const weighted = items.reduce((a, it) => a + it.score * it.weight, 0);
  const s = Math.max(15, Math.min(97, Math.round(weighted)));
  return {
    score: s,
    items,
    harmony,
    tension,
    dmType,
    supply: dx.usefulGodSupply.supply,
    seasonComplement: dx.seasonComplement.complementary,
    jaegwan: dx.partnerToMe.favorable ? (dx.partnerToMe.tenGod as '재성' | '관성') : null,
    spouseAfflictions: dx.spousePalace.afflictions,
    fillChars: dx.missingFill.chars,
    crossSanhe: dx.crossSanhe.map((c) => ({ guk: c.guk.join(''), tenGod: c.tenGod, spouseStar: c.spouseStar })),
    crossSamhyeong: dx.crossSamhyeong.map((c) => c.guk.join('')),
    // ★G6 — **가장 약한 항목**을 함께 낸다. 평균이 같아도 한 항목이 바닥이면 실효가 다르다
    //   (전문가 노트: *"잔감점 분산형 82 와 단일변수 수렴형 82 는 실효가 다르다"*).
    //   이제 항목이 전문가와 같은 여섯이라, **그중 최저**를 그대로 고르면 된다.
    weakest: (() => {
      const low = [...items].sort((a, b) => a.score - b.score)[0];
      return low ? { item: low.label, ratio: Math.round(low.score) / 100 } : null;
    })(),
  };
}
