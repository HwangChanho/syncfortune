// scripts/check-optimistic.ts — 「낙관적 UI + 롤백」 불변식
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-03: *"기본적으로 UI는 유저가 봤을때 바로 적용되고 그게 서버에 반영이
//   안돼서 리턴이 실패로 오면 롤백하는 구조가 돼야해"*
//
// ■ 두 방향을 **같이** 잠근다 — 한쪽만 잠그면 반대쪽으로 무너진다
//   O1 되돌릴 수 있는 것(토글·삭제·수락)  = 화면을 **먼저** 바꿔야 한다. 안 그러면 두 번 누른다.
//   O2 ★돈·신원(구매·언락·크레딧·성인인증) = **절대** 먼저 바꾸면 안 된다.
//      서버가 «샀다» 하기 전에 열어 주면 **공짜로 열린다.**
//
// ■ ★판정 기준은 «이름» 이 아니라 «어디서 왔는가»
//   - 서버를 바꾸는 함수 = `lib/` 에서 실제로 `supabase.rpc / .update / .delete / .insert /
//     functions.invoke` 를 부르는 함수(이름에 delete 가 들어가서가 아니다).
//   - 핸들러 경계 = **중괄호를 실제로 센다**. 글자 수로 자르면 앞뒤 핸들러가 섞여
//     이미 낙관적인 코드를 «서버를 기다린다» 고 오판한다(2026-09-03 에 실제로 그랬다).
//
// ■ ★서버 응답이 **화면에 쓰이면** 낙관적일 수 없다(면제)
//   새 글의 id, 새 방의 id 처럼 서버만 아는 값으로 화면을 그리는 자리다.
//   면제 여부도 이름이 아니라 «await 결과를 setState 가 참조하는가» 로 가른다.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'app/src');
const SELFTEST = process.argv.includes('--selftest');

let bad = 0;
const fail = (tag: string, m: string) => { bad++; console.log(`  [${tag}] ${m}`); };

/**
 * 주석을 지운다 — 주석에 적힌 낱말이 판정을 뒤집으면 안 된다(이 프로젝트에서 여러 번 당했다).
 *
 * ⚠️★**길이를 보존한다**(같은 자리를 공백으로, 줄바꿈은 그대로).
 *   길이가 바뀌면 지운 본문의 인덱스로 **원본 줄 번호를 셀 수 없다** — 하네스가
 *   엉뚱한 줄을 가리키고, 그 줄을 열어 본 사람은 «오탐이네» 하고 규칙째 버리게 된다.
 *   (2026-09-03 에 내가 그렇게 만들었다가 세 건을 오탐으로 잘못 읽었다.)
 */
function stripComments(s: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])(\/\/[^\n]*)/g, (_m, a, c) => a + blank(c));
}

/**
 * 문자열 **속** 을 비운다(따옴표는 남긴다). 역시 **길이 보존**.
 *
 * ⚠️★중괄호 세기는 반드시 이걸로 한다. `'{{coins}} 운'` 같은 i18n 자리표시자가 있으면
 *   짝이 어긋나 «핸들러 몸통» 을 엉뚱하게 잡고, 규칙 전체가 **조용히** 틀린다
 *   (2026-09-03 에 `coins.tsx` 가 그래서 오탐이었다).
 * ⚠️반대로 **내용**(rpc 이름 같은 것)은 이걸로 읽으면 안 된다 — 이름이 문자열 안에 있다.
 *   ⇒ 구조는 `flat`, 내용은 `cmt`. **길이가 같아 인덱스가 그대로 통한다.**
 */
function blankStrings(s: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return s.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g,
    (m) => m[0] + blank(m.slice(1, -1)) + m[m.length - 1]);
}

/** `open` 위치의 `{` 부터 짝이 맞는 `}` 까지. 못 찾으면 끝까지. */
function block(src: string, open: number): string {
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(open, i + 1); }
  }
  return src.slice(open);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// ── ① 서버를 바꾸는 함수를 **몸통으로** 모은다 ───────────────────────────────
