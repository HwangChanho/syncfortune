// engine/timezone.ts — 출생지·출생시각 → **그 순간의 UTC 오프셋**(결정론)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-23 *"밀라노 출생기준 사람이 한명 등록되어있는데 시간 보정이 제대로 안된거 같아"*.
//
// ■ 무엇이 틀렸었나 (실측 3건)
//   ①해외 **서머타임을 아예 적용하지 않았다** → 밀라노 1995-08-06 16:00(CEST)이 CET 로 계산돼
//     진태양시가 60분 늦었다. 시주가 `壬申`(申시)로 나왔지만 실제는 `辛未`(未시)다.
//   ②표준자오선을 **경도 반올림**으로 추정했다 → 파리(경도 2.35°E)를 UTC+0 으로 봤다.
//     실제 프랑스는 CET(UTC+1). 여름이면 CEST(UTC+2)라 **최대 120분** 어긋났다.
//   ③절기 축(년·월주·대운)은 `saju.ts` 가 **한국 자오선을 고정**으로 써서, 해외 출생이면
//     북경시 변환이 통째로 그 나라 시차만큼 틀어졌다(밀라노 기준 8~9시간).
//
// ■ 왜 이 파일 하나로 모으는가
//   위 셋은 전부 같은 하나를 몰라서 생긴 문제다 — **출생 순간 그 지역의 UTC 오프셋**.
//   그것만 알면 나머지는 산수다:
//       진태양시 보정 = 경도×4 − UTC오프셋 + 균시차
//       절기용 북경시 = 시계시 + (480 − UTC오프셋)
//   ⇒ 오프셋을 구하는 책임을 여기 하나로 두고, `solartime.ts`·`saju.ts` 는 그 결과만 쓴다.
//
// ■ ⚠️왜 `Intl.DateTimeFormat({timeZone})` 을 안 쓰나
//   그게 있으면 tzdb 전체를 공짜로 쓸 수 있다. 그런데 이 앱의 Hermes 는 **Intl 이 온전하지 않다**
//   — `Intl.PluralRules` 가 없어서 `intl-pluralrules` 폴리필을 넣어 두었다(`app/src/lib/i18n.ts`).
//   그런 런타임에서 `timeZone` 옵션을 믿으면 **기기에 따라 조용히 다른 값**이 나온다.
//   ⇒ 엔진 규칙(기획서 §9 "만세력 계산은 엔진(룰)")대로 **결정론 테이블**로 간다.
//
// ■ ★모르면 모른다고 한다
//   확정할 수 없는 시기·지역(예: 1980년 이전 유럽의 국가별 서머타임)은 **추측해서 채우지 않고**
//   `uncertain: true` 로 표시한다. 화면·하네스가 그걸 보고 사용자에게 알릴 수 있다.
//   (없는 사실을 만들어 넣으면 틀려도 아무도 모른다 — 이 프로젝트에서 가장 비싼 실패다.)
// ═══════════════════════════════════════════════════════════════════════════

/** 출생 순간의 시간대 판정 결과. */
export type TzResolution = {
  /** 출생 순간의 UTC 오프셋(분). 예: KST=540 · CET=60 · CEST=120 · PST=−480 */
  offsetMin: number;
  /** 서머타임을 뺀 그 지역 표준시 오프셋(분) */
  stdOffsetMin: number;
  /** 이 순간에 서머타임이 걸려 있었는가 */
  dstApplied: boolean;
  /** 무엇을 근거로 정했나 — 'korea'=한국 공인 이력 · 'country'=국가 테이블 · 'longitude'=경도 근사(최후) */
  source: 'korea' | 'country' | 'longitude';
  /** ★이 시기·지역의 서머타임 이력을 **확정하지 못했다**(추측해 채우지 않았다) */
  uncertain: boolean;
  /** 사람이 읽는 지역 이름 — 화면·로그용 */
  zone: string;
};

// ───────────────────────────────────────────────────────────────────────────
// 1. 한국 — 기존 공인 이력(변경 없음. 여기로 옮겨 왔을 뿐이다)
// ───────────────────────────────────────────────────────────────────────────

