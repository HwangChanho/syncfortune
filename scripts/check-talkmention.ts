// scripts/check-talkmention.ts — `@이름` 으로 **다른 사람 명식 부르기**를 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"채팅창에서 만세력이 등록된 인물이나 추가된 다른 인물을 간편하게
//   골라서 탭해서 @누구 이런식으로 불러올수 있으면 좋겠어"*
//
// 무엇을 지키나
//   M1. `parseMentions` 가 **진짜로** 맞춘다 — 공백 이름 · 부분문자열 · 상한 · 등장 순서
//       ★사본이 아니라 **실제 모듈**(`mentionParse.ts`)을 부른다. 그래서 그 파일을 의존성 0 으로 뺐다.
//   M2. 앱이 실제로 `askLive` 에 실어 보낸다(만들어 놓고 안 보내면 조용히 아무 일도 안 난다)
//   M3. ⚠️★서버가 그걸 **캐시 접두사에 넣지 않는다**
//       차트·판정은 1시간 캐시 접두사다. 부른 사람은 **턴마다 달라진다** —
//       접두사에 넣으면 누굴 부를 때마다 캐시가 통째로 깨져 **원가가 몇 배**로 뛴다.
//       화면상으론 멀쩡해서 **청구서로만** 알게 된다. 그래서 구조로 막는다.
//   M4. 서버가 개수·길이를 **직접** 자른다(클라이언트 값이라 안 자르면 프롬프트를 무한정 부풀릴 수 있다)
//   M5. 보내는 재료에 **생년월일·출생지가 없다**(ADR-005 — 서버로는 구조만 간다)
//   M6. 앱 상한과 서버 상한이 **같은 수**다(갈리면 앱은 3명 보냈는데 서버가 2명만 읽는다)
//
// ★음성 테스트: `npx tsx scripts/check-talkmention.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import { parseMentions, MAX_MENTIONS, type MentionTarget } from '../app/src/lib/talk/mentionParse';

const TALK = 'app/src/app/(app)/talk.tsx';
const LIVE = 'app/src/lib/talk/liveTalk.ts';
const EDGE = 'supabase/functions/talk/index.ts';
const BUILD = 'app/src/lib/talk/chartMention.ts';
const SHEET = 'app/src/components/talk/ChartMentionSheet.tsx';

type Fail = { rule: string; msg: string };
const fails: Fail[] = [];
const fail = (rule: string, msg: string) => fails.push({ rule, msg });

/** 주석을 지운 '코드만' — 주석에 적힌 설명에 걸리는 오탐을 없앤다. */
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
const read = (p: string): string | null => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

