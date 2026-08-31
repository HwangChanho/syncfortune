// scripts/check-swiperow.ts — 스와이프 행의 **앞면이 투명한 것**을 막는다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"스와이프 닫을때 일시적으로 저렇게 겹쳐보여"*)
//   `Swipeable` 은 «앞면(행)» 이 «뒷면(고정·나가기·즐겨찾기 버튼)» 위를 **덮으며** 움직이는 구조다.
//   앞면에 배경색이 없으면 덮는 게 아니라 **겹쳐 보인다** — 닫히는 동안 글자와 버튼이 포개진다.
//   ★고른 행만 `rowOn` 으로 배경이 있어서, **안 고른 행에서만** 나던 증상이라 눈에 안 띄었다.
//   ★대화목록에서 발견했는데 **친구목록에도 같은 구멍**이 있었다 — 형제를 찾지 않으면 반만 고친다.
//
// 무엇을 지키나
//   S1 `Swipeable` 을 쓰는 파일에서, 그 **앞면으로 넘기는 스타일**에 `backgroundColor` 가 있는가
//   S2 `friction` 이 1 을 넘지 않는가 — 2 면 손가락이 간 거리의 절반만 따라와 «안 따라오는» 느낌이 된다
//
// ★판정은 «뜻» 으로 — 스타일 이름을 박지 않고, `<Swipeable>` 이 감싸는 자식이 쓰는 스타일을 따라간다.
// ★음성 테스트: `npx tsx scripts/check-swiperow.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
export const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

type Finding = { rule: string; msg: string };
const out: Finding[] = [];

// ── 판정기(음성 테스트가 같은 것을 쓴다) ────────────────────────────────────

/** 이 파일이 `Swipeable` 을 실제로 그리는가. */
export function usesSwipeable(src: string): boolean {
  return /<Swipeable[\s>]/.test(strip(src));
}

/**
 * 스와이프 **앞면**이 쓰는 스타일 이름들.
 *
 * `<Swipeable …>{row}</Swipeable>` 처럼 변수를 넘기면 그 변수의 `style={styles.X}` 를 따라간다.
 * 못 따라가면 빈 배열 — 그때는 아무것도 단정하지 않는다(모르면 통과. 틀린 빨간불보다 낫다).
 */
export function frontStyleNames(src: string): string[] {
  const s = strip(src);
  const names = new Set<string>();
  for (const m of s.matchAll(/<Swipeable[^>]*>\s*\{?\s*(\w+)\s*\}?\s*</g)) {
    const varName = m[1];
    // `const <varName> = ( … style={styles.X} … )` 에서 첫 style 을 집는다
    const decl = new RegExp(String.raw`const\s+${varName}\s*=\s*\(([\s\S]{0,400}?)style=\{(?:\[)?styles\.(\w+)`).exec(s);
    if (decl?.[2]) names.add(decl[2]);
  }
  // `<Swipeable>{guarded(row)}</Swipeable>` 처럼 감싸는 경우도 같은 방식으로 한 번 더
  for (const m of s.matchAll(/<Swipeable[^>]*>\s*\{\s*\w+\(\s*(\w+)\s*\)\s*\}/g)) {
    const varName = m[1];
    const decl = new RegExp(String.raw`const\s+${varName}\s*=\s*\(([\s\S]{0,400}?)style=\{(?:\[)?styles\.(\w+)`).exec(s);
    if (decl?.[2]) names.add(decl[2]);
  }
  return [...names];
}

/** 그 스타일에 배경색이 있는가. 스타일 자체를 못 찾으면 `null`(모름). */
export function hasBackground(src: string, styleName: string): boolean | null {
  const m = new RegExp(String.raw`\b${styleName}\s*:\s*\{([^{}]*)\}`).exec(strip(src));
  if (!m) return null;
  return /backgroundColor\s*:/.test(m[1]);
}

/** `friction` 값들. 1 을 넘으면 «안 따라오는» 느낌이 된다. */
export function frictions(src: string): number[] {
  return [...strip(src).matchAll(/friction=\{(\d+(?:\.\d+)?)\}/g)].map((m) => Number(m[1]));
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const walk = (dir: string): string[] => {
    let acc: string[] = [];
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) acc = acc.concat(walk(p));
      else if (/\.tsx$/.test(n)) acc.push(p);
    }
    return acc;
  };
  for (const f of [...walk(join(ROOT, 'app/src/components')), ...walk(join(ROOT, 'app/src/app'))]) {
    const src = read(f);
    if (!src || !usesSwipeable(src)) continue;
    const rel = f.replace(ROOT, '');

    for (const name of frontStyleNames(src)) {
      const bg = hasBackground(src, name);
      if (bg === false) {
        out.push({ rule: 'S1', msg: `${rel} — 스와이프 앞면 \`${name}\` 에 **배경색이 없다**.\n        `
          + '앞면이 투명하면 뒷면(버튼)을 덮지 못하고 **겹쳐 보인다** — 닫히는 동안 글자와 버튼이 포개진다.\n        '
          + '⇒ `backgroundColor: colors.bg` 를 줄 것' });
      }
    }
    for (const fr of frictions(src)) {
      if (fr > 1) {
        out.push({ rule: 'S2', msg: `${rel} — \`friction={${fr}}\`. 손가락이 간 거리의 ${fr === 2 ? '절반' : `1/${fr}`}만 따라와 «무겁고 안 따라오는» 느낌이 된다.\n        `
          + '⇒ 1(손가락과 1:1)로 둘 것. 과도한 당김은 `overshootRight={false}` 가 이미 막는다' });
      }
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const SRC = (rowStyle: string, fr = 1) =>
    `const row = (\n  <PressableScale style={styles.row} onPress={x}>\n    <Text/>\n  </PressableScale>\n);\n`
    + `<Swipeable renderRightActions={r} friction={${fr}}>{row}</Swipeable>\n`
    + `const styles = StyleSheet.create({ row: { ${rowStyle} }, other: { flex: 1 } });`;
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: '앞면 스타일 이름을 따라간다', run: () => frontStyleNames(SRC('gap: 4')).includes('row') },
    { name: '감싼 형태도 따라간다',
      run: () => frontStyleNames("const row = (\n  <View style={styles.row}/>\n);\n<Swipeable a={1}>{guarded(row)}</Swipeable>\nconst styles = { row: { gap: 1 } };").includes('row') },
    { name: '배경 없으면 false', run: () => hasBackground(SRC('gap: 4'), 'row') === false },
    { name: '배경 있으면 true', run: () => hasBackground(SRC('gap: 4, backgroundColor: colors.bg'), 'row') === true },
    { name: '스타일을 못 찾으면 null(모름)', run: () => hasBackground(SRC('gap: 4'), 'nosuch') === null },
    { name: 'friction 을 읽는다', run: () => frictions(SRC('gap: 4', 2))[0] === 2 },
    { name: 'Swipeable 이 없으면 대상 아님', run: () => usesSwipeable('const a = <View/>;') === false },
    { name: '주석 속 Swipeable 에 안 속는다', run: () => usesSwipeable('// <Swipeable/>\nconst a = 1;') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:swiperow — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:swiperow — 스와이프 앞면이 불투명하고, 손가락을 1:1 로 따라간다');
