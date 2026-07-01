// app/src/lib/alert.ts — 커스텀 알림(AppAlert) 라우팅 + 큐
// ─────────────────────────────────────────────────────────────────────────
// daniel: 시스템 Alert 대신 앱 디자인(미드나잇) 모달. RN Alert.alert 와 동일 시그니처.
// ★크래시 방지(핵심): RN Modal 은 한 번에 하나만 present 가능. 연속/연타로 Alert 가 겹치면
//   "앞 모달 dismiss(transition) 중에 다음 모달 present" → iOS 가 _presentViewController 중 terminate.
//   → **큐**로 항상 1개만 present 하고, 이전 모달이 완전히 닫힌(alertDismissed) 뒤에 다음을 띄운다.
// ─────────────────────────────────────────────────────────────────────────
export type AlertButton = { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
export type AlertOpts = { title: string; message?: string; buttons: AlertButton[] };

let host: ((o: AlertOpts | null) => void) | null = null;
let current: AlertOpts | null = null;   // 현재 화면에 떠 있는 1개(없으면 null)
const queue: AlertOpts[] = [];          // 대기 중인 알림들

export function registerAlertHost(fn: (o: AlertOpts | null) => void) { host = fn; }

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

/** RN Alert.alert 호환 — 큐에 넣고 순차 표시(연속/연타 시 transition 겹침=크래시 방지). */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    queue.push({ title, message, buttons: buttons && buttons.length ? buttons : [{ text: '확인' }] });
    pump();
  },
};
