#!/usr/bin/env node
// scripts/audit-guard.mjs — 2026-07-03 전면 감사 후속 하네스: 감사에서 드러난 실수의 *재발*을 배포 전에 자동 차단
// ─────────────────────────────────────────────────────────────────────────
// 배경(왜 필요한가):
//   2026-07-03 보안·코드·출시 4관점 전면 감사에서 다음 유형의 실수가 드러났다. 사람이 매번 기억으로
//   막는 것은 반드시 새는 지점이 있어(이 프로젝트의 운영 원칙 = "반복 실수는 재수정 말고 하네스로").
//   이 스크립트가 그 실수들을 정적 검사로 *배포 전에* 잡는다. check-prompt-sync.mjs 와 동일한 계열.
//
//   [A] 페이월 서버 게이트 누락 — 유료 kind 를 추가하고 interpret 의 SERVER_GATED 등록을 빠뜨리면
//       그 콘텐츠가 '직접 invoke 로 무료 생성'된다(2026-07-03 C3 취약점 = roots/image/mission/gaeun/celeb).
//   [B] VERIFY_ADS=true 로 출시 — 전원 테스트광고(광고수익 0 + App Store 2.1 리젝).
//   [C] 구매 복원 버튼 미배선 — Apple 3.1.1(비소모성 IAP) 리젝.
//   [D] rc-webhook fail-open — RC_WEBHOOK_SECRET 미설정 시 인증 스킵 → 위조 웹훅으로 무한 크레딧/프리미엄.
//   [E] naver-auth 오픈 리다이렉트 — app_redirect 스킴 미검증 → 매직링크 토큰 탈취(계정 탈취).
//   [F] Info.plist 권한 문구 누락 — 이미지 공유 시트 "저장"에서 크래시(2.1).
//
// 심각도 정책(핵심 설계):
//   · 항상 차단(FAIL, exit 1) = "지금 통과하고 있어 지켜야 하는" 회귀 방지 규칙(A). 새 위반이 생기면 즉시 실패.
//   · 릴리즈 차단(RELEASE-ONLY) = "지금 미해결(알려진 상태)"인 항목(B~E). 개발 preflight 에선 ⚠️경고로만 두어
//     개발 흐름을 막지 않고, fastlane 출시 빌드(--release)에선 FAIL 로 승격해 *출시를 강제 차단*한다.
//     → 이렇게 두면: 지금 preflight 는 깨지지 않고, 다음 출시 빌드는 이 이슈들이 해결돼야만 통과한다.
//   · 경고(WARN, exit 0) = 리젝 확정은 아니나 확인 권장(F).
//
// 사용:
//   node scripts/audit-guard.mjs             # 개발용 — A 회귀만 차단, B~E 는 경고(현재 미해결이라 흐름 유지)
//   node scripts/audit-guard.mjs --release   # 출시용(fastlane) — B~E 도 차단(미해결 이슈 있으면 빌드 실패)
//
// ⚠️ DB 상태(RLS·백업 테이블·RPC 권한)는 정적 파일로 못 본다 → 이 하네스 범위 밖.
//   그건 배포 후 `supabase advisors(security)` 확인 절차로(가이드 docs/HARNESS_감사가드.md 참조).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';

const RELEASE = process.argv.includes('--release');   // fastlane 출시 빌드에서 전달 — 릴리즈 차단 항목을 FAIL 로 승격
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// 결과 수집 — fails(차단) / warns(경고). rel=true 는 "릴리즈 전용 차단" 표시(리포트 구분용).
const fails = [];
const warns = [];
const add = (bucket, id, msg, rel = false) => bucket.push({ id, msg, rel });
const failAlways = (id, msg) => add(fails, id, msg);                       // 회귀 방지 — 항상 차단
const releaseBlock = (id, msg) => add(RELEASE ? fails : warns, id, msg, true); // 미해결 — 릴리즈에서만 차단
const warn = (id, msg) => add(warns, id, msg);

// app/src 를 재귀 순회하며 정규식에 매칭되는 .ts/.tsx 파일 경로를 모은다(호출처 탐색용).
function walkFind(dir, re) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = `${dir}/${name}`;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkFind(p, re));
    else if (/\.(ts|tsx)$/.test(name) && re.test(readFileSync(p, 'utf8'))) out.push(p);
  }
  return out;
}

