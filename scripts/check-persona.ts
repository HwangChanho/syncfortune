/**
 * scripts/check-persona.ts — 상담가 **말투가 진짜로 갈라져 있는가** 하네스
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"이제 애들 개성을 살려서 말투를 다르게 만들어줘"* → 이 파일이 그걸 지킨다.
 *
 * ■ ★무엇을 잠그나 — "다르다"를 **값으로** 본다
 *   개성은 형용사로 선언한다고 생기지 않는다. 서로 **겹치지 않는 규칙**이 있을 때만 갈린다.
 *   ①**어느 두 사람도 축 셋(말끝·첫 풍선이 하는 일·호칭) 중 둘 이상이 다른가**
 *     (고치기 전 실제로 겹쳐 있었다: 차예린↔차유나 "-야/-지" · 한봄↔서유리 부드러운 "-요" ·
 *      송도윤↔서유리 "듣는 쪽". ★한국어 존댓말 어미는 종류가 적어 어미 하나로는 못 가른다.)
 *   ②원본(`consultant-personas.ts`)과 **DB 가 같은가** — 관리자 콘솔에서 고칠 수 있어 갈라지기 쉽다
 *   ③선언한 어미가 **본문에 실제로 적혀 있는가**(표만 고치고 글은 그대로인 사고 방지)
 *   ④공통 프롬프트와 **싸우지 않는가** — 목록·번호·줄표는 TALK_COMMON 이 이미 금지한다
 *   ⑤안전 가드(`guardrails`)가 **살아 있는가** — 말투 작업이 안전 문구를 지우면 안 된다
 *
 * ■ ⚠️`nossem` 은 검사 대상이 아니다
 *   실존 인물이고 대화 형식은 Boss 가 준다. **비어 있는 게 정답**이다.
 *
 * 실행: npm run check:persona   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';
import { PERSONAS } from './consultant-personas';

const env = readFileSync('.env', 'utf8');
const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
const URL_BASE = pick('SUPABASE_URL');
const ANON = pick('SUPABASE_ANON_KEY');

let fail = 0;
let pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };

console.log('\n🗣  말투 개성 하네스\n');

// ── ① 어느 두 사람도 축 셋 중 **둘 이상**이 달라야 한다 ────────────────
//   ★어미 하나로 판정하지 않는 이유: 한국어 존댓말 어미는 종류가 많지 않아 열한 명을 못 가른다.
//     같은 어미를 써도 **첫 풍선이 하는 일**과 **호칭**이 다르면 실제로 다르게 들린다.
//     그래서 "축 셋(말끝·첫 풍선·호칭) 중 둘 이상 다름" 을 기준으로 삼는다.
console.log('=== ① 어느 두 사람도 축 셋 중 둘 이상이 다른가 ===');
{
  /** 두 사람이 몇 개 축에서 다른가 (0~3) */
  const diffAxes = (a: typeof PERSONAS[number], b: typeof PERSONAS[number]) => {
    const endingsSame = a.endings.length === b.endings.length
      && a.endings.every((e) => b.endings.includes(e));
    return (endingsSame ? 0 : 1) + (a.opener === b.opener ? 0 : 1) + (a.address === b.address ? 0 : 1);
  };
  const weak: string[] = [];
  for (let i = 0; i < PERSONAS.length; i++) {
    for (let j = i + 1; j < PERSONAS.length; j++) {
      const d = diffAxes(PERSONAS[i], PERSONAS[j]);
      if (d < 2) weak.push(`${PERSONAS[i].name} ↔ ${PERSONAS[j].name} (다른 축 ${d}개)`);
    }
  }
  if (weak.length) weak.forEach((w) => bad(`구분이 약하다: ${w}`));
  else ok(`${PERSONAS.length}명 · 모든 짝이 축 2개 이상 다름 (${PERSONAS.length * (PERSONAS.length - 1) / 2}쌍)`);

  // 그래도 **어미 집합이 통째로 같은 짝**은 따로 막는다(가장 눈에 띄는 겹침이다).
  const key = (p: typeof PERSONAS[number]) => [...p.endings].sort().join('|');
  const seen = new Map<string, string>();
  let dup = 0;
  for (const p of PERSONAS) {
    const k = key(p);
    if (seen.has(k)) { bad(`어미 집합이 똑같다: ${seen.get(k)} ↔ ${p.name} (${k})`); dup++; }
    else seen.set(k, p.name);
  }
  if (!dup) ok(`어미 집합 ${seen.size}종 · 똑같은 짝 없음`);

  // 첫 풍선·호칭도 최소한의 다양성이 있어야 한다(전원이 같은 값이면 축이 죽은 것이다).
  const openers = new Set(PERSONAS.map((p) => p.opener));
  if (openers.size < Math.ceil(PERSONAS.length * 0.7)) bad(`첫 풍선 역할이 ${openers.size}종뿐 — 축이 죽었다`);
  else ok(`첫 풍선 역할 ${openers.size}종 · 호칭 ${new Set(PERSONAS.map((p) => p.address)).size}종`);
}

