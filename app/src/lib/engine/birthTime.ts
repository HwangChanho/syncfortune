// app/src/lib/engine/birthTime.ts — 태어난 시각 입력 → 24시간제 변환 (단일 출처 · 의존 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-08-11: *"만세력에 00:03 출생은 등록이 안되는데?"*
//
// ■ 무엇이 문제였나 (실측)
//   등록 화면의 시각 입력은 **12시간제**(오전/오후 + 1~12)인데 유효성 검사가 `1~12` 만 받았다.
//   자정 3분을 사람들은 **`00:03`** 이라고 친다(24시간제 습관) → `0` 은 범위 밖 →
//   **확인 버튼이 잠기고, 왜 안 되는지는 아무 데도 안 떴다.** `13~23` 도 같은 이유로 막혀 있었다.
//
// ■ ★왜 별도 파일인가
//   이 규칙이 화면(`ChartRegisterScreen`) 안에만 있으면 골든이 **복사본**을 검사하게 된다 —
//   화면만 고치거나 하네스만 고쳐도 서로 모른 채 통과한다([[duplicate-ui-single-source]]).
//   화면과 골든이 **같은 함수**를 쓰도록 여기로 뺀다. RN 을 안 쓰므로 헤드리스 실행도 된다.
// ─────────────────────────────────────────────────────────────────────────

export type AmPm = '오전' | '오후';

export type BirthTimeParse = {
  /** 24시간제 문자열 `H:mm`. 유효하지 않으면 null. */
  h24: string | null;
  /** 화면 표시용 12시간제 시(1~12). 유효하지 않으면 NaN. */
  h12: number;
  /** 실제로 적용된 오전/오후 — 24시간제로 쳤으면 그 값이 토글을 이긴다. */
  ampm: AmPm;
  /** 사용자가 24시간제 표기(0 · 13~23)로 쳤는가 — 화면이 "그렇게 읽었다"고 알려 줄 때 쓴다. */
  typed24h: boolean;
  /** 확인이 안 되는 이유(사람 말). 유효하면 null. ★침묵하지 않기 위한 필드다. */
  why: string | null;
};

/**
 * 등록 화면의 시각 입력을 24시간제로 옮긴다.
 *
 * @param hStr 시 입력(문자열 그대로 — 빈 칸 판정을 위해)
 * @param mStr 분 입력
 * @param ampm 오전/오후 토글 값. **24시간제로 친 경우 무시된다**(그 표기에 이미 들어 있으므로).
 *
 * @example
 *   parseBirthTime('00', '03', '오후').h24   // '0:03'  ← 토글이 오후여도 자정
 *   parseBirthTime('13', '30', '오전').h24   // '13:30' ← 24h 로 쳤으면 그게 이긴다
 *   parseBirthTime('12', '03', '오전').h24   // '0:03'  ← 12시간제 본래 규칙(오전 12시 = 자정)
 *   parseBirthTime('24', '00', '오전').why   // '시(時)는 1~12 또는 0~23 으로 입력해 주세요: 24'
 */
export function parseBirthTime(hStr: string, mStr: string, ampm: AmPm): BirthTimeParse {
  const rawH = parseInt(hStr, 10), m = parseInt(mStr, 10);

  // 24시간제 표기(0 · 13~23)는 **오전/오후가 이미 그 안에 들어 있다** → 토글보다 우선한다.
  const typed24h = rawH === 0 || (rawH >= 13 && rawH <= 23);
  const autoAmpm: AmPm | null = rawH === 0 ? '오전' : (rawH >= 13 && rawH <= 23) ? '오후' : null;
  const h12 = rawH === 0 ? 12 : rawH >= 13 && rawH <= 23 ? rawH - 12 : rawH;
  const eff: AmPm = autoAmpm ?? ampm;

  const why = (hStr === '' && mStr === '') ? null
    : hStr === '' ? '시(時)를 입력해 주세요.'
    : mStr === '' ? '분(分)을 입력해 주세요.'
    : !(h12 >= 1 && h12 <= 12) ? `시(時)는 1~12 또는 0~23 으로 입력해 주세요: ${hStr}`
    : !(m >= 0 && m <= 59) ? `분(分)은 0~59 여야 해요: ${mStr}`
    : null;

  const valid = hStr !== '' && mStr !== '' && h12 >= 1 && h12 <= 12 && m >= 0 && m <= 59;
  // 오전 12시 = 0시(자정) · 오후 12시 = 12시(정오) · 그 외 오후 = +12
  const h24n = !valid ? NaN : eff === '오전' ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12);

  return {
    h24: valid ? `${h24n}:${String(m).padStart(2, '0')}` : null,
    h12: valid ? h12 : NaN,
    ampm: eff,
    typed24h,
    why,
  };
}
