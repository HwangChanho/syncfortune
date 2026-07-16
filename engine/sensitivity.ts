// engine/sensitivity.ts — 예민보스(민감도) 결정론 판정 (R35)
// ─────────────────────────────────────────────────────────────────────────
// ★2026-07-16 전문가 재검수로 판정 기준 전면 교체(daniel 승인). 구 4요소 룰은 폐기.
//   전문가 원문: "土가 없고, 주변 글자가 일간에게 도움이 되지 않을 경우, 예민함."
//
//   신 기준 = 2조건 AND:
//     ① 원국에 土 오행 부재 — 土는 오행의 완충·중재(계절 전환·조습 조절). 土가 없으면
//        나머지 오행의 상생·상극이 직접 부딪혀 기복이 크고 자극에 민감해진다는 관법.
//     ② 주변 글자가 일간을 돕지 않음 — 명리에서 '일간을 돕는' 것 = 생조(인성이 生·비겁이 扶).
//        생조가 약해 일간이 고립되면 외부 자극을 완충 없이 받는다.
//        ⚠️ "주변 미조력"을 **신약(scoreStrength.verdict==='신약')으로 근사**한다.
//           전문가 원문이 자연어라 정확한 산식이 없다 → ★daniel 검수 슬롯:
//           (a) 신약 근사가 맞는가, 아니면 (b) 일간 인접(월지·일지) 국소 생조만 봐야 하는가.
//
//   ⚠️ 辛金 일간 = '예민'이 아니라 '날카로운 전문성(정밀·예리)' — 같은 구조라도 라벨 전환(daniel).
//
// 〔구 룰(폐기·2026-06-23~07-16): 4요소 중 2개 이상 → 예민. ①신약+관살혼잡 ②신약+인성혼잡
//   ③일간 사지+충 ④도화 충. 전문가가 "土 부재 + 일간 미조력" 단일 관법으로 대체.〕
//
// 결정론(룰) — LLM은 이 결과를 해석에 *참고*만(규칙1).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, PillarPos } from '../spec/chart';
import { scoreStrength } from './structure';

export interface SensitivityDx {
  isBoss: boolean;     // 土부재 AND 신약 = 예민보스(전문가 2조건 모두 충족)
  count: number;       // 충족 조건 수(0~2) — 호환 유지(구 인터페이스)
  factors: string[];   // 충족 조건 설명(글라스박스)
  sharpPro: boolean;   // 辛金 = 예민 대신 '날카로운 전문성'
  label: string;       // 통변 라벨
}

const POS: PillarPos[] = ['년', '월', '일', '시'];
const EARTH_STEMS = new Set(['戊', '己']);           // 土 천간
const EARTH_BRANCHES = new Set(['辰', '戌', '丑', '未']); // 土 지지

/**
 * 원국에 土 오행이 있는가 — 천간(戊己) 또는 지지(辰戌丑未) 어디든 하나라도.
 * 지장간은 제외한다: 전문가의 "土가 없고"는 표면 글자 기준이고, 지지에 土(辰戌丑未)가 없으면
 *   지장간 속 土도 사실상 부재(土 지장간은 대개 土 지지에 실린다). 표면으로 판정한다.
 */
function hasEarth(saju: SajuChart): boolean {
  for (const p of POS) {
    const pil = saju.pillars[p];
    if (EARTH_STEMS.has(pil.stem)) return true;
    if (EARTH_BRANCHES.has(pil.branch)) return true;
  }
  return false;
}

/**
 * R35 예민보스 판정(결정론·2026-07-16 전문가 기준).
 * 土 부재 AND 신약(주변 미조력) → isBoss. 辛金은 sharpPro(날카로운 전문성)로 라벨 전환.
 * @param saju 원국(+현재 운) SajuChart
 * @returns SensitivityDx — isBoss/factors/label 등(전체 통변 참고용, 규칙1: LLM은 참고만)
 */
export function sensitivityBoss(saju: SajuChart): SensitivityDx {
  const factors: string[] = [];
  const noEarth = !hasEarth(saju);                          // ① 土 부재(오행 완충 없음)
  const weak = scoreStrength(saju).verdict === '신약';      // ② 주변 미조력 ≈ 신약(★daniel 검수 근사)
  if (noEarth) factors.push('土 부재(오행 완충 없음)');
  if (weak) factors.push('신약(주변이 일간을 돕지 않음)');

  const count = factors.length;
  const isBoss = noEarth && weak;                          // ★두 조건 모두 충족해야 예민(전문가 AND)
  const sharpPro = saju.dayMaster.stem === '辛';           // 辛金 = 예민 아닌 날카로운 전문성(daniel)
  const label = isBoss
    ? (sharpPro ? '날카로운 전문성(예민 구조를 정밀·예리함으로)' : '예민보스(매우 민감)')
    : (count === 1 ? (sharpPro ? '예리 경향' : '예민 경향') : '안정'); // 한 조건만 = 경향(예민 아님)
  return { isBoss, count, factors, sharpPro, label };
}