// ── [A] 페이월 서버 게이트 정합 (항상 차단 — 회귀 방지) ───────────────────────────
//   유료 kind(coupons.ts CREDIT_KINDS)가 전부 interpret 에서 서버 게이트되는지 대조.
//   게이트 형태 3가지: ①SERVER_GATED 객체 값 ②SET_KIND 값(saju→reading 등) ③consume_credit 리터럴(compat/dream/followup).
const coupons = read('app/src/lib/billing/coupons.ts');
const interpret = read('supabase/functions/interpret/index.ts');
if (!coupons || !interpret) {
  warn('paywall-gate-skip', '페이월 게이트 검사 건너뜀 — coupons.ts 또는 interpret/index.ts 를 찾지 못함(supabase/ 는 gitignore라 CI 환경엔 없을 수 있음).');
} else {
  // 유료 kind 목록 = CREDIT_KINDS 배열의 key 리터럴
  const kinds = [...coupons.matchAll(/key:\s*'([a-z_0-9]+)'/g)].map((m) => m[1]);
  // interpret 에서 '서버 게이트되는 credit kind' 집합 수집
  const gated = new Set();
  const objBody = (name) => {
    const m = interpret.match(new RegExp(`const\\s+${name}\\b[^{]*\\{([\\s\\S]*?)\\}`)); // ★const 선언에 앵커(주석의 이름 언급 오탐 차단·daniel 07-07)
    return m ? m[1] : '';
  };
  for (const m of objBody('SERVER_GATED').matchAll(/(\w+):\s*'(\w+)'/g)) gated.add(m[2]); // 값 = credit kind
  for (const m of objBody('SET_KIND').matchAll(/(\w+):\s*'(\w+)'/g)) gated.add(m[2]);      // saju:'reading' → reading
  for (const m of interpret.matchAll(/p_kind:\s*'(\w+)'/g)) gated.add(m[1]);               // consume_credit 직접 리터럴
  // ALLOWLIST — 서버(interpret) 게이트가 불요한 유료 kind. *추가는 의식적 결정*이어야 하므로 사유 필수.
  const ALLOW = new Map([
    ['timeresolve', '온디바이스 결정론 도구(TPR) — LLM(interpret) 미경유. 클라 useCredit 로 1회 결제=도구 영구 해제.'],
  ]);
  for (const k of kinds) {
    if (gated.has(k) || ALLOW.has(k)) continue;
    failAlways('paywall-gate', `유료 kind '${k}' 가 interpret 서버 게이트에 없음 — 직접 invoke 로 무료 생성 가능(2026-07-03 C3형 취약점). ` +
      `supabase/functions/interpret/index.ts 의 SERVER_GATED 에 추가하거나, 정말 게이트 불요면 audit-guard.mjs ALLOW 에 사유와 함께 등록하세요.`);
  }
}

// ── [B] VERIFY_ADS / forceTestAds (릴리즈 차단) ──────────────────────────────────
const ads = read('app/src/lib/core/ads.ts');
if (ads) {
  if (/const\s+VERIFY_ADS\s*=\s*true/.test(ads))
    releaseBlock('verify-ads', 'ads.ts: VERIFY_ADS=true — 전원 구글 테스트광고(광고수익 0 + 심사관에 미완성으로 비쳐 App Store 2.1 리젝 위험). 출시 전 false 필수.');
  if (/let\s+forceTestAds\s*=\s*true/.test(ads))
    releaseBlock('force-test-ads', 'ads.ts: forceTestAds 초기값이 true — 전원 테스트광고 강제. 초기값 false 여야 함.');
}

