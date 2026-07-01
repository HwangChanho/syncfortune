// app/src/lib/samjae.ts — 삼재(三災) 판정. 무료·온디바이스·표준 명리(Claude stance, daniel 검수 슬롯).
// ─────────────────────────────────────────────────────────────────────────
// 삼재 = 띠(태어난 해 지지) 삼합국 기준 3년 동안 드는 액운(통설). 12년 중 3년.
//   申子辰(수국)생 → 寅卯辰년 / 巳酉丑(금국)생 → 亥子丑년 / 寅午戌(화국)생 → 申酉戌년 / 亥卯未(목국)생 → 巳午未년.
//   3년 순서 = 들삼재(시작)·눌삼재(중간·가장 셈)·날삼재(나가는 해).
// ⚠️ §4 안전: 흉 단정·공포 금지 — '조심·정비하는 해'로 전향적 안내(화면 문구). 의료·투자 단정 금지.
// ─────────────────────────────────────────────────────────────────────────

// 띠 지지 → 삼재 드는 3년(지지). 삼합 12지 전부 매핑.
const SAMJAE_YEARS: Record<string, [string, string, string]> = {
  申: ['寅', '卯', '辰'], 子: ['寅', '卯', '辰'], 辰: ['寅', '卯', '辰'], // 水局
  巳: ['亥', '子', '丑'], 酉: ['亥', '子', '丑'], 丑: ['亥', '子', '丑'], // 金局
  寅: ['申', '酉', '戌'], 午: ['申', '酉', '戌'], 戌: ['申', '酉', '戌'], // 火局
  亥: ['巳', '午', '未'], 卯: ['巳', '午', '未'], 未: ['巳', '午', '未'], // 木局
};

export type SamjaePhase = '들삼재' | '눌삼재' | '날삼재';
export type SamjaeResult = { isSamjae: boolean; phase?: SamjaePhase };

/**
 * 삼재 여부 — 태어난 해 지지(birthYearBranch) 기준, 대상 연도 지지(targetYearBranch)가 삼재년인지.
 * @param birthYearBranch 태어난 해 지지(예 '子')
 * @param targetYearBranch 볼 해 지지(예 올해 '巳')
 */
export function samjaeStatus(birthYearBranch: string, targetYearBranch: string): SamjaeResult {
  const years = SAMJAE_YEARS[birthYearBranch];
  if (!years) return { isSamjae: false };
  const idx = years.indexOf(targetYearBranch);
  if (idx < 0) return { isSamjae: false };
  return { isSamjae: true, phase: (['들삼재', '눌삼재', '날삼재'] as const)[idx] };
}
