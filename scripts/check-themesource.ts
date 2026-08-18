// scripts/check-themesource.ts — 「테마 오행이 부팅 때마다 리셋되지 않는가」
// ─────────────────────────────────────────────────────────────────────────
// 왜: 대표 명식(`my_rep_v2`)과 테마 오행(`pref.themeElement`)은 **다른 것**이다.
//   · 대표 = 만세력·풀이가 보는 명식. 앱을 켜면 `preferSelfAsRep()` 이 **본인으로 되돌린다**(daniel 지시)
//   · 테마 = 사용자가 **마지막으로 고른 명식**의 색 (Boss 2026-08-18 ②안)
//   이 둘을 같은 신호로 묶으면 **어제 고른 색이 앱을 켤 때마다 본인 색으로 리셋**된다.
//   실제로 그 상태였고, 그걸 고치려다 웹 즉시 리로드를 넣었다가 고른 명식까지 날린 적이 있다.
//
// [S1] 앱 시작 경로가 `syncThemeElement()` 를 **무조건** 부르지 않는다(=`ensureThemeElement` 를 쓴다)
// [S2] `subscribeRepChange` 구독이 **`reason` 을 본다**(boot 를 걸러낸다)
// [S3] `preferSelfAsRep` 은 `'boot'` 로 알린다
// [S4] `ensureThemeElement` 는 저장값이 있으면 아무것도 하지 않는다(`hasChartElement` 가드)
//
// ★눈으로는 안 잡힌다 — 화면을 켜면 늘 그럴듯한 색이 뜨기 때문이다. 값으로 검사한다.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

// ⚠️루트 `_layout` 이다 — `(app)/_layout` 이 아니다.
//   두 파일이 같은 이름이라 실제로 한 번 헷갈렸고(2026-08-18), 그때 수정이 **엉뚱한 파일에 들어가
//   아무 효과가 없었다.** 이 하네스가 그걸 잡았다.
const LAYOUT = 'app/src/app/_layout.tsx';
const THEME_EL = 'app/src/lib/ui/themeElement.ts';
const CHART = 'app/src/lib/engine/myChart.ts';

const layout = readFileSync(LAYOUT, 'utf8');
const themeEl = readFileSync(THEME_EL, 'utf8');
const chart = readFileSync(CHART, 'utf8');
const bad: string[] = [];

