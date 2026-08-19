#!/usr/bin/env tsx
/**
 * check:herotone — 상세 히어로가 **시안 톤**이고, 그 위 글자가 읽히는가.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (2026-08-19 daniel *"상세 화면들도 시안톤으로 다 바꿔"*)
 *   `ContentHero` 는 상세 19화면의 **길목**이다. 종전엔 어두운 사진 + 검은 스크림 + 흰 글자라
 *   앱이 파스텔로 바뀐 뒤 이 히어로만 홀로 어두웠다.
 *   시안 p10·p11 처럼 **밝은 색면 + 아치 + 강조색 제목**으로 바꿨는데, 여기엔 함정이 있다 —
 *   밝은 배경 위에 사진을 겹치면 **사진이 어두울수록 제목이 묻힌다.**
 *
 *   ⚠️처음에 사진 불투명도를 **0.14** 로 눈대중했다. 계산해 보니 최악(완전 검정 사진)에서
 *     水 대비가 **3.96**(기준 4.5)이었다. 0.08 로 내려야 다섯 오행이 다 통과한다(4.56).
 *     ★눈으로는 넷 중 셋이 멀쩡해 보였다 — 계산이 아니면 못 잡는다.
 *
 * 규칙
 *   T0 상세/퍼널 화면이 **자기 히어로를 따로 만들지 않는다** — `ContentHero` 하나로 모은다
 *      (`FreeFunnel` 이 따로 어두운 히어로를 갖고 있었다. 하나만 지키면 되도록 합쳤다)
 *   T1 히어로에 **어두운 스크림이 없다**(`scrimHero`·검은 오버레이로 되돌리면 실패)
 *   T2 제목이 **흰 글자가 아니다**(`onImage` 계열을 쓰면 밝은 배경에서 사라진다)
 *   T3 `HERO_PHOTO_OPACITY` 로 사진을 덮었을 때, **다섯 오행 전부** 제목 대비 ≥ 4.5
 *      (최악 = 사진이 완전 검정일 때)
 *
 * 사용: npm run check:herotone · 자가테스트: npx tsx scripts/check-herotone.ts --selftest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_HERO = 'app/src/components/SpecialContentScreen.tsx';
/** 히어로를 직접 그리면 안 되는 화면들 — `ContentHero` 를 써야 한다. */
const NO_OWN_HERO = ['app/src/components/FreeFunnel.tsx'];
const P_PAL = 'app/src/lib/theme/elementPalette.ts';
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
/** 사진(veil)을 alpha 로 덮은 뒤의 배경색. */
const over = (base: RGB, veil: RGB, a: number): RGB => base.map((v, i) => Math.round(v * (1 - a) + veil[i] * a)) as RGB;

/** 주석을 걷어낸 소스 — 주석에 적힌 말이 아니라 **코드**로 판정한다. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * 히어로 톤·대비를 검사한다.
 *
 * @param heroSrc `SpecialContentScreen.tsx` 원문
 * @param palSrc  `elementPalette.ts` 원문
 * @returns 위반 목록
 */