/**
 * 출생 시점의 한국 표준시 자오선(°E) — 시대별 변천 (결정론, 공인 역사).
 *   1908-04-01 UTC+8:30(127.5°) 최초 채택 → 1912-01-01 UTC+9(135°, 조선총독부)
 *   → 1954-03-21 UTC+8:30(127.5°) 복귀 → 1961-08-10 UTC+9(135°) 재변경(현재까지).
 * 1908-04-01 이전 출생(118세+)은 표준시 이전(지방시) 시대 — 실사용 범위 밖, 135° 폴백.
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
const DST_PERIODS_KR: [number, number][] = [
  [194806010000, 194809130000], [194904030000, 194909110000], [195004010000, 195009100000], [195105060000, 195109090000],
  [195505050000, 195509090000], [195605200000, 195609300000], [195705050000, 195709220000], [195805040000, 195809210000],
  [195905030000, 195909200000], [196005010000, 196009180000],
  [198705100200, 198710110300], [198805080200, 198810090300],
];

/**
 * 한국 서머타임 보정(분). DST 기간 출생 = 시계가 1시간 빠름 → −60분(표준시 환원). 그 외 0.
 * ※ 종료 직후 1시간(시계 되돌림 중복 구간)은 입력만으론 원리적으로 모호 — 표준시 쪽으로 해석.
 */
export function dstOffsetMin(y: number, m: number, d: number, hh = 0, mi = 0): number {
  const n = ((y * 10000 + m * 100 + d) * 100 + hh) * 100 + mi; // YYYYMMDDHHmm
  return DST_PERIODS_KR.some(([s, e]) => n >= s && n < e) ? -60 : 0;
}

// ───────────────────────────────────────────────────────────────────────────
// 2. 요일·주차 헬퍼 — 서머타임 규칙("3월 마지막 일요일")을 날짜로 바꾼다
// ───────────────────────────────────────────────────────────────────────────

/**
 * 그 달 n번째 특정 요일의 '일(day)'.
 * @param y 연 / @param m 월(1-12) / @param weekday 0=일 … 6=토 / @param n 1부터
 * @returns 일(1-31). ⚠️`Date.UTC` 를 쓴다 — 실행 기기의 시간대에 결과가 흔들리면 안 된다.
 */
function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** 그 달 **마지막** 특정 요일의 '일(day)'. */
function lastWeekday(y: number, m: number, weekday: number): number {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();          // 그 달의 말일
  const lastDow = new Date(Date.UTC(y, m - 1, last)).getUTCDay();
  return last - ((lastDow - weekday + 7) % 7);
}

/** YYYYMMDDHHmm 숫자로 압축 — 구간 비교를 정수 하나로 끝낸다. */
const stamp = (y: number, m: number, d: number, hh = 0, mi = 0) =>
  ((y * 10000 + m * 100 + d) * 100 + hh) * 100 + mi;

/**
 * 북반구형 구간 판정 — 같은 해 안에서 시작 < 끝.
 * @returns 시각이 [시작, 끝) 안이면 true
 */
const inSameYear = (n: number, s: number, e: number) => n >= s && n < e;

/**
 * 남반구형 구간 판정 — 해를 넘긴다(10월 시작 → 이듬해 4월 끝).
 * @returns 시각이 '그 해 시작 이후' 또는 '그 해 끝 이전'이면 true
 */
const inWrapped = (n: number, s: number, e: number) => n >= s || n < e;

// ───────────────────────────────────────────────────────────────────────────
// 3. 서머타임 규칙 — 지역별
//    ⚠️전환 시각은 **현지 시계시** 기준으로 비교한다. 전환 순간 앞뒤 1시간은 원리적으로 모호하며
//      (봄=없는 시각 · 가을=두 번 오는 시각) 이는 한국 `dstOffsetMin` 과 같은 관용이다.
// ───────────────────────────────────────────────────────────────────────────

/** 서머타임 규칙 키 — 국가 테이블이 이 중 하나를 고른다. */
export type DstRule = 'none' | 'eu' | 'us' | 'au' | 'nz' | 'jp' | 'cn' | 'mx' | 'br' | 'unknown';

/** 규칙 판정 결과: 서머타임 적용 여부 + 그 판정을 신뢰할 수 있는가. */
type DstVerdict = { on: boolean; uncertain: boolean };

/**
 * 유럽연합(+영국·서유럽 전반) 서머타임.
 *   1996~ : 3월 마지막 일요일 → **10월** 마지막 일요일 (EU 지침으로 전 회원국 통일)
 *   1981~1995 : 3월 마지막 일요일 → **9월** 마지막 일요일 (EEC 지침)
 *   ~1980 : 나라마다 제각각(이탈리아 5월말~9월말, 프랑스 4월초 등) → **확정 불가로 표시**
 */
function dstEu(n: number, y: number): DstVerdict {
  if (y < 1981) return { on: false, uncertain: y >= 1916 }; // 1차대전기부터 시행 이력은 있으나 국가별
  const start = stamp(y, 3, lastWeekday(y, 3, 0), 2, 0);
  const endMonth = y >= 1996 ? 10 : 9;
  const end = stamp(y, endMonth, lastWeekday(y, endMonth, 0), 3, 0);
  return { on: inSameYear(n, start, end), uncertain: false };
}

