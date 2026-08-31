// scripts/check-roomswitch.ts — 방을 바꾸면 **직전 방이 닫히는지**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"친구랑 대화한 뒤로 다른 채팅창이 안들어가져"*)
//
// ■ ★원인 — **한쪽만 지우고 있었다**
//   대화 화면은 방이 **두 종류**다: 상담가 방(`cur`) · 친구 방(`userRoom`).
//   화면은 `userRoom` 이 있으면 **그것을 먼저** 그린다.
//   · 친구 방을 열 때 → `setCur(null)` **있었다** ✅
//   · 상담가 방을 열 때 → `setUserRoom(null)` **없었다** ❌
//   ⇒ 친구 방을 한 번 열면 그 뒤로 무엇을 눌러도 친구 방이 계속 보인다.
//   ★오류도 안 나고 화면도 멀쩡해 보인다 — «안 들어가진다» 로만 드러난다.
//
// ■ ⚠️이 저장소는 «같은 필요의 두 길 중 한쪽만 고쳐지는» 일을 반복해서 겪는다
//   ([[talk-must-know-today]] · [[web-green-is-not-verified]] 의 `{overlays}` 4곳 중 1곳 누락).
//   ⇒ **짝을 이루는지**를 기계가 본다.
//
// 무엇을 지키나
//   R1 상담가 방을 여는 곳이 **친구 방을 닫는다**
//   R2 친구 방을 여는 곳이 **상담가 방을 닫는다**
//
// ★음성 테스트: `npx tsx scripts/check-roomswitch.ts --selftest`
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
 * 상담가 방을 여는 `open()` 이 **친구 방을 닫는가**.
 *
 * ★«첫머리에서» 닫아야 한다 — 뒤늦게 닫으면 그 사이 렌더가 옛 방을 그린다.
 * ⚠️★그런데 «첫머리» 를 **글자 수**로 재면 안 된다 — 주석 한 덩이가 창을 통째로 밀어낸다
 *   (2026-08-31 실측: 내가 단 10줄 주석 때문에 방금 고친 코드를 «없다» 고 답했다.
 *    같은 덫에 `check:chartpick` P4 도 오늘 걸렸다).
 *   ⇒ 주석을 지운 뒤 **첫 여섯 문장**만 본다. 자리를 «글자» 가 아니라 «문장» 으로 센다.
 */
export function openClosesUserRoom(src: string): boolean | null {
  const s = strip(src);
  const i = s.search(/const\s+open\s*=\s*useCallback\s*\(/);
  if (i < 0) return null;
  const lines = s.slice(i).split('\n').filter((l) => l.trim().length > 0).slice(0, 7);
  return /setUserRoom\(\s*null\s*\)/.test(lines.join('\n'));
}

/**
 * 친구 방을 여는 자리들이 **상담가 방을 닫는가**.
 * @returns [닫는 곳, 여는 곳 전체]
 */
export function userRoomOpensClearCur(src: string): [number, number] {
  const s = strip(src);
  // ⚠️★`null` 은 «여는 것» 이 아니라 «닫는 것» 이다 — 세면 안 된다(음성 테스트가 잡았다).
  //   `\w` 는 `null` 도 문다 ⇒ 그 낱말만 따로 뺀다.
  const opens = [...s.matchAll(/setUserRoom\(\s*(?!null\s*\))[A-Za-z_$][\w.$]*\s*\)/g)];
  let ok = 0;
  for (const m of opens) {
    const near = s.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + 200);
    if (/setCur\(\s*null\s*\)/.test(near)) ok++;
  }
  return [ok, opens.length];
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const P = 'app/src/app/(app)/talk.tsx';
  const src = read(P);
  if (!src) fail('R0', `${P} 를 못 읽었다`);
  else {
    if (openClosesUserRoom(src) === false) {
      fail('R1', `${P} 의 \`open()\`(상담가 방)이 **친구 방을 안 닫는다**.\n        `
        + '화면은 `userRoom` 이 있으면 그것을 먼저 그린다 ⇒ 친구 방을 한 번 열면\n        '
        + '그 뒤로 무엇을 눌러도 **친구 방이 계속 보인다**(Boss 2026-08-31 실제 제보).\n        '
        + '★오류도 안 나고 화면도 멀쩡해 보여 «안 들어가진다» 로만 드러난다');
    }
    const [ok, total] = userRoomOpensClearCur(src);
    if (total > 0 && ok < total) {
      fail('R2', `${P} 에서 친구 방을 여는 ${total}곳 중 **${total - ok}곳이 상담가 방을 안 닫는다**.\n        `
        + '★짝을 이뤄야 한다 — 한쪽만 지우면 «두 방이 겹친» 상태가 된다');
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const OK = 'const open = useCallback((c, room) => {\n  setUserRoom(null);\n  setCur(c);\n}, []);\n'
    + 'if (!r.consultantId) { setUserRoom(r.sessionId); setCur(null); return; }';
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'R1 닫으면 통과', run: () => openClosesUserRoom(OK) === true },
    { name: 'R1 안 닫으면 문다',
      run: () => openClosesUserRoom('const open = useCallback((c) => {\n  setCur(c);\n}, []);') === false },
    { name: 'R1 ★멀리서 닫는 것은 안 쳐준다(그 사이 렌더가 옛 방을 그린다)',
      run: () => openClosesUserRoom(`const open = useCallback((c) => {\n  setCur(c);\n${'  x();\n'.repeat(20)}  setUserRoom(null);\n}, []);`) === false },
    { name: 'R1 ★긴 주석이 앞에 있어도 **찾아낸다**(오늘 여기 걸렸다)',
      run: () => openClosesUserRoom(`const open = useCallback((c) => {\n${'  // 설명\n'.repeat(30)}  setUserRoom(null);\n  setCur(c);\n}, []);`) === true },
    { name: 'R1 open 이 없으면 단정하지 않는다', run: () => openClosesUserRoom('const a = 1;') === null },
    { name: 'R2 짝을 이루면 통과', run: () => { const [o, t] = userRoomOpensClearCur(OK); return t === 1 && o === 1; } },
    { name: 'R2 한쪽만이면 잡힌다',
      run: () => { const [o, t] = userRoomOpensClearCur('setUserRoom(r.sessionId);'); return t === 1 && o === 0; } },
    { name: 'R2 ★`setUserRoom(null)` 은 «여는 것» 이 아니다',
      run: () => userRoomOpensClearCur('setUserRoom(null);')[1] === 0 },
    { name: '주석 속 코드에 안 속는다',
      run: () => openClosesUserRoom('// const open = useCallback((c) => { setUserRoom(null); });') === null },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:roomswitch — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:roomswitch — 방을 바꾸면 직전 방이 닫힌다(두 방향 다)');
