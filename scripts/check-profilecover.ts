// scripts/check-profilecover.ts — 프로필 창이 **사진을 가리지 않는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31, 스크린샷 첨부)
//   *"뒤에 배경에 검은 블러처리는 없애 모든 전문가 개인계정 전부"*
//   *"x표시도 너무 위에있어"*
//
// ■ 무엇이 문제였나
//   ① `scrim` — `top: '45%'` 부터 `rgba(0,0,0,0.45)` 한 장을 덮었다.
//      화면 한가운데 **가로 경계선**이 그어져 사진이 반 토막으로 보였다.
//      ★흰 글자 가독성 때문에 넣은 것이지만, 그건 **글자 쪽에서**(그림자) 풀 문제다.
//      ⚠️«글자가 안 보인다» 는 지적이 오면 이 띠를 되살리고 싶어진다 — 그래서 규칙으로 박는다.
//   ② `x` — `top: space(5)` **고정값**이라 노치 기기에서 시계·배터리와 같은 줄에 붙었다.
//      ★`check:overlaybottom` 은 못 잡는다: 그건 **아래**를 보고, 「파일이 insets 를 쓰면 통과」인데
//        이 파일은 이미 아래쪽에 insets 를 쓰고 있었다. 같은 병인데 검사만 없었다.
//
// 무엇을 지키나
//   P1 배경 사진 위에 **어두운 덮개**를 다시 깔지 않는다(글자는 그림자로 읽힌다)
//   P2 닫기(✕)의 `top` 이 **안전영역에서** 나온다(고정값 금지)
//   P3 흰 글자에 **그림자**가 있다 — 띠를 걷어낸 대가를 실제로 치르고 있는지
//
// ★음성 테스트: `npx tsx scripts/check-profilecover.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
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
 * 배경 사진 위에 **어두운 덮개**가 있는가.
 *
 * ★시트 **뒤** 를 어둡게 하는 `root` 배경은 대상이 아니다 — 그건 사진이 아니라
 *   그 아래 화면을 가린다(다이얼로그 딤과 같은 성격).
 *   ⇒ `absoluteFill` 계열 + 검은 반투명이면서 **`root` 가 아닌** 것만 문다.
 */
export function hasDarkCoverScrim(src: string): boolean {
  const s = strip(src);
  for (const m of s.matchAll(/(\w+)\s*:\s*\{[^}]*absoluteFillObject[^}]*\}/g)) {
    const [decl, name] = [m[0], m[1]];
    if (name === 'root' || name === 'full') continue;          // 시트 뒤 · 영상 전체 보기
    if (/backgroundColor\s*:\s*'rgba\(0,\s*0,\s*0,\s*0?\.[1-9]/.test(decl)) return true;
  }
  return false;
}

/** 닫기 버튼의 `top` 이 안전영역에서 나오는가. */
export function closeUsesInsetTop(src: string): boolean | null {
  const s = strip(src);
  if (!/styles\.x\b/.test(s)) return null;                     // 닫기 버튼을 못 찾으면 단정 안 함
  // 스타일 자체에 고정 top 이 박혀 있으면 실패
  if (/\bx\s*:\s*\{[^}]*\btop\s*:/.test(s)) return false;
  // 쓰는 자리에서 insets.top 으로 덮어써야 통과
  return /styles\.x[^\]]*\{[^}]*top\s*:[^}]*insets\.top/.test(s);
}

/** 사진 위 흰 글자에 그림자가 있는가(띠를 걷어낸 대가). */
export function whiteTextHasShadow(src: string): boolean {
  const s = strip(src);
  const name = /name\s*:\s*\{[^}]*\}/.exec(s)?.[0] ?? '';
  return /textShadow(Color|Radius)/.test(name);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const P = 'app/src/components/talk/ProfileSheet.tsx';
  const src = read(P);
  if (!src) fail('P0', `${P} 를 못 읽었다 — 프로필 창 경로가 바뀌었나`);
  else {
    if (hasDarkCoverScrim(src)) {
      fail('P1', `${P} 가 배경 사진 위에 **어두운 덮개**를 깐다.\n        `
        + 'Boss 2026-08-31 *"뒤에 배경에 검은 블러처리는 없애 모든 전문가 개인계정 전부"*.\n        '
        + '⚠️`top: \'45%\'` 처럼 일부만 덮으면 화면 한가운데 **가로 경계선**이 그어진다.\n        '
        + '★글자 가독성은 **글자 쪽에서** 푼다(`textShadow*`) — 사진을 어둡게 할 이유가 없다');
    }
    if (closeUsesInsetTop(src) === false) {
      fail('P2', `${P} 의 닫기(✕) \`top\` 이 **고정값**이다.\n        `
        + 'Boss *"x표시도 너무 위에있어"* — 노치 기기에서 시계·배터리와 같은 줄에 붙는다.\n        '
        + '⇒ `top: Math.max(space(5), insets.top + space(3))`.\n        '
        + '★`check:overlaybottom` 은 **아래**만 보고, 「파일이 insets 를 쓰면 통과」라 이걸 놓쳤다');
    }
    if (!whiteTextHasShadow(src)) {
      fail('P3', `${P} 의 흰 이름 글자에 **그림자가 없다**.\n        `
        + '어두운 띠를 걷어냈으면 가독성 대가를 여기서 치러야 한다 —\n        '
        + '밝은 배경 사진 위에서 흰 글자가 그대로 묻힌다');
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const OK = `const styles = StyleSheet.create({\n`
    + `  root: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },\n`
    + `  x: { position: 'absolute', right: space(4), width: 34 },\n`
    + `  name: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 6 },\n`
    + `});\n<PressableScale style={[styles.x, { top: Math.max(space(5), insets.top + space(3)) }]} />`;
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'P1 덮개가 없으면 통과', run: () => hasDarkCoverScrim(OK) === false },
    { name: 'P1 사진 위 검은 덮개를 문다',
      run: () => hasDarkCoverScrim(`  scrim: { ...StyleSheet.absoluteFillObject, top: '45%', backgroundColor: 'rgba(0,0,0,0.45)' },`) === true },
    { name: 'P1 시트 **뒤** 딤(root)은 대상이 아니다',
      run: () => hasDarkCoverScrim(`  root: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },`) === false },
    { name: 'P1 영상 전체 보기(full)도 대상이 아니다',
      run: () => hasDarkCoverScrim(`  full: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)' },`) === false },
    { name: 'P1 이름만 바꿔 되살려도 문다',
      run: () => hasDarkCoverScrim(`  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.3)' },`) === true },
    { name: 'P1 주석 속 옛 코드에 안 속는다',
      run: () => hasDarkCoverScrim(`// scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },`) === false },
    { name: 'P2 insets.top 으로 덮으면 통과', run: () => closeUsesInsetTop(OK) === true },
    { name: 'P2 스타일에 고정 top 이 박혀 있으면 문다',
      run: () => closeUsesInsetTop(`  x: { position: 'absolute', top: space(5), right: space(4) },\n<PressableScale style={styles.x} />`) === false },
    { name: 'P2 닫기 버튼을 못 찾으면 단정하지 않는다', run: () => closeUsesInsetTop('const a = 1;') === null },
    { name: 'P3 그림자가 있으면 통과', run: () => whiteTextHasShadow(OK) === true },
    { name: 'P3 없으면 문다',
      run: () => whiteTextHasShadow(`  name: { color: '#FFFFFF', fontWeight: '900' },`) === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:profilecover — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:profilecover — 프로필 창이 사진을 안 가리고, 닫기가 안전영역 아래에 있다');
