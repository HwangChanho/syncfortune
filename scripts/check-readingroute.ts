// scripts/check-readingroute.ts — 「풀이」로 갈 때 **엉뚱한 종류가 뜨지 않는가**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"자미두수에서 영역별 풀이보기 눌렀는데 사주로 넘어가"*
//
// ■ ★원인 — `router.navigate` 는 **같은 경로를 재사용한다**
//   `/reading` 은 파라미터(`kind`)로 사주/자미가 갈린다. 그런데 `navigate` 는
//   같은 pathname 이 이미 스택에 있으면 **그 화면을 다시 쓴다** —
//   먼저 본 쪽(사주)이 살아 있으면 자미를 눌러도 사주가 그대로 보인다.
//   ⚠️반대 방향도 같다(자미를 먼저 보면 사주 버튼이 자미를 연다).
//   ⇒ `push` 는 언제나 새로 쌓으므로 파라미터가 확실히 반영된다.
//
// ■ ★`kind` 를 **명시**한다
//   생략하면 화면이 `kind ?? 'saju'` 로 기본값을 쓴다 — 동작은 같지만,
//   **읽는 사람이 «이 버튼이 무엇을 여는지» 를 코드에서 못 본다.**
//   같은 화면을 두 종류로 쓰는 곳에서는 기본값에 기대지 않는 편이 안전하다.
//
// ■ 재는 것
//   R1  `/reading` 으로 가는 곳이 **전부 `push`**(하나라도 `navigate` 면 재사용 함정)
//   R2  그 호출이 **`kind` 를 명시**한다
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

function walk(dir: string): string[] {
  const out: string[] = [];
  const rec = (d: string) => {
    let ents; try { ents = readdirSync(`${ROOT}${d}`, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) rec(p); else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  rec(dir); return out;
}

let fail = 0;
const say = (c: boolean, m: string, d = '') => {
  if (!c) fail++;
  console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(44)} ${d}`);
};

console.log('\n🧭 check:readingroute — 풀이가 엉뚱한 종류로 열리지 않는가\n');

const files = walk('app/src').map((p) => ({ p, s: strip(readFileSync(`${ROOT}${p}`, 'utf8')) }));

// ── R1 전부 push 인가 ─────────────────────────────────────────────────────
{
  const bad = files
    .filter((f) => /router\.navigate\(\{\s*pathname:\s*'\/reading'/.test(f.s))
    .map((f) => f.p.replace('app/src/', ''));
  say(bad.length === 0, 'R1 「/reading」 으로 갈 때 **전부 push**',
    bad.length ? `${bad.join(', ')} — navigate 는 **같은 경로를 재사용**해 옛 kind 가 남는다`
      : '재사용 함정 없음');
}

// ── R2 kind 를 명시하는가 ────────────────────────────────────────────────
{
  const calls: { file: string; snip: string }[] = [];
  for (const f of files) {
    for (const m of f.s.matchAll(/router\.push\(\{\s*pathname:\s*'\/reading'[\s\S]{0,200}?\}\s*\)/g)) {
      calls.push({ file: f.p.replace('app/src/', ''), snip: m[0].replace(/\s+/g, ' ') });
    }
  }
  const noKind = calls.filter((c) => !/kind:\s*'/.test(c.snip));
  say(calls.length > 0 && noKind.length === 0, 'R2 그 호출이 **kind 를 명시**한다',
    calls.length === 0 ? '/reading 으로 가는 곳을 못 찾았다 — 하네스가 헛돈다'
      : noKind.length ? `${noKind.map((c) => c.file).join(', ')} — 기본값에 기대면 «무엇을 여는지» 를 코드에서 못 본다`
        : `${calls.length}곳 전부`);
}

// ── 자기검사 ───────────────────────────────────────────────────────────────
{
  const old = `router.navigate({ pathname: '/reading', params: { kind: 'ziwei' } })`;
  const caught = /router\.navigate\(\{\s*pathname:\s*'\/reading'/.test(old);
  const noKind = `router.push({ pathname: '/reading', params: { input: x } })`;
  const caught2 = !/kind:\s*'/.test(noKind);
  say(caught && caught2, '자기검사 — navigate·kind 누락을 잡아낸다',
    caught && caught2 ? '대조군 2개 통과' : `R1:${caught} R2:${caught2}`);
}

console.log(fail === 0 ? '\n✅ 풀이가 누른 종류로 열립니다\n' : `\n❌ ${fail}건\n`);
process.exit(fail === 0 ? 0 : 1);
