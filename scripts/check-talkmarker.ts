// scripts/check-talkmarker.ts — **내부 마커가 화면으로 새지 않는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: 답변 끝에 `[[남김:when|9월은 기다` 가 **그대로 보였다.**
//
// ■ ★★원인이 넷이었다 — 그중 하나는 «우리 방어가 만들어낸 것»
//   ① 모델 답이 `max_tokens` 로 **마커 중간에서** 끊긴다 → `]]` 가 없어 파서가 못 뗀다
//   ② ★**잘림 방어가 멀쩡한 마커를 부순다.** `[[남김:when|9월은 기다려]]` 에서
//      «마지막 종결문자» 는 «기**다**» 의 `다` 라, 그 뒤 `려]]` 가 잘려 나간다
//      ⇒ **파손 마커를 우리가 만들어 낸다.** ①의 결과와 글자가 같아 로그 없이는 구분이 안 된다.
//      ★이걸 모르고 «잘린 마커 청소» 를 컷 **앞**에 넣으면 아무 효과가 없다(청소 뒤에 컷이 다시 부순다).
//   ③ 추천 마커 제거에 `g` 가 없어 **첫 개만** 지웠다 — 둘 쓰면 두 번째가 남는다
//   ④ 곁다리는 `$`(맨 끝)에만 맞아, 뒤에 줄이 더 붙으면 못 뗀다
//      ⚠️지문은 남김도 곁다리도 «맨 끝 줄» 에 두라 한다 — 둘 다 나오는 턴엔 하나가 반드시 어긋난다
//
// ■ ★검사 방법 — **소스의 정규식을 그대로 꺼내 돌린다**
//   하네스가 규칙을 베껴 쓰면 진짜 코드가 바뀌어도 초록불이 남는다
//   ([[shared-block-eats-personality]] 의 «같은 규칙의 사본» 함정).
//   ⇒ `talk/index.ts` 에서 `answer.replace(…)` 의 정규식 리터럴을 **순서대로** 뽑아
//     실제 사례를 통과시키고, 본문에 `[[` 가 남는지 본다.
//
// 실행: npm run check:talkmarker
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const TALK = 'supabase/functions/talk/index.ts';
const GLOSS = 'supabase/functions/_shared/contentGloss.ts';
const NOTES = 'supabase/functions/_shared/talkNotes.ts';

/** 소스 문자열에서 `이름.replace(/…/flags` 의 정규식 리터럴들을 **나온 순서대로** 뽑는다. */
export function replaceRegexes(src: string, varName: string): RegExp[] {
  const out: RegExp[] = [];
  const re = new RegExp(String.raw`${varName}\s*\.replace\(\s*/((?:[^/\\\n]|\\.)+)/([gimsuy]*)`, 'g');
  for (const m of src.matchAll(re)) {
    try { out.push(new RegExp(m[1], m[2])); } catch { /* 못 만들면 건너뛴다 */ }
  }
  return out;
}

/** `[[` 로 열린 마커가 남았는지. */
const leaks = (s: string) => s.includes('[[');

// ── 검사에 쓸 사례 — 실제로 겪은 것 + 실측으로 새던 것 ──────────────────────
type Case = { name: string; text: string; truncated: boolean };
export const CASES: Case[] = [
  { name: 'A 마커 중간에서 잘림(Boss 가 본 그것)', text: '9월까지는 무겁습니다.\n[[남김:when|9월은 기다', truncated: true },
  { name: 'B 멀쩡한데 컷이 부순다',              text: '9월까지는 무겁습니다.\n[[남김:when|9월은 기다려]]', truncated: true },
  { name: 'C 추천 마커 둘',                    text: '본문입니다. 그렇습니다.\n\n[[추천:compat]]\n[[추천:wealth]]', truncated: false },
  { name: 'D 곁다리 뒤에 줄이 더 있음',           text: '본문입니다. 그렇습니다.\n[[곁::한서윤]]그러게요\n덧붙임', truncated: false },
  { name: 'E 남김+곁다리가 둘 다 끝에',           text: '본문입니다. 그렇습니다.\n[[남김:when|9월]]\n[[곁::한서윤]]그러게요', truncated: false },
];

