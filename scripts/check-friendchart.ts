// scripts/check-friendchart.ts — 담아 온 **친구 명식**을 잘못 쓰지 않게
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"친구가 명식 공개해두면 친구 명식도 내 만세력 리스트에
//   등록할수있게해"* → *"별도로 표기해서 구분하고 수정은 불가능하게"*)
//
// ■ ★이 기능의 뿌리에 **하나의 제약**이 있다 — 생년월일이 안 넘어온다
//   친구에게서 받는 것은 서버가 **이미 계산해 둔 명식**(`saju`)뿐이고
//   생년월일(`birth_enc`)은 암호화돼 있다. **생일 역산을 막으려는 의도**다.
//   ⇒ 담은 항목의 `input` 은 **껍데기**다. 여기서 두 가지가 따라 나온다:
//     ①그 껍데기로 `computeChart` 를 돌리면 **엉뚱한 명식**이 나온다(조용히 틀린다)
//     ②편집 폼을 열면 **빈 폼**이 뜨고, 저장하면 그 엉뚱한 값으로 **덮인다**
//   ★둘 다 «오류 없이 틀리는» 종류라 눈으로는 안 잡힌다.
//
// 무엇을 지키나
//   F1 만세력이 친구 명식이면 **계산하지 않고** 그대로 쓴다
//   F2 목록이 친구 명식을 **구분해 표기**한다
//   F3 수정을 **막는다**(열어 주면 덮어쓴다)
//   F4 담는 함수가 **한도·중복**을 지킨다(같은 친구를 두 번 담지 않는다)
//
// ★음성 테스트: `npx tsx scripts/check-friendchart.ts --selftest`
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

/** 만세력이 친구 명식일 때 **계산을 건너뛰는가**. */
export function skipsComputeForFriend(src: string): boolean {
  const s = strip(src);
  // `friendSaju ? …그대로… : computeChart(input)` 꼴이어야 한다
  return /friendSaju\s*\?[\s\S]{0,160}?computeChart\s*\(/.test(s);
}

/** 목록이 친구 명식을 **구분해 표기**하는가. */
export function showsFriendBadge(src: string): boolean {
  const s = strip(src);
  return /c\.friend\s*\?/.test(s) && /friendBadge/.test(s);
}

/** 수정을 **막는가**(친구면 편집 폼으로 안 보낸다). */
export function blocksFriendEdit(src: string): boolean | null {
  const s = strip(src);
  const i = s.indexOf('function edit(');
  if (i < 0) return null;
  const body = s.slice(i, i + 700);
  // 편집 폼으로 보내기 **전에** friend 를 보고 빠져나가야 한다
  const guard = body.search(/\.friend\b/);
  const push = body.indexOf("'/register'");
  if (guard < 0) return false;
  return push < 0 || guard < push;
}

/** 담는 함수가 **중복을 막는가**. */
export function dedupesFriendChart(src: string): boolean {
  const s = strip(src);
  const i = s.indexOf('export async function addFriendChart');
  if (i < 0) return false;
  const body = s.slice(i, i + 900);
  return /friend\?\.ownerId\s*===\s*ownerId/.test(body) && /return\s+dup\.id/.test(body);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const MS = 'app/src/screens/MyeongsikScreen.tsx';
  const PICK = 'app/src/components/ChartPicker.tsx';
  const CHART = 'app/src/lib/engine/myChart.ts';

  const ms = read(MS), pick = read(PICK), chart = read(CHART);

  if (!ms) fail('F0', `${MS} 를 못 읽었다`);
  else if (!skipsComputeForFriend(ms)) {
    fail('F1', `${MS} 가 친구 명식도 **계산한다**.\n        `
      + '⚠️담은 항목의 `input` 은 **껍데기**다(생년월일이 안 넘어온다) —\n        '
      + '그걸로 `computeChart` 를 돌리면 **엉뚱한 명식**이 조용히 나온다.\n        '
      + '⇒ `friendSaju` 가 있으면 그것을 그대로 쓸 것');
  }

  if (!pick) fail('F0', `${PICK} 를 못 읽었다`);
  else {
    if (!showsFriendBadge(pick)) {
      fail('F2', `${PICK} 가 친구 명식을 **구분해 표기하지 않는다**(Boss 2026-08-31 지시).\n        `
        + '내가 등록한 것과 담아 온 것은 **고칠 수 있는지**가 다르다 — 구분이 없으면 그걸 모른다');
    }
    if (blocksFriendEdit(pick) === false) {
      fail('F3', `${PICK} 가 친구 명식의 **수정을 안 막는다**.\n        `
        + '⚠️편집 폼을 열면 생년월일이 없어 **빈 폼**이 뜨고, 저장하면 그 값으로 **덮인다** —\n        '
        + '오류 없이 명식이 바뀐다. 아예 열지 말 것');
    }
  }

  if (!chart) fail('F0', `${CHART} 를 못 읽었다`);
  else if (!dedupesFriendChart(chart)) {
    fail('F4', `${CHART} 의 \`addFriendChart\` 가 **중복을 안 막는다** — 같은 친구가 목록에 여러 번 쌓인다`);
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'F1 친구면 건너뛰면 통과',
      run: () => skipsComputeForFriend('const c = useMemo(() => (friendSaju ? { saju: friendSaju } : computeChart(input)), [x]);') === true },
    { name: 'F1 무조건 계산하면 문다',
      run: () => skipsComputeForFriend('const c = useMemo(() => computeChart(input), [input]);') === false },
    { name: 'F2 배지가 있으면 통과',
      run: () => showsFriendBadge('{c.friend ? <View style={styles.friendBadge}/> : null}') === true },
    { name: 'F2 조건만 있고 배지가 없으면 문다',
      run: () => showsFriendBadge('{c.friend ? <Text>x</Text> : null}') === false },
    { name: 'F3 먼저 막으면 통과',
      run: () => blocksFriendEdit("function edit(id){ if (t?.friend) return; router.push({ pathname: '/register' }); }") === true },
    { name: 'F3 안 막으면 문다',
      run: () => blocksFriendEdit("function edit(id){ router.push({ pathname: '/register' }); }") === false },
    { name: 'F3 ★막긴 하는데 **보낸 뒤**면 문다',
      run: () => blocksFriendEdit("function edit(id){ router.push({ pathname: '/register' }); if (t?.friend) x(); }") === false },
    { name: 'F3 edit 이 없으면 단정하지 않는다', run: () => blocksFriendEdit('const a=1;') === null },
    { name: 'F4 중복을 막으면 통과',
      run: () => dedupesFriendChart('export async function addFriendChart(o){ const dup = l.find((c)=>c.friend?.ownerId === ownerId); if (dup) return dup.id; }') === true },
    { name: 'F4 안 막으면 문다',
      run: () => dedupesFriendChart('export async function addFriendChart(o){ push(row); }') === false },
    { name: '주석 속 코드에 안 속는다',
      run: () => showsFriendBadge('// {c.friend ? <View style={styles.friendBadge}/> : null}') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:friendchart — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:friendchart — 담아 온 친구 명식은 계산 안 하고, 구분되고, 못 고친다');
