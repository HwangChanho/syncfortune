// app/src/lib/core/buildInfo.ts — 앱 빌드 번호 단일 출처
// ═══════════════════════════════════════════════════════════════════════════
// 왜 상수로 두나 (2026-08-09):
//   `Constants.nativeBuildVersion` 은 expo-constants 17 에서 **undefined** 로 온다(실측:
//   진단 로그에 `build = ?`). 그래서 설정 화면 버전도 `1.0.0 (?)` 로 떠 **Boss 가 어떤 빌드를
//   깔았는지 확인할 수 없었다** — "업데이트했는데 안 돼요"가 실은 구버전이었던 사고의 원인.
//   `app.json` 에는 versionCode 가 없고, 우리는 `android/app/build.gradle` 을 **직접** 고친다
//   (android/ 는 prebuild 산출물이라 .gitignore).
//
// ⇒ JS 쪽 단일 출처를 두고, **하네스(check:buildnum)가 build.gradle 과 일치를 강제**한다.
//   수동 상수는 반드시 드리프트한다는 걸 이 프로젝트에서 여러 번 겪었으므로 검사를 함께 둔다.
//
// ★버전을 올릴 때: build.gradle 의 versionCode 와 **이 값을 같이** 올린다. 어긋나면 preflight 가 막는다.
// ═══════════════════════════════════════════════════════════════════════════

/** Android versionCode / iOS 는 표시용 참고값. build.gradle 과 항상 일치해야 한다. */
export const APP_BUILD = 129;
