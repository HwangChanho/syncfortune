// scripts/check-banmal.ts — **반말/존댓말**은 회원이 정하고, 말투를 잡아먹지 않는다
// ═══════════════════════════════════════════════════════════════════════════
// ★★2026-08-31 Boss 가 규칙을 **뒤집었다**:
//   *"그냥 설정에서 반말모드 존댓말모드 설정할수 있게하고 저건 묻지 않는걸로 하자"*
//   ⇒ 나이로 판정하지도, 대화 중에 묻지도 않는다. `profiles.speech_casual` **하나가 답**이다.
//   ⚠️★이 하네스는 그 전까지 «물어보는 길이 있는가»(B7)를 강제하고 있었다 —
//     외부 판정이 뒤집히면 **코드보다 하네스를 먼저** 고친다([[harness-can-enforce-wrong-rule]]).
//   ⚠️그리고 이 하네스는 **preflight 에 없어서** 그동안 조용히 빨간불이었다. 이번에 편입한다
//     ([[harness-goes-blind-on-refactor]] — 만들면 preflight 편입까지가 한 세트).
//
// (연혁) Boss 2026-08-26: *"각 선생님들의 나이를 정하고 유저가 해당 나이보다 어리면 반말로"*
//   → 나이 판정(`isCasual`)은 **남아 있지만 말투를 정하지 않는다**. B1·B2 는 그 함수의
//     «모르면 존댓말» 성질을 계속 지킨다(다른 문구가 나이를 쓰기 때문).
//
// 무엇을 지키나
//   B1. 나이 계산·판정이 **진짜로** 맞는다 — 만 나이(생일 전/후) · 같은 나이 · 모르는 값
//       ★사본이 아니라 **실제 모듈**(`speechLevel.ts`)을 부른다. 그래서 의존성 0 으로 뺐다.
//   B2. ⚠️★모르면 **존댓말**이다 — 나이 null · 명식 없음 · 이상한 값 전부.
//       반말은 되돌리기 어려운 무례가 될 수 있고 존댓말은 그렇지 않다.
//   B3. 앱이 나이를 **실제로 보낸다**(구하기만 하고 안 보내면 조용히 아무 일도 안 난다)
//   B4. ⚠️★서버 지시가 **캐시 블록에 없다** — 반말 여부는 회원마다 다르다.
//       말투 블록(1시간 캐시)에 넣으면 접두사가 갈려 캐시가 깨진다(청구서로만 알게 된다).
//   B5. ⚠️★말투를 **잡아먹지 않는다** — 지시문이 «어미만 낮춘다»를 명시하는가.
//       «반말로 해라»만 던지면 열두 명이 다시 똑같아진다([[shared-block-eats-personality]]).
//   B6. 인사도 **설정을 따르는가**(인사만 존댓말이면 다음 말과 어긋난다)
//   B7. 안전 문장이 살아 있는가(무거운 자리에서 가볍게 굴지 마라)
//   B8. ★말투를 **묻지 않는다** — 「말 편하게 해도 될까요?」 를 다시 넣지 못하게.
//       Boss 스크린샷: 물었더니 **방향이 뒤집혀** 「어」 에 「편하게 말씀해도 괜찮아요」 로 답했다.
//   B9. 서버가 **설정값**(`speech_casual`)을 읽는가 — 나이로 되돌아가지 못하게.
//
// ★음성 테스트: `npx tsx scripts/check-banmal.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import { ageFromBirth, isCasual } from '../app/src/lib/talk/speechLevel';

const EDGE = 'supabase/functions/talk/index.ts';
const TALK = 'app/src/app/(app)/talk.tsx';
const LIVE = 'app/src/lib/talk/liveTalk.ts';
const GREET = 'app/src/lib/talk/greetingFor.ts';
const SEED = 'app/src/lib/talk/consultants.ts';

type Fail = { rule: string; msg: string };
const fails: Fail[] = [];
const fail = (rule: string, msg: string) => fails.push({ rule, msg });
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
const read = (p: string): string | null => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

