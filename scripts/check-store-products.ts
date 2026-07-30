// scripts/check-store-products.ts — 앱이 사려는 스토어 상품 ↔ 실제 등록된 상품 정합
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-30: "전수조사해서 죽은 코드면 걷어내"
//
// ★왜 필요한가(실사고): `register.tsx` 의 '업그레이드' 버튼이 `premium_lifetime` 을 사려 했다.
//   그런데 ①프리미엄은 07-28 폐지됐고 ②그 상품은 **Play 에 등록조차 없었다**.
//   타입체크·린트 다 통과한다 — 상품 id 는 그냥 문자열이고, 실패는 **사용자 손에서만** 드러난다
//   ("상품을 불러오지 못했어요"). 죽은 코드가 아니라 **살아 있는 깨진 결제 경로**였다.
//
// ★규칙(단순·강력): **스토어 결제는 코인 팩으로만 나간다.**
//   07-28 코인 단일화폐 전환의 귀결이다. 콘텐츠는 코인으로 열고(ensureCoinsFor),
//   현금은 코인 충전 한 곳에서만 오간다. 그래서 Play 에 등록한 것도 코인 팩 4종뿐이다.
//
// 지키는 것:
//   S1 결제 진입점 — 스토어 결제 함수(purchaseStoreProduct)를 부르는 곳이 purchases.ts 한 곳뿐
//   S2 구매 대상   — 앱이 구매를 시도하는 상품 id 가 **코인 팩**뿐(폐지된 premium/credit 경로 부활 금지)
//   S3 죽은 잔재   — 제거한 함수·파일이 되살아나지 않았다
//   S4 조회 낭비   — 등록하지 않기로 한 상품군(credit_*)을 스토어에 묻지 않는다
//
// 실행: npm run check:store
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const files: string[] = [];
(function walk(d: string) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e)) files.push(p);
  }
})(join(ROOT, 'app/src'));

const PURCHASES = 'app/src/lib/billing/purchases.ts';
const src = strip(readFileSync(join(ROOT, PURCHASES), 'utf8'));