/**
 * 미국·캐나다 서머타임.
 *   2007~      : 3월 **둘째** 일요일 → 11월 **첫째** 일요일 (Energy Policy Act 2005)
 *   1987~2006  : 4월 첫째 일요일 → 10월 마지막 일요일
 *   1976~1986  : 4월 마지막 일요일 → 10월 마지막 일요일
 *   1975       : 2월 23일 → 10월 26일 (석유파동 임시 연장)
 *   1974       : 1월 6일 → 10월 27일 (〃)
 *   1967~1973  : 4월 마지막 일요일 → 10월 마지막 일요일 (Uniform Time Act 1966)
 *   ~1966      : 지방자치 재량으로 제각각 → **확정 불가로 표시**
 */
function dstUs(n: number, y: number): DstVerdict {
  if (y < 1967) return { on: false, uncertain: y >= 1918 };
  if (y === 1974) return { on: inSameYear(n, stamp(1974, 1, 6, 2), stamp(1974, 10, 27, 2)), uncertain: false };
  if (y === 1975) return { on: inSameYear(n, stamp(1975, 2, 23, 2), stamp(1975, 10, 26, 2)), uncertain: false };
  const start = y >= 2007 ? stamp(y, 3, nthWeekday(y, 3, 0, 2), 2)
    : y >= 1987 ? stamp(y, 4, nthWeekday(y, 4, 0, 1), 2)
      : stamp(y, 4, lastWeekday(y, 4, 0), 2);
  const end = y >= 2007 ? stamp(y, 11, nthWeekday(y, 11, 0, 1), 2)
    : stamp(y, 10, lastWeekday(y, 10, 0), 2);
  return { on: inSameYear(n, start, end), uncertain: false };
}

/**
 * 호주 남부(NSW·VIC·SA·TAS·ACT) 서머타임 — **남반구라 해를 넘긴다**.
 *   2008~     : 10월 첫째 일요일 → 이듬해 4월 첫째 일요일
 *   1972~2007 : 10월 마지막 일요일 → 이듬해 3월 마지막 일요일 (주·연도별 변동이 잦아 근사)
 */
function dstAu(n: number, y: number): DstVerdict {
  if (y < 1971) return { on: false, uncertain: y >= 1917 };
  const modern = y >= 2008;
  const start = modern ? stamp(y, 10, nthWeekday(y, 10, 0, 1), 2) : stamp(y, 10, lastWeekday(y, 10, 0), 2);
  const end = modern ? stamp(y, 4, nthWeekday(y, 4, 0, 1), 3) : stamp(y, 3, lastWeekday(y, 3, 0), 3);
  return { on: inWrapped(n, start, end), uncertain: !modern };
}

/**
 * 뉴질랜드 서머타임 — 남반구.
 *   2007~     : 9월 마지막 일요일 → 이듬해 4월 첫째 일요일
 *   1990~2006 : 10월 첫째 일요일 → 이듬해 3월 셋째 일요일
 */
function dstNz(n: number, y: number): DstVerdict {
  if (y < 1974) return { on: false, uncertain: y >= 1927 };
  const modern = y >= 2007;
  const start = modern ? stamp(y, 9, lastWeekday(y, 9, 0), 2) : stamp(y, 10, nthWeekday(y, 10, 0, 1), 2);
  const end = modern ? stamp(y, 4, nthWeekday(y, 4, 0, 1), 3) : stamp(y, 3, nthWeekday(y, 3, 0, 3), 3);
  return { on: inWrapped(n, start, end), uncertain: y < 1990 };
}

/** 일본 서머타임 — GHQ 시기 **1948~1951 딱 4년**. 연도별 실제 시행일을 그대로 적는다. */
const DST_JP: [number, number][] = [
  [stamp(1948, 5, 2), stamp(1948, 9, 12)], [stamp(1949, 4, 3), stamp(1949, 9, 11)],
  [stamp(1950, 5, 7), stamp(1950, 9, 10)], [stamp(1951, 5, 6), stamp(1951, 9, 9)],
];
function dstJp(n: number): DstVerdict {
  return { on: DST_JP.some(([s, e]) => n >= s && n < e), uncertain: false };
}

/** 중국 서머타임 — **1986~1991 딱 6년**. 연도별 실제 시행일. */
const DST_CN: [number, number][] = [
  [stamp(1986, 5, 4), stamp(1986, 9, 14)], [stamp(1987, 4, 12), stamp(1987, 9, 13)],
  [stamp(1988, 4, 10), stamp(1988, 9, 11)], [stamp(1989, 4, 16), stamp(1989, 9, 17)],
  [stamp(1990, 4, 15), stamp(1990, 9, 16)], [stamp(1991, 4, 14), stamp(1991, 9, 15)],
];
function dstCn(n: number): DstVerdict {
  return { on: DST_CN.some(([s, e]) => n >= s && n < e), uncertain: false };
}

