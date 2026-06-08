// engine/twelve.ts — 12운성(十二運星) 결정론 산출
// ─────────────────────────────────────────────────────────────────────────
// 일간(천간)이 각 지지에서 갖는 기운 상태: 장생→목욕→관대→건록→제왕→쇠→병→사→묘→절→태→양.
//   양간(甲丙戊庚壬) = 순행, 음간(乙丁己辛癸) = 역행. 장생지 기준 12지지 순회.
//   건록·제왕·장생·관대 = 강근(신왕 근거, R11) / 사·묘·절·병·쇠 = 약근.
// ⚠️ 결정론 — 고정 테이블. 통근·신왕·기운 판단의 보조 지표(stance 활용은 P2/daniel).
// ─────────────────────────────────────────────────────────────────────────
import type { Stem, Branch, PillarPos, SajuChart } from '../spec/chart';

export const TWELVE_STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'] as const;
export type TwelveStage = typeof TWELVE_STAGES[number];

// 각 천간의 장생지(長生地)
const CHANGSAENG: Record<Stem, Branch> = {
  甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申', // 양간
  乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯', // 음간
};
const YANG = new Set<Stem>(['甲', '丙', '戊', '庚', '壬']);
const BR: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 천간 × 지지 → 12운성 (양간 순행·음간 역행) */
export function twelveStage(stem: Stem, branch: Branch): TwelveStage {
  const start = BR.indexOf(CHANGSAENG[stem]);
  const idx = BR.indexOf(branch);
  const diff = YANG.has(stem) ? (idx - start + 12) % 12 : (start - idx + 12) % 12;
  return TWELVE_STAGES[diff];
}

/** 일간 기준 각 기둥 지지의 12운성 */
export function dayMasterStages(saju: SajuChart): Record<PillarPos, TwelveStage> {
  const dm = saju.dayMaster.stem;
  const out = {} as Record<PillarPos, TwelveStage>;
  (['년', '월', '일', '시'] as PillarPos[]).forEach((p) => { out[p] = twelveStage(dm, saju.pillars[p].branch); });
  return out;
}

/** 강근(신왕 근거) 운성 — R11 연결 */
export const STRONG_STAGES: TwelveStage[] = ['장생', '관대', '건록', '제왕'];
export const isStrongStage = (s: TwelveStage) => STRONG_STAGES.includes(s);
