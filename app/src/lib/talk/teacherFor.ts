// app/src/lib/talk/teacherFor.ts — 「이 콘텐츠는 **누구에게** 물어야 하나」
// ═══════════════════════════════════════════════════════════════════════════
// ★Boss 2026-09-03: *"풀이에서 하단에 더 궁금한점 물어보기 있는데 이거 관련 카테고리의
//   ai 선생님으로 이동시키고 그 사람이 대화창에서 설명해 주는걸로 하자
//   예를들어 노쎔에게 물어보기 이렇게"*
//
// ■ ★새 표를 만들지 않는다 — 상담가마다 이미 `routes`(다루는 콘텐츠 키)가 있다.
//   그게 곧 «이 사람이 답할 수 있는 것» 이다. 표를 하나 더 만들면 반드시 갈린다.
// ■ ⚠️안내자(`guide_nabi`)는 **답하는 사람이 아니라 고르는 사람**이라 뺀다.
//   가상(`virtual`·오늘의 운세 등)도 뺀다 — LLM 을 안 부르므로 물어도 답이 없다.
// ■ 못 찾으면 **노쌤**(사주 전반)으로 — 풀이는 결국 명식 이야기다.
// ═══════════════════════════════════════════════════════════════════════════
import type { Consultant } from './consultants';

/** 못 찾았을 때 갈 곳. ★사주 전반을 보는 사람이라 어떤 풀이든 말이 된다. */
export const FALLBACK_TEACHER = 'nossem';

/**
 * 이 콘텐츠를 다루는 상담가를 고른다.
 *
 * @param kind       콘텐츠 키(`wealth`·`love`·`career`…). 풀이 화면이 아는 그 값.
 * @param all        상담가 목록(서버에서 받은 것 그대로)
 * @returns          맞는 상담가. 없으면 노쌤. 목록이 비면 `null`
 * ⚠️여러 명이 같은 콘텐츠를 다루면 **`sortOrder` 가 앞선 사람**(=목록에서 위)에게 보낸다.
 *   임의로 고르면 같은 버튼이 누를 때마다 다른 사람으로 가서 «왜 바뀌지» 가 된다.
 */
export function teacherFor(kind: string, all: Consultant[]): Consultant | null {
  if (!all.length) return null;
  const live = all.filter((c) => c.kind === 'live' && c.id !== 'guide_nabi');
  const hit = live
    .filter((c) => Array.isArray(c.routes) && c.routes.includes(kind))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))[0];
  return hit ?? live.find((c) => c.id === FALLBACK_TEACHER) ?? live[0] ?? null;
}
