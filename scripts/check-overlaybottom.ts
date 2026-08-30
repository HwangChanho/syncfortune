// scripts/check-overlaybottom.ts — 화면 위에 얹히는 **오버레이의 버튼이 탭바에 먹히는 것**을 막는다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-30 *"한참뒤에 올라오는데 앱에서 짤려"*)
//   프로필 창의 「대화하기」 줄이 하단 탭바에 덮여 있었다. 원인은 한 줄이다:
//     bottom: { position: 'absolute', bottom: space(7), … }
//   패널 바닥에서 **고정값**으로 띄웠는데, 이 시트는 탭바 아래까지 깔린다 —
//   그래서 space(7) 은 «탭바 위» 가 아니라 «탭바 속» 이 된다.
//
// ★기존 `check:bottominset` 은 이걸 못 잡는다 — 그건 **스크롤 화면**의 마지막 요소를 본다.
//   오버레이는 스크롤이 아니라 절대배치라 규칙 밖이었다. 같은 병인데 검사만 없었다.
//
// 무엇을 지키나
//   O1 `position:'absolute'` + `bottom:<고정값>` 인 스타일이 **누를 것을 담고 있으면**,
//      그 파일은 안전영역(`useSafeAreaInsets`)을 **참고해야** 한다.
//
// ★오탐을 줄이는 두 조건(오탐이 하네스를 죽인다 — 이 저장소 08-01 교훈)
//   ① 파일에 **누르는 요소가 있어야** 한다(읽기만 하는 배지·라벨은 조금 가려도 기능이 안 죽는다)
//   ② 파일이 **insets 를 이미 쓰면 통과**한다 — 어디에 쓰는지까지는 안 따진다(과잉 판정 금지).
// ★음성 테스트: `npx tsx scripts/check-overlaybottom.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
export const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

type Finding = { rule: string; msg: string };
const out: Finding[] = [];

// ── 판정기(음성 테스트가 같은 것을 쓴다) ────────────────────────────────────

/** 이 파일에 «누를 것» 이 있는가. */
export function hasPressable(src: string): boolean {
  return /<(PressableScale|Pressable|TouchableOpacity|TouchableHighlight|Button)[\s/>]/.test(strip(src));
}

/** 이 파일이 안전영역을 참고하는가(어디에 쓰는지는 안 따진다 — 과잉 판정 금지). */
export function usesInsets(src: string): boolean {
  return /useSafeAreaInsets|SafeAreaView|insets\.bottom/.test(strip(src));
}

/**
 * 이 파일이 **화면을 통째로 덮는** 오버레이인가.
 *
 * ★이 조건이 없으면 «카드 안 ♡ 버튼» 까지 잡는다 — 실제로 첫 판이 `ContentGrid` 의 `favBtn`
 *   (카드 우하단 6px)을 물었다. 카드 바닥은 탭바와 아무 상관이 없다.
 *   오탐이 한 건이라도 남으면 하네스는 무시당한다(이 저장소 08-01 교훈).
 */
export function coversScreen(src: string): boolean {
  return /StyleSheet\.absoluteFillObject|StyleSheet\.absoluteFill\b/.test(strip(src));
}

/**
 * **아래에 고정값으로 붙인 절대배치 스타일**의 이름들.
 *
 * 잡는 것: `{ position: 'absolute', … bottom: 12 }` · `bottom: space(7)`
 * 안 잡는 것: `bottom: 0`(화면 끝에 딱 붙이는 건 의도) · `bottom: insets.bottom + …`(이미 고려함)
 *   · `bottom` 이 변수인 것(런타임에 정해지므로 정적으로 단정 못 한다)
 */