/**
 * 멕시코 서머타임 — 1996 도입, **2022-10 전국 폐지**.
 *   2001 년만 예외(5/6~9/30). 그 외 4월 첫째 일요일 → 10월 마지막 일요일.
 */
function dstMx(n: number, y: number): DstVerdict {
  if (y < 1996 || y > 2022) return { on: false, uncertain: false };
  if (y === 2001) return { on: inSameYear(n, stamp(2001, 5, 6, 2), stamp(2001, 9, 30, 2)), uncertain: false };
  return {
    on: inSameYear(n, stamp(y, 4, nthWeekday(y, 4, 0, 1), 2), stamp(y, 10, lastWeekday(y, 10, 0), 2)),
    uncertain: false,
  };
}

/**
 * 브라질 서머타임 — 남반구. 1985~2018 시행 후 폐지.
 * ⚠️시작·종료일이 해마다 바뀌었고(카니발 연동 등) 지역별 시행 여부도 달랐다 →
 *   대표 규칙(10월 셋째 일요일 → 이듬해 2월 셋째 일요일)으로 근사하되 **확정 불가로 표시**한다.
 */
function dstBr(n: number, y: number): DstVerdict {
  if (y < 1985 || y > 2018) return { on: false, uncertain: false };
  return {
    on: inWrapped(n, stamp(y, 10, nthWeekday(y, 10, 0, 3), 0), stamp(y, 2, nthWeekday(y, 2, 0, 3), 0)),
    uncertain: true,
  };
}

/**
 * 규칙 키 → 판정.
 * @param rule 규칙 키 / @param n YYYYMMDDHHmm / @param y 연
 */
