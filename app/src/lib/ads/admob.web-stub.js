// app/src/lib/ads/admob.web-stub.js — 웹에서 AdMob 자리를 대신한다
// ─────────────────────────────────────────────────────────────────────────
// 왜: `react-native-google-mobile-ads` 는 네이티브 전용이라 웹 번들에서 그대로 죽는다
//   (`Importing native-only module "…/codegenNativeCommands" on web`).
//
// ★앱 코드는 이미 **모듈이 없는 상황**을 다룰 줄 안다 —
//   `try { Ads = require('react-native-google-mobile-ads'); } catch { Ads = null; }`
//   (네이티브 모듈이 없는 dev client 를 위해 만들어 둔 경로다.)
//   그래서 웹에서는 **그 경로를 그대로 타게** 한다: 이 모듈은 불러오는 즉시 던진다 → `Ads = null`
//   → 배너 미표시·보상형 없이 흐름 통과. 웹용 분기를 화면마다 새로 만들 필요가 없다.
//
// ⚠️웹에서 광고로 수익을 내려면 이 자리에 AdSense 등을 붙이게 된다(그때 이 파일이 진입점).
// ─────────────────────────────────────────────────────────────────────────
throw new Error('AdMob is native-only — not available on web (intentional stub).');
