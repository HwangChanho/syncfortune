// app/src/lib/talk/speechLevel.ts — **반말이냐 존댓말이냐** (의존성 0)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"각 선생님들의 나이를 정하고 유저가 해당 나이보다 어리면 기본적으로 반말로 진행해"*
//
// ■ ★판정을 **한 곳에만** 둔다
//   같은 판정이 화면(첫 인사)과 서버(프롬프트) 두 곳에서 필요하다.
//   각자 계산하면 «인사는 반말인데 답은 존댓말» 같은 어긋남이 생긴다([[duplicate-ui-single-source]]).
//   ⇒ 규칙은 여기 한 줄이고, 서버는 이 함수가 만든 **나이**를 받아 같은 비교를 한다.
//
// ■ 의존성이 0인 이유
//   하네스가 **진짜 함수**를 돌릴 수 있어야 한다. 엔진·RN 을 끌어오면 못 부르고,
//   그러면 하네스는 «사본»을 테스트하게 된다([[shared-block-eats-personality]] 의 교훈).
//   ⚠️★그러니 여기에 `supabase` 를 들이지 마라 — `check:banmal` 이 이 파일을 **직접 import** 한다.
//
// ■ ★2026-08-31 — **말투를 정하는 건 더 이상 나이가 아니다**
//   Boss: *"그냥 설정에서 반말모드 존댓말모드 설정할수 있게하고 저건 묻지 않는걸로 하자"*
//   회원이 설정에서 고른 값(`profiles.speech_casual`)이 답이다 → `speechSetting.ts`.
//   ⚠️`isCasual`(나이 비교)은 남겨 둔다 — 지우면 그 구멍을 지키던 `check:banmal` 이 눈이 먼다.
//     다만 **말투를 정하는 데는 더 이상 쓰지 않는다.**
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 생년월일 문자열 → **만 나이**.
 *
 * ★만 나이를 쓰는 이유: 2023년부터 법·행정이 만 나이로 통일됐고, «몇 살인가» 를
 *   한 가지로만 세야 화면과 서버가 같은 답을 낸다(세는나이를 섞으면 한 살씩 갈린다).
 *
 * @param birthDateTime `YYYY-MM-DD` 로 시작하는 문자열(뒤에 시각이 붙어도 된다)
 * @param now           기준 시각(테스트에서 고정할 수 있게 주입 — 기본은 지금)
 * @returns 만 나이. 형식이 이상하면 `null`(모르면 «모른다» 를 그대로 돌려준다)
 */
export function ageFromBirth(birthDateTime: string | null | undefined, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDateTime ?? '').trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!y || !mo || !d || mo > 12 || d > 31) return null;
  let age = now.getFullYear() - y;
  // 생일이 아직 안 왔으면 한 살 뺀다(= 만 나이)
  const beforeBirthday = now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;   // 말도 안 되는 값은 «모른다» 로 떨어뜨린다
}

/**
 * 이 대화를 **반말로** 할 것인가.
 *
 * ⚠️★모르면 **존댓말**이다. 나이를 안 정한 상담가(null)·명식이 없는 회원(null) 모두 존댓말.
 *   반말은 되돌리기 어려운 무례가 될 수 있고, 존댓말은 그렇지 않다 — 안전한 쪽이 기본값이다.
 *
 * @param consultantAge 상담가 나이(`consultants.age`)
 * @param userAge       회원 만 나이
 */
export function isCasual(consultantAge: number | null | undefined, userAge: number | null | undefined): boolean {
  const a = asAge(consultantAge);
  const b = asAge(userAge);
  if (a == null || b == null) return false;
  return b < a;   // Boss: "해당 나이보다 어리면" — 같은 나이는 반말이 아니다
}

/**
 * «나이로 쓸 수 있는 값인가» — 아니면 null.
 *
 * ⚠️★**`Number(null)` 은 `0` 이다.** 그래서 `Number.isFinite(Number(x))` 로 거르면
 *   «명식이 없는 회원»(null)이 **0살**로 읽혀 **전원 반말**이 된다.
 *   2026-08-26 실제로 이렇게 짰고 `check:banmal` 이 잡았다 — 세 곳(앱 판정·askLive·Edge)에 같은 구멍이 있었다.
 *   ⇒ null·undefined·빈 문자열을 **먼저** 걸러야 한다.
 */
function asAge(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 130 ? n : null;
}
