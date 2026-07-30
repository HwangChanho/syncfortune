// scripts/check-paid-content.ts — 유료 콘텐츠 **열리는 경로 전 구간** 전수 대조
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-31: "다른 모든 유료 컨텐츠 다 이상없는지 확인해 한두개가 아닐텐데 리스트 업 해서해"
//
// ★계기(07-30 실사고): 07-28 코인 전환에서 **전용 화면 5개가 누락**됐다(love·gaeun·career·newyear·lifegraph).
//   구 쿠폰 잔여가 0 이면 Alert 로 막았고, 프리미엄·관리자 우회로가 모두 폐지된 뒤라
//   **운을 아무리 많이 들고 있어도 영원히 못 여는 상태**였다. 그런데 타입도 통과하고 화면도 정상으로 보인다.
//   ⇒ 사람이 화면을 하나씩 눌러 보는 방식으로는 28종을 매번 확인할 수 없다. 기계가 표로 대조한다.
//
// 검사하는 '전 구간'(한 칸이라도 비면 사용자는 그 콘텐츠를 못 연다):
//   ① 판매목록  CREDIT_KINDS      — 파는 물건인가
//   ② 운가      COIN_PRICE        — 얼마인가(없으면 coinGate 가 'noprice' 로 빠져 화면이 못 연다)
//   ③ 진입      SECTIONS 카드     — 사용자가 도달할 카드/라우트가 있는가
//   ④ 라우트    app/(app)/*.tsx   — 그 라우트 파일이 실제로 있는가
//   ⑤ 게이트    ensureCoinsFor    — 운으로 여는가(전용 화면) / 공용 화면(SpecialContentScreen) 경유인가
//   ⑥ 서버게이트 Edge SERVER_GATED·SET_KIND — 서버가 차감하는가(없으면 **무료 생성 취약**)
//
// 실행: npm run check:paid
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// ── 데이터 수집 ──────────────────────────────────────────────────────────
const couponsSrc = strip(read('app/src/lib/billing/coupons.ts'));
const coinSrc = strip(read('app/src/lib/billing/coinPrices.ts'));
const secSrc = strip(read('app/src/lib/content/contentSections.ts'));
const edgeSrc = strip(read('supabase/functions/interpret/index.ts'));

/** 판매 목록(단일 출처) — key·한글명·원화가 */
const KINDS = [...couponsSrc.matchAll(/\{\s*key:\s*'([a-z_0-9]+)',\s*ko:\s*'([^']*)',\s*price:\s*(\d+)/g)]
  .map((m) => ({ key: m[1], ko: m[2], won: Number(m[3]) }));

/** 운가 */
const coinBody = coinSrc.slice(coinSrc.indexOf('COIN_PRICE'), coinSrc.indexOf('COIN_PACKS'));
const COIN = new Map<string, number>();
for (const m of coinBody.matchAll(/([a-z_0-9]+)\s*:\s*(\d+)/g)) COIN.set(m[1], Number(m[2]));

/** SECTIONS 카드 — key/creditKey → route (항목 1개 = 1줄 형식) */
type Card = { key: string; creditKey?: string; route: string };
const CARDS: Card[] = [];
for (const ln of secSrc.split('\n')) {
  const key = /\bkey:\s*'([^']+)'/.exec(ln)?.[1];
  const route = /\broute:\s*'([^']+)'/.exec(ln)?.[1];
  if (!key || !route) continue;
  CARDS.push({ key, route, creditKey: /creditKey:\s*'([^']+)'/.exec(ln)?.[1] });
}
if (CARDS.length < 30) bad(`SECTIONS 파싱 ${CARDS.length}개 — 형식이 바뀌었을 수 있다(빈 통과 방지)`);

/** 서버 게이트(Edge) */
const gatedBody = edgeSrc.slice(edgeSrc.indexOf('const SERVER_GATED'), edgeSrc.indexOf('const gateCk'));
const SERVER_GATED = new Set([...gatedBody.matchAll(/([a-z_0-9]+)\s*:\s*'([a-z_0-9]+)'/g)].map((m) => m[2]));
const setBody = edgeSrc.slice(edgeSrc.indexOf('const SET_KIND'), edgeSrc.indexOf('const setCk'));
const SET_KIND = new Set([...setBody.matchAll(/([a-z_0-9]+)\s*:\s*'([a-z_0-9]+)'/g)].map((m) => m[2]));

