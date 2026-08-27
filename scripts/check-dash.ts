// scripts/check-dash.ts — 줄표(—)가 **화면에 안 남는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27 *"대화 중간마다 「ㅡ」가 들어간다"*
//
// ■ ★그 「ㅡ」의 정체 — 넘겨짚지 않고 **떠서** 확인했다
//   저장된 답변 99건 전수: 한글 자모 「ㅡ」(U+3161)는 **0건**,
//   em dash(U+2014)가 **7회·4건(8%)**. Pretendard 에서 둘은 거의 같은 모양이다.
//   ★Boss 가 마지막으로 본 대화(08-26 20:02)에 「…나누자고 하면 — 그때마다」가 실제로 있었다.
//
// ■ ⚠️왜 하네스가 필요한가 — **규칙이 두 벌**이다
//   Deno(Edge)와 RN(앱)은 코드를 나눠 쓸 수 없어 `plainDash` 가 두 파일에 있다.
//   [[duplicate-ui-single-source]] 가 말하는 바로 그 자리다 —
//   **주석에 «같다» 고 적어 두는 것은 보장이 아니다.** 그래서 여기서 **둘 다 실제로 돌려** 대조한다.
//
// ■ 검사
//   D1 두 파일에 `plainDash` 가 있다
//   D2 ★같은 입력 12개에 **두 벌의 출력이 한 글자도 안 다르다**
//   D3 서버가 답을 **저장하기 전에** 부른다(남기면 이력에 실려 모델이 따라 쓴다)
//   D4 앱이 말풍선을 만들 때 부른다(이미 저장된 옛 대화의 그물)
//   D5 ★자기검사 — 줄표를 **안 지우는** 함수를 넣으면 D2 가 깨져야 한다
//
// 실행: npm run check:dash
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const APP = 'app/src/lib/talk/splitBubbles.ts';
const EDGE = 'supabase/functions/_shared/plainDash.ts';
const TALK = 'supabase/functions/talk/index.ts';

