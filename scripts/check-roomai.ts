// scripts/check-roomai.ts — 사람 방의 **사진 공유**와 **@ AI 지목**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"실제 사람이랑 대화할때는 사진공유 ai 선생님 지목 @ 이걸로"*
//
// ■ ⚠️★여기서 제일 무서운 것은 **과금**이다
//   `@노쌤` 한 번이 LLM 한 턴이다. «누가 내는가» 가 어긋나면 남의 운으로 AI 를 부를 수 있다.
//   ⇒ 호출은 반드시 **부른 사람의 세션**(`askLive`)으로 가야 한다 — 그 안에서 Edge 가
//     `uid` 기준으로 무료 한도·차감을 판정한다.
//
// ■ 검사
//   R1 사진: 업로드 함수가 있고 **난수 이름**을 쓴다(공개 버킷이라 추측 가능하면 남이 본다)
//   R2 사진: 2MB 상한이 있다
//   R3 사진: ⚠️모바일에는 **버튼을 안 그린다**(라이브러리가 없다 — 회색 버튼은 «내 잘못» 으로 읽힌다)
//   R4 @: `askLive` 를 **같은 sessionId** 로 부른다(새 경로를 만들지 않는다 = 과금이 한 갈래)
//   R5 @: ★한 턴에 **한 명만** 부른다(둘이면 두 번 과금된다)
//   R6 ★행→화면 변환이 **한 곳**이다(불러오기와 realtime 이 갈리면 새로고침 전후가 달라 보인다)
//   R7 서버: 세션 **참여자**도 허용한다(종전엔 owner 만이라 상대가 @ 를 부르면 403)
//
// 실행: npm run check:roomai
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const LIB = 'app/src/lib/talk/userRoom.ts';
const VIEW = 'app/src/components/talk/UserRoomView.tsx';
const EDGE = 'supabase/functions/talk/index.ts';

let fail = 0;
const say = (c: boolean, m: string, d = '') => { if (!c) fail++; console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(46)} ${d}`); };
console.log('\n🖼  check:roomai — 사람 방의 사진·@ 선생님\n');

let lib = '', view = '', edge = '';
try { lib = readFileSync(LIB, 'utf8'); view = readFileSync(VIEW, 'utf8'); edge = readFileSync(EDGE, 'utf8'); }
catch (e) { console.log(`  ❌ 파일을 못 읽었습니다 — ${(e as Error).message}\n`); process.exit(1); }

// R1·R2 — 사진
{
  const has = /export async function uploadRoomPhoto/.test(lib);
  const rnd = /randomUUID|Math\.random/.test(lib);
  say(has && rnd, 'R1 사진 업로드 · **난수 이름**', has ? (rnd ? '공개 버킷이라 추측 불가해야 한다' : '순번이면 남의 사진을 세어 볼 수 있다') : '업로드 함수가 없다');
  const cap = /2 \* 1024 \* 1024/.test(lib);
  say(cap, 'R2 2MB 상한', cap ? '' : '상한이 없으면 데이터·저장소가 샌다');
}

// R3 — 모바일에는 안 그린다
{
  const guarded = /Platform\.OS === 'web' \? \([\s\S]{0,220}?pickPhoto/.test(view);
  say(guarded, 'R3 ⚠️모바일에는 버튼을 **안 그린다**', guarded ? '' : '회색 버튼만 두면 사용자는 자기 잘못인 줄 안다');
}

// R4·R5 — @ 호출
{
  const body = /const callTeacher = async \(([\s\S]{0,1400}?)\n  \};/.exec(view)?.[1] ?? '';
  const same = /askLive\(\s*hit\.id\s*,\s*text\s*,\s*sessionId/.test(body);
  say(same, 'R4 @ 는 **같은 세션**으로 `askLive` 를 부른다',
    same ? '과금이 한 갈래로 모인다' : '새 경로를 만들면 «누가 내는가» 가 갈린다');
  const one = /\.find\(/.test(body) && !/\.filter\([^)]*\)\.map\(/.test(body);
  say(one, 'R5 ★한 턴에 **한 명만** 부른다', one ? '`find` — 첫 한 명' : '여럿이면 두 번 과금된다');
}

// R6 — 변환 단일 출처
{
  const one = /function toMsg\(/.test(lib);
  const dup = (lib.match(/role: m\.role === 'system'/g) ?? []).length;
  say(one && dup <= 1, 'R6 ★행→화면 변환이 **한 곳**이다',
    one ? (dup <= 1 ? '`toMsg`' : `사본 ${dup}곳 — 새로고침 전후가 달라 보인다`) : '변환이 흩어져 있다');
}

// R7 — 서버가 참여자를 허용
{
  const ok = /talk_members[\s\S]{0,200}?eq\('user_id', uid\)/.test(edge)
    && /if \(!mem\) return json\(\{ error: 'forbidden' \}, 403\)/.test(edge);
  say(ok, 'R7 서버가 **참여자**도 허용한다',
    ok ? '`talk_members` 로 판정 — 남의 세션은 여전히 403' : 'owner 만 통과하면 상대가 @ 를 부를 때 403');
}

console.log(fail === 0 ? '\n✅ 사진과 @ 선생님이 이어져 있고, 과금이 한 갈래입니다\n' : `\n❌ ${fail}건\n`);
process.exit(fail === 0 ? 0 : 1);
