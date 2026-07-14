// app/src/lib/content/personalOhaeng.ts — 퍼스널 오행(컬러·코디·메이크업·자동차) 결정론 추천(온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 기획서 Phase 2(2026-07-14): 무료 결정론 콘텐츠. 팔자 오행 밸런스 →
//   ① 강조 컬러(강한 오행 = 타고난 나를 살리는 색) ② 보완 컬러(용신/부족 오행 = 채우면 좋은 색)
//   + 코디 결 · 메이크업 톤 · 자동차 색. BM(뷰티/패션 제휴 링크)의 토대.
// ★★daniel 검수 슬롯: 아래 PROFILE 매핑(오행→컬러/코디/메이크업/차색)은 *후보 초안* — Boss 검수/수정.
//   §4 안전: 긍정·강점 프레이밍. 의학/단정 아님(취향·기운 보완 제안).
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, branchElement } from '../engine/ohaeng';
import { computeYongsinApprox } from './yongsinApprox';
import type { SajuChart } from '@spec/chart';

const EL = ['木', '火', '土', '金', '水'] as const;
export const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' };

// ★daniel 검수 후보 — 오행별 퍼스널 프로필. hex = 화면 스와치 색(대표 3색).
export interface OhaengProfile {
  colors: string[]; // 컬러 이름(일상어)
  hex: string[];    // 스와치 hex(대표 3)
  cody: string;     // 코디 결
  makeup: string;   // 메이크업 톤
  car: string;      // 자동차 색
}
export const PROFILE: Record<string, OhaengProfile> = {
  木: { colors: ['초록', '민트', '연두'], hex: ['#3E8E5A', '#7FD1AE', '#B6E388'], cody: '자연스럽고 편안한 라인', makeup: '내추럴 그린·브라운', car: '그린·카키' },
  火: { colors: ['레드', '코랄', '핑크'], hex: ['#C0392B', '#FF7F6B', '#FF9FB0'], cody: '화사한 포인트 스타일', makeup: '코랄·웜톤', car: '레드' },
  土: { colors: ['옐로', '베이지', '브라운'], hex: ['#C9A14A', '#D8C89A', '#9C7A4A'], cody: '클래식하고 안정적인 결', makeup: '베이지·뉴트럴', car: '베이지·골드·브라운' },
  金: { colors: ['화이트', '실버', '아이보리'], hex: ['#EDE7D6', '#D2CCBA', '#FFFFFF'], cody: '미니멀하고 깔끔한 결', makeup: '클리어·쿨톤', car: '화이트·실버' },
  水: { colors: ['블랙', '네이비', '블루'], hex: ['#15132E', '#3A4E7A', '#2C5FA8'], cody: '시크하고 모던한 결', makeup: '쿨·딥 톤', car: '블랙·네이비' },
};

// 오행별 한 줄 성향(강조/보완 카피용, §4 전향적).
export const EL_VIBE: Record<string, string> = {
  木: '뻗어나가는 성장의 기운', 火: '밝게 빛나는 표현의 기운', 土: '든든한 안정의 기운', 金: '단정한 결단의 기운', 水: '깊고 유연한 지혜의 기운',
};

export interface PersonalOhaeng {
  dominant: string;             // 강한 오행(강조 컬러)
  needed: string;               // 용신/부족 오행(보완 컬러)
  activate: OhaengProfile;      // 강조 프로필
  balance: OhaengProfile;       // 보완 프로필
  counts: Record<string, number>;
  neededIsYongsin: boolean;     // needed 가 용신 산출값인지(참) / 부족 오행 폴백인지(거짓)
}

/** 팔자 오행 밸런스 → 퍼스널 컬러·코디·메이크업·자동차 추천(결정론). saju = computeChart(...).saju */
export function personalOhaeng(saju: SajuChart): PersonalOhaeng | null {
  if (!saju?.pillars) return null;
  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of ['년', '월', '일', '시'] as const) {
    const pd = saju.pillars[p];
    if (!pd) continue;
    if (stemElement(pd.stem) in counts) counts[stemElement(pd.stem)]++;
    if (branchElement(pd.branch) in counts) counts[branchElement(pd.branch)]++;
  }
  const sorted = [...EL].sort((a, b) => counts[b] - counts[a]);
  const dominant = sorted[0];

  // 보완 = 용신(내게 필요한 기운) 우선, 실패 시 가장 부족한 오행. 단 dominant 와 같으면 차순위.
  let needed = '', neededIsYongsin = false;
  try {
    const y = computeYongsinApprox(saju, { timeUnknown: !!(saju as any)?.timeUnknown }).yongsin;
    if (y && y !== dominant) { needed = y; neededIsYongsin = true; }
  } catch { /* 폴백 */ }
  if (!needed) {
    const lack = [...EL].sort((a, b) => counts[a] - counts[b]).find((e) => e !== dominant) ?? sorted[sorted.length - 1];
    needed = lack;
  }

  return { dominant, needed, activate: PROFILE[dominant], balance: PROFILE[needed], counts, neededIsYongsin };
}
