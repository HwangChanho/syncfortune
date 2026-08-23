// engine/solartime.ts — 진태양시(眞太陽時) 보정 (결정론)
// ─────────────────────────────────────────────────────────────────────────
// 시계시 → 출생지 실제 태양시.
//
//   진태양시 보정(분) = 경도×4 − **그 순간 그 지역의 UTC 오프셋** + 균시차(EoT)
//
// ★2026-08-23 재작성: 예전엔 '서머타임 환원 + 경도차 + 균시차'를 각각 따로 더했는데,
//   그 셋은 사실 **하나(UTC 오프셋)를 아느냐**로 환원된다. 따로 두니 해외에서 세 갈래로 틀렸다:
//     ①해외 서머타임 미적용(밀라노 여름 = 60분) ②표준자오선을 경도로 추정(파리 = 60분 더)
//     ③절기 축은 아예 한국 고정(`saju.ts`)
//   ⇒ 오프셋 판정은 `engine/timezone.ts` 하나가 책임지고, 여기서는 그 결과로 산수만 한다.
//   ⚠️한국 케이스는 **수치가 한 톨도 바뀌지 않는다**(등가 변형 — `check:solartime` 이 고정한다).
//
// 정확한 시주(時柱) 산출에 필수 — 경계 시각(예: 17:30→17:06)에서 시지가 바뀜.
//   포스텔러 등 표준 만세력도 동일 계열 보정 적용(검증 차트 일치 확인).
// 표준시 변천·서머타임 기간 = 국가기록원·위키백과·IANA tzdata 교차확인(2026-06-10 / 해외분 08-23).
// ─────────────────────────────────────────────────────────────────────────
import type { ChartInput } from '../spec/chart';
import { resolveUtcOffset, kstMeridianAt, dstOffsetMin, type TzResolution } from './timezone';

// ★기존 임포트 경로 호환 — `kstMeridianAt`·`dstOffsetMin` 은 timezone.ts 로 옮겼지만
//   여기서 계속 내보낸다(saju.ts·verify-engine.ts 가 이 이름으로 쓰고 있다).
export { kstMeridianAt, dstOffsetMin };
export type { TzResolution };

