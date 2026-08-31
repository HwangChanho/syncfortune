// scripts/check-ipad.ts — **iPad 대응이 조용히 풀리지 않게**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"그리고 패드도 대응해야겠어"*)
//
// ■ 무엇이 문제였나 — 넓은 레이아웃은 **이미 있었는데 조건 하나가 막고 있었다**
//   `useWideWeb()` 이 `Platform.OS === 'web' && width >= 900` 이었다.
//   그런데 `WebShell` 안에는 `document`·`window` 가 **한 줄도 없다**(실측) — 순수 RN 이다.
//   ⇒ «웹이라서» 가 아니라 «넓어서» 필요한 레이아웃인데, 면으로 막아 iPad 가 못 썼다.
//
// ■ ⚠️★`ios/`·`android/` 는 **gitignore** 다 — 소스를 못 믿는다
//   `TARGETED_DEVICE_FAMILY` 는 prebuild 산출물 안에 있어 저장소에 안 남는다.
//   ⇒ **파일을 직접 읽는다**(있을 때만). 없으면 건너뛴다.
//
// 무엇을 지키나
//   P1 ★넓은 레이아웃 판정을 **실제 기기 폭으로** 잰다 — 정규식이 아니라 숫자로.
//      («면으로 **막는 것**» 과 «면에 따라 **기준을 다르게** 두는 것» 은 다르다.
//       막으면 iPad 가 아예 못 쓰고, 기준만 다르면 둘 다 쓴다.)
//   P2 본문 폭 제한이 **사이드바보다 일찍** 걸린다 — iPad 세로에서 줄이 너무 길어지지 않게
//   P3 Xcode 대상 기기에 **iPad 가 들어 있다**(`TARGETED_DEVICE_FAMILY = "1,2"`)
//   P4 `app.json` 의 `supportsTablet` 이 켜져 있다(둘이 어긋나면 나중에 prebuild 가 되돌린다)
//
// ★음성 테스트: `npx tsx scripts/check-ipad.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { isWideWidth, BODY_CAP_FROM, WEB_WIDE } from '../app/src/lib/ui/wideLayout';   // ★의존성 0 — 진짜 함수를 부른다
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
export const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
   .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기 ──────────────────────────────────────────────────────────────────

/**
 * 실제 기기 폭으로 «넓은가» 를 잰다 — **진짜 함수**를 부른다(사본이 아니라).
 * @returns 어긋난 케이스들(빈 배열이면 통과)
 */
export function widthCases(): string[] {
  const bad: string[] = [];
  const cases: Array<[string, number, string, boolean]> = [
    // [이름, 폭, 면, 기대]
    ['iPhone 15 Pro 세로', 393, 'ios', false],
    ['iPhone Pro Max 세로', 440, 'ios', false],
    ['iPad mini 세로', 744, 'ios', true],
    ['iPad 11" 세로', 834, 'ios', true],
    ['iPad 12.9" 세로', 1024, 'ios', true],
    ['iPad 가로', 1194, 'ios', true],
    ['안드로이드 태블릿 세로', 800, 'android', true],
    ['좁은 브라우저 창', 800, 'web', false],
    ['넓은 브라우저 창', 1200, 'web', true],
  ];
  for (const [name, w, plat, want] of cases) {
    const got = isWideWidth(w, plat);
    if (got !== want) bad.push(`${name}(${w}pt · ${plat}) = ${got} (기대 ${want})`);
  }
  return bad;
}

/** 본문 폭 제한이 /** 본문 폭 제한이 **사이드바 기준보다 낮은** 폭에서 걸리는가. */
export function bodyCapEarly(src: string): boolean | null {
  const s = strip(src);
  const i = s.indexOf('export function useReadBody');
  if (i < 0) return null;
  const body = s.slice(i, i + 700);
  // ★상수 **이름**으로 본다 — 숫자를 읽으면 상수를 옮길 때마다 하네스가 깨진다
  if (!/BODY_CAP_FROM/.test(body)) return false;
  return true;
}

