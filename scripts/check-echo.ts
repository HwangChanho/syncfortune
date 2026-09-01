// scripts/check-echo.ts — 「어」에 「어.」로 **되받지** 않는다
// ═══════════════════════════════════════════════════════════════════════════
// ★Boss 2026-09-02: *"어 하면 왜 어 따라하는거야"*
//   실제 화면: 사용자 「어」 → 노쌤 「어.」 「네, 알았어요.」 …
//
// ■ 왜 나오나 — 지시문의 *"★먼저 반응하고 그다음 알려 준다"* 가, 「어」 처럼 **내용 없는 대꾸**에는
//   반응할 것이 없어 **그 말을 그대로 되받는** 모양으로 나타난다.
// ■ ⚠️★그래서 **두 겹**으로 막는다 — 지시문 한 겹은 «대체로» 지켜질 뿐이라 또 샌다
//   (이 저장소의 반복 교훈: **지시문 검사 ≠ 산출물 검사**).
//     ① 지시문에 «되받지 마라» 가 있다
//     ② 산출물에서 **실제로 뗀다**(`dropEcho`) — 이쪽이 진짜 자물쇠다
//
// 무엇을 지키나
//   E1 ★되뇐 첫 줄을 실제로 뗀다(「어」→「어. 네…」 ⇒ 「네…」)
//   E2 ★내용 있는 말은 **안 뗀다**(「배고파」→「배고파.」 는 그대로)
//   E3 ★떼고 남는 말이 없으면 **안 뗀다**(빈 답이 되뇌기보다 나쁘다)
//   E4 ★첫 줄만 본다(답 중간의 같은 말은 문맥일 수 있다)
//   E5 앱 사본과 Edge 사본이 **한 글자도 다르지 않다**(첫 줄 경로만 다르다)
//   E6 talk 지시문에 «되받지 마라» 가 있고, Edge 가 `dropEcho` 를 **실제로 부른다**
//
// ★음성 테스트: `npx tsx scripts/check-echo.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { dropEcho, isFiller } from '../app/src/lib/talk/dropEcho';

const ROOT = process.cwd();
const APP = 'app/src/lib/talk/dropEcho.ts';
const EDGE = 'supabase/functions/_shared/dropEcho.ts';
const TALK = 'supabase/functions/talk/index.ts';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

function run() {
  // E1~E4 — 동작
  const cases: [string, string, string, string][] = [
    ['E1', '어', '어. 네, 알았어요.\n십신을 배우면서', '되뇐 첫 문장'],
    ['E1', '어', '어\n네, 알았어요.', '되뇐 첫 줄'],
    ['E1', 'ㅇㅇ', 'ㅇㅇ. 그럼 시작할게요.', '초성 대꾸'],
    ['E1', '응', '응…\n그럼 볼게요.', '말줄임이 붙어도'],
  ];
  for (const [rule, user, ans, why] of cases) {
    const got = dropEcho(ans, user);
    if (got === ans || new RegExp(`^\\s*${user}\\b`).test(got)) {
      fail(rule, `${why}: 「${user}」 에 「${ans.split('\n')[0]}」 가 그대로 남았다 → ${JSON.stringify(got)}`);
    }
  }
  // E2 — 내용 있는 말은 그대로
  for (const [user, ans] of [['배고파', '배고파. 그럼 뭐 드실래요?'], ['어제', '어제 말씀하신 건'], ['어', '어제 말씀하신 건 이렇습니다.']] as const) {
    if (dropEcho(ans, user) !== ans) fail('E2', `내용 있는 말을 뗐다: 「${user}」 / ${JSON.stringify(ans)}`);
  }
  // E3 — 남는 말이 없으면 안 뗀다
  if (dropEcho('어.', '어') !== '어.') fail('E3', '떼고 나면 빈 답이 되는데도 뗐다');
  // E4 — 중간의 같은 말은 안 건드린다
  const mid = '그럼 시작할게요.\n어\n다음은';
  if (dropEcho(mid, '어') !== mid) fail('E4', '첫 줄이 아닌 자리를 건드렸다');

  // E5 — 두 사본 동일
  const a = existsSync(join(ROOT, APP)) ? readFileSync(join(ROOT, APP), 'utf8').split('\n').slice(1).join('\n') : null;
  const b = existsSync(join(ROOT, EDGE)) ? readFileSync(join(ROOT, EDGE), 'utf8').split('\n').slice(1).join('\n') : null;
  if (a == null || b == null) fail('E5', '두 사본 중 하나가 없다 — **못 쟀다**');
  else if (a !== b) fail('E5', `앱 사본과 Edge 사본이 다르다 — 한쪽만 고치면 **폰에서만/서버에서만** 낫는다`);

  // E6 — 지시문 + 실제 호출
  if (!existsSync(join(ROOT, TALK))) { fail('E6', 'talk 함수가 없다 — **못 쟀다**'); return; }
  const talk = readFileSync(join(ROOT, TALK), 'utf8');
  if (!/되받지 마라/.test(talk)) fail('E6', '지시문에 «되받지 마라» 가 없다');
  if (!/dropEcho\(\s*answer\s*,/.test(talk)) {
    fail('E6', '★Edge 가 `dropEcho` 를 **부르지 않는다** — 지시문만으론 또 샌다(지시문 검사 ≠ 산출물 검사)');
  }
}

if (process.argv.includes('--selftest')) {
  const cs: { name: string; run: () => boolean }[] = [
    { name: 'E1 되뇐 첫 문장을 뗀다', run: () => dropEcho('어. 네, 알았어요.', '어') === '네, 알았어요.' },
    { name: 'E1 되뇐 첫 줄을 뗀다', run: () => dropEcho('어\n네, 알았어요.', '어') === '네, 알았어요.' },
    { name: 'E2 ★내용 있는 말은 안 뗀다', run: () => dropEcho('배고파. 뭐 드실래요?', '배고파') === '배고파. 뭐 드실래요?' },
    { name: 'E2 ★비슷한 시작은 안 뗀다', run: () => dropEcho('어제 말씀하신 건', '어') === '어제 말씀하신 건' },
    { name: 'E3 ★남는 말 없으면 안 뗀다', run: () => dropEcho('어.', '어') === '어.' },
    { name: 'E4 ★중간은 안 건드린다', run: () => dropEcho('시작할게요.\n어\n다음', '어') === '시작할게요.\n어\n다음' },
    { name: '★대꾸 판정', run: () => isFiller('어') && isFiller('ㅇㅇ') && isFiller('네') && !isFiller('배고파') },
    { name: '★긴 말은 대꾸가 아니다', run: () => !isFiller('어떻게 해요') },
    { name: '★빈 답은 그대로', run: () => dropEcho('', '어') === '' },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cs) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:echo — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:echo — 짧은 대꾸를 되받지 않는다(지시문 + 산출물 양쪽)');
}
