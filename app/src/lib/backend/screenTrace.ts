// app/src/lib/backend/screenTrace.ts — **지금 어느 화면인가** (크래시 로그용)
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-27: iOS 에서 「Text strings must be rendered within a <Text> component.」 가 났는데
//   컴포넌트 스택이 **압축돼 `in Unknown` 뿐**이라 범인을 못 짚었다(정적 추적도 실패했다).
//
// ■ ★경로 하나면 범위가 스무 배로 좁아진다
//   «어느 화면에서 터졌나» 를 알면 그 화면의 JSX 만 보면 된다.
//   웹은 `location.pathname` 이 있지만 **네이티브에는 없다** — 그래서 마지막 경로를 여기 들고 있는다.
//
// ■ ⚠️여기서 로그를 보내지 않는다
//   기록은 이미 `_layout` 이 `logEvent('screen', …)` 으로 한다. 이 파일은 **값만 들고 있는다** —
//   같은 일을 두 곳에서 하면 계측이 두 배가 된다([[logger-self-recursion]] 의 그 계열).
// ═══════════════════════════════════════════════════════════════════════════

let _route = '';

/** 화면이 바뀔 때 부른다(`(app)/_layout` 한 곳에서만). */
export function setLastRoute(path: string): void { _route = String(path ?? ''); }

/** 마지막으로 연 화면 경로. 아직 없으면 빈 문자열. */
export function lastRoute(): string { return _route; }
