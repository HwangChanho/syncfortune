// app/src/lib/core/withTimeout.ts — 네트워크 대기에 상한을 두는 공용 유틸
// ─────────────────────────────────────────────────────────────────────────
// ★★이 프로젝트에서 **두 번 연속** 같은 사고가 났다(2026-07-30 · 07-31):
//   유료 화면들은 결제 게이트에 들어갈 때 잠금을 건다(`gatingRef.current = true` · `setFlowBusy(true)`).
//   연타로 이중 결제되는 걸 막는 정당한 장치다. 그 다음 잔액·권한을 **await** 한다.
//   그런데 supabase-js 요청에는 **기본 타임아웃이 없다.** 회선이 어정쩡하면(5G↔LTE 전환, 지하철,
//   서버 콜드스타트) 그 await 가 영원히 끝나지 않고 → `finally` 가 실행되지 않아 → **잠금이 영구히 남는다.**
//   그 뒤로는 버튼을 눌러도 첫 줄 가드에서 즉시 반환되어 **아무 반응이 없다**.
//   화면에는 '진행 중…' 또는 아무 변화 없음으로 보이고, 사용자는 "앱이 멈췄다"고 느낀다.
//     · 07-30 IMG_8313: '쿠폰으로 열기' 멈춤 → 잔액/이용권 조회
//     · 07-31 IMG_8314: '명식의 뿌리' 진행 중… 멈춤 → `isAdminActing()`(권한 RPC)
//
// ⇒ 결제·게이트 경로에서 **네트워크를 기다리는 모든 지점**은 이 유틸을 통과시킨다.
//   실패(타임아웃)는 예외가 아니라 **값**으로 돌려준다 — 호출측이 '확인 불가'로 안전하게 처리하게.
// ─────────────────────────────────────────────────────────────────────────

/** 게이트 경로 기본 상한(ms). 사람이 '멈췄다'고 느끼기 전에 반드시 끝나야 한다. */
export const GATE_TIMEOUT_MS = 8000;

/**
 * thenable 을 상한 시간 안에 끝낸다.
 * @param p  기다릴 대상(Promise 또는 PostgrestBuilder 같은 thenable)
 * @param ms 상한(기본 8초)
 * @returns 완료 값 / **초과하면 undefined**(예외 아님 — 호출측이 '확인 불가'로 분기)
 *
 * ⚠️타임아웃은 요청을 **취소하지 않는다**(fetch abort 아님). 뒤늦게 응답이 와도 무시될 뿐이다.
 *   목적은 '응답 보장'이 아니라 **UI 잠금 해제 보장**이다.
 */
export async function withTimeout<T>(p: PromiseLike<T>, ms: number = GATE_TIMEOUT_MS): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(p),
      new Promise<undefined>((res) => { timer = setTimeout(() => res(undefined), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
