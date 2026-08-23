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
console.log('=== ① 한도를 상담가별로 세는가 ===');
{
  // 사용량 집계 구간을 잘라서 본다(파일 전체에 `consultant_id` 가 있어도 그건 다른 용도일 수 있다)
  const i = edge.indexOf('dayStart');
  const seg = i >= 0 ? edge.slice(i, i + 1200) : '';
  if (!seg) bad('사용량 집계 구간을 못 찾았다 — 하네스가 헛돈다');
  else if (!/consultant_id/.test(seg)) bad('★계정 전체로 센다 — A 와 5번 얘기하면 B 가 이미 소진 상태가 된다');
  else if (!/in\('session_id'/.test(seg)) bad('상담가는 걸렀는데 그 세션의 메시지로 좁히지 않았다');
  else ok('(계정 × 상담가)로 센다');

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

  const costLine = /const\s+coinCost\s*=.*$/m.exec(edge)?.[0] ?? '';
  if (!costLine) bad('coinCost 계산식을 못 찾았다 — 하네스가 헛돈다');
  else if (/\breq\b|\bbody\b|payload|params/.test(costLine)) {
    bad(`★단가 계산식이 **요청 값**을 참조한다: ${costLine.trim()}`);
  } else ok('단가 계산식이 요청을 참조하지 않는다');

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
  if (/if\s*\(overFree\s*&&\s*coinCost\s*>\s*0\)/.test(seg)) ok('무료를 넘겼고 단가가 0보다 클 때만 뺀다');
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

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 대화 과금이 어긋나 있다.');
  console.log('      `supabase/functions/talk/index.ts`(집계·차감) · `lib/talk/liveTalk.ts`(사유) ·');
  console.log('      `app/(app)/talk.tsx`(충전 유도) · 마이그레이션 0041 을 본다.\n');
  process.exit(1);
}
console.log('   🎯 통과 — 상담가별 집계 · 생성 전 차감 · 서버 단가 · 충전 유도\n');
