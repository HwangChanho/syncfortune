/**
 * scripts/check-talkcoin.ts — **대화 과금** 하네스 (상담가별 한도 · 운 차감 · 충전 유도)
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-24 *"상담가별로 따로해야해 하다가 운 다 떨어지면 충전 유도 해야하고"*.
 *
 * ■ ★돈이 걸린 경로라 눈으로 못 잡는다
 *   틀려도 화면은 똑같이 동작한다 — 답은 잘 나오고, 잔액만 잘못 줄거나 안 준다.
 *   그래서 **구조가 지켜지는지**를 값으로 본다:
 *     ①한도를 **상담가별**로 세는가 (계정 전체로 세면 A 와 5번 얘기하면 B 가 이미 소진이다)
 *     ②차감이 **생성 전**인가 (뒤에 하면 잔액 없는 사람에게 이미 API 원가를 쓴 뒤다)
 *     ③단가를 **서버가** 정하는가 (클라가 보내면 0원 대화가 된다)
 *     ④잔액 부족이 **충전 유도**로 이어지는가 (조용히 실패하면 사용자는 고장으로 읽는다)
 *     ⑤무료 구간에서는 **안 빼는가** (무료라면서 빼면 그게 제일 나쁘다)
 *     ⑥가상 상담사는 **0원**인가 (LLM 을 안 부르므로 받을 이유가 없다)
 *
 * 실행: npm run check:talkcoin   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';

const EDGE = 'supabase/functions/talk/index.ts';
const SCREEN = 'app/src/app/(app)/talk.tsx';
const LIVE = 'app/src/lib/talk/liveTalk.ts';

let fail = 0, pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };

console.log('\n🪙 대화 과금 하네스\n');

const edge = readFileSync(EDGE, 'utf8');

// ── ① 상담가별로 세는가 ──────────────────────────────────────────────────
console.log('=== ① 한도를 **계정 전체**로 세는가 (Boss 2026-08-25 전환) ===');
{
  // 사용량 집계 구간을 잘라서 본다(파일 전체에 `consultant_id` 가 있어도 그건 다른 용도일 수 있다)
  // ⚠️★**주석을 걷고 본다** — 내가 규칙을 설명하며 `consultant_id` 를 적었더니
  //   그 글자 때문에 검사가 물었다(같은 함정에 두 번째다 — `check:talknotes` 때도 그랬다).
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  const edgeCode = strip(edge);
  const i = edgeCode.indexOf('dayStart');
  const seg = i >= 0 ? edgeCode.slice(i, i + 1200) : '';
  // ★★2026-08-25 규칙이 **뒤집혔다**. 08-24 엔 *"상담가별로"* 였는데,
  //   그러면 사람을 갈아탈 때마다 한도가 리셋돼 **하루 60턴**(12명×5)이 공짜였다.
  //   Boss: *"상담가당 5턴 말고 **전체 상담가 기준 5턴**"*.
  //   ⇒ 집계에 `consultant_id` 가 **있으면 실패**다(정반대가 됐다).
  if (!seg) bad('사용량 집계 구간을 못 찾았다 — 하네스가 헛돈다');
  else if (/consultant_id/.test(seg)) bad('★상담가별로 센다 — 사람을 갈아타면 한도가 리셋돼 사실상 무제한이 된다');
  else if (!/in\('session_id'/.test(seg)) bad('내 세션의 메시지로 좁히지 않았다');
  else ok('계정 전체로 센다(상담가를 갈아타도 같은 한도)');

  if (/\.eq\('owner_id', uid\)/.test(seg)) ok('내 것만 센다(owner_id 고정)');
  else bad('owner_id 를 안 건다 — 남의 사용량이 섞인다');
}

// ── ② 차감이 생성 전인가 ────────────────────────────────────────────────
console.log('\n=== ② 차감이 LLM 호출 **전**인가 ===');
{
  const iSpend = edge.indexOf("spend_coins_owner");
  const iCall = edge.indexOf('anthropic.messages.create');
  if (iSpend < 0) bad('차감 호출이 없다 — 무료 대화가 된다');
  else if (iCall >= 0 && iSpend > iCall) bad('★차감이 생성 **뒤**다 — 잔액 없는 사람에게 이미 API 원가를 쓴 뒤가 된다');
  else ok('차감이 생성 전에 있다');
}

// ── ③ 단가를 서버가 정하는가 ────────────────────────────────────────────
console.log('\n=== ③ 단가를 서버가 정하는가 (클라가 보내면 0원 대화가 된다) ===');
{
  if (/c\.coin_cost/.test(edge)) ok('단가는 상담가 행(coin_cost)이 정한다');
  else bad('상담가 행에서 단가를 읽지 않는다');

  // ★요청에서 온 값이 비용이 되면 안 된다 — **두 방향으로** 본다.
  //   ①구조분해에 cost/coin 이 섞였는가 ②`coinCost` **계산식 자체**가 요청을 참조하는가
  //   (②가 없으면 `body.cost` 처럼 구조분해를 안 거치는 우회를 놓친다 — 음성 테스트로 확인했다.)
  const bodyVars = /const\s*\{[^}]*\}\s*=\s*(await\s*)?req\.json\(\)/.exec(edge)?.[0] ?? '';
  if (/cost|coin/i.test(bodyVars)) bad('★요청 바디에서 비용/코인 값을 받는다 — 클라가 0 을 보내면 공짜다');
  else ok('요청 바디 구조분해에 비용 값이 없다');

  // ⚠️★`const` 를 **글자로** 찾지 않는다 — 2026-08-27 다인방 합산을 넣으며 `let` 이 되자
  //   이 검사가 «계산식을 못 찾았다» 며 빨간불이 됐다. 코드는 옳았고 하네스가 낡은 것이었다
  //   ([[harness-judge-expression-not-name]]). ⇒ 선언 키워드를 가리지 않는다.
  const costLine = /(?:const|let|var)\s+coinCost\s*=.*$/m.exec(edge)?.[0] ?? '';
  if (!costLine) bad('coinCost 계산식을 못 찾았다 — 하네스가 헛돈다');
  else if (/\breq\b|\bbody\b|payload|params/.test(costLine)) {
    bad(`★단가 계산식이 **요청 값**을 참조한다: ${costLine.trim()}`);
  } else ok('단가 계산식이 요청을 참조하지 않는다');

  // ── ★다인방은 더 든다 (Boss 2026-08-27) ─────────────────────────────────
  //   «참여한 상담가 각자의 단가를 합산» 한다. 배수를 코드에 박지 않는 이유는
  //   조절을 관리자 콘솔(`coin_cost`)에 남겨 두기 위해서다.
  {
    // 합산이 실제로 일어나는가 — 이름이 아니라 **더하는 식**을 본다
    const sums = /coinCost\s*\+=\s*Number\(/.test(edge);
    if (sums) ok('다인방 — 참여자 단가를 합산한다');
    else bad('★다인방인데 1:1 단가로 뺀다 — Boss 지시(*"다인방은 당연히 운 소모가 더 커야해"*)와 어긋난다');

    // ⚠️**차감보다 먼저** 계산돼야 한다. 뒤에 있으면 다인방인 줄 모르고 1:1 값으로 뺀다.
    const iCost = edge.search(/coinCost\s*\+=\s*Number\(/);
    const iSpend = edge.search(/rpc\('spend_coins_owner'/);
    if (sums && iCost > 0 && iSpend > 0 && iCost < iSpend) ok('합산이 **차감보다 먼저** 일어난다');
    else if (sums) bad('★합산이 차감 뒤에 있다 — 다인방인 줄 모르고 1:1 값으로 뺀다');

    // 남의 방 값을 읽어 과금하지 않는가(소유자 확인)
    if (!sums || /owner_id\s*===\s*uid/.test(edge)) ok('방 소유자를 확인하고 읽는다');
    else bad('★남의 세션에서 참여자를 읽는다 — 소유자 확인이 없다');
  }

  if (/p_cost:\s*coinCost/.test(edge)) ok('RPC 에 서버가 읽은 값을 넘긴다');
  else bad('RPC 비용 인자가 서버 값이 아니다');
}

// ── ④ 부족 → 충전 유도 ─────────────────────────────────────────────────
console.log('\n=== ④ 잔액 부족이 충전 유도로 이어지는가 ===');
{
  if (!/needCoins/.test(edge)) bad('서버가 needCoins 를 안 내려 준다');
  else ok('서버가 needCoins 를 내려 준다');

  // ★needCoins 는 실패가 아니라 **안내**다 — 비2xx 로 내리면 supabase-js 가 error 로 삼켜 클라가 못 읽는다
  const iNeed = edge.indexOf('needCoins: true');
  const seg = iNeed >= 0 ? edge.slice(iNeed - 200, iNeed + 400) : '';
  if (/\}\s*,\s*(4|5)\d\d\s*\)/.test(seg)) bad('★needCoins 를 비2xx 로 내린다 — supabase-js 가 error 로 삼켜 화면이 못 읽는다');
  else ok('needCoins 를 200 으로 내린다(needPayment 계약과 같은 관용)');

  if (/balance/.test(seg)) ok('필요액과 함께 **잔액**도 내려 준다');
  else bad('잔액을 안 준다 — 화면이 "얼마 채워야 하는지" 못 말한다');

  const live = readFileSync(LIVE, 'utf8');
  if (/reason: 'needCoins'/.test(live)) ok('앱이 needCoins 를 사유로 받는다');
  else bad('앱이 needCoins 를 안 받는다 — 일반 실패로 뭉개진다');

  const screen = readFileSync(SCREEN, 'utf8');
  if (!/needCoins/.test(screen)) bad('화면이 needCoins 를 안 다룬다');
  else if (!/\/coins/.test(screen)) bad('★충전 화면으로 데려가지 않는다 — 유도가 아니라 통보가 된다');
  else ok('화면이 충전 화면으로 데려간다');

  // ★숫자를 말해야 한다(얼마 필요·얼마 있음)
  const iAlert = screen.indexOf("needCoinsTitle");
  const aSeg = iAlert >= 0 ? screen.slice(iAlert - 600, iAlert + 900) : '';
  if (/\{\{cost\}\}/.test(aSeg) && /\{\{have\}\}/.test(aSeg)) ok('필요액과 보유액을 **숫자로** 말한다');
  else bad('"부족합니다"만 말한다 — 얼마를 채워야 하는지 알 수 없다');
}

// ── ⑤ 무료 구간에서는 안 뺀다 ───────────────────────────────────────────
console.log('\n=== ⑤ 무료 구간에서는 빼지 않는가 ===');
{
  const i = edge.indexOf('overFree');
  const seg = i >= 0 ? edge.slice(i, i + 900) : '';
  // ⚠️★조건에 **다른 항이 더 붙어도** 통과시킨다(2026-08-26).
  //   묶음 과금(`packStart`)을 넣으면서 `if (overFree && packStart && coinCost > 0)` 이 됐는데,
  //   종전 정규식은 **정확히 두 항**만 인정해서 «더 엄격해진 코드»를 반려했다.
  //   ⇒ 지켜야 할 것은 **«무료 판정(overFree)과 단가 판정이 그 if 안에 있는가»** 이지 항의 개수가 아니다.
  //   ★단, 둘 다 없으면 여전히 문다(아래 음성 테스트).
  const guard = /if\s*\(([^)]*)\)\s*\{/.exec(seg)?.[1] ?? '';
  if (/\boverFree\b/.test(guard) && /coinCost\s*>\s*0/.test(guard)) ok('무료를 넘겼고 단가가 0보다 클 때만 뺀다');
  else bad('★무료 구간 판정 없이 뺀다 — 무료라면서 빼는 것이 제일 나쁘다');
}

// ── ⑥ DB 실측 ───────────────────────────────────────────────────────────
console.log('\n=== ⑥ DB 실측 — 단가·한도가 실제로 어떻게 잡혀 있나 ===');
{
  const env = readFileSync('.env', 'utf8');
  const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
  const URL_BASE = pick('SUPABASE_URL');
  const ANON = pick('SUPABASE_ANON_KEY');
  if (!URL_BASE || !ANON) console.log('  ·  .env 없음 — DB 대조 생략');
  else {
    try {
      const res = await fetch(`${URL_BASE}/rest/v1/consultants?select=name,kind,free_daily,daily_cap,coin_cost&enabled=eq.true`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as { name: string; kind: string; free_daily: number; daily_cap: number; coin_cost: number }[];
      if (rows.some((r) => r.coin_cost == null)) bad('coin_cost 컬럼이 없다 — 마이그레이션(0041)을 적용할 것');
      else ok(`활성 ${rows.length}명 · 단가 ${[...new Set(rows.map((r) => r.coin_cost))].join('/')}운 · 무료 ${[...new Set(rows.map((r) => r.free_daily))].join('/')}회`);

      // 가상 상담사는 LLM 을 안 부른다 → 받을 이유가 없다
      const paidVirtual = rows.filter((r) => r.kind === 'virtual' && r.coin_cost > 0);
      if (paidVirtual.length) bad(`가상 상담가가 유료다: ${paidVirtual.map((r) => r.name).join(' · ')} — 원가 0 인데 받는다`);
      else ok('가상 상담가는 0운');

      // 상한이 무료보다 작으면 유료 구간이 아예 없다(설정 실수)
      const weird = rows.filter((r) => r.daily_cap <= r.free_daily && r.coin_cost > 0);
      if (weird.length) bad(`상한 ≤ 무료라 유료 구간이 없다: ${weird.map((r) => r.name).join(' · ')}`);
      else ok('무료 < 상한 (유료 구간이 존재한다)');
    } catch (e) {
      console.log(`  ·  DB 조회 실패(${(e as Error).message}) — 코드 검사만 수행`);
    }
  }
}

// ── ⑦ 차감 «영수증» 한 줄 (Boss 2026-08-26) ─────────────────────────────
//   *"운이 차감될때마다 말풍선없이 가운데 정렬로 작은 글씨로 얼마의 운이 차감됐는지"*
//   ★이건 **돈 문구**다. 앱이 단가를 지어내면 운영자가 `coin_cost` 를 바꾼 순간
//     화면과 실제 차감이 갈린다 — 사용자는 화면을 믿는다. [[pay-alert-must-show-numbers]]
{
  console.log('\n=== ⑦ 운 차감 표시 ===');
  const screen = readFileSync(SCREEN, 'utf8');
  const code = screen.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const live = readFileSync(LIVE, 'utf8');

  if (!/talk\.spent/.test(code)) bad('차감 표시가 없다 — 얼마가 빠졌는지 사용자가 모른다');
  else {
    ok('차감 표시가 있다');
    const seg = code.slice(Math.max(0, code.indexOf('talk.spent') - 600), code.indexOf('talk.spent') + 300);
    // (1) 서버가 준 값만 쓰는가
    //   ⚠️★«주변에 spent 라는 글자가 있나» 로 보면 안 된다 — 음성 테스트에서 실제로 뚫렸다.
    //     `String(2)` 로 바꿔도 위쪽 `const spent = Number(r.spent ?? 0)` 때문에 통과했다.
    //     ⇒ **그 줄의 치환 표현식**을 본다. [[harness-judge-expression-not-name]]
    const spentLine = (code.match(/t\('talk\.spent'[^\n]*/) ?? [''])[0];
    const sub = (spentLine.match(/\.replace\([^,]+,\s*([^)]*\))\s*\)/) ?? [])[1] ?? '';
    if (!spentLine) bad('talk.spent 를 쓰는 줄을 못 찾았다 — 하네스가 헛돈다');
    else if (/\bString\(\s*\d/.test(sub) || !/\bspent\b/.test(sub)) {
      bad(`★표시 숫자가 서버 spent 가 아니다(치환값: ${sub || '없음'}) — 앱이 단가를 지어내면 실제 차감과 갈린다`);
    } else ok('숫자는 서버가 준 `spent` 만 쓴다(치환 표현식으로 확인)');
    // (2) 0 이면 안 띄우는가 — 무료 구간에서 «0운 사용» 은 거짓말이다
    if (!/spent\s*>\s*0/.test(seg)) bad('0 일 때도 띄운다 — 무료 구간에서 «0운 사용» 은 사실이 아니다');
    else ok('0 이면 띄우지 않는다');
    // (3) 말풍선이 아닌가 — Boss 가 «말풍선없이» 라고 못박았다
    if (!/system:/.test(seg)) bad('★말풍선으로 띄운다 — Boss 는 «말풍선없이 가운데 작은 글씨» 라고 했다');
    else ok('말풍선이 아니라 시스템 한 줄이다');
  }
  // (4) 서버가 실제로 `spent` 를 내려주는가 — 앱만 고치면 영원히 0 이다
  if (!/spent/.test(live)) bad(`${LIVE} 가 서버 응답의 spent 를 안 읽는다`);
  else ok('앱이 서버 응답의 spent 를 읽는다');
  if (!/spent/.test(edge)) bad('서버가 spent 를 안 내려준다');
  else ok('서버가 spent 를 내려준다');
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 대화 과금이 어긋나 있다.');
  console.log('      `supabase/functions/talk/index.ts`(집계·차감) · `lib/talk/liveTalk.ts`(사유) ·');
  console.log('      `app/(app)/talk.tsx`(충전 유도) · 마이그레이션 0041 을 본다.\n');
  process.exit(1);
}
console.log('   🎯 통과 — **계정 전체** 집계 · 생성 전 차감 · 서버 단가 · 충전 유도\n');
