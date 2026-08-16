// scripts/check-webcrash.ts — 웹이 **백지가 되는 길**을 막아 둔다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-16~17 · 이틀에 걸쳐 잡은 버그 세 개를 한 번에 묶는다)
//   ① 중첩 `<Text>` 가 웹에서 앱 전체를 백지로 만들었다.
//      react-dom 이 `node.style[0] = …` 를 시도하다 던지고(RNW 가 인라인 스타일 자리에
//      쓰레기 배열을 넘긴다), 바운더리가 없으니 트리가 통째로 사라졌다.
//      · 이 패턴을 쓰는 파일이 **30개 넘는다** — 홈 카드·오행 에너지·만세력…
//      · 명식이 있는 사용자는 홈에서 곧바로 밟았다.
//   ② 에러 바운더리가 **하나도 없었다** → 어떤 렌더 오류든 원인 없이 백지.
//   ③ `useDeferredReady` 가 웹에서 안 풀려 만세력이 영영 스켈레톤이었고,
//      1차 수정(rAF)은 **백그라운드 탭에서 안 도는** 구멍을 남겼다.
//
// 무엇을 지키나
//   W1. 루트에서 RNW shim 을 설치한다(중첩 Text 무해화)
//   W2. 루트에 전역 에러 바운더리가 있다(백지 대신 복구 화면 + 로그)
//   W3. `useDeferredReady` 의 웹 경로가 **rAF 에 의존하지 않는다**(백그라운드 탭 회귀 방지)
//   W4. shim 은 **웹에서만** 동작한다(네이티브 앱은 병행 운영 중 — 건드리면 안 된다)
//
// ★음성 테스트: `npx tsx scripts/check-webcrash.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const ROOT_LAYOUT = 'app/src/app/_layout.tsx';
const SHIM = 'app/src/lib/web/rnwStyleShim.ts';
const BOUNDARY = 'app/src/components/AppErrorBoundary.tsx';
const DEFERRED = 'app/src/lib/ui/useDeferredReady.ts';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석을 지운 '코드만' — 주석에 적힌 설명에 걸리는 오탐을 없앤다. */
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const read = (p: string): string | null => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

// ── W1 · W2. 루트 배선 ──────────────────────────────────────────────────────
{
  const raw = read(ROOT_LAYOUT);
  if (raw == null) fail('W0', `${ROOT_LAYOUT} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`);
  else {
    const code = codeOnly(raw);
    if (!/installRnwStyleShim\s*\(\s*\)/.test(code)) {
      fail('W1', `${ROOT_LAYOUT} — RNW shim 을 설치하지 않는다. 중첩 <Text> 가 웹에서 앱을 백지로 만든다`);
    }
    if (!/<AppErrorBoundary\b/.test(code)) {
      fail('W2', `${ROOT_LAYOUT} — 전역 에러 바운더리가 없다. 렌더 오류 하나가 앱 전체를 백지로 만든다`);
    }
  }
}

// ── W1. shim 본체 ───────────────────────────────────────────────────────────
{
  const raw = read(SHIM);
  if (raw == null) fail('W1', `${SHIM} 이 없다 — 중첩 <Text> 무해화가 사라졌다`);
  else {
    const code = codeOnly(raw);
    // 숫자 키 대입만 삼키는가(표현식으로 판정 — 이름만 보면 주석에 뚫린다)
    if (!/document\.createElement/.test(code)) fail('W1', `${SHIM} — createElement 를 감싸지 않는다(스타일을 가로챌 자리가 없다)`);
    if (!/new Proxy/.test(code)) fail('W1', `${SHIM} — style 프록시가 없다`);
    // W4 — 웹 전용 가드
    if (!/Platform\.OS\s*!==\s*'web'/.test(code)) {
      fail('W4', `${SHIM} — 웹 전용 가드가 없다. 네이티브 앱까지 DOM 패치를 타면 안 된다(앱 병행 운영 중)`);
    }
  }
}

// ── W2. 바운더리 본체 ───────────────────────────────────────────────────────
{
  const raw = read(BOUNDARY);
  if (raw == null) fail('W2', `${BOUNDARY} 이 없다`);
  else {
    const code = codeOnly(raw);
    if (!/getDerivedStateFromError/.test(code)) fail('W2', `${BOUNDARY} — getDerivedStateFromError 가 없다(폴백으로 전환하지 못한다)`);
    if (!/logEvent\s*\(/.test(code)) fail('W2', `${BOUNDARY} — 크래시를 서버 로그에 남기지 않는다. 웹 사용자는 콘솔을 못 본다`);
  }
}

// ── W3. 백그라운드 탭 회귀 ──────────────────────────────────────────────────
{
  const raw = read(DEFERRED);
  if (raw == null) fail('W3', `${DEFERRED} 이 없다`);
  else {
    const code = codeOnly(raw);
    const web = code.slice(code.indexOf("Platform.OS === 'web'"));
    const webBranch = web.slice(0, web.indexOf('InteractionManager') > 0 ? web.indexOf('InteractionManager') : 400);
    if (/requestAnimationFrame/.test(webBranch)) {
      fail('W3', `${DEFERRED} — 웹 경로가 requestAnimationFrame 에 의존한다. **백그라운드 탭에서 안 돌아** 화면이 영영 스켈레톤이 된다`);
    }
    if (!/Platform\.OS === 'web'/.test(code)) fail('W3', `${DEFERRED} — 웹 분기가 없다. InteractionManager 는 웹에서 끝나지 않는다`);
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'W1: shim 호출이 없으면 문다', run: () => !/installRnwStyleShim\s*\(\s*\)/.test(codeOnly('const x = 1;')) },
    { name: 'W1: 주석 속 호출은 안 쳐준다', run: () => !/installRnwStyleShim\s*\(\s*\)/.test(codeOnly('// installRnwStyleShim()\nconst x = 1;')) },
    { name: 'W1: 실제 호출은 통과', run: () => /installRnwStyleShim\s*\(\s*\)/.test(codeOnly('installRnwStyleShim();')) },
    { name: 'W2: 바운더리 미장착을 문다', run: () => !/<AppErrorBoundary\b/.test(codeOnly('<View/>')) },
    { name: 'W3: 웹 분기의 rAF 를 문다', run: () => /requestAnimationFrame/.test("if (Platform.OS === 'web') { requestAnimationFrame(cb); }") },
    { name: 'W3: setTimeout 방식은 통과', run: () => !/requestAnimationFrame/.test("if (Platform.OS === 'web') { setTimeout(cb, 0); }") },
    { name: 'W4: 웹 가드 없는 shim 을 문다', run: () => !/Platform\.OS\s*!==\s*'web'/.test('export function f() { return true; }') },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:webcrash — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:webcrash — 중첩 <Text> 무해화 · 전역 바운더리 · 백그라운드 탭 안전');
