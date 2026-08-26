// scripts/check-dangsin.ts — **«당신» 이 답에 남지 않는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 대화 실물에 "당신" 이 세 번 나왔다.
//
// ■ ★지시로는 세 번 실패했다 — 이건 «지시 대 산출물» 의 문제다
//   지문에 «"당신" 이라고 부르지 마라» 가 **두 군데**(캐시 블록 + 매 턴 꼬리) 살아 있다.
//   그런데 저장된 답변 60건 실측은 **56.7%가 여전히 쓴다**(고치기 전 65.4%).
//   nossem 18/29 · love_seoyun 9/10 — 상담가별로 갈리지만 **아무도 0이 아니다.**
//   ⇒ `splitBubbles` 와 같은 판단: **지시는 어겨도 글의 생김새는 못 어긴다.** 글에서 지운다.
//
// ■ ⚠️노쌤 persona 가 비어 있는 것은 **원인이지만 처방이 아니다**
//   실측: nossem 만 persona 0자(나머지 255~310자)이고 "당신" 도 1위다.
//   하지만 `check:persona` 가 *"노쌤은 비어 있는 게 정답 — Boss 가 직접 주는 자리"* 라고
//   못 박아 두었다. ⇒ **거기를 채워 고치면 안 된다.** 후처리가 옳은 자리다.
//
// ■ ★무엇을 «안» 지우는지도 검사한다
//   「당신과」(실측 8회)는 지우면 **의미가 빈다** — 「당신과 잘 맞는」 → 「잘 맞는」(누구와?).
//   못 지우는 걸 지운 척하지 않는다. 그래서 이 검사는 **남아야 할 것이 남는지도** 본다.
//
// 실행: npm run check:dangsin
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const TALK = 'supabase/functions/talk/index.ts';

/** 소스에서 «당신» 후처리 replace 체인을 꺼내 **그대로 실행 가능한 함수**로 만든다(사본 금지). */
export function stripperFrom(src: string): ((s: string) => string) | null {
  const m = /answer = answer\n((?:\s*\.replace\([^\n]*\n)+\s*\.trim\(\);)/.exec(src);
  if (!m || !/당신/.test(m[1])) return null;
  try {
    // eslint-disable-next-line no-new-func
    return new Function('s', `return s${m[1].replace(/;\s*$/, '')};`) as (s: string) => string;
  } catch { return null; }
}

/** Boss 가 실제로 받은 문장 + 실측 조사 분포에서 뽑은 사례. */
export const MUST_GO = [
  '당신이 일단 신호를 보냈으면, 이제는 상대의 움직임을 봐야 하는 구간이라 답답할 수 있어.',
  '그런데 지금 당신의 흐름을 보면, 이 시간도 과정의 일부야.',
  '명리로 말하면 당신은 겁재가 들어와 있는 때라 자력을 쓰는 시기거든.',
  '당신도 그렇게 느끼셨을 거예요.',
  '당신을 붙잡는 게 있어요.',
  '당신에게 필요한 건 시간이에요.',
];
/** 지우면 의미가 비는 것 — **남아야 한다**. */
export const MUST_STAY = [
  '당신과 잘 맞는 사람은 따로 있어요.',
];

const isMain = process.argv[1]?.includes('check-dangsin');
if (isMain) {
  console.log('\n🙅 «당신» 이 답에 남는가\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(44)} ${note}`); };

  const talk = readFileSync(TALK, 'utf8');
  const strip = stripperFrom(talk);
  say(!!strip, 'G1 소스에서 후처리를 꺼냈다', strip ? '' : '«당신» 후처리가 없습니다 — 지시만으로는 56.7% 가 남습니다');
  if (!strip) { console.log('\n❌ 후처리가 없습니다.\n'); process.exit(1); }

  const left = MUST_GO.filter((t) => strip(t).includes('당신'));
  say(left.length === 0, 'G2 지워야 할 것이 전부 지워진다',
    left.length ? `남음: ${left.map((t) => `「${strip(t)}」`).join(' · ')}` : `${MUST_GO.length}개 통과`);

  const gone = MUST_STAY.filter((t) => !strip(t).includes('당신'));
  say(gone.length === 0, 'G3 지우면 의미가 비는 것은 **남는다**',
    gone.length ? `잘못 지움: ${gone.join(' · ')}` : `${MUST_STAY.length}개 확인 (「당신과」)`);

  // G4 — 지운 뒤 문장이 **깨지지 않는지**: 이중 공백·문두 공백이 없어야 한다
  const messy = MUST_GO.map((t) => strip(t)).filter((x) => / {2,}/.test(x) || /^\s/.test(x) || /\n\s/.test(x));
  say(messy.length === 0, 'G4 지운 자리에 공백 얼룩이 안 남는다',
    messy.length ? messy.map((x) => JSON.stringify(x)).join(' · ') : '');

  // G5 — 저장 **전**인가(이력에 남으면 다음 턴에 모델이 따라 쓴다)
  const iStrip = talk.search(/answer = answer\n\s*\.replace\(\/당신/);
  const iSave = talk.indexOf("from('talk_messages').insert(");
  say(iStrip >= 0 && iStrip < iSave, 'G5 저장 **전**에 지운다',
    iStrip < iSave ? '' : '저장 뒤에 지우면 이력에 남아 모델이 따라 씁니다');

  // 음성 테스트 — 후처리가 없던 시절 문장은 그대로 남아야 한다(검사가 살아 있음을 증명)
  const naive = (s: string) => s;
  const naiveLeft = MUST_GO.filter((t) => naive(t).includes('당신'));
  say(naiveLeft.length === MUST_GO.length, '음성 테스트 — 후처리가 없으면 전부 남는다',
    `${naiveLeft.length}/${MUST_GO.length}`);

  if (bad) { console.log(`\n❌ ${bad}건\n`); process.exit(1); }
  console.log('\n✅ 지울 것은 지우고, 의미가 비는 것은 남깁니다\n');
}
