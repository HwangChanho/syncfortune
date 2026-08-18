#!/usr/bin/env tsx
/**
 * check:bannerart — 홈 '오늘의 추천' 배너가 **읽히고, 실제로 돌아가는지**를 지킨다.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (2026-08-18 시안 반영 중 실측으로 드러난 것 셋)
 *
 *  ① **시안대로 흰 글자를 얹으면 안 읽힌다.**
 *     시안 배너의 흰 글자 대비를 계산해 보니 水 2.32 · 木 2.04 · 火 2.29 · 金 4.00 —
 *     큰 글자 기준(3.0)에도 못 미친다. 다섯 중 통과한 건 **먹 글자를 쓴 土(9.54)** 뿐이었다.
 *     ⇒ 먹 글자로 통일하고, 그림 위에 **밝은 스크림**을 깔아 대비를 고정했다.
 *     그림 13장의 글자 영역 최암부를 재 보면 `pen` 1.1 · `compass` 1.6 · `forest` 3.0 —
 *     **스크림을 지우는 순간 세 장이 곧바로 안 읽힌다.** B1 이 그 스크림을 지킨다.
 *
 *  ② **웹에서 자동회전이 원래부터 안 돌고 있었다.**
 *     `pagingEnabled` → `scroll-snap-type: x mandatory` 위에서
 *     `scrollTo({animated:true})` 는 아무 일도 하지 않는다(실측: 1.2초 뒤 scrollLeft 0).
 *     그런데 점은 카운터로 따로 돌아 **점만 넘어가고 화면은 그대로**였다 —
 *     살아 있는 것처럼 보여서 아무도 몰랐다. B2·B3 이 그 조합을 막는다.
 *
 *  ③ 그림 풀이 비거나 이름이 어긋나면 **빈 배너**가 조용히 나간다(코드만 봐선 안 보인다).
 *     B4·B5 가 이름·파일·풀을 맞춘다.
 *
 * 규칙
 *   B1 `PromoBanner` 가 글자 뒤에 스크림(LinearGradient)을 깐다 — ①의 결론을 지운 채 배포 금지
 *   B2 `HouseAdBanner` 의 자동회전이 웹에서 `animated: true` 를 쓰지 않는다
 *   B3 점(idx)을 **실제 스크롤 위치**에서 읽는다(`onScroll`) — 카운터로 돌리면 또 어긋난다
 *   B4 `BANNER_POOL` 의 다섯 오행이 모두 비어 있지 않고, 이름이 `BannerArt` 유니온 안에 있다
 *   B5 `BannerArt` 의 모든 이름에 대해 `app/assets/brand/bn-<name>.jpg` 가 실제로 있다
 *
 * 사용: npm run check:bannerart  ·  자가테스트: npx tsx scripts/check-bannerart.ts --selftest
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_PROMO = 'app/src/components/kit/PromoBanner.tsx';
const P_HOUSE = 'app/src/components/HouseAdBanner.tsx';
const P_ASSET = 'app/src/lib/ui/brandAsset.ts';

type Fail = { rule: string; msg: string };

/** 주석을 걷어낸 소스 — 규칙을 '주석에 적힌 말'이 아니라 **코드**로만 판정한다. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * 배너 세 파일을 검사한다.
 *
 * @param promo `PromoBanner.tsx` 원문
 * @param house `HouseAdBanner.tsx` 원문
 * @param asset `brandAsset.ts` 원문
 * @param fileExists 파일 존재 확인자(자가테스트가 갈아 끼운다)
 * @returns 위반 목록. 빈 배열이면 통과
 */
