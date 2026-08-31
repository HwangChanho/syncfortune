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
//   P1 넓은 레이아웃 판정이 **면을 안 본다**(`Platform.OS` 로 막지 않는다)
//   P2 본문 폭 제한이 **사이드바보다 일찍** 걸린다 — iPad 세로에서 줄이 너무 길어지지 않게
//   P3 Xcode 대상 기기에 **iPad 가 들어 있다**(`TARGETED_DEVICE_FAMILY = "1,2"`)
//   P4 `app.json` 의 `supportsTablet` 이 켜져 있다(둘이 어긋나면 나중에 prebuild 가 되돌린다)
//
// ★음성 테스트: `npx tsx scripts/check-ipad.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

/** 넓은 레이아웃 판정이 **면으로 막고 있는가**(막으면 iPad 가 못 쓴다). */
export function gatedByPlatform(src: string): boolean {
  const s = strip(src);
  const i = s.indexOf('export function useWideWeb');
  if (i < 0) return false;
  // ⚠️★첫 `}` 로 자르면 **구조분해**(`const { width } = …`)에서 끊긴다 —
  //   그 뒤의 `Platform.OS` 를 못 보고 «안 막는다» 고 잘못 답한다(음성 테스트가 잡았다).
  //   ⇒ 줄 맨 앞의 `}` 까지가 함수 본문이다.
  const rest = s.slice(i);
  const end = rest.search(/\n\}/);
  const body = end > 0 ? rest.slice(0, end) : rest.slice(0, 400);
  return /Platform\.OS/.test(body);
}

/** 본문 폭 제한이 **사이드바 기준보다 낮은** 폭에서 걸리는가. */
export function bodyCapEarly(src: string): boolean | null {
  const s = strip(src);
  const wide = /WEB_WIDE\s*=\s*(\d+)/.exec(s);
  const i = s.indexOf('export function useReadBody');
  if (i < 0 || !wide) return null;
  const body = s.slice(i, i + 700);
  const m = /width\s*>=\s*(\d+)/.exec(body);
  if (!m) return false;                        // 폭 기준이 아예 없다 = 못 건다
  return Number(m[1]) < Number(wide[1]);
}

/** Xcode 대상 기기에 iPad(2)가 들어 있는가. */
export function pbxHasIpad(src: string): boolean {
  return /TARGETED_DEVICE_FAMILY\s*=\s*"?1,\s*2"?/.test(src);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const SHELL = 'app/src/components/WebShell.tsx';
  const shell = read(SHELL);
  if (!shell) fail('P0', `${SHELL} 를 못 읽었다`);
  else {
    if (gatedByPlatform(shell)) {
      fail('P1', `${SHELL} 의 \`useWideWeb\` 가 **면으로 막는다**(\`Platform.OS\`).\n        `
        + '이 레이아웃은 «웹이라서» 가 아니라 **«넓어서»** 필요하다 — 막으면 iPad 가 못 쓴다.\n        '
        + '★`WebShell` 안에는 `document`·`window` 가 한 줄도 없다(순수 RN 이라 태블릿에서 그대로 돈다)');
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
  const OK = 'export const WEB_WIDE = 900;\n'
    + 'export function useReadBody() {\n  return width >= 700 ? cap : undefined;\n}\n'
    + 'export function useWideWeb(): boolean {\n  const { width } = useWindowDimensions();\n  return width >= WEB_WIDE;\n}';
  const BAD = OK.replace('return width >= WEB_WIDE;', "return Platform.OS === 'web' && width >= WEB_WIDE;");
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'P1 면을 안 보면 통과', run: () => gatedByPlatform(OK) === false },
    { name: 'P1 Platform.OS 로 막으면 문다', run: () => gatedByPlatform(BAD) === true },
    { name: 'P1 다른 함수의 Platform.OS 에 안 속는다',
      run: () => gatedByPlatform("function other(){ Platform.OS }\nexport function useWideWeb(){ return width >= 900; }") === false },
    { name: 'P2 더 낮은 폭이면 통과', run: () => bodyCapEarly(OK) === true },
    { name: 'P2 같은 폭이면 문다', run: () => bodyCapEarly(OK.replace('width >= 700', 'width >= 900')) === false },
    { name: 'P2 폭 기준이 없으면 문다',
      run: () => bodyCapEarly(OK.replace('return width >= 700 ? cap : undefined;', 'return wide ? cap : undefined;')) === false },
    { name: 'P3 "1,2" 면 통과', run: () => pbxHasIpad('TARGETED_DEVICE_FAMILY = "1,2";') === true },
    { name: 'P3 1 이면 문다', run: () => pbxHasIpad('TARGETED_DEVICE_FAMILY = 1;') === false },
    { name: 'P3 공백이 있어도 알아본다', run: () => pbxHasIpad('TARGETED_DEVICE_FAMILY = "1, 2";') === true },
    { name: '주석 속 코드에 안 속는다',
      run: () => gatedByPlatform("// export function useWideWeb(){ Platform.OS }\nconst a=1;") === false },
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