/** Xcode 대상 기기에 iPad(2)가 들어 있는가. */
export function pbxHasIpad(src: string): boolean {
  return /TARGETED_DEVICE_FAMILY\s*=\s*"?1,\s*2"?/.test(src);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const SHELL = 'app/src/components/WebShell.tsx';
  const WIDE = 'app/src/lib/ui/wideLayout.ts';
  const shell = read(SHELL);
  if (!shell) fail('P0', `${SHELL} 를 못 읽었다`);
  else {
    const wrong = widthCases();
    if (wrong.length) {
      fail('P1', `넓은 레이아웃 판정이 **기기 폭에서 어긋난다**:\n        ` + wrong.join('\n        ')
        + '\n        ★이 레이아웃은 «웹이라서» 가 아니라 **«넓어서»** 필요하다 — 막으면 iPad 가 못 쓴다.\n        '
        + '`WebShell` 안에는 `document`·`window` 가 한 줄도 없다(순수 RN 이라 태블릿에서 그대로 돈다)');
    }
    if (bodyCapEarly(shell) === false) {
      fail('P2', `${SHELL} 의 본문 폭 제한이 **사이드바 기준과 같거나 늦다**.\n        `
        + 'iPad 세로(744~1024)는 사이드바를 안 쓰는데, 글이 화면을 꽉 채우면 한 줄이 너무 길어진다.\n        '
        + '읽기 편한 줄 길이는 **기기와 무관하다** — 더 낮은 폭에서 걸 것');
    }
  }

  // P3 ★산출물을 직접 읽는다(gitignore 라 소스를 못 믿는다). 없으면 건너뛴다.
  const iosDir = join(ROOT, 'app/ios');
  if (existsSync(iosDir)) {
    const proj = readdirSync(iosDir).find((n) => n.endsWith('.xcodeproj'));
    const pbx = proj ? read(`app/ios/${proj}/project.pbxproj`) : null;
    if (pbx && !pbxHasIpad(pbx)) {
      fail('P3', `Xcode 대상 기기에 **iPad 가 없다**(\`TARGETED_DEVICE_FAMILY\`).\n        `
        + 'iPhone 전용으로 나가면 iPad 에서는 «호환 모드» 로 확대돼 보인다.\n        '
        + '⚠️심사는 iPad 에서도 돌린다 — 2026-08 크래시가 **iPad Pro M4** 에서 잡혔다');
    }
  }

  const appJson = read('app/app.json');
  if (appJson && !/"supportsTablet"\s*:\s*true/.test(appJson)) {
    fail('P4', 'app.json 의 `supportsTablet` 이 꺼져 있다.\n        '
      + '⚠️pbxproj 와 어긋나면 나중에 누가 prebuild 를 돌리는 순간 **iPad 대응이 조용히 사라진다**');
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'P1 ★실제 기기 폭 9종이 전부 맞는다', run: () => widthCases().length === 0 },
    { name: 'P1 iPad 세로가 넓은 축이다', run: () => isWideWidth(834, 'ios') === true },
    { name: 'P1 폰은 아니다', run: () => isWideWidth(440, 'ios') === false },
    { name: 'P1 좁은 브라우저 창은 아니다(웹 기준이 더 높다)', run: () => isWideWidth(800, 'web') === false },
    { name: 'P2 BODY_CAP_FROM 을 쓰면 통과',
      run: () => bodyCapEarly('export function useReadBody() { return width >= BODY_CAP_FROM ? cap : undefined; }') === true },
    { name: 'P2 사이드바 기준을 그대로 쓰면 문다',
      run: () => bodyCapEarly('export function useReadBody() { return wide ? cap : undefined; }') === false },
    { name: 'P2 ★상수가 실제로 더 낮다', run: () => BODY_CAP_FROM < WEB_WIDE },
    { name: 'P3 "1,2" 면 통과', run: () => pbxHasIpad('TARGETED_DEVICE_FAMILY = "1,2";') === true },
    { name: 'P3 1 이면 문다', run: () => pbxHasIpad('TARGETED_DEVICE_FAMILY = 1;') === false },
    { name: 'P3 공백이 있어도 알아본다', run: () => pbxHasIpad('TARGETED_DEVICE_FAMILY = "1, 2";') === true },
    { name: '주석 속 코드에 안 속는다',
      run: () => bodyCapEarly('// export function useReadBody() { return width >= BODY_CAP_FROM ? c : u; }\nconst a=1;') === null },
    { name: 'P1 ★안드로이드 태블릿도 넓은 축', run: () => isWideWidth(800, 'android') === true },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:ipad — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:ipad — 넓은 레이아웃이 면을 안 가리고, 빌드가 iPad 를 대상에 넣는다');
