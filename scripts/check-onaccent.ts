#!/usr/bin/env tsx
/**
 * check:onaccent — **강조색(`colors.ju`) 위에 올라가는 글자**가 읽히는가.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (2026-08-19 실측)
 *   선택된 칩들이 `backgroundColor: colors.ju` + `color: '#15132E'` 였다.
 *   `#15132E` 는 **옛 미드나잇 네이비 테마**의 글자색이다 — 그때는 강조색이 밝은 골드라 맞았다.
 *   팔레트가 시안 파스텔 5색으로 바뀌면서 `ju` 가 **깊은 색**이 됐고, 대비가
 *     水 2.86 · 木 2.48 · 火 2.82 · 土 2.71 · 金 2.23 (기준 4.5)
 *   로 떨어졌다 — **선택된 칩의 글자가 거의 안 보였다.** `onJu`(흰색)면 6.3~8.1 로 전부 통과한다.
 *
 *   ⚠️이건 팔레트를 바꿀 때마다 **다시 생길 수 있는 종류**다.
 *     색을 바꾼 사람은 칩을 안 보고, 칩을 만든 사람은 색이 바뀐 줄 모른다.
 *     ★그리고 화면에서는 "좀 흐리네" 정도로 보여 그냥 지나친다 — 계산이라야 잡힌다.
 *
 * 규칙 — **이름이 아니라 대비로** 판정한다
 *   A1 `backgroundColor: colors.ju` 인 스타일과 짝이 되는 글자색이, 다섯 오행 **전부**에서 대비 ≥ 4.5
 *      · 팔레트 토큰(`colors.onJu`·`colors.bg`…)이면 그 토큰 값을 오행별로 읽어 계산한다
 *      · 하드코딩 hex 면 그 값으로 계산한다
 *   A2 팔레트에 없는 토큰이면 판단 불가 — 그때만 '모르겠다'로 실패시킨다
 *
 * ⚠️★처음엔 A1 을 "반드시 `colors.onJu` 여야 한다"로 썼다가 **23건이 걸렸다**.
 *   재 보니 `colors.bg` 도 4.68~6.64 로 전부 통과였다 — 규칙이 **옳은 코드를 막고 있었다**
 *   ([[harness-can-enforce-wrong-rule]]). 이름을 강제하지 말고 **값을 계산**한다.
 *
 * 한계(정직하게)
 *   · 이름 규칙(`…On` ↔ `…TxOn`)에 기댄다. 다른 이름을 쓰면 못 잡는다.
 *   · ⚠️`colors.ju + '22'` 처럼 **알파를 덧붙인 배경**은 그 알파를 계산에 넣는다(카드 위 합성).
 *     처음엔 알파를 못 읽어 `CompatScreen` 을 "대비 1.00"으로 잘못 잡았다 — 실제로는 옅은 면이다.
 *
 * 사용: npm run check:onaccent · 자가테스트: npx tsx scripts/check-onaccent.ts --selftest
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'app/src');
const MIN = 4.5;

type Fail = { rule: string; msg: string };
type RGB = [number, number, number];

const hex = (h: string): RGB => {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const lum = (c: RGB) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: RGB, b: RGB) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** 오행 → 그 오행의 팔레트 전체(토큰명 → hex). 토큰 이름으로 값을 찾을 수 있게 한다. */
export type Palette = Array<[string, Record<string, string>]>;
export function palettes(palSrc: string): Palette {
  const out: Palette = [];
  // ★★2026-08-22: 화면 팔레트가 **`LAVENDER` 하나**로 통일됐다(Boss: 콘티대로 라벤더 한 색).
  //   ⚠️여기를 안 고쳤으면 하네스는 **이제 안 쓰는 오행 팔레트만** 검사하고,
  //     정작 화면에 뜨는 라벤더는 아무도 안 보게 된다 — 초록불이 거짓이 되는 그 상황이다
  //     ([[harness-can-enforce-wrong-rule]] 의 뒷면).
  //   ★오행 세트도 계속 검사한다: 되돌릴 수 있게 남겨 둔 값이라, 썩으면 되돌릴 때 터진다.
  for (const el of ['LAVENDER', '水', '木', '火', '土', '金']) {
    // `LAVENDER` 는 `export const LAVENDER: ElementPalette = { … };` 형태라 닫는 모양이 다르다
    const re = el === 'LAVENDER'
      ? /export const LAVENDER: ElementPalette = \{([\s\S]*?)\n\};/
      : new RegExp(`${el}:\\s*\\{([\\s\\S]*?)\\n  \\},`);
    const blk = palSrc.match(re)?.[1] ?? '';
    const tokens: Record<string, string> = {};
    for (const m of blk.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) tokens[m[1]] = m[2];
    if (tokens.ju) out.push([el, tokens]);
  }
  return out;
}