// 주요 도시 경도(°E) — input.birthLon 미지정 시 도시명 fallback.
//   ⚠️출생지 피커를 쓰면 birthLon 이 들어오므로, 이건 **직접 타이핑한 옛 명식**용 보조다.
const CITY_LON: Record<string, number> = {
  서울: 126.98, 인천: 126.70, 수원: 127.03, 부산: 129.08, 대구: 128.60, 울산: 129.31,
  광주: 126.85, 대전: 127.38, 세종: 127.29, 청주: 127.49, 천안: 127.15, 전주: 127.15,
  여수: 127.66, 목포: 126.39, 순천: 127.49, 포항: 129.36, 창원: 128.68, 김해: 128.89,
  진주: 128.11, 강릉: 128.90, 춘천: 127.73, 원주: 127.92, 제주: 126.53, 안동: 128.73,
  // ★해외 주요 도시(2026-08-14) — 교포·유학생 출생.
  //   ⚠️없으면 **한국 평균(127.5°)** 으로 떨어져 완전히 엉뚱해진다(LA 를 한국으로 보는 셈).
  도쿄: 139.69, 오사카: 135.50, 후쿠오카: 130.40, 베이징: 116.41, 상하이: 121.47,
  홍콩: 114.17, 타이베이: 121.56, 싱가포르: 103.82, 하노이: 105.83, 마닐라: 120.98,
  로스앤젤레스: -118.24, 뉴욕: -74.01, 시애틀: -122.33, 시카고: -87.63, 샌프란시스코: -122.42,
  밴쿠버: -123.12, 토론토: -79.38, 런던: -0.13, 파리: 2.35, 베를린: 13.40,
  시드니: 151.21, 멜버른: 144.96, 오클랜드: 174.76, 두바이: 55.27, 모스크바: 37.62,
  // 2026-08-23 추가 — 유럽 대륙(경도만으로는 표준시를 못 맞히는 지역이라 국가 테이블과 짝이다)
  밀라노: 9.19, 로마: 12.50, 마드리드: -3.70, 바르셀로나: 2.17, 뮌헨: 11.58,
  프랑크푸르트: 8.68, 암스테르담: 4.90, 취리히: 8.54, 빈: 16.37, 프라하: 14.42,
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

/** 균시차(均時差, 분) — Spencer 근사식. 양수 = 태양이 시계보다 빠름. 위치와 무관. */
export function equationOfTime(y: number, m: number, d: number): number {
  const B = ((2 * Math.PI) / 364) * (dayOfYear(y, m, d) - 81);
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * 출생 순간 그 지역의 시간대 판정 — `engine/timezone.ts` 로 넘기는 얇은 어댑터.
 *
 * @param input 명식 입력(출생지 표시명·경도·위도를 쓴다)
 * @returns {TzResolution} 오프셋·서머타임 적용 여부·근거·확신 여부
 *   ★`uncertain: true` 면 그 시기·지역의 서머타임 이력을 확정하지 못했다는 뜻이다
 *     (추측해서 채우지 않았다 — 화면이 그대로 사용자에게 알릴 수 있다).
 */
export function tzOf(input: ChartInput, y: number, m: number, d: number, hh = 0, mi = 0): TzResolution {
  const lon = lonOf(input.birthPlace, input.birthLon);
  return resolveUtcOffset(input.birthPlace, lon, input.birthLat, y, m, d, hh, mi);
}

/**
 * 시계시 → 진태양시 보정량(분).
 *
 *   보정 = 경도×4 − UTC오프셋 + 균시차
 *
 * @param input 명식 입력 / @param y,m,d 출생 연·월·일 / @param hh,mi 출생 시·분(서머타임 경계 판정용)
 * @returns 시계시에 **더할** 분(음수면 앞당김). 예: 여수 1994-03-16 → −38.73
 *
 * ⚠️시각 미상(`timeAccuracy === '미상'`)일 때는 호출부(`saju.ts`)가 이 보정을 아예 건너뛴다 —
 *   자정 경계에서 일주가 흔들릴 위험이 있고 시주는 어차피 마스킹되기 때문이다.
 */
export function trueSolarOffsetMin(input: ChartInput, y: number, m: number, d: number, hh = 0, mi = 0): number {
  const lon = lonOf(input.birthPlace, input.birthLon);
  const tz = resolveUtcOffset(input.birthPlace, lon, input.birthLat, y, m, d, hh, mi);
  return lon * 4 - tz.offsetMin + equationOfTime(y, m, d);
}

/**
 * 절기 판정용 — 시계시 → **북경시(UTC+8)** 로 옮길 분.
 *
 *   이동량 = 480 − UTC오프셋   (예: 한국 540 → −60 · 밀라노 여름 120 → +360)
 *
 * ★왜 필요한가: lunar-javascript 의 절입(節入) 시각은 **북경시 기준**이다. 년·월주·대운은
 *   절기 경계에 걸리므로, 출생 순간을 같은 축(북경시)으로 옮겨서 비교해야 한다.
 *   예전엔 이 변환이 `saju.ts` 안에 **한국 자오선으로 고정**돼 있어, 해외 출생이면
 *   그 나라 시차만큼(밀라노 8~9시간) 통째로 어긋났다(2026-08-23 수정).
 *
 * @returns 시계시에 **더할** 분
 */
export function beijingShiftMin(input: ChartInput, y: number, m: number, d: number, hh = 0, mi = 0): number {
  const lon = lonOf(input.birthPlace, input.birthLon);
  const tz = resolveUtcOffset(input.birthPlace, lon, input.birthLat, y, m, d, hh, mi);
  return 480 - tz.offsetMin;
}
