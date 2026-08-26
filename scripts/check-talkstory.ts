// scripts/check-talkstory.ts — **«그림» 을 묻는데 «라벨» 로 답하지 않는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"어떤 배우자랑 결혼할꺼 같아? 라고 물어보면 단답으로 이런여자가 아니고
//   스토리 텔링 식으로 여러가지 형용사를 섞어서 설명해줘야해"*
//
// ■ ★★단답의 원인은 **셋**이었다 — 하나만 고치면 여전히 단답이다
//   ① 지문: *"짧게 답할 수 있으면 한 덩어리로 끝내라. 그게 대부분이다"*
//   ② 갈림길: `isDeep()` 정규식에 「어떤 **점**」만 있어 **「어떤 배우자」가 안 걸렸다**
//      ⇒ Boss 가 든 바로 그 질문이 **저가 모델**로 갔다. 지문을 아무리 고쳐도 안 낫는 자리였다.
//   ③ 상한: `max_out_tok = 380`(≈한국어 250자). 다섯 마디 서사가 **물리적으로 안 들어간다.**
//      ⇒ 좋은 모델을 붙여 놓고 중간에서 잘라 버렸다.
//   ★[[talk-must-name-my-chart]] 와 같은 모양이다 — «원인 둘을 하나만 고치면 틀린 걸 또렷하게 말한다».
//
// ■ 이 검사가 보는 것
//   S1 지문에 **서사 규칙**이 있다(그리고 「짧게 끝내라」가 그 위를 덮지 않는다)
//   S2 ★**실제로 판정해 본다** — 소스에서 `isDeep` 의 조건을 꺼내 Boss 의 예시 질문을 돌린다.
//      «정규식에 낱말이 있나» 가 아니라 **«그 질문이 깊은 것으로 갈리나»** 를 본다.
//   S3 깊은 물음의 출력 상한이 사실 확인용보다 **실제로 크다**
//
// 실행: npm run check:talkstory
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const TALK = 'supabase/functions/talk/index.ts';

/**
 * 소스의 `isDeep` 본문을 그대로 꺼내 **실행 가능한 판정기**로 만든다.
 * ★사본을 만들지 않는다 — 하네스가 규칙을 베껴 쓰면 진짜 코드가 바뀌어도 초록불이 유지된다
 *   ([[shared-block-eats-personality]] 의 «같은 규칙의 사본» 함정).
 */
export function isDeepFrom(src: string): (q: string) => boolean {
  const m = /function isDeep\(q: string\): boolean \{([\s\S]*?)\n\}/.exec(src);
  if (!m) throw new Error('isDeep 을 소스에서 못 찾았습니다');
  const body = m[1].replace(/\/\/[^\n]*/g, '');            // 주석만 걷어낸다(정규식은 그대로)
  // eslint-disable-next-line no-new-func
  return new Function('q', body) as (q: string) => boolean;
}

/**
 * 깊은 물음일 때 **실제로 쓰이는 출력 상한**을 구한다.
 *
 * ⚠️★이름이 아니라 **식**으로 판정한다([[harness-judge-expression-not-name]]).
 *   종전엔 `const DEEP_MAX_OUT_TOK = (\d+)` 를 찾았다. 그런데 그 상수는
 *   **DB(`consultants.deep_max_out_tok`)로 옮겨졌고** 소스에는 폴백만 남았다 —
 *   이름이 사라지자 하네스가 «상한이 없다» 며 **옛 판단을 강제**했다
 *   ([[harness-can-enforce-wrong-rule]] 가 말하는 바로 그 재발).
 *
 *   ⇒ 이제 `const maxOut = …` **식을 통째로 꺼내 실행**한다.
 *     정본이 DB든 상수든, **깊은 턴에 몇이 나오는지**만 본다.
 *
 * @param src   Edge 함수 소스
 * @param row   가짜 `consultants` 행(비우면 «DB 값이 없는» 최악의 경우 = 폴백 경로)
 * @returns 깊은 턴의 상한. 식을 못 찾거나 못 돌리면 `null`
 */
