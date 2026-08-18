#!/usr/bin/env tsx
/**
 * check:bannerart — 홈 '오늘의 추천' 배너가 **읽히고, 안 깨지고, 실제로 돌아가는지**를 지킨다.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 — 2026-08-18 시안 반영 중 실측으로 드러난 것들
 *
 *  ① **시안대로 흰 글자를 얹으면 안 읽힌다.**
 *     시안 배너의 흰 글자 대비가 水 2.32 · 木 2.04 · 火 2.29 · 金 4.00 이었다(큰 글자 기준 3.0 미달).
 *     다섯 중 통과한 건 **먹 글자를 쓴 土(9.54)** 뿐이라 그쪽으로 통일했다.
 *
 *  ② **그림 세 장은 배너에 못 쓴다.** 왼쪽이 비지 않는 전면 그림이라 글자가 묻힌다
 *     — `pen` 1.09 · `forest` 3.00 · `compass` 3.65. 그래서 풀에서 뺐다.
 *
 *  ③ **제목이 넉 줄로 깨졌다.** `\n` 으로 두 줄을 만들었는데 글자 자리가 좁아 **각 줄이 또 접혔다**:
 *     「내 재물 그릇 / 은 / 얼마나 클까 / 요?」(시뮬 실측). 폭·글자크기·한 줄 글자수는 **함께** 봐야 한다.
 *
 *  ④ **웹에서 자동회전이 원래부터 안 돌고 있었다.**
 *     `pagingEnabled`(→`scroll-snap-type: x mandatory`) 위에서 `scrollTo({animated:true})` 는
 *     아무 일도 하지 않는다(1.2초 뒤 scrollLeft 0). 그런데 점은 카운터로 따로 돌아
 *     **점만 넘어가고 화면은 그대로**였다 — 살아 보여서 아무도 몰랐다.
 *
 * 규칙
 *   B1 `BANNER_POOL` 다섯 오행이 비어 있지 않고, 이름이 `BannerArt` 유니온 안에 있다
 *   B2 모든 `BannerArt` 에 파일이 있고, **잰 값(sha256)과 파일이 일치**한다(그림 바꾸면 재측정 강제)
 *   B3 `BANNER_FIELD` 가 실제로 잰 바탕색과 같다
 *   B4 오행 막을 씌운 뒤에도 **글자영역 먹 대비 ≥ 4.5**(열 장 × 다섯 오행 전부 계산)
 *   B5 제목 한 줄이 **글자 자리에 들어간다**(③ 재발 방지 — 실제 문구를 재서 계산)
 *   B6 웹 자동회전이 `animated: true` 를 쓰지 않는다 · B7 점을 `onScroll` 로 맞춘다
 *
 * 사용: npm run check:bannerart · 자가테스트: npx tsx scripts/check-bannerart.ts --selftest
 * 그림을 바꿨으면: npm run measure:bannerart (잰 값을 다시 만든다)
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_PROMO = 'app/src/components/kit/PromoBanner.tsx';
const P_HOUSE = 'app/src/components/HouseAdBanner.tsx';
const P_ASSET = 'app/src/lib/ui/brandAsset.ts';
const P_DATA = 'scripts/data/banner-art-measured.json';

/** 본문 글자 기준 최소 대비(WCAG AA). 제목은 큰 글자라 3.0 이면 되지만 부제가 이 기준을 받는다. */
const MIN_CONTRAST = 4.5;
/** 기준 화면 — 가장 좁은 실기기 축에 맞춘다(iPhone SE/13 mini 는 375, 여기선 실기기 402 기준). */
const SCREEN_PT = 402;
/** 페이지 좌우 여백(홈 `body` 의 paddingHorizontal = space(4)). */
const PAGE_PAD = 16;

type Fail = { rule: string; msg: string };
type Art = { sha256: string; field: string; darkest: string };

/** 주석을 걷어낸 소스 — '주석에 적힌 말'이 아니라 **코드**로 판정한다. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const hex = (h: string): [number, number, number] => {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const lum = (c: [number, number, number]) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** 알파 합성 — 막을 씌운 뒤의 색. */
const over = (base: [number, number, number], veil: [number, number, number], a: number) =>
  base.map((v, i) => Math.round(v * (1 - a) + veil[i] * a)) as [number, number, number];

