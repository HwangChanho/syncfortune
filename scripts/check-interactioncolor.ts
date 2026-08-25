#!/usr/bin/env tsx
/**
 * check:interactioncolor — 「글자 작용」 6종의 색이 **서로 갈리고 읽히는지** 지킨다.
 * ═══════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-25 *"궁합 풀이에서 글자 작용을 각각 다른 색으로 보이게 하고싶어"*.
 *
 * 종전엔 6종에 색이 **셋**뿐이었고(합 / 충·극 / 나머지), 그 «나머지» 는 라벤더 시절
 * 잔재(`#9A8CC0`)였다. 강조 테두리는 작용과 **무관하게** 청록 고정(`#19E3E3`)이었다.
 *
 * 규칙
 *   I1 여섯 색이 **모두 다르고**, 서로 RGB 거리 **77 이상**(종전 최악은 49 — 사실상 같은 색)
 *   I2 흰 카드 위 대비 **4.5 이상**(본문 기준)
 *   I3 **오행색과 55 이상** — 같은 행에 오행색 글자가 함께 있어 헷갈린다
 *   I4 색을 쓰는 화면이 **단일 원본**을 읽는다(궁합·만세력에 배색을 따로 박지 않는다)
 *   I5 강조 테두리를 오행 배경에 **바로 대지 않는다**(흰 고리를 낀다) — 대비 1.06~1.10 이라 안 보인다
 *
 * 사용: npm run check:interactioncolor · 자가테스트: --selftest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_SRC = 'app/src/lib/content/interactionColor.ts';
const SCREENS = ['app/src/screens/CompatScreen.tsx', 'app/src/screens/MyeongsikScreen.tsx'];
const MIN_APART = 77, MIN_CONTRAST = 4.5, MIN_ELEM = 55;

type Fail = { rule: string; msg: string };
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const hex = (h: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const lum = (c: number[]) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * @param src     `interactionColor.ts` 원문
 * @param screens 색을 쓰는 화면들의 원문
 * @param elem    오행색 다섯(`elementColor`)
 */
