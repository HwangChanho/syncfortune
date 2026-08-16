// scripts/check-pillarorder.ts — 명식 표기 방향 불변식: **오른쪽이 년주**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-16, daniel *"만세력 밴다이어그램에서 년주 월주 일주 시주 순으로 오른쪽부터 나오게"*)
//   같은 화면에서 명식이 **두 방향으로** 그려지고 있었다.
//     · 본 명식 그리드 : `['시','일','월','년']` 그대로 → 년주 오른쪽 ✅
//     · 벤다이어그램   : 같은 배열에 `.reverse()` → 년주 왼쪽 ❌
//   `LuckNest` 주석은 *"전통 표기(오른쪽=년주)와 맞추기 위해 역순"* 이라고 **맞는 의도**를 적어 뒀는데,
//   전제("년월일시로 들어온다")가 틀려서 결과가 반대였다.
//   ⇒ 주석이 옳다고 그림이 옳은 게 아니다. **순서를 실행해서** 확인한다.
//
// 무엇을 지키나
//   P1. 표기 순서가 실제로 시·일·월·년인가 — `PILLAR_DISPLAY_ORDER` 를 **실행해서** 본다
//   P2. `sortPillarsForDisplay` 가 **넘어온 순서와 무관하게** 같은 결과를 내는가(뒤집힌 입력·섞인 입력)
//   P3. 시각 미상(3주)에서도 년주가 마지막(오른쪽)인가
//   P4. 화면이 **자기만의 뒤집기**를 하지 않는가 — 기둥 렌더 근처의 `.reverse()` 금지
//   P5. 화면이 **자기만의 순서표**를 만들지 않는가 — `['시','일','월','년']` 리터럴은 단일 소스에만
//
// ★음성 테스트: `npx tsx scripts/check-pillarorder.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import { PILLAR_DISPLAY_ORDER, pillarRank, sortPillarsForDisplay } from '../app/src/lib/ui/pillarOrder';

const CANON = 'app/src/lib/ui/pillarOrder.ts';
const SCREENS = ['app/src/components/LuckNest.tsx', 'app/src/screens/MyeongsikScreen.tsx'];

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석·문자열을 지운 '코드만'(리터럴 배열은 남긴다 — P5 가 찾는 게 그것이다). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const posOf = (arr: Array<{ pos: string }>) => arr.map((p) => p.pos).join(' ');

// ── P1. 표기 순서(실행값) ────────────────────────────────────────────────────
if (PILLAR_DISPLAY_ORDER.join('') !== '시일월년') {
  fail('P1', `표기 순서가 '${PILLAR_DISPLAY_ORDER.join('·')}' 다 — 왼→오 '시·일·월·년'(년주가 오른쪽)이어야 한다`);
}

// ── P2. 입력 순서에 흔들리지 않는가 ──────────────────────────────────────────
{
  const WANT = '시주 일주 월주 년주';
  const inputs: Array<[string, Array<{ pos: string }>]> = [
    ['전통순(시일월년)', [{ pos: '시주' }, { pos: '일주' }, { pos: '월주' }, { pos: '년주' }]],
    ['시간순(년월일시)', [{ pos: '년주' }, { pos: '월주' }, { pos: '일주' }, { pos: '시주' }]],
    ['뒤섞인 순서', [{ pos: '월주' }, { pos: '시주' }, { pos: '년주' }, { pos: '일주' }]],
  ];
  for (const [name, input] of inputs) {
    const got = posOf(sortPillarsForDisplay(input));
    if (got !== WANT) fail('P2', `${name} 입력이 '${got}' 로 나온다 — '${WANT}' 여야 한다(오른쪽=년주)`);
  }
}

// ── P3. 시각 미상(3주) ──────────────────────────────────────────────────────
{
  const got = posOf(sortPillarsForDisplay([{ pos: '년주' }, { pos: '월주' }, { pos: '일주' }]));
  if (got !== '일주 월주 년주') fail('P3', `시각 미상 3주가 '${got}' 로 나온다 — '일주 월주 년주'(년주 오른쪽)여야 한다`);
  // 모르는 라벨을 버리지 않는가(정렬은 자리만 바꾼다)
  const kept = sortPillarsForDisplay([{ pos: '년주' }, { pos: '대운' }]);
  if (kept.length !== 2) fail('P3', `모르는 라벨이 정렬에서 사라졌다(${kept.length}개 남음) — 버리면 안 된다`);
}

