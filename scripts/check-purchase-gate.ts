#!/usr/bin/env tsx
// scripts/check-purchase-gate.ts
// ─────────────────────────────────────────────────────────────────────────
// 결제 전 Anthropic(클로드) 헬스/크레딧 게이트 회귀 방지 하네스 (Boss 2026-07-21).
//   요구: "풀이 구매 전에 무조건 클로드 콘솔에서 풀이 비용 남아있는지 확인." — Anthropic 이 죽었는데
//   (크레딧 소진·키 off) *결제(과금)가 먼저 일어나는* 돈 유실 경로를 막는다.
//
//   이 배선은 눈에 안 보이는 곳(purchaseConsumableRC 내부)이라, 나중에 리팩터로 호출이 빠지거나 *과금
//   뒤로 밀리면* 조용히 구멍이 다시 열린다(유저는 결제됐는데 풀이는 안 됨). 사람이 매번 못 지키는 종류
//   → 하네스로 못박는다(메모리 error-harness-prebuild-check).
//
// 규칙:
//   R1) purchaseConsumableRC(모든 풀이 이용권 결제의 단일 관문)는 assertReadingAvailable() 를 호출하고,
//       그 호출이 실제 과금(Purchases.getProducts / purchaseStoreProduct)보다 *먼저* 와야 한다(순서 필수).
//   R2) llmHealth.ts 는 서버 프로브('llm-health')를 호출하고, 확정 불가(ok===false)면 throw 로 결제를 막아야 한다.
//   R3) Edge llm-health 는 존재하고 ① Anthropic 프로브(messages.create) ② 수동 킬스위치(llm_paused)를 갖춰야 한다.
//   ★R4~R7) 열람 플로우 **순서**(daniel 2026-07-26 IMG_8190~8192 "순서가 이상해"):
//       R4) 소유 판정(isUnlocked/isAdminActing)이 **구매(buyCredit)보다 먼저** — 소유자에게 결제를 묻지 않는다.
//       R5) 크레딧 확인(loadCredits)이 **명식 확인(requestChartConfirm)보다 먼저** — 살지 정하기 전에 명식을
//           먼저 묻던 순서 역전(모달 2연타) 재발 방지.
//       R6) generate 성공 시 setRevealed(true) — 결제·생성 직후 상태 뷰가 다시 떠 '풀이 보기'를 또 누르게 하던 것.
//       R7) 플로우 잠금(flowRef)과 finally 해제 + stale 타임아웃 — 진행 중 중복 조작 차단, 잠금 누수 회수.
// ─────────────────────────────────────────────────────────────────────────
import * as fs from 'fs';
import * as path from 'path';

