// app/src/lib/compatScore.ts — 궁합 등급·등급별 이미지 (온디바이스·결정론·API 0).
// ─────────────────────────────────────────────────────────────────────────
// daniel: 궁합은 메인 콘텐츠 → 점수 + 등급별 이미지 + 상세 풀이. 점수는 두 명식에서 *결정론적*
//   으로 산출(같은 쌍 = 항상 같은 점수). 근거 = engine/compatibility 의 CompatibilityDx
//   (일간관계·교차 조화/긴장·용신 공급). ★stance(Claude 초안 — daniel 검수 슬롯): 가중치·등급 컷.
//   §4: 부정 증폭 금지 — 낮은 점수도 '도전·성장형'으로 전향적 라벨.
//
// ★2026-08-15 — **산식은 여기 없다.** `engine/compatScore.ts` 로 내렸다.
//   이유: 관계 지도가 같은 6기준을 **다시 써서** 같은 쌍에 다른 숫자를 냈다(지도 65 ↔ 궁합 76).
//   이제 이 파일은 점수를 **엔진에서 받아** 등급·이미지(=화면 표현)만 얹는다.
//   ⚠️import 가 `@engine` alias 가 아니라 상대경로인 이유: `scripts/check-compat.ts` 가
//     루트 tsconfig(paths 없음)로 이 모듈을 직접 부른다 — alias 를 쓰면 그 하네스가 죽는다.
// ─────────────────────────────────────────────────────────────────────────
import type { CompatibilityDx } from '@engine/compatibility';
import { compatScoreOf, type CompatScoreBreakdown } from '../../../../engine/compatScore';

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

/** 점수·근거(엔진) + 등급(화면). 필드 구성은 예전 그대로라 쓰는 쪽은 안 바뀐다. */
export type CompatScoreResult = CompatScoreBreakdown & { tier: CompatTier };

/**
 * CompatibilityDx → 궁합 점수 + 등급. 결정론(같은 쌍 = 같은 점수).
 *
 * 점수 산식(daniel 6기준·가중치)은 **`engine/compatScore.ts` 가 정본**이다 — 관계 지도도 같은
 * 함수를 부른다. 여기서는 등급(COMPAT_TIERS)만 얹는다. 등급 컷을 바꿔도 점수는 안 흔들린다.
 *
 * @param dx `analyzeCompatibility(me, other)` 결과
 * @returns 점수·근거 + 등급(이미지 키·다국어 라벨 포함)
 */
export function compatScore(dx: CompatibilityDx): CompatScoreResult {
  const b = compatScoreOf(dx);
  return { ...b, tier: tierOf(b.score) };
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
