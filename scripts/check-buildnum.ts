// scripts/check-buildnum.ts — JS 빌드번호 상수 ↔ android build.gradle versionCode 일치 검사
// ═══════════════════════════════════════════════════════════════════════════
// 왜: `Constants.nativeBuildVersion` 이 expo-constants 17 에서 undefined 라(실측) 빌드번호를
//   JS 상수(`app/src/lib/core/buildInfo.ts`)로 들고 있다. 수동 상수는 **반드시 드리프트한다** —
//   실제로 "vc63 깔았다"고 믿고 눌렀는데 로그는 vc61 이었던 사고가 있었다.
//   ⇒ preflight 에서 build.gradle 과 대조해 어긋나면 막는다.
//
// ⚠️`app/android/` 는 .gitignore(prebuild 산출물) → 파일이 없으면 **통과**시킨다(CI·클린 체크아웃 대비).
//   있으면 반드시 일치해야 한다.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const GRADLE = 'app/android/app/build.gradle';
const JS = 'app/src/lib/core/buildInfo.ts';

const main = () => {
  console.log('🔢 check:buildnum — 빌드번호 단일 출처');

  const jsSrc = fs.readFileSync(JS, 'utf8');
  const jsm = /export const APP_BUILD\s*=\s*(\d+)/.exec(jsSrc);
  if (!jsm) { console.log(`  ✗ ${JS} 에서 APP_BUILD 를 찾지 못했습니다`); process.exit(1); }
  const jsVal = Number(jsm[1]);

  if (!fs.existsSync(GRADLE)) {
    console.log(`  · ${GRADLE} 없음(prebuild 산출물) — 대조 생략 · APP_BUILD=${jsVal}`);
    process.exit(0);
  }
  const gm = /versionCode\s+(\d+)/.exec(fs.readFileSync(GRADLE, 'utf8'));
  if (!gm) { console.log(`  ✗ ${GRADLE} 에서 versionCode 를 찾지 못했습니다`); process.exit(1); }
  const gVal = Number(gm[1]);

  if (jsVal !== gVal) {
    console.log(`  ✗ 어긋남 — build.gradle versionCode=${gVal} · APP_BUILD=${jsVal}`);
    console.log(`     둘을 같이 올리세요(설정 화면 버전 표기·결제 진단 로그가 이 값을 씁니다).`);
    process.exit(1);
  }
  console.log(`  ✓ 일치 (${gVal})`);
};
main();
