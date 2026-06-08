// app/metro.config.js — Metro 번들러 설정 (모노레포 엔진 공유)
// ─────────────────────────────────────────────────────────────────────────
// 문제: 온디바이스 엔진(../engine/)·계약(../spec/)이 app/ 폴더 *밖*에 있다.
//   tsconfig paths(@engine/*, @spec/*)는 "타입체크"만 해결할 뿐,
//   Metro 런타임 번들러는 기본적으로 projectRoot(app/) 밖을 스캔하지 않아
//   실기기/시뮬에서 "Unable to resolve ../engine/saju" 로 깨진다.
// 해결: 상위 워크스페이스(syncfortune/)를 watchFolders에 추가 → engine/·spec/
//   의 .ts 가 번들 대상이 되고, engine 내부의 '../spec/chart' 상대경로도 풀린다.
// PII 설계 불변: 엔진은 *기기에서* 도는 순수 계산(생년월일 평문은 기기 밖으로 안 나감, ADR-005·032).
// ※ lunar-javascript·iztro 의 Hermes(RN JS엔진) 호환은 실기기 빌드에서 실측 필요(ADR-032 플래그).
// ─────────────────────────────────────────────────────────────────────────
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// projectRoot = app/ (Expo 앱 루트), workspaceRoot = syncfortune/ (engine·spec 보유)
const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, '..');

const config = getDefaultConfig(projectRoot);

// 1) 상위 워크스페이스를 감시·번들 범위에 포함 (engine/·spec/ 의 .ts 를 읽기 위함)
config.watchFolders = [workspaceRoot];

// 2) 모듈 해석 경로: app/node_modules 우선, 없으면 루트 node_modules 로 폴백
//    (iztro·lunar-javascript 는 app/package.json 에 설치되어 app/node_modules 에서 잡힘)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
