#!/usr/bin/env node
// scripts/check-credit-drift.mjs — CREDIT_KINDS(SSoT) ↔ 결제/게이트 레이어 드리프트 방지 하네스
// ─────────────────────────────────────────────────────────────────────────
// 배경(왜 필요한가):
//   2026-06-28·07 반복된 사고 = "유료 kind 를 새로 추가하고 어느 한 레이어(서버 게이트·상품 매핑·스토어 등록)를
//   빠뜨려 결제손실/무료누출"이 났다(예: talent/astrology/gaeun/celeb 프로덕션 DB CHECK 드리프트, C3 무게이트 kind).
//   사람이 매번 4~5곳을 손으로 맞추면 반드시 새는 지점이 생긴다(이 프로젝트 운영 원칙 = "반복 실수는 하네스로").
//   → 이 스크립트가 결제 관련 *모든 레이어*를 CREDIT_KINDS(단일 출처)와 정적 대조해 배포 전에 드리프트를 차단한다.
//
// 단일 출처(SSoT):
//   app/src/lib/billing/coupons.ts 의
//     · CreditKind  (타입 union)      = "알려진 kind 전체"(판매 안 하지만 타입만 남긴 것 포함, 예: child_couple)
//     · CREDIT_KINDS(배열, price 포함) = "실제 판매하는 유료 kind"(= SELLABLE). 모든 검사의 기준.
//
// 검사 레이어(각 레이어가 SSoT 와 일치하는가 — 정방향 누락 + 역방향 잔재 둘 다):
//   [1] 서버 게이트   supabase/functions/interpret/index.ts
//         유료 kind 가 전부 서버에서 결제 게이트되는가(안 되면 직접 invoke 로 무료 생성 = C3형 취약점).
//         게이트 형태 3가지: ①SERVER_GATED 객체 값 ②SET_KIND 값(saju→reading 등 '세트 과금') ③consume_credit 리터럴(compat/dream/followup).
//         + 역방향: CREDIT_KINDS 에 없는 잔재(numerology 등)가 게이트에 남아있나.
//   [2] 상품 매핑     app/src/lib/billing/purchases.ts (CREDIT_PRODUCT: kind ↔ 스토어 상품 id)
//         유료 kind ↔ 상품 id 매핑 누락 / 타입에 없는 잔재 키.
//   [3] 스토어 등록   app/fastlane/{asc-price.js(PRICES)·asc-iap.js(PRODUCTS)·rc-setup.js(CREDITS+PREMIUM)}
//         각 스토어 등록 스크립트에 상품이 존재하나(없으면 결제창 미표시/RC 미연결) / 잔재 상품.
//
// ★ DB CHECK 는 이 스크립트가 못 본다(런타임/원격):
//   entitlement_credits·coupons 테이블의 CHECK 제약(허용 kind 목록)은 마이그레이션으로 관리되는 *DB 상태*라
//   정적 파싱 대상이 아니다. → CREDIT_KINDS 와 **수동 동기화(마이그레이션)** 해야 하며, 현재 알려진 kind = 24종
//   (CreditKind 타입 union 기준). 프로덕션 CHECK 드리프트(로그인 유저 결제 잠복버그)는 supabase MCP 로 별도 점검.
//
// ★ numerology 는 병렬로 SERVER_GATED 에서 제거 중(R5 — 수비학 무료 병합).
//   지금은 게이트에 남아있어 이 하네스가 '잔재'로 잡고 **빌드를 막는다**(exit 1). 리포트에 'R5로 제거 예정' 주석을 단다.
//   (R5 로 numerology 게이트 항목이 제거되면 이 실패는 자동 해소된다.)
//
// ★ audit-guard.mjs [A] 와의 관계: audit-guard 는 레이어[1]의 *정방향*(유료 kind → 게이트)만 본다.
//   이 스크립트는 그 정방향에 더해 **역방향(잔재)·[2]상품 매핑·[3]스토어 3종**까지 대조하는 상위집합이다(결제 드리프트 전용).
//
// 사용:  node scripts/check-credit-drift.mjs
//        · 드리프트 있으면 exit 1(프리플라이트 차단) · 없으면 exit 0.
//        · package.json preflight(→ preflight:release 상속)에 배선.
import { readFileSync, existsSync } from 'node:fs';

// ── 파일 로드(없으면 null — supabase/ 는 gitignore라 CI 환경엔 없을 수 있어 graceful skip) ──
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const F = {
  coupons: 'app/src/lib/billing/coupons.ts',
  purchases: 'app/src/lib/billing/purchases.ts',
  interpret: 'supabase/functions/interpret/index.ts',
  ascPrice: 'app/fastlane/asc-price.js',
  ascIap: 'app/fastlane/asc-iap.js',
  rcSetup: 'app/fastlane/rc-setup.js',
};
const src = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, read(p)]));