// ── B1·B2. 판정 자체 — **실제 함수**를 돌린다 ──────────────────────────────
export function judgeLogic(): Fail[] {
  const out: Fail[] = [];
  const NOW = new Date('2026-08-26T12:00:00+09:00');
  const cases: [string, number | null][] = [
    // 생일이 지났다 → 만 35
    ['1991-05-14 09:20', 35],
    // ⚠️생일이 아직 안 왔다 → 만 34 (여기서 한 살이 갈린다)
    ['1991-12-01 09:20', 34],
    // 생일 당일 → 이미 지난 것으로 본다
    ['1991-08-26 00:00', 35],
    // 생일 바로 다음 날짜(내일) → 아직 안 온 것
    ['1991-08-27 00:00', 34],
    ['', null], ['모름', null], ['0000-00-00', null], [null as never, null],
  ];
  for (const [birth, want] of cases) {
    const got = ageFromBirth(birth, NOW);
    if (got !== want) out.push({ rule: 'B1', msg: `ageFromBirth("${birth}") = ${got} (기대 ${want})` });
  }
  // ⚠️B2 — «모르면 존댓말»
  const casualCases: [string, number | null, number | null, boolean][] = [
    ['어리다 → 반말',        33, 25, true],
    ['같은 나이 → 존댓말',   33, 33, false],   // Boss: "**보다** 어리면"
    ['많다 → 존댓말',        33, 40, false],
    ['한 살 차 → 반말',      33, 32, true],
    ['상담가 나이 없음',     null, 25, false],
    ['회원 나이 없음',       33, null, false],
    ['둘 다 없음',           null, null, false],
    ['이상한 값',            NaN as never, 25, false],
  ];
  for (const [why, a, b, want] of casualCases) {
    const got = isCasual(a, b);
    if (got !== want) out.push({ rule: 'B2', msg: `${why}: isCasual(${a}, ${b}) = ${got} (기대 ${want})` });
  }
  return out;
}

/** B4·B5·B7 — 서버 지시가 **어디 있고 무엇을 말하는가**. 음성 테스트가 오염본으로 부른다. */
/**
 * 반말 인사 목록(`LINE_CASUAL`) **안에** 남아 있는 존댓말 문장들.
 *
 * ⚠️★2026-08-31 — 여기가 **거짓 빨간불**을 내고 있었다.
 *   구간을 `LINE_CASUAL` ~ `greetingFor` 로 넓게 잘랐는데, 그 사이에 조사 헬퍼 `ieyo` 가 있고
 *   그 **반환값** `'이에요'`·`'예요'` 가 인사말로 세어졌다.
 *   ⇒ 객체 리터럴 **안**만 본다(첫 `{` 부터 짝이 맞는 `}` 까지).
 *   ★이 하네스는 preflight 에 없어서 그 빨간불을 **아무도 안 봤다**.
 *
 * @param code 주석을 지운 `greetingFor.ts` 원문
 * @returns 남아 있는 존댓말 문장들(없으면 빈 배열)
 */
export function politeInCasual(code: string): string[] {
  const start = code.indexOf('LINE_CASUAL');
  if (start < 0) return [];
  const open = code.indexOf('{', start);
  if (open < 0) return [];
  let depth = 0, end = open;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const seg = code.slice(open, end + 1);
  return [...seg.matchAll(/'([^']*(?:하세요|해요|이에요|세요\?|예요)[^']*)'/g)].map((m) => m[1]);
}