const isMain = process.argv[1]?.includes('check-talkmarker');
if (isMain) {
  console.log('\n🏷  내부 마커가 화면으로 새는가\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(44)} ${note}`); };

  const talk = readFileSync(TALK, 'utf8');
  const gloss = readFileSync(GLOSS, 'utf8');
  const notes = readFileSync(NOTES, 'utf8');

  // ── M1 구조: 컷이 마커를 **떼어 놓고** 자르는가 ────────────────────────────
  const cutBlock = /if \(res\.stop_reason === 'max_tokens'\) \{([\s\S]*?)\n      \}/.exec(talk)?.[1] ?? '';
  const protects = /const mk\s*=/.test(cutBlock) && /tail/.test(cutBlock);
  say(protects, 'M1 잘림 컷이 마커를 떼어 놓고 자른다',
    protects ? '' : '★컷이 멀쩡한 마커를 부숩니다 — 이게 이 버그의 진짜 원인이었습니다');

  // ── M2 순서: 잔해 청소가 컷 **뒤**인가 ────────────────────────────────────
  const iCut = talk.indexOf("stop_reason === 'max_tokens'");
  const iDebris = talk.search(/answer\s*=\s*answer\.replace\(\/\\\[\\\[\[\^\\\]\\n\]\*\$/);
  say(iCut >= 0 && iDebris > iCut, 'M2 잔해 청소가 컷 **뒤**에 온다',
    iDebris > iCut ? '' : '앞에 두면 컷이 그 뒤에 새 잔해를 만듭니다(무효)');

  // ── M3 추천 제거에 g 플래그 ───────────────────────────────────────────────
  const recG = /RECOMMEND_MARKER\.source,\s*'g/.test(gloss);
  say(recG, 'M3 추천 마커를 **전부** 지운다(g)', recG ? '' : '첫 개만 지웁니다 — 둘 쓰면 두 번째가 남습니다');

  // ── M4 ★실제 파이프라인 재현 ──────────────────────────────────────────────
  //   소스에서 뽑은 정규식으로 사례를 돌린다(사본을 쓰지 않는다).
  const answerRes = replaceRegexes(talk, 'answer');
  // ★«선언» 이 아니라 **실제 제거 줄**에서 뽑는다 — 선언(NOTE_MARKER)은 갈래까지 요구해 모양이 다르다.
  const noteRe = /text\.replace\(\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/.exec(notes);
  const recRe = /const RECOMMEND_MARKER = \/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/.exec(gloss);
  const banterRe = /const m = \/((?:[^/\\\n]|\\.)+)\/\.exec\(text \?\? ''\)/.exec(talk);
  const ok0 = answerRes.length >= 3 && !!noteRe && !!recRe && !!banterRe;
  say(ok0, 'M4a 소스에서 정규식을 실제로 꺼냈다',
    `answer.replace ${answerRes.length}개 · NOTE ${!!noteRe} · REC ${!!recRe} · 곁 ${!!banterRe}`);

  if (ok0) {
    // 소스에서 꺼낸 조각들로 파이프라인을 구성한다
    const NOTE = new RegExp(noteRe[1], noteRe[2] || 'gi');   // 소스의 제거 정규식 그대로
    const REC = new RegExp(recRe[1], 'gi');
    const BANTER = new RegExp(banterRe[1]);
    // ★컷은 `head.replace(…)` 라 `answer.replace` 목록에 없다 — **컷 블록 안에서 직접** 꺼낸다.
    //   (첫 판에서 이걸 놓쳐 «컷=false» 가 났다. 변수 이름으로 찾으면 이런 데서 샌다.)
    const cutSrc = /\.replace\(\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/.exec(cutBlock);
    const cutRe = cutSrc ? new RegExp(cutSrc[1], cutSrc[2]) : answerRes.find((r) => r.source.includes('요다죠까네야'));
    const debrisRe = answerRes.find((r) => r.source === String.raw`\[\[[^\]\n]*$`);
    const netRe = answerRes.find((r) => /\\\[\\\[\[\^\\\]\\n\]\{0,\d+\}\\\]\\\]/.test(r.source));
    const have = !!cutRe && !!debrisRe && !!netRe;
    say(have, 'M4b 컷·잔해·그물 셋이 모두 있다',
      have ? '' : `컷=${!!cutRe} 잔해=${!!debrisRe} 그물=${!!netRe}`);

    if (have) {
      const run = (text: string, truncated: boolean) => {
        let a = text;
        if (truncated) {
          const mk = /\n?\s*\[\[[\s\S]*$/u.exec(a);
          const head = mk ? a.slice(0, mk.index) : a, tail = mk ? mk[0] : '';
          const c = head.replace(cutRe!, '').trim();
          if (c.length >= 20) a = (c + tail).trim();
        }
        a = a.replace(debrisRe!, '').trimEnd();
        a = a.replace(REC, '');
        a = a.replace(NOTE, '');
        const m = BANTER.exec(a); if (m) a = a.slice(0, m.index);
        a = a.replace(netRe!, '').replace(/\n{3,}/g, '\n\n').trim();
        return a;
      };
      const leaked = CASES.filter((c) => leaks(run(c.text, c.truncated)));
      say(leaked.length === 0, 'M4c 다섯 사례 모두 마커가 안 남는다',
        leaked.length ? `샘: ${leaked.map((c) => c.name).join(' · ')}` : `${CASES.length}개 통과`);

      // ── 음성 테스트: **옛 방식**으로는 새야 한다(안 새면 이 검사가 아무것도 증명 못 한다) ──
      const runOld = (text: string, truncated: boolean) => {
        let a = text;
        if (truncated) { const c = a.replace(cutRe!, '').trim(); if (c.length >= 20) a = c; }
        a = a.replace(new RegExp(recRe[1]), '');   // g 없음(옛것)
        a = a.replace(NOTE, '');
        const m = BANTER.exec(a); if (m) a = a.slice(0, m.index);
        return a.replace(/\n{3,}/g, '\n\n').trim();
      };
      const oldLeaked = CASES.filter((c) => leaks(runOld(c.text, c.truncated)));
      say(oldLeaked.length >= 3, '음성 테스트 — 옛 방식으로는 실제로 샌다',
        `${oldLeaked.length}/${CASES.length} 샘 (3건 미만이면 이 검사를 믿지 마세요)`);
    }
  }

  // ── M5 ★괄호도 **같은 사고**를 당한다 (Boss *"괄호같은것도 제대로 마무리가 안될때가 있어"*) ──
  //   「일주(庚午日**이라)**」 처럼 괄호 안에 종결문자가 있으면 컷이 그 자리에서 끊어
  //   **`(庚午日이라` 처럼 열린 괄호만** 남긴다. 마커를 부순 것과 똑같은 구조다.
  {
    const paren = /for \(const \[o, c\] of \[\['\(', '\)'\]/.test(cutBlock) && /lastIndexOf\(o\)/.test(cutBlock);
    say(paren, 'M5 컷이 **열린 괄호를 남기지 않는다**', paren ? '' : '괄호 정리가 없습니다');
    // ★순서 검사 — 괄호 정리가 «너무 짧으면 원문» 보다 **뒤**여야 한다.
    //   앞에 두면 원문으로 되돌아가면서 **열린 괄호가 되살아난다**(첫 판에서 실제로 그랬다).
    const iShort = cutBlock.indexOf('cut = head;');
    const iParen = cutBlock.indexOf("for (const [o, c] of");
    say(iShort >= 0 && iParen > iShort, 'M5b 괄호 정리가 «되돌리기» 뒤에 온다',
      iParen > iShort ? '' : '앞에 두면 원문으로 되돌아가며 열린 괄호가 되살아납니다');
  }

  if (bad) { console.log(`\n❌ ${bad}건 — 마커가 화면에 뜨고, 다음 턴 이력에 실려 **모델이 따라 씁니다**.\n`); process.exit(1); }
  console.log('\n✅ 마커가 새지 않습니다\n');
}
