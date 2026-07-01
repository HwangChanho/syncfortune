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
};

const SUPPLY_W: Record<string, number> = { '강': 14, '중': 8, '약': 4, '없음': 0 };

/**
 * CompatibilityDx → 0~100 궁합 점수 + 등급. 결정론(같은 쌍 = 같은 점수).
 * 산식: 기준 58 + (조화−긴장)×5 + 용신공급 가중 + 일간관계 가중. [15,97] 클램프.
 *   - 조화/긴장: 일간·일지 등 교차 합충(harmony/tension, 일간 포함)
 *   - 용신공급: 상대가 내 부족(용신) 오행을 채워주는지(궁합의 보완성)
 *   - 일간관계: 합>상생>비화>상극>충 (관계의 코어라 추가 가중)
 */
export function compatScore(dx: CompatibilityDx): CompatScoreResult {
  const harmony = dx.harmony.length;
  const tension = dx.tension.length;
  const supply = SUPPLY_W[dx.usefulGodSupply.supply] ?? 0;
  const dmType = dx.dayMasterRelation.type;
  const dmBonus =
    dmType === '합' ? 8 :
    dmType === '상생' ? 5 :
    dmType === '비화' ? 2 :
    dmType === '상극' ? -6 : -8; // 충
  let s = 58 + (harmony - tension) * 5 + supply + dmBonus;
  s = Math.max(15, Math.min(97, Math.round(s)));
  return { score: s, tier: tierOf(s), harmony, tension, dmType, supply: dx.usefulGodSupply.supply };
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
