// app/src/lib/talk/mentionParse.ts — `@이름` **문자열 판정만** (의존성 0)
// ═══════════════════════════════════════════════════════════════════════════
// ★`chartMention.ts` 에서 **일부러 떼어냈다.**
//   저쪽은 엔진(`@engine/structure`·`yongsinApprox`)을 끌어와서 하네스가 못 부른다.
//   그러면 하네스는 «같은 규칙의 사본»을 테스트하게 되고, 그건 아무것도 검증하지 않는다
//   ([[shared-block-eats-personality]] 의 교훈 — 사본은 반드시 갈린다).
//   ⇒ 순수 문자열 판정만 여기에 두면 `check:talkmention` 이 **진짜 함수**를 돌린다.
// ═══════════════════════════════════════════════════════════════════════════

/** 한 턴에 부를 수 있는 최대 인원 — 원가 상한이자 «누구 얘기인지» 가 흐려지는 한계. */
export const MAX_MENTIONS = 3;

/** 고를 수 있는 대상(저장된 명식 하나). `label` 이 곧 `@` 뒤에 붙는 이름이다. */
export type MentionTarget = { id: string; name: string; relation: string };

/**
 * 본문에서 `@이름` 을 찾아 **저장된 명식과 맞춘다**.
 *
 * ★왜 정규식으로 «@단어» 를 긁지 않나: 이름에 **띄어쓰기가 들어간다**("김 과장", "엄마 친구").
 *   `@[^\s]+` 로 자르면 "김"만 잡고 못 맞춘다. ⇒ **아는 이름 목록**을 긴 것부터 대 본다.
 *   (긴 것부터인 이유: "민수"와 "민수형"이 둘 다 있으면 짧은 쪽이 먼저 먹는다.)
 *
 * @param text    사용자가 쓴 문장
 * @param targets 저장된 명식들
 * @returns 본문에 실제로 등장한 대상(중복 제거 · 등장 순서 · 최대 `MAX_MENTIONS`)
 */
export function parseMentions(text: string, targets: MentionTarget[]): MentionTarget[] {
  if (!text || !targets.length) return [];
  const byLongest = [...targets].sort((a, b) => b.name.length - a.name.length);
  const found: { at: number; t: MentionTarget }[] = [];
  // ⚠️★맞은 자리는 **가린다**(같은 길이의 \u0000 으로 덮는다).
  //   안 가리면 "민수"와 "민수형"이 둘 다 있을 때 «@민수형» 안에서 "민수"가 **또** 잡힌다
  //   — 한 사람을 부르고 두 명이 실린다. 긴 것부터 도는 것만으로는 못 막는다.
  let masked = text;

  for (const t of byLongest) {
    if (!t.name) continue;
    const needle = `@${t.name}`;
    const at = masked.indexOf(needle);
    if (at < 0) continue;
    masked = masked.slice(0, at) + '\u0000'.repeat(needle.length) + masked.slice(at + needle.length);
    found.push({ at, t });
  }
  // 등장 순서대로 — 사용자가 쓴 차례가 곧 «먼저 말한 사람» 이다
  return found.sort((a, b) => a.at - b.at).slice(0, MAX_MENTIONS).map((x) => x.t);
}
