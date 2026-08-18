// scripts/check-elementtheme.ts — 오행 전면 팔레트: **다섯 벌이 다 읽혀야 한다**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (daniel 2026-08-18 · 시안 `니운내운.pdf` 전면 개편)
//   화면 전체가 대표명식 오행 색으로 물든다. 즉 **한 사람에게는 한 벌만 보인다** —
//   내가 개발하며 보는 건 내 오행 한 벌뿐이고, 나머지 네 벌은 **아무도 안 보고 배포된다.**
//   ⇒ 색을 눈으로 고르고 "괜찮아 보인다"로 끝내면 다른 오행 사용자가 안 읽히는 화면을 본다.
//   ⇒ 그래서 **대비를 계산해서** 다섯 벌 전부를 검사한다.
//   실제로 이 검사가 잡았다: 水 의 캡션색이 2.90 으로 기준(3.0) 미달이었다 — 눈으론 다 비슷해 보였다.
//
// 무엇을 지키나
//   E1. 다섯 오행이 **전부** 정의돼 있고 키가 빠지지 않았는가
//   E2. 각 벌의 명암 대비가 기준을 넘는가(본문 4.5 · 캡션/강조 3.0) — **실행해서 계산**
//   E3. 색이 hex 형식인가(오타·빈 값이 그대로 배포되지 않게)
//   E4. 오행 색의 단일 출처가 유지되는가 — `theme.ts` 가 옛 `EL_BG`/`ElTheme` 를 되살리지 않았는가
//
// ★음성 테스트: `npx tsx scripts/check-elementtheme.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import { ELEMENT_PALETTE, THEME_ELEMENTS, DEFAULT_ELEMENT, contrast, type ElementPalette } from '../app/src/lib/theme/elementPalette';

const THEME = 'app/src/lib/theme.ts';

/** 검사할 색 짝과 최소 대비. 본문 4.5 · 보조/강조 3.0(WCAG 기준). */
const PAIRS: Array<[keyof ElementPalette, keyof ElementPalette, number, string]> = [
  ['ink', 'card', 4.5, '본문 글자 ↔ 카드'],
  ['ink', 'bg', 4.5, '본문 글자 ↔ 배경'],
  ['inkSoft', 'card', 4.5, '보조 글자 ↔ 카드'],
  ['inkFaint', 'card', 3.0, '캡션 ↔ 카드'],
  ['ju', 'card', 3.0, '강조 ↔ 카드'],
  ['ju', 'bg', 3.0, '강조 ↔ 배경'],
  ['onJu', 'ju', 4.5, '버튼 글자 ↔ 버튼'],
];

const KEYS: (keyof ElementPalette)[] = ['bg', 'card', 'sunk', 'line', 'ink', 'inkSoft', 'inkFaint', 'ju', 'juDeep', 'juSoft', 'juLine', 'onJu'];

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** `#RRGGBB` 형식인가. */
export function isHex(v: unknown): boolean {
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
}

// ── E1/E3. 구성과 형식 ──────────────────────────────────────────────────────
if (THEME_ELEMENTS.length !== 5) fail('E1', `오행이 ${THEME_ELEMENTS.length}개다 — 다섯이어야 한다`);
if (!THEME_ELEMENTS.includes(DEFAULT_ELEMENT)) fail('E1', `기본 오행(${DEFAULT_ELEMENT})이 목록에 없다`);
for (const el of THEME_ELEMENTS) {
  const p = ELEMENT_PALETTE[el];
  if (!p) { fail('E1', `${el} 팔레트가 없다`); continue; }
  for (const k of KEYS) {
    if (!(k in p)) fail('E1', `${el}.${k} 가 빠졌다 — 화면 어딘가가 undefined 색을 쓴다`);
    else if (!isHex(p[k])) fail('E3', `${el}.${k} = "${p[k]}" — #RRGGBB 형식이 아니다`);
  }
}

// ── E2. 대비(실행 계산) ─────────────────────────────────────────────────────
for (const el of THEME_ELEMENTS) {
  const p = ELEMENT_PALETTE[el];
  if (!p) continue;
  for (const [a, b, min, label] of PAIRS) {
    if (!isHex(p[a]) || !isHex(p[b])) continue;   // E3 가 이미 잡았다
    const c = contrast(p[a], p[b]);
    if (c < min) {
      fail('E2', `${el} — ${label}: 대비 ${c.toFixed(2)} < ${min}\n        이 오행 사용자에게는 글이 흐리게 보인다(개발자는 자기 오행 한 벌만 본다)`);
    }
  }
}

// ── E4. 단일 출처 ───────────────────────────────────────────────────────────
if (!fs.existsSync(THEME)) fail('E4', `${THEME} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`);
else {
  const src = fs.readFileSync(THEME, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  if (!/ELEMENT_PALETTE/.test(code)) {
    fail('E4', `${THEME} — 오행 팔레트를 쓰지 않는다. 색이 다시 theme.ts 안에 흩어졌을 수 있다`);
  }
  if (/const\s+EL_BG\s*[:=]/.test(code) || /type\s+ElTheme\s*=/.test(code)) {
    fail('E4', `${THEME} — 옛 \`EL_BG\`/\`ElTheme\` 가 되살아났다. 오행 색은 elementPalette.ts 한 곳에서만 정의한다\n        (같은 것을 두 곳이 정의하면 어느 쪽이 진짜인지 알 수 없다)`);
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'E2: 대비 계산이 맞다(흑백=21)', run: () => Math.round(contrast('#000000', '#FFFFFF')) === 21 },
    { name: 'E2: 같은 색은 1', run: () => Math.round(contrast('#123456', '#123456')) === 1 },
    { name: 'E2: 흐린 회색 조합을 문다', run: () => contrast('#AAAAAA', '#FFFFFF') < 3 },
    { name: 'E3: hex 판정 — 정상', run: () => isHex('#A1B2C3') },
    { name: 'E3: hex 판정 — 3자리는 거부', run: () => !isHex('#ABC') },
    { name: 'E3: hex 판정 — rgba 는 거부', run: () => !isHex('rgba(1,2,3,0.5)') },
    { name: 'E1: 다섯 오행이 다 있다', run: () => THEME_ELEMENTS.length === 5 && THEME_ELEMENTS.every((e) => !!ELEMENT_PALETTE[e]) },
    { name: 'E1: 키 누락을 문다', run: () => !('bg' in ({ card: '#fff' } as any)) },
    { name: 'E4: 옛 EL_BG 부활을 문다', run: () => /const\s+EL_BG\s*[:=]/.test("const EL_BG: Record<string,string> = {};") },
    { name: 'E4: 주석 속 EL_BG 는 안 문다', run: () => !/const\s+EL_BG\s*[:=]/.test("// const EL_BG = {} 였다".replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')) },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:elementtheme — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
// 가장 아슬아슬한 짝을 함께 알려 준다 — 색을 조정할 때 어디가 한계인지 보이게.
let worst = { el: '', label: '', v: 99 };
for (const el of THEME_ELEMENTS) {
  const p = ELEMENT_PALETTE[el];
  for (const [a, b, , label] of PAIRS) {
    const c = contrast(p[a], p[b]);
    if (c < worst.v) worst = { el, label, v: c };
  }
}
console.log(`✅ check:elementtheme — 오행 5벌 · 키 ${KEYS.length}개 · 대비 전부 통과 (최저 ${worst.el} ${worst.label} ${worst.v.toFixed(2)})`);
