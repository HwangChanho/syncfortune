// app/src/lib/engine.ts — 온디바이스 명식 계산 (engine/ 공유, L1)
// ─────────────────────────────────────────────────────────────────────────
// 점신식 입력 → OnDeviceChart 전체 계산(PII 평문은 *기기에서만*). 결정론 — API 불필요.
// 서버엔 toNormalized()로 PII 제외 NormalizedChart만 전송(ADR-005·032).
// ※ lunar-javascript·iztro의 RN(Hermes) 호환은 빌드 시 실측(ADR-032 플래그).
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from '@engine/saju';
import { detectInteractions, scoreStrength, classifyStrength, analyzeTenGods, detectPattern } from '@engine/structure';
import { dayMasterStages } from '@engine/twelve';
import { analyzeSinsal } from '@engine/sinsal';
import { buildZiweiChart } from '@engine/ziwei';
import type { ChartInput, NormalizedChart } from '@spec/chart';

/** 점신식 입력 → 결정론 명식 전체 (팔자·합충·신강약지표·격국후보·12운성·신살·자미). */
export function computeChart(input: ChartInput) {
  const saju = buildSajuChart(input, new Date().getFullYear()); // 세운·현재 대운 = 오늘 기준
  saju.interactions = detectInteractions(saju);
  return {
    saju,
    strength: scoreStrength(saju),   // 지표 (verdict 확정은 daniel/LLM P2)
    strengthClass: classifyStrength(saju), // 왕쇠 분류 + 득령/득지/득세 + 결집유형 (성격통변 INPUT)
    tenGods: analyzeTenGods(saju),   // 십신 분포·부재·과다 (성격통변 INPUT — 부재가 강한 시그널)
    pattern: detectPattern(saju),    // 격국 후보
    stages: dayMasterStages(saju),   // 12운성
    sinsal: analyzeSinsal(saju),     // 신살·공망
    ziwei: buildZiweiChart(input),
  };
}

export type ComputedChart = ReturnType<typeof computeChart>;

/** 서버 전송용 — PII 제외 NormalizedChart만 (생년월일·이름은 제외). */
export function toNormalized(id: string, c: ComputedChart): NormalizedChart {
  return {
    id,
    meta: { relation: 'self', eventConfidence: '중', consent: true }, // 호출측에서 채움
    saju: c.saju,        // 팔자·structure (구조)
    ziwei: c.ziwei,
  };
}