// ── P4/P5. 화면이 제 나름의 방향·순서표를 갖지 않는가 ────────────────────────
for (const file of SCREENS) {
  if (!fs.existsSync(file)) { fail('P4', `${file} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`); continue; }
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  // P4 — 기둥 배열을 뒤집는 코드(`natal`·`visiblePos`·`POS` 를 reverse)
  for (const m of code.matchAll(/(natal|visiblePos|POS|pillars)\s*\]?\s*\.reverse\s*\(\)/g)) {
    fail('P4', `${file} — 기둥을 자체적으로 뒤집는다(\`${m[0]}\`). 방향은 ${CANON} 한 곳에서만 정한다`);
  }
  for (const m of code.matchAll(/\[\s*\.\.\.\s*(natal|visiblePos|POS|pillars)\s*\]\.reverse/g)) {
    fail('P4', `${file} — 기둥을 자체적으로 뒤집는다(\`${m[0]}\`). 방향은 ${CANON} 한 곳에서만 정한다`);
  }
  // P5 — 순서표 리터럴 사본
  if (/\[\s*'시'\s*,\s*'일'\s*,\s*'월'\s*,\s*'년'\s*\]/.test(code)) {
    fail('P5', `${file} — 표기 순서표를 직접 만들었다. \`PILLAR_DISPLAY_ORDER\` 를 import 할 것`);
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const RE_REV = /(natal|visiblePos|POS|pillars)\s*\]?\s*\.reverse\s*\(\)/;
  const RE_LIT = /\[\s*'시'\s*,\s*'일'\s*,\s*'월'\s*,\s*'년'\s*\]/;
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'P1: 순서가 시일월년이다(실행값)', run: () => PILLAR_DISPLAY_ORDER.join('') === '시일월년' },
    { name: 'P1: 년주가 가장 오른쪽(rank 최대)', run: () => pillarRank('년주') === 3 && pillarRank('시주') === 0 },
    { name: 'P2: 뒤집힌 입력을 바로잡는다', run: () => posOf(sortPillarsForDisplay([{ pos: '년주' }, { pos: '월주' }, { pos: '일주' }, { pos: '시주' }])) === '시주 일주 월주 년주' },
    { name: 'P2: 원본 배열을 훼손하지 않는다', run: () => { const a = [{ pos: '년주' }, { pos: '시주' }]; sortPillarsForDisplay(a); return a[0].pos === '년주'; } },
    { name: 'P3: 모르는 라벨을 버리지 않는다', run: () => sortPillarsForDisplay([{ pos: '년주' }, { pos: '대운' }]).length === 2 },
    { name: 'P4: `[...natal].reverse()` 를 문다', run: () => RE_REV.test('{[...natal].reverse().map((p) => (') },
    { name: 'P4: `visiblePos.reverse()` 도 문다', run: () => RE_REV.test('const x = visiblePos.reverse()') },
    { name: 'P4: 다른 배열의 reverse 는 안 문다(오탐 없음)', run: () => !RE_REV.test('const y = rings.reverse()') },
    { name: 'P4: 주석 속 reverse 는 안 문다(오탐 없음)', run: () => !RE_REV.test(stripComments('// 옛날엔 [...natal].reverse() 였다\nconst z = 1;')) },
    { name: 'P5: 순서표 리터럴 사본을 문다', run: () => RE_LIT.test("const POS: PillarPos[] = ['시', '일', '월', '년'];") },
    { name: 'P5: 단일 소스를 쓰면 통과', run: () => !RE_LIT.test('const POS: PillarPos[] = PILLAR_DISPLAY_ORDER;') },
    { name: 'P5: 시간순 배열은 안 문다(엔진 쪽 — 무관)', run: () => !RE_LIT.test("const POS: PillarPos[] = ['년', '월', '일', '시'];") },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:pillarorder — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:pillarorder — 표기 순서 시·일·월·년(오른쪽=년주) · 화면이 제멋대로 뒤집지 않는다');
