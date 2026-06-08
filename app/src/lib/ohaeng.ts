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
