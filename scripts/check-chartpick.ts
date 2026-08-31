// scripts/check-chartpick.ts — **어떤 명식을 볼지 묻는가**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"대표명식이 등록되어있는데 사주나 자미두수 보는 선생님들이 인지를 못해.
//   기본적으로 사주를 봐달라 또는 뭘해달라하면 **명식 체크칸이 떠서 어떤 명식을 봐줄까**로
//   시작해야해. 아니면 직접 년월일시를 입력하면 그걸 기준으로 봐줘야하고"*
//
// ■ ★왜 생겼나 — **대표 명식이 실행마다 바뀌고 있었다**
//   `loadRepChart()` 는 저장된 대표 id 가 없으면 **`charts[0]`** 로 떨어진다.
//   Boss 계정은 명식이 **50개**라 목록 순서가 조금만 달라져도 매번 다른 사람을 본다.
//   실측(2026-08-27 · `talk_sessions`): 최근 세션의 `chart_id` 가
//   `2321d92d` · `b68aef72` · `f3deddf5` 로 **제각각**이었다.
//   ⇒ «틀린 사주를 또렷하게 말하는» 것이 제일 나쁘다([[talk-must-name-my-chart]]).
//
// ■ 검사
//   P1 카드가 있고 대화 화면이 **실제로 쓴다**
//   P2 ★**명식이 둘 이상일 때만** 묻는다(하나뿐이면 물을 것이 없다)
//   P3 ★**명식을 보는 상담가**에게만 묻는다(타로·뷰티에게 물으면 잡음이다)
//   P4 ★고른 값을 **서버 chart_id 로 바꿔서** 싣는다(로컬 id 를 그대로 보내면 딴 명식이 나온다)
//   P5 ★직접 입력 길이 살아 있다(Boss: *"직접 년월일시를 입력하면"*)
//   P6 ★`open` 의 deps 에 명식 목록이 있다 — 없으면 목록이 0으로 굳어 **카드가 영영 안 뜬다**
//      (이 저장소에는 react-hooks eslint 가 없어 손으로 맞춰야 한다)
//
// 실행: npm run check:chartpick
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const CARD = 'app/src/components/talk/ChartPickCard.tsx';
const TALK = 'app/src/app/(app)/talk.tsx';

let fail = 0;
const say = (c: boolean, m: string, d = '') => { if (!c) fail++; console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(46)} ${d}`); };
console.log('\n🗂  check:chartpick — 어떤 명식을 볼지 묻는가\n');

let card = '', talk = '';
try { card = readFileSync(CARD, 'utf8'); talk = readFileSync(TALK, 'utf8'); }
catch (e) { console.log(`  ❌ 파일을 못 읽었습니다 — ${(e as Error).message}\n`); process.exit(1); }

// ★★2026-08-31 — 규칙을 **갈아끼웠다**(Boss *"시작할때 어떤 명식을 보시겠어요가 나오는데 이건 빼버려"*).
//
// ■ 종전 P1~P3·P5 는 「대화 시작에 **명식을 묻는 카드**가 뜬다」를 지켰다.
//   그 설계가 없어졌으므로, 그대로 두면 하네스가 **반려된 설계를 빨간불로 강요**한다
//   (이 저장소에서 **일곱 번째**다 · [[harness-goes-blind-on-refactor]]).
// ■ 지키려던 것은 «묻는 카드가 있다» 가 아니라 **«명식을 몰래 바꾸지 않는다»** 였다.
//   그 뜻은 지금도 유효하다 ⇒ 아래 P4(서버 id 로 바꿔 싣는다)와 P7(고르면 그 자리에서 말을 건다)로 남긴다.
//
// P7 — 명식을 고르면 **그 턴이 나간다**(Boss 2026-08-31 *"체크하면 바로 대화카운트 차감하면서 … 물어봐야지"*).
//   고르기만 하고 아무 말도 안 하면 상담가가 «방금 고른 것을 못 본 사람» 처럼 말한다.
{
  const body = (() => {
    const at = talk.indexOf('const pickChart = useCallback(');
    if (at < 0) return '';
    const end = talk.indexOf('\n  }, [', at);
    return end < 0 ? '' : talk.slice(at, end);
  })();
  // ⚠️★**주석을 걷어내고 본다** — 주석 처리한 코드를 «있는 것» 으로 세면 지운 기능이 초록불이 된다
  //   (2026-08-31 이 하네스의 음성 테스트가 실제로 그렇게 헛돌았다).
  const bare = body.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  const ok = /sendRef\.current\?\.\(|\bsend\(/.test(bare);
  say(ok, 'P7 ★명식을 고르면 **그 자리에서 말을 건다**',
    ok ? '`sendRef` 로 한 턴 보낸다' : '고르기만 하고 말이 없다 — 상담가가 방금 고른 것을 못 본 사람처럼 말한다');
}

// P4 — 고른 값이 서버 id 로 바뀌는가
{
  // ★본문을 «글자 수 창» 으로 자르지 않는다 — 주석이 길어지면 창을 넘겨 **아무것도 못 찾고**
  //   조용히 빨간불이 된다(2026-08-31 실제로 그렇게 깨졌다: 900자 창을 넘겼다).
  //   ⇒ 시작 위치를 잡고 **닫는 자리(`\n  }, [`)까지** 읽는다. 길이에 무관하다.
  const body = (() => {
    const at = talk.indexOf('const pickChart = useCallback(');
    if (at < 0) return '';
    const end = talk.indexOf('\n  }, [', at);
    return end < 0 ? '' : talk.slice(at, end);
  })();
  const ok = /ensureServerChartIdForSaved/.test(body) && /setChartId\(/.test(body);
  say(ok, 'P4 ★고른 명식을 **서버 id 로** 바꿔 싣는다',
    ok ? '`ensureServerChartIdForSaved` → `setChartId`' : '로컬 id 를 그대로 보내면 딴 명식이 나온다');
}

// P5 — 직접 입력 길
// ★2026-08-31 — 카드를 대화에서 뺐으므로 **카드 안의 「직접 입력」** 은 판정 대상이 아니다.
//   대신 «명식을 새로 만드는 길이 대화 화면에 살아 있는가» 를 본다 — 그게 원래 지키려던 것이다.
//   (생년월일을 말하면 뜨는 `birthCard` 가 그 길이다.)
{
  const ok = /birthCard/.test(talk) && /\/register/.test(talk);
  say(ok, 'P5 ★명식을 새로 만드는 길이 대화에 살아 있다',
    ok ? '`birthCard` + `/register`' : '대화에서 명식을 만들 길이 사라졌다 — 명식 없는 사람이 막힌다');
}

// P6 — deps
{
  const deps = /\}, \[t, dateKey, myName, bumpChats, myAge([^\]]*)\]\);/.exec(talk)?.[1] ?? '';
  const ok = /myCharts/.test(deps) && /pickedLocal/.test(deps);
  say(ok, 'P6 ★`open` 의 deps 에 명식 목록이 있다',
    ok ? `deps: 「…myAge${deps.slice(0, 40)}」` : '없으면 목록이 0으로 굳어 카드가 영영 안 뜬다');
}

console.log(fail === 0 ? '\n✅ 명식을 고르면 그 턴이 나가고 · 서버 id 로 실리고 · 새로 만들 길이 살아 있습니다\n' : `\n❌ ${fail}건\n`);
process.exit(fail === 0 ? 0 : 1);