/**
 * 한 파일에서 '강조색 위 글자'를 검사한다.
 *
 * @param src  파일 원문
 * @param file 표시용 경로
 * @param pal  오행별 ju 색
 * @returns 위반 목록
 */
export function audit(src: string, file: string, pal: Palette): Fail[] {
  const out: Fail[] = [];
  // `xxxOn: { … backgroundColor: colors.ju … }` 인 스타일 이름을 모은다
  // 이름 → 배경 알파(없으면 1 = 불투명). `colors.ju + '22'` 는 카드 위에 13%만 얹은 옅은 면이다.
  const accentStyles = new Map<string, number>();
  // ⚠️`colors\.ju\b` 라고 써도 **`colors.juSoft` 가 걸린다** — `\b` 는 `.` 뒤 단어 경계라
  //   `ju` 다음에 `S` 가 와도 경계로 안 본다(둘 다 단어 문자). `(?![A-Za-z])` 로 막아야 한다.
  //   ★이걸 놓쳐 `juSoft`(밝은 면) 칩 넷을 '대비 1.00'으로 잘못 잡았다(2026-08-19).
  for (const m of src.matchAll(/^\s*(\w+):\s*\{[^\n]*backgroundColor:\s*colors\.ju(?![A-Za-z])\s*(\+\s*'([0-9A-Fa-f]{2})')?[^\n]*$/gm)) {
    accentStyles.set(m[1], m[3] ? parseInt(m[3], 16) / 255 : 1);
  }
  if (!accentStyles.size) return out;

  for (const [name, alpha] of accentStyles) {
    // 짝 = 같은 접두 + Tx (예: catChipOn ↔ catTxOn / dayTogChipOn ↔ dayTogTxOn)
    const stem = name.replace(/(Chip)?On$/, '');
    const pair = [...src.matchAll(/^\s*(\w+):\s*\{([^\n]*)$/gm)]
      .filter(([, n]) => n.startsWith(stem) && /Tx.*On$|TxOn$/.test(n));
    for (const [, n, bodyRaw] of pair) {
      const colorM = bodyRaw.match(/color:\s*('#[0-9A-Fa-f]{6}'|colors\.\w+)/);
      if (!colorM) continue;
      const val = colorM[1];
      // 오행마다 실제 색을 구해 대비를 잰다 — 토큰이든 hex 든 **값으로** 본다
      const bad: string[] = [];
      let unknown = false;
      for (const [el, tokens] of pal) {
        // 알파가 있으면 **카드 면 위에 합성**한 실제 색으로 잰다
        const base = tokens.card ? hex(tokens.card) : ([255, 255, 255] as RGB);
        const juRaw = hex(tokens.ju);
        const ju: RGB = alpha >= 1 ? juRaw : (base.map((v, i) => Math.round(v * (1 - alpha) + juRaw[i] * alpha)) as RGB);
        let txt: RGB | null = null;
        if (val.startsWith("'#")) txt = hex(val.replace(/'/g, ''));
        else {
          const key = val.replace('colors.', '');
          if (key === 'white') txt = [255, 255, 255];
          else if (tokens[key]) txt = hex(tokens[key]);
          else { unknown = true; break; }
        }
        const v = contrast(txt, ju);
        if (v < MIN) bad.push(`${el} ${v.toFixed(2)}`);
      }
      if (unknown) {
        out.push({ rule: 'A2', msg: `${file}: \`${n}\` 의 \`${val}\` 은 오행 팔레트에 없는 토큰 — 대비를 계산할 수 없다(팔레트 토큰이나 hex 를 쓸 것)` });
      } else if (bad.length) {
        out.push({ rule: 'A1', msg: `${file}: \`${n}\`(${val}) 이 \`colors.ju\` 위에서 ${bad.join(' · ')} (기준 ${MIN}) — \`colors.onJu\` 를 쓸 것` });
      }
    }
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(f)) acc.push(p);
  }
  return acc;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const pal: Palette = [
    ['水', { ju: '#39609D', onJu: '#FFFFFF', bg: '#D3E6EF', ink: '#1B2E3F', card: '#F5FAFC' }],
    ['金', { ju: '#50504E', onJu: '#FFFFFF', bg: '#E8E9E9', ink: '#272927', card: '#FAFAFA' }],
  ];
  const bad = `
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  catTxOn: { color: '#15132E' },`;
  const good = `
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  catTxOn: { color: colors.onJu },`;
  const wrongToken = `
  catChipOn: { backgroundColor: colors.ju },
  catTxOn: { color: colors.ink },`;
  const noAccent = `
  catChip: { backgroundColor: colors.card },
  catTx: { color: '#15132E' },`;
  const brightHex = `
  catChipOn: { backgroundColor: colors.ju },
  catTxOn: { color: '#FFFFFF' },`;
  const cases: Array<[string, number]> = [
    ['하드코딩 어두운 글자(실제 버그 모양)', audit(bad, 'x', pal).length],
    ['colors.onJu(정상)', audit(good, 'x', pal).length],
    ['어두운 토큰(colors.ink) — 대비 미달', audit(wrongToken, 'x', pal).length],
    ['colors.bg — 대비가 나오므로 통과(오탐이면 안 된다)', audit(good.replace('colors.onJu', 'colors.bg'), 'x', pal).length],
    ['팔레트에 없는 토큰 — 판단 불가', audit(good.replace('colors.onJu', 'colors.mystery'), 'x', pal).length],
    ['강조 배경이 아님 — 볼 필요 없다', audit(noAccent, 'x', pal).length],
    ['흰 hex 는 대비가 나오므로 통과', audit(brightHex, 'x', pal).length],
    // ★알파 배경 — `ju + '22'` 는 옅은 면이라 그 위 `ju` 글자가 읽힌다(오탐이면 안 된다)
    ['알파 배경(ju+22) 위 ju 글자 — 통과', audit(`
  pickRowOn: { backgroundColor: colors.ju + '22', borderColor: colors.ju },
  pickRowTxOn: { color: colors.ju },`, 'x', pal).length],
    // ★`juSoft`(밝은 면)를 `ju` 로 잘못 읽지 않는가 — 실제로 넷을 오탐한 자리
    ['juSoft 배경은 강조 배경이 아니다', audit(`
  viewTogChipOn: { backgroundColor: colors.juSoft },
  viewTogTxOn: { color: colors.ju },`, 'x', pal).length],
  ];
  const want = [1, 0, 1, 0, 1, 0, 0, 0, 0];   // 판단 불가는 오행마다가 아니라 **한 번만** 보고한다
  let n = 0;
  cases.forEach(([name, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${name} → ${got}건 (기대 ${want[i]})`);
    if (!ok) n++;
  });
  console.log(n ? `\n❌ 자가테스트 ${n}건 실패` : '\n✅ check:onaccent 자가테스트 통과 (9케이스)');
  process.exit(n ? 1 : 0);
}

const pal = palettes(readFileSync(join(ROOT, 'app/src/lib/theme/elementPalette.ts'), 'utf8'));
if (!pal.length) { console.error('❌ 팔레트에서 ju 를 못 읽었다'); process.exit(1); }
const fails = walk(SRC).flatMap((p) => audit(readFileSync(p, 'utf8'), relative(ROOT, p), pal));
if (fails.length) {
  console.error(`❌ check:onaccent — ${fails.length}건 · 강조색 위 글자가 안 읽힌다`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:onaccent — 강조색 위 글자는 onJu (다섯 오행 전부 대비 확보)');
