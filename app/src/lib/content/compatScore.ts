// app/src/lib/compatScore.ts — 궁합 점수(0~100)·등급·등급별 이미지 (온디바이스·결정론·API 0).
// ─────────────────────────────────────────────────────────────────────────
// daniel: 궁합은 메인 콘텐츠 → 점수 + 등급별 이미지 + 상세 풀이. 점수는 두 명식에서 *결정론적*
//   으로 산출(같은 쌍 = 항상 같은 점수). 근거 = engine/compatibility 의 CompatibilityDx
//   (일간관계·교차 조화/긴장·용신 공급). ★stance(Claude 초안 — daniel 검수 슬롯): 가중치·등급 컷.
//   §4: 부정 증폭 금지 — 낮은 점수도 '도전·성장형'으로 전향적 라벨.
// ─────────────────────────────────────────────────────────────────────────
import type { CompatibilityDx } from '@engine/compatibility';

export type CompatTier = { key: string; min: number; emoji: string; ko: string; en: string; ja: string };

// 등급(점수 내림차순) — key = assets/icons/compat/{key}.jpg. 라벨은 전향적(낮아도 성장형).
export const COMPAT_TIERS: CompatTier[] = [
  { key: 'soulmate', min: 88, emoji: '💞', ko: '천생연분',        en: 'Soulmates',          ja: '運命の相手' },
  { key: 'great',    min: 76, emoji: '💖', ko: '아주 좋은 인연',  en: 'Wonderful Match',    ja: 'とても良い縁' },
  { key: 'good',     min: 64, emoji: '💗', ko: '좋은 궁합',       en: 'Good Match',         ja: '良い相性' },
  { key: 'steady',   min: 52, emoji: '🤝', ko: '무난·노력형',     en: 'Steady & Worth It',  ja: '無難・努力型' },
  { key: 'spark',    min: 40, emoji: '⚡', ko: '도전적인 인연',   en: 'Challenging Spark',  ja: '挑戦的な縁' },
  { key: 'opposite', min: 0,  emoji: '🌗', ko: '극과 극',         en: 'Opposites Attract',  ja: '正反対' },
];

export type CompatScoreResult = {
  score: number;          // 0~100(실제로는 15~97로 클램프 — 0/100 극단 회피)
  tier: CompatTier;
  harmony: number;        // 조화(합·상생) 작용 수
  tension: number;        // 긴장(충·상극) 작용 수
  dmType: CompatibilityDx['dayMasterRelation']['type']; // 일간 관계
  supply: CompatibilityDx['usefulGodSupply']['supply']; // 상대가 내 용신 채워주는 정도
  // daniel 궁합 기준(2026-07-17) — 표시·근거용
  seasonComplement: boolean;                 // 계절(월지) 한난 상보
  jaegwan: '재성' | '관성' | null;           // 상대 일간이 나에게 재/관(내 관점)이면
  spouseAfflictions: string[];               // 배우자궁(일지) 형충파해원진귀문
  fillChars: string[];                       // 상대가 채워주는 내 결핍 지지 글자
};

const SUPPLY_W: Record<string, number> = { '강': 12, '중': 7, '약': 3, '없음': 0 };

/**
 * CompatibilityDx → 0~100 궁합 점수 + 등급. 결정론(같은 쌍 = 같은 점수).
 * ★가중치 = daniel 검수 슬롯(2026-07-17 "일단 너가 제시한 걸로" 잠정 승인). daniel 6기준:
 *   ① 계절 한난 상보(월지 봄여름↔가을겨울)         +7
 *   ② 상대 일간이 나에게 재/관(내 관점, 재관 동일)   +8
 *   ③ 결핍 지지 글자 보완(상대가 내게 없는 지지)     글자당 +3 (최대 +9)
 *   ④ 일간관계 — ★"충이 발전형, 합은 좋으나 정체":  충 +7 / 상생 +5 / 합 +4 / 비화 +2 / 상극 0
 *      ⇒ 여기 '충'은 **일간(천간)충**. 일지(지지)충은 ⑥에서 감점 — daniel "충은 일간 말한거야".
 *   ⑤ 용신공급(보완성, 보조):                        강 +12 / 중 +7 / 약 +3
 *      + 교차합(끌림, 보조):                          합당 +2 (최대 +6)
 *   ⑥ 배우자궁(두 일지) 형충파해원진귀문 없어야:      종류당 −5 (최대 −15)
 *   기준 55 → [15,97] 클램프(§4 부정 증폭 금지 — 극단 회피).
 */
export function compatScore(dx: CompatibilityDx): CompatScoreResult {
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
  const season = dx.seasonComplement.complementary ? 7 : 0;           // ①
  const jaegwan = dx.partnerToMe.favorable ? 8 : 0;                   // ②
  const fill = Math.min(dx.missingFill.chars.length, 3) * 3;          // ③ 0~9
  const crossHe = dx.crossInteractions.filter((c) => c.kind.includes('합')).length;
  const heBonus = Math.min(crossHe, 3) * 2;                           // ⑤ 교차합 0~6
  const spouseMinus = Math.min(dx.spousePalace.afflictions.length, 3) * 5; // ⑥ 0~15
  let s = 55 + season + jaegwan + fill + dmBonus + supply + heBonus - spouseMinus;
  s = Math.max(15, Math.min(97, Math.round(s)));
  return {
    score: s, tier: tierOf(s), harmony, tension, dmType, supply: dx.usefulGodSupply.supply,
    seasonComplement: dx.seasonComplement.complementary,
    jaegwan: dx.partnerToMe.favorable ? (dx.partnerToMe.tenGod as '재성' | '관성') : null,
    spouseAfflictions: dx.spousePalace.afflictions,
    fillChars: dx.missingFill.chars,
  };
}

/**
 * 점수(0~100) → 등급. R26: 궁합 점수를 *LLM이 입체적으로 직접 산출*하므로(가산표 아님),
 *   그 점수를 등급·이미지로 매핑할 때 사용. compatScore(결정론)는 LLM 생성 전 *임시(폴백)* 점수.
 */
export function tierOf(score: number): CompatTier {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return COMPAT_TIERS.find((x) => s >= x.min) ?? COMPAT_TIERS[COMPAT_TIERS.length - 1];
}

/** 등급 라벨(다국어). */
export function tierLabel(tier: CompatTier, lang: 'ko' | 'en' | 'ja'): string {
  return (tier as any)[lang] ?? tier.ko;
}
