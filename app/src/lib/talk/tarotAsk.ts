// app/src/lib/talk/tarotAsk.ts — **카드를 뽑을 자리인가** (의존성 0)
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️★의존성이 0인 이유 — `check:tarot` 이 **진짜 함수**를 돌린다.
//   `tarotDraw.ts` 는 덱(`lib/tarot.ts`)을 물고, 그 덱은 `remoteAsset`(RN)을 문다.
//   판정까지 거기 두면 하네스가 못 부르고 **사본을 검사**하게 된다
//   ([[shared-block-eats-personality]] · `speechLevel.ts`·`wideLayout.ts` 와 같은 이유).
// ═══════════════════════════════════════════════════════════════════════════

/** 세 장 자리 — 과거·현재·흐름. */
export const THREE = ['지나온 자리', '지금 자리', '흘러가는 결'];

/**
 * 이 말이 **카드를 뽑아 달라는 말인가**.
 *
 * ⚠️★좁게 잡는다. 오탐은 «안 물었는데 카드가 나오는 것» 이고,
 *   그건 Boss 가 이미지에서 걱정한 «뜬금없음» 과 같은 종류다.
 */
export function wantsCards(text: string): boolean {
  const s = String(text ?? '').trim();
  if (!s) return false;
  if (/타로|카드/.test(s)) return true;
  return /(봐\s*주|봐줘|뽑아|점\s*좀|어떨까요|어떻게\s*될)/.test(s);
}

/** 카드 한 장을 **한 줄로** 적는다 — 지문에 그대로 들어간다. */
export function cardLine(position: string, name: string, reversed: boolean): string {
  return `${position}: ${name} (${reversed ? '역방향' : '정방향'})`;
}
