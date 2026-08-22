/**
 * scripts/check-legacycolor.ts — **팔레트를 우회한 글자색**이 지금 화면에서 읽히는가
 * ─────────────────────────────────────────────────────────────────────────
 * 2026-08-22 라벤더 전환 뒤 훑다가 나왔다.
 *   · `NewyearTeaser` 삼재 금색 `#D9A441` → 흰 카드 위 **대비 2.25** (안 읽힘)
 *   · `coststable` 경고 금색 `#E5A93F` → **2.08**
 *   둘 다 **미드나잇(어두운) 테마 시절 값**이 라이트 전환 뒤에도 남아 있던 것이다.
 *
 * ■ ★왜 되풀이되나
 *   팔레트를 바꾼 사람은 하드코딩된 색을 모르고, 하드코딩한 사람은 팔레트가 바뀐 줄 모른다.
 *   그리고 화면에서는 "좀 연하네" 정도로 보여 그냥 지나간다 — **계산이라야 잡힌다.**
 *
 * ■ 판정 — 오탐을 줄이려고 좁게 본다
 *   `color: '#XXXXXX'` 중에서
 *     ① 같은 줄에 배경색이 없고 (있으면 그 위에 얹힌 글자다)
 *     ② **밝은 색이 아니고**(밝은 색은 대개 어두운 이미지·배지 위에 쓴다 — 배경을 코드로 못 좇는다)
 *     ③ 카드(#FFFFFF)·배경 둘 다에서 대비 **3.0 미만**
 *   ⇒ 이 셋을 다 만족하면 사고로 본다.
 *   ⚠️②를 넣지 않으면 흰 글자 대여섯 개가 매번 잡혀 하네스가 무시당한다(첫 판에서 겪었다).
 *
 * 실행: npm run check:legacycolor   (자가테스트: --selftest)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app/src'];
const SKIP = ['lib/theme'];
const CARD = '#FFFFFF';
const BG = '#F7F5FD';
const MIN = 3.0;
/** 이보다 밝으면 '어두운 면 위에 쓰는 색'으로 보고 건너뛴다(상대휘도). */
const LIGHT_L = 0.5;

function lum(hex: string): number {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = v.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function walk(dir: string, out: string[] = []): string[] {
  let es: string[]; try { es = readdirSync(dir); } catch { return out; }
  for (const e of es) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** 한 파일에서 사고 후보를 찾는다. 하네스 본체와 자가테스트가 **같은 함수**를 쓴다. */
export function scanSrc(src: string, file: string): string[] {
  const out: string[] = [];
  src.split('\n').forEach((line, i) => {
    const m = /\bcolor:\s*'(#[0-9A-Fa-f]{6})'/.exec(line);
    if (!m) return;
    if (/backgroundColor:\s*'#/.test(line)) return;      // ① 같은 줄 배경 = 그 위 글자
    const c = m[1];
    if (lum(c) > LIGHT_L) return;                         // ② 밝은 색은 어두운 면용
    const a = contrast(c, CARD), b = contrast(c, BG);
    if (Math.min(a, b) >= MIN) return;                    // ③
    out.push(`${file}:${i + 1}  ${c} — 카드 ${a.toFixed(2)} · 배경 ${b.toFixed(2)} (기준 ${MIN})`);
  });
  return out;
}

if (process.argv.includes('--selftest')) {
  console.log('🧪 check:legacycolor 자가테스트');
  const bad = scanSrc(`  t: { color: '#D9A441' },`, 'x');
  const okDark = scanSrc(`  t: { color: '#2C2743' },`, 'x');
  const okOnBg = scanSrc(`  t: { backgroundColor: '#3a1a1a', color: '#ff9a9a' },`, 'x');
  const okLight = scanSrc(`  t: { color: '#FFFFFF' },`, 'x');
  const c1 = bad.length === 1, c2 = okDark.length === 0, c3 = okOnBg.length === 0, c4 = okLight.length === 0;
  console.log(`  ${c1 ? '✅' : '❌'} 흰 카드 위 금색(#D9A441 · 2.25) 잡음`);
  console.log(`  ${c2 ? '✅' : '❌'} 본문 먹색(#2C2743)은 통과`);
  console.log(`  ${c3 ? '✅' : '❌'} 같은 줄에 배경이 있으면 건너뜀(그 위 글자다)`);
  console.log(`  ${c4 ? '✅' : '❌'} 흰 글자는 건너뜀(어두운 면용 — 오탐 방지)`);
  process.exit(c1 && c2 && c3 && c4 ? 0 : 1);
}

const files = ROOTS.flatMap((r) => walk(r)).filter((f) => !SKIP.some((s) => f.includes(s)));
const bad = files.flatMap((f) => scanSrc(readFileSync(f, 'utf8'), f));
console.log('\n🎨 check:legacycolor — 팔레트를 우회한 글자색이 읽히는가\n');
if (bad.length) {
  for (const b of bad) console.log(`   ❌ ${b}`);
  console.log('\n  → 더 어두운 값으로 **계산해서** 바꾸거나, 팔레트 토큰(`colors.*`)을 쓰세요.');
  console.log(`\n❌ check:legacycolor 실패 — ${bad.length}건`);
  process.exit(1);
}
console.log('   ✅ 하드코딩 글자색이 전부 지금 면 위에서 읽힙니다');
