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
//   K6 광고 제거 가격 정합 — 앱 표기(AD_FREE_PLANS) == 서버 RPC(buy_ad_free) 실제 차감액.
//   K7 광고 제거 반영 — 배너가 adFree 를 본다(안 보면 산 사람에게 광고가 계속 나온다 = 환불 사유).
//   K9  클라 직접 차감 — Edge 생성이 없는 도구는 서버 권위 RPC 로 실제 차감한다(무료 구멍 방지).
//   K10 잔액 노출 — 잔액 뷰가 RLS 를 우회하지 않고(security_invoker), 홈·마켓에 실제로 렌더된다.
//   K8 반쪽 전환 금지 — ensureCoinsFor 통과 뒤에 waitForCreditGrant 를 기다리지 않는다.
//      (코인을 썼는데 '크레딧 적립'을 폴링하면 영영 안 와서 흐름이 막다른 길이 된다 — 07-28 실제 발생)
//
// 실행: npm run check:coins
// ─────────────────────────────────────────────────────────────────────────
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// ★순수 데이터만 import — coins.ts/coupons.ts 는 supabase(→react-native)를 끌어와 tsx 가 파싱하지 못한다.
//   그래서 가격표는 coinPrices.ts(순수)로 분리했고, 기존 원화가는 coupons.ts **소스에서 읽는다**.
import { COIN_PRICE, COIN_PACKS, WON_PER_COIN, AD_FREE_PLANS } from '../app/src/lib/billing/coinPrices';

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

