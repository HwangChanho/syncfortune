// app/src/lib/talk/birthParse.ts — 대화 문장에서 **생년월일시를 읽는다** (의존성 0)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"명식 등록을 안하고 대화에서 그냥 1994 03 16 유시 이렇게 입력할수도 있잖아
//   그러면 여기서 필요한게 태어난곳 양력 음력 여부 성별 여부니깐 이런걸 되물어야지"*
//
// ■ ★이 파일은 **읽기만** 한다 — 여덟 글자를 세지 않는다
//   세는 것은 엔진(`computeChart`)이다. CLAUDE.md 절대규칙 1.
//   실제로 모델에게 맡겼다가 **틀린 일주**(경오 ❌ / 신축 ⭕)를 지어낸 사고가 있었다.
//   여기가 하는 일은 «회원이 말한 것을 필드로 옮기고, **무엇이 비었는지** 알려 주는 것»뿐이다.
//
// ■ 의존성이 0인 이유
//   하네스가 **진짜 함수**를 돌릴 수 있어야 한다. 엔진·RN 을 끌어오면 못 부르고,
//   그러면 «사본» 을 테스트하게 된다. (`speechLevel.ts`·`mentionParse.ts` 와 같은 취급)
// ═══════════════════════════════════════════════════════════════════════════

/** 엔진(`ChartInput`)이 여덟 글자를 세려면 필요한 것들. 비면 `null`. */
export type BirthDraft = {
  /** `YYYY-MM-DD` */
  date: string | null;
  /** `HH:MM` — 십이지(유시 등)면 그 시간대의 **중간**을 쓴다 */
  time: string | null;
  /** 시각을 어디까지 믿나 */
  timeAccuracy: '정확' | '추정' | '미상' | null;
  calendar: '양' | '음' | null;
  sex: '남' | '여' | null;
  /** 도시 이름(진태양시 보정에 쓴다) */
  place: string | null;
};

/** 아직 안 물어본 것 — 화면이 이걸 보고 무엇을 되물을지 정한다. */
export type MissingKey = 'date' | 'time' | 'calendar' | 'sex' | 'place';

export const MISSING_LABEL: Record<MissingKey, string> = {
  date: '생년월일', time: '태어난 시각', calendar: '양력/음력', sex: '성별', place: '태어난 곳',
};

/**
 * 십이지 시각 → 그 시간대의 **중간**.
 * ★중간을 쓰는 이유: 시주는 그 두 시간 안에서 같지만 **진태양시 보정**이 경계를 밀 수 있다.
 *   경계값(17:00)을 쓰면 보정 뒤 앞 시간대로 넘어갈 수 있어, 가운데가 가장 안전하다.
 * ⚠️자시(23~01)는 날을 넘는다 — 여기서는 **00:00**(자시 한가운데)으로 둔다.
 *   야자시·조자시 관법은 **엔진이 판단할 일**이지 파서가 정할 일이 아니다.
 */
const BRANCH_HOUR: Record<string, string> = {
  자: '00:00', 축: '02:00', 인: '04:00', 묘: '06:00', 진: '08:00', 사: '10:00',
  오: '12:00', 미: '14:00', 신: '16:00', 유: '18:00', 술: '20:00', 해: '22:00',
};

/** 두 자리로 채운다. */
const p2 = (n: number): string => String(n).padStart(2, '0');

/**
 * 문장 하나(또는 여러 개를 이어 붙인 것)에서 생년월일시 정보를 긁는다.
 *
 * ★**있는 것만** 채운다. 없는 것은 `null` 로 두고 화면이 되묻는다 — 지어내지 않는다.
 * @param text 회원이 쓴 말(여러 턴을 이어 붙여도 된다)
 */
