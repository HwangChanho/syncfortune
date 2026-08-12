// scripts/check-adminweb.ts — **관리자 기능이 앱에서 빠졌으면 웹에 있어야 한다**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-12: *"앱에서 admin.tsx 빼고 나머지도 웹으로 옮겨"*
//
// ■ 왜 기계가 보나
//   앱 화면(752줄)을 지우는 이관이다. 하나라도 빠뜨리면 **그 기능이 세상에서 사라진다** —
//   그런데 앱을 지운 뒤에는 "뭐가 있었는지" 비교할 원본이 없어 **눈으로는 확인이 불가능**하다.
//   ⇒ 서버에 있는 `admin_*` RPC 를 **정본**으로 삼고, 웹이 그걸 전부 부르는지 본다.
//     (RPC 는 서버에 남아 있으므로 원본이 사라지지 않는다.)
//
// ■ 판정
//   ①`lib/core/admin.ts` 가 아는 관리자 RPC + 앱이 쓰던 시스템 토글 = **있어야 할 목록**
//   ②`docs/admin/index.html` 이 그 이름을 **실제로 호출**하는가(문자열이 아니라 rpc 호출 형태로)
//   ③앱에 관리자 **화면**이 되살아나지 않았는가(`app/(app)/admin.tsx` 부재 · `/admin` 라우팅 부재)
//
// 실행: npm run check:adminweb
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const WEB = 'docs/admin/index.html';
const APP_ADMIN_LIB = 'app/src/lib/core/admin.ts';
const APP_ADMIN_SCREEN = 'app/src/app/(app)/admin.tsx';

/**
 * 웹에 **없어도 되는** RPC — 이유 필수.
 * 앱 런타임이 스스로 쓰는 판정 함수는 관리자 '기능'이 아니므로 제외한다.
 */
const NOT_REQUIRED: Record<string, string> = {
  is_caller_god: '권한 판정 — 웹은 is_caller_admin 로 게이트한다',
  is_caller_admin: '웹이 이미 쓴다(게이트)',
};

/** 앱 화면에만 있던 시스템 토글 — RPC 목록에 안 잡히므로 명시한다. */
const SYSTEM_TOGGLES = ['set_my_test_mode', 'set_my_admin_mode', 'set_global_test_mode', 'set_app_flag'];

const read = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);

const lib = read(APP_ADMIN_LIB);
if (!lib) { console.log(`\n❌ ${APP_ADMIN_LIB} 이 없습니다\n`); process.exit(1); }
const web = read(WEB);
if (!web) { console.log(`\n❌ ${WEB} 이 없습니다 — 웹 콘솔이 사라졌습니다\n`); process.exit(1); }

// 있어야 할 목록 = lib 의 admin_* RPC + 시스템 토글
const fromLib = [...lib.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]);
const required = [...new Set([...fromLib, ...SYSTEM_TOGGLES])].filter((r) => !NOT_REQUIRED[r]);

let bad = 0;
console.log('\n🗂  관리자 기능이 웹 콘솔에 전부 있는가\n');

/**
 * 판정용 소스 — **주석을 걷어낸 코드만** 본다.
 * ★첫 판은 `rpc('이름')` 형태만 인정했는데, 웹이 공통 헬퍼로 `sysCall('set_my_test_mode', …)` 처럼
 *   **이름을 인자로 넘기는** 정상 코드를 못 잡아 3건을 오탐했다(기능은 멀쩡했다).
 *   그렇다고 파일 전체 문자열 검색으로 넓히면 **주석에 이름만 적어도 통과**한다
 *   ([[harness-judge-expression-not-name]] — 주석의 단어에 속은 이력이 있다).
 *   ⇒ 절충: **주석을 지운 뒤** 이름이 코드에 실제로 등장하는지 본다.
 */
const webCode = web
  .replace(/<!--[\s\S]*?-->/g, '')      // HTML 주석
  .replace(/\/\*[\s\S]*?\*\//g, '')    // 블록 주석
  .replace(/^\s*\/\/.*$/gm, '');       // 줄 주석

for (const r of required.sort()) {
  const called = new RegExp(`['"]${r}['"]`).test(webCode);
  if (called) { console.log(`   ✅ ${r}`); continue; }
  bad++;
  console.log(`   ❌ ${r} — 웹 콘솔이 부르지 않습니다`);
  console.log(`      앱 화면은 지워졌으므로 **이 기능은 지금 아무 데서도 쓸 수 없습니다.**`);
  console.log(`      ${WEB} 에 추가하세요.`);
}

// 앱에 관리자 화면이 되살아났는가
if (fs.existsSync(APP_ADMIN_SCREEN)) {
  bad++;
  console.log(`\n   ❌ ${APP_ADMIN_SCREEN} 이 다시 생겼습니다 — 관리자 화면은 웹으로 옮겼습니다.`);
}
const settings = read('app/src/app/(app)/settings.tsx') ?? '';
if (/router\.push\(\s*['"]\/admin['"]/.test(settings)) {
  bad++;
  console.log(`\n   ❌ settings.tsx 에 /admin 진입점이 다시 생겼습니다.`);
}

console.log(`\n   필요한 기능 ${required.length}개 · 누락 ${bad}건`);
console.log(bad ? '\n❌ check:adminweb 실패\n' : '\n✅ check:adminweb 통과 — 관리자 기능이 전부 웹에 있음\n');
if (bad) process.exitCode = 1;
