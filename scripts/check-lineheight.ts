// scripts/check-lineheight.ts — 전역 최소 줄간격 보정 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "전반적으로 글자가 클때 줄간 간격이 너무 좁아"
//
// ★왜 하네스인가: 이 보정은 **앱 전체 가독성의 바닥**인데, 루트에서 호출 한 줄이 빠지면
//   아무 에러 없이 조용히 사라진다(타입도 통과·크래시도 없음). 화면은 그냥 다시 촘촘해질 뿐이라
//   되돌아간 걸 알아채기까지 오래 걸린다 — 실제로 '오늘의 기운' 잘림도 그렇게 오래 남아 있었다.
//
// 지키는 것:
//   L1 설치 — 앱 루트에서 installMinLineHeight() 를 부른다
//   L2 비율 — 크기대별 최소 줄높이가 의도대로 나온다(본문 1.5 / 중간 1.38 / 큰 제목 1.25)
//   L3 한 줄 예외 — numberOfLines===1 은 건드리지 않는다(배지·칩 높이 틀어짐 방지)
//   L4 의도 존중 — 이미 넉넉한 lineHeight 는 덮어쓰지 않는다
//   L5 짝 어긋남 교정 — fontSize 만 커지고 lineHeight 가 고정인 경우를 올려 준다(오늘의 기운 사고 유형)
//
// 실행: npm run check:lineheight
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
// ★순수 모듈만 import — textLineHeight.ts 는 react-native 를 끌어와 tsx 가 파싱하지 못한다.
import { resolveLineHeight, lineHeightRatio, lineHeightMaxRatio, TOO_TIGHT_RATIO } from '../app/src/lib/ui/lineHeightRule';

const ROOT = new URL('..', import.meta.url).pathname;
const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// ── L1 설치 ──────────────────────────────────────────────────────────────
console.log('\n[L1] 앱 루트에서 보정을 설치한다');
{
  const root = strip(readFileSync(`${ROOT}app/src/app/_layout.tsx`, 'utf8'));
  if (/installMinLineHeight\(\)/.test(root)) ok('_layout.tsx 에서 installMinLineHeight() 호출');
  else bad('루트에서 installMinLineHeight() 를 부르지 않는다 — 보정이 통째로 사라진다(에러 없이 조용히)');

  const mod = strip(readFileSync(`${ROOT}app/src/lib/ui/textLineHeight.ts`, 'utf8'));
  if (/installed\s*=\s*true/.test(mod) && /if \(installed\) return/.test(mod)) ok('중복 설치 가드 있음(Text.render 중첩 방지)');
  else bad('중복 설치 가드가 없다 — 두 번 부르면 렌더 래퍼가 중첩된다');
}

// ── L2 비율 ──────────────────────────────────────────────────────────────
console.log('\n[L2] 크기대별 최소 줄높이 비율');
{
  const cases: [number, number][] = [[12, 1.5], [15, 1.5], [18, 1.5], [19, 1.38], [22, 1.38], [24, 1.25], [30, 1.25]];
  let off = 0;
  for (const [size, want] of cases) {
    const got = lineHeightRatio(size);
    if (got !== want) { bad(`${size}px → 비율 ${got}(기대 ${want})`); off++; }
  }
  if (!off) ok(`${cases.length}개 구간 정합(본문 1.5 · 중간 1.38 · 제목 1.25)`);
  // 본문 크기에서 실제 픽셀 확인 — 사람이 체감하는 값
  const b = resolveLineHeight(15, undefined, undefined);
  if (b === 23) ok('본문 15px → 줄높이 23px(기본 ~18px 대비 +5)');
  else bad(`본문 15px 줄높이가 ${b} — 23 이어야 한다`);
}

// ── L3 한 줄 예외 ────────────────────────────────────────────────────────
console.log('\n[L3] numberOfLines===1 은 건드리지 않는다');
{
  if (resolveLineHeight(14, undefined, 1) === null) ok('한 줄 텍스트 보정 안 함(배지·칩 높이 보존)');
  else bad('한 줄 텍스트까지 보정한다 — 줄간격 이득 없이 높이만 늘어 정렬이 틀어진다');
  if (resolveLineHeight(14, undefined, 2) !== null) ok('두 줄 이상은 보정');
  else bad('여러 줄 텍스트를 보정하지 않는다 — 이 하네스의 목적 자체가 무의미해진다');
}

