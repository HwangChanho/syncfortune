// app/src/lib/numerology.ts — 수비학(Numerology) 엔진 · 결정론 · 온디바이스
// ─────────────────────────────────────────────────────────────────────────
// 표준 체계: **피타고리안(Pythagorean) 수비학** (서양 표준). 계산은 룰(여기), 해석은 별도
//   (무료=템플릿 meanings / 유료=LLM 통변). 기획서 §9: 계산=엔진, 해석=LLM.
// ★도메인 지식 출처: Claude가 표준 레퍼런스로 인코딩(daniel 비전문). 발명 금지·체계 변형은 주석에 명시.
// ⚠️ 한글 이름 기반 수(표현/영혼/성격수)는 로마자 변환이 필요 → buildNumerology(romanName)로 주입.
//   로마자 변환(한글→Revised Romanization) 체계는 별도 단계에서 확정(README/doc 참고).
//   생년월일 기반 수(생명수·생일수·개인해수)는 언어 무관·견고 → 이름 없이도 동작(무료 핵심).
// ─────────────────────────────────────────────────────────────────────────

// 피타고리안 글자값: A=1,B=2,…,I=9, J=1,…,R=9, S=1,…,Z=8 (A~Z를 1~9로 순환).
const PYTHAGOREAN: Record<string, number> = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch, i) => { PYTHAGOREAN[ch] = (i % 9) + 1; });

// 모음 집합. Y는 표준상 맥락 의존(여기선 자음 처리 — 가장 보편적 기본값, 변형 존재).
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// 마스터수 보존: 11/22/33 은 한 자리로 줄이지 않고 유지(피타고리안 표준).
const MASTERS = new Set([11, 22, 33]);

/**
 * 한 자리(또는 마스터수)로 축소한다.
 * @param n 입력 수
 * @param keepMaster 11/22/33 을 보존할지(기본 true)
 * @returns 1~9 또는 11/22/33
 */
function reduce(n: number, keepMaster = true): number {
  while (n > 9) {
    if (keepMaster && MASTERS.has(n)) return n;
    n = String(n).split('').reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

/**
 * 생명수 (Life Path) — 그 사람의 인생 큰 줄기.
 * 표준 방식: 월·일·년을 각각 축소 후 합쳐 다시 축소(마스터수 보존에 유리).
 */
export function lifePath(year: number, month: number, day: number): number {
  return reduce(reduce(month) + reduce(day) + reduce(year));
}

/** 생일수 (Birthday) — 태어난 '일'을 축소(타고난 재능 힌트). */
export function birthdayNumber(day: number): number {
  return reduce(day);
}

/** 개인해 수 (Personal Year) — 올해(또는 지정 연도)의 흐름. 생월+생일+해당연도. */
export function personalYear(month: number, day: number, year: number): number {
  return reduce(reduce(month) + reduce(day) + reduce(year));
}

/** 로마자 이름의 글자값 합(필터 적용 후 축소). 비-알파벳은 무시. */
function nameSum(romanName: string, filter: (ch: string) => boolean): number {
  const up = romanName.toUpperCase().replace(/[^A-Z]/g, '');
  const total = [...up].filter(filter).reduce((s, ch) => s + (PYTHAGOREAN[ch] ?? 0), 0);
  return reduce(total);
}

/** 표현수 (Expression/Destiny) — 이름 전체. 타고난 능력·방향. */
export function expressionNumber(romanName: string): number {
  return nameSum(romanName, () => true);
}
/** 영혼수 (Soul Urge) — 이름의 모음. 내면의 욕구. */
export function soulUrgeNumber(romanName: string): number {
  return nameSum(romanName, (ch) => VOWELS.has(ch));
}
/** 성격수 (Personality) — 이름의 자음. 남에게 보이는 모습. */
export function personalityNumber(romanName: string): number {
  return nameSum(romanName, (ch) => !VOWELS.has(ch));
}

export type NumerologyChart = {
  lifePath: number;        // 생명수(필수)
  birthday: number;        // 생일수(필수)
  personalYear: number;    // 개인해 수(필수)
  expression?: number;     // 표현수(로마자 이름 있을 때)
  soulUrge?: number;       // 영혼수
  personality?: number;    // 성격수
  masterNumbers: number[]; // 등장한 마스터수(11/22/33) 모음
};

/**
 * 전체 수비학 차트를 만든다.
 * @param input.year/month/day 생년월일(필수)
 * @param input.romanName 로마자 이름(옵션 — 있으면 이름 기반 3수 계산)
 * @param input.forYear 개인해 기준 연도(기본 올해)
 */
export function buildNumerology(input: {
  year: number; month: number; day: number; romanName?: string; forYear?: number;
}): NumerologyChart {
  const lp = lifePath(input.year, input.month, input.day);
  const bd = birthdayNumber(input.day);
  const py = personalYear(input.month, input.day, input.forYear ?? new Date().getFullYear());
  const ex = input.romanName ? expressionNumber(input.romanName) : undefined;
  const su = input.romanName ? soulUrgeNumber(input.romanName) : undefined;
  const pe = input.romanName ? personalityNumber(input.romanName) : undefined;
  // 마스터수 수집(중복 제거)
  const masters = [lp, bd, py, ex, su, pe].filter((n): n is number => n != null && MASTERS.has(n));
  return { lifePath: lp, birthday: bd, personalYear: py, expression: ex, soulUrge: su, personality: pe, masterNumbers: [...new Set(masters)] };
}