export function deepCap(src: string, row: Record<string, unknown> = {}): number | null {
  const m = /const maxOut\s*=\s*([\s\S]*?);\n/.exec(src);
  if (!m) return null;
  // 소스에 남은 폴백 상수들을 같이 실어 준다(이름이 무엇이든 숫자 상수는 다 넣는다)
  const consts = [...src.matchAll(/const ([A-Z][A-Z0-9_]*)\s*=\s*(\d+);/g)]
    .map(([, k, v]) => `const ${k} = ${v};`).join('\n');
  try {
    // eslint-disable-next-line no-new-func
    const f = new Function('c', 'deep', `${consts}\nconst maxOut = ${m[1]};\nreturn maxOut;`);
    const v = f(row, true);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch { return null; }
}

// ── 자기 검사(음성 테스트) ────────────────────────────────────────────────
function selftest(): boolean {
  const fake = `function isDeep(q: string): boolean {\n  if (q.length >= 60) return true;\n  return /왜/.test(q);\n}`;
  const f = isDeepFrom(fake);
  const ok = f('왜 그래요?') === true && f('맞아요?') === false
    // ★음성 테스트 셋 — 하나라도 통과하면 하네스가 거짓 초록불이다
    //   ① DB 값이 있으면 그것이 이긴다  ② 없으면 폴백  ③ 옛 «고정 380» 소스는 반드시 낮게 잡힌다
    && deepCap('const FB = 1100;\nconst maxOut = deep ? (c.deep_max_out_tok ?? FB) : 380;\n', { deep_max_out_tok: 1500 }) === 1500
    && deepCap('const FB = 1100;\nconst maxOut = deep ? (c.deep_max_out_tok ?? FB) : 380;\n') === 1100
    && deepCap('const maxOut = c.max_out_tok ?? 380;\n') === 380          // ← 옛 소스(상한 안 갈림)
    && deepCap('상한이라는 게 아예 없다') === null;
  console.log(`   ${ok ? '✅' : '❌'} 자기검사 — 가짜 판정기가 「왜」만 깊게 보고, 상한을 읽는다`);
  return ok;
}

// ★그림을 요구하는 물음 — 전부 **깊은 것**으로 갈려야 한다
const MUST_BE_DEEP = [
  '나는 어떤 배우자랑 결혼할꺼 같아?',   // ★Boss 가 든 바로 그 문장
  '내 인연은 어떤 사람이야?',
  '나는 어떤 사람이야?',
  '나한테 맞는 일은 뭐야?',
  '누구랑 잘 맞아?',
  '내 성격 좀 봐줘',
  '어떤 스타일 만나?',
];
// ★사실 하나를 묻는 물음 — 이건 **얕아야** 한다(전부 깊어지면 비용만 배로 든다)
const MUST_BE_SHALLOW = [
  '맞아요?',
  '오늘 운세 봐줘',
  '몇 살이에요?',
  '이름이 뭐예요?',
];

const isMain = process.argv[1]?.includes('check-talkstory');
if (isMain) {
  console.log('\n📖 «그림» 을 묻는데 «라벨» 로 답하지 않는가\n');
  let bad = 0;
  if (!selftest()) { console.log('\n❌ 하네스 자신이 고장났습니다\n'); process.exit(1); }
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(44)} ${note}`); };

  const src = readFileSync(TALK, 'utf8');

  // ── S1 지문 ──────────────────────────────────────────────────────────────
  const hasStory = /«그림» 을 묻거든/.test(src) && /장면/.test(src);
  say(hasStory, 'S1 지문에 서사 규칙이 있다', hasStory ? '' : '「그림을 묻거든 장면을」 규칙이 없습니다');
  // ★그 위를 덮는 옛 문장이 남아 있지 않은지 — 이게 원인 ①이었다
  const oldShort = /짧게 답할 수 있으면 \*\*한 덩어리로 끝내라\.\*\* 그게 대부분이다/.test(src);
  say(!oldShort, 'S1b 「그게 대부분이다」가 그 위를 안 덮는다', oldShort ? '옛 문장이 남아 서사 규칙을 누릅니다' : '');

  // ── S2 ★실제로 판정해 본다 ───────────────────────────────────────────────
  const isDeep = isDeepFrom(src);
  const missDeep = MUST_BE_DEEP.filter((q) => !isDeep(q));
  const missShallow = MUST_BE_SHALLOW.filter((q) => isDeep(q));
  say(missDeep.length === 0, 'S2 그림을 요구하는 물음이 깊게 갈린다',
    missDeep.length ? `얕게 갈림: ${missDeep.map((q) => `「${q}」`).join(' ')}` : `${MUST_BE_DEEP.length}개 통과`);
  say(missShallow.length === 0, 'S2b 사실 확인은 얕게 남는다',
    missShallow.length ? `깊게 갈림(비용): ${missShallow.map((q) => `「${q}」`).join(' ')}` : `${MUST_BE_SHALLOW.length}개 통과`);

  // ── S3 상한 ──────────────────────────────────────────────────────────────
  // ★DB 값이 **비었을 때**(= 최악의 경우)로 잰다. 상담가 한 명이라도 값이 없으면 그 경로를 탄다
  const cap = deepCap(src);
  const capDb = deepCap(src, { deep_max_out_tok: 1500 });
  const wired = /max_tokens:\s*maxOut/.test(src) && /const maxOut\s*=\s*deep\s*\?/.test(src);
  say(cap !== null && cap >= 900, 'S3 깊은 물음의 출력 상한이 넉넉하다',
    cap === null ? '`const maxOut = …` 식을 못 읽었습니다'
      : `${cap} 토큰 ≈ 한국어 ${Math.round(cap * 0.68)}자 (DB 값이 없을 때)`);
  say(capDb === 1500, 'S3c 상한의 **정본은 DB** 다',
    capDb === 1500 ? 'consultants.deep_max_out_tok 이 폴백을 이긴다(배포 없이 조일 수 있다)'
      : `DB 값 1500 을 넣었는데 ${capDb} 가 나옵니다 — 코드가 DB 를 안 봅니다`);
  say(wired, 'S3b 그 상한이 **실제로 요청에 쓰인다**',
    wired ? '' : '상한을 정해 놓고 `max_tokens` 에 안 넘기고 있습니다');

  // ── S4 ★★thinking 이 답을 잡아먹지 않는가 (2026-08-26 실측 — **진짜 원인이었다**) ──
  //   Opus 5 는 adaptive thinking 이 기본이라 `max_tokens` 를 **thinking 과 답이 나눠 쓴다**.
  //   실측: `out_tok = 1100`(상한 정확히)인데 화면 글자는 **136자**였다 — ~970 토큰을 thinking 이 먹었다.
  //   그래서 「먼저 끌리는 쪽…」 까지만 말하고 끊겼고, 어떤 턴은 **빈 답**이 나왔다(text 블록이 아예 없다).
  //   ⇒ 끈 뒤 같은 질문: **764 토큰 · 614자**. 상한에도 안 닿는다. **더 싸고 5배 길다.**
  {
    const off = /thinking:\s*\{\s*type:\s*'disabled'\s*\}/.test(src);
    say(off, 'S4 대화에서 thinking 을 끈다',
      off ? '★안 끄면 상한을 thinking 이 먹어 답이 «하다가 만다»' : '★`out_tok`은 상한인데 글자는 몇 줄뿐인 상태가 됩니다');
  }

  if (bad) { console.log(`\n❌ ${bad}건 — 이 중 하나만 남아도 **여전히 단답**이 나옵니다.\n`); process.exit(1); }
  console.log('\n✅ 지문·갈림길·상한 셋이 모두 서사를 허용합니다\n');
}