function applyRule(rule: DstRule, n: number, y: number): DstVerdict {
  switch (rule) {
    case 'eu': return dstEu(n, y);
    case 'us': return dstUs(n, y);
    case 'au': return dstAu(n, y);
    case 'nz': return dstNz(n, y);
    case 'jp': return dstJp(n);
    case 'cn': return dstCn(n);
    case 'mx': return dstMx(n, y);
    case 'br': return dstBr(n, y);
    case 'unknown': return { on: false, uncertain: true };  // 서머타임 이력이 있을 수 있으나 확정 못 함
    default: return { on: false, uncertain: false };        // 'none' = 서머타임 제도가 없는 지역
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 4. 국가 → 표준시·서머타임 규칙
//    ★출생지 문자열에서 **국가명**으로 찾는다. 출생지 피커(Nominatim, accept-language=ko)가
//      "밀라노, 롬바르디아, 이탈리아" 처럼 국가명을 한국어로 붙여 준다(실측 2026-08-23).
//      영어 표기로 들어오는 경우도 있어 별칭을 함께 둔다.
//    ⚠️경도 반올림 추정은 서유럽에서 확실히 틀린다(프랑스·스페인은 경도 0° 부근인데 CET) —
//      그래서 국가 테이블이 **경도보다 우선**이다.
// ───────────────────────────────────────────────────────────────────────────

/** 한 지역의 표준시 + 서머타임 규칙. */
type Zone = { std: number; rule: DstRule; zone: string };

/** 다중 시간대 국가에서 경도(·위도)로 갈래를 타는 한 칸. */
type Band = { west: number; east: number; latMin?: number; latMax?: number } & Zone;

/** 국가 한 칸 — 단일 시간대면 `zone`, 여러 시간대면 `bands`(위에서부터 먼저 맞는 것). */
type Country = {
  /** 출생지 문자열에서 찾을 이름들(한국어·영어) */
  names: string[];
  /** 단일 시간대 */
  single?: Zone;
  /** 다중 시간대 — 순서대로 검사한다(예외 지역을 먼저 둔다) */
  bands?: Band[];
  /** 연도에 따라 표준시가 바뀐 나라(예: 터키) */
  byYear?: (y: number) => Zone;
};

const COUNTRIES: Country[] = [
  // ── 동아시아 ──────────────────────────────────────────────────────────
  { names: ['일본', 'Japan'], single: { std: 540, rule: 'jp', zone: '일본 표준시' } },
  // ★중국은 국토가 5개 시간대 폭인데 **전역이 UTC+8** 이다(경도 추정이 신장에서 크게 틀린다).
  { names: ['중국', 'China'], single: { std: 480, rule: 'cn', zone: '중국 표준시' } },
  { names: ['대만', '타이완', 'Taiwan'], single: { std: 480, rule: 'none', zone: '대만' } },
  { names: ['홍콩', 'Hong Kong'], single: { std: 480, rule: 'none', zone: '홍콩' } },
  { names: ['마카오', 'Macau'], single: { std: 480, rule: 'none', zone: '마카오' } },
  { names: ['몽골', 'Mongolia'], single: { std: 480, rule: 'unknown', zone: '몽골' } },

  // ── 동남·남아시아 ─────────────────────────────────────────────────────
  { names: ['싱가포르', 'Singapore'], single: { std: 480, rule: 'none', zone: '싱가포르' } },
  { names: ['말레이시아', 'Malaysia'], single: { std: 480, rule: 'none', zone: '말레이시아' } },
  { names: ['필리핀', 'Philippines'], single: { std: 480, rule: 'none', zone: '필리핀' } },
  { names: ['태국', 'Thailand'], single: { std: 420, rule: 'none', zone: '태국' } },
  { names: ['베트남', 'Viet Nam', 'Vietnam'], single: { std: 420, rule: 'none', zone: '베트남' } },
  { names: ['캄보디아', 'Cambodia'], single: { std: 420, rule: 'none', zone: '캄보디아' } },
  { names: ['라오스', 'Laos'], single: { std: 420, rule: 'none', zone: '라오스' } },
  { names: ['미얀마', 'Myanmar'], single: { std: 390, rule: 'none', zone: '미얀마' } },
  {
    names: ['인도네시아', 'Indonesia'],
    bands: [
      { west: -180, east: 107.5, std: 420, rule: 'none', zone: '인도네시아 서부' },
      { west: 107.5, east: 127.5, std: 480, rule: 'none', zone: '인도네시아 중부' },
      { west: 127.5, east: 180, std: 540, rule: 'none', zone: '인도네시아 동부' },
    ],
  },
  { names: ['인도', 'India'], single: { std: 330, rule: 'none', zone: '인도' } },      // +5:30
  { names: ['네팔', 'Nepal'], single: { std: 345, rule: 'none', zone: '네팔' } },       // +5:45
  { names: ['스리랑카', 'Sri Lanka'], single: { std: 330, rule: 'none', zone: '스리랑카' } },
  { names: ['방글라데시', 'Bangladesh'], single: { std: 360, rule: 'none', zone: '방글라데시' } },
  { names: ['파키스탄', 'Pakistan'], single: { std: 300, rule: 'unknown', zone: '파키스탄' } },

  // ── 중동·아프리카 ─────────────────────────────────────────────────────
  { names: ['아랍에미리트', 'United Arab Emirates'], single: { std: 240, rule: 'none', zone: 'UAE' } },
  { names: ['사우디아라비아', 'Saudi Arabia'], single: { std: 180, rule: 'none', zone: '사우디' } },
  { names: ['카타르', 'Qatar'], single: { std: 180, rule: 'none', zone: '카타르' } },
  { names: ['이스라엘', 'Israel'], single: { std: 120, rule: 'unknown', zone: '이스라엘' } }, // 규칙 변동 잦음
  { names: ['이집트', 'Egypt'], single: { std: 120, rule: 'unknown', zone: '이집트' } },
  { names: ['남아프리카', 'South Africa'], single: { std: 120, rule: 'none', zone: '남아공' } },
  { names: ['케냐', 'Kenya'], single: { std: 180, rule: 'none', zone: '케냐' } },
  { names: ['튀르키예', '터키', 'Türkiye', 'Turkey'],
    byYear: (y) => (y >= 2016 ? { std: 180, rule: 'none', zone: '튀르키예' } : { std: 120, rule: 'eu', zone: '튀르키예(구 EET)' }) },

  // ── 유럽(UTC+1, CET) ─────────────────────────────────────────────────
  ...(['프랑스|France', '독일|Germany', '이탈리아|Italy', '스페인|Spain', '네덜란드|Netherlands',
    '벨기에|Belgium', '스위스|Switzerland', '오스트리아|Austria', '체코|Czech', '폴란드|Poland',
    '스웨덴|Sweden', '노르웨이|Norway', '덴마크|Denmark', '헝가리|Hungary', '슬로바키아|Slovakia',
    '슬로베니아|Slovenia', '크로아티아|Croatia', '세르비아|Serbia', '룩셈부르크|Luxembourg',
    '몰타|Malta', '알바니아|Albania', '보스니아|Bosnia'] as const)
    .map((s): Country => {
      const [ko, en] = s.split('|');
      return { names: [ko, en], single: { std: 60, rule: 'eu', zone: `${ko} · 중부유럽(CET)` } };
    }),

  // ── 유럽(UTC+2, EET) ─────────────────────────────────────────────────
  ...(['그리스|Greece', '핀란드|Finland', '루마니아|Romania', '불가리아|Bulgaria', '우크라이나|Ukraine',
    '에스토니아|Estonia', '라트비아|Latvia', '리투아니아|Lithuania', '키프로스|Cyprus', '몰도바|Moldova'] as const)
    .map((s): Country => {
      const [ko, en] = s.split('|');
      return { names: [ko, en], single: { std: 120, rule: 'eu', zone: `${ko} · 동부유럽(EET)` } };
    }),

  // ── 유럽(UTC+0) ──────────────────────────────────────────────────────
  { names: ['영국', 'United Kingdom', 'England', 'Scotland'], single: { std: 0, rule: 'eu', zone: '영국(GMT/BST)' } },
  { names: ['아일랜드', 'Ireland'], single: { std: 0, rule: 'eu', zone: '아일랜드' } },
  { names: ['포르투갈', 'Portugal'], single: { std: 0, rule: 'eu', zone: '포르투갈' } },
  { names: ['아이슬란드', 'Iceland'], single: { std: 0, rule: 'none', zone: '아이슬란드' } },

  // ── 러시아·중앙아시아 ─────────────────────────────────────────────────
  // ⚠️러시아는 11개 시간대 + 2011·2014 대개편이 있었다. 경도 근사 + **확정 불가 표시**가 정직하다.
  {
    names: ['러시아', 'Russia'],
    bands: [
      { west: -180, east: 40, std: 180, rule: 'unknown', zone: '러시아 서부(모스크바)' },
      { west: 40, east: 52.5, std: 240, rule: 'unknown', zone: '러시아 사마라' },
      { west: 52.5, east: 67.5, std: 300, rule: 'unknown', zone: '러시아 예카테린부르크' },
      { west: 67.5, east: 82.5, std: 360, rule: 'unknown', zone: '러시아 옴스크' },
      { west: 82.5, east: 97.5, std: 420, rule: 'unknown', zone: '러시아 크라스노야르스크' },
      { west: 97.5, east: 112.5, std: 480, rule: 'unknown', zone: '러시아 이르쿠츠크' },
      { west: 112.5, east: 127.5, std: 540, rule: 'unknown', zone: '러시아 야쿠츠크' },
      { west: 127.5, east: 180, std: 600, rule: 'unknown', zone: '러시아 블라디보스토크' },
    ],
  },
  { names: ['우즈베키스탄', 'Uzbekistan'], single: { std: 300, rule: 'none', zone: '우즈베키스탄' } },
  { names: ['카자흐스탄', 'Kazakhstan'], single: { std: 300, rule: 'unknown', zone: '카자흐스탄' } },

  // ── 북미 ─────────────────────────────────────────────────────────────
  {
    names: ['미국', 'United States', 'USA'],
    bands: [
      // ★예외를 먼저 — 하와이·애리조나는 서머타임이 없다(이것부터 안 걸면 아래 밴드가 먹는다)
      { west: -180, east: -154, std: -600, rule: 'none', zone: '하와이' },
      { west: -170, east: -129, latMin: 51, std: -540, rule: 'us', zone: '알래스카' },
      { west: -115, east: -109, latMin: 31, latMax: 37.1, std: -420, rule: 'none', zone: '애리조나(서머타임 없음)' },
      { west: -125, east: -114, std: -480, rule: 'us', zone: '미 태평양(PT)' },
      { west: -114, east: -102, std: -420, rule: 'us', zone: '미 산악(MT)' },
      { west: -102, east: -87, std: -360, rule: 'us', zone: '미 중부(CT)' },
      { west: -87, east: -66, std: -300, rule: 'us', zone: '미 동부(ET)' },
    ],
  },
  {
    names: ['캐나다', 'Canada'],
    bands: [
      { west: -59.5, east: -52, std: -210, rule: 'us', zone: '뉴펀들랜드' },   // −3:30
      { west: -141, east: -123, std: -480, rule: 'us', zone: '캐나다 태평양(BC)' },
      { west: -110, east: -101, std: -360, rule: 'none', zone: '서스캐처원(서머타임 없음)' },
      { west: -123, east: -110, std: -420, rule: 'us', zone: '캐나다 산악(AB)' },
      { west: -101, east: -90, std: -360, rule: 'us', zone: '캐나다 중부(MB)' },
      { west: -90, east: -67, std: -300, rule: 'us', zone: '캐나다 동부(ON·QC)' },
      { west: -67, east: -52, std: -240, rule: 'us', zone: '캐나다 대서양' },
    ],
  },
  {
    names: ['멕시코', 'Mexico'],
    bands: [
      { west: -180, east: -112, std: -480, rule: 'mx', zone: '멕시코 북서부' },
      { west: -112, east: -105, std: -420, rule: 'mx', zone: '멕시코 산악' },
      { west: -105, east: -80, std: -360, rule: 'mx', zone: '멕시코 중부' },
    ],
  },

  // ── 오세아니아 ────────────────────────────────────────────────────────
  {
    names: ['오스트레일리아', '호주', 'Australia'],
    bands: [
      { west: 112, east: 129, std: 480, rule: 'none', zone: '서호주(WA)' },
      { west: 129, east: 138, latMin: -26, std: 570, rule: 'none', zone: '노던 준주(서머타임 없음)' }, // +9:30
      { west: 129, east: 138, std: 570, rule: 'au', zone: '남호주(SA)' },
      { west: 138, east: 155, latMin: -29, std: 600, rule: 'none', zone: '퀸즐랜드(서머타임 없음)' },
      { west: 138, east: 155, std: 600, rule: 'au', zone: '호주 동부(NSW·VIC·TAS)' },
    ],
  },
  { names: ['뉴질랜드', 'New Zealand'], single: { std: 720, rule: 'nz', zone: '뉴질랜드' } },

  // ── 남미 ─────────────────────────────────────────────────────────────
  {
    names: ['브라질', 'Brazil'],
    bands: [
      { west: -75, east: -52.5, std: -240, rule: 'br', zone: '브라질 서부' },
      { west: -52.5, east: -30, std: -180, rule: 'br', zone: '브라질 동부' },
    ],
  },
  { names: ['아르헨티나', 'Argentina'], single: { std: -180, rule: 'unknown', zone: '아르헨티나' } },
  { names: ['칠레', 'Chile'], single: { std: -240, rule: 'unknown', zone: '칠레' } },
  { names: ['페루', 'Peru'], single: { std: -300, rule: 'none', zone: '페루' } },
  { names: ['콜롬비아', 'Colombia'], single: { std: -300, rule: 'none', zone: '콜롬비아' } },
];

/**
 * 도시명 → 국가명 — **국가명이 없는 옛 명식**을 위한 보조 표.
 *
 * ★왜 필요한가: 출생지 피커는 "밀라노, 롬바르디아, 이탈리아" 처럼 국가명을 붙여 주지만,
 *   피커가 생기기 전에 **손으로 타이핑한 명식**은 "밀라노" 뿐이다. 그러면 국가를 못 찾아
 *   경도 근사로 떨어지고 — 표준시는 우연히 맞더라도 **서머타임은 통째로 빠진다**(여름 60분).
 * ⚠️`solartime.ts` 의 `CITY_LON` 과 **같은 도시 목록**을 유지할 것(경도만 알고 나라를 모르면 반쪽이다).
 */
const CITY_COUNTRY: Record<string, string> = {
  도쿄: '일본', 오사카: '일본', 후쿠오카: '일본',
  베이징: '중국', 상하이: '중국', 우루무치: '중국',
  홍콩: '홍콩', 타이베이: '대만', 싱가포르: '싱가포르', 하노이: '베트남', 마닐라: '필리핀',
  로스앤젤레스: '미국', 뉴욕: '미국', 시애틀: '미국', 시카고: '미국', 샌프란시스코: '미국',
  밴쿠버: '캐나다', 토론토: '캐나다',
  런던: '영국', 파리: '프랑스', 베를린: '독일',
  밀라노: '이탈리아', 로마: '이탈리아', 마드리드: '스페인', 바르셀로나: '스페인',
  뮌헨: '독일', 프랑크푸르트: '독일', 암스테르담: '네덜란드', 취리히: '스위스',
  빈: '오스트리아', 프라하: '체코',
  시드니: '오스트레일리아', 멜버른: '오스트레일리아', 오클랜드: '뉴질랜드',
  두바이: '아랍에미리트', 모스크바: '러시아',
};

/**
 * 출생지 문자열에서 국가를 찾는다.
 * @param place 출생지 표시명(예: "밀라노, 롬바르디아, 이탈리아" · 옛 명식은 "밀라노" 뿐일 수 있다)
 * @returns 찾은 국가 칸, 못 찾으면 undefined
 */
function matchCountry(place: string): Country | undefined {
  if (!place) return undefined;
  const p = place.toLowerCase();
  // ⚠️'대한민국'·'한국'은 여기서 다루지 않는다 — 한국은 공인 이력(kstMeridianAt/dstOffsetMin)이 따로 있다.
  const direct = COUNTRIES.find((c) => c.names.some((n) => p.includes(n.toLowerCase())));
  if (direct) return direct;
  // 국가명이 없으면 도시명으로 한 번 더 — 손으로 적은 옛 명식 구제
  for (const city in CITY_COUNTRY) {
    if (place.includes(city)) {
      const cn = CITY_COUNTRY[city];
      const hit = COUNTRIES.find((c) => c.names.includes(cn));
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * 국가 칸 + 좌표 → 그 지역의 표준시·규칙.
 * @returns 밴드에 안 걸리면 undefined(→ 경도 근사로 폴백)
 */
function zoneOf(c: Country, y: number, lon: number, lat?: number): Zone | undefined {
  if (c.byYear) return c.byYear(y);
  if (c.single) return c.single;
  return c.bands?.find((b) =>
    lon >= b.west && lon < b.east
    && (b.latMin === undefined || (lat !== undefined && lat >= b.latMin))
    && (b.latMax === undefined || (lat !== undefined && lat <= b.latMax)));
}

// ───────────────────────────────────────────────────────────────────────────
// 5. 공개 API
// ───────────────────────────────────────────────────────────────────────────

/** 한반도 경도대 — 이 안이면 한국 공인 이력을 쓴다(기존 동작 그대로). */
export const KOREA_LON_RANGE: [number, number] = [124, 132];

/**
 * 출생 순간 그 지역의 **UTC 오프셋(분)** 을 구한다.
 *
 * @param place 출생지 표시명(국가명이 들어 있으면 그것으로 판정 — 피커가 붙여 준다)
 * @param lon   출생지 경도(°E, 서경은 음수)
 * @param lat   출생지 위도(°N) — 애리조나·퀸즐랜드처럼 위도로 갈리는 예외에만 쓴다
 * @param y/m/d/hh/mi 출생 시계시(현지 시계 기준)
 * @returns {TzResolution} 오프셋·표준시·서머타임 적용 여부·근거·확신 여부
 *
 * ⚠️전환 순간 앞뒤 1시간은 원리적으로 모호하다(봄=없는 시각·가을=두 번 오는 시각) —
 *   표준시 쪽으로 해석한다. 한국 `dstOffsetMin` 과 같은 관용이다.
 */
export function resolveUtcOffset(
  place: string, lon: number, lat: number | undefined,
  y: number, m: number, d: number, hh = 0, mi = 0,
): TzResolution {
  const n = stamp(y, m, d, hh, mi);

  // ① 한국 — 공인 이력(자오선 변천 + 서머타임 12개 구간). 기존 계산과 **수치가 동일**해야 한다.
  //    `dstOffsetMin` 은 '표준시로 되돌리는 양'(−60)이라 오프셋은 그만큼 **더한다**(540 → 600).
  const inKoreaLon = lon >= KOREA_LON_RANGE[0] && lon <= KOREA_LON_RANGE[1];
  const isKoreaName = /대한민국|한국|Korea/i.test(place ?? '');
  if (isKoreaName || (inKoreaLon && !matchCountry(place))) {
    const std = kstMeridianAt(y, m, d) * 4;      // 127.5°→510(+8:30) · 135°→540(+9)
    const dst = -dstOffsetMin(y, m, d, hh, mi);  // 서머타임 기간이면 +60
    return {
      offsetMin: std + dst, stdOffsetMin: std, dstApplied: dst !== 0,
      source: 'korea', uncertain: false,
      zone: std === 510 ? '한국(UTC+8:30 시대)' : '한국 표준시',
    };
  }

  // ② 국가 테이블 — 경도보다 **국가가 우선**이다(프랑스·스페인은 경도로 추정하면 틀린다).
  const country = matchCountry(place);
  const z = country ? zoneOf(country, y, lon, lat) : undefined;
  if (z) {
    const v = applyRule(z.rule, n, y);
    return {
      offsetMin: z.std + (v.on ? 60 : 0), stdOffsetMin: z.std, dstApplied: v.on,
      source: 'country', uncertain: v.uncertain, zone: z.zone,
    };
  }

  // ③ 최후 폴백 — 경도를 15°(=1시간) 단위로 반올림한 표준시.
  //    ★국가를 모르면 서머타임 이력도 알 수 없다 → **적용하지 않고 uncertain 으로 표시**한다.
  //      (여기서 넘겨짚어 60분을 더하면, 틀려도 아무도 모른다.)
  const std = Math.round(lon / 15) * 60;
  return {
    offsetMin: std, stdOffsetMin: std, dstApplied: false,
    source: 'longitude', uncertain: true,
    zone: `경도 추정(UTC${std >= 0 ? '+' : ''}${std / 60})`,
  };
}
