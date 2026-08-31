// scripts/check-readbody.ts — 읽는 화면은 **지면은 넓고 글은 좁다**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (daniel 2026-08-17~18: *"오른쪽 컨텐츠 영역 양끝에 여백이 너무 많아"* →
//   *"17개에 본문 캡 붙이고 읽는 화면도 넓혀"*)
//
//   읽는 화면의 지면(`WEB_READ`)을 넓히면 여백은 줄지만, 본문에 캡이 없으면 **글줄이 같이 길어진다.**
//   실제로 그렇게 당했다 — 캡 없이 1360 으로 넓히자 본문 문장 컨테이너가 **1269px**(한글 80자/줄)이 됐다.
//
//   ★그때 내 판단 근거가 틀렸다: "본문은 `SpecialContentScreen` 이 캡한다"고 봤는데,
//     그 근거인 grep 이 **import 경로**에 걸린 것이었다. 실제로 `<SpecialContentScreen>` 으로
//     렌더하는 화면은 12개뿐이고 **17개는 `ContentHero` 만 가져와 본문을 자기가 그렸다**.
//   ⇒ **grep 히트 수를 '사용처 수'로 읽지 말 것.** 이 하네스가 그 착각을 대신 막는다.
//
// 무엇을 지키나
//   R1. 지면(`WEB_READ`)이 본문 캡(`WEB_BODY`)보다 **충분히 넓다** — 값을 실행해서 본다
//   R2. 본문 캡이 **한 곳에서만** 정의된다(`useReadBody`) — 사본 금지
//   R3. `<ContentHero>` 를 쓰는 화면은 **전부** 본문 캡을 쓴다
//       — `<SpecialContentScreen>` 으로 렌더하면 그쪽이 캡하므로 면제
//   R4. 캡 값이 한글 가독 범위(560~760px)에 있다
//
// ★음성 테스트: `npx tsx scripts/check-readbody.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const SHELL = 'app/src/components/WebShell.tsx';
const SPECIAL = 'app/src/components/SpecialContentScreen.tsx';
const SCREEN_DIR = 'app/src/app/(app)';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석을 지운 '코드만' — 주석 속 예시에 걸리는 오탐을 없앤다. */
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** 소스에서 `export const NAME = 숫자;` 값을 뽑는다(런타임 import 없이 — WebShell 은 RN 컴포넌트다). */
export function constOf(src: string, name: string): number | null {
  const m = new RegExp(`export const ${name}\\s*=\\s*(\\d+)`).exec(src);
  return m ? Number(m[1]) : null;
}

const shell = fs.existsSync(SHELL) ? fs.readFileSync(SHELL, 'utf8') : null;
if (!shell) fail('R0', `${SHELL} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`);

let read: number | null = null, body: number | null = null;
if (shell) {
  read = constOf(shell, 'WEB_READ');
  /**
   * ★상수가 **옮겨 갔다** — 2026-08-31 iPad 대응으로 폭 판정을 `lib/ui/wideLayout.ts`(의존성 0)로
   *   뺐다. `WebShell` 은 그걸 **재수출**만 한다. 여기서 못 찾으면 그 파일도 본다.
   * ⚠️«없다» 고 단정하기 전에 **옮겨 간 자리를 확인한다** — 안 그러면 멀쩡한 코드를 빨간불로 만든다
   *   ([[harness-goes-blind-on-refactor]]).
   */
  body = constOf(shell, 'WEB_BODY');
  if (body == null) {
    const WIDE = 'app/src/lib/ui/wideLayout.ts';
    const w = fs.existsSync(WIDE) ? fs.readFileSync(WIDE, 'utf8') : null;
    if (w) body = constOf(w, 'WEB_BODY');
  }

  // ── R1. 지면 > 본문 ──
  if (read == null) fail('R1', `${SHELL} 에서 WEB_READ 를 못 찾았다`);
  if (body == null) fail('R1', `${SHELL} 에서 WEB_BODY 를 못 찾았다`);
  if (read != null && body != null && read <= body + 200) {
    fail('R1', `지면(WEB_READ=${read})이 본문 캡(WEB_BODY=${body})보다 충분히 넓지 않다.\n        지면이 좁으면 '히어로 전폭 · 글 좁게' 가 성립하지 않는다(최소 +200px)`);
  }
  // ── R4. 캡이 한글 가독 범위 ──
  if (body != null && !(body >= 560 && body <= 760)) {
    fail('R4', `본문 캡 WEB_BODY=${body} — 한글 본문은 560~760px 에서 한 줄이 35~45자로 떨어진다. 이 범위를 벗어났다`);
  }
  // ── R2. 캡 정의는 한 곳 ──
  if (!/export function useReadBody\b/.test(shell)) {
    fail('R2', `${SHELL} — 본문 캡 훅(useReadBody)이 없다. 캡이 화면마다 흩어지면 지면을 넓힐 때 또 깨진다`);
  }
}

