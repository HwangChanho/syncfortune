/**
 * scripts/check-grouptalk.ts: **다인 대화방**이 1:1 방을 잡아먹지 않는가
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-25 *"노쎔이랑 대화중에 다른 사람을 초대할수 있어야해 그러면 채팅방이
 *   새로 만들어지고 카카오톡처럼 노쎔, 한서윤 이런식으로 보이고 나 포함 총 인원수도 떠야해"*.
 *
 * ■ ★이 하네스가 지키는 **불변식** (이름이 아니라 성질로 적는다)
 *   ①다인방도 `consultant_id` 를 그대로 갖는다 ⇒ **1:1 조회는 `guest_ids` 가 빈 것만** 봐야 한다.
 *     안 그러면 «노쌤과 단둘이» 방을 열었는데 «노쌤, 한서윤» 방이 열린다.
 *   ②그 짝으로, **그룹 조회는 안 빈 것만** 봐야 한다.
 *   ③한 턴에 답하는 사람은 **하나**다(둘이 답하면 호출도 운도 인원수만큼 나간다).
 *   ④인원수는 **나를 포함**한다(Boss 가 그렇게 말했다).
 *   ⑤초대 버튼은 **두 헤더 모두**에 있어야 한다(좁은 화면·넓은 창).
 *     하나만 두면 «넓은 창에서는 기능이 없다» 가 된다. [[duplicate-ui-single-source]]
 *
 * 실행: npx tsx scripts/check-grouptalk.ts
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
/** 주석을 뺀 «살아 있는 코드»만 — 내 설명글이 검사에 걸리면 거짓 초록불이 된다(08-24 에 두 번 당함) */
const live = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const T = readFileSync('app/src/app/(app)/talk.tsx', 'utf8');
const G = readFileSync('app/src/lib/talk/groupTalk.ts', 'utf8');
const L = readFileSync('app/src/lib/talk/liveTalk.ts', 'utf8');
const E = readFileSync('supabase/functions/talk/index.ts', 'utf8');