// ── L4 의도 존중 ─────────────────────────────────────────────────────────
console.log('\n[L4] 이미 넉넉한 줄높이는 덮어쓰지 않는다');
{
  if (resolveLineHeight(15, 24, undefined) === null) ok('15px/24 → 그대로(디자인 의도 보존)');
  else bad('넉넉한 lineHeight 를 덮어쓴다 — 디자이너가 정한 값이 무시된다');
  if (resolveLineHeight(15, 23, undefined) === null) ok('바닥값과 같으면 그대로');
  else bad('바닥값과 같은데도 다시 덮어쓴다');
}

// ── L5 짝 어긋남 교정 ────────────────────────────────────────────────────
console.log('\n[L5] fontSize 만 커지고 lineHeight 가 고정인 경우를 올린다');
{
  // 실제 사고: energyDesc — fontSize fs(12.5)≈18, lineHeight 17 고정 → 글자가 잘렸다
  const got = resolveLineHeight(18, 17, 2);
  if (got === 27) ok('18px/17(고정) → 27 로 교정(오늘의 기운 잘림 유형)');
  else bad(`18px/17 → ${got}(27 이어야) — 짝 어긋남을 교정하지 못한다`);
  if (TOO_TIGHT_RATIO > 1 && TOO_TIGHT_RATIO < 1.3) ok(`과밀 기준 비율 ${TOO_TIGHT_RATIO}`);
  else bad(`과밀 기준 비율이 이상하다: ${TOO_TIGHT_RATIO}`);
}

// ── L6 상한(성김 방지) ───────────────────────────────────────────────────
// daniel 2026-07-30 IMG_8311 "글자 제일 큰 상태인데 ai코치나 일반 풀이에서 행간 좀 줄여주고"
console.log('\n[L6] 큰 배율에서 줄간격이 과하게 벌어지지 않는다(상한)');
{
  // 실제 사고: 코치 답변 = fontSize 15 · lineHeight 25(1.67배). 최대 배율(1.45)에서 22px/36 이 된다.
  const got = resolveLineHeight(22, 36, undefined);
  const want = Math.round(22 * lineHeightMaxRatio(22)); // 33
  if (got === want) ok(`22px/36 → ${want} 로 조임(1.64배 → ${(want / 22).toFixed(2)}배)`);
  else bad(`22px/36 → ${got}(기대 ${want}) — 큰 글자에서 문단이 성기게 흩어진다`);
  // 상한이 하한보다 커야 한다(구간이 뒤집히면 매 렌더 값이 튄다)
  let inv = 0;
  for (const s of [12, 15, 18, 19, 22, 24, 30, 36]) if (lineHeightMaxRatio(s) <= lineHeightRatio(s)) { bad(`${s}px: 상한 ${lineHeightMaxRatio(s)} <= 하한 ${lineHeightRatio(s)}`); inv++; }
  if (!inv) ok('모든 구간에서 상한 > 하한');
}

// ── L7 이중적용 금지(lineHeight 에 ls()) ─────────────────────────────────
// ★★이 프로젝트에서 **세 번** 반복된 사고다: ls() 는 배율을 곱하는 함수인데,
//   전역 패치도 lineHeight 에 배율을 곱한다 → 1.45² ≈ 2.1배. 코드는 멀쩡해 보이고 타입도 통과한다.
//   그래서 '눈'이 아니라 하네스로 잡는다(07-26 교훈).
console.log('\n[L7] lineHeight 에 ls() 를 쓰지 않는다(전역 패치와 이중적용)');
{
  const files: string[] = [];
  const { readdirSync, statSync } = await import('node:fs');
  (function walk(d: string) {
    for (const e of readdirSync(d)) {
      const p = `${d}/${e}`;
      if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e)) files.push(p);
    }
  })(`${ROOT}app/src`);
  const hits: string[] = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    src.split('\n').forEach((ln, i) => {
      // lineHeight 값 안에서 ls( 가 나오면 이중적용. (width/height 등 **치수**에는 ls() 가 맞다.)
      if (/lineHeight:\s*[^,}]*\bls\(/.test(ln)) hits.push(`${f.replace(ROOT, '')}:${i + 1}`);
    });
  }
  if (!hits.length) ok(`${files.length}개 파일에 이중적용 0건`);
  else { bad(`lineHeight 에 ls() ${hits.length}건 — 배율이 두 번 곱해진다(1.45² ≈ 2.1배)`); hits.slice(0, 10).forEach((h) => console.error(`      ${h}`)); }
}

console.log(fail ? `\n❌ check:lineheight 실패 ${fail}건` : '\n✅ check:lineheight 통과 — 설치·비율·한줄예외·의도존중·짝교정·상한·이중적용금지 OK');
process.exit(fail ? 1 : 0);
