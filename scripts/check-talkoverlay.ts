// scripts/check-talkoverlay.ts — **화면 위에 뜨는 것이 한쪽 갈래에만 있지 않은지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"채팅창 상단에 ＋ 버튼눌러도 아무 반응이 없어 웹기준이야"*
//
// ■ 원인 — 「화면이 두 갈래로 return 하는데, 시트는 한 갈래에만 있었다」
//   `talk.tsx` 는 **넓은 웹 3칸** 과 **폰 1칸** 으로 각각 `return` 한다.
//   `InviteSheet` 가 폰 갈래에만 있어서, 넓은 웹에서 ＋ 를 누르면
//   `inviteOpen` 은 true 가 되는데 **그릴 곳이 없다.**
//   ★오류가 안 난다. 화면은 «아무 일도 안 일어난 것» 처럼 보인다 — 그래서 원인을 못 찾는다.
//
// ■ ★같은 실수가 두 번째다
//   `ProfileSheet` 도 예전에 한쪽에만 있었다. 그때는 **두 곳에 각각 넣어** 고쳤는데,
//   그 방식이 이 재발을 불렀다(«두 곳» 을 유지해야 한다는 부담이 사람에게 남는다).
//   ⇒ 지금은 `const overlays = (…)` **묶음 하나**를 양쪽이 함께 쓴다.
//     이 검사는 그 구조가 무너지지 않게 지킨다.
//
// ■ 검사 (묶음 안의 이름을 **자동으로** 읽는다 — 새 오버레이를 더해도 목록을 안 고쳐도 된다)
//   O1 `const overlays = (…)` 묶음이 있다
//   O2 `{overlays}` 가 **두 군데 이상**에서 쓰인다(두 갈래 모두)
//   O3 묶음에 든 컴포넌트가 **묶음 밖에서 직접** 그려지지 않는다
//      ← 누군가 다시 «한쪽에만» 넣는 순간 여기서 걸린다
//
// 실행: npm run check:talkoverlay
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const FILE = 'app/src/app/(app)/talk.tsx';

/** `const overlays = ( … );` 의 안쪽만 잘라 낸다(괄호 깊이를 세어 정확히 끝을 찾는다). */
export function overlayBlock(src: string): { body: string; start: number; end: number } | null {
  const m = /const overlays\s*=\s*\(/.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    i++;
  }
  return { body: src.slice(m.index + m[0].length, i - 1), start: m.index, end: i };
}

