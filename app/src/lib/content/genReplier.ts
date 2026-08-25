// app/src/lib/content/genReplier.ts — **풀이 진행 알림을 «사람의 답장»으로** 바꾼다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"기존에 풀이중에 홈에 나가면 상단에 프로그래스 떴는데, 그거를 이제
//   각 카테고리별로 대표 인물이 카톡으로 답장해주는 식으로 하자"*
//
// ■ 왜 이게 나은가
//   진행률 막대는 **기계가 일하는 중**이라고 말한다. 이 앱이 파는 건 «상담»이라,
//   같은 대기 시간이라도 «누가 지금 내 걸 보고 있다» 로 읽히면 성격이 달라진다.
//
// ■ 담당자를 어떻게 정하나 — ★새로 분류하지 않는다
//   상담가 표(`consultants.routes`)에 **이미** 누가 어떤 콘텐츠를 맡는지 적혀 있다
//   (서윤쌤 = compat·love·crush… / 민재 = wealth·career… ). 그걸 **뒤집어** 쓴다.
//   ⇒ 여기서 다시 표를 만들면 관리자가 콘솔에서 담당을 바꿔도 이 화면만 옛 사람이 나온다.
//
// ■ 아무도 안 맡은 콘텐츠는
//   노쌤(사주 전반)이 받는다. 빈 칸으로 두면 배너가 통째로 사라져 **풀이가 도는 줄 모른다**.
// ═══════════════════════════════════════════════════════════════════════════
import { consultantsSnapshot, type Consultant } from '../talk/consultants';

/** 답장하는 사람 — 화면이 필요로 하는 것만. */
export type Replier = { id: string; name: string; avatar: string | null };

/** 아무도 안 맡았을 때 받는 사람. ★씨앗에 반드시 있는 id 여야 한다. */
const FALLBACK_ID = 'nossem';

/**
 * 라우트를 맡은 상담가를 찾는다.
 *
 * @param route `setGenProgress` 가 준 경로. `/wealth` 처럼 **앞에 슬래시가 붙어 있고**
 *              `?from=home` 같은 꼬리가 달릴 수 있다 — 둘 다 떼고 맞춘다.
 * @returns 담당자(없으면 노쌤). 상담가 목록을 아직 못 읽었으면 null
 */
export function replierFor(route: string): Replier | null {
  const raw = String(route ?? '');
  const key = raw.replace(/^\//, '').split(/[?#]/)[0].trim();
  // ★`/reading?kind=ziwei` 처럼 **경로가 아니라 꼬리표가 분야를 말하는** 화면이 있다.
  //   경로(`reading`)를 맡은 사람은 없지만 `kind`(=ziwei)를 맡은 사람은 있다.
  //   ⇒ 경로로 못 찾으면 `kind` 로 한 번 더 찾는다. 이걸 안 하면 사주·자미가 **둘 다 노쌤**이 된다.
  const kind = /[?&]kind=([a-z0-9]+)/i.exec(raw)?.[1]?.toLowerCase() ?? '';
  const list = consultantsSnapshot();
  if (!list.length) return null;
  const pick = (c: Consultant | undefined): Replier | null =>
    c ? { id: c.id, name: c.name, avatar: c.avatar } : null;
  const byRoute = (k: string) => (k ? list.find((c) => c.routes.includes(k)) : undefined);
  return pick(byRoute(key))
      ?? pick(byRoute(kind))
      ?? pick(list.find((c) => c.id === FALLBACK_ID))
      ?? pick(list[0]);
}

/** 배너가 보여 줄 세 가지 상태. */
export type GenState = 'working' | 'restored' | 'done';

/**
 * 그 사람이 보낼 말.
 *
 * ★진행률 숫자를 **문장 안에 넣지 않는다** — "37% 보는 중" 은 사람의 말이 아니다.
 *   숫자가 필요하면 화면이 따로(작게) 붙인다.
 * ⚠️§4: 기다리게 하는 말이라 **미안함이 아니라 성의**로 적는다. 재촉·불안 금지.
 *
 * @param state 지금 상태
 * @param label 콘텐츠 이름(예: `재물운`) — 무엇을 보고 있는지 밝힌다
 */
export function replyLine(state: GenState, label: string): string {
  const what = label?.trim() ? label.trim() : '풀이';
  if (state === 'done') return `${what} 다 봤어요. 정리해서 보내드릴게요.`;
  if (state === 'restored') return `${what} 보다가 멈췄네요. 이어서 볼까요?`;
  return `지금 ${what} 보고 있어요. 조금만 기다려 주세요.`;
}
