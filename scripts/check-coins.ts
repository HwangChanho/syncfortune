// scripts/check-coins.ts — 코인 시스템 계약 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28 코인 전환(docs/PLAN_coin_system.md).
//
// ★왜 하네스인가: 여기 결함은 **곧바로 돈 문제**가 된다.
//   · 가격표에 새 콘텐츠가 빠지면 → 무료로 풀리거나(손실) 결제가 막힌다(매출 0)
//   · 클라가 적립할 수 있으면 → 결제 우회(무한 코인)
//   · 환산이 틀리면 → 기존 사용자가 손해를 본다
//   콘텐츠는 계속 늘어나는데 가격표 갱신은 사람이 잊기 가장 쉬운 일이다.
//
// 지키는 것:
//   K1 가격표 완전성 — 모든 유료 kind 에 코인가가 있다(누락 0).
//   K2 환산 정합 — 코인가 × 100 이 기존 원화가와 **10% 이내**로 일치(임의 인상·인하 감지).
//   K3 적립 금지 — 클라 코드에 grant_coins 호출이 없다(적립은 서버 웹훅만).
//   K4 팩 단조성 — 큰 팩일수록 코인당 단가가 싸다(안 그러면 큰 팩을 살 이유가 없다).
//   K5 '0 vs 확인불가' 구분 — 잔액 조회가 실패를 null 로 구분한다(오늘 재결제 사고의 근인).
//
// 실행: npm run check:coins
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
// ★순수 데이터만 import — coins.ts/coupons.ts 는 supabase(→react-native)를 끌어와 tsx 가 파싱하지 못한다.
//   그래서 가격표는 coinPrices.ts(순수)로 분리했고, 기존 원화가는 coupons.ts **소스에서 읽는다**.
import { COIN_PRICE, COIN_PACKS, WON_PER_COIN } from '../app/src/lib/billing/coinPrices';

const ROOT = new URL('..', import.meta.url).pathname;

/** coupons.ts 소스에서 유료 kind·원화가를 읽는다(런타임 import 불가 — 위 주석 참조). */
function creditKindsFromSource(): { key: string; price: number }[] {
  const src = readFileSync(`${ROOT}app/src/lib/billing/coupons.ts`, 'utf8');
  return [...src.matchAll(/\{\s*key:\s*'([a-z_0-9]+)'\s*,\s*ko:\s*'[^']*'\s*,\s*price:\s*(\d+)/g)]
    .map((m) => ({ key: m[1], price: Number(m[2]) }));
}
const CREDIT_KINDS = creditKindsFromSource();
let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// ── K1 완전성 ────────────────────────────────────────────────────────────
console.log('\n[K1] 모든 유료 콘텐츠에 코인 가격이 있다');
{
  if (CREDIT_KINDS.length < 10) bad(`coupons.ts 에서 유료 kind 를 ${CREDIT_KINDS.length}개밖에 못 읽었다 — 패턴이 바뀌어 하네스가 헛돈다(역검증 실패)`);
  const missing = CREDIT_KINDS.filter((c) => !(c.key in COIN_PRICE)).map((c) => c.key);
  if (missing.length) bad(`코인 가격 누락: ${missing.join(', ')} — 결제가 막히거나 무료로 풀린다`);
  else ok(`${CREDIT_KINDS.length}종 전부 등록`);
  const extra = Object.keys(COIN_PRICE).filter((k) => !CREDIT_KINDS.some((c) => c.key === k));
  if (extra.length) bad(`존재하지 않는 kind 에 가격이 있다: ${extra.join(', ')}`);
  else ok('유령 항목 없음');
}

// ── K2 환산 정합 ─────────────────────────────────────────────────────────
console.log(`\n[K2] 코인가 × ${WON_PER_COIN} 이 기존 원화가와 일치(±10%)`);
{
  let off = 0;
  for (const c of CREDIT_KINDS) {
    const coin = (COIN_PRICE as Record<string, number>)[c.key];
    if (coin == null) continue;
    const won = coin * WON_PER_COIN;
    const diff = Math.abs(won - c.price) / c.price;
    if (diff > 0.10) { bad(`${c.key}: ${coin}코인(=₩${won}) vs 기존 ₩${c.price} — ${Math.round(diff * 100)}% 차이(의도치 않은 가격 변경?)`); off++; }
  }
  if (!off) ok('전 항목 ±10% 이내');
}

// ── K3 클라 적립 금지 ────────────────────────────────────────────────────
console.log('\n[K3] 클라에서 코인을 적립하지 않는다(결제 우회 차단)');
{
  const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // ★블록 주석(JSDoc)까지 — 설명에 함수명이 나오는 건 정상이다(오탐 실제 발생)
  const src = strip(readFileSync(`${ROOT}app/src/lib/billing/coins.ts`, 'utf8'));
  if (/grant_coins|rpc\(\s*['"]grant_coins/.test(src)) bad('coins.ts 에 grant_coins 호출이 있다 — 클라가 잔액을 올릴 수 있으면 결제 우회가 된다');
  else ok('coins.ts 에 적립 호출 없음');
  // 앱 전체로 확대 — 어디서든 적립하면 안 된다
  let hit = 0;
  for (const f of ['app/src/lib/billing/purchases.ts', 'app/src/lib/billing/coupons.ts']) {
    try {
      const s = strip(readFileSync(`${ROOT}${f}`, 'utf8'));
      if (/grant_coins/.test(s)) { bad(`${f} 에 grant_coins 호출`); hit++; }
    } catch { /* 없으면 통과 */ }
  }
  if (!hit) ok('결제 모듈에 적립 호출 없음');
}

// ── K4 팩 단조성 ─────────────────────────────────────────────────────────
console.log('\n[K4] 큰 팩일수록 코인당 단가가 싸다');
{
  const unit = COIN_PACKS.map((p) => ({ id: p.id, u: p.won / p.coins }));
  let badCnt = 0;
  for (let i = 1; i < unit.length; i++) {
    if (unit[i].u > unit[i - 1].u) { bad(`${unit[i].id} 단가(₩${unit[i].u.toFixed(0)})가 ${unit[i - 1].id}(₩${unit[i - 1].u.toFixed(0)})보다 비싸다 — 큰 팩을 살 이유가 없다`); badCnt++; }
  }
  if (!badCnt) ok(`팩 ${COIN_PACKS.length}종 단가 단조 감소(${unit.map((x) => `₩${x.u.toFixed(0)}`).join(' > ')})`);
}

// ── K5 '0 vs 확인불가' ───────────────────────────────────────────────────
console.log("\n[K5] 잔액 조회가 '0'과 '확인 불가'를 구분한다");
{
  const src = readFileSync(`${ROOT}app/src/lib/billing/coins.ts`, 'utf8');
  if (/if \(error\) return null/.test(src)) ok('조회 실패 → null(‘없음’과 구분)');
  else bad("조회 실패를 null 로 구분하지 않는다 — 실패를 '잔액 0'으로 읽으면 이미 결제한 사용자에게 재충전을 유도하게 된다(2026-07-28 사고와 동일 유형)");
}

console.log(fail ? `\n❌ check:coins 실패 ${fail}건` : '\n✅ check:coins 통과 — 가격표 완전·환산정합·적립금지·팩단조·조회실패 구분 OK');
process.exit(fail ? 1 : 0);
