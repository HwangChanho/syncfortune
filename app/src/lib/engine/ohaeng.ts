// app/src/lib/ohaeng.ts — 오행(五行) 매핑 + 색상 (천간·지지 → 木火土金水)
// ─────────────────────────────────────────────────────────────────────────
// 카톡 만세력 앱 참고 — 명식 기둥(천간·지지)을 오행색으로 시각화(가독·전통성).
// 천간 오행: 甲乙木 丙丁火 戊己土 庚辛金 壬癸水
// 지지 오행: 寅卯木 巳午火 辰戌丑未土 申酉金 亥子水
// ─────────────────────────────────────────────────────────────────────────

const STEM_EL: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const BRANCH_EL: Record<string, string> = {
  寅: '木', 卯: '木', 巳: '火', 午: '火',
  辰: '土', 戌: '土', 丑: '土', 未: '土',
  申: '金', 酉: '金', 亥: '水', 子: '水',
};

export function stemElement(stem: string): string { return STEM_EL[stem] ?? '土'; }
export function branchElement(branch: string): string { return BRANCH_EL[branch] ?? '土'; }

// 오행색 (전통 오행색 채도 조정 — 미드나잇 배경과 조화)
export const elementColor: Record<string, string> = {
  木: '#3E8E5A',  // 청록(목)
  火: '#C0392B',  // 적(화)
  土: '#C9A14A',  // 황·골드(토)
  金: '#D2CCBA',  // 백·회(금)
  水: '#3A4E7A',  // 청흑(수)
};
// 오행색 배경 위 텍스트색 (밝은 토·금 = 남색 / 어두운 목·화·수 = 흰색)
export const elementText: Record<string, string> = {
  木: '#FFFFFF', 火: '#FFFFFF', 土: '#15132E', 金: '#15132E', 水: '#FFFFFF',
};

// ── 간지 한글음 (만세력 표기 — 한자 옆 작은 한글 독음. 카톡 포스텔러 참고) ──
const STEM_KO: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const BRANCH_KO: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};
export function stemReading(stem: string): string { return STEM_KO[stem] ?? ''; }
export function branchReading(branch: string): string { return BRANCH_KO[branch] ?? ''; }

// 음양(陰陽) — 천간/지지의 극성(daniel: 만세력 음양 표시·R27 통변 4축). 양=甲丙戊庚壬·子寅辰午申戌 / 음=나머지.
const STEM_YY: Record<string, string> = { '甲': '+', '丙': '+', '戊': '+', '庚': '+', '壬': '+', '乙': '-', '丁': '-', '己': '-', '辛': '-', '癸': '-' };
const BRANCH_YY: Record<string, string> = { '子': '+', '寅': '+', '辰': '+', '午': '+', '申': '+', '戌': '+', '丑': '-', '卯': '-', '巳': '-', '未': '-', '酉': '-', '亥': '-' };
export function stemYinYang(stem: string): string { return STEM_YY[stem] ?? ''; }
export function branchYinYang(branch: string): string { return BRANCH_YY[branch] ?? ''; }

// ── 음양·조후 쏠림(daniel: 만세력 표시 + 탭 설명·대응법) ──────────────────
// 음양 쏠림 — 팔자 8글자(천간4+지지4)의 양/음 집계. |차| 큰 쪽이 쏠림(중화가 좋음).
export function eumYangSkew(pillars: any, sex?: string): { yang: number; yin: number; skew: '양 쏠림' | '음 쏠림' | '균형' } {
  let yang = 0, yin = 0;
  for (const p of ['년', '월', '일', '시']) {
    const d = pillars?.[p]; if (!d) continue;
    if (stemYinYang(d.stem) === '+') yang++; else if (stemYinYang(d.stem) === '-') yin++;
    if (branchYinYang(d.branch) === '+') yang++; else if (branchYinYang(d.branch) === '-') yin++;
  }
  // daniel: 성별도 음양에 포함(남=양·여=음).
  if (sex === '남') yang++; else if (sex === '여') yin++;
  const diff = yang - yin;
  return { yang, yin, skew: diff >= 3 ? '양 쏠림' : diff <= -3 ? '음 쏠림' : '균형' };
}
// 조후(한난) 쏠림 — 火(따뜻)·水(차가움) 세력 + 월지(계절) 가중. ★단순화 산출 — 명리 stance 정교화는 daniel 검수 슬롯.
export function johuSkew(pillars: any): { warm: number; cold: number; skew: '더움 쏠림' | '추움 쏠림' | '중화' } {
  let warm = 0, cold = 0;
  for (const p of ['년', '월', '일', '시']) {
    const d = pillars?.[p]; if (!d) continue;
    const w = p === '월' ? 2 : 1; // 월지=계절 본령이라 가중
    if (stemElement(d.stem) === '火') warm++; else if (stemElement(d.stem) === '水') cold++;
    if (branchElement(d.branch) === '火') warm += w; else if (branchElement(d.branch) === '水') cold += w;
  }
  const diff = warm - cold;
  return { warm, cold, skew: diff >= 2 ? '더움 쏠림' : diff <= -2 ? '추움 쏠림' : '중화' };
}

// 조습(燥濕) 쏠림 — 濕(水·습토 辰丑) vs 燥(火·조토 未戌). 한난(johuSkew)과 함께 '한난조습'을 이룸.
//   ★단순화 산출 — 명리 stance 정교화(木생발·金수렴 반영 등)는 daniel 검수 슬롯.
export function joSeupSkew(pillars: any): { wet: number; dry: number; skew: '습함 쏠림' | '건조 쏠림' | '중화' } {
  let wet = 0, dry = 0;
  const WET_BR = new Set(['辰', '丑']); // 습토(濕土)
  const DRY_BR = new Set(['未', '戌']); // 조토(燥土)
  for (const p of ['년', '월', '일', '시']) {
    const d = pillars?.[p]; if (!d) continue;
    const w = p === '월' ? 2 : 1; // 월지=계절 본령 가중
    if (stemElement(d.stem) === '水') wet++; else if (stemElement(d.stem) === '火') dry++;
    const be = branchElement(d.branch);
    if (be === '水') wet += w; else if (be === '火') dry += w;
    if (WET_BR.has(d.branch)) wet += w; else if (DRY_BR.has(d.branch)) dry += w; // 습토/조토(土 지지라 위 火水 미해당분 가산)
  }
  const diff = wet - dry;
  return { wet, dry, skew: diff >= 2 ? '습함 쏠림' : diff <= -2 ? '건조 쏠림' : '중화' };
}