// ── 결과 수집 ─────────────────────────────────────────────────────────────────────
//   fails = 드리프트(빌드 차단, exit 1) / warns = 화이트리스트 주석성 경고(비차단, exit 0에 영향 없음).
const fails = [];
const warns = [];
const fail = (layer, msg) => fails.push({ layer, msg });
const warn = (layer, msg) => warns.push({ layer, msg });

// ── 파싱 헬퍼 ─────────────────────────────────────────────────────────────────────
// 라인 주석(//...) 제거 — 슬라이스한 객체/배열 본문에서 주석 속 텍스트가 정규식에 오탐되지 않게(값에 '//' URL 없음 전제).
const stripComments = (s) => s.replace(/\/\/[^\n]*/g, '');

// `const <name> ... = { ... }` 객체의 본문(가장 바깥 중괄호 안) 추출. 값이 전부 문자열이라 중첩 중괄호 없음 → lazy 매칭으로 충분.
//   ⚠️ 반드시 `const <name>` 로 앵커(선언부 지정) + `=` 이후의 `{` 로 시작 — 타입 주석(예: `Record<...>`)이나 주석 속 이름 언급에 오탐되지 않게.
function objBody(text, name) {
  if (!text) return '';
  const m = text.match(new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\}`));
  return m ? stripComments(m[1]) : '';
}
// `const <name> ... = [ ... ]` 배열의 본문(첫 ']'까지) 추출.
//   ⚠️ `= [` 를 기준으로 잡는다 — 타입 주석의 배열 접미사(예: `{...}[] =`)의 `[]` 를 배열 리터럴로 오인하지 않게(CREDIT_KINDS 케이스).
function arrBody(text, name) {
  if (!text) return '';
  const m = text.match(new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\]`));
  return m ? stripComments(m[1]) : '';
}
// 문자열에서 `'...'` 리터럴 전부 → 배열.
const quoted = (s) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]);

// ══════════════════════════════════════════════════════════════════════════════════
// 0) SSoT 파싱 — CreditKind 타입 union(TYPE) + CREDIT_KINDS 배열(SELLABLE)
// ══════════════════════════════════════════════════════════════════════════════════
// SSoT 파싱은 항상 먼저 수행(null-safe) — TYPE/SELLABLE 이 report() 호출 전에 반드시 초기화되도록(TDZ 방지).
//   CreditKind 타입 union: `export type CreditKind = 'a' | 'b' | ... ;`
const typeMatch = (src.coupons || '').match(/export type CreditKind\s*=\s*([^;]+);/);
const TYPE = new Set(typeMatch ? quoted(typeMatch[1]) : []);
//   CREDIT_KINDS 배열의 key 리터럴 = 실제 판매 유료 kind.
const SELLABLE = [...arrBody(src.coupons || '', 'CREDIT_KINDS').matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]);
// SSoT 파싱 실패(파일 없음·형식 변경) 시 = 대조 불가 → 경고만 남기고 통과(다른 레이어 파일도 없을 가능성).
if (!src.coupons || !TYPE.size || !SELLABLE.length) {
  warn('SSoT', `${F.coupons} 의 CreditKind/CREDIT_KINDS 를 파싱하지 못함 — 드리프트 검사를 건너뜁니다(파일 경로·형식 확인).`);
  report();
}

// ── 화이트리스트(예외) ─────────────────────────────────────────────────────────────
//   GATE_ALLOW = 서버(interpret) 게이트가 *불요*한 유료 kind(사유 필수). 추가는 의식적 결정이어야 함.
const GATE_ALLOW = new Map([
  ['timeresolve', '온디바이스 결정론 도구(TPR) — LLM(interpret) 미경유. 클라 useCredit 로 1회 결제=도구 영구 해제.'],
  ['celeb', '온디바이스 무료 전환(07-07) — 결정론(computeChart·rankCelebs)·API 0·마켓 미노출(MARKET_HIDDEN). interpret 는 kind=celeb 하드 거부(비용 벡터 차단). CREDIT_KINDS 타입은 파급 최소화로 유지.'],
]);
//   TYPE_ONLY = CreditKind 타입엔 있으나 CREDIT_KINDS(판매목록)엔 없는 kind(=타입 잔존). 게이트/스토어에 있으면 경고.
const TYPE_ONLY = new Map([
  ['child_couple', 'UI 제거(07-04, 부부모드) — CreditKind 타입엔 남김(Edge 호환). 판매/스토어에선 노출 안 함.'],
]);
//   KNOWN_RESIDUE = CREDIT_KINDS/타입에 없는데 어느 레이어에 남은 '잔재'. { note, fatal }. numerology = R5 제거 대상(차단).
const KNOWN_RESIDUE = new Map([
  ['numerology', { note: 'R5로 제거 예정 · 수비학 무료 병합(온디바이스). SERVER_GATED 에서 제거하면 해소됩니다.', fatal: true }],
]);

