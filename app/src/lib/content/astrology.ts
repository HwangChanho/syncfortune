// app/src/lib/astrology.ts — 서양 점성술 네이탈 차트 엔진 · 결정론
// ─────────────────────────────────────────────────────────────────────────
// circular-natal-horoscope-js(순수 JS·MIT) 래핑. 천체력 계산=lib(결정론), 해석=별도(무료 템플릿/유료 LLM).
// ★도메인 지식 = Claude 인코딩(표준 서양 점성술, 발명 금지·체계 변형 명시):
//   하우스 = Whole Sign(단순·견고), 황도대 = Tropical(서양 표준), 어스펙트 = major(0/60/90/120/180°).
// ⚠️ 입력 시각 = 출생지 표준시(클락 타임). lib이 lat/lon→TZ→UTC 변환(사주의 진태양시와 별개 — 점성술은 표준시).
// ─────────────────────────────────────────────────────────────────────────
import { Origin, Horoscope } from 'circular-natal-horoscope-js';

// 12별자리(영문 — Whole Sign 하우스 시그 순차 계산용). 한글 표시는 UI/통변 레이어에서 매핑.
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// 주요 10행성(키론·항성 제외 — v1)
const MAIN_BODIES = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

export type NatalPlanet = { body: string; sign: string; deg: number; house: number; retro: boolean };
export type NatalAspect = { a: string; b: string; type: string; orb: number };
export type NatalChart = {
  big3: { sun: string; moon: string; rising: string }; // 무료 티어 핵심(태양·달·상승궁)
  planets: NatalPlanet[];
  asc: { sign: string; deg: number };
  houses: { num: number; sign: string }[];
  aspects: NatalAspect[];
};

// 별자리 내 도수(0~30) — Ecliptic.DecimalDegrees(0~360)를 30으로 나눈 나머지
const within = (decimalDeg: number) => Math.round((decimalDeg % 30) * 10) / 10;

/**
 * 네이탈 차트를 만든다(결정론).
 * @param input.year 연 / month 월(1-12) / day 일 / hour 시 / minute 분(출생지 표준시) / latitude·longitude 출생지
 * @returns NatalChart (big3 + 행성·상승·하우스·어스펙트)
 */
export function buildNatal(input: {
  year: number; month: number; day: number; hour: number; minute: number; latitude: number; longitude: number;
}): NatalChart {
  const origin = new Origin({
    year: input.year, month: input.month - 1, date: input.day, // lib은 month 0-index(JS Date 스타일)
    hour: input.hour, minute: input.minute,
    latitude: input.latitude, longitude: input.longitude,
  });
  const h = new Horoscope({ origin, houseSystem: 'whole-sign', zodiac: 'tropical', aspectTypes: ['major'], language: 'en' });

  // 행성: 별자리·도수·하우스·역행
  const planets: NatalPlanet[] = MAIN_BODIES.map((key) => {
    const b = h.CelestialBodies[key];
    return {
      body: key,
      sign: b.Sign.label,
      deg: within(b.ChartPosition.Ecliptic.DecimalDegrees),
      house: b.House?.id ?? 0,
      retro: !!b.isRetrograde,
    };
  });

  // 상승궁(ASC)
  const asc = { sign: h.Ascendant.Sign.label, deg: within(h.Ascendant.ChartPosition.Ecliptic.DecimalDegrees) };

  // 하우스(Whole Sign): 1하우스=상승 별자리, 이후 12별자리 순차
  const ai = SIGNS.indexOf(asc.sign);
  const houses = Array.from({ length: 12 }, (_, i) => ({ num: i + 1, sign: ai >= 0 ? SIGNS[(ai + i) % 12] : '' }));

  // 어스펙트: 행성-행성 major 만(v1 — 포인트/앵글 제외)
  const aspects: NatalAspect[] = h.Aspects.all
    .filter((a) => MAIN_BODIES.includes(a.point1Key) && MAIN_BODIES.includes(a.point2Key))
    .map((a) => ({ a: a.point1Key, b: a.point2Key, type: a.aspectKey, orb: Math.round(a.orb * 10) / 10 }));

  return { big3: { sun: planets[0].sign, moon: planets[1].sign, rising: asc.sign }, planets, asc, houses, aspects };
}
