/** @type {import('@bacons/apple-targets').Config} */
// 위젯 타깃(WidgetKit) — @bacons/apple-targets 로 prebuild 시 ios/ 에 익스텐션 타깃 생성.
//   App Group(group.com.syncfortune.app) 공유 → 앱이 쓴 '오늘의 운세'를 위젯이 읽음(ExtensionStorage).
module.exports = {
  type: 'widget',
  name: 'PaljaWidget',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.syncfortune.app'],
  },
};
