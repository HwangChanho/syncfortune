// scripts/check-anon-gate.ts — 익명 세션 게이트 하네스
// ─────────────────────────────────────────────────────────────────────────
// ★2026-07-27 실제 신고(daniel "비회원인데 사주 풀이가 되잖아 자꾸"):
//   구매 전 로그인 게이트가 `if (session?.user) return true;` 였다.
//   ⚠️**이 앱은 상시 익명 세션을 만든다** → 익명도 `session.user` 를 갖는다 →
//   게이트가 아무도 막지 못했고 비회원이 그대로 구매·유료 생성까지 갔다.
//   같은 함정이 이미 여러 번 반복됐다(코드 주석에 흔적이 있다):
//     · login.tsx  "익명 세션이 항상 존재하므로 session 이 아닌 isRegistered 로 판정"
//     · settings   "익명 세션 상시라 session 아닌 isRegistered 로 구분"
//     · index.tsx  "익명 세션 상시라 !session 아닌 !isRegistered"
//   세 곳이 각각 따로 데어서 고쳤다는 뜻이다. 사람이 매번 기억할 수 없으니 기계가 지킨다.
//
// ★★2026-08-15 규칙이 **뒤집혔다** — G1 을 반대로 다시 쓴다.
//   위 07-27 판단("구매는 등록 유저만")으로 **5.1.1 두 번째 리젝**을 받았다(08-14).
//   Apple 원문: *"the app **still requires users to register** … to purchase In-App Purchase products
//   that **are not account based**"* / *"revise the app to **not require users to register before
//   purchasing**"*. 즉 Apple 은 우리 코인(운)을 계정형으로 보지 않는다.
//   ⚠️그런데 이 하네스는 **옛 규칙을 그대로 주장하고 있었다** — 코드는 08-15 에 고쳤는데
//     하네스는 "등록 유저 판정 사용 ✓" 이라고 통과시켰다(`isRegisteredUser` 가 파일에 남아 있어서.
//     실제로는 구매 게이트가 아니라 *구매 후 안내* 가 쓰던 것). 다음 사람이 이 출력을 믿고
//     코드를 되돌리면 **세 번째 리젝**이다. 그래서 규칙 자체를 갈아엎는다.
//
// 지키는 것:
//   G1 결제 게이트(requireLoginForPurchase)는 **익명 세션을 통과**시킨다(등록 강제 금지 · 5.1.1).
//      + 구매 후 **선택 안내**(suggestLoginAfterPurchase)가 존재한다(Apple Next Steps 그대로).
//   G2 '등록 유저' 의미의 분기에서 `session` 진위만으로 판정하지 않는다(익명 오통과 방지).
//      — 이건 여전히 유효하다. '무료로 쓰는 것'과 '돈을 낸 사람'은 다른 축이다.
//   G3 무료·온디바이스 경계는 넘지 않는다 — 게이트가 무료 콘텐츠까지 확대되면 5.1.1 재리젝 위험.
//
// 실행: npm run check:anongate
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── G1 결제 게이트 = 익명도 통과(5.1.1) ───────────────────────────────────
console.log('\n[G1] 구매 게이트는 익명 세션을 통과시킨다(등록 강제 금지 · Apple 5.1.1)');
{
  const raw = readFileSync(`${ROOT}app/src/lib/billing/requireLogin.ts`, 'utf8');
  const src = strip(raw);
  // ★**함수 본문만** 본다 — 파일 어딘가에 `isRegisteredUser` 가 있다는 사실은 아무것도 보장하지 않는다.
  //   (실제로 그 느슨한 판정 때문에 이 하네스가 08-15 까지 '통과'를 찍고 있었다.)
  //   ⚠️인자에 `() => void` 가 있어 `\([^)]*\)` 로는 못 잡는다 — 선언 위치부터 첫 열의 `}` 까지 자른다.
  const at = src.indexOf('export function requireLoginForPurchase');
  const end = at >= 0 ? src.indexOf('\n}', at) : -1;
  if (at < 0 || end < 0) bad('requireLoginForPurchase 를 못 찾았다(시그니처가 바뀌었나)');
  else {
    const body = src.slice(at, end);
    if (/isRegisteredUser\s*\(|userIsRegistered\s*\(/.test(body)) {
      bad('구매 게이트가 **등록 유저**를 요구한다 — Apple 이 5.1.1 로 두 번 반려한 바로 그 형태다');
    } else ok('등록 강제 없음');
    // uid 만 있으면 통과하는 경로가 실제로 있어야 한다(익명 세션도 uid 를 갖는다).
    //   공백을 전부 지우고 본다 — 줄바꿈·들여쓰기로 갈라져도 규칙이 안 깨지게.
    if (!/session\?\.user\?\.id\)returntrue/.test(body.replace(/\s+/g, ''))) {
      bad('익명 세션(uid 만 있는 상태)을 통과시키는 경로가 안 보인다');
    } else ok('uid 만 있으면 통과(익명 구매 가능)');
  }
  // 구매 뒤 **선택** 안내 — Apple Next Steps: "registering will enable … provide a way to register at any time"
  if (!/export function suggestLoginAfterPurchase/.test(src)) {
    bad('구매 후 로그인 안내(suggestLoginAfterPurchase)가 없다 — Apple 이 권한 대안 문구다');
  } else ok('구매 후 선택 안내 존재');
}

// ── G2 '등록' 의미 분기에서 session 진위만 쓰지 않는지 ──────────────────────
console.log('\n[G2] 등록 여부 분기에서 session 진위만으로 판정하지 않음');
{
  // 결제/계정 귀속을 다루는 파일만 본다(무료 화면의 session 체크는 정상 — 서버 호출 가능 여부 판단).
  const files = ['app/src/lib/billing/requireLogin.ts', 'app/src/lib/billing/localCredits.ts'];
  let hit = 0;
  for (const f of files) {
    let src: string;
    try { src = strip(readFileSync(`${ROOT}${f}`, 'utf8')); } catch { continue; }
    // "등록/가입" 의미로 session 을 쓰는 흔한 오형태
    if (/isRegistered\s*=\s*!!\s*session/.test(src)) { bad(`${f}: isRegistered 를 session 진위로 계산한다(익명 오판)`); hit++; }
  }
  if (!hit) ok('결제 관련 파일에 session→등록 오판 없음');
}

// ── G3 무료 경계 ─────────────────────────────────────────────────────────
console.log('\n[G3] 무료·온디바이스 콘텐츠는 계정 없이 열려 있어야(5.1.1 재리젝 방지)');
{
  // 대표 무료 화면들이 결제 게이트를 쓰고 있으면 경고 — 무료를 막으면 심사 위험이 실재한다.
  const FREE = ['app/src/app/(app)/today.tsx', 'app/src/app/(app)/taro.tsx', 'app/src/app/(app)/light.tsx', 'app/src/app/(app)/luck.tsx'];
  let hit = 0;
  for (const f of FREE) {
    let src: string;
    try { src = strip(readFileSync(`${ROOT}${f}`, 'utf8')); } catch { continue; }
    if (/requireLoginForPurchase\s*\(/.test(src)) {
      bad(`${f}: 무료 화면에 결제 로그인 게이트가 걸렸다 — 5.1.1(가입 강제) 재리젝 위험. 이 앱은 2026-07-08 에 5.1.1 로 리젝된 이력이 있다`);
      hit++;
    }
  }
  if (!hit) ok(`무료 화면 ${FREE.length}종에 결제 게이트 없음`);
}

console.log(fail ? `\n❌ check:anongate 실패 ${fail}건` : '\n✅ check:anongate 통과 — 익명 구매 가능(5.1.1) · 등록 오판 없음 · 무료 경계 유지');
process.exit(fail ? 1 : 0);
