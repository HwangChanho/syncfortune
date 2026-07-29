// scripts/check-tabpad.ts — 탭 화면 하단 여백 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29 "여전히 글자 짤려"(IMG_8292 — 만세력 신살·공망 표 마지막 행이 탭바에 먹힘)
//
// ★왜 반복됐나: 하단 잘림은 **크래시가 아니라 '조금 가려짐'** 이라 스크린샷을 봐도 그냥 끝인 줄 안다.
//   그리고 화면마다 paddingBottom 을 눈대중으로 넣어서 값이 제각각이었다(12 / 24 / 40 / 80pt).
//   탭바(≈49) + 홈 인디케이터(≈34) = **약 83pt** 를 못 넘기면 마지막 줄이 먹힌다.
//
// 지키는 것: 탭 안에서 스크롤하는 화면의 하단 여백이 MIN_PAD 이상이다.
// 실행: npm run check:tabpad
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const MIN_PAD = 88;                      // 탭바 49 + 홈 인디케이터 34 + 여유

// 탭 화면(하단 탭바가 겹치는 화면들)
const SCREENS = [
  'app/src/app/(app)/index.tsx',
  'app/src/app/(app)/market.tsx',
  'app/src/app/(app)/community.tsx',
  'app/src/app/(app)/coach.tsx',
  'app/src/app/(app)/contents.tsx',
  'app/src/screens/MyeongsikScreen.tsx',
];

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

console.log('\n🔎 탭 화면 하단 여백 (탭바에 잘리지 않는가)\n');

for (const f of SCREENS) {
  let src: string;
  try { src = readFileSync(`${ROOT}${f}`, 'utf8'); }
  catch { bad(`${f} — 파일 없음(하네스 대상 목록이 낡았다)`); continue; }

  // 주석 제거 — 주석 안의 예시 코드에 걸려 헛통과하는 사고가 이 프로젝트에서 있었다
  const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const name = f.split('/').pop()!;

  // insets.bottom 을 더해 쓰면 통과(가장 정확한 방식)
  if (/insets\.bottom\s*\+/.test(code)) { ok(`${name} — safe-area(insets.bottom) 기반`); continue; }

  // 아니면 고정값이 MIN_PAD 이상이어야
  const vals = [...code.matchAll(/paddingBottom:\s*(?:space\((\d+(?:\.\d+)?)\)|(\d+))/g)]
    .map((m) => (m[1] !== undefined ? Number(m[1]) * 4 : Number(m[2])));
  if (!vals.length) { bad(`${name} — paddingBottom 을 찾지 못했다(스크롤 끝이 탭바에 먹힌다)`); continue; }
  const max = Math.max(...vals);
  if (max >= MIN_PAD) ok(`${name} — 고정 ${max}pt`);
  else bad(`${name} — 하단 여백 최대 ${max}pt < ${MIN_PAD}pt · 마지막 줄이 탭바에 잘린다`);
}

console.log(fail ? `\n❌ check:tabpad 실패 ${fail}건` : `\n✅ check:tabpad 통과 — ${SCREENS.length}개 화면`);
process.exit(fail ? 1 : 0);
