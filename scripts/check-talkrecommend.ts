/**
 * scripts/check-talkrecommend.ts — 대화 중 **콘텐츠 안내**가 실제로 뜨는가 하네스
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"기존에 컨텐츠들도 대화를 하다가 자연스럽게 추천하는 식으로 하자"*.
 *
 * ■ ★이 기능이 조용히 죽는 방식은 정해져 있다
 *   말은 잘 나오는데 **카드만 안 뜬다.** 그러면 아무도 고장인 줄 모른다(모델이 안 권한 줄 안다).
 *   죽는 자리는 넷뿐이라 넷을 다 본다:
 *     ①프롬프트가 시키는 마커 ≠ 파서가 찾는 마커  → 영원히 안 뜬다
 *     ②상담가 `routes` 의 키가 설명표에 없다        → 모델이 그게 뭔지 몰라 안 권한다
 *     ③그 키가 앱 콘텐츠 목록에 없다               → 카드로 못 만든다(빈 화면 방지로 버려진다)
 *     ④`ready: false` 인 콘텐츠를 권한다            → '준비 중' 화면으로 보낸다
 *
 * ■ ★값으로 판정한다
 *   "recommendBlock 을 부르는가" 같은 문자열 검사가 아니라, **같은 함수를 실제로 돌려서**
 *   마커가 떼어지는지·허용 목록 밖 키가 버려지는지를 본다.
 *
 * 실행: npm run check:talkrecommend   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';
import { CONTENT_GLOSS, RECOMMEND_MARKER, recommendBlock, splitRecommend } from '../supabase/functions/_shared/contentGloss.ts';

const APP_TALK = 'app/src/app/(app)/talk.tsx';
const SECTIONS_SRC = 'app/src/lib/content/contentSections.ts';
const EDGE = 'supabase/functions/talk/index.ts';

let fail = 0, pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };

console.log('\n🔗 대화 중 콘텐츠 안내 하네스\n');

// ── ① 마커 형식이 프롬프트와 파서에서 같은가 ────────────────────────────
console.log('=== ① 프롬프트가 시키는 마커 ↔ 파서가 찾는 마커 ===');
{
  const block = recommendBlock(['compat']);
  // 프롬프트가 실제로 예로 든 문자열을 **파서에 그대로 넣어** 본다.
  const example = /`(\[\[[^`]+\]\])`/.exec(block)?.[1] ?? '';
  if (!example) bad('프롬프트에 마커 예시가 없다 — 모델이 형식을 모른다');
  else {
    const probe = `아주 좋은 흐름이에요.\n${example.replace('키', 'compat')}`;
    const r = splitRecommend(probe, ['compat']);
    if (r.recommend === 'compat' && !RECOMMEND_MARKER.test(r.body)) {
      ok(`프롬프트 예시 ${example} 를 파서가 그대로 읽는다`);
    } else {
      bad(`프롬프트 예시(${example})를 파서가 못 읽는다 — recommend=${r.recommend}`);
    }
  }
}

// ── ② 상담가 routes 의 키가 설명표에 다 있는가 (DB 실측) ─────────────────
console.log('\n=== ② 상담가 routes 의 키를 모델이 아는가 (DB 실측) ===');
const env = readFileSync('.env', 'utf8');
const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
const URL_BASE = pick('SUPABASE_URL');
const ANON = pick('SUPABASE_ANON_KEY');
let dbRoutes: string[] = [];
if (!URL_BASE || !ANON) {
  console.log('  ·  .env 없음 — DB 대조 생략');
} else {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/consultants?select=id,name,routes&enabled=eq.true`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as { id: string; name: string; routes: string[] | null }[];
    dbRoutes = [...new Set(rows.flatMap((r) => r.routes ?? []))];
    // ★설명이 없는 키는 **오류가 아니다** — 설명이 없으면 모델에게 아예 안 알려 주므로 안전하게 빠진다.
    //   (예: 앱 콘텐츠 목록에 카드가 없는 것) 다만 조용히 빠지면 모르니 이름을 찍어 준다.
    const noGloss = [...new Set(dbRoutes.filter((k) => !CONTENT_GLOSS[k]))];
    ok(`활성 상담가 ${rows.length}명 · routes 키 ${dbRoutes.length}종 중 ${dbRoutes.length - noGloss.length}종을 안내한다`);
    if (noGloss.length) console.log(`  ·  안내 대상 아님(설명 없음 = 모델에게 안 알림): ${noGloss.join(' · ')}`);

    const withRoutes = rows.filter((r) => (r.routes ?? []).length);
    ok(`안내를 가진 상담가 ${withRoutes.length}명 (${withRoutes.map((r) => r.name).join(' · ')})`);
  } catch (e) {
    console.log(`  ·  DB 조회 실패(${(e as Error).message}) — 코드 검사만 수행`);
  }
}

// ── ③ 그 키가 앱 콘텐츠 목록에 실제로 있는가 · ready 인가 ────────────────
console.log('\n=== ③ 앱 콘텐츠 목록에 그 키가 있는가 (없으면 카드가 안 만들어진다) ===');
{
  const src = readFileSync(SECTIONS_SRC, 'utf8');
  // `key: 'compat'` 형태를 전부 걷는다(목록을 import 하면 RN 자산까지 딸려 와 노드에서 안 돈다).
  const keys = new Set([...src.matchAll(/key:\s*'([a-z0-9_]+)'/gi)].map((m) => m[1]));
  // ★검사 대상 = **모델에게 실제로 알려 주는 키**(설명이 있는 것). 설명 없는 키는 애초에 안 권한다.
  const check = (dbRoutes.length ? dbRoutes : Object.keys(CONTENT_GLOSS)).filter((k) => CONTENT_GLOSS[k]);
  const absent = check.filter((k) => !keys.has(k));
  if (absent.length) bad(`앱 목록에 없는 키: ${absent.join(' · ')} — 권해도 카드가 안 뜬다`);
  else ok(`${check.length}종 전부 앱 콘텐츠 목록에 있다`);

  // 설명표에만 있고 아무 상담가도 안 쓰는 키는 **오류가 아니다**(나중 확장). 그냥 알려만 준다.
  const unused = Object.keys(CONTENT_GLOSS).filter((k) => dbRoutes.length && !dbRoutes.includes(k));
  if (unused.length) console.log(`  ·  아직 아무 상담가도 안 쓰는 설명: ${unused.join(' · ')}`);
}

// ── ④ 배선이 살아 있는가 (Edge 저장 전 제거 · 앱 카드 생성) ──────────────
console.log('\n=== ④ 배선 — 마커를 저장 전에 떼는가 · 앱이 카드를 만드는가 ===');
{
  const edge = readFileSync(EDGE, 'utf8');
  const iSplit = edge.indexOf('splitRecommend(');
  const iInsert = edge.indexOf("from('talk_messages').insert(");
  if (iSplit < 0) bad('Edge 가 마커를 떼지 않는다(splitRecommend 없음)');
  else if (iInsert >= 0 && iSplit > iInsert) bad('★마커를 **저장한 뒤에** 뗀다 — 이력에 남아 화면에 뜨고 모델이 따라 쓴다');
  else ok('Edge 가 저장 **전에** 마커를 뗀다');

  if (!/recommend,?\s*source: 'llm'|recommend[,}]/.test(edge)) bad('Edge 응답에 recommend 가 없다');
  else ok('Edge 응답이 recommend 를 내려 준다');

  const app = readFileSync(APP_TALK, 'utf8');
  if (!app.includes('r.recommend')) bad('앱이 recommend 를 읽지 않는다');
  else if (!/it\.ready/.test(app)) bad("앱이 `ready` 를 안 본다 — '준비 중' 화면으로 보낼 수 있다");
  else ok('앱이 recommend 를 읽고 ready 인 것만 카드로 만든다');
}

// ── ⑤ 음성 테스트 — 잘못된 입력을 정말 버리는가 ──────────────────────────
console.log('\n=== ⑤ 음성 테스트 — 잘못된 것을 버리는가 ===');
{
  // 허용 목록 밖 키 → 버려야 한다(모델이 지어낸 화면으로 보내면 빈 화면)
  const a = splitRecommend('네 알겠어요.\n[[추천:존재하지않음]]', ['compat']);
  if (a.recommend === null && !a.body.includes('[[')) ok('허용 목록 밖 키를 버린다(본문에서도 지운다)');
  else bad(`허용 목록 밖 키를 통과시켰다 — recommend=${a.recommend} body="${a.body}"`);

  // 마커가 없으면 본문은 그대로
  const b = splitRecommend('그냥 대화예요.', ['compat']);
  if (b.recommend === null && b.body === '그냥 대화예요.') ok('마커가 없으면 본문을 건드리지 않는다');
  else bad('마커가 없는데 본문이 바뀌었다');

  // routes 가 비면 블록 자체를 넣지 않는다(친구 상담가)
  if (recommendBlock([]) === '') ok('안내할 게 없으면 블록을 넣지 않는다(토큰 낭비 방지)');
  else bad('routes 가 비었는데 블록을 넣는다');

  // 모르는 키만 있으면? → 역시 빈 블록
  if (recommendBlock(['아무거나없는키']) === '') ok('설명 없는 키만 있으면 블록을 넣지 않는다');
  else bad('설명 없는 키로 블록을 만들었다 — 모델이 뜻을 모르는 키를 권하게 된다');
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 대화 중 콘텐츠 안내가 끊겨 있다.');
  console.log('      `supabase/functions/_shared/contentGloss.ts`(설명·마커) ·');
  console.log('      `supabase/functions/talk/index.ts`(주입·제거) · `app/src/app/(app)/talk.tsx`(카드) 를 본다.\n');
  process.exit(1);
}
console.log('   🎯 통과 — 마커 형식 일치 · 키 전부 설명·목록에 있음 · 저장 전 제거\n');
