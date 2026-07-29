// scripts/check-cta.ts — 콘텐츠 유도 CTA = 이미지 카드 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29 (IMG_8295): "유도 컨텐츠는 저렇게 이미지까지 나와야해 아래에 추천컨텐츠 처럼"
//
// ★무엇이 문제였나: 재미 콘텐츠 하단의 **주 전환 버튼**이 글자만 있는 테두리 버튼인데,
//   바로 아래 '이어서 보면 좋은 콘텐츠'는 이미지 카드였다 → **덜 중요한 쪽이 더 잘 보이는 역전**.
//   이건 버그로 안 잡힌다(동작은 정상). 그래서 하네스로 '형태'를 고정한다.
//
// 지키는 것: 재미 콘텐츠 화면의 콘텐츠 유도 CTA 는 DeepDiveCta(이미지 카드)여야 한다.
//   ⚠️ 제외: 명식 등록 유도·결제(쿠폰으로 열기)·실행 버튼·공유페이지 홈 이동 —
//      이들은 '콘텐츠로 보내는' CTA 가 아니다(이미지로 대표할 대상이 없다).
//
// 실행: npm run check:cta
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

console.log('\n🔎 콘텐츠 유도 CTA 형태\n');

// 재미 콘텐츠 → 유료 콘텐츠로 보내는 화면들
const SCREENS = ['bok', 'pastlife', 'joseonjob', 'traits', 'lovestyle'];
for (const n of SCREENS) {
  const src = read(`app/src/app/(app)/${n}.tsx`);
  if (!src) { bad(`${n}.tsx 없음 — 하네스 대상 목록이 낡았다`); continue; }
  const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hasCard = /<DeepDiveCta\s/.test(code);
  // 글자만 있는 유도 버튼이 남아 있나(등록·결제·실행 제외)
  const plainLeft = /<PressableScale style=\{styles\.cta\}[\s\S]{0,220}?(깊이 보기|더 보기|자세히)/.test(code);
  if (hasCard && !plainLeft) ok(`${n} — 이미지 카드(DeepDiveCta)`);
  else if (!hasCard) bad(`${n} — 유도 CTA 가 아직 글자 버튼이다(추천 카드보다 덜 보인다)`);
  else bad(`${n} — DeepDiveCta 와 글자 CTA 가 섞여 있다`);
}

// 컴포넌트가 단일 출처에서 이미지를 끌어오는가(하드코딩 금지)
{
  const c = read('app/src/components/DeepDiveCta.tsx');
  if (!c) bad('DeepDiveCta.tsx 가 없다');
  else {
    if (/from '\.\.\/lib\/content\/contentSections'/.test(c)) ok('이미지·설명을 SECTIONS 단일 출처에서 조립');
    else bad('DeepDiveCta 가 이미지를 하드코딩한다 — 콘텐츠가 늘면 갈라진다');
    if (/if \(!meta\?\.image\)/.test(c)) ok('이미지 없으면 글자 버튼 폴백(빈 카드 방지)');
    else bad('이미지 폴백이 없다 — 매핑 없는 kind 에서 빈 네모가 뜬다');
  }
}

console.log(fail ? `\n❌ check:cta 실패 ${fail}건` : `\n✅ check:cta 통과 — ${SCREENS.length}개 화면`);
process.exit(fail ? 1 : 0);