/** 앱 소스 전체(게이트 탐색용) */
const files: string[] = [];
(function walk(d: string) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(e)) files.push(p);
  }
})(join(ROOT, 'app/src'));
const srcOf = new Map(files.map((f) => [f, strip(readFileSync(f, 'utf8'))]));

/** 이 kind 를 여는 게이트가 어디인가 */
function gateOf(kind: string): string {
  for (const [f, s] of srcOf) {
    if (new RegExp(`ensureCoinsFor\\(\\s*'${kind}'`).test(s)) return f.replace(ROOT, '').replace('app/src/', '');
  }
  // 공용 화면(동적 kind) — SpecialContentScreen 이 buyCredit(운) 으로 연다
  const spec = srcOf.get(join(ROOT, 'app/src/components/SpecialContentScreen.tsx')) ?? '';
  if (/coinPriceOf\(kind\)/.test(spec)) return 'components/SpecialContentScreen.tsx (공용)';
  return '';
}

/** 이 kind 로 도달하는 카드·라우트 */
function cardOf(kind: string): Card | undefined {
  return CARDS.find((c) => c.creditKey === kind) ?? CARDS.find((c) => c.key === kind);
}
function routeExists(route: string): boolean {
  const r = route.replace(/^\//, '');
  return [`app/src/app/(app)/${r}.tsx`, `app/src/app/(app)/${r}/index.tsx`, `app/src/app/${r}.tsx`]
    .some((p) => existsSync(join(ROOT, p)));
}

// ── 표 ──────────────────────────────────────────────────────────────────
// ★서버게이트 면제(설계상 정당한 예외) — 이유를 여기 적어 둔다. 비면 '누락'과 구분이 안 된다.
const SERVER_EXEMPT: Record<string, string> = {
  dream: 'Edge dream 분기가 자체 차감(spendForKind)',
  followup: 'Edge 추가질문 분기가 자체 차감',
  compat: 'Edge 궁합 분기가 자체 차감(쌍/관계 판정 포함)',
  coach: '팔자 도우미 전환(2026-07-30) — 무료·LLM 미사용',
  celeb: '온디바이스 무료 전환(07-07) — Edge 는 하드 거부',
  timeresolve: '온디바이스 결정론 도구(LLM 미호출) — 클라 차감(useCredit)',
  timeline5: 'timeline 크레딧 번들(적립 전용 SKU) — 소비는 timeline 게이트',
  timeline10: 'timeline 크레딧 번들(적립 전용 SKU) — 소비는 timeline 게이트',
};

// ★카드 없는 게 정상인 것 — **호스트 화면 안에서만 판다**. 다만 '정상'이라고 적어 두는 것만으로는
//   나중에 그 화면에서 판매 코드가 사라져도 아무도 모른다 → **실제 판매 지점이 코드에 있는지 증거를 요구**한다.
const CARD_EXEMPT: Record<string, RegExp> = {
  followup: /ensureCoinsFor\(\s*'followup'/,   // 풀이·궁합 화면 안의 '추가 질문'
};

// ⚠️★판매 경로가 실제로 **0** 인 것들(2026-07-31 전수조사에서 드러남). 사용자에게 노출되진 않지만
//   판매목록(CREDIT_KINDS)에는 남아 있어 '파는 물건'처럼 보인다 → daniel 결정 대기.
const KNOWN_DEAD: Record<string, string> = {
  coach: '팔자 도우미 무료 전환(07-30)으로 소비처 0 — 상품 자체가 죽었다',
  timeline5: '앱에 구매 진입점 0(주석은 TimelineScreen 이라 하나 그 코드가 없다)',
  timeline10: '앱에 구매 진입점 0(위와 동일)',
};

console.log(`\n유료 콘텐츠 ${KINDS.length}종 — 열리는 경로 전 구간 대조\n`);
console.log('  kind          이름                 원화     운   카드/라우트                게이트                          서버');
console.log('  ' + '─'.repeat(118));

const problems: string[] = [];
for (const k of KINDS) {
  const coin = COIN.get(k.key);
  const card = cardOf(k.key);
  const rOk = card ? routeExists(card.route) : false;
  const gate = gateOf(k.key);
  const server = SET_KIND.has(k.key) ? 'SET' : SERVER_GATED.has(k.key) ? 'GATE' : (SERVER_EXEMPT[k.key] ? '면제' : '—');

  const cell = (v: any, w: number) => String(v ?? '').padEnd(w).slice(0, w);
  const mark = (b: boolean) => (b ? ' ' : '✗');
  console.log(
    `  ${cell(k.key, 13)} ${cell(k.ko, 19)} ${cell(k.won.toLocaleString(), 7)} ${cell(coin ?? '없음', 4)} ` +
    `${cell((card ? card.route : '카드없음') + (card && !rOk ? '(파일X)' : ''), 25)} ${cell(gate || '없음', 31)} ${server}`,
  );

  if (coin == null) problems.push(`${k.key}: 운가 없음 → coinGate 가 'noprice' 로 빠져 화면이 못 연다`);
  if (!card && !CARD_EXEMPT[k.key] && !KNOWN_DEAD[k.key]) problems.push(`${k.key}: SECTIONS 카드 없음 → 사용자가 도달할 진입점이 없다`);
  if (card && !rOk) problems.push(`${k.key}: 라우트 파일 없음(${card.route})`);
  if (!gate && !KNOWN_DEAD[k.key]) problems.push(`${k.key}: 운 게이트 없음 → 열 수단이 없다`);
  if (server === '—' && !KNOWN_DEAD[k.key]) problems.push(`${k.key}: 서버 게이트 미등록 → **직접 invoke 로 무료 생성 가능**(비용·수익 누수)`);
}

console.log('');
if (!problems.length) ok(`${KINDS.length}종 전부 정상(운가·진입·라우트·게이트·서버게이트)`);
else problems.forEach((p) => bad(p));

// ── 교차 검증: 운가가 있는데 판매목록에 없는 유령 kind ────────────────────

// ── 예외의 '증거' 검사 ───────────────────────────────────────────────────
console.log('\n[예외] 카드 없이 호스트 화면에서 파는 것 — 판매 코드가 실제로 있는가');
for (const [kind, re] of Object.entries(CARD_EXEMPT)) {
  const where = [...srcOf].find(([, s2]) => re.test(s2));
  if (where) ok(`${kind}: ${where[0].replace(ROOT, '').replace('app/src/', '')} 에서 판매`);
  else bad(`${kind}: 카드도 없고 호스트 화면의 판매 코드도 없다 — 살 방법이 없다`);
}

// ── 판매 경로 0(죽은 상품) 보고 ──────────────────────────────────────────
console.log('\n[죽은 상품] 판매목록에 있으나 살 수 있는 경로가 없다 (★daniel 결정 대기)');
for (const [kind, why] of Object.entries(KNOWN_DEAD)) {
  const still = KINDS.some((k) => k.key === kind);
  if (still) console.log(`  ⚠️ ${kind} — ${why}`);
  else ok(`${kind}: 판매목록에서 제거됨(정리 완료)`);
}

console.log('\n[교차] 운가 ↔ 판매목록');
{
  const sellable = new Set(KINDS.map((k) => k.key));
  const ghost = [...COIN.keys()].filter((k) => !sellable.has(k));
  if (!ghost.length) ok(`운가 ${COIN.size}종이 전부 판매목록 안에 있다`);
  else bad(`판매목록에 없는 운가: ${ghost.join(', ')} — 오타이거나 폐지 잔재`);
}

// ── 구 쿠폰 차단 잔재(07-30 사고 유형) ───────────────────────────────────
console.log('\n[회귀] 쿠폰 0 → 차단 패턴(07-30 사고 유형)');
{
  const hit = [...srcOf].filter(([, s]) => /credits\['[a-z_0-9]+'\]\s*\?\?\s*0\)\s*<=\s*0\)\s*\{\s*Alert\.alert/.test(s));
  if (!hit.length) ok('구 쿠폰 게이트로 막는 화면 0건');
  else bad(`쿠폰으로만 열리는 화면: ${hit.map(([f]) => f.replace(ROOT, '')).join(', ')}`);
}

console.log(fail ? `\n❌ check:paid 실패 ${fail}건` : '\n✅ check:paid 통과 — 유료 콘텐츠 전 구간 이상 없음');
process.exit(fail ? 1 : 0);
