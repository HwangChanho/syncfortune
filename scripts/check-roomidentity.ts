// scripts/check-roomidentity.ts — 방의 정체는 **세션**이지 «상담가» 가 아니다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27:
//   *"기존 채팅이 활성화된 상태에서 인원을 초대하면 방은 새로 만들어지는데
//     기존 내용이 남아있고 모든 채팅방이 동기화되는 버그가 있어"*
//   *"다인방이 제대로 동작 안하고있어"*
//
// ■ ★두 증상의 뿌리는 **하나**였다
//   `sessRef.current[cur.id]` — 방을 담는 열쇠가 **상담가 id** 였다.
//   ⇒ 「노쌤과 1:1」 방과 「노쌤+한서윤」 방이 **같은 칸**을 쓴다.
//     초대해서 새 세션을 만들어도 그 칸에 덮어쓰므로, 1:1 로 돌아가면 그룹 세션을 읽는다.
//     「기존 내용이 남는다」 · 「모든 방이 동기화된다」 는 **같은 원인의 두 얼굴**이다.
//
// ■ ★거슬러 올라가면 **데이터가 원인을 제공했다**
//   목록 뷰(`talk_session_list`)가 `guest_ids` 를 안 줬다 → 화면은 «1:1 인지 다인방인지» 를 몰랐다
//   → `onOpen(consultantId)` 로 **세션 id 를 버렸다**. 마이그레이션 0048 이 그 구멍을 메웠다.
//   ⇒ 교훈: **화면이 틀린 열쇠를 고른다면, 먼저 «데이터가 옳은 열쇠를 줬는가» 를 본다.**
//
// ■ 재는 것
//   R1  화면이 세션으로 방을 든다(`sessRef[consultantId]` 같은 상담가-열쇠가 없다)
//   R2  목록이 **세션 id 를 올려 보낸다**(`onOpen` 이 상담가 문자열만 넘기지 않는다)
//   R3  목록 질의가 `guest_ids` 를 읽는다(안 읽으면 다인방을 구분할 수 없다)
//   R4  ★초대하면 **방을 갈아탄다**(화면을 안 비우면 «새 방인데 옛 대화» 가 남는다)
//   R5  `loadThread`·`deleteThread` 가 **세션 id 를 받는다**(그래야 그 방만 열고 그 방만 지운다)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
/** ★주석을 걷는다 — 안 걷으면 «내가 사고를 설명해 둔 문장» 을 코드로 읽는다(08-27 에만 네 번 당했다). */
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let fail = 0;
const say = (c: boolean, m: string, d = '') => {
  if (!c) fail++;
  console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(46)} ${d}`);
};

console.log('\n🚪 check:roomidentity — 방은 «세션» 이다\n');

const talk = strip(read('app/src/app/(app)/talk.tsx') ?? '');
const list = strip(read('app/src/components/talk/ChatList.tsx') ?? '');
const live = strip(read('app/src/lib/talk/liveTalk.ts') ?? '');

// ── R1 상담가를 열쇠로 쓰는 방 저장소가 없는가 ────────────────────────────
{
  // 이름이 아니라 **모양**으로 본다: `X.current[<무엇>.id] = <세션>` 꼴의 상담가-열쇠
  const bad = [...talk.matchAll(/(\w+)\.current\[\s*(?:cur|c)\.id\s*\]/g)].map((m) => m[0]);
  say(bad.length === 0, 'R1 상담가를 열쇠로 방을 담지 않는다',
    bad.length ? `${bad.length}곳: ${[...new Set(bad)].join(' · ')} — 1:1 방과 다인방이 **같은 칸**을 쓴다`
      : '세션 하나(curSid)만 든다');
}

// ── R2 목록이 세션을 올려 보내는가 ────────────────────────────────────────
{
  const sig = /onOpen:\s*\(([^)]*)\)\s*=>/.exec(list)?.[1] ?? '';
  const passesRoom = /sessionId/.test(sig);
  say(passesRoom, 'R2 목록이 **세션 id 를 올려 보낸다**',
    passesRoom ? `onOpen(${sig.trim()})`
      : `onOpen(${sig.trim() || '?'}) — 상담가만 넘기면 어느 방인지 알 수 없다`);
}

// ── R3 목록 질의가 guest_ids 를 읽는가 ────────────────────────────────────
{
  const q = /talk_session_list'?\)?[\s\S]{0,200}?\.select\((['"`])([^'"`]+)\1/.exec(list)?.[2] ?? '';
  const has = /guest_ids/.test(q);
  say(has, 'R3 목록 질의가 guest_ids 를 읽는다',
    has ? '다인방을 구분할 수 있다' : `select(${q.slice(0, 60)}…) — 이게 없어서 화면이 틀린 열쇠를 골랐다`);
}

// ── R4 ★초대하면 방을 갈아타는가 ──────────────────────────────────────────
{
  const body = /onInvite=\{async \(ids\) => \{([\s\S]*?)\n\s*\}\}/.exec(talk)?.[1] ?? '';
  // 세션만 바꾸고 끝내면 «새 방인데 옛 대화» 가 남는다 — 방 여는 함수를 다시 타야 한다
  const switches = /open\(\s*cur\s*,/.test(body);
  say(switches && !!body, 'R4 초대하면 **방을 갈아탄다**',
    switches ? 'open(cur, {sessionId, guestIds}) — 화면도 함께 바뀐다'
      : '세션만 바꾸면 화면에 **직전 1:1 대화가 그대로 남는다**');
}

// ── R5 세션으로 열고 세션으로 지우는가 ────────────────────────────────────
{
  const loadSig = /export async function loadThread\(([^)]*)\)/.exec(live)?.[1] ?? '';
  const delSig = /export async function deleteThread\(([^)]*)\)/.exec(live)?.[1] ?? '';
  const loadOk = /sessionId/.test(loadSig);
  const delOk = /sessionId/.test(delSig);
  say(loadOk, 'R5 loadThread 가 세션 id 를 받는다',
    loadOk ? '' : '상담가만 받으면 다인방을 눌러도 **1:1 방이 열린다**');
  say(delOk, 'R5b deleteThread 가 세션 id 를 받는다',
    delOk ? '' : '상담가만 받으면 다인방을 나가려는데 **1:1 방이 지워진다**');
}

// ── 자기검사(음성 테스트) — 옛 소스를 넣으면 **반드시** 걸려야 한다 ──────────
{
  const oldTalk = `const sessRef = useRef({}); sessRef.current[c.id] = th.sessionId;`;
  const caught = [...strip(oldTalk).matchAll(/(\w+)\.current\[\s*(?:cur|c)\.id\s*\]/g)].length > 0;
  const oldList = `onOpen: (consultantId: string) => void;`;
  const sig = /onOpen:\s*\(([^)]*)\)\s*=>/.exec(oldList)?.[1] ?? '';
  const caught2 = !/sessionId/.test(sig);
  say(caught && caught2, '자기검사 — 옛 구조를 넣으면 잡아낸다',
    caught && caught2 ? '대조군 2개 통과' : `R1 잡음:${caught} R2 잡음:${caught2}`);
}

console.log(fail === 0 ? '\n✅ 방은 세션으로 식별됩니다 — 1:1 과 다인방이 안 섞입니다\n'
  : `\n❌ ${fail}건 — 방이 섞일 수 있습니다\n`);
process.exit(fail === 0 ? 0 : 1);
