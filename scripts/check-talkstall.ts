/**
 * scripts/check-talkstall.ts — **API 가 멈췄을 때** 대화·돈이 새지 않는가
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-24 *"클로드 api 가 멈췄을때 대화는 계속 이어질수있게 자연스럽게 안내하고
 *   설명하면서 기다려달라는식의 대화가 이어지면 좋겠어"*.
 *
 * ■ ★여기서 틀리면 **돈이 사라진다**
 *   차감은 생성 **전**에 한다(못 낼 사람에게 API 원가를 안 쓰려고 — 의도된 설계).
 *   그런데 생성이 실패하면 그 돈은 **아무것도 안 산 돈**이다.
 *   종전엔 환불이 없어서 1운 내고 오류 문구를 받았다.
 *
 * ■ ★"기다려 주세요" 는 **약속**이다
 *   기다리라고 해 놓고 다시 보내지 않으면 그건 거짓말이다.
 *   그래서 *문구*와 *재시도*가 **짝으로** 있는지 본다. 그리고 무한 재시도도 막는다.
 *
 * 실행: npm run check:talkstall   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';
import { isRetryable, stallLine, stallGiveUpLine } from '../supabase/functions/_shared/talkStall.ts';

const EDGE = 'supabase/functions/talk/index.ts';
const LIVE = 'app/src/lib/talk/liveTalk.ts';
const SCREEN = 'app/src/app/(app)/talk.tsx';

let fail = 0, pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };

console.log('\n⏳ 대화 멈춤 응대 하네스\n');

// ── ① 무엇을 다시 해 볼 것인가 (실행 검증) ──────────────────────────────
console.log('=== ① 되돌릴 수 있는 실패만 재시도하는가 ===');
{
  const retry: [string, unknown][] = [
    ['529 과부하', { status: 529 }], ['429 혼잡', { status: 429 }], ['502 게이트웨이', { status: 502 }],
    ['타임아웃', new Error('Request timed out')], ['연결 끊김', new Error('fetch failed ECONNRESET')],
  ];
  const noRetry: [string, unknown][] = [
    ['401 인증', { status: 401 }], ['400 요청오류', { status: 400 }], ['알 수 없는 오류', new Error('보통 오류')],
  ];
  const missA = retry.filter(([, e]) => !isRetryable(e)).map(([n]) => n);
  const missB = noRetry.filter(([, e]) => isRetryable(e)).map(([n]) => n);
  if (missA.length) bad(`다시 해 볼 만한데 안 한다: ${missA.join(' · ')}`);
  else ok('과부하·혼잡·5xx·타임아웃은 재시도 대상');
  // ★음성 테스트 — 전부 true 를 뱉으면 위 검사는 통과한다. **아닌 것도 골라내는지** 본다.
  if (missB.length) bad(`★다시 해도 같은데 재시도한다: ${missB.join(' · ')} — 기다리라 해 놓고 또 실패한다`);
  else ok('음성 테스트 — 인증·요청오류는 재시도하지 않는다');
}

// ── ② 문구가 거짓말을 하지 않는가 ───────────────────────────────────────
console.log('\n=== ② 문구 ===');
{
  const a = stallLine('노쌤', 0), b = stallLine('노쌤', 1);
  if (a !== b) ok('문구가 돌아간다(매번 같은 말이 아니다)');
  else bad('항상 같은 문장이다 — 두 번 겹치면 기계 티가 난다');

  // "생각 중" 처럼 **답이 오고 있는 척**하면 안 된다
  if (/생각 중|작성 중|만들고 있|분석 중/.test(a + b)) bad('★답이 오고 있는 척한다 — 실제로는 실패한 것이다');
  else ok('답이 오는 척하지 않는다');

  const give = stallGiveUpLine(1);
  if (/돌려/.test(give)) ok('접을 때 **환불 사실**을 말한다');
  else bad('★환불했는데 말을 안 한다 — 사용자는 돈만 나갔다고 생각한다');
  if (!/돌려/.test(stallGiveUpLine(0))) ok('무료 구간에선 환불 이야기를 안 한다');
  else bad('안 뺐는데 돌려줬다고 말한다');
}

// ── ③ 돈 — 실패하면 돌려주는가 ──────────────────────────────────────────
console.log('\n=== ③ 생성 실패 시 환불 ===');
{
  const edge = readFileSync(EDGE, 'utf8');
  const i = edge.indexOf('const stalled =');
  const seg = i >= 0 ? edge.slice(i, i + 1600) : '';
  if (!seg) bad('멈춤 응대 자리를 못 찾았다 — 하네스가 헛돈다');
  else {
    if (/grant_coins/.test(seg) && /p_reason: 'refund'/.test(seg)) ok('차감분을 `grant_coins`(refund)로 되돌린다');
    else bad('★환불하지 않는다 — 1운 내고 오류 문구를 받는다');
    if (/if \(spent > 0\)/.test(seg)) ok('뺀 게 있을 때만 돌려준다');
    else bad('무료 구간에도 환불을 시도한다(없는 돈을 준다)');
    if (/console\.error\(.*환불 실패/.test(seg)) ok('환불 실패를 크게 남긴다');
    else bad('★환불 실패를 조용히 넘긴다 — 돈이 사라진 걸 아무도 모른다');
  }
  // 차감액이 실제로 기록되는가(안 하면 위 `spent > 0` 이 영원히 거짓)
  if (/spent = coinCost/.test(edge)) ok('차감 성공 시 금액을 기억한다');
  else bad('★차감액을 안 기억한다 — 환불이 영원히 안 돈다');
}

// ── ④ 200 으로 내리는가 ─────────────────────────────────────────────────
console.log('\n=== ④ 화면이 사유를 읽을 수 있는가 ===');
{
  const edge = readFileSync(EDGE, 'utf8');
  const i = edge.indexOf('stalled: true');
  const seg = i >= 0 ? edge.slice(i - 300, i + 500) : '';
  if (/\}\s*,\s*(4|5)\d\d\s*\)/.test(seg)) bad('★비2xx 로 내린다 — supabase-js 가 error 로 삼켜 화면이 못 읽는다');
  else ok('200 으로 내린다(needCoins 와 같은 관용)');

  const live = readFileSync(LIVE, 'utf8');
  if (/reason: 'stalled'/.test(live)) ok('앱이 사유를 `stalled` 로 받는다');
  else bad('앱이 일반 실패로 뭉갠다');
}

// ── ⑤ 기다리라 했으면 **실제로** 다시 보내는가 ──────────────────────────
console.log('\n=== ⑤ "기다려 주세요"가 약속인가 ===');
{
  const screen = readFileSync(SCREEN, 'utf8');
  const i = screen.indexOf("r.reason === 'stalled'");
  const seg = i >= 0 ? screen.slice(i, i + 1400) : '';
  if (!seg) bad('화면에 멈춤 분기가 없다');
  else {
    if (/setTimeout/.test(seg) && /attempt \+ 1/.test(seg)) ok('기다린 뒤 **실제로** 다시 보낸다');
    else bad('★기다리라고만 하고 다시 안 보낸다 — 거짓말이다');
    if (/if \(gen !== genRef\.current\) return/.test(seg)) ok('그 사이 방이 바뀌면 조용히 끝낸다');
    else bad('방이 바뀌어도 옛 질문을 다시 보낸다');
    if (!/setBusy\(false\)/.test(seg.slice(0, seg.indexOf('} else') >= 0 ? seg.indexOf('} else') : 400))) ok('재시도 중에는 점 세 개를 끄지 않는다');
    else bad('재시도 중인데 점을 꺼서 끝난 것처럼 보인다');
  }
  // 무한 재시도 금지 — 서버가 회차를 보고 접는다
  const edge = readFileSync(EDGE, 'utf8');
  if (/Number\(attempt\) < 1/.test(edge)) ok('두 번째는 접는다(무한 재시도 없음)');
  else bad('★재시도 상한이 없다 — 막힌 API 를 계속 두드린다');
}

// ── ⑥ 회차가 과금을 건드리지 않는가 ─────────────────────────────────────
console.log('\n=== ⑥ `attempt` 가 과금에 영향을 주지 않는가 ===');
{
  const edge = readFileSync(EDGE, 'utf8');
  const costLine = /const\s+coinCost\s*=.*$/m.exec(edge)?.[0] ?? '';
  if (costLine && !/attempt/.test(costLine)) ok('단가 계산식이 회차를 참조하지 않는다');
  else bad('★회차가 단가에 섞였다 — 클라가 회차를 조작해 공짜로 만든다');
  const freeLine = /const\s+overFree\s*=.*$/m.exec(edge)?.[0] ?? '';
  if (freeLine && !/attempt/.test(freeLine)) ok('무료 판정이 회차를 참조하지 않는다');
  else bad('★회차가 무료 판정에 섞였다');
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 멈춤 응대가 어긋나 있다.');
  console.log('      `_shared/talkStall.ts`(판정·문구) · `talk/index.ts`(환불·200) · `talk.tsx`(재시도).\n');
  process.exit(1);
}
console.log('   🎯 통과 — 재시도 판정 · 환불 · 200 · 실제 재시도 · 상한 · 과금 무관\n');
