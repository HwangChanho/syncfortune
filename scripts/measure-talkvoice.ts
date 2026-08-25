/**
 * scripts/measure-talkvoice.ts: 대화 말투를 **저장된 답변에서 실측**한다
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-26 *"지금 말투들이 너무 ai같고 딱딱해 개성이 더강해야하고 사람같아야해"*.
 *
 * ■ 왜 이 파일이 따로 있나
 *   `check:persona` 는 **지시문**을 검사한다 — "이렇게 말하라고 적혀 있는가".
 *   그런데 2026-08-26 에 드러난 사고는 정확히 그 틈에서 났다:
 *     말투에 호칭이 **적혀 있었는데도** 실제 답변 40건 중 31건이 "당신" 을 썼다.
 *   ⇒ 적힌 것과 **나온 것**은 다르다. 여기서는 **나온 것**을 잰다.
 *
 * ■ ⚠️API 를 새로 호출하지 않는다 (CLAUDE.md 절대 0)
 *   이미 `talk_messages` 에 저장된 답변을 읽을 뿐이다. 크레딧 0.
 *   ⇒ Boss 가 앱에서 실제로 대화한 뒤 이걸 돌리면 바뀌었는지 바로 보인다.
 *
 * ■ 기준선 (2026-08-26 고치기 **직전** · 저장된 답변 전량 52건)
 *   ⚠️★이 숫자들은 **이 스크립트가 쓰는 바로 그 자**로 잰 값이다.
 *     처음엔 다른 정규식으로 잰 값(설명체 45%)을 기준선에 적었는데, 스크립트는 3.8% 를 냈다 —
 *     **자가 다르면 «좋아졌다» 가 착시가 된다.** 그래서 같은 자로 다시 쟀다.
 *   | 지표 | Boss 정답 예시 33건 | 고치기 직전 |
 *   |---|---|---|
 *   | "당신" 쓴 답변 | **0%** | **65.4%** (83회) |
 *   | 풍선 3~4개    | 0%      | **96.2%** |
 *   | 8자 이하 짧은 풍선 | 4.8%  | 5.4% |
 *   | 설명체 마무리   | 0%      | 3.8% |
 *   목표는 Boss 정답 쪽으로 가는 것이다. **완전히 같을 필요는 없다.**
 *   ★가장 크게 움직여야 하는 건 «당신» 과 «풍선 3~4개» 다.
 *
 * 실행: npx tsx scripts/measure-talkvoice.ts [건수]
 */
import { readFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
const URL_BASE = pick('SUPABASE_URL');
const SVC = pick('SUPABASE_SERVICE_ROLE_KEY');
const N = Number(process.argv[2] ?? 60);

if (!URL_BASE || !SVC) { console.error('❌ .env 에 SUPABASE_URL / SERVICE_ROLE_KEY 가 없다'); process.exit(1); }

const h = { apikey: SVC, Authorization: `Bearer ${SVC}` };
const q = (p: string) => fetch(`${URL_BASE}/rest/v1/${p}`, { headers: h }).then((r) => r.json());

const msgs = await q(`talk_messages?select=session_id,body,sent_at&role=eq.assistant&order=sent_at.desc&limit=${N}`) as any[];
const sess = await q('talk_sessions?select=id,consultant_id&limit=500') as any[];
if (!Array.isArray(msgs) || !msgs.length) { console.log('저장된 답변이 없다 — 앱에서 대화한 뒤 다시 실행하세요.'); process.exit(0); }

const who = new Map(sess.map((s) => [s.id, s.consultant_id]));
const bodies = msgs.map((m) => String(m.body ?? ''));

// ── 지표 ─────────────────────────────────────────────────────────────────
const dangCnt = bodies.filter((b) => /당신/.test(b)).length;
const dangTot = bodies.reduce((a, b) => a + (b.match(/당신/g) ?? []).length, 0);
const bubbles = bodies.map((b) => b.split('\n\n').filter((x) => x.trim()).length);
const three4 = bubbles.filter((n) => n === 3 || n === 4).length;
const allB = bodies.flatMap((b) => b.split('\n\n').map((x) => x.trim()).filter(Boolean));
const shortB = allB.filter((x) => x.length <= 8).length;
// 설명체 마무리 — 자기 말을 다시 풀이하는 것
const splain = bodies.filter((b) => /(라는 뜻이에요|라는 거죠|인 거예요)/.test(b)).length;

const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`;
console.log(`\n🗣  대화 말투 실측 — 최근 답변 ${bodies.length}건 (${msgs[msgs.length - 1].sent_at.slice(0, 16)} ~ ${msgs[0].sent_at.slice(0, 16)})\n`);
const row = (label: string, now: string, before: string, want: string) =>
  console.log(`  ${label.padEnd(22)} 지금 ${now.padStart(7)}   (전 ${before.padStart(6)} · 목표 ${want})`);
row('"당신" 쓴 답변', pct(dangCnt, bodies.length), '65.4%', '0%');
row('  └ 총 횟수', `${dangTot}회`, '83회', '0회');
row('풍선 3~4개 고정', pct(three4, bodies.length), '96.2%', '낮을수록');
row('8자 이하 짧은 풍선', pct(shortB, allB.length), '5.4%', '4.8%↑');
row('설명체 마무리', pct(splain, bodies.length), '3.8%', '낮을수록');

console.log(`\n  풍선 개수 분포: ${JSON.stringify(bubbles.reduce((a: any, n) => (a[n] = (a[n] ?? 0) + 1, a), {}))}`);

// ── 상담가별 "당신" (말투에 호칭이 적힌 사람이 어기고 있나) ───────────────
const byC = new Map<string, { n: number; d: number }>();
msgs.forEach((m, i) => {
  const c = who.get(m.session_id) ?? '?';
  const e = byC.get(c) ?? { n: 0, d: 0 };
  e.n++; if (/당신/.test(bodies[i])) e.d++;
  byC.set(c, e);
});
const bad = [...byC].filter(([, v]) => v.d > 0);
if (bad.length) {
  console.log('\n  ⚠️여전히 "당신" 을 쓰는 상담가:');
  bad.forEach(([c, v]) => console.log(`     ${c.padEnd(16)} ${v.d}/${v.n}건`));
} else console.log('\n  ✅ "당신" 을 쓰는 상담가 없음');

console.log('\n  ※ 이 숫자는 **저장된 과거 답변**이다 — 고친 뒤 새로 대화해야 반영된다.\n');