export function audit(heroSrc: string, palSrc: string, others: Record<string, string> = {}): Fail[] {
  const out: Fail[] = [];

  // T0 — 다른 화면이 자기 히어로를 따로 만들지 않는가
  for (const [path, src] of Object.entries(others)) {
    const cs = code(src);
    if (/scrimHero|heroScrim/.test(cs) || /onImage/.test(cs)) {
      out.push({ rule: 'T0', msg: `${path} 가 자기 어두운 히어로를 갖고 있다 — \`ContentHero\` 로 모을 것(톤이 갈린다)` });
    }
  }
  const c = code(heroSrc);
  // `ContentHero` 함수 본문만 본다(파일 전체엔 다른 화면 코드도 있다)
  const body = c.match(/export function ContentHero[\s\S]*?\n\}/)?.[0] ?? '';
  if (!body) { out.push({ rule: 'T1', msg: `${P_HERO} 에서 ContentHero 를 못 찾았다` }); return out; }

  // T1 — 어두운 스크림 금지
  if (/scrimHero|rgba\(\s*0\s*,\s*0\s*,\s*0/.test(body) || /heroScrim/.test(body)) {
    out.push({ rule: 'T1', msg: `히어로에 어두운 스크림이 돌아왔다 — 시안은 밝은 색면이다(그 위 글자는 먹/강조색)` });
  }
  // T2 — 흰 글자 금지
  if (/onImage/.test(body)) {
    out.push({ rule: 'T2', msg: `히어로 제목이 흰 글자(onImage)다 — 밝은 배경에서 사라진다` });
  }

  // T3 — 사진을 덮은 뒤 대비
  const op = Number(c.match(/HERO_PHOTO_OPACITY\s*=\s*([0-9.]+)/)?.[1] ?? 'NaN');
  if (!Number.isFinite(op)) {
    out.push({ rule: 'T3', msg: `${P_HERO} 에서 HERO_PHOTO_OPACITY 를 못 읽었다` });
  } else {
    for (const el of ['水', '木', '火', '土', '金']) {
      const blk = palSrc.match(new RegExp(`${el}:\\s*\\{([\\s\\S]*?)\\n  \\},`))?.[1] ?? '';
      const ju = blk.match(/ju:\s*'(#[0-9A-Fa-f]{6})'/)?.[1];
      const soft = blk.match(/juSoft:\s*'(#[0-9A-Fa-f]{6})'/)?.[1];
      if (!ju || !soft) { out.push({ rule: 'T3', msg: `팔레트에서 ${el} 의 ju/juSoft 를 못 읽었다` }); continue; }
      // 최악 = 사진이 완전 검정
      const bg = over(hex(soft), [0, 0, 0], op);
      const v = contrast(hex(ju), bg);
      if (v < MIN) {
        out.push({ rule: 'T3', msg: `${el}: 사진 불투명도 ${op} 에서 제목 대비 ${v.toFixed(2)} < ${MIN} — 어두운 사진 위에서 제목이 묻힌다. 불투명도를 낮춰라` });
      }
    }
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const pal = `
  水: {
    juSoft: '#E7EFF8',
    ju: '#39609D',
  },
  木: {
    juSoft: '#E8EFE0',
    ju: '#366038',
  },
  火: {
    juSoft: '#FBEAE7',
    ju: '#A8373F',
  },
  土: {
    juSoft: '#F7EADA',
    ju: '#775631',
  },
  金: {
    juSoft: '#EDEDED',
    ju: '#50504E',
  },`;
  const ok = `export const HERO_PHOTO_OPACITY = 0.08;
export function ContentHero({ image, title }: any) {
  return <View><LinearGradient colors={[colors.juSoft, colors.bg]} /><Text style={{ color: themeColor }}>{title}</Text></View>;
}`;
  const cases: Array<[string, number]> = [
    ['정상(0.08)', audit(ok, pal).length],
    ['불투명도 0.14 — 어두운 사진에서 묻힌다', audit(ok.replace('0.08', '0.14'), pal).length],
    ['어두운 스크림 부활', audit(ok.replace('<LinearGradient', '<View style={styles.heroScrim} /><LinearGradient'), pal).length],
    ['흰 글자 부활', audit(ok.replace('color: themeColor', 'color: colors.onImage'), pal).length],
    ['불투명도를 못 읽음', audit(ok.replace('HERO_PHOTO_OPACITY = 0.08', 'X = 1'), pal).length],
    ['다른 화면이 자기 어두운 히어로를 가짐', audit(ok, pal, { 'x.tsx': 'heroScrim: { backgroundColor: colors.scrimHero }' }).length],
    ['다른 화면이 ContentHero 를 씀(정상)', audit(ok, pal, { 'x.tsx': '<ContentHero image={heroImage} title={q} />' }).length],
  ];
  const want = [0, 3, 1, 1, 1, 1, 0];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const okc = got === want[i];
    console.log(`  ${okc ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!okc) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:herotone 자가테스트 통과 (7케이스)');
  process.exit(bad ? 1 : 0);
}

const others: Record<string, string> = {};
for (const p of NO_OWN_HERO) others[p] = readFileSync(join(ROOT, p), 'utf8');
const fails = audit(readFileSync(join(ROOT, P_HERO), 'utf8'), readFileSync(join(ROOT, P_PAL), 'utf8'), others);
if (fails.length) {
  console.error(`❌ check:herotone — ${fails.length}건`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:herotone — 상세 히어로가 시안 톤이고 제목이 읽힌다');