export function judgeEdge(code: string): Fail[] {
  const out: Fail[] = [];
  if (!/speechLine/.test(code)) { out.push({ rule: 'B3', msg: '서버가 반말 지시를 만들지 않는다' }); return out; }

  // B4. 캐시 오염 — **자리로** 판정한다(변수명을 바꿔도 안 뚫린다)
  const parts = code.split(/\{\s*type:\s*'text'/).slice(1);
  const cached = parts.filter((b) => /cache_control/.test(b));
  const fresh = parts.filter((b) => !/cache_control/.test(b));
  if (cached.some((b) => /speechLine/.test(b))) {
    out.push({ rule: 'B4', msg: '★반말 지시가 **캐시 블록 안**에 있다. 회원마다 달라 접두사가 갈리고 캐시가 깨진다(청구서로만 알게 된다)' });
  }
  if (!fresh.some((b) => /speechLine/.test(b))) {
    out.push({ rule: 'B4', msg: '반말 지시가 «턴마다 달라지는» 블록에 없다 — 만들고 안 쓴다' });
  }
  // B5. 말투를 잡아먹지 않는가
  if (!/어미만/.test(code)) {
    out.push({ rule: 'B5', msg: '★«어미만 낮춘다»가 없다 — «반말로 해라»만 던지면 열두 명이 다시 똑같아진다' });
  }
  // B7. 안전 문장
  // ★«존댓말로 해 달라고 하면 바꾼다» 규칙은 **뺐다**(2026-08-31) — 이제 회원이 설정에서 바꾼다.
  if (!/가볍게 굴지 마라/.test(code)) out.push({ rule: 'B7', msg: '무거운 자리에서 가볍게 굴지 말라는 문장이 없다(CLAUDE.md §4)' });

  // B8 ★말투를 **묻지 않는다**
  if (/말\s*(을\s*)?(편하게|놔도|놓아도)[^\n]{0,20}(될까|괜찮|해도\s*돼)/.test(code)) {
    out.push({ rule: 'B8', msg: '★지시에 「말 편하게 해도 될까요?」 류가 있다.\n        '
      + 'Boss 2026-08-31 *"저건 묻지 않는걸로 하자"* — 물었더니 **방향이 뒤집혀**\n        '
      + '회원이 「어」 하자 「편하게 말씀해도 괜찮아요」 라고 답했다(허락을 구한 것으로 읽었다)' });
  }
  if (!/말투를\s*\*\*화제로 삼지 마라\*\*/.test(code)) {
    out.push({ rule: 'B8', msg: '말투를 화제로 삼지 말라는 문장이 없다 — 모델이 스스로 묻기 시작한다' });
  }

  // B9 ★설정값을 읽는가
  if (!/speech_casual/.test(code)) {
    out.push({ rule: 'B9', msg: '★서버가 `profiles.speech_casual` 을 안 읽는다.\n        '
      + '말투는 회원이 설정에서 정한 값이 답이다 — 나이 판정으로 되돌아가면 안 된다' });
  }
  // B2(서버판) — 모르면 존댓말인가: 유한수 검사가 있는가
  if (!/Number\.isFinite/.test(code)) {
    out.push({ rule: 'B2', msg: '서버가 나이를 숫자로 검사하지 않는다 — 이상한 값이 반말로 새어 들어간다' });
  }
  return out;
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const logic = judgeLogic();
  const raw = read(EDGE);
  const code = raw ? codeOnly(raw) : '';
  const clean = judgeEdge(code).length === 0;
  // ① 캐시 블록으로 옮긴다  ② 아예 안 쓴다  ③ «어미만» 문구를 지운다
  const polluted = code.replace('${langLine}${speechLine}', '${langLine}')
                       .replace('${chartBlock}', '${chartBlock}${speechLine}');
  const dropped = code.replace(/\$\{speechLine\}/g, '');
  const flattened = code.replace(/어미만/g, '전부');
  const t = (label: string, ok: boolean) => { console.log(`  ${ok ? '✅' : '❌'} ${label}`); return ok; };
  const r = [
    t(`판정 ${logic.length === 0 ? '전 케이스 통과' : `실패 ${logic.length}건: ${logic.map((f) => f.msg).join(' / ')}`}`, logic.length === 0),
    t('현재 서버 지시는 깨끗하다', clean),
    t('캐시 블록으로 옮기면 **잡는다**', judgeEdge(polluted).some((f) => /캐시 블록 안/.test(f.msg))),
    t('아예 안 쓰면 **잡는다**', judgeEdge(dropped).length > 0),
    t('«어미만»을 지우면 **잡는다**', judgeEdge(flattened).some((f) => f.rule === 'B5')),

    // ── B8·B9 (2026-08-31 Boss: 묻지 않는다 · 설정값을 읽는다) ──────────
    t('B8 ★「말 편하게 해도 될까요?」를 되살리면 **잡는다**',
      judgeEdge(`${code}\nconst q = '말 편하게 해도 될까요?';`).some((f) => f.rule === 'B8')),
    t('B8 «화제로 삼지 마라»를 지우면 **잡는다**',
      judgeEdge(code.replace(/화제로 삼지 마라/g, '아무거나')).some((f) => f.rule === 'B8')),
    t('B9 `speech_casual` 을 안 읽으면 **잡는다**',
      judgeEdge(code.replace(/speech_casual/g, 'xxx')).some((f) => f.rule === 'B9')),

    // ── B6 구간 한정 (거짓 빨간불을 냈던 자리) ─────────────────────────
    t('B6 반말만 있으면 통과',
      politeInCasual(`const LINE_CASUAL = {\n  a: '안녕. 뭐가 궁금해?',\n};\nfunction ieyo() { return '이에요'; }`).length === 0),
    t('B6 ★목록 **바깥**의 «이에요» 에 안 속는다',
      !politeInCasual(`const LINE_CASUAL = {\n  a: '안녕. 뭐가 궁금해?',\n};\nfunction ieyo() { return '이에요'; }`).includes('이에요')),
    t('B6 반말 목록에 존댓말이 섞이면 **잡는다**',
      politeInCasual(`const LINE_CASUAL = {\n  a: '안녕하세요. 뭐가 궁금하세요?',\n};`).length === 1),
    t('B6 목록이 없으면 빈 배열', politeInCasual('const a = 1;').length === 0),
  ];
  const ok = r.every(Boolean);
  console.log(ok ? '✅ selftest 통과' : '❌ selftest 실패');
  process.exit(ok ? 0 : 1);
}

// ── 본검사 ──────────────────────────────────────────────────────────────────
fails.push(...judgeLogic());
{
  const raw = read(EDGE);
  if (raw == null) fail('B0', `${EDGE} 이 없다`);
  else {
    const code = codeOnly(raw);
    fails.push(...judgeEdge(code));
    // 상담가 나이를 **두 SELECT 모두**에서 읽는가(하나만 고치면 다인방에서 빠진다)
    const sels = (code.match(/\.select\('id, kind, name, persona[^)]*\)/g) ?? []);
    const withAge = sels.filter((x) => /\bage\b/.test(x)).length;
    if (sels.length && withAge !== sels.length) {
      fail('B3', `${EDGE} — 상담가 SELECT ${sels.length}곳 중 ${withAge}곳만 age 를 읽는다(다인방에서 빠진다)`);
    }
  }
}
// B3. 앱이 실제로 보내나
{
  const talk = read(TALK); const live = read(LIVE);
  if (talk == null || live == null) fail('B3', '앱 파일을 못 찾는다 — 경로가 바뀌었으면 이 하네스를 고칠 것');
  else {
    const tc = codeOnly(talk);
    if (!/ageFromBirth\(/.test(tc)) fail('B3', `${TALK} — 회원 나이를 구하지 않는다`);
    if (!/askLive\([\s\S]{0,500}?myAge/.test(tc)) fail('B3', `${TALK} — askLive 에 나이를 안 넘긴다(구하기만 하고 안 보낸다)`);
    if (!/userAge/.test(codeOnly(live))) fail('B3', `${LIVE} — askLive 가 userAge 를 body 에 안 싣는다`);
    /**
     * ⚠️`open` 이 `casualMode` 를 의존성에 안 넣으면 **인사만 존댓말로 굳는다** —
     *   설정은 서버에서 **나중에** 들어오는데, 그때 콜백이 다시 안 만들어지면 옛 값을 쓴다.
     *
     * ★2026-08-31 판정 방식을 고쳤다. 종전엔 의존성 배열을 **글자 그대로** 비교했다:
     *     /\}, \[t, dateKey, myName, bumpChats, myAge\]\)/
     *   배열에 항목이 하나만 늘어도 빨간불이 된다 — 리팩터링에 **눈이 머는** 판정이다
     *   ([[harness-goes-blind-on-refactor]]). ⇒ «그 배열 안에 이름이 있는가» 로 본다.
     */
    const deps = [...tc.matchAll(/\}\s*,\s*\[([^\]]*)\]\s*\)/g)].map((m) => m[1]);
    const openDeps = deps.find((d) => /dateKey/.test(d) && /bumpChats/.test(d));
    if (openDeps == null) {
      fail('B6', `${TALK} — open 의 의존성 배열을 못 찾았다(경로·이름이 바뀌었나)`);
    } else if (!/\bcasualMode\b/.test(openDeps)) {
      fail('B6', `${TALK} — open 의 의존성에 \`casualMode\` 가 없다.\n        `
        + '설정은 서버에서 나중에 들어오므로 **인사가 영원히 존댓말**로 굳는다');
    }
  }
}
// B6. 인사 반말 판
{
  const g = read(GREET);
  if (g == null) fail('B6', `${GREET} 이 없다`);
  else {
    const code = codeOnly(g);
    if (!/LINE_CASUAL/.test(code)) fail('B6', `${GREET} — 반말 인사가 없다. 인사만 존댓말이면 다음 말과 어긋난다`);
    else {
      /**
       * 반말 인사가 **존댓말 어미로 끝나지 않는가**(옮겨 붙이다 남기기 쉽다).
       *
       * ⚠️★2026-08-31 — 여기가 **거짓 빨간불**을 내고 있었다.
       *   구간을 `LINE_CASUAL` ~ `greetingFor` 로 넓게 잘랐는데, 그 사이에
       *   조사 헬퍼 `ieyo` 가 있고 그 **반환값** `'이에요'`·`'예요'` 가 인사말로 세어졌다.
       *   ⇒ `LINE_CASUAL` **객체 리터럴 안**만 본다(첫 `{` 부터 짝이 맞는 `}` 까지).
       *   ★이 하네스는 preflight 에 없어서 그 빨간불을 **아무도 안 봤다** — 이번에 편입한다.
       */
      const politeLeft = politeInCasual(code);
      if (politeLeft.length) fail('B6', `${GREET} — 반말 인사에 존댓말이 남아 있다: ${politeLeft.slice(0, 2).join(' / ')}`);
      // 아는 상담가 수만큼 있는가
      const known = (code.match(/^\s{2}\w+:\s+/gm) ?? []).length;
      if (known < 20) fail('B6', `${GREET} — 인사 표가 예상보다 적다(${known}) — 반말 판이 빠진 상담가가 있을 수 있다`);
    }
  }
}
// 씨앗과 DB 가 같은 나이를 말하는가(코드만으로 볼 수 있는 범위)
{
  const seed = read(SEED);
  if (seed && !/\bage:\s*\d+/.test(codeOnly(seed))) {
    fail('B3', `${SEED} — 씨앗에 나이가 없다. 네트워크가 없으면 전원 존댓말이 된다(서버와 다른 앱이 된다)`);
  }
}

if (!fails.length) {
  console.log('✅ check:banmal — 나이 판정 16케이스 · 모르면 존댓말 · 앱→서버 배선 · 캐시 안전 · 말투 보존 · 인사 반말판');
  process.exit(0);
}
console.error(`❌ check:banmal — ${fails.length}건\n`);
for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
process.exit(1);
