// engine/sensitivity.ts — 예민보스(민감도) 결정론 판정 (R35, daniel 공급 2026-06-23)
// ─────────────────────────────────────────────────────────────────────────
// 4요소 중 2개 이상 → '예민보스'. 전체 통변에 참고(성격·관계·건강 등).
//   ① 신약 + 관살혼잡(정관·편관 둘 다, *지장간 포함*) — 압박형 예민
//   ② 신약 + 인성혼잡(정인·편인 둘 다, 지장간 포함) — 수용형 민감
//   ③ 일간 십이운성 死지 + 충(그 死지가 원국 OR 운에서 충)
//   ④ 도화 지지 + 충(원국 OR 운)
//   ⚠️ 辛金 일간 = '예민'이 아니라 '날카로운 전문성(정밀·예리)' — 같은 구조라도 라벨 전환(daniel).
// 결정론(룰) — LLM은 이 결과를 해석에 *참고*만(규칙1).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod, PillarPos } from '../spec/chart';
import { scoreStrength } from './structure';
import { dayMasterStages } from './twelve';
import { analyzeSinsal } from './sinsal';

export interface SensitivityDx {
  isBoss: boolean;     // 2개 이상 = 예민보스
  count: number;       // 적중 요소 수(0~4)
  factors: string[];   // 적중 요소 설명(글라스박스)
  sharpPro: boolean;   // 辛金 = 예민 대신 '날카로운 전문성'
  label: string;       // 통변 라벨
}

const POS: PillarPos[] = ['년', '월', '일', '시'];

// 충에 연루된 지지 집합(원국 + 현재 운). detail 앞 2글자 = 두 지지("卯酉冲"·"巳亥冲(대운×세운)").
function chongBranches(saju: SajuChart): Set<string> {
  const set = new Set<string>();
  const collect = (its?: { type: string; detail: string }[]) => {
    for (const it of its ?? []) if (it.type === '충' && it.detail.length >= 2) { set.add(it.detail[0]); set.add(it.detail[1]); }
  };
  collect(saju.interactions);                       // 원국 충
  collect(saju.annual?.interactionsWithLuck);       // 운(대운×세운) 충
  return set;
}

// 십신 존재 여부(천간 + 지지 본기 + 지장간 — 지장간 포함이 R35 ①② 핵심)
function hasTenGod(saju: SajuChart, tg: TenGod): boolean {
  for (const p of POS) {
    const pil = saju.pillars[p];
    if (p !== '일' && pil.stemTenGod === tg) return true;
    if (pil.branchMainTenGod === tg) return true;
    if (pil.hiddenStems.some((h) => h.tenGod === tg)) return true;
  }
  return false;
}

/** R35 예민보스 판정(결정론). 2개 이상 요소 → isBoss. 辛金은 sharpPro(날카로운 전문성). */
export function sensitivityBoss(saju: SajuChart): SensitivityDx {
  const factors: string[] = [];
  const weak = scoreStrength(saju).verdict === '신약';
  // ① 신약 + 관살혼잡(지장간 포함)
  if (weak && hasTenGod(saju, '정관') && hasTenGod(saju, '편관')) factors.push('신약+관살혼잡(압박에 예민)');
  // ② 신약 + 인성혼잡(지장간 포함)
  if (weak && hasTenGod(saju, '정인') && hasTenGod(saju, '편인')) factors.push('신약+인성혼잡(잘 받아들임·민감)');
  const chong = chongBranches(saju);
  // ③ 일간 십이운성 死지 + 그 지지 충
  const stages = dayMasterStages(saju);
  if (POS.some((p) => stages[p] === '사' && chong.has(saju.pillars[p].branch))) factors.push('일간 사지+충(발산 흔들림)');
  // ④ 도화 지지 + 충
  const sin = analyzeSinsal(saju);
  if (POS.some((p) => (sin.twelve[p] ?? []).some((x) => x.name === '도화') && chong.has(saju.pillars[p].branch))) factors.push('도화 충(감정 동요)');

  const count = factors.length;
  const isBoss = count >= 2;
  const sharpPro = saju.dayMaster.stem === '辛'; // 辛金 = 예민 아닌 날카로운 전문성(daniel)
  const label = sharpPro
    ? (count >= 1 ? '날카로운 전문성(예민 구조를 정밀·예리함으로)' : '안정')
    : (isBoss ? '예민보스(매우 민감)' : count === 1 ? '예민 경향' : '안정');
  return { isBoss, count, factors, sharpPro, label };
}