// ── K6 광고 제거 가격 정합 ────────────────────────────────────────────────
// ★왜 필요한가: 광고 제거는 **클라가 직접 부르는 RPC** 다(콘텐츠 소비는 Edge 경유).
//   그래서 금액을 서버가 정하는데, 앱 표기와 갈라지면 "30코인이라더니 100코인이 빠졌다"가 된다.
//   마이그레이션 SQL 을 정본으로 삼아 대조한다(supabase/ 는 gitignore — 없으면 스킵).
console.log('\n[K6] 광고 제거: 앱 표기 == 서버 RPC 차감액');
{
  let sql: string | null = null;
  try { sql = readFileSync(`${ROOT}supabase/migrations/0015_ad_free_by_coins.sql`, 'utf8'); } catch { sql = null; }
  if (!sql) {
    console.log('  – supabase/migrations 없음 — 스킵(이 저장소에선 gitignore 대상)');
  } else {
    // 서버 가격 추출: `if p_plan = 'adfree_30' then v_cost := 30;`
    const server = new Map<string, number>();
    for (const m of sql.matchAll(/p_plan\s*=\s*'([a-z_0-9]+)'\s*then\s*\n?\s*v_cost\s*:=\s*(\d+)/g)) {
      server.set(m[1], Number(m[2]));
    }
    if (server.size === 0) bad('마이그레이션에서 광고 제거 가격을 하나도 못 읽었다 — 패턴이 바뀌어 하네스가 헛돈다(역검증 실패)');
    for (const p of AD_FREE_PLANS) {
      const sv = server.get(p.id);
      if (sv == null) bad(`${p.id}: 서버 RPC 에 없는 상품 — 구매하면 'plan' 에러가 난다`);
      else if (sv !== p.coins) bad(`${p.id}: 앱 표기 ${p.coins}코인 ≠ 서버 차감 ${sv}코인 — 표기와 다른 금액이 빠진다`);
    }
    for (const [id] of server) {
      if (!AD_FREE_PLANS.some((p) => p.id === id)) bad(`서버에만 있는 광고 제거 상품 '${id}' — 앱에서 살 수 없다`);
    }
    if (!fail) ok(`${AD_FREE_PLANS.length}종 일치(${AD_FREE_PLANS.map((p) => `${p.id}=${p.coins}`).join(' · ')})`);
  }
  // 클라가 금액을 넘기지 않는지 — 넘길 수 있으면 '1코인 내고 광고 제거'가 된다
  const af = readFileSync(`${ROOT}app/src/lib/billing/adFree.ts`, 'utf8');
  if (/rpc\('buy_ad_free',\s*\{[^}]*cost/.test(af)) bad('클라가 buy_ad_free 에 금액을 넘긴다 — 위조하면 1코인에 광고 제거가 가능하다');
  else ok('클라는 plan 만 넘긴다(금액=서버 권위)');
}

// ── K7 광고 제거가 배너에 실제로 반영되나 ────────────────────────────────
console.log('\n[K7] 배너가 광고 제거 상태를 본다');
{
  // ★주석을 먼저 걷어낸다 — K3 에서 겪은 것과 같은 함정이다(주석 처리된 코드를 '살아 있다'고 읽었다).
  //   역검증에서 `// if (adFree) return null` 로 바꿔도 통과해 버려 하네스가 무의미했다.
  const stripSrc = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const banner = stripSrc(readFileSync(`${ROOT}app/src/components/AdBanner.tsx`, 'utf8'));
  if (/useAdFree\(\)/.test(banner) && /if \(adFree\) return null/.test(banner)) ok('AdBanner 가 adFree 로 숨김');
  else bad('AdBanner 가 광고 제거를 보지 않는다 — 돈 내고 산 사용자에게 광고가 계속 나온다(환불 사유)');
}

// ── K8 반쪽 전환(코인 게이트 + 크레딧 폴링 혼용) ─────────────────────────
// ★실제로 났던 사고: 화면 6곳을 코인으로 옮기면서 ensureCoinsFor 로 게이트만 바꾸고
//   그 뒤의 `waitForCreditGrant(kind)` 를 지우지 않은 곳이 3곳 남았다.
//   ensureCoinsFor 는 **차감하지 않는다**(서버가 생성 직전에 뺀다). 그래서 크레딧 적립은
//   영원히 오지 않고, 사용자는 "결제됐어요, 잠시 후 다시" 만 보고 갇힌다.
//   타입도 통과하고 에러도 없다 — 그래서 하네스가 아니면 못 잡는다.
console.log('\n[K8] 코인 게이트 뒤에 크레딧 적립 폴링이 남아 있지 않다');
{
  const { readdirSync } = await import('node:fs');
  const scan = (dir: string): string[] => {
    const out: string[] = [];
    for (const e of readdirSync(`${ROOT}${dir}`, { withFileTypes: true })) {
      if (e.isDirectory()) out.push(...scan(`${dir}/${e.name}`));
      else if (/\.tsx?$/.test(e.name)) out.push(`${dir}/${e.name}`);
    }
    return out;
  };
  const strip2 = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  let hit = 0;
  for (const f of scan('app/src')) {
    const src = strip2(readFileSync(`${ROOT}${f}`, 'utf8'));
    if (!/ensureCoinsFor\(/.test(src)) continue;
    // 같은 파일에서 ensureCoinsFor 이후 600자 안에 waitForCreditGrant 가 나오면 반쪽 전환
    for (const m of src.matchAll(/ensureCoinsFor\(/g)) {
      const after = src.slice(m.index ?? 0, (m.index ?? 0) + 600);
      if (/waitForCreditGrant\(/.test(after)) {
        bad(`${f}: 코인 게이트 통과 뒤 waitForCreditGrant 대기 — 적립이 오지 않아 흐름이 막힌다(코인은 서버가 생성 시 차감)`);
        hit++;
        break;
      }
    }
  }
  if (!hit) ok('반쪽 전환 없음');

  // ★확장(2026-07-28): 위 검사는 ensureCoinsFor 를 **쓰는** 파일만 봤다. 놓친 유형이 하나 더 있다 —
  //   ensureCoinsFor 를 아예 **안 쓰고** 구식 `purchaseCreditRC + waitForCreditGrant` 로 남은 화면.
  //   ⚠️정확히 말하면 이건 *막다른 길이 아니다* — 스토어 결제 → 웹훅이 크레딧 적립 → Edge 가 소비하므로
  //     여전히 동작한다. 문제는 **daniel 이 지시한 '코인 단일 경로'와 어긋난다**는 것:
  //     사용자에게 "30코인" 대신 "₩2,900 결제창"이 뜨고, 결제 왕복(지연·백그라운드 실패)이 그대로 남는다.
  //   (첫 메시지에 '막다른 길'이라 썼는데 사실과 달라 바로잡았다 — 틀린 진단이 박힌 하네스는 다음 사람을 헤매게 한다.)
  let legacy = 0;
  for (const f of scan('app/src')) {
    if (/billing\/(purchases|coupons)\.ts$/.test(f)) continue;   // 정의 파일은 제외
    const src = strip2(readFileSync(`${ROOT}${f}`, 'utf8'));
    if (/purchaseCreditRC\(/.test(src) && /waitForCreditGrant\(/.test(src)) {
      bad(`${f}: 구식 스토어 건당결제 잔존 — 동작은 하나 **코인 단일 경로가 아니다**(사용자에게 코인 대신 원화 결제창이 뜬다)`);
      legacy++;
    }
  }
  if (!legacy) ok('구식 건당결제 조합 없음');
}

// ── K9 클라 직접 차감(도구) — 앱 표기 == 서버 RPC 금액 ────────────────────
// ★실제로 났던 구멍: '태어난 시 찾기'는 결정론 도구라 Edge 생성 단계가 없다.
//   코인 전환 때 게이트만 통과시키고 **아무도 차감하지 않아** 사실상 무료가 됐다
//   (종전엔 useCredit 이 서버 크레딧을 깎고 있었다). 타입도 통과하고 에러도 없다.
console.log('\n[K9] 클라 직접 차감: 앱 표기 == 서버 RPC 금액');
{
  let sql: string | null = null;
  try { sql = readFileSync(`${ROOT}supabase/migrations/0016_spend_coins_fixed.sql`, 'utf8'); } catch { sql = null; }
  if (!sql) {
    console.log('  – supabase/migrations 없음 — 스킵(gitignore 대상)');
  } else {
    const server = new Map<string, number>();
    for (const m of sql.matchAll(/p_kind\s*=\s*'([a-z_0-9]+)'\s*then\s*v_cost\s*:=\s*(\d+)/g)) server.set(m[1], Number(m[2]));
    if (server.size === 0) bad('마이그레이션에서 직접차감 가격을 못 읽었다 — 패턴이 바뀌어 하네스가 헛돈다(역검증 실패)');
    for (const [k, sv] of server) {
      const app = (COIN_PRICE as Record<string, number>)[k];
      if (app == null) bad(`${k}: 서버 RPC 엔 있는데 앱 가격표에 없다`);
      else if (app !== sv) bad(`${k}: 앱 표기 ${app}코인 ≠ 서버 차감 ${sv}코인 — 표기와 다른 금액이 빠진다`);
    }
    // 화면이 실제로 차감을 부르는지 — 게이트만 통과시키고 차감을 빼먹은 게 이 항목이 생긴 이유다
    const tr = readFileSync(`${ROOT}app/src/app/(app)/timeResolve.tsx`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/spendCoinsFixed\('timeresolve'\)/.test(tr)) ok(`서버 권위 차감 호출 확인(${[...server].map(([k, v]) => `${k}=${v}`).join(' · ')})`);
    else bad("timeResolve 가 코인을 차감하지 않는다 — Edge 생성이 없는 도구라 아무도 안 깎으면 **무료로 풀린다**");
  }
}

// ── K10 잔액이 실제로 보이는가 ────────────────────────────────────────────
// ★두 가지 사고가 한꺼번에 났던 자리다(2026-07-28):
//   ① coin_balance 뷰에 security_invoker 가 없어 **RLS 를 우회** → 전 사용자 행이 나오고
//      클라의 .maybeSingle() 이 에러 → 잔액 null → 배지가 숨고 마켓이 '—'.
//      화면 버그처럼 보였지만 **남의 잔액이 조회되는 정보 노출**이기도 했다.
//   ② 마켓의 보유 코인 카드가 프리미엄 카드를 정규식으로 걷어낼 때 **JSX 만 함께 지워졌다**
//      (스타일은 남아 있어서 grep 으로는 멀쩡해 보였다).
console.log('\n[K10] 잔액 뷰 RLS + 화면 렌더');
{
  let sql: string | null = null;
  try { sql = readFileSync(`${ROOT}supabase/migrations/0017_coin_balance_security_invoker.sql`, 'utf8'); } catch { sql = null; }
  if (!sql) console.log('  – supabase/migrations 없음 — 스킵(gitignore 대상)');
  else if (/alter view public\.coin_balance set \(security_invoker = on\)/.test(sql)) ok('coin_balance = security_invoker(뷰가 RLS 를 우회하지 않는다)');
  else bad('coin_balance 뷰에 security_invoker 설정이 없다 — RLS 우회 + 남의 잔액 노출');

  const stripJsx = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const mk = stripJsx(readFileSync(`${ROOT}app/src/app/(app)/market.tsx`, 'utf8'));
  if (/styles\.coinCard/.test(mk) && /coins == null/.test(mk)) ok('마켓에 보유 코인 카드 렌더');
  else bad('마켓에 보유 코인 카드가 없다 — 스타일만 남고 JSX 가 지워진 적이 있다(2026-07-28)');

  // ★규칙 뒤집힘(daniel 2026-08-06 "기본적으로 운은 구매하는 곳에서만 보유 운 볼 수 있게 하자"
  //   + "명식 리스트에서 운 노출은 없애줘").
  //   [옛 규칙] 홈 상단에 배지가 **있어야** 했다(07-28 코인 전환 때 잔액 가시성 확보 목적).
  //   [지금] 잔액이 여기저기 떠 있는 것 자체가 과금 압박으로 읽힌다 → **구매 지점에만** 둔다.
  //   그래서 검사도 뒤집는다: 구매 지점 밖에서 잔액을 그리면 실패.
  //   (마켓 잔액 카드 검사는 위에 그대로 남아 있다 — 구매처에서는 반드시 보여야 한다.)
  const BALANCE_ALLOWED = ['app/src/app/(app)/market.tsx', 'app/src/app/(app)/coins.tsx', 'app/src/app/(app)/settings.tsx'];
  let leaked: string[] = [];
  try {
    leaked = execSync(`git grep -l --untracked -E "<CoinBadge" -- 'app/src/**/*.tsx'`, { cwd: ROOT }).toString()
      .trim().split('\n').filter(Boolean).filter((f) => !BALANCE_ALLOWED.includes(f));
  } catch { leaked = []; } // 매치 0건이면 git grep 이 exit 1 — 정상(노출 없음)
  if (leaked.length === 0) ok('보유 운은 구매 지점에만 노출(홈·명식 리스트 등에 배지 없음)');
  else bad(`구매 지점이 아닌 곳에 잔액 배지가 있다: ${leaked.join(', ')} — 잔액 상시 노출은 과금 압박으로 읽힌다`);
}

console.log(fail ? `\n❌ check:coins 실패 ${fail}건` : '\n✅ check:coins 통과 — 가격표 완전·환산정합·적립금지·팩단조·조회실패 구분·광고제거 정합 OK');
process.exit(fail ? 1 : 0);
