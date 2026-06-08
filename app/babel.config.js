// app/babel.config.js — Expo 트랜스파일 preset
// ─────────────────────────────────────────────────────────────────────────
// metro.config.js 의 watchFolders 로 끌어온 상위 engine/·spec/ 의 .ts 도
// 이 preset(babel-preset-expo, TypeScript 변환 포함)으로 트랜스파일된다.
// 없으면 app/ 밖 .ts 가 변환되지 않아 런타임에서 깨질 수 있다.
// ─────────────────────────────────────────────────────────────────────────
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
