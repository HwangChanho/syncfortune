// scripts/check-study.ts — **사주 공부**가 되게 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01: *"사주 공부도 가능해야하는데 자꾸 이상한 소리만해"*
//
// ■ ★실측한 원인은 **셋이 겹쳐** 있었다(하나만 고치면 여전히 이상하다)
//   ①상담가 소개엔 「사주 · 명리 공부」 라고 적혀 있는데 **지문에 공부 규칙이 0줄**이었다.
//   ②「십신이 뭐야」 가 `isDeep()` 에 걸려 **골든 RAG** 를 탄다 — 골든은 «특정 명식의 판정문» 이라
//     개념을 물었는데 **명식 판정**이 답으로 나온다.
//   ③기본 지문의 *"차트에 정박"* + *"한 턴에 3~4문장"* 이 **개념 설명을 불가능하게** 했다.
//
// ■ ★★고친 방식 — RAG 를 **끊지 않았다**
//   Boss 2026-08-26: *"무조껀 우리가만든 RAG 모델을 타야한다니깐"*.
//   끊는 대신 **무엇인지 알려 준다** — «교과서가 아니라 사례» 라고 못 박으면
//   모델이 그것을 답으로 내밀지 않는다. 규칙끼리 부딪칠 때는 **둘 다 지키는 길**을 찾는다.
//
// 무엇을 지키나
//   T1 공부 물음을 **가려낸다**(개념 질문 ↔ 내 명식 질문)
//   T2 지문에 공부 규칙이 **실린다**
//   T3 ★골든을 **«사례»로** 못 박는다(답으로 내밀지 않게)
//   T4 ★길이 제한을 **푼다**(3~4문장으로는 개념 설명이 안 된다)
//   T5 ★**개념 먼저 · 내 차트는 뒤에** — 순서를 지문이 정한다
//   T6 앱·Edge 두 사본이 **같다**
//
// ★음성 테스트: `npx tsx scripts/check-study.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isStudyAsk, studyTerms } from '../app/src/lib/talk/studyAsk';

const ROOT = join(import.meta.dirname ?? '.', '..');
type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 지문에 공부 규칙이 실려 있는가. */
export function hasStudyBlock(src: string): boolean {
  return /const studying = isStudyAsk\(/.test(src) && /\$\{studyLine\}/.test(src);
}
/** 골든을 «사례»로 못 박았는가(답으로 내밀지 않게). */
export function marksGoldenAsExample(src: string): boolean {
  return /교과서가 아니라/.test(src) && /사례/.test(src);
}
/** 길이 제한을 풀어 줬는가. */
export function liftsLengthCap(src: string): boolean {
  return /길이 제한.*풀린다|제한\(한 턴 3~4문장\)은 \*\*여기선 풀린다/.test(src);
}
/** 「개념 먼저 · 내 차트는 뒤」 순서를 못 박았는가. */
export function ordersConceptFirst(src: string): boolean {
  return /개념을 먼저/.test(src) && /개념이 먼저고/.test(src);
}

function run() {
  const EDGE = 'supabase/functions/talk/index.ts';
  if (!existsSync(join(ROOT, EDGE))) { console.log('⏭  건너뜀 — `supabase/` 가 없다(gitignore). **못 쟀다**'); return; }
  const src = readFileSync(join(ROOT, EDGE), 'utf8');

  if (!hasStudyBlock(src)) {
    fail('T2', '지문에 **공부 규칙이 없다**.\n        '
      + '⚠️상담가 소개엔 「사주 · 명리 공부」 라고 적혀 있는데 지문이 비면,\n        '
      + '  모델은 기본 규칙(*"차트에 정박"*)을 따라 **내 명식 얘기**를 한다');
  }
  if (!marksGoldenAsExample(src)) {
    fail('T3', '골든을 **«사례»로 못 박지 않았다**.\n        '
      + '⚠️골든은 «특정 명식의 판정문» 이다 — 개념을 물었는데 그게 답으로 나오면\n        '
      + '  그게 바로 Boss 가 말한 «이상한 소리» 다');
  }
  if (!liftsLengthCap(src)) {
    fail('T4', '길이 제한을 **안 풀었다**.\n        '
      + '⚠️*"한 턴에 3~4문장"* 으로는 개념 설명이 안 된다 — 잘린 설명은 설명이 아니다');
  }
  if (!ordersConceptFirst(src)) {
    fail('T5', '**개념 먼저 · 내 차트는 뒤** 순서를 안 정했다.\n        '
      + '★순서가 뒤집히면 「십신이 뭐야」 에 내 십신부터 말한다 — **묻지 않은 답**이다');
  }

  // T6 두 사본
  const a = 'app/src/lib/talk/studyAsk.ts';
  const b = 'supabase/functions/_shared/studyAsk.ts';
  if (!existsSync(join(ROOT, b))) console.log('⏭  T6 건너뜀 — Edge 사본 없음. **못 쟀다**');
  else {
    const strip = (p: string) => readFileSync(join(ROOT, p), 'utf8').split('\n').slice(1).join('\n');
    if (strip(a) !== strip(b)) {
      fail('T6', '앱과 Edge 의 판정 파일이 **갈렸다** — 첫 줄(경로)만 다르고 나머지는 같아야 한다');
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    { name: 'T1 개념 질문을 잡는다', run: () => isStudyAsk('십신이 뭐야') === true },
    { name: 'T1 «어떻게 잡아» 도 공부', run: () => isStudyAsk('용신 어떻게 잡아') === true },
    { name: 'T1 차이를 묻는 것도 공부', run: () => isStudyAsk('대운이랑 세운 차이가 뭐야') === true },
    { name: 'T1 ★«내» 가 붙으면 공부가 아니다', run: () => isStudyAsk('내 십신 뭐야') === false },
    { name: 'T1 ★«제» 가 붙어도 아니다', run: () => isStudyAsk('제 용신이 뭔가요') === false },
    { name: 'T1 ★용어가 없으면 아니다', run: () => isStudyAsk('그게 뭐야') === false },
    { name: 'T1 ★설명을 안 청하면 아니다', run: () => isStudyAsk('십신 재밌네') === false },
    { name: 'T1 ★잡담은 아니다', run: () => isStudyAsk('오늘 기분이 별로야') === false },
    { name: 'T1 ★빈 말은 아니다', run: () => isStudyAsk('') === false },
    { name: '용어를 뽑아낸다', run: () => studyTerms('대운이랑 세운 차이').join(',') === '대운,세운' },
    { name: 'T2 지문 규칙을 알아본다', run: () => hasStudyBlock('const studying = isStudyAsk(qText); ... ${studyLine}') === true },
    { name: 'T2 ★없으면 문다', run: () => hasStudyBlock('const x = 1;') === false },
    { name: 'T3 사례 표시를 알아본다', run: () => marksGoldenAsExample('교과서가 아니라 특정 명식의 판정 사례다') === true },
    { name: 'T3 ★없으면 문다', run: () => marksGoldenAsExample('골든을 참고하라') === false },
    { name: 'T4 길이 해제를 알아본다', run: () => liftsLengthCap('길이 제한(한 턴 3~4문장)은 **여기선 풀린다**') === true },
    { name: 'T5 순서를 알아본다', run: () => ordersConceptFirst('개념을 먼저, 일반적으로 ... 개념이 먼저고, 내 차트는 예시로 뒤에') === true },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:study — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:study — 공부 물음이 갈리고, 개념부터 설명하고, 골든은 사례로만 쓴다');
}
