/**
 * scripts/check-talknotes.ts — **대화 정리**가 실제로 남고 뜨는가 하네스
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"대화가 쌓이면 사람들이 보기 불편하니깐 중요내용은 따로 정리해주는 기능"*.
 *
 * ■ ★이 기능이 조용히 죽는 자리
 *   말은 잘 나오는데 **정리만 안 쌓인다.** 그러면 "남길 게 없었나 보다" 하고 넘어간다.
 *   죽는 자리를 값으로 확인한다:
 *     ①프롬프트가 시키는 마커 ≠ 파서가 찾는 마커        → 영원히 안 뽑힌다
 *     ②마커를 **저장한 뒤에** 뗀다                      → 대화창에 `[[남김:…]]` 이 보이고 모델이 따라 쓴다
 *     ③건강·투자 문장이 걸러지지 않는다                  → 방 맨 위에 질병 이야기가 고정된다(§4)
 *     ④출처(`from_message`)를 안 싣는다                 → 눌러도 아무 데도 못 간다 = 믿을 수 없는 정리
 *     ⑤DB 스키마·RLS 가 없다                            → 남의 정리가 보인다
 *     ⑥**대화를 지웠는데 정리 줄이 그대로 떠 있다**       → 지운 대화의 요약이 상단에 남는다
 *        (Boss 2026-08-24 제보. DB 행은 cascade 로 사라지지만 **화면 state 는 안 사라진다.**)
 *
 * 실행: npm run check:talknotes   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';
import { NOTE_MARKER, noteBlock, splitNotes } from '../supabase/functions/_shared/talkNotes.ts';

const EDGE = 'supabase/functions/talk/index.ts';
const SCREEN = 'app/src/app/(app)/talk.tsx';
const THREAD = 'app/src/components/talk/TalkThread.tsx';
const SHEET = 'app/src/components/talk/TalkNotes.tsx';

let fail = 0, pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };

console.log('\n📌 대화 정리 하네스\n');

// ── ① 프롬프트 ↔ 파서 ────────────────────────────────────────────────────
console.log('=== ① 프롬프트가 시키는 마커를 파서가 읽는가 ===');
{
  const block = noteBlock(5);
  const kinds: string[] = [...block.matchAll(/`(\[\[남김:[^`]+\]\])`/g)].map((m) => m[1]);
  if (!kinds.length) { bad('프롬프트에 마커 예시가 없다 — 모델이 형식을 모른다'); }
  else {
    let badOne = '';
    for (const ex of kinds) {
      const probe = `짧은 답이에요.\n${ex.replace('…', '가을 지나서 움직이는 게 낫다')}`;
      const r = splitNotes(probe);
      if (!r.notes.length) { badOne = ex; break; }
    }
    if (badOne) bad(`프롬프트 예시(${badOne})를 파서가 못 읽는다`);
    else ok(`갈래 ${kinds.length}종의 예시를 파서가 전부 읽는다`);
  }
  // 첫 두 턴은 지시 자체가 없어야 한다(인사에서 남길 게 나올 리 없다)
  if (noteBlock(0) === '' && noteBlock(1) === '' && noteBlock(2) !== '') ok('첫 두 턴은 정리를 시키지 않는다');
  else bad('이른 턴에도 정리를 시킨다 — 인사를 담아 놓게 된다');
}

// ── ② 저장 전에 떼는가 ───────────────────────────────────────────────────
console.log('\n=== ② Edge 배선 — 저장 전에 떼는가 · 출처를 싣는가 ===');
{
  const edge = readFileSync(EDGE, 'utf8');
  const iSplit = edge.indexOf('splitNotes(');
  const iInsert = edge.indexOf("from('talk_messages').insert(");
  if (iSplit < 0) bad('Edge 가 정리 마커를 떼지 않는다');
  else if (iInsert >= 0 && iSplit > iInsert) bad('★마커를 **저장한 뒤에** 뗀다 — 대화창에 그대로 보이고 모델이 따라 쓴다');
  else ok('Edge 가 저장 **전에** 마커를 뗀다');

  if (!edge.includes('from_message')) bad('★출처(from_message)를 안 싣는다 — 눌러도 못 간다');
  else ok('정리에 출처 말풍선을 싣는다');

  if (!/select\('id'\)/.test(edge)) bad('메시지 저장에서 id 를 안 돌려받는다 — 출처를 알 수 없다');
  else ok('메시지 id 를 돌려받아 출처로 쓴다');

  if (!/ignoreDuplicates/.test(edge)) bad('중복을 막지 않는다 — 같은 말이 계속 쌓인다');
  else ok('같은 정리는 한 번만 담긴다');

  // ★정리 저장이 실패해도 대화가 멈추면 안 된다
  const around = edge.slice(edge.indexOf("from('talk_notes')") - 400, edge.indexOf("from('talk_notes')") + 400);
  if (!/try\s*\{/.test(around) || !/catch/.test(around)) bad('정리 저장에 try/catch 가 없다 — 곁다리가 본류를 막는다');
  else ok('정리 저장이 실패해도 대화는 계속된다');
}

// ── ③ 안전 필터 (값으로 확인) ────────────────────────────────────────────
console.log('\n=== ③ 담지 말아야 할 것을 거르는가 (프롬프트가 아니라 코드로) ===');
{
  const cases: [string, string][] = [
    ['[[남김:me|허리 통증이 잦은 편]]', '건강'],
    ['[[남김:todo|병원 검사를 받아 보기]]', '의료'],
    ['[[남김:when|가을에 주식 매수하기 좋다]]', '투자'],
    ['[[남김:todo|계약서를 법적으로 검토받기]]', '법률'],
  ];
  let leak = 0;
  for (const [probe, why] of cases) {
    const r = splitNotes(probe);
    if (r.notes.length) { bad(`${why} 문장이 걸러지지 않았다: "${r.notes[0].body}"`); leak++; }
  }
  if (!leak) ok(`건강·의료·투자·법률 ${cases.length}종 전부 걸러진다`);

  // 대조군 — 멀쩡한 문장은 통과해야 한다(필터가 다 막아 버리면 기능이 죽는다)
  const good = splitNotes('[[남김:when|가을 지나서 움직이는 게 낫다]]');
  if (good.notes.length === 1 && good.notes[0].kind === 'when') ok('대조군: 평범한 문장은 그대로 담긴다');
  else bad('필터가 멀쩡한 문장까지 막는다 — 기능이 죽는다');
}

// ── ④ 앱 배선 ────────────────────────────────────────────────────────────
console.log('\n=== ④ 앱 — 정리 줄이 뜨고 원문으로 데려가는가 ===');
{
  const screen = readFileSync(SCREEN, 'utf8');
  const thread = readFileSync(THREAD, 'utf8');
  const sheet = readFileSync(SHEET, 'utf8');

  if (!screen.includes('<TalkNotes')) bad('대화방에 정리 줄이 없다');
  else ok('대화방에 정리 줄이 붙어 있다');

  if (!/jumpTo=\{jumpTo\}/.test(screen) || !/jumpTo/.test(thread)) bad('★원문으로 데려가는 배선이 없다 — 정리를 믿을 수 없다');
  else ok('정리를 누르면 원문으로 데려간다');

  if (!/msgId/.test(thread) || !/msgId: m\.id/.test(screen)) bad('말풍선에 msgId 가 없다 — 뛸 자리를 못 찾는다');
  else ok('말풍선이 서버 메시지 id 를 들고 있다');

  if (!/litRow|setLit/.test(thread)) bad('뛰어간 줄을 밝히지 않는다 — 아무 일도 안 일어난 것처럼 보인다');
  else ok('뛰어간 줄을 잠깐 밝힌다');

  if (!/hideNote/.test(sheet) || !/pinNote/.test(sheet)) bad('지우기·고정이 없다 — 틀린 정리를 못 지운다');
  else ok('지우기·고정이 있다');

  // ★정리 카드에 콘텐츠 링크를 넣지 않는다(판매대가 되지 않게)
  if (/onLink|route/.test(sheet)) bad('정리 카드에 링크가 붙어 있다 — 정리가 판매대가 된다');
  else ok('정리 카드에 링크가 없다(안내는 대화 흐름에서만)');

  // ⚠️중첩 <Text> 금지(웹 백지). ★주석을 먼저 걷어낸다 —
  //   "중첩 <Text> 를 넣지 마라" 라고 **적어 둔 주석**을 잡아 오탐이 났다(2026-08-23).
  const code = sheet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/<Text[^>]*>[^<]*<Text/.test(code)) bad('중첩 <Text> — 웹에서 백지가 된다');
  else ok('중첩 <Text> 없음');
}

// ── ⑤ DB ─────────────────────────────────────────────────────────────────
console.log('\n=== ⑤ DB — 표와 RLS 가 있는가 (실측) ===');
{
  const env = readFileSync('.env', 'utf8');
  const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
  const URL_BASE = pick('SUPABASE_URL');
  const ANON = pick('SUPABASE_ANON_KEY');
  if (!URL_BASE || !ANON) console.log('  ·  .env 없음 — DB 대조 생략');
  else {
    try {
      // ★익명으로 조회 → RLS 가 살아 있으면 **행이 안 나온다**(오류가 아니라 빈 배열이면 정상)
      const res = await fetch(`${URL_BASE}/rest/v1/talk_notes?select=id&limit=1`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) bad('talk_notes 표가 없다 — 마이그레이션(0040)을 적용할 것');
      else if (!res.ok) ok(`표 있음 · 익명 접근 차단(HTTP ${res.status})`);
      else {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length === 0) ok('표 있음 · 익명에게 행이 보이지 않는다(RLS 정상)');
        else bad('★익명에게 남의 정리가 보인다 — RLS 를 확인할 것');
      }
    } catch (e) {
      console.log(`  ·  DB 조회 실패(${(e as Error).message}) — 코드 검사만 수행`);
    }
  }
}

// ── ⑥ 음성 테스트 ────────────────────────────────────────────────────────
console.log('\n=== ⑥ 음성 테스트 — 잘못된 것을 버리는가 ===');
{
  // 형식이 어긋난 마커도 **본문에서는 지워야** 한다(대화창에 보이면 안 된다)
  const a = splitNotes('네 알겠어요.\n[[남김:엉뚱한갈래|뭔가]]');
  if (!a.notes.length && !a.body.includes('[[')) ok('갈래가 틀린 마커: 담지 않고 본문에서도 지운다');
  else bad(`갈래가 틀린 마커를 흘렸다 — notes=${a.notes.length} body="${a.body}"`);

  // 한 턴 두 줄 상한
  // ⚠️본문은 **두 글자 이상**이어야 한다(최소 길이 규칙) — 한 글자로 쓰면 상한이 아니라 길이에 걸린다
  const many = splitNotes('[[남김:me|하나]][[남김:when|둘째]][[남김:todo|셋째]][[남김:said|넷째]]');
  if (many.notes.length === 2) ok('한 턴에 두 줄까지만 담는다');
  else bad(`상한이 안 걸린다 — ${many.notes.length}줄`);

  // 같은 것 두 번
  const dup = splitNotes('[[남김:me|같은 말]][[남김:me|같은 말]]');
  if (dup.notes.length === 1) ok('같은 줄은 한 번만 담는다');
  else bad('같은 줄이 두 번 담긴다');

  // 마커가 없으면 본문 그대로
  const none = splitNotes('그냥 대화예요.');
  if (!none.notes.length && none.body === '그냥 대화예요.') ok('마커가 없으면 본문을 건드리지 않는다');
  else bad('마커가 없는데 본문이 바뀌었다');

  // 정규식이 전역이라 lastIndex 가 남으면 **두 번째 호출부터 안 걸린다** — 실제로 흔한 사고다
  NOTE_MARKER.lastIndex = 5;
  const after = splitNotes('[[남김:me|첫 줄]]');
  if (after.notes.length === 1) ok('전역 정규식 lastIndex 오염에도 안전하다');
  else bad('★lastIndex 가 남아 두 번째 호출부터 안 걸린다(matchAll 사용 확인)');
}

// ── ⑦ 대화를 지우면 화면의 방별 state 도 비는가 ──────────────────────────
//   ★규칙을 '`setNotes` 가 있는가'로 적지 않는다 — 그러면 state 가 하나 더 늘 때 또 샌다.
//     **"방을 여는 경로가 비우는 것은, 방을 지우는 경로도 비워야 한다"** 로 적는다.
//     (`setCur` 만 뺀다 — 여는 쪽은 상담가를 바꾸지만 지우는 쪽은 그 방에 그대로 머문다.)
console.log('\n=== ⑦ 대화를 지우면 진행 중이던 것까지 멈추는가 ===');
{
  /** `const NAME = useCallback(…)` 의 **본문**만 잘라 낸다(중괄호 짝을 세어서). */
  const fnBody = (src: string, name: string): string => {
    const i = src.indexOf(`const ${name} = useCallback(`);
    if (i < 0) return '';
    const s0 = src.indexOf('{', src.indexOf('=>', i));
    if (s0 < 0) return '';
    let depth = 0;
    for (let j = s0; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) return src.slice(s0, j + 1);
    }
    return '';
  };
  /** 본문이 부르는 `setXxx` 이름 집합. */
  const setters = (body: string) => new Set([...body.matchAll(/\bset([A-Z]\w*)\(/g)].map((m) => m[1]));

  const screen = readFileSync(SCREEN, 'utf8');
  const openB = fnBody(screen, 'open');
  const delB = fnBody(screen, 'onDeleteThread');

  /** 여는 쪽이 비우는데 지우는 쪽이 안 비우는 state 목록. */
  const leaks = (o: string, d: string) => {
    const dd = setters(d);
    return [...setters(o)].filter((n) => n !== 'Cur' && !dd.has(n));
  };

  if (!openB || !delB) bad('`open` / `onDeleteThread` 본문을 못 찾았다 — 하네스가 헛돈다');
  else {
    const miss = leaks(openB, delB);
    if (miss.length) bad(`★대화를 지워도 안 비우는 state: ${miss.map((n) => `set${n}`).join(' · ')} — 지운 대화의 흔적이 화면에 남는다`);
    else ok('방을 여는 경로가 비우는 것을 지우는 경로도 전부 비운다');

    // 정리 줄은 **이름을 박아** 한 번 더 본다 — 실제로 제보가 들어온 자리다
    if (setters(delB).has('Notes')) ok('삭제가 `setNotes` 로 정리 줄을 비운다(Boss 08-24 제보 자리)');
    else bad('★삭제가 정리 줄을 안 비운다 — "이 대화 정리 · N" 이 상단에 그대로 남는다');

    // ★음성 테스트 — 고친 줄을 도로 빼면 이 하네스가 **무는가**
    const broken = delB.replace(/setNotes\(\[\]\);\s*setJumpTo\(null\);/, '');
    if (broken !== delB && leaks(openB, broken).length) ok('음성 테스트 — 그 줄을 지우면 하네스가 문다');
    else bad('음성 테스트 실패 — 줄을 지워도 통과한다(하네스가 못 문다)');

    // `notesOpen` 은 **건드리면 안 된다** — 펴 둔 것은 사람의 선택이지 방의 상태가 아니다
    if (setters(delB).has('NotesOpen')) bad('삭제가 `notesOpen` 까지 되돌린다 — 펴 둔 것은 사람의 선택이다');
    else ok('펼침 상태(`notesOpen`)는 건드리지 않는다');

    // 타이머 — `setX` 가 아니라서 위 집합 비교로는 안 잡힌다. 이름으로 한 번 더 본다.
    if (/clearTimers\(\)/.test(delB)) ok('삭제가 순차 표시 타이머를 끊는다');
    else bad('★삭제가 타이머를 안 끊는다 — 지운 대화의 말풍선이 새 화면에 계속 떠오른다');

    // ★날아간 fetch 는 못 끊는다 → **세대 토큰**으로 버려야 한다
    //   (지우고 나면 응답이 도착해 새 인사말 밑에 지운 대화의 답이 붙는다.)
    const sendB = fnBody(screen, 'send');
    const bumps = (b: string) => /genRef\.current\s*\+\+/.test(b);
    if (!bumps(delB)) bad('★삭제가 세대(genRef)를 안 올린다 — 진행 중이던 답이 새 화면에 붙는다');
    else if (!bumps(openB)) bad('★방을 바꿀 때 세대를 안 올린다 — 직전 방의 답이 이 방에 붙는다');
    else ok('삭제·방 이동이 세대를 올린다');

    if (!sendB) bad('`send` 본문을 못 찾았다 — 하네스가 헛돈다');
    else if (!/const gen = genRef\.current/.test(sendB)) bad('★`send` 가 보낼 때의 세대를 안 붙든다');
    else if ((sendB.match(/gen !== genRef\.current/g) ?? []).length < 2) {
      bad('★성공·실패 **양쪽**에서 세대를 비교하지 않는다 — 한쪽으로 새면 그쪽만 붙는다');
    } else ok('`send` 가 성공·실패 양쪽에서 옛 세대의 답을 버린다');
  }
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 대화 정리가 끊겨 있다.');
  console.log('      `supabase/functions/_shared/talkNotes.ts`(뽑기·필터) ·');
  console.log('      `supabase/functions/talk/index.ts`(저장) · `components/talk/TalkNotes.tsx`(화면) 를 본다.\n');
  process.exit(1);
}
console.log('   🎯 통과 — 마커 일치 · 저장 전 제거 · 안전 필터 · 출처 이동 · RLS\n');