// [S1] 부팅 경로 — preferSelfAsRep 뒤에 syncThemeElement 를 바로 부르면 안 된다
if (/preferSelfAsRep\(\)[^;]*\.then\(\s*\(\s*\)\s*=>\s*syncThemeElement/.test(layout)) {
  bad.push('[S1] 앱 시작에서 `preferSelfAsRep().then(() => syncThemeElement())` — 부팅마다 테마가 본인으로 덮인다');
}
if (!/ensureThemeElement\(\)/.test(layout)) {
  bad.push('[S1] 앱 시작이 `ensureThemeElement()` 를 쓰지 않는다 — 최초 실행에만 초기화해야 한다');
}

// [S2] 구독이 reason 을 본다
const sub = /subscribeRepChange\(\s*\(([^)]*)\)\s*=>\s*\{?([^)]*)/.exec(layout);
if (!sub) bad.push('[S2] `subscribeRepChange` 구독을 찾지 못했다');
else if (!/reason/.test(sub[1] + sub[2])) {
  bad.push("[S2] 구독이 `reason` 을 보지 않는다 — `'boot'`(앱이 되돌린 것)까지 테마가 따라간다");
}

// [S3] preferSelfAsRep 이 boot 로 알린다
if (!/preferSelfAsRep[\s\S]{0,600}notifyRepChange\('boot'\)/.test(chart)) {
  bad.push("[S3] `preferSelfAsRep` 이 `notifyRepChange('boot')` 로 알리지 않는다");
}

// [S4] ensureThemeElement 가드
if (!/hasChartElement\(\)/.test(themeEl)) {
  bad.push('[S4] `ensureThemeElement` 에 `hasChartElement()` 가드가 없다 — 사용자의 선택을 덮는다');
}

// ── 2026-08-19: '테마 즉시 반영' 리로드를 넣으면서 생긴 새 함정 셋 ──────────
// daniel: *"모바일에서 명식 변경했는데 테마 적용이 바로 안돼"* → 리로드를 켰다.
//   `colors` 가 모듈 로드 시 1회 결정돼(168개 파일 import) 즉시 반영은 재시작뿐이다.
//   그런데 리로드에는 값이 두 개 딸려 온다 — **어디로 돌아오나**와 **대표가 되돌아가나**.

// [S5] 리로드 뒤 **있던 화면으로 복귀**한다(daniel 2026-07-18 "명식 바꿀 때마다 홈으로 튕겨서")
if (!/consumeThemeReload\(\)/.test(layout) || !/router\.replace\(returnTo/.test(layout)) {
  bad.push('[S5] 테마 리로드 뒤 원래 화면으로 돌아가지 않는다 — 명식만 바꿔도 홈으로 튕긴다');
}

// [S6] 테마 리로드로 다시 뜬 시작에서는 `preferSelfAsRep()` 을 **건너뛴다**
//   안 건너뛰면 방금 고른 명식이 리로드 직후 본인으로 되돌아간다(테마만 바뀌고 명식은 원복 = 최악).
if (!/if \(!was\) preferSelfAsRep\(\)/.test(layout)) {
  bad.push("[S6] 테마 리로드 시작에서 `preferSelfAsRep()` 을 건너뛰지 않는다 — 방금 고른 명식이 본인으로 되돌아간다");
}

// [S7] `storeChartElement` 는 **리로드하지 않는다**(저장·판정만) — 리로드는 경로를 아는 쪽이 한다
const themeSrc = readFileSync('app/src/lib/theme.ts', 'utf8');
const storeBody = /export function storeChartElement[\s\S]*?\n\}/.exec(themeSrc)?.[0] ?? '';
if (/reloadAsync|DevSettings\.reload/.test(storeBody)) {
  bad.push('[S7] `storeChartElement` 안에서 리로드한다 — 그러면 돌아올 화면을 모른다(홈으로 튕긴다)');
}

if (process.argv.includes('--selftest')) {
  const cases: Array<[string, RegExp, string, boolean]> = [
    ['S1 위반', /preferSelfAsRep\(\)[^;]*\.then\(\s*\(\s*\)\s*=>\s*syncThemeElement/,
      'preferSelfAsRep().then(() => syncThemeElement())', true],
    ['S1 정상', /preferSelfAsRep\(\)[^;]*\.then\(\s*\(\s*\)\s*=>\s*syncThemeElement/,
      'preferSelfAsRep().catch(() => {}); ensureThemeElement()', false],
    ['S3 위반', /notifyRepChange\('boot'\)/, "notifyRepChange()", false],
    ['S3 정상', /notifyRepChange\('boot'\)/, "notifyRepChange('boot')", true],
    ['S5 위반', /router\.replace\(returnTo/, 'consumeThemeReload();', false],
    ['S5 정상', /router\.replace\(returnTo/, 'router.replace(returnTo as never)', true],
    ['S6 위반', /if \(!was\) preferSelfAsRep\(\)/, 'preferSelfAsRep().catch(() => {})', false],
    ['S6 정상', /if \(!was\) preferSelfAsRep\(\)/, 'if (!was) preferSelfAsRep().catch(() => {})', true],
    ['S7 위반', /reloadAsync|DevSettings\.reload/, 'Updates?.reloadAsync?.()', true],
    ['S7 정상', /reloadAsync|DevSettings\.reload/, 'return (readPref(ACCENT_KEY) || \'auto\') === \'auto\';', false],
  ];
  let n = 0;
  for (const [name, re, sample, want] of cases) {
    const got = re.test(sample);
    if (got !== want) { n++; console.error(`   ✗ ${name} — 기대 ${want} / 실제 ${got}`); }
  }
  console.log(n ? `\n❌ 자가 테스트 ${n}건 실패\n` : `\n✅ 자가 테스트 ${cases.length}건 통과\n`);
  process.exit(n ? 1 : 0);
}

console.log('\n🎨 테마 오행이 부팅마다 리셋되지 않는가');
if (bad.length) {
  console.error(`\n❌ 문제 ${bad.length}건 — 사용자가 고른 명식의 색이 앱을 켤 때마다 사라진다\n`);
  bad.forEach((b) => console.error('   ' + b));
  console.error('\n   ※ 대표(만세력 기준)와 테마(마지막 선택)는 **다른 값**이다 — Boss 2026-08-18 ②안.\n');
  process.exit(1);
}
console.log('   ✅ 대표는 부팅 시 본인으로, 테마는 마지막 선택을 지킨다.\n');
