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
  // ★2026-07-30 재통변까지 코인으로 전환 → **예외 없이** 코인 팩뿐이어야 한다(종전 KNOWN_PENDING 해소).
  const ALLOWED = new Set(['purchaseConsumableRC', 'purchaseCoinPack']);
  const extra = buyers.filter((b) => !ALLOWED.has(b));
  if (!extra.length) ok(`구매 함수 = ${buyers.join(', ')}`);
  else bad(`허용되지 않은 구매 함수: ${extra.join(', ')} — 코인 팩 외 결제 경로가 생겼다(스토어 미등록 상품일 가능성)`);

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
    ['purchaseContentRenewalRC', /export async function purchaseContentRenewalRC/, '재통변 할인 SKU 구매(코인으로 전환 · credit_*_r30/_r10 는 Play 미등록)'],
    ['renewalCreditProductId', /export function renewalCreditProductId/, '재통변 SKU id 파생(같이 폐지)'],
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

// ── S5 재통변 코인가 정합(앱 ↔ 서버) ────────────────────────────────────
// ★같은 식이 두 곳에 복제돼 있다(앱 표시가 · 서버 실청구). 갈리면 **본 가격과 청구가 어긋난다** —
//   사용자 신뢰를 가장 빨리 깎는 종류의 버그라 기계로 못 박는다.
console.log('\n[S5] 재통변 코인 할인율·계산식이 앱과 서버에서 같다');
{
  const appSrc = strip(readFileSync(join(ROOT, 'app/src/lib/billing/repurchase.ts'), 'utf8'));
  const edgeSrc = strip(readFileSync(join(ROOT, 'supabase/functions/interpret/index.ts'), 'utf8'));
  const pctOf = (src: string) => Number(/RENEWAL_COIN_DISCOUNT_PCT\s*=\s*(\d+)/.exec(src)?.[1] ?? NaN);
  const a = pctOf(appSrc), e = pctOf(edgeSrc);
  if (Number.isFinite(a) && Number.isFinite(e) && a === e) ok(`할인율 ${a}% 일치`);
  else bad(`할인율 불일치/미발견 — 앱 ${a} vs 서버 ${e}`);
  // 계산식: 내림 + 최소 1코인(반올림이면 정가 5코인에서 할인이 사라진다)
  for (const [name, src] of [['앱', appSrc], ['서버', edgeSrc]] as const) {
    const fn = /function renewalCoinCost[\s\S]{0,240}?\}/.exec(src)?.[0] ?? '';
    if (/Math\.floor/.test(fn) && /Math\.max\(1/.test(fn)) ok(`${name} 계산식 = 내림 + 최소 1코인`);
    else bad(`${name} renewalCoinCost 가 내림/최소1 규칙이 아니다 — 할인이 0 이 되는 구간이 생긴다`);
  }
  // ★무단 차감 방지: 서버는 renewConfirm 없이는 청구하지 않아야 한다
  if (/renewConfirm\s*!==\s*true/.test(edgeSrc)) ok('서버가 renewConfirm 동의 없이는 차감하지 않는다');
  else bad('서버에 renewConfirm 가드가 없다 — 새로고침만으로 코인이 빠진다(무단 차감)');
  if (/refreshReading\(key,\s*true\)/.test(strip(readFileSync(join(ROOT, 'app/src/screens/ReadingScreen.tsx'), 'utf8')))) ok('앱이 동의 후 renewConfirm:true 로 재시도');
  else bad('앱이 동의 후에도 renewConfirm 을 안 보낸다 — 재통변이 영원히 안 된다(무한 안내)');
}

// ── S6 화폐명 = '운'(daniel 2026-07-30 "거래하는 화폐 단위를 woon(운)으로") ──────────
// ★내부 식별자는 그대로 `coin`이다 — Play 상품 id 는 **변경 불가(immutable)** 이고
//   DB 테이블(coin_balance·coin_ledger)·RPC(spend_coins_owner·grant_coins)까지 개명하면
//   마이그레이션·상품 재생성이 필요한데 사용자가 얻는 건 없다. **표시명만** 바꾼다.
//   그래서 하네스는 '코드'가 아니라 **사용자에게 보이는 문자열**만 본다.
console.log("\n[S6] 사용자에게 보이는 화폐 단위가 '운' 이다(코인 잔재 0)");
{
  const bad2: string[] = [];
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    let inBlock = false;
    raw.split('\n').forEach((ln, i) => {
      if (inBlock) { if (ln.includes('*/')) inBlock = false; return; }
      const tr = ln.trimStart();
      if (tr.startsWith('//') || tr.startsWith('*')) return;
      let head = ln;
      if ((ln.split('/*').length - 1) > (ln.split('*/').length - 1)) { inBlock = true; head = ln.slice(0, ln.indexOf('/*')); }
      // 주석 밖에서 '코인'·'コイン' 이 보이면 사용자 노출 문구다(변수명엔 한글을 쓰지 않는다)
      if (/코인|コイン/.test(head)) bad2.push(`${f.replace(ROOT, '')}:${i + 1}  ${head.trim().slice(0, 90)}`);
    });
  }
  if (!bad2.length) ok(`${files.length}개 파일에 노출용 '코인' 0건`);
  else { bad2.slice(0, 12).forEach((b) => console.error(`      ${b}`)); bad2.length && bad(`노출 문구에 '코인' ${bad2.length}건 남음 — 화폐명이 두 개로 갈린다`); }
  // 가격 표시 기호(◉·◈)도 제거됐는지 — 단위는 텍스트 '운' 으로 통일
  const sym = files.filter((f) => /[◈]/.test(readFileSync(f, 'utf8')));
  if (!sym.length) ok('구 화폐 기호(◈) 잔존 0');
  else bad(`구 화폐 기호 잔존: ${sym.map((f) => f.replace(ROOT, '')).join(', ')}`);
}

console.log(fail ? `\n❌ check:store 실패 ${fail}건` : '\n✅ check:store 통과 — 결제 진입점·구매대상·잔재·조회낭비·재통변정합·화폐명 OK');
process.exit(fail ? 1 : 0);