/**
 * 배너 세 파일 + 잰 값을 검사한다.
 *
 * @param src     `{promo, house, asset, ko}` 원문
 * @param arts    `banner-art-measured.json` 의 `arts`
 * @param shaOf   파일의 sha256 앞 16자를 주는 함수(없으면 null). 자가테스트가 갈아 끼운다
 * @returns 위반 목록. 빈 배열이면 통과
 */
export function audit(
  src: { promo: string; house: string; asset: string; ko: string },
  arts: Record<string, Art>,
  shaOf: (name: string) => string | null,
): Fail[] {
  const out: Fail[] = [];
  const cp = code(src.promo), ch = code(src.house), ca = code(src.asset);

  // ── 소스에서 값 읽기 ────────────────────────────────────────
  const union = (ca.match(/export type BannerArt =([\s\S]*?);/)?.[1] ?? '')
    .match(/'([a-z]+)'/g)?.map((x) => x.replace(/'/g, '')) ?? [];
  const poolSrc = ca.match(/BANNER_POOL[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '';
  const fieldSrc = ca.match(/BANNER_FIELD[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '';
  const JU: Record<string, string> = {};
  const INK: Record<string, string> = {};
  for (const m of (src.asset.length ? [] : [])) void m;   // (팔레트는 아래에서 읽는다)

  // ── B1 풀 ─────────────────────────────────────────────────
  const pools: Record<string, string[]> = {};
  for (const el of ['水', '木', '火', '土', '金']) {
    const row = poolSrc.match(new RegExp(`${el}:\\s*\\[([^\\]]*)\\]`));
    const names = row ? (row[1].match(/'([a-z]+)'/g) ?? []).map((x) => x.replace(/'/g, '')) : [];
    pools[el] = names;
    if (!names.length) { out.push({ rule: 'B1', msg: `BANNER_POOL 의 ${el} 이 비었다 — 그 테마에서 배너가 빈 칸으로 나간다` }); continue; }
    for (const n of names) if (!union.includes(n)) out.push({ rule: 'B1', msg: `BANNER_POOL 의 ${el} 에 있는 '${n}' 이 BannerArt 유니온에 없다` });
  }
  if (!union.length) out.push({ rule: 'B1', msg: `${P_ASSET} 에서 BannerArt 이름을 못 읽었다` });

  // ── B2 파일 + 잰 값 일치 ──────────────────────────────────
  for (const n of union) {
    const rec = arts[n];
    if (!rec) { out.push({ rule: 'B2', msg: `'${n}' 의 잰 값이 ${P_DATA} 에 없다 — npm run measure:bannerart` }); continue; }
    const sha = shaOf(`bn-${n}.jpg`);
    if (sha === null) { out.push({ rule: 'B2', msg: `그림 파일이 없다: app/assets/brand/bn-${n}.jpg` }); continue; }
    if (sha !== rec.sha256) out.push({ rule: 'B2', msg: `bn-${n}.jpg 가 잰 뒤에 **바뀌었다**(sha ${sha} ≠ ${rec.sha256}) — 대비가 달라졌을 수 있다. npm run measure:bannerart` });
  }

  // ── B3 BANNER_FIELD 일치 ──────────────────────────────────
  for (const n of union) {
    const want = arts[n]?.field;
    const got = fieldSrc.match(new RegExp(`${n}:\\s*'(#[0-9A-Fa-f]{6})'`))?.[1];
    if (!want) continue;
    if (!got) out.push({ rule: 'B3', msg: `BANNER_FIELD 에 '${n}' 이 없다` });
    else if (got.toUpperCase() !== want.toUpperCase()) out.push({ rule: 'B3', msg: `BANNER_FIELD['${n}'] = ${got} 인데 실제로 잰 바탕색은 ${want} — 그림 자리에 이음매가 보인다` });
  }

  // ── B4 막을 씌운 뒤 대비 ──────────────────────────────────
  const tint = Number(cp.match(/BANNER_TINT\s*=\s*([0-9.]+)/)?.[1] ?? 'NaN');
  if (!Number.isFinite(tint)) {
    out.push({ rule: 'B4', msg: `${P_PROMO} 에서 BANNER_TINT 를 못 읽었다` });
  } else {
    const pal = readFileSync(join(ROOT, 'app/src/lib/theme/elementPalette.ts'), 'utf8');
    for (const el of Object.keys(pools)) {
      const blk = pal.match(new RegExp(`${el}:\\s*\\{([\\s\\S]*?)\\n  \\},`))?.[1] ?? '';
      const ju = blk.match(/ju:\s*'(#[0-9A-Fa-f]{6})'/)?.[1];
      const ink = blk.match(/ink:\s*'(#[0-9A-Fa-f]{6})'/)?.[1];
      if (!ju || !ink) { out.push({ rule: 'B4', msg: `팔레트에서 ${el} 의 ju/ink 를 못 읽었다` }); continue; }
      for (const n of pools[el]) {
        const rec = arts[n]; if (!rec) continue;
        const bg = over(hex(rec.darkest), hex(ju), tint);
        const v = contrast(bg, hex(ink));
        if (v < MIN_CONTRAST) out.push({ rule: 'B4', msg: `${el}/${n}: 막(${tint}) 씌운 뒤 먹 대비 ${v.toFixed(2)} < ${MIN_CONTRAST} — 부제가 안 읽힌다. 막을 낮추거나 그 그림을 풀에서 빼라` });
      }
    }
  }

  // ── B5 제목 한 줄이 글자 자리에 들어가는가 ─────────────────
  const zonePct = Number(cp.match(/TEXT_ZONE\s*=\s*'(\d+)%'/)?.[1] ?? 'NaN');
  const fsize = Number(cp.match(/title:\s*\{\s*fontSize:\s*(\d+)/)?.[1] ?? 'NaN');
  const bodyPadN = Number(cp.match(/body:\s*\{[^}]*paddingHorizontal:\s*space\(([\d.]+)\)/)?.[1] ?? 'NaN');
  if (![zonePct, fsize, bodyPadN].every(Number.isFinite)) {
    out.push({ rule: 'B5', msg: `${P_PROMO} 에서 TEXT_ZONE·title.fontSize·body.paddingHorizontal 중 하나를 못 읽었다` });
  } else {
    const usable = (SCREEN_PT - PAGE_PAD * 2) * (zonePct / 100) - bodyPadN * 4 * 2;
    const titles = [...src.ko.matchAll(/'(\w+T)':\s*'([^']*)'/g)].map((m) => m[2]);
    if (!titles.length) out.push({ rule: 'B5', msg: `copy/ko.ts 의 banner.*T 문구를 못 읽었다` });
    for (const t of titles) {
      for (const line of t.split('\\n')) {
        // 한글·한자는 글자폭 ≈ fontSize, 공백·영문은 절반으로 잡는다(보수적)
        const w = [...line].reduce((a, ch2) => a + (/[ㄱ-힝一-鿿]/.test(ch2) ? fsize : fsize * 0.5), 0);
        if (w > usable) out.push({ rule: 'B5', msg: `제목 「${line}」 이 글자 자리에 안 들어간다(필요 ${w.toFixed(0)}pt > ${usable.toFixed(0)}pt) — 줄이 또 접혀 「은」·「요?」 처럼 한 글자가 떨어진다` });
      }
    }
  }

  // ── B6·B7 웹 캐러셀 ───────────────────────────────────────
  const scrollTo = ch.match(/scrollTo\(\{[^}]*\}\)/g) ?? [];
  if (!scrollTo.length) out.push({ rule: 'B6', msg: `${P_HOUSE} 에 scrollTo 가 없다 — 자동회전이 사라졌나?` });
  else if (scrollTo.some((x) => /animated:\s*true/.test(x))) out.push({ rule: 'B6', msg: `${P_HOUSE} 의 scrollTo 가 웹에서도 animated:true — scroll-snap 위에서 **아무 일도 일어나지 않는다**(실측). Platform 으로 갈라라` });
  if (!/onScroll=\{/.test(ch)) out.push({ rule: 'B7', msg: `${P_HOUSE} 가 onScroll 로 점을 맞추지 않는다 — 점이 화면과 다른 장을 가리키게 된다` });

  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const arts: Record<string, Art> = {
    balloon: { sha256: 'aaa', field: '#E7E8FD', darkest: '#E6E7FC' },
    door: { sha256: 'bbb', field: '#FFEEDB', darkest: '#FCE0BC' },
  };
  const ok = {
    promo: `const TEXT_ZONE = '58%';\nexport const BANNER_TINT = 0.22;\nbody: { paddingVertical: space(5), paddingHorizontal: space(4), width: TEXT_ZONE },\ntitle: { fontSize: 21, lineHeight: 29 },`,
    house: `scrollTo({ x: next * w, animated: Platform.OS !== 'web' });\n<ScrollView onScroll={onScroll} />`,
    asset: `export type BannerArt = 'balloon' | 'door';\nexport const BANNER_FIELD = {\n balloon: '#E7E8FD', door: '#FFEEDB',\n};\nexport const BANNER_POOL = {\n 水: ['balloon'],\n 木: ['balloon'],\n 火: ['door'],\n 土: ['door'],\n 金: ['balloon'],\n};`,
    ko: `'loveT': '지금 나에게\\n들어오고 있는\\n인연이 있어요.',`,
  };
  const sha = (n: string) => (n.includes('balloon') ? 'aaa' : 'bbb');
  const cases: Array<[string, Fail[]]> = [
    ['정상', audit(ok, arts, sha)],
    ['B1 金 풀 빔', audit({ ...ok, asset: ok.asset.replace(`金: ['balloon'],`, `金: [],`) }, arts, sha)],
    ['B1 없는 이름', audit({ ...ok, asset: ok.asset.replace(`水: ['balloon'],`, `水: ['nope'],`) }, arts, sha)],
    ['B2 그림이 바뀜', audit(ok, arts, () => 'zzz')],
    ['B2 파일 없음', audit(ok, arts, () => null)],
    ['B3 바탕색 불일치', audit({ ...ok, asset: ok.asset.replace(`balloon: '#E7E8FD'`, `balloon: '#FFFFFF'`) }, arts, sha)],
    ['B4 막 과다(0.5)', audit({ ...ok, promo: ok.promo.replace('0.22', '0.5') }, { ...arts, balloon: { ...arts.balloon, darkest: '#8CA4E7' } }, sha)],
    ['B5 제목이 넘침', audit({ ...ok, ko: `'moneyT': '내 재물 그릇은 얼마나 클까요?',` }, arts, sha)],
    ['B5 글자 너무 큼', audit({ ...ok, promo: ok.promo.replace('fontSize: 21', 'fontSize: 34') }, arts, sha)],
    ['B6 웹에도 animated:true', audit({ ...ok, house: `scrollTo({ x: 1, animated: true });\n<ScrollView onScroll={onScroll} />` }, arts, sha)],
    ['B7 onScroll 제거', audit({ ...ok, house: `scrollTo({ x: 1, animated: Platform.OS !== 'web' });` }, arts, sha)],
  ];
  let bad = 0;
  for (const [name, fails] of cases) {
    const shouldPass = name === '정상';
    const passed = fails.length === 0;
    if (passed !== shouldPass) { console.error(`❌ 자가테스트 실패: ${name} → ${passed ? '통과' : fails.map((f) => f.rule).join(',')}`); bad++; }
    else console.log(`  ✓ ${name} → ${passed ? '통과' : [...new Set(fails.map((f) => f.rule))].join(',')}`);
  }
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:bannerart 자가테스트 통과 (11케이스)');
  process.exit(bad ? 1 : 0);
}

const data = JSON.parse(readFileSync(join(ROOT, P_DATA), 'utf8')) as { arts: Record<string, Art> };
const fails = audit(
  {
    promo: readFileSync(join(ROOT, P_PROMO), 'utf8'),
    house: readFileSync(join(ROOT, P_HOUSE), 'utf8'),
    asset: readFileSync(join(ROOT, P_ASSET), 'utf8'),
    ko: readFileSync(join(ROOT, 'app/src/copy/ko.ts'), 'utf8'),
  },
  data.arts,
  (name) => {
    const p = join(ROOT, 'app/assets/brand', name);
    return existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16) : null;
  },
);
if (fails.length) {
  console.error(`❌ check:bannerart — ${fails.length}건`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:bannerart — 그림·대비·줄바꿈·웹 페이징 이상 없음');
