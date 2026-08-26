// scripts/check-classics.ts — **한 학파로 환원하지 않는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"사주는 자평만 보지말고 궁통보감 적천수도 다 봐야해"*
//
// ■ ★실측이 갈라 준 것 — 풀이는 이미 셋 다 보고 있었다. **대화가 아니었다.**
//   `prompts.ts`: 자평진전 4회 · 궁통보감 5회 · 적천수 3회 — R19 가 «단일 학파 환원 금지» 를 못박고,
//     `SAJU_READING_SYSTEM` 이 «격국=자평진전 · 억부=적천수천미 · 조후=궁통보감» 이라고 역할까지 나눠 뒀다.
//   그런데 **대화 지문**(`COACH_SYSTEM` + `TALK_COMMON`)에는
//     자평·궁통·적천수·조후·억부·격국이 **전부 0회**였다.
//   ⇒ 대화는 관법 축이 **하나도 없어서** 모델이 기본값(격국 위주)으로 답하고 있었다.
//   ⚠️`MYEONGRI_RULES` 를 통째로 넣는 건 답이 아니다 — **46,876 토큰**이라 매 턴 비용이 폭증한다.
//     ⇒ **압축한 축**만 넣는다(캐시되는 앞블록이라 비용 영향이 작다).
//
// ■ 검사
//   C1 풀이 지문에 세 고전이 **역할과 함께** 있다
//   C2 ★**대화 지문**에도 세 축이 있다(여기가 비어 있었다)
//   C3 R74(조후 룩업↔충족)가 **SSoT 와 배포본 둘 다**에 있다
//   C4 대화 지문이 «고전 이름을 자랑하지 마라» 를 함께 말한다(용어 과시 방지)
//
// 실행: npm run check:classics
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const DEPLOY = 'supabase/functions/_shared/prompts.ts';
const SSOT = 'interpretation/prompts/myeongri-core.ts';
const TALK = 'supabase/functions/talk/index.ts';

/** 특정 블록 안에서 낱말이 몇 번 나오는가. */
export function countIn(src: string, startMark: string, len: number, word: string): number {
  const i = src.indexOf(startMark);
  if (i < 0) return -1;
  return (src.slice(i, i + len).match(new RegExp(word, 'g')) ?? []).length;
}

const isMain = process.argv[1]?.includes('check-classics');
if (isMain) {
  console.log('\n📚 자평만 보고 있지 않은가\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(44)} ${note}`); };

  const deploy = readFileSync(DEPLOY, 'utf8');
  const ssot = readFileSync(SSOT, 'utf8');
  const talk = readFileSync(TALK, 'utf8');

  // C1 — 풀이 지문
  const trio = ['자평진전', '궁통보감', '적천수'];
  const missP = trio.filter((k) => !deploy.includes(k));
  say(missP.length === 0, 'C1 풀이 지문에 세 고전이 있다',
    missP.length ? `빠짐: ${missP.join(', ')}` : trio.map((k) => `${k} ${(deploy.match(new RegExp(k, 'g')) ?? []).length}`).join(' · '));
  say(/격국=자평진전/.test(deploy) && /억부=적천수/.test(deploy) && /조후=궁통보감/.test(deploy),
    'C1b 세 고전의 **역할**까지 나눠 적혀 있다', '');

  // C2 ★대화 지문 — 여기가 비어 있었다
  const talkCounts = trio.map((k) => countIn(talk, 'TALK_COMMON', 14000, k));
  const talkOk = talkCounts.every((n) => n > 0);
  say(talkOk, 'C2 **대화 지문**에도 세 축이 있다',
    talkOk ? trio.map((k, i) => `${k} ${talkCounts[i]}`).join(' · ') : '★대화가 관법 축 없이 돌고 있습니다(기본값=격국 위주)');
  const axes = ['조후', '억부', '격국'].map((k) => countIn(talk, 'TALK_COMMON', 14000, k));
  say(axes.every((n) => n > 0), 'C2b 세 «축» 이름도 있다', `조후 ${axes[0]} · 억부 ${axes[1]} · 격국 ${axes[2]}`);

  // C3 — R74 가 양쪽에
  say(ssot.includes('R74') && deploy.includes('R74'), 'C3 R74 가 SSoT·배포본 둘 다에 있다',
    `SSoT ${ssot.includes('R74')} · 배포본 ${deploy.includes('R74')}`);

  // C4 — 용어 과시 방지
  say(/고전 이름을 \*\*말로 자랑하지 마라/.test(talk), 'C4 «고전 이름을 자랑하지 마라» 가 있다',
    '축은 속으로 고르고, 회원에게는 결론과 이유만');

  // ⚠️비용 — 대화 지문이 통째로 부풀지 않았는지(압축한 축만 넣기로 했다)
  const i = talk.indexOf('TALK_COMMON');
  const size = /const TALK_COMMON = `([\s\S]*?)`;/.exec(talk.slice(i - 40))?.[1]?.length ?? 0;
  say(size > 0 && size < 20000, '비용 — 대화 지문이 통째로 부풀지 않았다',
    `${size.toLocaleString()}자 (MYEONGRI_RULES 32,780자를 통째로 넣으면 안 된다)`);

  if (bad) { console.log(`\n❌ ${bad}건 — 한 학파로 환원해 답하게 됩니다.\n`); process.exit(1); }
  console.log('\n✅ 풀이도 대화도 세 축을 함께 봅니다\n');
}