// npm 스크립트는 레포 루트에서 실행 → cwd 기준. app/src 와 supabase/functions 를 둘 다 가진 디렉터리를 루트로.
function resolveRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, 'app', 'src')) && fs.existsSync(path.join(dir, 'supabase', 'functions'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}
const ROOT = resolveRoot();
const read = (rel: string): string | null => {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

const fails: string[] = [];

// ── R1: purchaseConsumableRC 안에서 게이트가 과금보다 먼저 ────────────────────────────────
const PURCHASES = 'app/src/lib/billing/purchases.ts';
const purchasesSrc = read(PURCHASES);
if (!purchasesSrc) {
  fails.push(`[R1] 파일 없음: ${PURCHASES} (이동/개명?) — 하네스 경로를 갱신하라.`);
} else {
  // purchaseConsumableRC 함수 본문 추출: 선언부 ~ 다음 top-level export(또는 파일 끝).
  const declIdx = purchasesSrc.indexOf('function purchaseConsumableRC');
  if (declIdx < 0) {
    fails.push(`[R1] purchaseConsumableRC 를 찾지 못함 — 결제 단일 관문이 개명/분리됐다면 이 하네스와 게이트 배선을 재확인하라.`);
  } else {
    const after = purchasesSrc.slice(declIdx);
    const nextExport = after.indexOf('\nexport ', 1);
    const body = nextExport > 0 ? after.slice(0, nextExport) : after;
    const gateIdx = body.indexOf('assertReadingAvailable');
    // 실제 과금 시점: 상품 조회/구매 호출 중 먼저 오는 것.
    const chargeIdxs = ['getProducts', 'purchaseStoreProduct'].map((s) => body.indexOf(s)).filter((i) => i >= 0);
    const chargeIdx = chargeIdxs.length ? Math.min(...chargeIdxs) : -1;
    if (gateIdx < 0) {
      fails.push(`[R1] 결제 전 게이트 누락: purchaseConsumableRC 가 assertReadingAvailable() 를 호출하지 않음\n        → Anthropic 이 죽어도 과금이 먼저 일어난다(돈 유실). isOnline 체크 다음에 \`await assertReadingAvailable();\` 를 두라.`);
    } else if (chargeIdx >= 0 && gateIdx > chargeIdx) {
      fails.push(`[R1] 게이트 순서 오류: assertReadingAvailable 가 과금(getProducts/purchaseStoreProduct) *뒤*에 있음\n        → 결제가 먼저 일어난 뒤 확인 = 무의미. 게이트를 과금보다 앞으로 옮겨라.`);
    }
  }
}

// ── R2: llmHealth 가 서버 프로브 호출 + 확정 불가 시 throw ──────────────────────────────────
const LLMHEALTH = 'app/src/lib/billing/llmHealth.ts';
const healthSrc = read(LLMHEALTH);
if (!healthSrc) {
  fails.push(`[R2] 파일 없음: ${LLMHEALTH} — 결제 전 헬스 게이트의 클라 로직이 사라졌다.`);
} else {
  if (!healthSrc.includes(`'llm-health'`) && !healthSrc.includes('"llm-health"')) {
    fails.push(`[R2] llmHealth 가 Edge 'llm-health' 프로브를 호출하지 않음 → 결제 전 확인이 실제로 서버를 안 찌른다.`);
  }
  // ok===false 판정 + throw 가 있어야 '확정 불가 → 결제 차단'이 성립.
  if (!/ok\s*===\s*false/.test(healthSrc) || !/throw\s+new\s+Error/.test(healthSrc)) {
    fails.push(`[R2] llmHealth 가 확정 불가(ok===false)에 throw 하지 않음 → 클로드가 죽어도 결제가 통과된다.`);
  }
}

// ── R3: Edge llm-health 가 프로브 + 수동 킬스위치를 갖춤 ────────────────────────────────────
const EDGE = 'supabase/functions/llm-health/index.ts';
const edgeSrc = read(EDGE);
if (!edgeSrc) {
  fails.push(`[R3] Edge 함수 없음: ${EDGE} — 결제 전 프로브 엔드포인트가 사라졌다(앱은 fail-open 이라 조용히 무보호가 됨).`);
} else {
  if (!edgeSrc.includes('messages.create')) fails.push(`[R3] Edge llm-health 가 Anthropic 프로브(messages.create)를 하지 않음 → 크레딧/응답 확인 불가.`);
  if (!edgeSrc.includes('llm_paused')) fails.push(`[R3] Edge llm-health 에 수동 킬스위치(app_flags.llm_paused) 확인이 없음 → Boss 가 점검용으로 즉시 막을 수단이 사라졌다.`);
}

// ── R4~R7: 열람 플로우 순서·잠금(SpecialContentScreen) ─────────────────────────────
{
  const SCS = path.join(ROOT, 'app', 'src', 'components', 'SpecialContentScreen.tsx');
  const src = fs.existsSync(SCS) ? fs.readFileSync(SCS, 'utf8') : '';
  if (!src) {
    fails.push('[R4] SpecialContentScreen.tsx 를 찾을 수 없음 — 유료 콘텐츠 29종의 열람 플로우 검증 불가.');
  } else {
    const at = (needle: string) => src.indexOf(needle);
    const iOwned = Math.max(at('await isUnlocked(chartId, kind)'), at('await isAdminActing()'));
    const iBuy = at('await buyCredit()');
    const iCredits = at('await loadCredits()');
    const iConfirm = at('await requestChartConfirm(');
    const iGen = at('await generate(chartId)');

    if (iOwned < 0 || iBuy < 0) fails.push('[R4] runFlow 에서 소유 판정 또는 buyCredit 호출을 찾지 못함(플로우가 리팩터로 흩어졌는지 확인).');
    else if (!(iOwned < iBuy)) fails.push('[R4] 소유 판정이 구매(buyCredit)보다 뒤에 있음 → 이미 산 사람에게 결제를 묻게 된다.');

    if (iCredits < 0 || iConfirm < 0) fails.push('[R5] loadCredits 또는 requestChartConfirm 호출을 찾지 못함.');
    else if (!(iCredits < iConfirm)) fails.push('[R5] 명식 확인이 크레딧 확인보다 먼저 옴 → 살지 정하기 전에 명식을 묻는 순서 역전(모달 2연타) 재발.');

    if (iConfirm >= 0 && iGen >= 0 && !(iConfirm < iGen)) fails.push('[R5] 생성이 명식 확인보다 먼저 옴 → 어느 명식으로 만드는지 확인 없이 과금/생성.');

    // R6 — generate 성공 분기에서 공개
    if (!/if \(ok\) \{[\s\S]{0,600}setRevealed\(true\)/.test(src)) {
      fails.push('[R6] generate 성공(ok) 분기에 setRevealed(true) 가 없음 → 결제·생성 직후에도 상태 뷰가 다시 떠 한 번 더 탭해야 한다.');
    }

    // R7 — 플로우 잠금·해제·stale
    if (!src.includes('flowRef')) fails.push('[R7] flowRef(플로우 잠금)가 없음 → 진행 중 중복 조작이 겹친다.');
    if (!/finally \{[\s\S]{0,200}flowRef\.current = 0/.test(src)) fails.push('[R7] finally 에서 flowRef 해제가 없음 → 중간 이탈 시 잠금이 영구 누수된다.');
    if (!src.includes('FLOW_STALE_MS')) fails.push('[R7] stale 타임아웃(FLOW_STALE_MS)이 없음 → Alert 콜백 유실 시 잠금을 회수할 수 없다.');
    // 진행 중 조작 차단이 UI 에 반영되는지
    if (!src.includes('disabled={flowBusy}')) fails.push('[R7] CTA 에 disabled={flowBusy} 가 없음 → 진행 중에도 버튼이 눌린다.');
  }
}

// ── 출력(다른 check:* 관례: FAIL 시 exit 1) ──────────────────────────────────────────────
if (fails.length) {
  console.error('❌ check:purchase-gate FAIL — 결제 전 헬스 게이트 배선 문제 ' + fails.length + '건\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('✓ check:purchase-gate PASS — 결제 전 헬스 게이트(R1~R3) + 열람 플로우 순서·잠금(R4~R7) 배선 확인.');
