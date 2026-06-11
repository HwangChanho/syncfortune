// app/src/lib/followups.ts — 풀이 섹션별 추가 질문(Q&A) 호출·로드
// ─────────────────────────────────────────────────────────────────────────
// 프리미엄: 영역(궁)당 무료 2회 + 초과 시 건당 결제(daniel). Edge interpret 의 question 분기 사용.
//   풀이(base/past/overlay/remedy)와 달리 캐시 대신 reading_followups 에 누적 — 질문마다 다름.
// 게이트는 서버(Edge)가 판정: needPremium / needPayment / answer 를 반환. paid 플래그로 결제 후 우회.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

export type Followup = { question: string; answer: string; created_at?: string };

/** 한 차트의 모든 추가 질문을 영역(category)별로 묶어 로드(RLS: 본인 것만). */
export async function loadFollowups(chartId: string): Promise<Record<string, Followup[]>> {
  const { data } = await supabase
    .from('reading_followups')
    .select('category, question, answer, created_at')
    .eq('chart_id', chartId)
    .order('created_at', { ascending: true });
  const byCat: Record<string, Followup[]> = {};
  (data ?? []).forEach((r: any) => {
    (byCat[r.category] ??= []).push({ question: r.question, answer: r.answer, created_at: r.created_at });
  });
  return byCat;
}

// Edge 추가 질문 응답: 답변 or 게이트(프리미엄 유도·건당 결제 필요)
export type AskResult =
  | { kind: 'answer'; answer: string; used: number; freeLimit: number }
  | { kind: 'needPremium'; used: number; freeLimit: number }
  | { kind: 'needPayment'; used: number; freeLimit: number }
  | { kind: 'error'; message: string };

/**
 * 추가 질문 전송 → Edge(question 분기). paid=true 면 건당 결제 후 호출(무료 한도 우회).
 * @param kind 'saju'|'ziwei' (프롬프트 분기엔 무관하나 일관성 위해 전달)
 */
export async function askFollowup(
  chartId: string, category: string, kind: string, question: string, paid = false,
): Promise<AskResult> {
  try {
    const { data, error } = await supabase.functions.invoke('interpret', {
      body: { chartId, category, kind, tier: 'paid', question, paid },
    });
    if (error) return { kind: 'error', message: error.message };
    if (data?.needPremium) return { kind: 'needPremium', used: data.used, freeLimit: data.freeLimit };
    if (data?.needPayment) return { kind: 'needPayment', used: data.used, freeLimit: data.freeLimit };
    if (typeof data?.answer === 'string') return { kind: 'answer', answer: data.answer, used: data.used, freeLimit: data.freeLimit };
    return { kind: 'error', message: '응답을 받지 못했습니다.' };
  } catch (e) {
    return { kind: 'error', message: (e as Error).message };
  }
}