export function audit(
  promo: string,
  house: string,
  asset: string,
  fileExists: (name: string) => boolean,
): Fail[] {
  const out: Fail[] = [];
  const cp = code(promo), ch = code(house), ca = code(asset);

  // B1 — 글자 뒤 스크림. 이게 없으면 pen·compass·forest 위에서 글자가 묻힌다.
  if (!/LinearGradient/.test(cp) || !/scrim/.test(cp)) {
    out.push({ rule: 'B1', msg: `${P_PROMO} 에 글자 뒤 스크림(LinearGradient + scrim)이 없다 — 어두운 그림(pen 1.1·compass 1.6·forest 3.0) 위에서 먹 글자가 묻힌다` });
  }

  // B2 — 웹 자동회전. `animated: true` 를 그대로 쓰면 웹에서 배너가 멈춘다.
  const scrollTo = ch.match(/scrollTo\(\{[^}]*\}\)/g) ?? [];
  if (!scrollTo.length) {
    out.push({ rule: 'B2', msg: `${P_HOUSE} 에 scrollTo 가 없다 — 자동회전이 사라졌나?` });
  } else if (scrollTo.some((s) => /animated:\s*true/.test(s))) {
    out.push({ rule: 'B2', msg: `${P_HOUSE} 의 scrollTo 가 웹에서도 animated:true — scroll-snap 위에서 **아무 일도 일어나지 않는다**(실측). Platform 으로 갈라라` });
  }

  // B3 — 점은 실제 위치에서. 카운터(idxRef 를 올려서 setIdx)로 돌리면 화면과 어긋난다.
  if (!/onScroll=\{/.test(ch)) {
    out.push({ rule: 'B3', msg: `${P_HOUSE} 가 onScroll 로 점을 맞추지 않는다 — 점이 화면과 다른 장을 가리키게 된다` });
  }

  // B4·B5 — 그림 이름·풀·파일
  // ⚠️유니온은 **타입 선언에서만** 뽑는다. 파일 전체에서 뽑으면 풀에 적은 이름이 유니온에도
  //   섞여 들어와 "없는 이름"을 영영 못 잡는다(자가테스트가 잡아 준 구멍 · 2026-08-18).
  const artBlock = ca.match(/export type BannerArt =([\s\S]*?);/);
  const arts = artBlock ? [...artBlock[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : [];
  const poolBlock = ca.match(/BANNER_POOL[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!poolBlock) {
    out.push({ rule: 'B4', msg: `${P_ASSET} 에서 BANNER_POOL 을 못 읽었다` });
  } else {
    for (const el of ['水', '木', '火', '土', '金']) {
      const row = poolBlock[1].match(new RegExp(`${el}:\\s*\\[([^\\]]*)\\]`));
      const names = row ? [...row[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : [];
      if (!names.length) { out.push({ rule: 'B4', msg: `BANNER_POOL 의 ${el} 이 비어 있다 — 그 테마에서 배너가 빈 칸으로 나간다` }); continue; }
      for (const n of names) {
        if (!arts.includes(n)) out.push({ rule: 'B4', msg: `BANNER_POOL 의 ${el} 에 있는 '${n}' 이 BannerArt 유니온에 없다` });
      }
    }
  }

  if (!arts.length) out.push({ rule: 'B5', msg: `${P_ASSET} 에서 BannerArt 이름을 못 읽었다` });
  for (const n of arts) {
    if (!fileExists(`bn-${n}.jpg`)) out.push({ rule: 'B5', msg: `그림 파일이 없다: app/assets/brand/bn-${n}.jpg (Storage 에도 없을 것 — 배너가 빈 칸으로 나간다)` });
  }
  return out;
}

// ── 자가테스트: 규칙마다 **깨진 입력**을 넣어 정말 잡는지 본다(음성 테스트) ──
if (process.argv.includes('--selftest')) {
  const ok = {
    promo: `import { LinearGradient } from 'expo-linear-gradient';\n<LinearGradient style={[StyleSheet.absoluteFill, styles.scrim]} />\nconst styles = { scrim: {} }`,
    house: `scrollTo({ x: next * w, animated: Platform.OS !== 'web' });\n<ScrollView onScroll={onScroll} />`,
    asset: `export type BannerArt = 'balloon' | 'door';\nexport const BANNER_POOL = {\n 水: ['balloon'],\n 木: ['balloon'],\n 火: ['door'],\n 土: ['door'],\n 金: ['balloon'],\n};`,
  };
  const yes = () => true;
  const cases: Array<[string, Fail[]]> = [
    ['정상', audit(ok.promo, ok.house, ok.asset, yes)],
    ['B1 스크림 제거', audit(`<View />`, ok.house, ok.asset, yes)],
    ['B2 웹에도 animated:true', audit(ok.promo, `scrollTo({ x: 1, animated: true });\n<ScrollView onScroll={onScroll} />`, ok.asset, yes)],
    ['B2 scrollTo 소실', audit(ok.promo, `<ScrollView onScroll={onScroll} />`, ok.asset, yes)],
    ['B3 onScroll 제거', audit(ok.promo, `scrollTo({ x: 1, animated: Platform.OS !== 'web' });`, ok.asset, yes)],
    ['B4 金 풀 빔', audit(ok.promo, ok.house, ok.asset.replace(`金: ['balloon'],`, `金: [],`), yes)],
    ['B4 없는 이름', audit(ok.promo, ok.house, ok.asset.replace(`水: ['balloon'],`, `水: ['nope'],`), yes)],
    ['B5 파일 없음', audit(ok.promo, ok.house, ok.asset, () => false)],
    // ★주석에만 적어 두고 코드에서 지운 경우 — '말'이 아니라 '코드'로 판정하는지
    ['주석뿐인 스크림', audit(`// scrim LinearGradient 를 깐다\n<View />`, ok.house, ok.asset, yes)],
  ];
  let bad = 0;
  for (const [name, fails] of cases) {
    const shouldPass = name === '정상';
    const passed = fails.length === 0;
    if (passed !== shouldPass) { console.error(`❌ 자가테스트 실패: ${name} → ${passed ? '통과' : fails.map((f) => f.rule).join(',')}`); bad++; }
    else console.log(`  ✓ ${name} → ${passed ? '통과' : fails.map((f) => f.rule).join(',')}`);
  }
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:bannerart 자가테스트 통과 (9케이스)');
  process.exit(bad ? 1 : 0);
}

const fails = audit(
  readFileSync(join(ROOT, P_PROMO), 'utf8'),
  readFileSync(join(ROOT, P_HOUSE), 'utf8'),
  readFileSync(join(ROOT, P_ASSET), 'utf8'),
  (name) => existsSync(join(ROOT, 'app/assets/brand', name)),
);
if (fails.length) {
  console.error(`❌ check:bannerart — ${fails.length}건`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:bannerart — 배너 그림·대비·웹 페이징 이상 없음');
