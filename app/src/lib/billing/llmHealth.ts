// app/src/lib/billing/llmHealth.ts — 결제 전 Anthropic(클로드) 크레딧/헬스 확인 게이트
// ─────────────────────────────────────────────────────────────────────────
// Boss(2026-07-21): "풀이 구매 전에 무조건 클로드 콘솔에서 풀이 비용 남아있는지·갱신되는지 확인해야 한다."
//   실제 결제(Apple/Google 과금)가 먼저 일어난 뒤 Anthropic 이 죽어(크레딧 소진·키 off) 풀이 생성이
//   실패하는 상황을 막는다. 생성 실패는 서버(interpret)가 이용권을 환불하지만, *이미 결제된 사실* 자체가
//   남으면 유저 피해·환불 요청·심사 리스크가 된다 → 결제 직전에 서버 프로브(llm-health)로 확실히 불가한
//   경우를 잡아 **과금 자체를 막는다**.
//
// 동작(purchaseConsumableRC 가 결제 직전 호출):
//   · llm-health 가 { ok:false } → *확실히 불가*(크레딧 소진·키 무효·수동 점검) → throw(친화 메시지) → 과금 중단.
//   · { ok:true } / 네트워크·호출 오류 → 통과(fail-open). 우리 인프라 blip·일시장애로 정상 매출을 막지 않는다
//     (일시장애면 interpret 생성실패→환불이 백스톱).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import { logEvent } from '../backend/logger';

// 차단 시 유저에게 보일 문구 — 호출부(purchaseConsumableRC)의 기존 throw(오프라인·미준비)와 동일한
//   Alert('!', e.message) 경로로 표출된다. "잠시 후 다시" 톤(원문/사유 노출 없이).
export const READING_UNAVAILABLE_MSG = '지금은 풀이를 준비할 수 없어요. 잠시 후 다시 시도해 주세요.';

/**
 * 결제 직전 호출 — Anthropic 응답/크레딧을 서버 프로브로 확인한다.
 *   확실히 불가하면 throw(→ 호출부가 Alert 로 표출·과금 중단). 확인 불가/일시장애는 조용히 통과(fail-open).
 * @throws Error(READING_UNAVAILABLE_MSG) Anthropic 이 확정적으로 불가할 때만.
 */
export async function assertReadingAvailable(): Promise<void> {
  let data: any = null;
  let error: any = null;
  try {
    // supabase.functions.invoke 는 현재 세션 JWT 를 Authorization 헤더에 자동 첨부(서버가 로그인 유저만 프로브).
    const res = await supabase.functions.invoke('llm-health', { body: {} });
    data = res.data; error = res.error;
  } catch (e) {
    // 호출 자체 실패(네트워크·타임아웃) = 확인 불가 → 통과. 매출을 우리 blip 으로 막지 않는다(백스톱=환불).
    logEvent('llm_health_invoke_throw', { message: String((e as any)?.message ?? e) }, 'error');
    return;
  }
  if (error) {
    // Edge 오류(비2xx) = 확인 불가 → 통과. (llm-health 는 확정 불가를 200+{ok:false}로 주므로 여기 오는 건 인프라 오류)
    logEvent('llm_health_invoke_error', { message: String(error?.message ?? error) }, 'error');
    return;
  }
  if (data && data.ok === false) {
    // *확실히 불가* — 과금 차단. code: 'paused'(수동 점검) | 'no_credit'(크레딧 소진·키 무효).
    logEvent('purchase_blocked_llm_down', { code: String(data.code ?? '') }, 'error');
    throw new Error(READING_UNAVAILABLE_MSG);
  }
  // data.ok === true (또는 형식 불명) → 통과.
}
