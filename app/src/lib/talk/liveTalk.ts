// app/src/lib/talk/liveTalk.ts — 실제 상담사와의 대화 (Edge `talk` 호출)
// ═══════════════════════════════════════════════════════════════════════════
// ★이 파일이 **앱에서 유일하게 LLM 을 부르는 상담사 경로**다.
//   가상 상담사는 `virtualTalk.ts` 로 가고 여기 오지 않는다 — 그게 원가 0 설계의 전부다.
//   (`check:talkfree` 가 `virtualTalk.ts` 에 호출 통로가 생기는 것을 막는다.)
//
// ■ 서버가 다시 한 번 막는다
//   여기서 실수로 가상 상담사를 보내도 Edge 가 400 으로 거절한다(`virtual_is_offline`).
//   ★같은 규칙을 두 곳에서 지키는 이유: 앱은 배포가 늦고 구버전이 남는다.
//     화면상으로는 아무 차이가 없는 종류의 사고라, 클라이언트만 믿으면 조용히 새어 나간다.
//
// ■ 실패는 조용히 삼키지 않는다
//   ⚠️예전에 로그인 콜백이 `catch {}` 로 원인을 버려서 이틀을 썼다([[web-login-redirect-allowlist]]).
//   여기서는 서버가 준 사유(`paused`·`capped`·`error`)를 **그대로 화면까지 올린다.**
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

/** 서버가 돌려주는 결과 — 성공/한도/중단을 **구분해서** 올린다(뭉뚱그리면 화면이 거짓말을 한다). */
export type LiveReply =
  | { ok: true; sessionId: string; answer: string; used: number; freeDaily: number; overFree: boolean }
  | { ok: false; reason: 'paused' | 'capped' | 'unauthorized' | 'failed'; message: string };

/**
 * 실제 상담사에게 한 마디 보낸다.
 *
 * @param consultantId 상담사 id(서버가 `kind='live'` 인지 다시 검증한다)
 * @param message      사용자 질문
 * @param sessionId    이어가는 대화(없으면 서버가 새로 만든다)
 * @param chartId      어느 명식으로 이야기하나(없으면 차트 없이 일반 답변)
 * @param lang         출력 언어
 * @returns 성공이면 답과 세션, 실패면 **사유가 붙은** 실패
 */
export async function askLive(
  consultantId: string,
  message: string,
  sessionId: string | null,
  chartId: string | null,
  lang = 'ko',
): Promise<LiveReply> {
  try {
    // ⚠️타임아웃을 반드시 건다 — supabase.functions.invoke 는 **기본 타임아웃이 없다**
    //   ([[session-2026-07-31-handoff]] 멈춤 근절). 안 걸면 화면이 영원히 '입력 중'이다.
    // ⚠️`withTimeout` 은 초과 시 **예외가 아니라 undefined** 를 준다(요청을 취소하지도 않는다).
    //   목적이 '응답 보장'이 아니라 'UI 잠금 해제'라서다 → 반드시 undefined 를 먼저 갈라야 한다.
    const r = await withTimeout(
      supabase.functions.invoke('talk', {
        body: { consultantId, message, sessionId, chartId, lang },
      }),
      45_000,
    );
    if (!r) return { ok: false, reason: 'failed', message: '답이 늦어지고 있어요. 잠시 뒤 다시 물어봐 주세요.' };
    const { data, error } = r;
    if (error) {
      // 401 = 로그인 필요. 그 외는 일반 실패로 묶되 **사유는 남긴다**
      const status = (error as any)?.context?.status;
      if (status === 401) return { ok: false, reason: 'unauthorized', message: '로그인하면 이야기를 나눌 수 있어요.' };
      console.warn('[talk] invoke error', status, error);
      return { ok: false, reason: 'failed', message: '지금은 답을 드리기 어려워요. 잠시 뒤 다시 물어봐 주세요.' };
    }
    if (data?.paused) return { ok: false, reason: 'paused', message: data.message ?? '지금은 상담이 잠시 멈춰 있어요.' };
    if (data?.capped) return { ok: false, reason: 'capped', message: data.message ?? '오늘은 여기까지 이야기했어요.' };
    if (!data?.answer) return { ok: false, reason: 'failed', message: data?.message ?? '답이 비어서 다시 물어봐 주세요.' };
    return {
      ok: true, sessionId: data.sessionId, answer: data.answer,
      used: data.used ?? 0, freeDaily: data.freeDaily ?? 0, overFree: !!data.overFree,
    };
  } catch (e) {
    console.warn('[talk] askLive threw', e);
    return { ok: false, reason: 'failed', message: '연결이 원활하지 않아요. 잠시 뒤 다시 물어봐 주세요.' };
  }
}
