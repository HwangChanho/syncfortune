// app/src/lib/ui/authBusy.ts
// ─────────────────────────────────────────────────────────────────────────
// 인증 전환(로그아웃·로그인) 중 전역 블로킹 오버레이 신호(daniel 07-02).
//   로그아웃 시 signOut → 구독 해제·RC 익명화(logoutPurchases)·로컬 데이터 정리(clearLocalUserData)·
//   명식 리로드 캐스케이드(notifyRepChange)가 도는 동안 앱이 잠깐 '먹통'처럼 반응이 없다.
//   그 구간에 화면을 막고(입력 차단) 로딩 인디케이터를 띄워, 완료 후 다시 쓸 수 있을 때 해제한다.
//   비-React 모듈이라 경량 pub/sub(useSyncExternalStore로 구독). 안전장치=8초 후 자동 해제(영구 먹통 방지).
// ─────────────────────────────────────────────────────────────────────────
let busy = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** 전역 인증 전환 오버레이 on/off. on 시 8초 안전 타임아웃(클린업이 매달려도 영구 차단 방지). */
export function setAuthBusy(v: boolean): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (busy === v) { if (v) timer = setTimeout(() => setAuthBusy(false), 8000); return; }
  busy = v;
  emit();
  if (v) timer = setTimeout(() => setAuthBusy(false), 8000); // 안전장치
}
export function subscribeAuthBusy(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb); }; }
export function getAuthBusy(): boolean { return busy; }