console.log('=== ① 1:1 조회가 다인방을 집지 않는가 ===');
{
  const lv = live(L);
  // `talk_sessions` 를 consultant_id 로 고르는 곳은 **전부** 빈 배열 필터를 달아야 한다
  const blocks = lv.split("from('talk_sessions')").slice(1);
  const byConsultant = blocks.filter((b) => /\.eq\('consultant_id'/.test(b.slice(0, 400)));
  const guarded = byConsultant.filter((b) => /guest_ids['"]?\s*,\s*['"]\{\}/.test(b.slice(0, 600)));
  if (!byConsultant.length) bad('liveTalk 에서 consultant_id 로 세션을 고르는 곳을 못 찾았다 — 검사가 헛돈다');
  else if (guarded.length === byConsultant.length) ok(`1:1 조회 ${guarded.length}곳 모두 guest_ids 빈 것만 본다`);
  else bad(`1:1 조회 ${byConsultant.length}곳 중 ${byConsultant.length - guarded.length}곳에 필터가 없다 — 그 자리는 다인방을 집는다`);
}

console.log('\n=== ② 그룹 조회는 안 빈 것만 보는가 ===');
{
  const gv = live(G);
  if (/\.not\('guest_ids',\s*'eq',\s*'\{\}'\)/.test(gv)) ok('그룹 조회가 guest_ids 안 빈 것만 본다');
  else bad('그룹 조회에 필터가 없다 — 1:1 방이 그룹 목록에 섞인다');
}

console.log('\n=== ③ 한 턴에 답하는 사람은 하나인가 ===');
{
  const ev = live(E);
  if (/function pickSpeaker/.test(ev)) ok('화자를 고르는 함수가 있다');
  else bad('pickSpeaker 가 없다');
  // Anthropic 호출이 **루프 안**에 있으면 인원수만큼 돈다
  const calls = (ev.match(/anthropic\.messages\.create/g) ?? []).length;
  if (calls <= 1) ok(`LLM 호출 지점 ${calls}곳 — 인원수와 무관하다`);
  else bad(`LLM 호출이 ${calls}곳이다 — 다인방에서 인원수만큼 돌 수 있다(운이 그만큼 나간다)`);
  if (/roomMates/.test(ev)) ok('같이 있는 사람을 프롬프트에 알린다');
  else bad('옆에 누가 있는지 안 알려 준다 — 혼자 있는 것처럼 말한다');
}

console.log('\n=== ④ 인원수가 나를 포함하는가 ===');
{
  const m = /export function memberCount\([^)]*\)[^{]*\{([^}]*)\}/.exec(G);
  if (m && /\+\s*1/.test(m[1])) ok('memberCount 가 +1(나) 을 더한다');
  else bad('인원수에 내가 빠졌다 — Boss: "나 포함 총 인원수"');
}

console.log('\n=== ⑤ 초대 버튼이 두 헤더 모두에 있는가 ===');
{
  const tv = live(T);
  const n = (tv.match(/setInviteOpen\(true\)/g) ?? []).length;
  if (n >= 2) ok(`초대 버튼 ${n}곳(좁은 화면·넓은 창)`);
  else bad(`초대 버튼이 ${n}곳뿐 — 다른 화면 폭에서는 기능이 없다`);
  const heads = (tv.match(/roomTitle\(/g) ?? []).length;
  if (heads >= 2) ok(`방 이름 표시 ${heads}곳`);
  else bad(`방 이름 표시가 ${heads}곳뿐 — 한쪽 헤더는 여전히 한 사람 이름만 보인다`);
}

console.log('\n=== ⑥ 상담가 컬럼 목록 두 사본이 같은가 ===');
{
  // 화자를 갈아끼울 때 컬럼이 빠지면 그 사람의 말투·모델이 통째로 비어서 «개성 없음» 이 된다
  const sels = [...E.matchAll(/\.select\('(id, kind, name, persona[^']*)'\)/g)].map((m) => m[1]);
  if (sels.length < 2) bad(`상담가 select 사본이 ${sels.length}개 — 화자 재조회가 사라졌나?`);
  else if (new Set(sels).size === 1) ok(`상담가 select ${sels.length}곳이 글자 그대로 같다`);
  else bad('두 select 목록이 갈라졌다 — 화자를 갈아끼울 때 일부 설정이 빈다');
}

console.log('\n=== ⑦ 미끼(대화 이어가기)가 살아 있는가 — Boss 2026-08-26 ===');
{
  const ev = live(E);
  if (/먹이감|미끼|아직 안 푼 것/.test(ev)) ok('끝에 하나 남기는 규칙이 있다');
  else bad('미끼 규칙이 없다 — Boss: "먹이감을 하나씩 던져주면 좋겠어"');
  if (/되묻기와 미끼 중 하나만/.test(ev)) ok('되묻기와 미끼를 동시에 붙이지 않는다');
  else bad('되묻기와 미끼가 같이 붙을 수 있다 — 끝이 어수선해진다');
  if (/많이 힘들어할 때/.test(ev)) ok('힘들어할 때는 미끼를 안 던진다(안전)');
  else bad('위로가 필요한 자리에도 미끼를 던진다 — 장사꾼처럼 들린다');
}

console.log('\n=== ⑧ 음성 테스트 — 기준이 무뎌지면 잡히는가 ===');
{
  const noFilter = "supabase.from('talk_sessions').select('id').eq('consultant_id', x)";
  const blocks = noFilter.split("from('talk_sessions')").slice(1);
  const guarded = blocks.filter((b) => /guest_ids/.test(b));
  guarded.length === 0 ? ok('필터를 떼면 ①이 잡는다') : bad('필터를 떼도 통과한다 — ①이 무디다');

  const twoCalls = 'anthropic.messages.create(a); anthropic.messages.create(b);';
  ((twoCalls.match(/anthropic\.messages\.create/g) ?? []).length > 1)
    ? ok('호출을 둘로 늘리면 ③이 잡는다') : bad('둘로 늘려도 못 잡는다');

  const noMe = 'export function memberCount(n: number): number { return n; }';
  (!/\+\s*1/.test(/\{([^}]*)\}/.exec(noMe)![1]))
    ? ok('나를 빼면 ④가 잡는다') : bad('빼도 통과한다');

  const cmt = '// 미끼 규칙을 걷어냈다';       // ⚠️주석은 잡으면 안 된다
  (!/먹이감|미끼/.test(live(cmt))) ? ok('내 주석은 ⑦에 안 걸린다(거짓 초록불 방지)') : bad('주석을 코드로 셌다');
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) { console.log('\n   ⚠️ 다인방이 1:1 방을 잡아먹거나, 비용이 인원수만큼 늘 수 있습니다.\n'); process.exit(1); }
console.log('   🎯 다인방 통과 — 1:1 보존 · 한 턴 한 명 · 나 포함 인원수 · 미끼\n');