// ══════════════════════════════════════════════════════════════════════════════════
// [1] 서버 게이트(interpret) 정합 — 정방향(누락) + 역방향(잔재)
// ══════════════════════════════════════════════════════════════════════════════════
if (!src.interpret) {
  warn('게이트', `${F.interpret} 를 찾지 못함 — 서버 게이트 검사 건너뜀(supabase/ 가 gitignore라 CI 환경엔 없을 수 있음).`);
} else {
  // 서버에서 결제 게이트되는 credit kind 집합 수집(형태 3종).
  const gated = new Set();
  for (const m of objBody(src.interpret, 'SERVER_GATED').matchAll(/(\w+):\s*'(\w+)'/g)) gated.add(m[2]); // 값 = credit kind
  for (const m of objBody(src.interpret, 'SET_KIND').matchAll(/(\w+):\s*'(\w+)'/g)) gated.add(m[2]);      // saju:'reading' → reading(세트 과금)
  for (const m of src.interpret.matchAll(/p_kind:\s*'(\w+)'/g)) gated.add(m[1]);                          // consume_credit 직접 리터럴(compat/dream/followup)

  // 정방향: 판매 유료 kind 전부 게이트되나(GATE_ALLOW 제외).
  for (const k of SELLABLE) {
    if (gated.has(k) || GATE_ALLOW.has(k)) continue;
    fail('게이트', `유료 kind '${k}' 가 서버 게이트에 없음(SERVER_GATED/SET_KIND/consume_credit 어디에도) — ` +
      `직접 invoke 로 무료 생성 위험(2026-07-03 C3형). interpret 의 SERVER_GATED 에 추가하세요.`);
  }
  // 역방향: 게이트에 있는데 CREDIT_KINDS/타입에 없는 잔재.
  for (const g of gated) {
    if (TYPE.has(g)) {
      // 타입엔 있으나 판매목록엔 없는 kind가 게이트에 있으면 경고(정상이나 확인 — child_couple).
      if (TYPE_ONLY.has(g))
        warn('게이트', `'${g}' 가 서버 게이트에 존재하나 판매목록(CREDIT_KINDS)엔 없음 — ${TYPE_ONLY.get(g)} (정상, 확인용)`);
      continue;
    }
    const res = KNOWN_RESIDUE.get(g);
    if (res) fail('게이트', `게이트 잔재 kind '${g}' — CREDIT_KINDS(SSoT)에 없음. ${res.note}`);
    else fail('게이트', `게이트에 미등록 kind '${g}' — CREDIT_KINDS(SSoT)/CreditKind 타입에 없음(오타/잔재 의심). interpret 게이트에서 제거하거나 SSoT 에 추가하세요.`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════
// [2] 상품 매핑(purchases.ts CREDIT_PRODUCT) 정합
// ══════════════════════════════════════════════════════════════════════════════════
let productOf = new Map();      // kind → 스토어 상품 id
let PRODUCT_PREMIUM = 'premium_lifetime'; // 프리미엄 상품 id(CreditKind 아님 — 스토어엔 필수)
if (!src.purchases) {
  warn('상품', `${F.purchases} 를 찾지 못함 — 상품 매핑/스토어 검사 건너뜀.`);
} else {
  for (const m of objBody(src.purchases, 'CREDIT_PRODUCT').matchAll(/(\w+):\s*'([^']+)'/g)) productOf.set(m[1], m[2]);
  const pm = src.purchases.match(/PRODUCT_PREMIUM\s*=\s*'([^']+)'/);
  if (pm) PRODUCT_PREMIUM = pm[1];

  // 정방향: 판매 유료 kind 전부 상품 id 매핑 있나.
  for (const k of SELLABLE) {
    if (!productOf.has(k))
      fail('상품', `유료 kind '${k}' 의 상품 id 매핑 없음 — purchases.ts CREDIT_PRODUCT 에 '${k}: credit_${k}' 추가(결제 상품 미연결).`);
  }
  // 역방향: 상품 매핑 키가 CreditKind 타입에 있나(오타/잔재).
  for (const k of productOf.keys()) {
    if (!TYPE.has(k)) {
      const res = KNOWN_RESIDUE.get(k);
      fail('상품', `CREDIT_PRODUCT 에 미확인 kind '${k}' — CreditKind 타입에 없음(오타/잔재).${res ? ' ' + res.note : ''}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════
// [3] 스토어 등록(fastlane) 정합 — asc-price·asc-iap·rc-setup 각각 상품 존재
// ══════════════════════════════════════════════════════════════════════════════════
// 스토어에 있어야 할 상품 = 판매 유료 kind 의 상품 id 전부 + 평생 프리미엄.
const EXPECTED_STORE = new Set([...SELLABLE.map((k) => productOf.get(k)).filter(Boolean), PRODUCT_PREMIUM]);
// 상품 id → kind 역매핑(잔재 상품이 어떤 kind 인지 되짚어 경고/차단 구분).
const kindOfProduct = new Map([...productOf].map(([k, p]) => [p, k]));

// 각 스토어 스크립트의 상품 id 집합 추출.
const stores = {
  'asc-price.js': src.ascPrice ? new Set([...arrBody(src.ascPrice, 'PRICES').matchAll(/productId:\s*'([^']+)'/g)].map((m) => m[1])) : null,
  'asc-iap.js':   src.ascIap   ? new Set([...arrBody(src.ascIap, 'PRODUCTS').matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1])) : null,
  // rc-setup.js: CREDITS 배열 + PREMIUM 상수.
  'rc-setup.js':  src.rcSetup  ? (() => {
    const s = new Set(quoted(arrBody(src.rcSetup, 'CREDITS')));
    const pm = src.rcSetup.match(/const PREMIUM\s*=\s*'([^']+)'/);
    if (pm) s.add(pm[1]);
    return s;
  })() : null,
};

for (const [name, set] of Object.entries(stores)) {
  if (!set) { warn('스토어', `app/fastlane/${name} 를 찾지 못함 — 이 스토어 검사 건너뜀.`); continue; }
  // 정방향: 있어야 할 상품이 스토어 스크립트에 있나.
  for (const p of EXPECTED_STORE) {
    if (!set.has(p))
      fail('스토어', `${name}: 상품 '${p}' 누락 — 스토어 등록 스크립트에 추가(미등록 시 결제창 미표시/RC 미연결).`);
  }
  // 역방향: 스토어에만 있는 잔재 상품.
  for (const p of set) {
    if (EXPECTED_STORE.has(p)) continue;
    const k = kindOfProduct.get(p);
    if (k && TYPE_ONLY.has(k))
      warn('스토어', `${name}: '${p}' 존재 — ${k}(${TYPE_ONLY.get(k)}) 상품이라 스토어에서 제외 권장.`);
    else
      fail('스토어', `${name}: 미확인 상품 '${p}' — CREDIT_PRODUCT/PREMIUM 어디에도 없음(오타/잔재). 제거하거나 매핑을 맞추세요.`);
  }
}

report();

// ── 리포트 + 종료 ─────────────────────────────────────────────────────────────────
function report() {
  console.log('\n🔎 결제 드리프트 검사(check-credit-drift) — CREDIT_KINDS(SSoT) ↔ 게이트/상품/스토어');
  if (TYPE?.size)
    console.log(`   · 알려진 kind ${TYPE.size}종(CreditKind 타입) / 판매 ${SELLABLE.length}종(CREDIT_KINDS) — DB CHECK 는 마이그레이션으로 수동 동기화(런타임, 이 하네스 범위 밖).`);
  if (warns.length) {
    console.log(`\n⚠️  경고 ${warns.length}건(화이트리스트/스킵 — 비차단):`);
    for (const w of warns) console.log(`   ⚠️  [${w.layer}] ${w.msg}`);
  }
  if (fails.length) {
    console.error(`\n✖ 드리프트 ${fails.length}건:`);
    for (const f of fails) console.error(`   ✖ [${f.layer}] ${f.msg}`);
    console.error('\n→ 위 불일치를 해소한 뒤 다시 실행하세요(CREDIT_KINDS 를 단일 출처로 각 레이어를 맞춥니다).');
    process.exit(1);
  }
  console.log(`\n✅ 결제 드리프트 없음 — 게이트·상품·스토어 3레이어가 CREDIT_KINDS 와 일치.${warns.length ? ` (경고 ${warns.length}건은 위 참고)` : ''}`);
  process.exit(0);
}
