// scripts/talk-probe.mjs — 상담가별로 **진짜 대화를 걸어 보고** 버그를 줍는다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-30: *"대화 각각 100번씩하고 버그 찾아"* → 실측 원가(1턴 ₩35)를 보고
// **10턴 × 14명 = 140턴(≈₩5,000)** 으로 Boss 가 규모를 정했다.
//
// ⚠️★★CLAUDE.md **절대 0** — 이 스크립트는 «배치 반복» 이라 **Boss 가 규모를 정했을 때만** 돈다.
//   기본값은 `--dry`(호출 0). 실제로 태우려면 `--go` 를 손으로 붙인다.
//   실행 전후로 `api_usage` 를 읽어 **실제 얼마 썼는지**를 찍는다(추정 금지).
//
// ■ 무엇을 잡으려 하나 — 오늘 고친 것과 이 저장소가 반복해 당한 것들
//   B1 실패 응답·빈 답(「지금은 답을 드리기 어려워요」 포함)
//   B2 **명식을 안 보는 사람**(안내자·친구)이 명리 용어를 말한다   ← 08-28~30 4회 재발
//   B3 「당신」 호칭                                              ← 말투 규칙
//   B4 «» 기호·줄표(ㅡ·—)가 화면 글에 샌다                        ← check:dash 와 같은 규칙
//   B5 회원을 **엉뚱한 이름**으로 부른다(부름을 이름으로 착각)      ← 08-30 서윤아
//   B6 마커가 안 떼어진 채 나온다(`[[말::…]]`·`[[초대::…]]` 등)
//   B7 같은 문장 반복 · 지나치게 긴 답(한 턴에 한 가지 규칙)
//   B8 느림(응답 지연)
//
// ■ ★단체방(`--group`) — Boss *"단체채팅방도 테스트 해야해"*
//   여기서만 도는 것: 화자 지목 · 티키타카 · 곁다리 · **화자별 명리 게이트**(08-30 수정).
//   ★★판정을 **줄마다 화자에 붙여서** 한다 — 방에는 화자가 여럿이라 답을 한 덩어리로 보면
//     «누가 그 말을 했는지» 가 사라진다. 나비가 사주를 말한 것도 그렇게 묻혀 있었다.
//   G1 티키타카가 정말 **여러 명**인가(한 명이 독백하면 대화가 아니다)
//   G2 같은 사람이 **연속 3번 넘게** 말하지 않는가        ← 08-26 「노쌤만 말함」
//   G3 **방에 없는 사람**이 말하지 않는가(환각 화자)
//
// 실행:  node scripts/talk-probe.mjs --dry        (호출 0 · 계획만)
//        node scripts/talk-probe.mjs --go [--turns 10] [--group]
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const envOf = (n) => {
  for (const line of fs.readFileSync(`${ROOT}.env`, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && line.slice(0, i).trim() === n) return line.slice(i + 1).trim();
  }
  return null;
};
const URL_BASE = envOf('SUPABASE_URL');
const ANON = envOf('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? envOf('SUPABASE_ANON_KEY');
const SERVICE = envOf('SUPABASE_SERVICE_ROLE_KEY');

const args = process.argv.slice(2);
const GO = args.includes('--go');
const TURNS = Number(args[args.indexOf('--turns') + 1]) || 10;

/**
 * 한 상담가에게 던질 열 마디.
 * ★아무 말이나 던지지 않는다 — **오늘 고친 자리와 반복 사고**를 겨냥해 고른 것이다.
 *   (1)인사 (2)일상 (3)자기소개 요구 (4)분야 밖 질문 → 넘기기 (5)명식 없이 사주 요구
 *   (6)욕설 → 용어로 알아듣나 (7)이름 부르기 → 내 이름으로 착각하나
 *   (8)깊이 요구 (9)되묻기 유도 (10)짧은 되받기
 */
const GROUP_SCRIPT = [
  '다들 안녕하세요',
  '{{primary}}님 계세요?',
  '{{mateShort}}아',
  '너희끼리 얘기해봐',
  '제 사주 좀 봐주세요',
  '주식 뭐 사요?',
  '병신',
  '깊게 봐줘',
  '이거 제 명식 맞아요?',
  '왜?',
];

const SCRIPT = [
  '안녕하세요',
  '오늘 좀 피곤하네요',
  '본인 소개 좀 해주세요',
  '주식 뭐 사면 돼요?',
  '제 사주 좀 봐주세요',
  '병신',
  '{{name}}아',
  '깊게 봐줘',
  '이거 제 명식 맞아요?',
  '왜?',
];

// ── 판정기 ────────────────────────────────────────────────────────────────
/**
 * 명리 용어 — **명식을 안 보는 사람**의 입에서 나오면 안 된다(B2).
 *
 * ⚠️★첫 판에 **「지지」·「상관」** 을 넣었다가 친구 상담가 전원이 10턴 내내 걸렸다 —
 *   「지지해요」·「상관없어요」 는 **일상어**다. 판정기가 늑대를 외치면 보고서가 통째로 쓸모없어진다.
 *   ⇒ 일상어와 겹치는 낱말은 **뺀다.** 놓치는 것보다 **거짓 경보가 더 비싸다**(사람이 안 믿게 된다).
 * ★남긴 것은 일상 대화에서 거의 안 쓰이는 것들이다(십신 이름·간지 한자쌍·원국/대운/용신 등).
 */
const MYEONGRI = /(십신|비견|겁재|식신|편재|정재|편관|편인(?![가데지])|정인(?![가데지])|격국|원국|지장간|대운|세운|삼합|육합|천간|일간|일지|월지|용신|신살|도화살|역마|공망|입묘|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/;

/**
 * **넘기는 문장**인가 — 「그건 제 자리가 아니고 노쌤이 잘 보세요」 처럼
 * 담당자를 알려 주려고 용어를 **입에 올리는 것**은 판정이 아니다(정상 응대다).
 * ⚠️이걸 안 가르면 «분야를 넘기는 바른 행동» 이 버그로 잡힌다 — 실제로 정하린이 그렇게 잡혔다.
 */
const HANDOFF = /(제 자리가 아니|제가 볼 게 아니|잘 보세요|더 잘|훨씬|여쭤|물어보세요|쪽이라서|담당)/;
const MARKER = /\[\[(말|초대|정리|추천|곁다리)::/;

/** 답 한 건을 뜯어 문제를 모은다. */
export function judgeReply(text, ctx) {
  const bad = [];
  const t = String(text ?? '');
  if (!t.trim()) bad.push('B1 빈 답');
  if (/지금은 답을 드리기 어려워요|답이 늦어지고 있어요/.test(t)) bad.push('B1 실패 문구');
  if (!ctx.readsChart) {
    // ★문장 단위로 본다 — 「넘기면서」 쓴 용어는 판정이 아니다(위 HANDOFF 주석)
    for (const sent of t.split(/(?<=[.!?…])\s+|\n+/)) {
      const hit = sent.match(MYEONGRI);
      if (hit && !HANDOFF.test(sent)) { bad.push(`B2 명식 안 보는 사람이 명리 용어: ${hit[0]}`); break; }
    }
  }
  if (/당신/.test(t)) bad.push('B3 「당신」 호칭');
  if (/[«»]/.test(t)) bad.push('B4 «» 기호');
  if (/ㅡ|—/.test(t)) bad.push('B4 줄표(ㅡ 또는 —)');
  if (MARKER.test(t)) bad.push(`B6 마커 노출: ${(t.match(MARKER) || [])[0]}`);
  if (ctx.calledName && new RegExp(`${ctx.calledName}\\s*(님|씨)`).test(t)) {
    bad.push(`B5 회원을 「${ctx.calledName}」 으로 부름`);
  }
  const lines = t.split('\n').map((x) => x.trim()).filter(Boolean);
  if (lines.length > 1 && new Set(lines).size < lines.length) bad.push('B7 같은 줄 반복');
  if (t.length > 900) bad.push(`B7 너무 김(${t.length}자)`);
  return bad;
}

/**
 * ★★**줄마다 화자에 붙여** 판정한다(단체방).
 * 방에는 화자가 여럿이라 답을 **한 덩어리**로 보면 «누가 그 말을 했는지» 가 사라진다 —
 * 나비가 사주를 말한 것도 그렇게 묻혀 있었다. 여기서는 각 줄의 화자로 `readsChart` 를 고른다.
 *
 * @param lines [{ name, line }] — 화자 이름이 붙은 줄들
 * @param roster Map<이름, {readsChart}> — 그 방에 **있는 사람**만
 */
export function judgeGroup(lines, roster, ctx = {}) {
  const bad = [];
  const names = lines.map((l) => l.name);
  // G3 방에 없는 사람이 말했나 — 환각 화자
  for (const n of new Set(names)) if (!roster.has(n)) bad.push(`G3 방에 없는 사람이 말함: ${n}`);
  // G2 같은 사람이 연속 3번 넘게
  let run = 1;
  for (let i = 1; i < names.length; i++) {
    run = names[i] === names[i - 1] ? run + 1 : 1;
    if (run > 3) { bad.push(`G2 ${names[i]} 가 연속 ${run}번`); break; }
  }
  // G1 티키타카인데 한 사람뿐
  if (ctx.wantCrosstalk && new Set(names).size < 2) bad.push(`G1 티키타카인데 화자가 ${new Set(names).size}명`);
  // 줄마다 그 화자 기준으로 본다
  for (const l of lines) {
    const rc = roster.get(l.name)?.readsChart ?? true;   // 모르는 사람은 G3 가 이미 잡았다
    for (const b of judgeReply(l.line, { ...ctx, readsChart: rc })) bad.push(`[${l.name}] ${b}`);
  }
  return bad;
}

/**
 * ★★`--rescore` — **저장해 둔 원문으로 다시 채점한다(호출 0 · 공짜).**
 * 판정기를 고칠 때마다 ₩5,000 을 다시 태우지 않으려고 둔 길이다.
 */
if (args.includes('--rescore')) {
  const tr = JSON.parse(fs.readFileSync('/tmp/talk-transcript.json', 'utf8'));
  const out = [];
  for (const x of tr) {
    if (x.mode === 'group') {
      const roster = new Map((x.room ?? []).map((n) => [n, { readsChart: null }]));
      continue;   // 방은 화자별 readsChart 를 원문에 안 남겼다 — 다음 판부터 남긴다
    }
    const bad = judgeReply(x.answer, { readsChart: x.readsChart });
    if (bad.length) out.push({ who: x.who, turn: x.turn, ask: x.ask, bad, say: (x.answer || '').slice(0, 140) });
  }
  console.log(`\n♻️  재채점(공짜) — 1:1 ${tr.filter((t) => t.mode !== 'group').length}턴 중 ${out.length}건\n`);
  for (const o of out) { console.log(`  [${o.who} #${o.turn}] ${o.ask}`); o.bad.forEach((b) => console.log(`     · ${b}`)); }
  console.log();
  process.exit(0);
}

if (args.includes('--selftest')) {
  const ok = judgeReply('반가워요. 오늘 어떠셨어요?', { readsChart: false });
  const b2 = judgeReply('일간이 辛金이라 그래요', { readsChart: false });
  const b3 = judgeReply('당신은 신중해요', { readsChart: true });
  const b5 = judgeReply('안녕하세요, 서윤 님!', { readsChart: true, calledName: '서윤' });
  const roster = new Map([['노쌤', { readsChart: true }], ['나비', { readsChart: false }]]);
  const g1 = judgeGroup([{ name: '노쌤', line: '그렇죠' }], roster, { wantCrosstalk: true });
  const g2 = judgeGroup([1, 2, 3, 4].map(() => ({ name: '노쌤', line: '네' })), roster);
  const g3 = judgeGroup([{ name: '없는사람', line: '안녕' }], roster);
  const g4 = judgeGroup([{ name: '나비', line: '일간이 辛金이라 그래요' }], roster);
  const gok = judgeGroup([{ name: '노쌤', line: '일간이 辛金이라 그래요' }, { name: '나비', line: '오 그렇구나' }], roster);
  const cases = [['정상', ok.length === 0], ['B2', b2.some((x) => x.startsWith('B2'))],
    ['B3', b3.some((x) => x.startsWith('B3'))], ['B5', b5.some((x) => x.startsWith('B5'))],
    ['G1 독백', g1.some((x) => x.startsWith('G1'))],
    ['G2 연속', g2.some((x) => x.startsWith('G2'))],
    ['G3 환각화자', g3.some((x) => x.startsWith('G3'))],
    ['G4 안내자가 명리(화자별)', g4.some((x) => x.includes('[나비]') && x.includes('B2'))],
    ['★같은 말도 노쌤이면 통과', gok.length === 0],
    // ⚠️거짓 경보 회귀 방지 — 이 두 낱말 때문에 첫 판이 통째로 노이즈였다
    ['일상어 「지지해요」 통과', judgeReply('제가 지지해요', { readsChart: false }).length === 0],
    ['일상어 「상관없어요」 통과', judgeReply('상관없어요', { readsChart: false }).length === 0],
    ['일상어 「편인가요」 통과', judgeReply('노랗게 보이는 편인가요?', { readsChart: false }).length === 0],
    ['일상어 「신중한 편인데」 통과', judgeReply('신중한 편인데 지금 유독 그래요', { readsChart: false }).length === 0],
    ['넘기며 쓴 용어는 통과', judgeReply('사주 명식이랑 대운은 노쌤이 훨씬 깊게 봐 주세요.', { readsChart: false }).length === 0],
    ['★그래도 판정하면 잡힌다', judgeReply('대운이 바뀌어서 그래요.', { readsChart: false }).some((x) => x.startsWith('B2'))]];
  let bad = 0;
  for (const [n, pass] of cases) { if (!pass) bad++; console.log(`  ${pass ? '✅' : '❌'} 음성테스트 «${n}»`); }
  console.log(bad ? `\n❌ 판정기 ${bad}건 불량\n` : '\n✅ 판정기 정상\n');
  process.exit(bad ? 1 : 0);
}

// ── 준비 ──────────────────────────────────────────────────────────────────
const j = async (url, opt) => { const r = await fetch(url, opt); return { status: r.status, body: await r.json().catch(() => null) }; };

const cons = (await j(`${URL_BASE}/rest/v1/consultants?select=id,name,kind,specialty,routes&enabled=eq.true&order=id`,
  { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).body ?? [];

/** 명식을 보는 사람인가 — Edge 의 `readsChartOf` 와 **같은 규칙**(한쪽만 고치면 갈린다). */
const CHART_KEYS = new Set(['saju', 'ziwei', 'compat', 'love', 'crush', 'reunion', 'lovestyle',
  'wealth', 'career', 'jobfit', 'talent', 'timeline', 'lifegraph', 'gaeun', 'newyear', 'today', 'month']);
const readsChartOf = (c) => {
  const spec = (Array.isArray(c.specialty) ? c.specialty : []).map(String);
  if (spec.includes('guide')) return false;
  return [...(Array.isArray(c.routes) ? c.routes : []), ...spec].map(String).some((k) => CHART_KEYS.has(k));
};

console.log(`\n🧪 talk-probe — 상담가 ${cons.length}명 × ${TURNS}턴 = ${cons.length * TURNS}턴`);
console.log(`   예상 원가 ≈ ₩${(cons.length * TURNS * 35).toLocaleString('ko-KR')} (실측 평균 1턴 ₩35)\n`);
if (!GO) { console.log('🅳 --dry — 호출하지 않았습니다. 실제로 돌리려면 --go\n'); process.exit(0); }

// 익명 세션 하나(앱이 쓰는 것과 같은 길) — Boss 계정·데이터는 건드리지 않는다
const su = await j(`${URL_BASE}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
});
const token = su.body?.access_token;
if (!token) { console.error('❌ 익명 세션 실패', su.status, JSON.stringify(su.body).slice(0, 200)); process.exit(1); }
console.log(`   익명 세션 확보 (uid ${su.body?.user?.id?.slice(0, 8)}…)\n`);

/**
 * ★테스트 계정에 운을 넣는다.
 * ⚠️첫 판이 **무료 10턴에서 막혀** 170턴 중 39턴만 실제로 돌았다 — 나머지는 `needCoins` 였고
 *   판정기는 그걸 «빈 답» 으로 읽어 **버그 150건**처럼 보고했다.
 *   ⇒ 벽은 벽대로 표시하고(위 `wall`), 애초에 **벽에 안 막히게** 운을 넉넉히 넣는다.
 * ★익명 계정이라 Boss 계정·매출과 무관하다(우리 화폐지 현금이 아니다).
 */
await j(`${URL_BASE}/rest/v1/rpc/grant_coins`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_owner: su.body.user.id, p_amount: 3000, p_reason: 'probe', p_ref: null, p_kind: 'talk' }),
});

const spentBefore = (await j(`${URL_BASE}/rest/v1/api_usage?select=won&kind=eq.talk&order=created_at.desc&limit=1`,
  { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).body;

const found = [];
const slow = [];
/**
 * ★★**주고받은 것을 전부 남긴다.**
 * 첫 판에서 판정기 오탐을 고치려니 **다시 ₩5,000 을 태워야** 했다 — 답을 안 남겼기 때문이다.
 * ⇒ 원문을 남겨 두면 판정기는 **공짜로** 몇 번이든 다시 돌릴 수 있다.
 */
const transcript = [];
for (const c of cons) {
  // ⚠️★`kind='virtual'` 은 **온디바이스**에서 답한다(원가 0) — Edge 를 부르면 400 이 정상이다.
  //   첫 판에서 이걸 모르고 불러 «버그 10건» 으로 세었다. 부를 대상이 아니면 **안 부른다.**
  if (String(c.kind ?? '') === 'virtual') { console.log(`── ${c.name}(${c.id}) [가상·온디바이스] 건너뜀`); continue; }
  const rc = readsChartOf(c);
  let sid = null;
  process.stdout.write(`── ${c.name}(${c.id}) ${rc ? '[명식○]' : '[명식✕]'} `);
  for (let i = 0; i < TURNS; i++) {
    const msg = SCRIPT[i % SCRIPT.length].replace('{{name}}', c.name.slice(-2));
    const t0 = Date.now();
    const r = await j(`${URL_BASE}/functions/v1/talk`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultantId: c.id, message: msg, sessionId: sid, lang: 'ko' }),
    });
    const ms = Date.now() - t0;
    sid = r.body?.sessionId ?? sid;
    const answer = [r.body?.answer, ...(r.body?.crosstalk ?? []).map((x) => x.line), r.body?.banter?.line]
      .filter(Boolean).join('\n');
    // ★★«답이 비었다» 를 **사유별로** 가른다 — 첫 판에서 과금 벽(needCoins)을 **버그 150건**으로
    //   읽을 뻔했다. 벽은 벽이라고 적어야 사람이 헷갈리지 않는다.
    const wall = r.body?.needCoins ? 'needCoins(무료 소진)' : r.body?.capped ? 'capped(하루 한도)'
      : r.body?.stalled ? `stalled(${r.body?.retryable ? '재시도' : '포기'})` : null;
    if (ms > 25000) slow.push(`${c.name} #${i + 1} ${(ms / 1000).toFixed(1)}초`);
    const calledName = msg.endsWith('아') ? msg.replace(/아$/, '') : null;
    const bad = r.status !== 200
      ? [`B1 HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 80)}`]
      : wall ? [`W ${wall}`]                       // 버그가 아니라 **벽** — 따로 센다
      : judgeReply(answer, { readsChart: rc, calledName });
    transcript.push({ mode: '1:1', who: c.name, readsChart: rc, turn: i + 1, ask: msg, answer, ms, status: r.status });
    if (bad.length) found.push({ who: c.name, turn: i + 1, ask: msg, bad, say: answer.slice(0, 160) });
    process.stdout.write(bad.length ? '✗' : '·');
    await new Promise((res) => setTimeout(res, 400));
  }
  process.stdout.write('\n');
}

// ── 단체방 ────────────────────────────────────────────────────────────────
// ★방을 **직접 만든다**(앱의 `groupTalk.ts` 와 같은 모양: consultant_id + guest_ids).
//   ⚠️익명 세션 소유로 만든다 — Boss 계정·데이터는 건드리지 않는다.
if (args.includes('--group')) {
  const byId = new Map(cons.map((c) => [c.id, c]));
  /** 방 셋 — **명식 보는 사람 + 안 보는 사람**을 반드시 섞는다(게이트가 걸리는 조합). */
  const ROOMS = [
    ['nossem', ['guide_nabi']],                 // 사주 + 안내자   ← 08-30 수정한 그 조합
    ['nossem', ['love_seoyun', 'guide_nabi']],  // 셋이서
    ['love_seoyun', ['beauty_jjinya']],         // 사주 + 친구(메이크업)
  ].filter(([p, g]) => byId.has(p) && g.every((x) => byId.has(x)));

  for (const [primaryId, guestIds] of ROOMS) {
    const primary = byId.get(primaryId);
    const mates = guestIds.map((g) => byId.get(g));
    const roster = new Map([primary, ...mates].map((c) => [c.name, { readsChart: readsChartOf(c) }]));
    // 방 만들기
    const mk = await fetch(`${URL_BASE}/rest/v1/talk_sessions`, {
      method: 'POST',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ owner_id: su.body.user.id, consultant_id: primaryId, guest_ids: guestIds }),
    });
    const room = (await mk.json().catch(() => null))?.[0];
    if (!room?.id) { console.log(`   ⚠️ 방 생성 실패(${primaryId}+${guestIds.join(',')}) ${mk.status}`); continue; }
    process.stdout.write(`── 방 [${[primary.name, ...mates.map((m) => m.name)].join(', ')}] `);

    for (let i = 0; i < TURNS; i++) {
      const msg = GROUP_SCRIPT[i % GROUP_SCRIPT.length]
        .replace('{{primary}}', primary.name)
        .replace('{{mateShort}}', mates[0].name.slice(-2));
      const t0 = Date.now();
      const r = await j(`${URL_BASE}/functions/v1/talk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultantId: primaryId, message: msg, sessionId: room.id, lang: 'ko' }),
      });
      const ms = Date.now() - t0;
      const b = r.body ?? {};
      // ★줄마다 **화자를 붙인다** — 본문은 답한 사람, 나머지는 서버가 이름을 준다
      const lines = [
        ...(b.answer ? [{ name: b.speakerName || primary.name, line: b.answer }] : []),
        ...((b.crosstalk ?? []).map((x) => ({ name: x.name, line: x.line }))),
        ...(b.banter ? [{ name: b.banter.name, line: b.banter.line }] : []),
      ];
      if (ms > 25000) slow.push(`방 #${i + 1} ${(ms / 1000).toFixed(1)}초`);
      const calledName = msg.endsWith('아') ? msg.replace(/아$/, '') : null;
      const wall = b.needCoins ? 'needCoins(무료 소진)' : b.capped ? 'capped(하루 한도)'
        : b.stalled ? `stalled(${b.retryable ? '재시도' : '포기'})` : null;
      const bad = r.status !== 200
        ? [`B1 HTTP ${r.status} ${JSON.stringify(b).slice(0, 80)}`]
        : wall ? [`W ${wall}`]
        : !lines.length ? ['B1 아무도 말하지 않음']
        : judgeGroup(lines, roster, { calledName, wantCrosstalk: /너희끼리|얘기해봐/.test(msg) });
      transcript.push({ mode: 'group', room: [primary.name, ...mates.map((m) => m.name)], turn: i + 1, ask: msg, lines, ms, status: r.status });
      if (bad.length) found.push({ who: `방:${primary.name}+${mates.map((m) => m.name).join('+')}`, turn: i + 1, ask: msg, bad,
        say: lines.map((l) => `${l.name}: ${l.line}`).join(' / ').slice(0, 200) });
      process.stdout.write(bad.length ? '✗' : '·');
      await new Promise((res) => setTimeout(res, 400));
    }
    process.stdout.write('\n');
  }
}

// ── 보고 ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
const walls = found.filter((f) => f.bad.every((b) => b.startsWith('W ')));
const bugs = found.filter((f) => !f.bad.every((b) => b.startsWith('W ')));
if (walls.length) console.log(`🧱 벽(버그 아님) ${walls.length}건 — ${[...new Set(walls.flatMap((w) => w.bad))].join(' · ')}\n`);
if (!bugs.length) console.log('✅ 버그로 잡힌 것 없음');
else {
  console.log(`❌ 버그 ${bugs.length}건\n`);
  for (const f of bugs) {
    console.log(`  [${f.who} #${f.turn}] 물음: ${f.ask}`);
    f.bad.forEach((b) => console.log(`     · ${b}`));
    console.log(`     답: ${f.say.replace(/\n/g, ' / ')}\n`);
  }
}
if (slow.length) console.log(`⏱ 느린 턴 ${slow.length}건: ${slow.slice(0, 8).join(' · ')}`);
fs.writeFileSync('/tmp/talk-probe.json', JSON.stringify(found, null, 2));
fs.writeFileSync('/tmp/talk-transcript.json', JSON.stringify(transcript, null, 2));   // ★원문 — 판정기 재검용(공짜)
console.log(`\n📄 상세: /tmp/talk-probe.json  (직전 turn 원가는 api_usage 로 따로 확인)\n`);
void spentBefore;
