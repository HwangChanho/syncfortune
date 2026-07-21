// app/src/lib/backend/coach.ts — AI 자기이해 코치 Q&A 호출(daniel 2026-07-12)
// ─────────────────────────────────────────────────────────────────────────
// 독립 대화형(풀이 종속 아님) — 사용자가 자신에 대해 궁금한 점을 물으면 그 사람의 차트에 근거해 답한다.
//   Edge interpret 의 coach 분기 사용(buildFollowupPrompt reading={} 재사용). 캐시 대신 reading_followups(category='coach') 누적.
//   게이트=서버(Edge, daniel 07-13): 프리미엄=월 5회 무료 / 비프리미엄=하루 1회 무료(광고). 초과 시 needCredit(coach 이용권).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import { appLang } from '../i18n';
import { invokeFail } from './interpretResult'; // 방어: 일시적 불가/오류 친화 처리

export type CoachTurn = { question: string; answer: string; pending?: boolean }; // pending=답 생성 중(질문만 먼저 표시·daniel 07-20)

// Edge 코치 응답: 답변 or 게이트(무료 소진 → coach 이용권 유도)
export type CoachResult =
  | { kind: 'answer'; answer: string }
  | { kind: 'needCredit'; isPremium: boolean; used: number; freeLimit: number; period: 'day' | 'month' }
  | { kind: 'error'; message: string };

/** 코치 질문 전송 → Edge(coach 분기). chartId=서버 chart_id(본인 차트). */
export async function askCoach(chartId: string, question: string): Promise<CoachResult> {
  try {
    const { data, error } = await supabase.functions.invoke('interpret', {
      body: { chartId, coach: true, question, lang: appLang() },
    });
    if (data?.needCredit) return { kind: 'needCredit', isPremium: !!data.isPremium, used: data.used ?? 0, freeLimit: data.freeLimit ?? 0, period: data.period === 'month' ? 'month' : 'day' };
    const fail = invokeFail(data, error); // 일시적 불가·오류 → 친화 메시지(원문 non-2xx 노출 방지)
    if (fail) return { kind: 'error', message: fail.message };
    if (typeof data?.answer === 'string') return { kind: 'answer', answer: data.answer };
    return { kind: 'error', message: '응답을 받지 못했습니다.' };
  } catch (e) {
    return { kind: 'error', message: (e as Error).message };
  }
}

/** 이 차트의 지난 코치 대화 로드(RLS 본인만·시간순). 화면 재진입 시 히스토리 복원. */
export async function loadCoachHistory(chartId: string): Promise<CoachTurn[]> {
  const { data } = await supabase
    .from('reading_followups')
    .select('question, answer, created_at')
    .eq('chart_id', chartId).eq('category', 'coach')
    .order('created_at', { ascending: true });
  return (data ?? []).map((r: any) => ({ question: r.question, answer: r.answer }));
}

/** 이 차트의 코치 대화 전체 삭제(RLS 본인만·category='coach'). ★삭제 전 확인(Alert)은 호출부 책임(daniel 07-21). */
export async function deleteCoachHistory(chartId: string): Promise<boolean> {
  const { error } = await supabase.from('reading_followups').delete().eq('chart_id', chartId).eq('category', 'coach');
  return !error;
}
