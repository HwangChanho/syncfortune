// app/src/lib/alert.ts — 커스텀 알림(AppAlert)으로 라우팅하는 Alert 호환 API
// ─────────────────────────────────────────────────────────────────────────
// daniel: 시스템 Alert 대신 앱 디자인(미드나잇) 모달로. RN Alert.alert 와 *동일 시그니처*라
//   호출부는 import 경로만 'react-native' → 이 파일로 바꾸면 됨(Alert.alert(...) 그대로).
//   AppAlert(root 1개 마운트)가 host 로 등록돼 실제 모달을 렌더.
// ─────────────────────────────────────────────────────────────────────────
export type AlertButton = { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
export type AlertOpts = { title: string; message?: string; buttons: AlertButton[] };

let host: ((o: AlertOpts) => void) | null = null;
export function registerAlertHost(fn: (o: AlertOpts) => void) { host = fn; }

/** RN Alert.alert 호환 — alert(title, message?, buttons?). 버튼 없으면 '확인' 1개. */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const bs = buttons && buttons.length ? buttons : [{ text: '확인' }];
    if (host) host({ title, message, buttons: bs });
    else console.warn('[AppAlert] host not ready:', title); // host 등록 전(앱 초기) — 사실상 없음
  },
};
