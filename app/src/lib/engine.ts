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
function buildFullChart(input: ChartInput) {
  const saju = buildSajuChart(input, new Date().getFullYear()); // 세운·현재 대운 = 오늘 기준
  saju.interactions = detectInteractions(saju);
  let _ziwei: ReturnType<typeof buildZiweiChart> | undefined; // 자미두수 지연 계산 캐시(아래 get ziwei)
  return {
    saju,
    strength: scoreStrength(saju),   // 지표 (verdict 확정은 daniel/LLM P2)
    strengthClass: classifyStrength(saju), // 왕쇠 분류 + 득령/득지/득세 + 결집유형 (성격통변 INPUT)
    tenGods: analyzeTenGods(saju),   // 십신 분포·부재·과다 (성격통변 INPUT — 부재가 강한 시그널)
    pattern: detectPattern(saju),    // 격국 후보
    stages: dayMasterStages(saju),   // 12운성
    sinsal: analyzeSinsal(saju),     // 신살·공망
    // ⚡지연(성능·daniel "만세력 느림"): 자미두수(iztro)는 무겁고 사주-only 화면(만세력·신살)엔 불필요 →
    //   c.ziwei 접근 시에만 1회 계산(자미/궁합 화면만 비용). 메모 객체 내 _ziwei 캐시.
    get ziwei() { return _ziwei ?? (_ziwei = buildZiweiChart(input)); },
  };
}

// ⚡세션 메모(성능·daniel 2026-06: "모든 로딩 느려"): ChartPicker가 모든 콘텐츠 화면 상단에서 명식마다
//   풀 엔진(사주+자미두수)을 재계산 → 실기기 CPU 랙. input+연도 키로 캐시해 같은 명식은 1회만 계산
//   (세운 연도 바뀌면 자동 갱신). 결과는 읽기 전용으로 다룬다(호출처가 변형하지 않음).
const _chartCache = new Map<string, ReturnType<typeof buildFullChart>>();
export function computeChart(input: ChartInput): ReturnType<typeof buildFullChart> {
  const key = `${new Date().getFullYear()}|${JSON.stringify(input)}`;
  let hit = _chartCache.get(key);
  if (!hit) { hit = buildFullChart(input); _chartCache.set(key, hit); }
  return hit;
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
