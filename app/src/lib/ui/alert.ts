// app/src/lib/alert.ts — 커스텀 알림(AppAlert) 라우팅 + 큐
// ─────────────────────────────────────────────────────────────────────────
// daniel: 시스템 Alert 대신 앱 디자인(미드나잇) 모달. RN Alert.alert 와 동일 시그니처.
// ★크래시 방지(핵심): RN Modal 은 한 번에 하나만 present 가능. 연속/연타로 Alert 가 겹치면
//   "앞 모달 dismiss(transition) 중에 다음 모달 present" → iOS 가 _presentViewController 중 terminate.
//   → **큐**로 항상 1개만 present 하고, 이전 모달이 완전히 닫힌(alertDismissed) 뒤에 다음을 띄운다.
// ─────────────────────────────────────────────────────────────────────────
export type AlertButton = { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
/**
 * @property onDismiss ★**버튼을 누르지 않고 닫혔을 때** 호출된다(안드로이드 뒤로가기 = Modal onRequestClose).
 *   왜 필요한가(daniel 2026-08-01 "풀이를 누르면 멈추거나 제대로 동작을 안한다"):
 *   결제 게이트는 `new Promise` 를 만들어 **버튼 onPress 에서만 resolve** 했다. 그런데 뒤로가기로 닫으면
 *   어떤 버튼도 눌리지 않아 그 Promise 가 **영원히 안 풀린다** → 호출한 화면의 잠금(gatingRef)이 남아
 *   버튼이 죽는다. 모든 유료 풀이가 같은 게이트를 쓰므로 **앱 전체가 멈춘 것처럼** 보였다.
 *   ⇒ Promise 를 만드는 쪽은 **반드시 onDismiss 로도 resolve** 해야 한다(check:hang H3 가 강제).
 */
export type AlertOpts = { title: string; message?: string; buttons: AlertButton[]; onDismiss?: () => void };

let host: ((o: AlertOpts | null) => void) | null = null;
let current: AlertOpts | null = null;   // 현재 화면에 떠 있는 1개(없으면 null)
const queue: AlertOpts[] = [];          // 대기 중인 알림들

export function registerAlertHost(fn: (o: AlertOpts | null) => void) {
  host = fn;
  pump();   // ★호스트가 늦게 마운트되는 동안 큐에 쌓인 알림을 즉시 흘려보낸다(안 그러면 다음 알림이 올 때까지 잠자코 있다).
}

// 다음 대기 알림을 표시(현재 떠 있는 게 없을 때만). present 는 항상 1개씩.
function pump() {
  if (current || !host || queue.length === 0) return;
  current = queue.shift()!;
  host(current);
}

// AppAlert 가 모달을 완전히 닫은(dismiss 애니메이션 끝) 뒤 호출 → 다음 알림 표시.
export function alertDismissed() {
  current = null;
  pump();
}

/** RN Alert.alert 호환 — 큐에 넣고 순차 표시(연속/연타 시 transition 겹침=크래시 방지).
 *  @param onDismiss 버튼 없이 닫혔을 때(안드로이드 뒤로가기). **Promise 를 기다리는 호출부는 필수.**
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], onDismiss?: () => void) {
    queue.push({ title, message, buttons: buttons && buttons.length ? buttons : [{ text: '확인' }], onDismiss });
    pump();
  },
};
