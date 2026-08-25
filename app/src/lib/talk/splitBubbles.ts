// app/src/lib/talk/splitBubbles.ts — 답 하나를 **대화하듯 짧은 말풍선들**로 쪼갠다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"일부 AI 선생님들은 자꾸 한번에 말을 길게 하는데 대화하듯이 짧게 끊어야해"*.
//
// ■ 왜 프롬프트로 안 되나
//   시스템 프롬프트에 «한 풍선은 짧은 한 문장» 을 이미 걸어 뒀는데도 어기는 상담가가 있다.
//   ⇒ **지시는 어겨도 글의 생김새는 못 어긴다.** 받은 글을 여기서 다시 쪼갠다.
//
// ■ 종전 쪼개기가 놓친 것 (2026-08-25 실측)
//   ①**빈 줄만** 봤다(`\n{2,}`) — 모델이 한 줄씩 띄어 쓰면(단일 `\n`) 한 덩어리로 남는다
//   ②**마침표만** 봤다(`[.!?]`) — 한국어 대화체는 «그럴 수 있죠» «많이 참았잖아요» 처럼
//     마침표 없이 끝나는 일이 잦다. 그러면 문장 열 개가 한 풍선이 된다
//   ③쪼갠 뒤에도 긴 조각을 **더 쪼개지 않았다** — 쉼표로 이어 붙인 만연체가 그대로 남는다
//
// ■ ⚠️너무 잘게 쪼개도 안 된다
//   «네.» «음.» 같은 두 글자 풍선이 줄줄이 뜨면 그것도 대화가 아니다.
//   ⇒ 짧은 조각은 **앞 풍선에 도로 붙인다**(`MIN_KEEP`).
// ═══════════════════════════════════════════════════════════════════════════

/** 이 길이를 넘으면 더 쪼갠다. 한국어 한 문장이 보통 이 안에 들어온다. */
const SOFT_CAP = 52;
/** 여기를 넘으면 **쉼표에서라도** 끊는다. 카톡에서 60자는 이미 긴 편이다. */
const HARD_CAP = 60;
/** 이보다 짧은 조각은 앞 풍선에 도로 붙인다(«네.» 만 있는 풍선을 막는다). */
const MIN_KEEP = 6;

/** 문장 끝 — 문장부호 뒤. `…` 과 `~` 도 대화에서는 끝맺음이다. */
const BY_PUNCT = /(?<=[.!?…]|[.!?]["'」』])\s+/;
/**
 * 문장 끝 — **한국어 종결어미 뒤**. 마침표가 없어도 문장이 끝난 자리다.
 * ★뒤에 한글이 이어질 때만 쪼갠다 — «있죠?» 처럼 부호가 따라오면 위 규칙이 이미 잡는다.
 * ⚠️«~고», «~며» 같은 연결어미는 넣지 않는다. 문장이 안 끝났는데 끊긴다.
 */
const BY_ENDING = /(?<=[요죠다까네](?:\.|!|\?)?)\s+(?=[가-힣"'(])/;

/**
 * 답 한 덩어리를 말풍선들로 쪼갠다.
 *
 * @param answer 모델이 준 답 전체
 * @returns 순서대로 띄울 말풍선 문자열들. 빈 답이면 빈 배열
 */
export function splitBubbles(answer: string): string[] {
  const raw = String(answer ?? '').trim();
  if (!raw) return [];

  // ① 줄바꿈 — 빈 줄이든 한 줄이든 **모두** 경계로 본다
  let parts = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);

  // ② 긴 조각을 문장부호로
  parts = parts.flatMap((c) => (c.length <= SOFT_CAP ? [c] : c.split(BY_PUNCT)))
    .map((s) => s.trim()).filter(Boolean);

  // ③ 그래도 길면 한국어 종결어미로
  parts = parts.flatMap((c) => (c.length <= SOFT_CAP ? [c] : c.split(BY_ENDING)))
    .map((s) => s.trim()).filter(Boolean);

  // ④ 그래도 긴 만연체는 쉼표에서 끊는다(HARD_CAP 안쪽의 마지막 쉼표)
  //   ★쉼표가 없으면 **억지로 자르지 않는다** — 말 중간이 끊기면 대화가 아니라 고장으로 보인다
  parts = parts.flatMap((c) => {
    if (c.length <= HARD_CAP) return [c];
    const out: string[] = [];
    let rest = c;
    while (rest.length > HARD_CAP) {
      const cut = rest.lastIndexOf(', ', HARD_CAP);
      if (cut < MIN_KEEP) break;                 // 끊을 자리가 없으면 그냥 둔다(억지로 자르지 않는다)
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
    return out;
  });

  // ⑤ 너무 짧은 조각은 앞에 도로 붙인다
  const merged: string[] = [];
  for (const p of parts) {
    if (merged.length && p.length < MIN_KEEP) merged[merged.length - 1] += ` ${p}`;
    else merged.push(p);
  }
  return merged.filter(Boolean);
}

/**
 * 이 말풍선을 치는 데 걸릴 «뜸» — 점 세 개가 보이는 시간(ms).
 *
 * ★Boss 2026-08-25 *"조금 긴문장은 …이 오래 표시 돼야하고 짧은건 좀 짧게"*.
 * ⚠️종전엔 **직전에 뜬 말**의 길이를 썼다 — 지금 치고 있는 말이 아니라 이미 읽은 말이었다.
 *   그래서 짧은 말 뒤에 긴 말이 와도 뜸이 짧았다.
 *
 * @param body 지금 **치고 있는**(곧 뜰) 말풍선
 */
export function typingDelay(body: string): number {
  const n = String(body ?? '').length;
  return Math.max(260, Math.min(2200, 260 + n * 16));
}