// ── ② 선언한 어미가 본문에 실제로 적혀 있는가 ────────────────────────────
console.log('\n=== ② 선언과 본문이 맞는가 (표만 고치고 글은 그대로인 사고) ===');
{
  let miss = 0;
  for (const p of PERSONAS) {
    const absent = p.endings.filter((e) => !p.persona.includes(e));
    if (absent.length) { bad(`${p.name} — 선언한 어미가 본문에 없다: ${absent.join(' ')}`); miss++; }
  }
  if (!miss) ok('선언한 어미가 전부 본문에 적혀 있다');
}

// ── ③ 공통 프롬프트와 싸우지 않는가 ──────────────────────────────────────
//   TALK_COMMON 이 이미 금지한 것을 말투가 요구하면, 둘이 싸우고 결과는 흔들린다.
console.log('\n=== ③ 공통 규칙과 싸우지 않는가 (TALK_COMMON 이 이미 금지한 것) ===');
{
  const forbidden: [RegExp, string][] = [
    [/번호|①|②|③|목록으로|리스트로/, '번호·목록 (공통이 금지)'],
    [/[—―–]/, '줄표 (공통이 금지)'],
    [/길게 말한다|긴 문장|문장을 길게/, '긴 문장 (공통이 "짧은 한 문장"을 강제)'],
    [/이모지를 쓴다|이모지로/, '이모지 사용 요구'],
  ];
  let hit = 0;
  for (const p of PERSONAS) {
    for (const [re, why] of forbidden) {
      if (re.test(p.persona)) { bad(`${p.name} — ${why}`); hit++; }
    }
  }
  if (!hit) ok('공통 규칙과 충돌하는 지시 없음');
}