export function audit(src: string, screens: Record<string, string>, elem: string[]): Fail[] {
  const out: Fail[] = [];
  const table = code(src);
  const got: Record<string, string> = {};
  for (const m of table.matchAll(/(합|충|형|해|파|극):\s*'(#[0-9A-Fa-f]{6})'/g)) got[m[1]] = m[2];
  const keys = ['합', '충', '형', '해', '파', '극'];
  const missing = keys.filter((k) => !got[k]);
  if (missing.length) { out.push({ rule: 'I1', msg: `${P_SRC} 에 색이 없다: ${missing.join(' ')}` }); return out; }

  // ── I1 서로 갈리는가 ──────────────────────────────────────
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const d = dist(hex(got[keys[i]]), hex(got[keys[j]]));
    if (d < MIN_APART) out.push({ rule: 'I1', msg: `${keys[i]}(${got[keys[i]]}) ↔ ${keys[j]}(${got[keys[j]]}) 거리 ${d.toFixed(0)} < ${MIN_APART} — 화면에서 같은 색으로 읽힌다` });
  }
  // ── I2 흰 카드 위 읽히는가 ────────────────────────────────
  for (const k of keys) {
    const c = contrast(hex(got[k]), [255, 255, 255]);
    if (c < MIN_CONTRAST) out.push({ rule: 'I2', msg: `${k}(${got[k]}) 흰 카드 대비 ${c.toFixed(2)} < ${MIN_CONTRAST} — 글자가 안 읽힌다` });
  }
  // ── I3 오행색과 안 헷갈리는가 ─────────────────────────────
  for (const k of keys) {
    const d = Math.min(...elem.map((e) => dist(hex(got[k]), hex(e))));
    if (d < MIN_ELEM) out.push({ rule: 'I3', msg: `${k}(${got[k]}) 이 오행색과 ${d.toFixed(0)} 밖에 안 떨어졌다 — 같은 행에 오행색 글자가 있어 «木이라 초록인가, 합이라 초록인가» 가 섞인다` });
  }
  // ── I4 화면이 단일 원본을 읽는가 ──────────────────────────
  for (const [path, raw] of Object.entries(screens)) {
    const sc = code(raw);
    if (!/interactionColor\s*\(/.test(sc)) out.push({ rule: 'I4', msg: `${path} 가 interactionColor() 를 안 쓴다 — 배색이 화면마다 갈린다` });
    if (/'합'\s*\?\s*colors\.\w+\s*:/.test(sc)) out.push({ rule: 'I4', msg: `${path} 에 3색 배색이 아직 박혀 있다(합 ? … : …) — 단일 원본으로 옮겨라` });
    if (/#9A8CC0|#19E3E3/.test(sc)) out.push({ rule: 'I4', msg: `${path} 에 라벤더/시안 잔재 색이 남아 있다` });
  }
  // ── I5 강조 테두리에 흰 고리가 있는가 ─────────────────────
  const compat = code(screens['app/src/screens/CompatScreen.tsx'] ?? '');
  if (compat && !/cmRing\b/.test(compat)) {
    out.push({ rule: 'I5', msg: `CompatScreen 에 강조 고리(cmRing)가 없다 — 색 테두리를 오행 배경에 바로 대면 대비 1.06~1.10 이라 **안 보인다**` });
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const ELEM = ['#3E8E5A', '#C0392B', '#C9A14A', '#D2CCBA', '#3A4E7A'];
  const okSrc = `합: '#198033', 충: '#8F1919', 형: '#8B6A3C', 해: '#951D71', 파: '#1A7793', 극: '#4822C3',`;
  const okScreens = {
    'app/src/screens/CompatScreen.tsx': `const c = interactionColor(ty); cmRing: { borderWidth: 2 },`,
    'app/src/screens/MyeongsikScreen.tsx': `const c = interactionColor(ty);`,
  };
  const cases: Array<[string, Fail[]]> = [
    ['정상', audit(okSrc, okScreens, ELEM)],
    ['I1 두 색이 너무 가까움', audit(okSrc.replace("파: '#1A7793'", "파: '#1C8036'"), okScreens, ELEM)],
    ['I1 색이 빠짐', audit(okSrc.replace("극: '#4822C3',", ''), okScreens, ELEM)],
    ['I2 흰 위에서 안 읽힘', audit(okSrc.replace("형: '#8B6A3C'", "형: '#E8D9B0'"), okScreens, ELEM)],
    ['I3 오행색과 겹침', audit(okSrc.replace("충: '#8F1919'", "충: '#C0392B'"), okScreens, ELEM)],
    ['I4 화면이 단일원본 안 씀', audit(okSrc, { ...okScreens, 'app/src/screens/MyeongsikScreen.tsx': `const c = '#9A8CC0';` }, ELEM)],
    ['I4 3색 배색 잔존', audit(okSrc, { ...okScreens, 'app/src/screens/MyeongsikScreen.tsx': `interactionColor(x); const t = ty === '합' ? colors.ju : '#000';` }, ELEM)],
    ['I5 고리 없음', audit(okSrc, { ...okScreens, 'app/src/screens/CompatScreen.tsx': `const c = interactionColor(ty);` }, ELEM)],
    ['주석에 적힌 옛 색은 무시', audit(okSrc, { ...okScreens, 'app/src/screens/MyeongsikScreen.tsx': `// 종전엔 #9A8CC0 였다\nconst c = interactionColor(ty);` }, ELEM)],
  ];
  let bad = 0;
  for (const [name, fails] of cases) {
    const shouldPass = name === '정상' || name.includes('무시');
    const passed = fails.length === 0;
    if (passed !== shouldPass) { console.error(`❌ 자가테스트 실패: ${name} → ${passed ? '통과' : fails.map((f) => f.rule).join(',')}`); bad++; }
    else console.log(`  ✓ ${name} → ${passed ? '통과' : [...new Set(fails.map((f) => f.rule))].join(',')}`);
  }
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:interactioncolor 자가테스트 통과 (9케이스)');
  process.exit(bad ? 1 : 0);
}

// ── 실행 ───────────────────────────────────────────────────
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const oh = read('app/src/lib/engine/ohaeng.ts');
const elem = [...(oh.match(/elementColor[^=]*=\s*\{([\s\S]*?)\}/)?.[1] ?? '').matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);
const screens: Record<string, string> = {};
for (const p of SCREENS) screens[p] = read(p);
const fails = audit(read(P_SRC), screens, elem);
if (fails.length) {
  console.error(`❌ check:interactioncolor — ${fails.length}건`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:interactioncolor — 작용 6색이 서로 갈리고 읽힙니다(오행색 ${elem.length}개 대조)`);
