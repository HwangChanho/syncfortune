// engine/solartime.ts — 진태양시(眞太陽時) 보정 (결정론)
// ─────────────────────────────────────────────────────────────────────────
// 시계시 → 출생지 실제 태양시. 보정 = 서머타임 환원 + 경도차 + 균시차(EoT).
//   · 서머타임: 시행 기간(1948~51·1955~60·1987~88)은 시계가 표준시보다 1시간 빠름 → −60분.
//   · 경도차: (출생지 경도 − *당시* 표준자오선) × 4분 — 자오선은 시대별 변천(아래 kstMeridianAt).
//   · 균시차: 지구 공전 타원·자전축 기울기로 인한 시계-태양 오차(±16분, 날짜별).
// 정확한 시주(時柱) 산출에 필수 — 경계 시각(예: 17:30→17:06)에서 시지가 바뀜.
//   포스텔러 등 표준 만세력도 동일 계열 보정 적용(검증 차트 일치 확인).
// 표준시 변천·서머타임 기간 = 국가기록원·위키백과·IANA tzdata(Asia/Seoul) 교차확인(2026-06-10).
// ─────────────────────────────────────────────────────────────────────────
import type { ChartInput } from '../spec/chart';

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

/**
 * 출생 시점의 한국 표준시 자오선(°E) — 시대별 변천 (결정론, 공인 역사).
 *   1908-04-01 UTC+8:30(127.5°) 최초 채택 → 1912-01-01 UTC+9(135°, 조선총독부)
 *   → 1954-03-21 UTC+8:30(127.5°) 복귀 → 1961-08-10 UTC+9(135°) 재변경(현재까지).
 * 1908-04-01 이전 출생(118세+)은 표준시 이전(지방시) 시대 — 실사용 범위 밖, 135° 폴백.
 * ※ 한국 출생 가정(해외 출생 지원 시 국가별 표준시 별도 필요 — daniel 확장 슬롯).
 */
export function kstMeridianAt(y: number, m: number, d: number): number {
  const n = y * 10000 + m * 100 + d; // YYYYMMDD 숫자 비교
  if (n >= 19080401 && n < 19120101) return 127.5;
  if (n >= 19540321 && n < 19610810) return 127.5;
  return 135;
}

// 한국 서머타임(일광절약시간제) 시행 기간 — [시작, 끝) 반개구간, YYYYMMDDHHmm.
//   1948~51·1955~60은 자정(00:00) 경계, 1987~88만 02:00 시작·03:00 종료.
//   (1955~60은 당시 표준시 +8:30 기준 +1h = +9:30 — '−60분 환원' 처리는 동일, 자오선은 kstMeridianAt가 담당.)
const DST_PERIODS: [number, number][] = [
  [194806010000, 194809130000], [194904030000, 194909110000], [195004010000, 195009100000], [195105060000, 195109090000],
  [195505050000, 195509090000], [195605200000, 195609300000], [195705050000, 195709220000], [195805040000, 195809210000],
  [195905030000, 195909200000], [196005010000, 196009180000],
  [198705100200, 198710110300], [198805080200, 198810090300],
];

/**
 * 서머타임 보정(분). DST 기간 출생 = 시계가 1시간 빠름 → −60분(표준시 환원). 그 외 0.
 * ※ 종료 직후 1시간(시계 되돌림 중복 구간, 예 1987-10-11 03:00~03:59의 02시대)은 입력만으론
 *   원리적으로 모호 — 표준시 쪽으로 해석(보정 없음). 극단 에지, 발생 확률 무시 가능.
 */
export function dstOffsetMin(y: number, m: number, d: number, hh = 0, mi = 0): number {
  const n = ((y * 10000 + m * 100 + d) * 100 + hh) * 100 + mi; // YYYYMMDDHHmm
  return DST_PERIODS.some(([s, e]) => n >= s && n < e) ? -60 : 0;
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

/**
 * 시계시 → 진태양시 보정량(분).
 *   = 서머타임 환원(−60, 해당 시) + 경도차((출생지 경도 − 당시 자오선) × 4) + 균시차.
 * @param hh/mi 출생 시·분 — 1987~88 DST 경계(02:00/03:00) 정밀 판정용. 생략 시 자정(00:00) 가정.
 */
export function trueSolarOffsetMin(input: ChartInput, y: number, m: number, d: number, hh = 0, mi = 0): number {
  return dstOffsetMin(y, m, d, hh, mi)
    + (lonOf(input.birthPlace, input.birthLon) - kstMeridianAt(y, m, d)) * 4
    + equationOfTime(y, m, d);
}