/** JSX 에서 대문자로 시작하는 컴포넌트 이름을 모은다(`<ProfileSheet` → ProfileSheet). */
export function componentsIn(jsx: string): string[] {
  return [...new Set([...jsx.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map((x) => x[1]))]
    .filter((n) => n !== 'View' && n !== 'Text');   // 담는 그릇은 오버레이가 아니다
}

// ── 자기 검사(음성 테스트) ────────────────────────────────────────────────
function selftest(): boolean {
  const good = `const overlays = (\n  <>\n    <A x={(1)} />\n    <B />\n  </>\n);\nfoo({overlays});\nbar({overlays});`;
  const b = overlayBlock(good);
  const names = b ? componentsIn(b.body) : [];
  // 괄호가 안에 있어도 끝을 제대로 찾는가 · 이름을 둘 다 잡는가
  const ok1 = !!b && names.length === 2 && names.includes('A') && names.includes('B');
  // 묶음이 없으면 null
  const ok2 = overlayBlock('const nope = 1;') === null;
  // 밖에 직접 쓴 것을 잡는가
  const bad = `const overlays = (\n  <>\n    <A />\n  </>\n);\nfoo({overlays});\nbar(<A />);`;
  const bb = overlayBlock(bad)!;
  const outside = (bad.slice(0, bb.start) + bad.slice(bb.end)).includes('<A');
  console.log(`   ${ok1 && ok2 && outside ? '✅' : '❌'} 자기검사 — 묶음 [${names}] · 없으면 null=${ok2} · 밖의 <A> 적발=${outside}`);
  return ok1 && ok2 && outside;
}

const isMain = process.argv[1]?.includes('check-talkoverlay');
if (isMain) {
  console.log('\n🪟 화면 위에 뜨는 것이 한쪽 갈래에만 있지 않은가\n');
  let bad = 0;
  if (!selftest()) { console.log('\n❌ 하네스 자신이 고장났습니다\n'); process.exit(1); }
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(46)} ${note}`); };

  const src = readFileSync(FILE, 'utf8');
  const blk = overlayBlock(src);
  say(!!blk, 'O1 `const overlays` 묶음이 있다', blk ? '' : '두 갈래가 각자 그리고 있습니다 — 재발합니다');
  if (!blk) { console.log('\n❌ 묶음이 없습니다.\n'); process.exit(1); }

  /**
   * ★★2026-08-31 — 「두 곳 이상」으로는 **못 잡는다**.
   *   이 화면은 return 이 **넷**이다(넓은웹 · 사용자방 · 폰 목록 · 대화방).
   *   그중 «폰 목록» 하나에만 `{overlays}` 가 빠져 있었는데, 나머지 셋이 채우니
   *   `uses >= 2` 는 **초록불**이었다 — 그 화면에서만 프로필이 조용히 안 떴다(Boss 제보).
   *   ⇒ «몇 곳에서 쓰나» 가 아니라 **«화면을 여는 return 마다 있나»** 를 센다.
   *
   * 판정: 컴포넌트 본문의 `return (` 중 **화면 뿌리**(`<View style={styles.one|two…}` 로 시작)를
   *   여는 것만 골라, 그 안에 `{overlays}` 가 있는지 본다.
   */
  // ★★return 의 경계를 **다음 화면 return 직전**으로 잡는다.
  //   ⚠️처음엔 괄호 깊이로 쟀는데 **다음 return 을 통째로 삼켜** 그쪽 `{overlays}` 를 자기 것으로
  //     세었다 — 빠진 화면이 있는데도 초록불이었다(음성 테스트로 잡았다. 안 했으면 못 봤다).
  //   ⇒ 화면 뿌리(`styles.one|two`)를 여는 자리들을 먼저 찾고, **이웃 사이 구간**만 본다.
  // ⚠️★**주석을 먼저 걷어낸다.** 안 그러면 「여기 `{overlays}` 가 없었다」 같은 *설명*까지
  //   코드로 세어, 실제로 빠졌는데도 초록불이 된다(2026-08-31 내 주석에 실제로 그렇게 당했다).
  //   ★자리를 보존하려고 **같은 길이의 공백**으로 바꾼다 — 지우면 행 번호가 어긋난다.
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  const bare = src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank);
  const roots = [...bare.matchAll(/<View style=\{\[?styles\.(one|two)\b/g)].map((m) => m.index ?? 0);
  const screen: Array<{ line: number; ok: boolean }> = [];
  for (let k = 0; k < roots.length; k++) {
    const from = roots[k];
    const to = k + 1 < roots.length ? roots[k + 1] : src.length;
    screen.push({ line: bare.slice(0, from).split('\n').length, ok: /\{overlays\}/.test(bare.slice(from, to)) });
  }
  const missing = screen.filter((r) => !r.ok).map((r) => r.line);
  const uses = (bare.match(/\{overlays\}/g) ?? []).length;
  say(missing.length === 0,
    `O2 **화면 뿌리마다** 묶음이 있다 (${screen.length}갈래)`,
    missing.length ? `빠진 곳: ${missing.map((l) => l + '행').join(', ')} — 그 화면에서만 시트가 조용히 안 뜬다` : `${uses}곳에서 사용`);

  const names = componentsIn(blk.body);
  const outside = src.slice(0, blk.start) + src.slice(blk.end);
  const leaked = names.filter((n) => new RegExp(`<${n}[\\s/>]`).test(outside));
  say(leaked.length === 0, 'O3 묶음 안의 것이 밖에서 또 그려지지 않는다',
    leaked.length ? `밖에서도 그림: ${leaked.join(', ')} — 한쪽 갈래에만 들어갈 위험` : `${names.length}개(${names.join(', ')}) 확인`);

  if (bad) { console.log(`\n❌ ${bad}건 — 이 상태면 **한쪽 화면에서만 조용히 안 뜹니다**(오류도 안 납니다).\n`); process.exit(1); }
  console.log('\n✅ 두 갈래가 같은 오버레이를 그립니다\n');
}