let fail = 0;
const say = (c: boolean, m: string, d = '') => { if (!c) fail++; console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(46)} ${d}`); };
console.log('\n─  check:dash — 줄표(—)가 화면에 남지 않는가\n');

/**
 * 소스에서 `plainDash` 본문을 꺼내 **실행 가능한 함수**로 만든다.
 * ★베끼지 않는다 — 여기 규칙을 다시 적으면 «하네스는 통과인데 앱은 다르게 도는» 일이 생긴다.
 */
function pull(path: string): ((s: string) => string) | null {
  const src = readFileSync(path, 'utf8');
  const i = src.indexOf('export function plainDash(');
  if (i < 0) return null;
  let j = src.indexOf('{', i) + 1, depth = 1;
  while (j < src.length && depth > 0) { const ch = src[j]; if (ch === '{') depth++; else if (ch === '}') depth--; j++; }
  const body = src.slice(src.indexOf('{', i) + 1, j - 1).replace(/:\s*string/g, '');
  // eslint-disable-next-line no-new-func
  return new Function('text', body) as (s: string) => string;
}

const app = pull(APP);
const edge = pull(EDGE);
say(!!app && !!edge, 'D1 두 곳에 plainDash 가 있다', `${app ? '앱✓' : '앱✗'} ${edge ? '서버✓' : '서버✗'}`);

// ── D2 두 벌이 **같은 답**을 내는가 ──────────────────────────────────────
// ★입력에는 실제로 저장돼 있던 문장을 넣는다(지어낸 예문만으로는 못 잡는다).
const CASES = [
  '파트너가 수입 나누자고 하면 — 그때마다 이 충이 울리는 거지.',   // ← 08-26 20:02 실제
  'The fix is Earth — organize, document, write things down.',    // ← 08-26 17:25 실제
  "It's about holding the line — knowing exactly what you have",  // ← 08-26 20:01 실제
  'i problemi con le persone seguono — partnership',              // ← 08-26 17:26 실제
  '2020—2024년 사이에 자리가 바뀐다',
  '— 그때마다 이 충이 울린다',
  '말이 끝났어 —',
  '좋아, — 그런데 말이야',
  '그래 ㅡ 그러니까',
  '아니 ㅡㅡ 진짜로',
  '줄표가 하나도 없는 평범한 문장이에요',
  '앞뒤로―붙은―것도―본다',
];
if (app && edge) {
  const diff = CASES.filter((c) => app(c) !== edge(c));
  say(diff.length === 0, 'D2 ★두 벌의 출력이 **완전히 같다**',
    diff.length ? `${diff.length}개 다름: 「${diff[0]}」 앱「${app(diff[0])}」 서버「${edge(diff[0])}」` : `${CASES.length}개 입력 일치`);

  const left = CASES.filter((c) => /[—―–]/.test(app(c)));
  say(left.length === 0, 'D2b 줄표가 **하나도 안 남는다**', left.length ? `남음: ${left.join(' · ')}` : `${CASES.length}개 전부 제거`);

  const emoji = app('아니 ㅡㅡ 진짜로');
  say(emoji.includes('ㅡㅡ'), 'D2c ⚠️「ㅡㅡ」(표정)는 **건드리지 않는다**', `→ 「${emoji}」`);
}

// ── D3·D4 실제로 불리는가 ────────────────────────────────────────────────
const talk = readFileSync(TALK, 'utf8');
// ⚠️★2026-08-27 — 종전엔 `plainDash(answer)` 라는 **문자열**을 찾았다. 손질을 `polish()` 하나로
//   묶는 순간 그 문자열이 사라져 검사가 깨졌다. ★이름이 아니라 **관계**를 봐야 한다:
//   ①손질 함수가 줄표를 거는가 ②**보이는 글 세 갈래**(본문·티키타카 대사·곁다리)가 그 문을 지나는가
//   ③그게 저장보다 앞인가. ★★세 갈래를 다 보는 이유 — 실제로 대사와 곁다리가 **손질 밖**에 있어
//   「먼저 당신의 기본 틀을」이 그대로 나갔다(실호출로 잡았다).
const polishCallsDash = /function polish\([\s\S]{0,900}?plainDash\(/.test(talk);
say(polishCallsDash, 'D3 손질 함수가 줄표를 건다', polishCallsDash ? 'polish() → plainDash()' : 'polish 가 줄표를 안 건다');

const saveAt = talk.indexOf("from('talk_messages').insert({");
const lanes: [string, RegExp][] = [
  ['본문', /answer = polish\(answer\)/],
  ['티키타카 대사', /crossSplit\.lines[\s\S]{0,160}?polish\(/],
  ['곁다리', /banterSplit\.banter[\s\S]{0,160}?polish\(/],
];
const missed = lanes.filter(([, re]) => !re.test(talk)).map(([n]) => n);
say(missed.length === 0, 'D3b ★**보이는 글이 전부** 그 문을 지난다',
  missed.length ? `⚠️빠진 갈래: ${missed.join(' · ')}` : '본문 · 티키타카 대사 · 곁다리');

const callAt = talk.search(/answer = polish\(answer\)/);
say(callAt > 0 && saveAt > 0 && callAt < saveAt, 'D3c 서버가 **저장 전에** 건다',
  callAt < 0 ? '안 부른다' : callAt < saveAt ? '저장보다 앞선다' : '⚠️저장 뒤 — 이력이 오염된다');

const appSrc = readFileSync(APP, 'utf8');
say(/plainDash\(String\(answer/.test(appSrc), 'D4 앱이 말풍선을 만들 때 부른다',
  /plainDash\(String\(answer/.test(appSrc) ? 'splitBubbles 입구' : '옛 대화에 줄표가 남는다');

// ── D5 자기검사 ──────────────────────────────────────────────────────────
{
  const noop = (s: string) => s;
  const caught = CASES.some((c) => noop(c) !== (app ? app(c) : c));
  say(caught, 'D5 ★자기검사 — 아무것도 안 하면 걸린다', caught ? '대조군 확인' : '대조군이 안 맞는다 — 하네스가 헛돈다');
}

console.log(fail === 0 ? '\n✅ 줄표가 화면에 남지 않고, 두 벌의 규칙이 어긋나지 않습니다\n'
  : `\n❌ ${fail}건 — 대화에 「ㅡ」가 보입니다\n`);
process.exit(fail === 0 ? 0 : 1);
