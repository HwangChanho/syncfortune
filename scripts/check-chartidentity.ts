// scripts/check-chartidentity.ts — 상담가가 **내 사주를** 제대로 말하는가
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"지금 사주쎔이 자기 일간도 못 맞추고 있어"*
//
// 실측해 보니 **원인이 둘**이었다(하나로 보였지만 아니었다):
//
//  ① **말하지 못하게 막혀 있었다.** (Boss 최종 방향: *"전문용어 말해도 된다니깐 대신 옆에 설명을 달아줘"*
//     ⇒ 금지 예외가 아니라 **«용어(쉬운 말)» 동반 표기**로 간다.)
//     `prompts.ts` 원칙6 이 명리 용어·한자를 전부 금지하고 **일간을 콕 집어** 예로 든다
//     (`일간("나의 중심 기질" ⭕)`). 대화도 그 지문을 상속한다.
//     ⇒ "내 일간이 뭐야?" 에 답할 방법이 아예 없었다.
//     실제 대화 기록에 **회원이 *"나는 신금인데"* 라고 대신 알려 준** 장면이 남아 있다.
//     ★그 금지는 «묻지 않은 용어를 늘어놓지 마라» 는 뜻이지 «물어도 답하지 마라» 가 아니다.
//
//  ② **다른 사람 사주를 읽고 있었다.**
//     `preferSelfAsRep` 이 `relation==='self'` 인 **배열 첫 번째**를 대표로 삼았다.
//     본인 명식을 여럿 등록해 두면 **앱을 켤 때마다 대표가 바뀐다.**
//     실측: 같은 사람의 08-25 세션은 일간 辛 차트, 08-26 세션은 일간 庚 차트를 물고 있었다.
//
// ⚠️★①만 고치면 «틀린 사주를 또렷하게 말하는» 앱이 된다 — 더 나쁘다. 둘을 **같이** 지킨다.
//
// ★음성 테스트: `npx tsx scripts/check-chartidentity.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const TALK = 'supabase/functions/talk/index.ts';
const MYCHART = 'app/src/lib/engine/myChart.ts';

export type Fail = { rule: string; msg: string };
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
const read = (p: string): string | null => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

/** ① 물으면 답하는 예외가 살아 있는가. (주석이 아니라 **프롬프트 문자열**을 본다) */
export function judgeAskException(src: string): Fail[] {
  const out: Fail[] = [];
  // TALK_COMMON 템플릿 안쪽만 본다 — 여긴 모델이 실제로 읽는 글이다
  const i = src.indexOf('const TALK_COMMON');
  const seg = i < 0 ? '' : src.slice(i, i + 12000);
  if (!seg) { out.push({ rule: 'C1', msg: 'TALK_COMMON 을 못 찾았다 — 하네스가 헛돈다' }); return out; }
  // ★Boss 2026-08-26 *"전문용어 말해도 된다니깐 대신 옆에 설명을 달아줘"* — 금지가 아니라 **설명 동반**이다
  if (!/전문용어를 써도 된다/.test(seg)) {
    out.push({ rule: 'C1', msg: '★«전문용어를 써도 된다» 가 없다 — 상속받은 원칙6(용어 전면 금지)이 그대로 살아나 "내 일간?" 에 답을 못 한다' });
  }
  if (!/설명을 붙인다|설명을 달아/.test(seg)) {
    out.push({ rule: 'C1', msg: '★설명 동반 규칙이 없다 — 용어만 던지면 회원은 무슨 말인지 모른다(Boss 가 «대신 옆에 설명» 이라고 했다)' });
  }
  if (!/고쳐 읽어라/.test(seg)) {
    out.push({ rule: 'C1', msg: '★상속 규칙(원칙6)을 **명시적으로 덮어쓰지** 않는다 — 공용 지문이 이긴다([[shared-block-eats-personality]])' });
  }
  if (!/일간/.test(seg)) {
    out.push({ rule: 'C1', msg: '«일간» 예시가 없다 — 가장 많이 묻는 것이다' });
  }
  if (!/자랑하지 마라/.test(seg)) {
    out.push({ rule: 'C1', msg: '★범위 제한이 없다 — 열어 두면 안부 인사에도 십신이 나온다' });
  }
  return out;
}

/** ② 대표 명식이 앱 실행마다 갈아치워지지 않는가. */
export function judgeRepStability(src: string): Fail[] {
  const out: Fail[] = [];
  const code = codeOnly(src);
  const i = code.indexOf('preferSelfAsRep');
  const seg = i < 0 ? '' : code.slice(i, i + 900);
  if (!seg) { out.push({ rule: 'C2', msg: 'preferSelfAsRep 을 못 찾았다 — 하네스가 헛돈다' }); return out; }
  // ★«지금 대표가 이미 self 면 그대로 둔다» 라는 **조기 반환**이 있어야 한다.
  //   이름이 아니라 **구조**로 본다: cur 를 charts 에서 찾아 relation 을 확인하고 return.
  const keeps = /charts\.some\(\([^)]*\)\s*=>[^)]*\.id\s*===\s*cur[\s\S]{0,80}relation\s*===\s*'self'[\s\S]{0,40}\)\s*\)\s*return/.test(seg);
  if (!keeps) {
    out.push({ rule: 'C2', msg: "★지금 대표가 이미 «본인» 이어도 갈아치운다 — 본인 명식이 여럿이면 **앱을 켤 때마다 대표가 바뀌고**, 상담가가 다른 사람 사주를 읽는다" });
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const talk = read(TALK) ?? '';
  const my = read(MYCHART) ?? '';
  const t = (l: string, v: boolean) => { console.log(`  ${v ? '✅' : '❌'} ${l}`); return v; };
  const r = [
    t('현재 프롬프트는 예외를 갖고 있다', judgeAskException(talk).length === 0),
    t('«써도 된다» 를 지우면 **잡는다**', judgeAskException(talk.replace(/전문용어를 써도 된다/g, '어쩌고')).length > 0),
    t('«설명 붙인다» 를 지우면 **잡는다**', judgeAskException(talk.replace(/설명을 붙인다/g, '어쩌고').replace(/설명을 달아/g,'어쩌고')).length > 0),
    t('상속 덮어쓰기를 지우면 **잡는다**', judgeAskException(talk.replace(/고쳐 읽어라/g, '어쩌고')).length > 0),
    t('현재 preferSelfAsRep 은 안정적이다', judgeRepStability(my).length === 0),
    t('«이미 self 면 유지» 를 지우면 **잡는다**',
      judgeRepStability(my.replace(/if \(cur && charts\.some[\s\S]*?return;/, '')).length > 0),
  ];
  const ok = r.every(Boolean);
  console.log(ok ? '✅ selftest 통과' : '❌ selftest 실패');
  process.exit(ok ? 0 : 1);
}

const fails: Fail[] = [];
{
  const talk = read(TALK);
  if (talk == null) fails.push({ rule: 'C0', msg: `${TALK} 이 없다` });
  else fails.push(...judgeAskException(talk));
  const my = read(MYCHART);
  if (my == null) fails.push({ rule: 'C0', msg: `${MYCHART} 이 없다` });
  else fails.push(...judgeRepStability(my));
}

if (!fails.length) {
  console.log('✅ check:chartidentity — 물으면 일간을 답한다 · 대표 명식이 실행마다 안 바뀐다');
  process.exit(0);
}
console.error(`❌ check:chartidentity — ${fails.length}건\n`);
for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
console.error('\n  ⚠️둘을 같이 지켜야 한다 — 말하게만 하면 **틀린 사주를 또렷하게** 말하는 앱이 된다.');
process.exit(1);
