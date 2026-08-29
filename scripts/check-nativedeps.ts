// scripts/check-nativedeps.ts — ⚠️**네이티브 모듈이 iOS 빌드에 조용히 빠지는 것**
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-29 실사고. `expo-image-picker` 를 넣고 코드를 다 붙인 뒤 TestFlight(vc131)를 올렸는데,
// **`pod install` 을 안 돌려서 그 모듈이 IPA 에 없었다.**
//
// ■ ★왜 아무도 몰랐나 — 모든 신호가 초록이었다
//   · `npm install` 성공 · 타입체크 통과 · preflight 통과 · fastlane **EXIT=0**
//   · 앱은 `require('expo-image-picker')` 를 **try/catch 로 감싸는 관용**이라(미포함 빌드 대비)
//     모듈이 없으면 **조용히 null** 이 되고 버튼만 사라진다. 오류 한 줄 없다.
//   ⇒ 「고쳤다는데 폰에서는 그대로」 가 되고, 빌드 한 판(20분)과 잘못된 보고가 날아간다.
//     ★내가 Boss 에게 «vc131 에 들어간다» 고 **틀리게 보고했다.**
//
// ■ 재는 것 — **package.json 에 있는 네이티브 모듈이 `Podfile.lock` 에도 있는가**
//   · pod 이름을 **추측하지 않는다.** `node_modules/<pkg>/ios/*.podspec` 의 **파일 이름이 곧 pod 이름**이다
//     (`expo-image-picker` → `ExpoImagePicker.podspec`). 이름 규칙을 손으로 적으면 언젠가 어긋난다.
//   · 안드로이드는 검사하지 않는다 — gradle 이 **빌드할 때** autolinking 으로 훑으므로
//     «설치했는데 빠지는» 구간이 없다(이번에도 안드로이드는 자동으로 들어갔다).
//
// ⚠️`app/ios/` 는 gitignore 다 → 없으면 **건너뛴다**(막 클론한 곳을 빨간불로 만들지 않는다).
// ★음성 테스트: `npx tsx scripts/check-nativedeps.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const PKG = `${ROOT}app/package.json`;
const LOCK = `${ROOT}app/ios/Podfile.lock`;
const MODS = `${ROOT}app/node_modules`;

/**
 * `Podfile.lock` 에 그 pod 이 실려 있는가.
 * ★`PODS:` 목록의 항목 형태(`  - 이름 (버전)`)로 본다 — 파일 아무 데나 이름이 있다고 통과시키면
 *   의존성 그래프의 곁가지 언급에도 걸려 **거짓 초록불**이 된다.
 * @param lock Podfile.lock 전문 · @param pod 팟 이름(`ExpoImagePicker`)
 */
export function lockHasPod(lock: string, pod: string): boolean {
  return new RegExp(`^\\s*-\\s+${pod}\\s*\\(`, 'm').test(lock);
}

// ── 음성 테스트 ────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const lock = 'PODS:\n  - ExpoImagePicker (16.0.6):\n    - ExpoModulesCore\n  - ExpoFont (13.0.1)\n';
  const cases: [string, boolean, boolean][] = [
    ['있는 pod', lockHasPod(lock, 'ExpoImagePicker'), true],
    ['없는 pod', lockHasPod(lock, 'ExpoCamera'), false],
    ['의존성 줄에만 언급된 것은 통과 안 됨', lockHasPod(lock, 'ExpoModulesCore'), false],
    ['접두어가 같은 다른 pod', lockHasPod(lock, 'ExpoFontExtra'), false],
  ];
  let bad = 0;
  for (const [name, got, expect] of cases) {
    if (got !== expect) { bad++; console.log(`  ❌ 음성테스트 «${name}» — 기대 ${expect}, 실제 ${got}`); }
    else console.log(`  ✅ 음성테스트 «${name}»`);
  }
  console.log(bad ? `\n❌ 판정기가 ${bad}건을 못 뭅니다\n` : '\n✅ 판정기가 네 경우를 전부 가릅니다\n');
  process.exit(bad ? 1 : 0);
}

console.log('\n📦 check:nativedeps — 네이티브 모듈이 iOS 빌드에 빠지지 않았는가\n');

if (!existsSync(LOCK)) {
  console.log('  ⏭  건너뜀 — app/ios/Podfile.lock 이 없습니다(app/ios 는 gitignore)\n');
  process.exit(0);
}
const lock = readFileSync(LOCK, 'utf8');
const deps = Object.keys(JSON.parse(readFileSync(PKG, 'utf8')).dependencies ?? {});

const missing: string[] = [];
let checked = 0;
for (const dep of deps) {
  const iosDir = `${MODS}/${dep}/ios`;
  if (!existsSync(iosDir)) continue;                       // 네이티브 모듈이 아니다
  let specs: string[];
  try { specs = readdirSync(iosDir).filter((f) => f.endsWith('.podspec')); } catch { continue; }
  if (!specs.length) continue;                             // podspec 이 다른 곳에 있는 형태 — 판정하지 않는다
  const pod = specs[0].replace(/\.podspec$/, '');
  checked++;
  if (!lockHasPod(lock, pod)) missing.push(`${dep} → ${pod}`);
}

if (missing.length) {
  console.log(`  ❌ Podfile.lock 에 없는 네이티브 모듈 ${missing.length}건 — **이 기능은 IPA 에 없습니다**`);
  missing.forEach((m) => console.log(`     · ${m}`));
  console.log('\n  처방: `cd app/ios && pod install` 후 **다시 빌드**하십시오.');
  console.log('  ⚠️앱이 네이티브 모듈을 try/catch 로 감싸는 관용이라, 빠져도 **오류 없이 버튼만 사라집니다**.\n');
  process.exit(1);
}
console.log(`  ✅ 네이티브 모듈 ${checked}개가 전부 Podfile.lock 에 있습니다\n`);
process.exit(0);