export function parseBirth(text: string): BirthDraft {
  const t = String(text ?? '');
  const out: BirthDraft = { date: null, time: null, timeAccuracy: null, calendar: null, sex: null, place: null };

  // ── 날짜 ────────────────────────────────────────────────────────────────
  //   "1994 03 16" · "1994년 3월 16일" · "1994-3-16" · "1994.03.16" · "94/3/16"
  //   ⚠️★연도 앞에 **숫자가 오면 안 된다.** 안 막으면 "1800 03 16" 에서 뒤의 "00" 을 연도로 읽어
  //     2000년으로 만든다(음성 테스트에서 잡혔다). Hermes 안전을 위해 lookbehind 대신 **앞 글자를 캡처**한다.
  const d = /(^|[^0-9])(19\d{2}|20\d{2}|\d{2})\s*[년.\-/\s]\s*(1[0-2]|0?[1-9])\s*[월.\-/\s]\s*(3[01]|[12]\d|0?[1-9])\s*일?/.exec(t);
  if (d) {
    let y = Number(d[2]);
    if (y < 100) y += y <= 30 ? 2000 : 1900;          // 두 자리 연도 — 30 이하는 2000년대로 본다
    const mo = Number(d[3]); const da = Number(d[4]);
    if (y >= 1900 && y <= 2100) out.date = `${y}-${p2(mo)}-${p2(da)}`;
  }

  // ── 시각 ────────────────────────────────────────────────────────────────
  if (/(시간|시각)?\s*(모름|모르|기억\s*안|몰라|미상)/.test(t)) {
    out.time = null; out.timeAccuracy = '미상';
  } else {
    const b = /([자축인묘진사오미신유술해])\s*시/.exec(t);            // 유시·자시…
    const hm = /(오전|오후|아침|저녁|밤|새벽)?\s*(2[0-3]|1\d|0?\d)\s*시\s*(([0-5]?\d)\s*분)?/.exec(t);
    const clock = /(2[0-3]|[01]?\d)\s*:\s*([0-5]\d)/.exec(t);
    if (clock) {
      out.time = `${p2(Number(clock[1]))}:${clock[2]}`; out.timeAccuracy = '정확';
    } else if (b) {
      out.time = BRANCH_HOUR[b[1]]; out.timeAccuracy = '추정';        // 두 시간 폭 → 추정
    } else if (hm) {
      let h = Number(hm[2]);
      const ap = hm[1] ?? '';
      if ((ap === '오후' || ap === '저녁' || ap === '밤') && h < 12) h += 12;
      if (ap === '새벽' && h === 12) h = 0;
      out.time = `${p2(h)}:${p2(Number(hm[4] ?? 0))}`;
      out.timeAccuracy = hm[3] ? '정확' : '추정';                      // 분까지 말했으면 정확
    }
  }

  // ── 양력/음력 ───────────────────────────────────────────────────────────
  //   ⚠️'윤달' 은 음력에서만 쓰는 말이라 음력 신호로 본다
  if (/음력|음\s*력|윤달/.test(t)) out.calendar = '음';
  else if (/양력|양\s*력|solar/i.test(t)) out.calendar = '양';

  // ── 성별 ────────────────────────────────────────────────────────────────
  //   ⚠️'남자친구'·'여자친구' 는 **본인 성별이 아니다** — 먼저 걸러 낸다
  //   ⚠️★한국어에는 **단어 경계(\b)가 안 먹는다** — 한글과 한글 사이엔 경계가 없어서
  //     `/\b남자\b/` 는 "남자예요" 를 못 잡는다(음성 테스트에서 잡혔다).
  //     ⇒ `남자·남성` 은 그냥 포함으로 보고, **홑글자 남/여** 만 앞뒤가 한글이 아닐 때로 좁힌다
  //       ("여행"·"남편" 을 성별로 읽지 않게).
  const g = t.replace(/[남여]자?\s*친구|남친|여친/g, ' ');
  const solo = (ch: string) => new RegExp(`(^|[^가-힣])${ch}([^가-힣]|$)`).test(g);
  if (/남자|남성|male|man\b/i.test(g) || solo('남')) out.sex = '남';
  else if (/여자|여성|female|woman\b/i.test(g) || solo('여')) out.sex = '여';

  // ── 태어난 곳 ───────────────────────────────────────────────────────────
  //   "서울에서 태어났" · "출생지 부산" · "밀라노 태생"
  const pl = /([가-힣A-Za-z]{2,12})\s*(?:에서|에)?\s*(?:태어|출생|태생)/.exec(t)
    || /(?:출생지|태어난\s*곳)\s*[:는은]?\s*([가-힣A-Za-z]{2,12})/.exec(t);
  if (pl) {
    const v = pl[1].replace(/(에서|에|은|는)$/, '').trim();
    if (v && !/^(어디|여기|거기)$/.test(v)) out.place = v;
  }
  return out;
}

/**
 * 아직 없는 것들 — 화면이 이걸 그대로 되묻는다.
 * ★순서는 **묻기 좋은 순서**다(날짜 → 시각 → 양음력 → 성별 → 곳).
 */
export function missingOf(d: BirthDraft): MissingKey[] {
  const out: MissingKey[] = [];
  if (!d.date) out.push('date');
  if (!d.time && d.timeAccuracy !== '미상') out.push('time');
  if (!d.calendar) out.push('calendar');
  if (!d.sex) out.push('sex');
  if (!d.place) out.push('place');
  return out;
}

/**
 * 이 문장이 **명식을 만들려는 말**인가 — 카드를 띄울지 정하는 신호.
 * ★날짜가 있어야 시작한다. 날짜 없이 "남자예요" 만으로는 아무것도 못 만든다.
 */
export function looksLikeBirthInfo(text: string): boolean {
  return parseBirth(text).date !== null;
}
