// engine/solartime.ts — 진태양시(眞太陽時) 보정 (결정론)
// ─────────────────────────────────────────────────────────────────────────
// 시계시(KST, 동경 135°) → 출생지 실제 태양시. 보정 = 경도차 + 균시차(EoT).
//   · 경도차: (출생지 경도 − 135) × 4분  (서쪽일수록 −, 한국은 대개 −25~−32분)
//   · 균시차: 지구 공전 타원·자전축 기울기로 인한 시계-태양 오차(±16분, 날짜별)
// 정확한 시주(時柱) 산출에 필수 — 경계 시각(예: 17:30→17:06)에서 시지가 바뀜.
//   포스텔러 등 표준 만세력도 동일 보정 적용(검증 차트 17:30 → 17:06 일치).
// ⚠️ 한국 1961년~ 표준 자오선 135° 기준. 그 이전/타국(127.5° 등)은 미반영 → daniel 검수.
// ─────────────────────────────────────────────────────────────────────────
import type { ChartInput } from '../spec/chart';

const KST_MERIDIAN = 135; // 한국표준시 자오선(동경 135°)

// 주요 한국 도시 경도(°E) — input.birthLon 미지정 시 도시명 fallback.
const CITY_LON: Record<string, number> = {
  서울: 126.98, 인천: 126.70, 수원: 127.03, 부산: 129.08, 대구: 128.60, 울산: 129.31,
  광주: 126.85, 대전: 127.38, 세종: 127.29, 청주: 127.49, 천안: 127.15, 전주: 127.15,
  여수: 127.66, 목포: 126.39, 순천: 127.49, 포항: 129.36, 창원: 128.68, 김해: 128.89,
  진주: 128.11, 강릉: 128.90, 춘천: 127.73, 원주: 127.92, 제주: 126.53, 안동: 128.73,
};

/** 출생지 경도(°E). 우선순위: input.birthLon > 도시명 매칭 > 한국 평균(127.5). */
export function lonOf(birthPlace: string, birthLon?: number): number {
  if (typeof birthLon === 'number' && isFinite(birthLon)) return birthLon;
  for (const city in CITY_LON) if (birthPlace.includes(city)) return CITY_LON[city];
  return 127.5; // 미상 — 한국 평균 경도
}

/** 연중 일수(1~366) */
function dayOfYear(y: number, m: number, d: number): number {
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let n = d;
  for (let i = 0; i < m - 1; i++) n += days[i];
  return n;
}

/** 균시차(均時差, 분) — Spencer 근사식. 양수 = 태양이 시계보다 빠름. */
export function equationOfTime(y: number, m: number, d: number): number {
  const B = ((2 * Math.PI) / 364) * (dayOfYear(y, m, d) - 81);
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/** 시계시 → 진태양시 보정량(분). = 경도차((경도−135)×4) + 균시차. */
export function trueSolarOffsetMin(input: ChartInput, y: number, m: number, d: number): number {
  return (lonOf(input.birthPlace, input.birthLon) - KST_MERIDIAN) * 4 + equationOfTime(y, m, d);
}