export function pinnedBottomStyles(src: string): string[] {
  const s = strip(src);
  const found: string[] = [];
  // `이름: { … }` 한 덩어리씩
  for (const m of s.matchAll(/(\w+)\s*:\s*\{([^{}]*)\}/g)) {
    const [, name, body] = m;
    if (!/position\s*:\s*['"]absolute['"]/.test(body)) continue;
    const b = body.match(/\bbottom\s*:\s*([^,}]+)/);
    if (!b) continue;
    const v = b[1].trim();
    if (/^0$/.test(v)) continue;                       // 화면 끝에 붙임 = 의도
    if (/insets|safe|Math\.max|tab/i.test(v)) continue; // 이미 고려한 형태
    if (/^-?\d+(\.\d+)?$/.test(v) || /^space\(/.test(v)) found.push(name);
  }
  return found;
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
  const files = [
    ...walk(join(ROOT, 'app/src/components')),
    ...walk(join(ROOT, 'app/src/screens')),
  ];
  for (const f of files) {
    const src = read(f);
    if (!src) continue;
    if (!hasPressable(src) || usesInsets(src)) continue;
    if (!coversScreen(src)) continue;   // 화면을 덮는 오버레이만 — 카드 안 버튼은 탭바와 무관하다
    const pinned = pinnedBottomStyles(src);
    if (!pinned.length) continue;
    out.push({
      rule: 'O1',
      msg: `${f.replace(ROOT, '')} — 아래에 **고정값으로** 붙인 오버레이(${pinned.join(', ')})에 누를 것이 있는데 안전영역을 안 본다.\n        `
        + '탭바·홈 인디케이터가 그 위를 덮으면 **버튼이 통째로 안 눌린다**(프로필 창이 실제로 그랬다).\n        '
        + '⇒ `useSafeAreaInsets()` 로 `Math.max(기존값, insets.bottom + 탭바)` 를 쓸 것',
    });
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const P = 'const A = () => <PressableScale/>;\n';
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'O1: 고정 bottom + 절대배치 → 잡는다',
      run: () => pinnedBottomStyles("x: { position: 'absolute', left: 0, bottom: 28 }").length === 1 },
    { name: 'O1: space() 도 고정값이다',
      run: () => pinnedBottomStyles("x: { position: 'absolute', bottom: space(7) }").length === 1 },
    { name: 'O1: bottom: 0 은 의도 — 통과',
      run: () => pinnedBottomStyles("x: { position: 'absolute', bottom: 0 }").length === 0 },
    { name: 'O1: insets 를 쓰면 통과',
      run: () => pinnedBottomStyles("x: { position: 'absolute', bottom: insets.bottom + 72 }").length === 0 },
    { name: 'O1: Math.max 형태도 통과',
      run: () => pinnedBottomStyles("x: { position: 'absolute', bottom: Math.max(8, insets.bottom) }").length === 0 },
    { name: 'O1: 절대배치가 아니면 해당 없음',
      run: () => pinnedBottomStyles("x: { bottom: 28 }").length === 0 },
    { name: 'O1: top 만 있으면 해당 없음',
      run: () => pinnedBottomStyles("x: { position: 'absolute', top: 28 }").length === 0 },
    { name: '누를 것이 있어야 본다',
      run: () => hasPressable(P) === true && hasPressable('const A = () => <Text/>;') === false },
    { name: 'insets 를 쓰는 파일은 면제',
      run: () => usesInsets('const i = useSafeAreaInsets();') === true && usesInsets('const i = 1;') === false },
    { name: '화면을 덮는 오버레이만 본다 — 카드 안 버튼은 통과',
      run: () => coversScreen("styles = { card: { position:'absolute', bottom: 6 } }") === false },
    { name: '전체 덮개가 있으면 대상이다',
      run: () => coversScreen("root: { ...StyleSheet.absoluteFillObject }") === true },
    { name: '주석 속 코드에 안 속는다',
      run: () => pinnedBottomStyles("// x: { position: 'absolute', bottom: 28 }\nconst y = 1;").length === 0 },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:overlaybottom — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:overlaybottom — 아래에 붙는 오버레이의 버튼이 탭바에 먹히지 않는다');
