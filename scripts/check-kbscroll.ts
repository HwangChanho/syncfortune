// scripts/check-kbscroll.ts — 키보드가 열리면 대화가 **맨 아래로 따라 붙는다**
// ═══════════════════════════════════════════════════════════════════════════
// ★Boss 2026-09-02: *"키보드 때문에 내 채팅이 안보여"*
//
// ■ 무엇이 있었나 — 키보드가 열리면 입력바가 올라가고 목록(`flex:1`)은 **높이가 줄어든다.**
//   그런데 **스크롤 위치는 그대로**라, 아래에 있던 말풍선이 보이는 영역 **밖으로 밀린다.**
//   방금 내가 쓴 그 한 줄이 안 보인다 — 대화에서 가장 중요한 줄이.
// ■ ⚠️★여백(`paddingBottom`)을 더 주는 것은 **틀린 고침**이다. 자리는 이미 줄어들어 확보돼 있다.
//   여백까지 주면 목록 아래에 **빈 칸이 생긴다**. 첫 판에 그렇게 짰다가 배치를 읽고 되돌렸다.
//   ⇒ 필요한 것은 **스크롤 하나**다.
//
// 무엇을 지키나
//   K1 `TalkThread` 가 **키보드 높이를 받는다**(`keyboardH`)
//   K2 그 값이 바뀌면 **맨 아래로 붙인다**(`scrollToEnd`)
//   K3 ★`TalkThread` 를 쓰는 **모든 곳**이 그 값을 넘긴다
//      — 한 곳만 넘기면 «AI 대화만 되고 친구 대화는 안 되는» 반쪽이 된다(이 저장소의 반복 실패)
//   K4 ★키보드 높이를 재는 화면은 **show·hide 를 둘 다** 듣는다(닫힐 때 안 되돌리면 화면이 뜬 채 남는다)
//
// ★음성 테스트: `npx tsx scripts/check-kbscroll.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const THREAD = 'app/src/components/talk/TalkThread.tsx';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
/** `<TalkThread …/>` 한 덩어리를 꺼낸다(여러 줄에 걸쳐 있다). */
export function threadUsages(src: string): string[] {
  const outs: string[] = [];
  for (const m of src.matchAll(/<TalkThread\b/g)) {
    const i = src.indexOf('/>', m.index!);
    outs.push(src.slice(m.index!, i < 0 ? m.index! + 400 : i + 2));
  }
  return outs;
}

function walk(dir: string, acc: { file: string; text: string }[] = []) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of es) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push({ file: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') });
  }
  return acc;
}

function run() {
  const abs = join(ROOT, THREAD);
  if (!existsSync(abs)) { fail('K1', `${THREAD} 가 없다 — **못 쟀다**`); return; }
  const th = stripComments(readFileSync(abs, 'utf8'));

  // K1 — 프롭을 받나(타입 + 구조분해 **둘 다**. 타입만 있으면 값이 안 들어온다)
  if (!/\bkeyboardH\s*\?:/.test(th)) fail('K1', '`TalkThread` 가 `keyboardH` 프롭을 **선언하지 않는다**');
  if (!/function TalkThread\(\{[^}]*\bkeyboardH\b/.test(th)) {
    fail('K1', '★`keyboardH` 가 **구조분해에 없다** — 타입만 있으면 값이 안 들어와 조용히 아무 일도 안 한다');
  }
  // K2 — 그 값이 바뀌면 맨 아래로
  if (!/scrollToEnd\([^)]*\)[^;]*;\s*\}\s*,\s*\[\s*keyboardH\s*\]/.test(th.replace(/\s+/g, ' '))) {
    fail('K2', '★`keyboardH` 가 바뀔 때 `scrollToEnd` 를 안 한다 — 높이만 줄고 스크롤이 안 따라오면\n        '
      + '  방금 쓴 말이 화면 밖으로 밀린다(그게 이 사고였다)');
  }
  // K3 — 쓰는 곳이 전부 넘기나
  for (const { file, text } of walk(join(ROOT, 'app/src'))) {
    if (file === THREAD) continue;
    for (const use of threadUsages(stripComments(text))) {
      if (!/\bkeyboardH\s*=/.test(use)) {
        fail('K3', `${file} 의 \`<TalkThread>\` 가 **\`keyboardH\` 를 안 넘긴다**.\n        `
          + '⚠️이 화면만 «키보드 열면 내 말이 안 보이는» 상태로 남는다 — 다른 화면은 되는데 여기만.');
      }
    }
    // K4 — 키보드를 재는 화면은 show·hide 를 둘 다
    const t = stripComments(text);
    const hasShow = /keyboard(Will|Did)Show/.test(t);
    const hasHide = /keyboard(Will|Did)Hide/.test(t);
    if (hasShow !== hasHide) {
      fail('K4', `${file} 가 키보드 ${hasShow ? 'show 만' : 'hide 만'} 듣는다 — `
        + '한쪽만 들으면 키보드를 닫아도 화면이 **올라간 채** 남는다');
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cs: { name: string; run: () => boolean }[] = [
    { name: 'K3 사용처를 꺼낸다', run: () => threadUsages('<TalkThread items={x} keyboardH={k} />').length === 1 },
    { name: 'K3 ★여러 줄에 걸쳐도 꺼낸다', run: () => threadUsages('<TalkThread\n  items={x}\n  keyboardH={k}\n/>')[0].includes('keyboardH') },
    { name: 'K3 ★안 넘기면 표가 난다', run: () => !/\bkeyboardH\s*=/.test(threadUsages('<TalkThread items={x} />')[0]) },
    { name: 'K3 ★두 개면 두 개 다 꺼낸다', run: () => threadUsages('<TalkThread a />\n<TalkThread b />').length === 2 },
    { name: '★주석 속 사용처는 안 센다', run: () => threadUsages(stripComments('// <TalkThread items={x} />')).length === 0 },
    { name: 'K2 정규식이 실제 코드를 문다', run: () => /scrollToEnd\([^)]*\)[^;]*;\s*\}\s*,\s*\[\s*keyboardH\s*\]/.test('useEffect(() => { ref.current?.scrollToEnd({ animated: false }); }, [keyboardH]);'.replace(/\s+/g, ' ')) },
    { name: 'K2 ★다른 의존성이면 안 문다', run: () => !/scrollToEnd\([^)]*\)[^;]*;\s*\}\s*,\s*\[\s*keyboardH\s*\]/.test('useEffect(() => { ref.current?.scrollToEnd({}); }, [items.length]);'.replace(/\s+/g, ' ')) },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cs) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:kbscroll — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:kbscroll — 키보드가 열리면 대화가 맨 아래로 따라 붙는다(쓰는 곳 전부)');
}
