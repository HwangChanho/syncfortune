// scripts/check-fontscale.ts — 글자 배율 단일 출처 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29: "글씨크기가 ui랑 전부다 반영돼야해"
//                    "전체 다 자동반영되게 코드구조를 미리 모듈화시키고 연동해둬야지"
//
// ★구조: 배율은 **전역 Text.render 패치 한 곳에서만** 곱한다.
//   · fontScale.getFontScale()  = 단일 출처(훅 밖에서 읽는 모듈 변수)
//   · installMinLineHeight()    = 그 배율을 모든 텍스트의 fontSize·lineHeight 에 적용
//   · useFontScale().fs()       = **항등 함수**(의도 표시용으로만 남김)
//
// ★이 하네스가 막는 사고:
//   ①fs() 가 다시 배율을 곱하면 **이중 적용**(1.3 × 1.3 = 1.69배) → 글자가 터진다.
//   ②패치가 lineHeight 를 같이 안 키우면 큰 글자가 **위아래로 잘린다**(이 프로젝트 재발 사고).
//   ③Provider 가 모듈 변수를 갱신 안 하면 설정을 바꿔도 **첫 렌더가 옛 배율**로 나온다.
//   셋 다 조용히 잘못되는 종류라 눈으로 못 잡는다.
//
// 실행: npm run check:fontscale
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(`${ROOT}${p}`, 'utf8');
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const walkAll = (): string[] => {
  const out: string[] = [];
  const rec = (d: string) => {
    let ents: any[]; try { ents = require('node:fs').readdirSync(`${ROOT}${d}`, { withFileTypes: true }); } catch { return; }
    for (const e of ents) { const p = `${d}/${e.name}`; if (e.isDirectory()) rec(p); else if (/\.tsx?$/.test(e.name)) out.push(p); }
  };
  rec('app/src');
  return out;
};

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

console.log('\n🔎 글자 배율 단일 출처\n');

const fsMod = strip(read('app/src/lib/ui/fontScale.tsx'));
const patch = strip(read('app/src/lib/ui/textLineHeight.ts'));

// ── ① fs() 는 항등이어야 한다(이중 적용 방지) ───────────────────────────
if (/const fs = \(px: number\) => px;/.test(fsMod)) ok('① fs() 가 항등 함수(이중 적용 없음)');
else if (/const fs = .*px \* scale/.test(fsMod)) bad('① fs() 가 배율을 곱한다 — 전역 패치와 **이중 적용**된다(1.3×1.3=1.69배)');
else bad('① fs() 구현을 확인할 수 없다 — 하네스가 낡았거나 구조가 바뀌었다');

// ── ② 단일 출처 getter 와 Provider 동기화 ────────────────────────────────
if (/export function getFontScale\(\)/.test(fsMod)) ok('② getFontScale() 단일 출처 존재');
else bad('② getFontScale() 이 없다 — 전역 패치가 배율을 읽을 방법이 없다');
if (/currentScale = next/.test(fsMod) && /currentScale = s;/.test(fsMod)) ok('② Provider 가 로드·변경 시 모듈 변수도 갱신');
else bad('② Provider 가 currentScale 을 갱신하지 않는다 — 설정을 바꿔도 렌더에 반영 안 됨');
if (/key=\{scale\}/.test(fsMod)) ok('② 배율 변경 시 트리 리마운트(고정 fontSize 도 반영)');
else bad('② key={scale} 리마운트가 없다 — 고정 fontSize 컴포넌트는 Context 를 구독하지 않아 그대로 남는다');

