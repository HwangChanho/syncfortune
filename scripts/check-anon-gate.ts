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
// 지키는 것:
//   G1 결제 게이트(requireLoginForPurchase)는 **등록 유저**로 판정한다(session.user 단독 금지).
//   G2 '등록 유저' 의미의 분기에서 `session` 진위만으로 판정하지 않는다(익명 오통과 방지).
//   G3 무료·온디바이스 경계는 넘지 않는다 — 게이트가 무료 콘텐츠까지 확대되면 5.1.1 재리젝 위험
//      (이 앱은 2026-07-08 에 5.1.1 로 리젝된 이력이 있다).
//
// 실행: npm run check:anongate
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── G1 결제 게이트 ────────────────────────────────────────────────────────
console.log('\n[G1] 결제 게이트는 등록 유저로 판정(익명 오통과 금지)');
{
  const src = strip(readFileSync(`${ROOT}app/src/lib/billing/requireLogin.ts`, 'utf8'));
  if (!/isRegisteredUser\s*\(|userIsRegistered\s*\(/.test(src)) {
    bad('requireLoginForPurchase 가 등록 여부를 확인하지 않는다 — 익명 세션도 session.user 를 가지므로 그대로 통과한다');
  } else ok('등록 유저 판정 사용');
  // `session?.user` 만으로 true 를 반환하는 형태가 남아 있으면 실패
  if (/if\s*\(\s*session\?\.\s*user\s*\)\s*return\s+true/.test(src)) {
    bad('`if (session?.user) return true` 형태가 남아 있다 — 익명이 통과한다');
  } else ok('session.user 단독 통과 없음');
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

console.log(fail ? `\n❌ check:anongate 실패 ${fail}건` : '\n✅ check:anongate 통과 — 결제=등록유저 판정 · 익명 오통과 없음 · 무료 경계 유지');
process.exit(fail ? 1 : 0);