// ── S1 결제 진입점 ───────────────────────────────────────────────────────
console.log('\n[S1] 스토어 결제 호출은 purchases.ts 한 곳에서만');
{
  const outside = files.filter((f) => !f.endsWith('purchases.ts') && /purchaseStoreProduct\s*\(/.test(strip(readFileSync(f, 'utf8'))));
  if (!outside.length) ok('purchases.ts 외부에 직접 결제 호출 없음');
  else bad(`직접 결제 호출: ${outside.map((f) => f.replace(ROOT, '')).join(', ')} — 게이트(로그인·오프라인·LLM헬스)를 건너뛴다`);
}

// ── S2 구매 대상 ─────────────────────────────────────────────────────────
console.log('\n[S2] 앱이 사려는 상품 = 코인 팩뿐(Play 등록분과 일치)');
{
  // 코인 팩 단일 출처
  const coinSrc = readFileSync(join(ROOT, 'app/src/lib/billing/coinPrices.ts'), 'utf8');
  const packs = [...coinSrc.matchAll(/id:\s*'(coin_\d+)'/g)].map((m) => m[1]);
  if (packs.length >= 1) ok(`코인 팩 ${packs.length}종: ${packs.join(', ')}`);
  else bad('coinPrices.ts 에서 코인 팩을 못 읽었다 — 정규식이 형식 변경에 깨졌을 수 있다(빈 통과 방지)');

  // 구매를 실제로 트리거하는 exported 함수
  //   ⚠️이름에 purchase 가 들어가도 결제가 아닌 것들(logoutPurchases·restorePurchasesRC)은 제외한다 —
  //     '이름'이 아니라 '무엇을 하는가'로 판정해야 한다(이 프로젝트 반복 교훈).
  const buyers = [...src.matchAll(/export async function (\w*[Pp]urchase\w*)\s*\(/g)].map((m) => m[1])
    .filter((b) => !['logoutPurchases', 'restorePurchasesRC'].includes(b));
  const ALLOWED = new Set(['purchaseConsumableRC', 'purchaseCoinPack']);
  // ★알려진 예외(daniel 판단 대기 · 2026-07-30): 운세형 1년 경과 '재통변' 할인 구매.
  //   `credit_<kind>_r30/_r10` 을 사는데 이 상품군은 **Play 에 등록하지 않기로 했다**(코인 단일화폐).
  //   지금은 도달 불가에 가깝다(앱 출시 1년 미만 = 1년 경과 구매가 존재하지 않는다).
  //   그래도 남겨 두는 이유: 코인으로 바꾸려면 **재통변 할인가**를 정해야 하고 그건 daniel 의 결정이다.
  //   → 실패로 막지 않고 **경고로 계속 보이게** 한다(조용히 사라지면 1년 뒤 사고가 된다).
  const KNOWN_PENDING = new Set(['purchaseContentRenewalRC']);
  const extra = buyers.filter((b) => !ALLOWED.has(b) && !KNOWN_PENDING.has(b));
  const pending = buyers.filter((b) => KNOWN_PENDING.has(b));
  if (!extra.length) ok(`구매 함수 = ${buyers.join(', ')}`);
  else bad(`허용되지 않은 구매 함수: ${extra.join(', ')} — 코인 팩 외 결제 경로가 생겼다(스토어 미등록 상품일 가능성)`);
  for (const p of pending) console.log(`  ⚠️ ${p} — 재통변 할인 구매(credit_*_r30/_r10)는 Play 미등록. ★daniel 결정 대기(코인 전환 or 제거)`);

  // purchaseConsumableRC 호출부는 purchaseCoinPack 뿐이어야 한다(임의 상품 id 결제 차단)
  const callers = files.filter((f) => {
    const s = strip(readFileSync(f, 'utf8'));
    return /purchaseConsumableRC\s*\(/.test(s) && !f.endsWith('purchases.ts');
  });
  if (!callers.length) ok('purchaseConsumableRC 를 외부에서 직접 부르지 않는다(코인 팩 경유만)');
  else bad(`외부 호출: ${callers.map((f) => f.replace(ROOT, '')).join(', ')} — 임의 상품 id 로 결제가 나갈 수 있다`);
}

// ── S3 죽은 잔재 ─────────────────────────────────────────────────────────
console.log('\n[S3] 07-30 에 걷어낸 것이 되살아나지 않았다');
{
  const gone: Array<[string, RegExp | null, string]> = [
    ['purchaseCreditRC', /export async function purchaseCreditRC/, '건당 결제(코인 전환으로 폐지 · 실호출 0이었다)'],
    ['purchasePremiumRC', /export async function purchasePremiumRC/, '프리미엄 구매(폐지 · 상품 미등록)'],
  ];
  for (const [name, re, why] of gone) {
    if (re && re.test(src)) bad(`${name} 부활 — ${why}`);
    else ok(`${name} 없음 (${why})`);
  }
  const ent = 'app/src/lib/billing/entitlement.ts';
  if (existsSync(join(ROOT, ent))) bad(`${ent} 부활 — importer 0 인 죽은 파일이었다`);
  else ok('entitlement.ts 없음(죽은 파일)');
}

// ── S4 조회 낭비 ─────────────────────────────────────────────────────────
console.log('\n[S4] 등록하지 않기로 한 상품군을 스토어에 묻지 않는다');
{
  // credit_* 는 Play 에 등록하지 않는다(daniel 2026-07-30) → getProducts 로 물으면 항상 빈 결과다.
  //   ⚠️purchases.ts 는 제외 — CREDIT_PRODUCT 맵의 **정의처**이고(check:credit 참조점),
  //     그 안의 유일한 소비처는 위 S2 가 이미 경고로 추적 중인 재통변 경로다. 중복 실패를 만들지 않는다.
  const askers = files.filter((f) => {
    if (f.endsWith('purchases.ts')) return false;
    const s = strip(readFileSync(f, 'utf8'));
    return /CREDIT_PRODUCT/.test(s) && /(priceStrings?RC|getProducts)\s*\(/.test(s);
  });
  if (!askers.length) ok('credit_* 상품을 스토어에 조회하는 곳 없음');
  else bad(`스토어 조회 잔존: ${askers.map((f) => f.replace(ROOT, '')).join(', ')} — 항상 빈 결과(헛된 왕복)`);
}

console.log(fail ? `\n❌ check:store 실패 ${fail}건` : '\n✅ check:store 통과 — 결제 진입점·구매대상·잔재·조회낭비 OK');
process.exit(fail ? 1 : 0);