// ── ③ 패치가 fontSize 와 lineHeight 를 함께 스케일하는가 ─────────────────
if (/getFontScale\(\)/.test(patch)) ok('③ 전역 패치가 배율을 읽는다');
else bad('③ 전역 패치가 배율을 안 읽는다 — 고정 fontSize 670곳이 설정을 무시한다');
if (/Math\.round\(size \* scale\)/.test(patch)) ok('③ fontSize 스케일 적용');
else bad('③ fontSize 를 스케일하지 않는다');
if (/Math\.round\(flat\.lineHeight \* scale\)/.test(patch)) ok('③ lineHeight 도 같은 비율로 스케일');
else bad('③ lineHeight 를 함께 안 키운다 — 큰 글자가 위아래로 잘린다(재발 사고)');
if (/resolveLineHeight\(scaled \?\? size/.test(patch)) ok('③ 줄간격 판정이 **스케일된 크기 기준**');
else bad('③ 줄간격을 원본 크기로 판정한다 — 키운 글자에 옛 줄높이가 걸린다');

// ── ④ 설치 지점 ─────────────────────────────────────────────────────────
{
  const roots = ['app/src/app/_layout.tsx', 'app/App.tsx', 'app/index.js'];
  const installed = roots.some((f) => { try { return /installMinLineHeight\(\)/.test(read(f)); } catch { return false; } });
  if (installed) ok('④ 앱 루트에서 전역 패치를 설치한다');
  else bad('④ installMinLineHeight() 호출을 앱 루트에서 찾지 못했다 — 패치가 안 걸리면 전부 무효');
}


// ── ⑤ ls() 오용 — 오늘 실제로 낸 회귀 3종 ─────────────────────────────────
{
  const walk = (d: string, out: string[] = []): string[] => {
    let ents: any[]; try { ents = require('node:fs').readdirSync(`${ROOT}${d}`, { withFileTypes: true }); } catch { return out; }
    for (const e of ents) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p, out); else if (/\.tsx?$/.test(e.name)) out.push(p); }
    return out;
  };
  const files = walk('app/src');

  // (a) ls(x) * scale = **이중 적용**(1.45×1.45=2.1배). ls 는 이미 배율을 곱한다.
  const dbl = files.filter((f) => /ls\([\d.]+\)\s*\*\s*scale/.test(strip(read(f) ?? '')));
  if (!dbl.length) ok('⑤ ls() 이중 적용 없음');
  else bad(`⑤ ls(x) * scale = 이중 적용: ${dbl.map((f) => f.split('/').pop()).join(', ')}`);

  // (b) StyleSheet.create 안의 ls( — 훅을 못 쓴다(런타임 ReferenceError)
  const inSheet = files.filter((f) => {
    // ⚠️주석을 먼저 걷어낸다 — 주석에 적은 예시(`살릴 거면 ls() 로`)에 걸려 헛실패한 적이 있다.
    const src = strip(read(f) ?? ''); const i = src.indexOf('StyleSheet.create(');
    return i >= 0 && /\bls\(/.test(src.slice(i));
  });
  if (!inSheet.length) ok('⑤ StyleSheet 안에 ls() 없음(훅 밖이라 못 쓴다)');
  else bad(`⑤ StyleSheet 안에서 ls() 사용: ${inSheet.map((f) => f.split('/').pop()).join(', ')}`);

  // (c) 치수를 fs() 로 계산 = 배율을 못 받아 **글자만 커지고 상자는 그대로**(daniel IMG_8299/8300)
  const dim = files.filter((f) => /(minWidth|width|height|borderRadius):\s*fs\(/.test(strip(read(f) ?? '')));
  if (!dim.length) ok('⑤ 치수를 fs() 로 계산하는 곳 없음');
  else bad(`⑤ 치수에 fs() 사용(안 커진다 — 글자가 넘친다): ${dim.map((f) => f.split('/').pop()).join(', ')}`);
}


// ── ⑥ 고정 치수 상자 + 배율 글자 = 넘침(daniel IMG_8302 "아직도 깨지잖아") ──
//   원인 유형: 상자는 `width/height: 15` 고정인데 글자는 전역 패치로 커진다 →
//   배율 1.45 에서 한자가 원 밖으로 삐져나온다. **글자를 담는 상자는 ls() 로 파생**시켜야 한다.
//   ⚠️전부를 실패로 만들지 않는다 — 아이콘·체크박스처럼 글자를 안 담는 상자가 대부분이고,
//     그것까지 건드리면 오히려 레이아웃이 깨진다. **한자/숫자를 담는 것**만 목록으로 남겨 눈으로 잡게 한다.
{
  const KNOWN_TEXT_BOX = ['pillarHiddenItem', 'gzBox', 'ptGz', 'cmCell', 'numBadge', 'monthBadge'];
  const offenders: string[] = [];
  for (const f of walkAll()) {
    const code = strip(read(f) ?? '');
    const i = code.indexOf('StyleSheet.create(');
    if (i < 0) continue;
    for (const m of code.slice(i).matchAll(/(\w+):\s*\{([^{}]*)\}/g)) {
      if (!KNOWN_TEXT_BOX.includes(m[1])) continue;
      const w = /\bwidth:\s*\d+/.test(m[2]), h = /\bheight:\s*\d+/.test(m[2]);
      if (w && h) offenders.push(`${f.split('/').pop()}::${m[1]}`);
    }
  }
  if (!offenders.length) ok('⑥ 글자 담는 상자가 전부 배율 파생(ls)');
  else bad(`⑥ 고정 치수 상자에 배율 글자 — 큰 글자에서 넘친다: ${offenders.join(', ')}`);
}

// ── ⑧ 시도했다가 **접은 규칙**(기록으로 남긴다 · 2026-08-03) ────────────────
//   목표: 고정 height 상자가 <Text> 를 품으면 큰 글자에서 잘리니 잡자
//         (실제 사고 = ElementBalance.barsRow height:116 · 이 커밋에서 고정 높이 제거로 해결).
//   결과: 정밀도를 못 맞춰 **접었다.** 근접 판정 113건 오탐 → 포함 판정으로 좁혀도 42건.
//         게이지 바(barTrack·gaugeTrack·track)는 고정 높이가 **의도**이고 안의 <Text> 는
//         라벨이라 세로로 안 쌓인다. 이걸 다 실패로 만들면 아무도 하네스를 안 본다.
//   ★교훈: 오탐이 많은 하네스는 없느니만 못하다(check:prose·error-harness 와 같은 결론).
//         다시 만든다면 '고정 height' 가 아니라 **자식이 세로로 쌓이는가**(flexDirection column +
//         Text 2개 이상)로 판정해야 한다 — 정적 분석으로는 아직 신뢰도가 안 나온다.


// ── ⑦ 폭 제약이 다른 두 용도가 같은 치수를 공유하는가(daniel IMG_8304) ────
//   GzCell 은 ①확장명식 표(화면 폭을 5~8칸이 나눠 씀)와 ②대운·세운 가로 스크롤 카드에서 같이 쓰인다.
//   ②를 넓히려고 폭을 키웠더니 ①에서 칸이 서로 붙어 화면을 넘었다 → **grid prop 으로 분리**해야 한다.
{
  const gz = strip(read('app/src/components/GzCell.tsx') ?? '');
  if (/grid\s*\?\s*fs\(/.test(gz)) ok('⑦ GzCell 이 grid(표) / 스크롤 카드 폭을 분리한다');
  else bad('⑦ GzCell 폭이 한 값이다 — 표를 넓히면 칸이 붙고, 카드를 좁히면 빠듯해진다');

  const ms = strip(read('app/src/screens/MyeongsikScreen.tsx') ?? '');
  const gridUses = (ms.match(/<GzCell[^>]*\bgrid\b/g) ?? []).length;
  const scaleUses = (ms.match(/<GzCell[^>]*scale=\{scale\}/g) ?? []).length;
  if (gridUses >= scaleUses && scaleUses > 0) ok(`⑦ 확장명식 GzCell ${scaleUses}곳 전부 grid 지정`);
  else bad(`⑦ 확장명식 GzCell 중 grid 누락(${scaleUses - gridUses}곳) — 그 칸이 화면 폭을 넘는다`);
}

console.log(fail ? `\n❌ check:fontscale 실패 ${fail}건` : '\n✅ check:fontscale 통과 — 배율이 한 곳에서만 적용된다');
process.exit(fail ? 1 : 0);