const MUT = new Set<string>();
const MONEY = new Set<string>();
for (const f of walk(path.join(SRC, 'lib'))) {
  const cmt = stripComments(fs.readFileSync(f, 'utf8'));
  const flat = blankStrings(cmt);                       // 구조 = flat · 내용 = cmt (길이 같음)
  for (const m of flat.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(/g)) {
    const brace = flat.indexOf('{', m.index! + m[0].length);
    if (brace < 0) continue;
    const span = block(flat, brace).length;
    const body = cmt.slice(brace, brace + span);        // ★이름은 문자열 안에 있으니 cmt 에서 읽는다
    // ⚠️`functions.invoke` 는 **읽기 Edge 도 같은 모양**이라 증거가 못 된다(`fetchReadingState` 가
    //   그렇게 오탐으로 잡혔다). rpc·쓰기 동사만 «서버를 바꾼다» 로 센다.
    if (/supabase\.rpc\(|\.(update|delete|insert|upsert)\(/.test(body)) MUT.add(m[1]);
    // ★돈·신원 = 잔액을 깎거나 자물쇠를 여는 RPC 를 부르는 함수
    if (/'(spend_coins|unlock_chart_feature|claim_[a-z_]+|use_[a-z_]*credit[a-z_]*|mark_adult_verified)'|adult-verify/.test(body)) MONEY.add(m[1]);
  }
}

// ── ② UI 핸들러를 훑는다 ────────────────────────────────────────────────────
type Hit = { file: string; line: number; fn: string; money: boolean };
const late: Hit[] = [];      // 서버를 기다린다(O1 위반 후보)
const early: Hit[] = [];     // 돈인데 먼저 열어 준다(O2 위반)

const UI = ['app', 'components', 'screens'].map((d) => path.join(SRC, d)).filter((d) => fs.existsSync(d));
for (const f of UI.flatMap((d) => walk(d))) {
  const raw = fs.readFileSync(f, 'utf8');
  const src = blankStrings(stripComments(raw));    // ★중괄호 세기는 문자열을 비운 것으로

  // ★★상태 세터는 «이름 모양» 이 아니라 **`useState` 에서 나왔는가** 로 가른다.
  //   ⚠️`set[A-Z]\w*` 로 보면 `setTimeout` 을 상태 변경으로 세어 규칙이 헛돈다
  //     (2026-09-03 에 `coins.tsx` 가 그래서 «돈을 미리 열어 준다» 로 잘못 걸렸다).
  //   이 프로젝트에서 반복해 당한 패턴이다 — **이름이 아니라 출처로 판정한다.**
  const setters = new Set<string>();
  for (const d of src.matchAll(/\[\s*\w+\s*,\s*(set\w+)\s*\]\s*=\s*(?:React\.)?useState/g)) setters.add(d[1]);
  if (!setters.size) continue;                    // 상태가 없는 파일은 볼 것이 없다
  const SET = new RegExp(`\\b(?:${[...setters].join('|')})\\s*\\(`, 'g');
  const hasSet = (t: string) => new RegExp(SET.source).test(t);

  for (const m of src.matchAll(/(?:(const|let)\s+(\w+)\s*=\s*)?await\s+(\w+)\s*\(/g)) {
    const fn = m[3];
    if (!MUT.has(fn) && !MONEY.has(fn)) continue;

    // 이 await 를 감싸는 **가장 안쪽 블록** = 핸들러 몸통. 중괄호를 뒤로 세어 찾는다.
    let d = 0, open = -1;
    for (let i = m.index! - 1; i >= 0; i--) {
      if (src[i] === '}') d++;
      else if (src[i] === '{') { if (!d) { open = i; break; } d--; }
    }
    if (open < 0) continue;
    const body = block(src, open);
    const at = m.index! - open;                    // 몸통 안에서 await 의 자리
    const before = body.slice(0, at);
    const after = body.slice(at + m[0].length);
    const line = raw.slice(0, m.index!).split('\n').length;
    const money = MONEY.has(fn);

    // ★O1 과 O2 는 **일부러 기준이 다르다** — 둘 다 «늑대다» 를 덜 외치는 쪽으로 기운다.
    //   O1(안 했다)은 «했다» 를 **넓게** 보고, O2(하면 안 되는데 했다)는 **좁게** 본다.
    const setBefore = hasSet(before);
    // O2 전용: 문을 진짜로 연 것만 센다.
    //   ⚠️`setBusy` 같은 **스피너**는 문을 연 게 아니다.
    //   ⚠️`if (…) { setUnlocked(true); return; }` 처럼 **await 에 닿기 전에 돌아가는 가지**도 아니다
    //     → 같은 중괄호 깊이의 것만 센다(가지 안은 한 겹 더 깊다).
    //   ⚠️★«깊이 0» 으로 보면 안 된다 — `try { … }` 안이면 깊이가 1 이라 **규칙이 통째로 헛돈다**
    //     (2026-09-03 음성 테스트에서 실제로 안 잡혔다. 초록불을 그대로 믿었으면 못 봤다).
    //     기준은 깊이가 아니라 «**await 에 닿을 때까지 그 블록이 살아 있는가**» 다.
    //     조기 return 가지는 await 전에 **닫히므로** 뒤쪽 깊이가 그보다 얕아진다.
    const ev: { d: number; door: boolean }[] = [];
    let depth = 0;
    for (const mm of before.matchAll(new RegExp(`[{}]|${SET.source}`, 'g'))) {
      if (mm[0] === '{') { depth++; ev.push({ d: depth, door: false }); }
      else if (mm[0] === '}') { ev.push({ d: depth, door: false }); depth--; }
      else ev.push({ d: depth, door: !/^set(Busy|Loading|Sending|Saving|Refreshing|Submitting|Pending|Msg|Error)\b/.test(mm[0]) });
    }
    let minAfter = depth, opensDoor = false;      // 뒤에서부터 최소 깊이를 굴린다
    for (let i = ev.length - 1; i >= 0; i--) {
      if (ev[i].door && ev[i].d <= minAfter) opensDoor = true;   // 끝까지 안 닫힌 자리 = 실행된다
      minAfter = Math.min(minAfter, ev[i].d);
    }
    const setAfter = hasSet(after) || /\b(reload|load)\s*\(/.test(after);
    // ★서버 응답을 **뒤에서 쓰면** 낙관적일 수 없다 → 면제.
    //   서버만 아는 값(새 글 id·새 방 id·집계 수)으로 화면을 그리는 자리다.
    //   ⚠️«setState 안에서 쓰는지» 로만 보면 `if (ok) …` 처럼 한 번 걸러 쓰는 자리를 놓친다.
    //   ⚠️`const x = cond ? (await f()) : undefined` 처럼 **삼항을 거치면** 위 정규식의 `m[2]` 가 비어
    //     «결과를 안 쓴다» 로 잘못 읽는다 → 문장 앞으로 되짚어 이름을 찾는다(2026-09-03 오탐).
    const stmt = before.slice(Math.max(before.lastIndexOf(';'), before.lastIndexOf('{')) + 1);
    const bound = m[2] ?? (stmt.match(/(?:const|let|var)\s+(\w+)\s*=/)?.[1] ?? null);
    const usesResult = !!bound && new RegExp(`\\b${bound}\\b`).test(after);

    // ★«접수됐어요» 처럼 **알림 자체가 결과**인 동작은 낙관적일 수 없다 → 면제.
    //   신고·제보는 «내 화면의 내 상태» 를 바꾸는 게 아니라 **남에게 보낸 사실**이 결과다.
    //   서버가 안 받았는데 «접수됐어요» 라고 하면 그건 낙관이 아니라 거짓말이다.
    //   ⚠️`set*` 없이 `reload()` 만 하는 자리는 그대로 잡아야 한다(친구 수락이 그랬다) → 알림이 있을 때만 면제.
    const reports = /Alert\.alert\s*\(/.test(after) && !hasSet(after);

    if (money) { if (opensDoor) early.push({ file: f, line, fn, money }); }
    else if (setAfter && !setBefore && !usesResult && !reports) late.push({ file: f, line, fn, money });
  }
}

const rel = (p: string) => path.relative(ROOT, p);
for (const h of late) fail('O1', `${rel(h.file)}:${h.line} — \`${h.fn}\` 서버를 기다린 뒤에야 화면이 바뀐다. 먼저 바꾸고 실패하면 되돌려라`);
for (const h of early) fail('O2', `★${rel(h.file)}:${h.line} — \`${h.fn}\` 는 **돈·신원**이다. 서버가 답하기 전에 열어 주면 공짜로 열린다`);

// ── ③ 이미 지킨 자리는 **지킨 채로** 남아야 한다(되돌아가는 것을 막는다) ────
const GUARD: [string, string][] = [
  ['app/src/app/(app)/friends.tsx', 'optimistic'],
  ['app/src/app/(app)/notifications.tsx', 'setSt((prev)'],
  ['app/src/components/talk/ChatList.tsx', 'setRows((prev)'],
  ['app/src/components/talk/UserRoomView.tsx', 'tempId'],
];
for (const [f, needle] of GUARD) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { fail('O3', `${f} 가 없다 — 옮겼으면 이 하네스도 같이 옮겨라`); continue; }
  if (!fs.readFileSync(p, 'utf8').includes(needle)) fail('O3', `${f} 에서 낙관적 반영이 사라졌다(\`${needle}\`)`);
}

if (SELFTEST) {
  // ★음성 테스트 — 규칙이 실제로 «잡는지» 본다(초록불만 보고 믿지 않는다)
  const cases: { name: string; ok: boolean }[] = [
    { name: 'MUT 를 몸통으로 모았다', ok: MUT.size > 20 && MUT.has('removeFriend') },
    { name: '★MONEY 를 갈라냈다', ok: MONEY.size > 0 },
    { name: '★setTimeout 은 상태 세터가 아니다', ok: !/^set(Timeout|Interval|Immediate)$/.test('setBalance') },
    { name: '★돈은 MUT 만으로 판정하지 않는다', ok: [...MONEY].every((x) => !late.some((h) => h.fn === x)) },
    { name: 'block() 이 중첩 중괄호를 센다', ok: block('{a{b}c}', 0) === '{a{b}c}' },
    { name: '주석 속 낱말은 안 센다', ok: !/setX/.test(stripComments('// setX(1)\nconst a=1;')) },
    { name: '★길이를 보존한다(줄번호 근거)', ok: stripComments('a// bb\nc').length === 'a// bb\nc'.length },
    { name: '★문자열 속 중괄호는 안 센다', ok: !/\{/.test(blankStrings("x('{{a}}')")) },
  ];
  let f2 = 0;
  for (const c of cases) { if (!c.ok) { f2++; console.log(`  ❌ ${c.name}`); } }
  console.log(f2 ? `❌ selftest ${f2} 실패` : `✅ selftest ${cases.length}/${cases.length}`);
  process.exit(f2 ? 1 : 0);
}

if (bad) { console.log(`\n❌ check:optimistic — ${bad}건`); process.exit(1); }
console.log(`✅ check:optimistic — 되돌릴 수 있는 것은 먼저 반영·실패 시 롤백 · ★돈/신원은 서버가 먼저 (서버변경 ${MUT.size} · 돈 ${MONEY.size})`);
