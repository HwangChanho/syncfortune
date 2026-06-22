// app/src/lib/interpretResult.ts
// 방어(daniel 2026-06-22): interpret Edge 응답을 화면이 쓰기 좋은 형태로 정규화하는 공용 헬퍼.
// ─────────────────────────────────────────────────────────────────────────
// Edge는 실패를 두 갈래로 돌려준다(supabase-js 동작 차이 때문):
//   ① 일시적 불가  → HTTP 200 + { unavailable:true, code:'llm_unavailable', message, retryAt }
//        (200이라 supabase-js가 error로 삼키지 않음 → data로 받음. needPayment 패턴과 동일.)
//   ② 진짜 오류    → 비2xx → supabase-js의 error (원문은 사용자에게 숨기고 친화 문구로 대체)
//   ③ 결제/프리미엄 필요 → needPayment / needPremium
// 사고 배경: Anthropic 사용량 한도 도달로 생성이 400 실패 → 클라가 'Edge Function returned a non-2xx'
//   라는 영문 모를 문구를 그대로 노출, 재시도 안내도 없었음. 이 헬퍼로 모든 호출처를 일관 처리.
// ─────────────────────────────────────────────────────────────────────────
import i18n from './i18n';

// i18n 키가 없으면 fallback 사용(키 누락 시 키문자열 노출 방지).
const tr = (key: string, fallback: string): string => {
  const s = i18n.t(key);
  return s && s !== key ? s : fallback;
};

export type InvokeFailKind = 'unavailable' | 'needPayment' | 'needPremium' | 'error';

// 화면이 setReading(...)에 그대로 넣을 값.
//   성공 → reading 객체(없으면 null) / 실패 → { error, ... 플래그 }. 화면은 reading?.error 로 분기.
export function readingFromInvoke(data: any, error: any): any {
  const f = invokeFail(data, error);
  if (!f) return data?.reading ?? null;
  return { error: f.message, [f.kind]: true, retryAt: f.retryAt ?? null };
}

// 실패 사유 정규화(없으면 null = 성공). 화면별 커스텀 처리가 필요할 때 사용.
export function invokeFail(
  data: any,
  error: any,
): { kind: InvokeFailKind; message: string; retryAt?: string | null } | null {
  if (error) return { kind: 'error', message: tr('common.genFailed', '풀이를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') };
  if (data?.unavailable) {
    // 클라 로캘 메시지 우선, 없으면 Edge가 준 메시지(ko) fallback.
    return { kind: 'unavailable', message: tr('common.llmBusy', data?.message || '지금 통변 생성이 일시적으로 어려워요. 잠시 후 다시 시도해 주세요.'), retryAt: data?.retryAt ?? null };
  }
  if (data?.needPayment) return { kind: 'needPayment', message: tr('special.needPay', '이용권이 필요해요. 다시 시도해 주세요.') };
  if (data?.needPremium) return { kind: 'needPremium', message: tr('special.needPay', '이용권이 필요해요. 다시 시도해 주세요.') };
  return null;
}