// ── [C] 구매 복원 배선 (릴리즈 차단) ─────────────────────────────────────────────
//   restorePurchasesRC 정의는 purchases.ts. '정의 파일 밖'에서 호출돼야 실제 버튼이 배선된 것.
const restoreCallers = walkFind('app/src', /restorePurchasesRC\s*\(/).filter((p) => !p.endsWith('purchases.ts'));
if (!restoreCallers.length)
  releaseBlock('restore-purchases', '구매 복원 버튼 미배선 — restorePurchasesRC 호출처 0(정의만 존재). 비소모성 premium_lifetime 이라 Apple 3.1.1 리젝 사유. 설정 또는 마켓 화면에 복원 버튼을 연결하세요.');

// ── [D] rc-webhook fail-closed (릴리즈 차단) ─────────────────────────────────────
const rcwh = read('supabase/functions/rc-webhook/index.ts');
if (rcwh && /if\s*\(\s*secret\s*&&/.test(rcwh))
  releaseBlock('webhook-failopen', 'rc-webhook 인증이 fail-open(`if (secret && ...`) — RC_WEBHOOK_SECRET 미설정 시 인증을 통째로 건너뜀 → 위조 웹훅으로 무한 프리미엄/크레딧 발행 가능. `if (!secret || header !== secret) return 401` (fail-closed)로 바꾸고 운영 secret 설정을 확인하세요.');

// ── [E] naver-auth 오픈 리다이렉트 (릴리즈 차단) ─────────────────────────────────
const nav = read('supabase/functions/naver-auth/index.ts');
if (nav && /app_redirect/.test(nav)) {
  const guarded = /startsWith\(\s*['"]syncfortune:\/\//.test(nav) || /(allowlist|allowed|화이트리스트|허용)/i.test(nav);
  if (!guarded)
    releaseBlock('open-redirect', 'naver-auth: app_redirect 스킴 미검증 = 오픈 리다이렉트 → 로그인 성공 시 매직링크 token_hash 가 임의 주소로 전달되어 계정 탈취 가능. syncfortune:// (+허용 호스트) 화이트리스트를 강제하고 불일치 시 기본값으로 폴백하세요.');
}

// ── [F] Info.plist 권한 문구 (경고) ─────────────────────────────────────────────
const plist = read('app/ios/SyncFortune/Info.plist');
if (plist) {
  const sharesSomething = walkFind('app/src', /Share\.share/).length > 0;
  if (sharesSomething && !/NSPhotoLibraryAddUsageDescription/.test(plist))
    warn('plist-photo', 'Share.share 로 이미지를 공유하나 Info.plist 에 NSPhotoLibraryAddUsageDescription 없음 — 공유 시트에서 "이미지 저장" 선택 시 크래시 가능(App Store 2.1). 권한 문구를 추가하세요.');
  if (!/aps-environment/.test(read('app/ios/SyncFortune/SyncFortune.entitlements') || ''))
    warn('aps-env', '엔타이틀먼트에 aps-environment 없음 — 원격 푸시(gen_jobs 완료 알림) 미작동 가능. 서버측 푸시를 쓰면 TestFlight 실기기에서 수신 확인 필요.');
}

// ── [G] 리스트 안 absolute 드롭다운/토글 메뉴 (경고 — daniel 07-05 ChartPicker 교훈) ────────────
//   in-row 로 리스트(FlatList) 안에 position:'absolute' 드롭다운을 띄우면 ①리스트가 하단을 잘라내고(clipping)
//   ②뷰 전환·시트 닫힘 시 열림 상태가 남아 "계속 열려있는" 버그가 난다(daniel 지적). → 모달/바텀시트로 띄우고,
//   시트 닫힘(useEffect)·화면 blur(useFocusEffect) 시 열림 상태를 반드시 리셋(auto-dismiss)할 것.
for (const f of walkFind('app/src', /:\s*\{[^}]*position:\s*['"]absolute['"][^}]*\b(?:top|bottom)\s*:/)) {
  const src = read(f);
  if (!src) continue;
  const inList = /(FlatList|DraggableFlatList|SectionList)/.test(src);         // 리스트를 렌더하는 화면/컴포넌트
  const looksDropdown = /(actMenu|dropMenu|dropdown|popover|toggleMenu)\b/i.test(src); // 드롭다운/토글 메뉴 네이밍
  if (inList && looksDropdown)
    warn('inlist-dropdown', `${f}: 리스트 안 absolute 드롭다운/토글 메뉴 의심 — 하단 잘림·auto-dismiss 부재 위험. 모달/바텀시트로 전환하고 시트닫힘(useEffect)·화면 blur(useFocusEffect) 시 열림상태 리셋할 것(daniel 07-05 ChartPicker 교훈).`);
}

// ── 리포트 ──────────────────────────────────────────────────────────────────────
const mode = RELEASE ? '출시(release)' : '개발(dev)';
console.log(`\n🔎 감사 가드(audit-guard) — ${mode} 모드`);
if (warns.length) {
  console.log(`\n⚠️  경고 ${warns.length}건${RELEASE ? '' : ' (개발 모드: 릴리즈 전용 항목은 여기 표시 — 출시 빌드에선 차단됨)'}:`);
  for (const w of warns) console.log(`   ⚠️  [${w.id}]${w.rel ? '(릴리즈 차단)' : ''} ${w.msg}`);
}
if (fails.length) {
  console.error(`\n✖ 차단 ${fails.length}건:`);
  for (const f of fails) console.error(`   ✖ [${f.id}]${f.rel ? '(릴리즈)' : '(회귀)'} ${f.msg}`);
  console.error(`\n→ 위 항목을 해결한 뒤 다시 실행하세요. (개발 중이라면 회귀[A] 항목만 필수, 릴리즈 항목은 출시 빌드 전까지 유예)`);
  process.exit(1);
}
console.log(`\n✅ 감사 가드 통과 — 차단 0건${warns.length ? ` (경고 ${warns.length}건은 위 참고)` : ''}.`);
process.exit(0);