// ── M1. 판정 자체 — **실제 함수**를 돌린다 ──────────────────────────────────
export function judgeParse(): Fail[] {
  const out: Fail[] = [];
  const T = (id: string, name: string): MentionTarget => ({ id, name, relation: '친구' });

  const cases: { why: string; text: string; targets: MentionTarget[]; want: string[] }[] = [
    { why: '기본', text: '@민수 랑 잘 맞아?', targets: [T('a', '민수')], want: ['민수'] },
    // ★이름에 띄어쓰기가 들어간다("김 과장"). `@[^\s]+` 로 자르면 "김"만 잡고 못 맞춘다
    { why: '공백 이름', text: '@김 과장 이랑 어때', targets: [T('a', '김 과장')], want: ['김 과장'] },
    // ⚠️★부분문자열 — 「민수형」을 불렀는데 「민수」까지 실리면 **한 명 불렀는데 두 명**이 간다
    { why: '부분문자열', text: '@민수형 어때', targets: [T('a', '민수'), T('b', '민수형')], want: ['민수형'] },
    { why: '등장 순서', text: '@나 와 @너 비교', targets: [T('a', '너'), T('b', '나')], want: ['나', '너'] },
    { why: '상한', text: '@ㄱ @ㄴ @ㄷ @ㄹ', targets: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'].map((n, i) => T(String(i), n)), want: ['ㄱ', 'ㄴ', 'ㄷ'] },
    { why: '안 부름', text: '오늘 어때요', targets: [T('a', '민수')], want: [] },
    { why: '@ 없이 이름만', text: '민수 어때', targets: [T('a', '민수')], want: [] },
  ];

  for (const c of cases) {
    const got = parseMentions(c.text, c.targets).map((x) => x.name);
    if (JSON.stringify(got) !== JSON.stringify(c.want)) {
      out.push({ rule: 'M1', msg: `${c.why}: "${c.text}" → [${got}] (기대 [${c.want}])` });
    }
  }
  if (MAX_MENTIONS < 1 || MAX_MENTIONS > 5) {
    out.push({ rule: 'M1', msg: `MAX_MENTIONS=${MAX_MENTIONS} — 1~5 밖이다(원가 상한이 무너진다)` });
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  // 음성 테스트 = **판정 함수가 실패를 실패로 부르는가**.
  //   ★일부러 틀린 기대값을 주고 «잡히는지» 본다. 통과만 보면 아무것도 검사 안 해도 초록불이다.
  const real = judgeParse();
  // 소스를 망가뜨린 척: 부분문자열 케이스의 기대값을 반대로 넣어 본다
  const T = (id: string, name: string): MentionTarget => ({ id, name, relation: '친구' });
  const wrong = parseMentions('@민수형 어때', [T('a', '민수'), T('b', '민수형')]).map((x) => x.name);
  const substringOk = JSON.stringify(wrong) === JSON.stringify(['민수형']);
  const capOk = parseMentions('@ㄱ @ㄴ @ㄷ @ㄹ', ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'].map((n, i) => T(String(i), n))).length === MAX_MENTIONS;
  const spaceOk = parseMentions('@김 과장 이랑', [T('a', '김 과장')]).length === 1;
  // ★M3 대조군 — **진짜 Edge 소스**를 오염시켜 «잡히는가» 를 본다.
  //   (통과만 보면 검사가 아무것도 안 해도 초록불이다 — [[build-artifact-verify-hermes]])
  const edgeRaw = fs.existsSync(EDGE) ? codeOnly(fs.readFileSync(EDGE, 'utf8')) : '';
  const cleanOk = edgeRaw ? judgeEdgeCache(edgeRaw).length === 0 : false;
  // ① 캐시 블록으로 옮긴다  ② 아예 안 쓴다
  const polluted = edgeRaw.replace('${digestBlock}${histBlock}${mentionBlock}', '${digestBlock}${histBlock}')
                          .replace('${chartBlock}\\n\\n', '${chartBlock}${mentionBlock}\\n\\n');
  const dropped = edgeRaw.replace('${mentionBlock}', '');
  const pollutedCaught = judgeEdgeCache(polluted).some((f) => /캐시 접두사 안/.test(f.msg));
  const droppedCaught = judgeEdgeCache(dropped).length > 0;
  console.log(`  ${cleanOk ? '✅' : '❌'} M3 현재 소스는 깨끗하다`);
  console.log(`  ${pollutedCaught ? '✅' : '❌'} M3 캐시 접두사로 옮기면 **잡는다**`);
  console.log(`  ${droppedCaught ? '✅' : '❌'} M3 아예 안 쓰면 **잡는다**`);

  const ok = real.length === 0 && substringOk && capOk && spaceOk && cleanOk && pollutedCaught && droppedCaught;
  console.log(`  ${real.length === 0 ? '✅' : '❌'} 전 케이스 통과(${real.length}건 실패)`);
  console.log(`  ${substringOk ? '✅' : '❌'} 부분문자열: 「민수형」만 잡고 「민수」는 안 잡는다 → [${wrong}]`);
  console.log(`  ${capOk ? '✅' : '❌'} 상한 ${MAX_MENTIONS}명`);
  console.log(`  ${spaceOk ? '✅' : '❌'} 공백 이름`);
  console.log(ok ? '✅ selftest 통과' : '❌ selftest 실패');
  process.exit(ok ? 0 : 1);
}

fails.push(...judgeParse());

/**
 * ★★캐시 접두사 오염 검사 — **이름이 아니라 «어느 블록에 있나»** 로 판정한다.
 *
 * ⚠️첫 판은 `/\{ type: 'text'[\s\S]*?\}/` 로 블록을 떴는데, 본문에 `${digestBlock}` 이 있어
 *   **첫 `}` 에서 끊겼다** — 그래서 오염을 넣어도 못 잡는다. 비탐욕 정규식으로 «블록»을 뜨려 한 게 틀렸다.
 *   ⇒ `{ type: 'text'` **마커로 잘라** 각 조각을 본다. 조각 안에 `cache_control` 이 있으면 캐시 블록이다.
 *
 * @param code 주석 지운 Edge 소스
 */
export function judgeEdgeCache(code: string): Fail[] {
  const out: Fail[] = [];
  // 첫 조각은 블록 이전 코드라 버린다
  const parts = code.split(/\{\s*type:\s*'text'/).slice(1);
  if (!parts.length) { out.push({ rule: 'M3', msg: 'text 블록을 하나도 못 찾았다 — 프롬프트 구조가 바뀌었으면 이 하네스를 고칠 것' }); return out; }

  const cached = parts.filter((b) => /cache_control/.test(b));
  const fresh = parts.filter((b) => !/cache_control/.test(b));
  if (!cached.length) out.push({ rule: 'M3', msg: 'cache_control 이 붙은 블록이 없다. 캐시가 통째로 빠졌다(원가가 뛴다)' });
  if (cached.some((b) => /mentionBlock/.test(b))) {
    out.push({ rule: 'M3', msg: '★mentionBlock 이 **캐시 접두사 안**에 있다. 부를 때마다 1시간 캐시가 깨져 원가가 몇 배로 뛴다(화면은 멀쩡해 **청구서로만** 알게 된다)' });
  }
  if (!fresh.some((b) => /mentionBlock/.test(b))) {
    out.push({ rule: 'M3', msg: 'mentionBlock 이 «턴마다 달라지는» 블록에 없다 — 받기만 하고 안 쓴다' });
  }
  return out;
}

// ── M2. 앱이 실제로 보내나 ──────────────────────────────────────────────────
{
  const raw = read(TALK);
  if (raw == null) fail('M2', `${TALK} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`);
  else {
    const code = codeOnly(raw);
    if (!/askLive\([\s\S]{0,400}?buildMentions\(/.test(code)) {
      fail('M2', `${TALK} — askLive 호출에 buildMentions(q) 가 없다. 부른 사람이 **서버로 안 간다**(화면만 조용히 멀쩡하다)`);
    }
    if (!/setMentionOpen\(true\)/.test(code)) fail('M2', `${TALK} — 「@」로 목록을 여는 길이 없다`);
    if (!/<ChartMentionSheet/.test(code)) fail('M2', `${TALK} — 부르기 창을 그리지 않는다`);
    // ★렌더 경로가 둘(넓은 웹 3칸 / 폰)이다 — 한쪽에만 있으면 «웹에서는 안 된다»
    const sheetSites = (code.match(/\{mentionSheet\}/g) ?? []).length;
    if (sheetSites < 2) fail('M2', `${TALK} — {mentionSheet} 가 ${sheetSites}곳뿐이다. 넓은 웹·폰 **두 경로 모두**에 있어야 한다`);
  }
  const live = read(LIVE);
  if (live == null) fail('M2', `${LIVE} 이 없다`);
  else if (!/mentions/.test(codeOnly(live))) fail('M2', `${LIVE} — askLive 가 mentions 를 body 에 안 싣는다`);
}

// ── M3·M4·M6. 서버 ─────────────────────────────────────────────────────────
{
  const raw = read(EDGE);
  if (raw == null) fail('M3', `${EDGE} 이 없다`);
  else {
    const code = codeOnly(raw);
    if (!/mentionBlock/.test(code)) fail('M3', `${EDGE} — mentions 를 프롬프트에 안 붙인다(받기만 하고 버린다)`);

    fails.push(...judgeEdgeCache(code));

    // M4. 서버가 스스로 자르는가 — 클라이언트를 믿지 않는다
    if (!/\.slice\(0,\s*MAX_MENTIONS\)/.test(code)) fail('M4', `${EDGE} — 인원수를 안 자른다(클라이언트가 100명 보내면 100명 간다)`);
    if (!/slice\(0,\s*MAX_MENTION_CHARS\)/.test(code)) fail('M4', `${EDGE} — 사람당 길이를 안 자른다(프롬프트를 무한정 부풀릴 수 있다)`);
    if (!/Array\.isArray\(mentions\)/.test(code)) fail('M4', `${EDGE} — 배열인지 안 본다(문자열 하나를 보내면 글자 단위로 돈다)`);

    // M6. 앱 상한 == 서버 상한
    const serverMax = Number(code.match(/MAX_MENTIONS\s*=\s*(\d+)/)?.[1] ?? NaN);
    if (serverMax !== MAX_MENTIONS) {
      fail('M6', `상한이 갈렸다 — 앱 ${MAX_MENTIONS} ↔ 서버 ${serverMax}. 앱이 보낸 사람을 서버가 조용히 버린다`);
    }
  }
}

// ── M5. PII 가 서버로 안 나가는가 (ADR-005) ────────────────────────────────
{
  const raw = read(BUILD);
  if (raw == null) fail('M5', `${BUILD} 이 없다`);
  else {
    const code = codeOnly(raw);
    for (const pii of ['birthDateTime', 'birthPlace', 'birthLon', 'birthLat', 'calendar']) {
      if (new RegExp(`\\b${pii}\\b`).test(code)) {
        fail('M5', `${BUILD} — '${pii}' 를 재료에 싣는다. 서버로 나가면 안 되는 값이다(ADR-005: 구조만 보낸다)`);
      }
    }
    // 시각 미상은 **반드시** 표시해야 한다 — 안 그러면 유령 子시로 궁합을 본다
    if (!/timeUnknown/.test(code)) {
      fail('M5', `${BUILD} — timeUnknown 을 안 본다. 시각 미상인데 **엔진이 만든 유령 子시**로 판단하게 된다(spec/chart.ts 경고)`);
    }
  }
  // 생일은 화면에만 — 창 컴포넌트에는 있어도 된다(고를 때 사람을 가른다)
  if (read(SHEET) == null) fail('M5', `${SHEET} 이 없다`);
}

if (!fails.length) {
  console.log('✅ check:talkmention — 판정 7케이스 통과 · 앱→서버 배선 · 캐시 접두사 안전 · 상한 일치 · PII 미전송');
  process.exit(0);
}
console.error(`❌ check:talkmention — ${fails.length}건\n`);
for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
process.exit(1);
