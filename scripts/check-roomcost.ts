#!/usr/bin/env tsx
/**
 * check:roomcost — 오픈채팅방의 **원가 배수**와 **차트 유출**을 막는다.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (2026-08-21 · 오픈채팅)
 *   방은 1:1 과 위험이 다르다. **한 턴에 답하는 AI 수가 그대로 원가 배수**다 —
 *   실측 기반: 턴당 1명 ₩4 · 3명 ₩13 · 7명 ₩31. 방 30턴이면 3명일 때 ₩399
 *   (1:1 대화 10턴이 ₩43인 것과 견주면 9배).
 *   ★그리고 이 사고는 **화면상 아무 차이가 없다** — 답이 여러 개 뜨는 건 원래 그런 화면이다.
 *
 *   또 하나: 방은 **여러 사람이 보는 자리**다. 1:1 처럼 차트를 프롬프트에 실으면
 *   남의 방에 내 원국이 흘러간다(여덟 글자 = 생년월일 역산).
 *
 * 규칙
 *   R1 응답 AI 수를 **서버 값**(`rooms.ai_per_turn`)에서 읽고 상한을 건다
 *   R2 하루 턴 상한(`daily_turn_cap`)을 본다
 *   R3 `kind === 'solo'` 일 때만 차트를 싣는다 (open 방에 차트 금지)
 *   R4 AI 메시지 쓰기가 앱에 열려 있지 않다(RLS 가 `ai_id is null` 을 요구)
 *
 * 사용: npm run check:roomcost · 자가테스트: npx tsx scripts/check-roomcost.ts --selftest
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_FN = 'supabase/functions/room/index.ts';
const MIG_DIR = 'supabase/migrations';

type Fail = { rule: string; msg: string };
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

/**
 * 방 원가·유출 장치를 검사한다.
 * @param fn  `room/index.ts` 원문
 * @param sql 마이그레이션 전체
 */
export function audit(fn: string, sql: string): Fail[] {
  const out: Fail[] = [];
  const f = code(fn);

  // R1 — 응답 수를 서버 값에서 읽고, 코드가 상한을 건다
  if (!/room\.ai_per_turn/.test(f)) {
    out.push({ rule: 'R1', msg: `${P_FN} 이 rooms.ai_per_turn 을 안 본다 — 응답 AI 수가 곧 원가 배수인데 배포 없이 못 조인다` });
  }
  // ⚠️★`Math.min` 만 찾으면 안 된다 — 이 파일엔 `max_tokens: Math.min(...)` 도 있어서
  //   **응답 수 상한을 지워도 통과**했다(음성 테스트에서 드러났다).
  //   ⇒ `ai_per_turn` 과 **같은 식 안**에 상한이 있는지 본다.
  if (/room\.ai_per_turn/.test(f) && !/Math\.min\([^)]*ai_per_turn[^)]*\)/.test(f)) {
    out.push({ rule: 'R1', msg: `${P_FN} 의 ai_per_turn 에 상한(Math.min)이 없다 — 값이 커지면 한 턴에 열두 명이 답한다(턴당 ₩31 → 그 이상)` });
  }
  // R2 — 하루 턴 상한
  if (!/daily_turn_cap/.test(f)) {
    out.push({ rule: 'R2', msg: `${P_FN} 이 daily_turn_cap 을 안 본다 — 방 하나가 하루 종일 돌면 천장이 없다` });
  }
  // R3 — open 방에 차트 금지
  if (/buildTalkChartBlock/.test(f) && !/kind\s*===\s*'solo'/.test(f)) {
    out.push({ rule: 'R3', msg: `${P_FN} 이 방 종류를 가리지 않고 차트를 싣는다 — **여러 사람이 보는 방에 원국(=생년월일 역산 재료)이 흘러간다**` });
  }
  // R4 — 앱이 AI 이름으로 못 쓴다
  const pol = sql.match(/create policy room_messages_write[\s\S]*?;/)?.[0] ?? '';
  if (!pol) {
    out.push({ rule: 'R4', msg: 'room_messages 쓰기 정책이 없다 — 앱이 아무 이름으로나 글을 쓸 수 있다' });
  } else if (!/ai_id\s+is\s+null/.test(pol)) {
    out.push({ rule: 'R4', msg: '쓰기 정책이 ai_id is null 을 요구하지 않는다 — **앱이 상담가 이름으로 하지 않은 말을 지어낼 수 있다**' });
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  // ★픽스처에 `max_tokens: Math.min(...)` 을 함께 둔다 — 이게 R1 을 속였던 실제 모양이다
  const okFn = `
    max_tokens: Math.min(Number(p.max_out_tok) || 380, 240),
    const cap = Math.max(1, Math.min(Number(room.ai_per_turn) || 3, 5));
    if ((usedToday ?? 0) >= room.daily_turn_cap) return json({ capped: true });
    if (room.kind === 'solo' && room.owner_id === uid) { chartBlock = buildTalkChartBlock(c, []); }`;
  const okSql = `create policy room_messages_write on public.room_messages
      for insert to authenticated with check (user_id = auth.uid() and ai_id is null);`;
  const cases: Array<[string, number]> = [
    ['정상', audit(okFn, okSql).length],
    ['응답 수를 코드에 박음', audit(okFn.replace('Number(room.ai_per_turn) || 3', '3'), okSql).length],
    // ★응답 수 상한만 지운다(max_tokens 의 Math.min 은 그대로 둔다) — 이게 속였던 모양이다
    ['상한 없음(max_tokens 의 min 은 남아 있음)',
      audit(okFn.replace('Math.max(1, Math.min(Number(room.ai_per_turn) || 3, 5))', 'Number(room.ai_per_turn)'), okSql).length],
    ['하루 상한 없음', audit(okFn.replace('room.daily_turn_cap', '999'), okSql).length],
    ['open 방에도 차트를 실음', audit(okFn.replace("room.kind === 'solo' && ", ''), okSql).length],
    ['앱이 AI 이름으로 쓸 수 있음', audit(okFn, okSql.replace('and ai_id is null', '')).length],
    ['쓰기 정책 자체가 없음', audit(okFn, '').length],
    // ★주석에만 적힌 경우는 오탐이면 안 된다
    ['주석 속 언급(정상)', audit(`// ai_per_turn 은 원가 배수다\n` + okFn, okSql).length],
  ];
  const want = [0, 1, 1, 1, 1, 1, 1, 0];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!ok) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : `\n✅ check:roomcost 자가테스트 통과 (${cases.length}케이스)`);
  process.exit(bad ? 1 : 0);
}

if (!existsSync(join(ROOT, P_FN))) {
  console.log('⚠️  supabase/functions/room 없음 — 스킵(이 저장소에서 Edge 는 gitignore 대상)');
  process.exit(0);
}
const sql = readdirSync(join(ROOT, MIG_DIR)).filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(ROOT, MIG_DIR, f), 'utf8')).join('\n');
const fails = audit(readFileSync(join(ROOT, P_FN), 'utf8'), sql);
if (fails.length) {
  console.error(`❌ check:roomcost — ${fails.length}건 · 방 원가가 배수로 뛰거나 원국이 새어 나간다`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:roomcost — 응답 수·하루 상한이 서버 값 · open 방에 차트 없음 · AI 이름 위조 불가');
