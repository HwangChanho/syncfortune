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
  | {
      ok: true; sessionId: string; answer: string; used: number; freeDaily: number; overFree: boolean;
      /** 이번 턴에 빠져나간 운(무료 범위면 0) */
      spent?: number;
      /** ★이번 답에서 뽑힌 정리(없으면 빈 배열). 서버가 저장까지 마친 뒤 알려 준다. */
      notes?: { kind: 'me' | 'when' | 'todo' | 'said'; body: string }[];
      /** ★대화 중 안내할 콘텐츠 키(없으면 null). 서버가 답에서 마커를 떼어 내고 여기로 준다.
       *  키 → 라벨·라우트 변환은 화면이 `contentSections` 로 한다(목록의 단일 출처). */
      recommend?: string | null;
    }
  | {
      ok: false;
      /** ★`needCoins` = 무료 한도를 넘겼고 **운이 모자란다**(2026-08-24). 화면이 충전을 유도한다. */
      /** ★`stalled` = 생성이 막혔다(과부하·타임아웃). **실패가 아니라 안내**로 다룬다 —
       *  상담가가 사람처럼 한마디 하고, `retryable` 이면 화면이 잠시 뒤 **자동으로 다시** 보낸다.
       *  운은 서버가 이미 돌려놨다(`refunded`). (Boss 2026-08-24) */
      reason: 'paused' | 'capped' | 'unauthorized' | 'failed' | 'needCoins' | 'stalled';
      message: string;
      /** needCoins 일 때만 — 턴당 필요한 운 */
      cost?: number;
      /** stalled 전용 — 잠시 뒤 자동으로 다시 보낼 수 있는가 */
      retryable?: boolean;
      /** stalled 전용 — 얼마 뒤에 다시 보낼지(ms) */
      retryAfterMs?: number;
      /** stalled 전용 — 서버가 돌려준 운 */
      refunded?: number;
      /** needCoins 일 때만 — 지금 잔액(모르면 null) */
      balance?: number | null;
    };

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
  /** 재시도 회차 — 0 = 첫 시도. ⚠️**회차지 비용이 아니다**(과금에 영향 없음). */
  attempt = 0,
  /**
   * ★우리 엔진이 계산한 **명리 판정**(용신·강약·격국·오행·신살).
   * 앱이 만세력 화면에서 쓰는 **같은 함수**의 결과라, 화면과 대화가 갈릴 수 없다.
   * ⚠️과금·권한 값이 아니다 — **해석 재료**다(단가는 서버가 정한다).
   */
  verdict?: string | null,
): Promise<LiveReply> {
  try {
    // ⚠️타임아웃을 반드시 건다 — supabase.functions.invoke 는 **기본 타임아웃이 없다**
    //   ([[session-2026-07-31-handoff]] 멈춤 근절). 안 걸면 화면이 영원히 '입력 중'이다.
    // ⚠️`withTimeout` 은 초과 시 **예외가 아니라 undefined** 를 준다(요청을 취소하지도 않는다).
    //   목적이 '응답 보장'이 아니라 'UI 잠금 해제'라서다 → 반드시 undefined 를 먼저 갈라야 한다.
    const r = await withTimeout(
      supabase.functions.invoke('talk', {
        body: { consultantId, message, sessionId, chartId, lang, attempt, verdict },
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
    // ★운 부족 — 충전 유도(Boss 2026-08-24 *"운 다 떨어지면 충전 유도"*)
    if (data?.needCoins) {
      return {
        ok: false, reason: 'needCoins',
        message: data.message ?? '오늘 무료 대화를 다 썼어요.',
        cost: Number(data.cost ?? 0),
        balance: typeof data.balance === 'number' ? data.balance : null,
      };
    }
    // ★생성이 막혔다 — 끊지 않고 이어 간다(Boss 2026-08-24)
    if (data?.stalled) {
      return {
        ok: false, reason: 'stalled',
        message: data.message ?? '잠깐만요, 다시 짚어 볼게요.',
        retryable: !!data.retryable,
        retryAfterMs: Number(data.retryAfterMs ?? 2600),
        refunded: Number(data.refunded ?? 0),
      };
    }
    if (!data?.answer) return { ok: false, reason: 'failed', message: data?.message ?? '답이 비어서 다시 물어봐 주세요.' };
    return {
      ok: true, sessionId: data.sessionId, answer: data.answer,
      used: data.used ?? 0, freeDaily: data.freeDaily ?? 0, overFree: !!data.overFree,
      // ⚠️문자열일 때만 받는다 — 서버가 안 주거나 다른 걸 주면 '추천 없음'으로 떨어진다(화면이 안 깨지게)
      recommend: typeof data.recommend === 'string' ? data.recommend : null,
      notes: Array.isArray(data.notes) ? data.notes : [],
      /** 이번 턴에 빠져나간 운(무료 범위면 0) */
      spent: Number(data.spent ?? 0),
    };
  } catch (e) {
    console.warn('[talk] askLive threw', e);
    return { ok: false, reason: 'failed', message: '연결이 원활하지 않아요. 잠시 뒤 다시 물어봐 주세요.' };
  }
}

/**
 * 이 상담사와 **이어갈 세션**을 찾아 이력과 함께 돌려준다.
 *
 * ★왜 필요한가(2026-08-20 실물에서 발견): 세션 id 를 앱 메모리에만 두면
 *   새로고침·앱 재시작마다 **새 대화방이 생긴다.** 실제로 노쎔 대화가 셋으로 쪼개졌다.
 *   카톡은 앱을 껐다 켜도 같은 방이다 — 대화는 이어지는 것이 기본값이어야 한다.
 * ⚠️'가장 최근' 하나만 잇는다. 여러 방을 만드는 기능은 없다(있으면 카톡이 아니라 게시판이다).
 *
 * @param consultantId 상담사 id
 * @returns 세션과 지난 메시지(오래된 것부터). 없으면 null
 */
export async function loadThread(consultantId: string): Promise<
  { sessionId: string; messages: { id: number; role: 'user' | 'assistant'; body: string }[] } | null
> {
  try {
    const s = await withTimeout(
      supabase.from('talk_sessions')
        .select('id').eq('consultant_id', consultantId)
        .order('last_at', { ascending: false }).limit(1).maybeSingle(),
      8000,
    );
    const sid = s && !s.error ? (s.data as any)?.id : null;
    if (!sid) return null;
    const m = await withTimeout(
      supabase.from('talk_messages')
        // ★id 도 읽는다 — 정리에서 **원문으로 데려갈 때** 이 값으로 찾는다(Boss 2026-08-23)
        .select('id, role, body').eq('session_id', sid)
        .order('sent_at', { ascending: true }).limit(60),   // 화면에 60개면 충분하다(그 위는 스크롤로도 안 본다)
      8000,
    );
    const messages = m && !m.error && Array.isArray(m.data)
      ? (m.data as any[]).map((x) => ({ id: Number(x.id), role: x.role === 'user' ? 'user' as const : 'assistant' as const, body: String(x.body ?? '') }))
      : [];
    return { sessionId: sid, messages };
  } catch (e) {
    console.warn('[talk] loadThread 실패', e);
    return null;   // 실패해도 새 대화로 시작한다(막지 않는다)
  }
}

/**
 * 대화를 지운다.
 *
 * ★세션 하나만 지우면 메시지는 **CASCADE 로 함께** 사라진다(`talk_messages.session_id` FK).
 *   메시지를 따로 지우려 들면 지우다 만 상태가 생길 수 있다 — DB 가 보장하게 둔다.
 * ⚠️되돌릴 수 없다. 호출 전에 **반드시 확인을 받아야 한다**(화면 쪽 책임).
 *
 * @param consultantId 이 상담가와의 **가장 최근 대화**를 지운다
 * @returns 성공 여부. 실패 사유를 삼키지 않는다
 */
export async function deleteThread(consultantId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await withTimeout(
      supabase.from('talk_sessions')
        .select('id').eq('consultant_id', consultantId)
        .order('last_at', { ascending: false }).limit(1).maybeSingle(),
      8000,
    );
    const sid = s && !s.error ? (s.data as any)?.id : null;
    if (!sid) return { ok: true };            // 지울 게 없으면 성공으로 본다(화면은 이미 빈 상태)
    const { error } = await supabase.from('talk_sessions').delete().eq('id', sid);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