// ── R2(계속). 사본 금지 — 다른 파일이 자체로 680 캡을 만들지 않는가 ────────────
// ── R3. ContentHero 를 쓰는 화면은 전부 캡을 쓴다 ─────────────────────────────
function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

for (const file of [...walk(SCREEN_DIR), SPECIAL]) {
  const norm = file.split(path.sep).join('/');
  const code = codeOnly(fs.readFileSync(file, 'utf8'));

  // R2 — 캡 사본(직접 maxWidth 680 류)을 만들지 않는가
  if (norm !== SHELL && /maxWidth:\s*680\b/.test(code)) {
    fail('R2', `${norm} — 본문 캡을 직접 만들었다(maxWidth: 680). \`useReadBody()\` 를 쓸 것(값이 갈린다)`);
  }

  // R3 — ContentHero 를 쓰면 캡도 써야 한다(SpecialContentScreen 으로 렌더하면 면제)
  if (!/<ContentHero\b/.test(code)) continue;
  if (/<SpecialContentScreen\b/.test(code)) continue;              // 그쪽이 캡한다
  if (norm === SPECIAL) continue;                                   // 캡을 제공하는 당사자
  if (!/useReadBody\s*\(\s*\)/.test(code)) {
    fail('R3', `${norm} — \`<ContentHero>\` 로 지면을 쓰면서 본문 캡이 없다.\n        지면이 ${read ?? '?'}px 이므로 글줄이 그만큼 길어진다 — \`useReadBody()\` 로 감쌀 것`);
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'R1: 상수를 소스에서 읽는다', run: () => constOf('export const WEB_READ = 1360;', 'WEB_READ') === 1360 },
    { name: 'R1: 지면이 좁으면 문다', run: () => { const r = 800, b = 680; return r <= b + 200; } },
    { name: 'R1: 충분히 넓으면 통과', run: () => { const r = 1360, b = 680; return !(r <= b + 200); } },
    { name: 'R4: 캡이 범위 밖이면 문다', run: () => !(1100 >= 560 && 1100 <= 760) },
    { name: 'R4: 680 은 통과', run: () => 680 >= 560 && 680 <= 760 },
    { name: 'R2: 캡 사본(maxWidth: 680)을 문다', run: () => /maxWidth:\s*680\b/.test("const x = { maxWidth: 680 };") },
    { name: 'R2: 주석 속 680 은 안 문다', run: () => !/maxWidth:\s*680\b/.test(codeOnly("// maxWidth: 680 이었다\nconst x = 1;")) },
    { name: 'R3: ContentHero + 캡 없음을 문다', run: () => { const c = '<ContentHero title="x" />'; return /<ContentHero\b/.test(c) && !/useReadBody\s*\(\s*\)/.test(c); } },
    { name: 'R3: 캡이 있으면 통과', run: () => { const c = 'const readBody = useReadBody();\n<ContentHero />'; return /useReadBody\s*\(\s*\)/.test(c); } },
    { name: 'R3: SpecialContentScreen 렌더는 면제', run: () => /<SpecialContentScreen\b/.test('<SpecialContentScreen kind="x" />') },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:readbody — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:readbody — 지면 ${read}px · 본문 ${body}px (히어로는 전폭 · 글은 좁게) · 캡 단일 소스`);
