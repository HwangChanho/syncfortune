// app/src/lib/content/noticeSeen.ts — 공지 「하루 동안 보지 않기」 (의존성 0)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01: *"공지글은 홈화면에 가면 무조건 뜨게하고
//   하루동안 보지않기 체크하면 노출 안 되게해"*
//
// ■ ★«하루 동안» 을 **기기에 둔다**(서버에 안 쌓는다)
//   ①로그인 안 한 사람도 눌러야 한다 — 서버에 두면 계정이 있어야 한다.
//   ②이 하나 때문에 표·정책·쓰기 경로를 늘리지 않는다.
//   ⚠️기기를 바꾸면 다시 뜬다 — 그건 이 설계의 값이지 결함이 아니다.
//
// ■ ★★«하루» 는 **누른 때로부터 24시간**이다(자정 기준이 아니다)
//   자정 기준으로 하면 **밤 11시에 누른 사람은 1시간만** 안 보인다 —
//   버튼 글자("하루 동안")와 실제가 어긋난다. 글자가 약속이다.
//
// ■ ★공지가 **고쳐지면 다시 보여야** 한다(`revision`)
//   같은 id 로 내용을 고쳤는데 계속 숨어 있으면 운영이 이유를 알 수 없다.
//   ⇒ 키에 revision 을 넣는다 — 올리면 그 순간 다시 뜬다.
// ═══════════════════════════════════════════════════════════════════════════

/** 하루 = 24시간(밀리초). ★자정이 아니라 **누른 때로부터**. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 저장 키 — 공지 id + 판(revision) 단위. */
export function seenKey(id: string, revision: number): string {
  return `notice.hide.${id}.r${revision}`;
}

/**
 * 지금 이 공지를 **숨겨야 하나**.
 * @param savedAt 「하루 동안 보지 않기」를 누른 시각(ms). 누른 적 없으면 null
 * @param now     지금(ms)
 * @returns 24시간이 안 지났으면 true
 *
 * ⚠️저장값이 깨졌으면(숫자가 아니면) **보여 준다** — 못 읽는 것보다 한 번 더 뜨는 편이 낫다.
 */
export function shouldHide(savedAt: number | null | undefined, now: number): boolean {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return false;
  const passed = now - savedAt;
  if (passed < 0) return false;            // 시계가 뒤로 갔다 — 숨기지 않는다
  return passed < DAY_MS;
}

/** 서버가 준 공지가 **지금 보여도 되는** 것인가(앱 쪽 2차 확인). */
export function isLive(n: { active?: boolean; starts_at?: string | null; ends_at?: string | null },
                       now: number): boolean {
  if (n.active === false) return false;
  const t = (v?: string | null) => (v ? Date.parse(v) : null);
  const s = t(n.starts_at), e = t(n.ends_at);
  if (s != null && Number.isFinite(s) && now < s) return false;
  if (e != null && Number.isFinite(e) && now >= e) return false;
  return true;
}