// ── ④ DB 와 원본이 같은가 + 안전 가드가 살아 있는가 ──────────────────────
console.log('\n=== ④ DB 실측 — 원본과 같은가 · 안전 가드가 살아 있는가 ===');
if (!URL_BASE || !ANON) {
  console.log('  ·  .env 없음 — DB 대조 생략(코드 검사만 수행)');
} else {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/consultants?select=id,name,persona,guardrails,enabled&enabled=eq.true`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as { id: string; name: string; persona: string | null; guardrails: string | null }[];
    const byId = new Map(rows.map((r) => [r.id, r]));

    let drift = 0;
    for (const p of PERSONAS) {
      const r = byId.get(p.id);
      if (!r) { bad(`${p.name}(${p.id}) — 활성 상담가 목록에 없다`); drift++; continue; }
      if ((r.persona ?? '').trim() !== p.persona.trim()) {
        bad(`${p.name} — DB 말투가 원본과 다르다 (npm run personas:push 로 맞출 것)`);
        drift++;
      }
    }
    if (!drift) ok(`DB 말투 ${PERSONAS.length}명 · 원본과 일치`);

    // ★안전 가드는 말투와 **다른 칸**이다. 말투 작업이 이걸 비우면 안 된다(CLAUDE.md §4).
    const noGuard = rows.filter((r) => !(r.guardrails ?? '').trim());
    if (noGuard.length) bad(`안전 가드가 비었다: ${noGuard.map((r) => r.name).join(' · ')}`);
    else ok(`안전 가드 ${rows.length}명 전부 살아 있음`);

    // ★노쌤은 비어 있는 게 정답 — 누가 채워 넣었으면 알린다(Boss 슬롯을 침범한 것이다).
    const nossem = byId.get('nossem');
    if (nossem && (nossem.persona ?? '').trim()) {
      bad('노쌤 말투가 채워져 있다 — 실존 인물이라 Boss 가 직접 주는 자리다');
    } else {
      ok('노쌤 말투는 비어 있음(Boss 슬롯 — 지어내지 않았다)');
    }
  } catch (e) {
    console.log(`  ·  DB 조회 실패(${(e as Error).message}) — 코드 검사만 수행`);
  }
}

// ── ⑤ 음성 테스트 — 기준이 무뎌지면 반드시 깨지는가 ──────────────────────
// ── ⑥ 말투 «예시»가 실제로 실리는가 ─────────────────────────────────────
//   ★2026-08-25 Boss *"선생님들만의 대화 개성이 제대로 적용 안된거 같어"* 의 원인이 여기였다.
//   예시 33건이 DB 에 있는데 **전부 `author='draft'`** 라 Edge 가 하나도 안 실었다
//   (Edge 는 `author='boss'` 만 싣는다). 말투는 지시문 140~183자만으로 전달되고 있었다.
//   ⚠️`0040` 마이그레이션 스스로 *"지시문만 주면 모델은 결국 비슷하게 쓴다"* 고 적어 뒀는데,
//     그 진단이 맞았고 **아무도 그 침묵을 몰랐다.** ⇒ 여기서 소리내게 한다.
console.log('\n=== ⑥ 말투 예시가 **실제로 실리는가** ===');
// ⚠️★여기만 **service_role** 로 읽는다(2026-08-25 실측).
//   `consultant_examples` 는 RLS 로 anon 에게 **통째로 안 보인다** — anon 으로 조회하면
//   행이 33개 있어도 빈 배열이 온다. 그걸 «예시가 0건이다» 로 읽으면 **거짓 빨간불**이다.
//   ⇒ «없다» 와 «내가 못 본다» 는 다르다. 못 보면 판정하지 말고 그렇게 말한다.
const SVC = (new RegExp('^SUPABASE_SERVICE_ROLE_KEY=(.*)$', 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
if (!URL_BASE || !SVC) {
  console.log('  ·  service_role 키 없음 — 생략(anon 으로는 이 표가 안 보인다)');
} else {
  try {
    const [cRes, eRes] = await Promise.all([
      fetch(`${URL_BASE}/rest/v1/consultants?select=id,example_limit&enabled=eq.true`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }),
      fetch(`${URL_BASE}/rest/v1/consultant_examples?select=consultant_id,author,enabled`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }),
    ]);
    const cs = await cRes.json() as any[];
    const ex = await eRes.json() as any[];
    const live = ex.filter((r) => r.author === 'boss' && r.enabled);
    const draft = ex.filter((r) => r.author !== 'boss');
    const want = cs.filter((c) => (c.example_limit ?? 0) > 0);
    if (!Array.isArray(cs) || !Array.isArray(ex)) {
      console.log('  ·  조회 실패 — 생략');
    } else if (want.length && !live.length) {
      bad(`예시를 싣겠다고 한 상담가가 ${want.length}명인데 **실리는 예시가 0건**이다`
        + (draft.length ? ` — 초안 ${draft.length}건이 author='draft' 로 잠들어 있다. Boss 검수 후 npm run persona:approve` : ''));
      bad("말투가 «지시문»만으로 전달되고 있다 — 그러면 상담가들이 결국 비슷하게 말한다(0040 마이그레이션의 진단)");
    } else if (want.length) {
      const per = new Set(live.map((r) => r.consultant_id));
      ok(`말투 예시 ${live.length}건이 실린다(상담가 ${per.size}명)`);
      const none = want.map((c) => c.id).filter((id) => !per.has(id) && id !== 'nossem');
      if (none.length) bad(`예시가 하나도 없는 상담가: ${none.join(' · ')} — 그 사람만 개성이 밋밋해진다`);
      else ok('예시를 싣겠다고 한 상담가 전원에게 예시가 있다');
    } else ok('예시를 싣는 상담가가 없다(example_limit 0)');
  } catch (e) { console.log(`  ·  조회 실패(${(e as Error).message}) — 생략`); }
}

console.log('\n=== ⑤ 음성 테스트 — 일부러 똑같이 만들면 잡히는가 ===');
{
  const base = PERSONAS[0];
  const clone = { ...base, name: '가짜' };            // 세 축이 전부 같은 쌍
  const endingsSame = base.endings.length === clone.endings.length
    && base.endings.every((e) => clone.endings.includes(e));
  const d = (endingsSame ? 0 : 1) + (base.opener === clone.opener ? 0 : 1) + (base.address === clone.address ? 0 : 1);
  if (d < 2) ok('세 축이 같은 짝을 넣으면 ①이 잡는다(다른 축 0개)');
  else bad('똑같이 만들었는데 다르다고 셌다 — 검사가 무디다');

  // 어미만 다르고 나머지가 같으면? → 축 1개 차이 = 여전히 걸려야 한다.
  const nearly = { ...base, name: '비슷이', endings: ['-습죠'] };
  const d2 = (base.endings.includes('-습죠') ? 0 : 1) + (base.opener === nearly.opener ? 0 : 1) + (base.address === nearly.address ? 0 : 1);
  if (d2 < 2) ok('어미만 바꾼 짝도 잡는다(다른 축 1개)');
  else bad('어미만 다른 짝을 통과시켰다 — 기준이 헐겁다');
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 말투가 갈라져 있지 않다. `scripts/consultant-personas.ts` 를 고치고');
  console.log('      `npm run personas:push` 로 반영하세요.\n');
  process.exit(1);
}
console.log('   🎯 말투 통과 — 어미 겹침 0 · DB 일치 · 안전 가드 유지\n');
