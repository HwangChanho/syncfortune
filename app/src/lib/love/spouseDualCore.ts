// app/src/lib/love/spouseDualCore.ts — R-SPOUSE-DUAL 순수 결정론 코어(지지 테이블만·@engine 무의존)
// ─────────────────────────────────────────────────────────────────────────
// 스펙: /R-SPOUSE-DUAL_spec.md. 여기엔 **차트 무관 순수 로직만**(지지쌍 관계·세운 라벨·강도) 둔다.
//   배우자성 '위치' 산출(십신)은 @engine 필요라 spouseDual.ts 에 있고, 이 코어를 재사용한다.
//   ★분리 이유(check-compat 와 동일): 골든 하네스(check-spouse-dual)가 alias 없이 tsx 로 이 파일만 import 해
//     辛丑 §3.2 라벨을 불변식으로 검증할 수 있게. (@engine 을 런타임 import 하면 tsx 에서 안 돈다.)
// ⚠️강도·라벨 규칙 = daniel 스펙(§3·§7.1). 발명 아님(인코딩).
// ─────────────────────────────────────────────────────────────────────────
import type { Branch } from '@spec/chart'; // 타입 전용(런타임 제거 — tsx 안전)

const ORDER: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];   // 6충
const SIXHE: [Branch, Branch][] = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];   // 육합
const SANHE: Branch[][] = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];               // 삼합 3국
const WANGZHI: Branch[] = ['子', '午', '卯', '酉'];                                                                // 왕지
const BANGHAP: { group: Branch[]; wang: Branch }[] = [
  { group: ['寅', '卯', '辰'], wang: '卯' }, { group: ['巳', '午', '未'], wang: '午' },
  { group: ['申', '酉', '戌'], wang: '酉' }, { group: ['亥', '子', '丑'], wang: '子' },
];
const PA: [Branch, Branch][] = [['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['戌', '未']];     // 육파
const WONJIN: [Branch, Branch][] = [['子', '未'], ['丑', '午'], ['寅', '酉'], ['卯', '申'], ['辰', '亥'], ['巳', '戌']]; // 원진(daniel 07-17 확정)

const inPair = (list: [Branch, Branch][], a: Branch, b: Branch) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const sameSanhe = (a: Branch, b: Branch) => SANHE.some((g) => g.includes(a) && g.includes(b));
/** 반합: 같은 삼합국 + 한쪽 왕지. */
export const isBanhap = (a: Branch, b: Branch) => a !== b && sameSanhe(a, b) && (WANGZHI.includes(a) || WANGZHI.includes(b));
/** 방합: 같은 계절국 + 한쪽 왕지(半방=미성립). */
export const isBanghap = (a: Branch, b: Branch) => a !== b && BANGHAP.some((k) => k.group.includes(a) && k.group.includes(b) && (a === k.wang || b === k.wang));
/** 육합. */
export const isSixhe = (a: Branch, b: Branch) => inPair(SIXHE, a, b);
/** 격각: 지지 순서 정확히 2칸(사이 한 지지). */
const isGyeokgak = (a: Branch, b: Branch) => { const d = Math.abs(ORDER.indexOf(a) - ORDER.indexOf(b)); return Math.min(d, 12 - d) === 2; };

/** 두 지지 관계 + 발동/안착 강도(§7.1). */
export type SpouseRelation = {
  same: boolean; chong: boolean; wonjin: boolean; pa: boolean; gyeokgak: boolean;
  sixhe: boolean; banhap: boolean; banghap: boolean;
  ignition: number; // 발동강도(사건): 충90·원진70·파50·격각40
  settle: number;   // 안착강도(타입): 육합80·반합50·방합40
};
export function relationOf(a: Branch, b: Branch): SpouseRelation {
  const same = a === b;
  const chong = inPair(CHONG, a, b);
  const wonjin = inPair(WONJIN, a, b);
  const pa = inPair(PA, a, b);
  const gyeokgak = !chong && isGyeokgak(a, b); // 충(6칸) 우선
  const sixhe = inPair(SIXHE, a, b);
  const banhap = isBanhap(a, b);
  const banghap = !banhap && isBanghap(a, b);
  const ignition = chong ? 90 : wonjin ? 70 : pa ? 50 : gyeokgak ? 40 : 0;
  const settle = sixhe ? 80 : banhap ? 50 : banghap ? 40 : 0;
  return { same, chong, wonjin, pa, gyeokgak, sixhe, banhap, banghap, ignition, settle };
}

export type SpouseLabel = 'EVENT_CANDIDATE' | 'TYPE_A_ACTIVE' | 'TYPE_A_RESOLVE' | 'TYPE_B_SETTLE' | 'CONFIRM';

/** 세운지지 vs 배우자성/궁 → 그 해의 인연 라벨(복수 가능). §3 판단표. */
export function yearLabels(starB: Branch | null, gungB: Branch, seunB: Branch): SpouseLabel[] {
  const labels: SpouseLabel[] = [];
  const g = relationOf(gungB, seunB);
  const s = starB ? relationOf(starB, seunB) : null;
  if (g.same) labels.push('CONFIRM');                                          // 세운 복음(궁)
  if (g.chong) labels.push('EVENT_CANDIDATE');                                 // 세운 충 궁
  if (s && (s.sixhe || s.banhap || s.banghap)) labels.push('TYPE_A_ACTIVE');   // 세운 합 성
  if (s && s.chong) labels.push('TYPE_A_RESOLVE');                             // 세운 충 성
  if (!g.same && (g.sixhe || g.banhap || g.banghap)) labels.push('TYPE_B_SETTLE'); // 세운 합 궁
  return labels;
}

/** 세운 지지(연도 → 지지). 子=서기 (year-4)%12==0. */
export function seunBranchOfYear(year: number): Branch { return ORDER[(((year - 4) % 12) + 12) % 12]; }

/** 나이대 경향(§7.3) — 배우자성-년지 합=연상 / 배우자궁-시지 합=연하·케어. */
export function ageTendencyOf(starB: Branch | null, yearB: Branch | undefined, gungB: Branch, hourB: Branch | undefined): { elder: number; younger: number } {
  let elder = 0, younger = 0;
  if (starB && yearB) { if (isSixhe(starB, yearB)) elder += 30; else if (isBanhap(starB, yearB)) elder += 15; }
  if (hourB) { if (isSixhe(gungB, hourB)) younger += 30; else if (isBanhap(gungB, hourB)) younger += 15; }
  return { elder, younger };
}
