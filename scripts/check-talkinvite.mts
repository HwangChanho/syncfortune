/**
 * scripts/check-talkinvite.mts — **「[[초대::이름]]」이 화면에 새지 않는가** (`check:talkinvite`)
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-28 *"노쎔한테 자미두수를 물어보면 최자미를 초대해서 물어볼까? 이런식으로"*
 *
 * ■ ★왜 하네스인가 — 마커는 **네 번 새 봤다**
 *   추천은 `g` 플래그가 없어 첫 개만 지웠고, 곁다리는 `$`(맨 끝)에만 맞아 뒤에 줄이 붙으면 못 뗐다.
 *   ⇒ 새 마커를 들일 때마다 **같은 실수를 반복**했다. 이번엔 만들면서 같이 잠근다.
 *
 * ■ ★★판정은 «지문에 그렇게 적혀 있나» 가 아니라 **함수를 꺼내 돌려서** 한다
 *   ([[harness-judge-expression-not-name]] · `check:dash` D2 와 같은 방식).
 *   지시문 검사는 산출물 검사가 아니다([[shared-block-eats-personality]]).
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';   // ★타입 표기를 **손으로 지우지 않는다** — 지우다 두 번 틀렸다. 컴파일러에 맡긴다.

const SRC = 'supabase/functions/talk/index.ts';
const src = readFileSync(SRC, 'utf8');
let fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  console.log(`  ${cond ? '✅' : '❌'} ${name}${extra && !cond ? `\n      ${extra}` : ''}`);
  if (!cond) fail++;
};

// ── ① 함수를 **원문에서 꺼내** 실제로 돌린다 ──────────────────────────────
const mRe = /const INVITE_MARKER = ([^\n]+);/.exec(src);
const fStart = src.indexOf('function splitInvite(');
if (!mRe || fStart < 0) {
  console.log('❌ check:talkinvite — `INVITE_MARKER` 또는 `splitInvite` 를 못 찾았다(이름이 바뀌었나?)');
  process.exit(1);
}
// ⚠️★★본문의 여는 `{` 는 **줄바꿈이 뒤따르는 것**이다.
//   반환 타입 `: { body: string; ... }` 안에도 `{` 가 있어서, 그냥 첫 `{` 를 잡으면
//   함수가 통째로 잘린다 — `check:crosstalk` 가 정확히 이렇게 깨졌고, 이 하네스도
//   **같은 실수를 두 번** 했다(타입을 정규식으로 걷어내려다 또 걸렸다).
const bodyStart = (() => {
  for (let k = src.indexOf(')', fStart); k < src.length; k++) {
    if (src[k] === '{' && /^[ \t]*\r?\n/.test(src.slice(k + 1, k + 4))) return k;
  }
  return -1;
})();
if (bodyStart < 0) { console.log('❌ splitInvite 본문 시작을 못 찾았다'); process.exit(1); }
let d = 0, end = bodyStart;
for (let k = bodyStart; k < src.length; k++) {
  if (src[k] === '{') d++;
  else if (src[k] === '}') { d--; if (d === 0) { end = k; break; } }
}
// ★TypeScript 를 **컴파일러로** JS 로 바꾼다 — 정규식으로 타입을 지우려다 두 번 깨졌다
//   (①반환 타입의 `{` 를 본문으로 오인 ②본문 안 `let name: string` 이 또 걸림).
const tsSrc = `function splitInvite(text: string, known: string[])${src.slice(bodyStart, end + 1)}`;
const jsSrc = ts.transpileModule(tsSrc, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
const splitInvite = new Function('INVITE_MARKER', `${jsSrc}; return splitInvite;`)(
  new RegExp(mRe[1].replace(/^\/|\/g$/g, ''), 'g'),
) as (t: string, k: string[]) => { body: string; name?: string };

const KNOWN = ['최자미', '노쌤', '한서윤'];
type R = { body: string; name?: string };

// ── ② 정상 동작 ────────────────────────────────────────────────────────
{
  const r: R = splitInvite('자미두수는 제 자리가 아니에요.\n[[초대::최자미]]', KNOWN);
  ok('이름을 뽑는다', r.name === '최자미', `받은 값: ${JSON.stringify(r)}`);
  ok('본문에서 마커를 뗀다', !r.body.includes('[['), `본문: ${r.body}`);
}
// ★«님» 을 붙여 부르는 일이 잦다
{
  const r: R = splitInvite('[[초대::최자미 님]]', KNOWN);
  ok('«님» 을 붙여도 맞춘다', r.name === '최자미');
}
// ── ③ 음성 테스트 — 여기가 본체다 ───────────────────────────────────────
{
  const r: R = splitInvite('[[초대::없는사람]]', KNOWN);
  ok('명단에 없는 이름은 **버린다**', r.name === undefined, `받은 값: ${JSON.stringify(r)}`);
  ok('버려도 **본문에서는 지운다**(대괄호가 화면에 뜨면 안 된다)', !r.body.includes('['), `본문: ${r.body}`);
}
{
  const r: R = splitInvite('[[초대::최자미]] 그리고 [[초대::노쌤]]', KNOWN);
  ok('둘 이상이면 **첫 번째만**', r.name === '최자미');
  ok('둘 다 본문에서 지운다(g 플래그 · 추천이 이걸로 샜다)', !r.body.includes('['), `본문: ${r.body}`);
}
{
  // ⚠️곁다리가 `$` 에만 맞아 새던 그 형태 — 마커 **뒤에 줄이 더 붙는** 경우
  const r: R = splitInvite('한 마디 거들게요.\n[[초대::노쌤]]\n그리고 덧붙이면요.', KNOWN);
  ok('마커 **뒤에 글이 더 있어도** 뗀다', !r.body.includes('[') && r.name === '노쌤', `본문: ${r.body}`);
}
{
  const r: R = splitInvite('마커가 아예 없는 보통 답이에요.', KNOWN);
  ok('마커가 없으면 아무 일도 안 한다', r.name === undefined && r.body.includes('보통 답'));
}
{
  // ★`matchAll` 의 `lastIndex` 함정 — 앞에서 한 번 돌린 뒤 다시 불러도 같아야 한다
  splitInvite('[[초대::노쌤]]', KNOWN);
  const r: R = splitInvite('[[초대::최자미]]', KNOWN);
  ok('연속 호출에도 흔들리지 않는다(lastIndex 초기화)', r.name === '최자미', `받은 값: ${JSON.stringify(r)}`);
}

// ── ④ 배선 — 응답에 실리고, 이미 방에 있는 사람은 빠지는가 ────────────────
ok('응답에 `invite` 를 싣는다', /return json\(\{[^)]*\binvite\b/.test(src));
ok('자기 자신과 **방에 있는 사람**을 뺀 목록으로 부른다',
  /invitable[\s\S]{0,220}?roomMates\.includes/.test(src));
ok('지문이 마커 형식을 알려 준다', src.includes('[[초대::이름]]'));

console.log(fail
  ? `❌ check:talkinvite — ${fail}건`
  : '✅ check:talkinvite — 초대 마커가 새지 않고, 명단 밖 이름은 버린다');
process.exit(fail ? 1 : 0);
