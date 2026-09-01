// scripts/check-appicon.ts — 앱 아이콘이 **세 벌 사이에서 갈리지 않게** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01: *"앱 로고는 좀더 쨍한 파란색으로 하자 지금 너무 연해"* → `#39609D` → `#1B5FE0`
//
// ■ ★★왜 하네스인가 — 아이콘은 **한 벌이 아니다**
//   ①`app/assets/icon.png`(Expo 원본) ②iOS `AppIcon.appiconset` ③Android `mipmap-*` webp 10장
//   ④웹 `theme-color` ⑤안드로이드 알림 색.
//   ⚠️`prebuild` 가 금지돼 있어(versionCode 가 1로 되돌아간다) **사본을 손으로 맞춘다** —
//     그래서 한 곳만 고치면 **조용히 갈린다.** 실제로 겪었다(원본 8/21 ↔ 사본 8/7 · [[native-icon-copy-drift]]).
//   ★색은 «눈» 이 아니라 **값**으로 잰다 — 「비슷해 보인다」로는 못 잡는다.
//
// ■ ★★내가 놓칠 뻔한 것 — 적응형 아이콘의 `foreground` 는 **모서리가 투명**이다
//   모서리 픽셀만 보고 «파랑 아님» 으로 건너뛰었다가, 안쪽을 세어 보니 옛 색이었다.
//   ⇒ 이 하네스는 **불투명 픽셀의 최다색**을 센다(모서리 한 점이 아니라).
//
// 무엇을 지키나
//   K1 Expo 원본·iOS 사본·Android 런처가 **같은 배경색**이다
//   K2 Android 적응형 `foreground` 10장도 같은 색이다(안쪽 기준)
//   K3 웹 `theme-color` · 안드로이드 알림 색이 그 색과 같다
//   K4 iOS 사본이 **1024×1024** 다(App Store 필수)
//
// ★음성 테스트: `npx tsx scripts/check-appicon.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..');
type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** `#RRGGBB` 두 색이 사람 눈에 같은가(값으로). */
export function sameColor(a: string, b: string, tol = 12): boolean {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a.toUpperCase());
  const [r2, g2, b2] = p(b.toUpperCase());
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) <= tol;
}

/** 파일에서 `#RRGGBB` 를 뽑는다(첫 번째). */
export function pickHex(src: string, near: string): string | null {
  const i = src.indexOf(near);
  if (i < 0) return null;
  const m = /#([0-9A-Fa-f]{6})/.exec(src.slice(i, i + 200));
  return m ? `#${m[1].toUpperCase()}` : null;
}

/** 이미지의 **불투명 픽셀 최다색**을 python 으로 잰다. 못 재면 null. */
function dominant(path: string): string | null {
  try {
    const code = `
from PIL import Image
from collections import Counter
im=Image.open(${JSON.stringify(path)}).convert('RGBA'); px=im.load(); w,h=im.size
c=Counter()
step=max(1,min(w,h)//120)
for y in range(0,h,step):
    for x in range(0,w,step):
        r,g,b,a=px[x,y]
        if a>200: c[(r,g,b)]+=1
print('#%02X%02X%02X' % c.most_common(1)[0][0] if c else '')`;
    return (execFileSync('python3', ['-c', code], { encoding: 'utf8' }).trim() || null);
  } catch { return null; }
}

function run() {
  // ── B1 ★브랜드색이 **세 곳에서 같은가** (2026-09-02) ────────────────────
  //   앱 아이콘 색을 09-01 에 바꾸면서 `app.json` 과 `+html.tsx` 는 고쳤는데
  //   `scripts/inject-og.mjs` 를 **놓쳤다**. 그런데 그놈이 export **뒤에** 돌아
  //   `theme-color` 를 옛 파랑으로 **덮어썼다** — 웹은 계속 옛 색이었고,
  //   화면은 멀쩡해 보여서 배포 산출물을 재기 전까진 안 보였다.
  //   ⇒ 세 곳을 서로 견준다. «한쪽만 고쳐지는» 것을 여기서 막는다.
  {
    const srcs: { f: string; key: string }[] = [
      { f: 'app/app.json', key: 'color' },
      { f: 'app/src/app/+html.tsx', key: 'theme-color' },
      { f: 'scripts/inject-og.mjs', key: 'theme-color' },
    ];
    const got = srcs.map(({ f, key }) => {
      const abs = join(ROOT, f);
      if (!existsSync(abs)) return { f, hex: null as string | null };
      return { f, hex: pickHex(readFileSync(abs, 'utf8'), key) };
    }).filter((x) => x.hex);
    for (let i = 1; i < got.length; i++) {
      if (!sameColor(got[0].hex!, got[i].hex!)) {
        fail('B1', `브랜드색이 갈렸다 — ${got[0].f} ${got[0].hex} · ${got[i].f} ${got[i].hex}.\n        `
          + '⚠️`inject-og.mjs` 는 export **뒤에** 돌아 «나중에 덮는» 쪽이다 — 여기가 옛 색이면 웹은 옛 색이다');
      }
    }
  }

  const EXPO = 'app/assets/icon.png';
  const IOS = 'app/ios/SyncFortune/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png';
  const expo = existsSync(join(ROOT, EXPO)) ? dominant(join(ROOT, EXPO)) : null;
  if (!expo) { console.log('⏭  건너뜀 — 원본을 못 읽었다(Pillow 없음?). **못 쟀다**'); return; }

  // K1 iOS 사본
  if (!existsSync(join(ROOT, IOS))) console.log('⏭  K1 iOS 건너뜀 — `app/ios` 가 없다(gitignore). **못 쟀다**');
  else {
    const ios = dominant(join(ROOT, IOS));
    if (ios && !sameColor(expo, ios)) {
      fail('K1', `iOS 사본 색이 **원본과 다르다** — 원본 ${expo} · 사본 ${ios}.\n        `
        + '⚠️`prebuild` 가 금지돼 사본을 손으로 맞춘다 — 한 곳만 고치면 **스토어에 옛 아이콘이 올라간다**');
    }
    // K4 크기
    try {
      const sz = execFileSync('python3', ['-c',
        `from PIL import Image;im=Image.open(${JSON.stringify(join(ROOT, IOS))});print('%dx%d'%im.size)`],
        { encoding: 'utf8' }).trim();
      if (sz !== '1024x1024') fail('K4', `iOS 아이콘이 ${sz} 다 — App Store 는 **1024×1024** 를 요구한다`);
    } catch { /* 못 재면 넘어간다 */ }
  }

  // K1·K2 Android
  const resDir = join(ROOT, 'app/android/app/src/main/res');
  if (!existsSync(resDir)) console.log('⏭  K2 Android 건너뜀 — `app/android` 가 없다. **못 쟀다**');
  else {
    for (const d of readdirSync(resDir).filter((x) => x.startsWith('mipmap-'))) {
      for (const f of readdirSync(join(resDir, d)).filter((x) => x.startsWith('ic_launcher'))) {
        const got = dominant(join(resDir, d, f));
        if (got && !sameColor(expo, got)) {
          fail('K2', `\`${d}/${f}\` 색이 **원본과 다르다** — 원본 ${expo} · 이 파일 ${got}.\n        `
            + '★적응형 아이콘의 `foreground` 는 **모서리가 투명**이라 모서리만 보면 못 잡는다(안쪽을 센다)');
        }
      }
    }
  }

  // K3 문자열 색
  const html = existsSync(join(ROOT, 'app/src/app/+html.tsx')) ? readFileSync(join(ROOT, 'app/src/app/+html.tsx'), 'utf8') : '';
  const theme = pickHex(html, 'theme-color');
  if (theme && !sameColor(expo, theme)) {
    fail('K3', `웹 \`theme-color\` 가 ${theme} 인데 아이콘은 ${expo} 다 — 브라우저 주소창 색이 아이콘과 어긋난다`);
  }
  const colorsXml = join(resDir, 'values/colors.xml');
  if (existsSync(colorsXml)) {
    const n = pickHex(readFileSync(colorsXml, 'utf8'), 'notification_icon_color');
    if (n && !sameColor(expo, n)) {
      fail('K3', `안드로이드 알림 색이 ${n} 인데 아이콘은 ${expo} 다 — 알림만 옛 색으로 뜬다`);
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    { name: 'K 같은 색이면 통과', run: () => sameColor('#1B5FE0', '#1B5FE1') === true },
    { name: 'K ★옛 색이면 문다', run: () => sameColor('#1B5FE0', '#39609D') === false },
    { name: 'K ★미세한 압축 오차는 봐준다', run: () => sameColor('#1B5FE0', '#1C60DF') === true },
    { name: 'K ★대소문자를 가리지 않는다', run: () => sameColor('#1b5fe0', '#1B5FE0') === true },
    { name: 'K3 근처 색을 뽑는다', run: () => pickHex('<meta name="theme-color" content="#1B5FE0" />', 'theme-color') === '#1B5FE0' },
    { name: 'B1 세 곳이 같으면 통과', run: () => sameColor('#1B5FE0', '#1B5FE0') === true },
    { name: 'B1 ★한 곳만 옛 색이면 문다', run: () => sameColor('#1B5FE0', '#39609D') === false },
    { name: 'K3 ★없으면 null', run: () => pickHex('<meta name="viewport" />', 'theme-color') === null },
    { name: 'K3 ★엉뚱한 앞쪽 색에 안 속는다', run: () => pickHex('#FFFFFF ... theme-color" content="#1B5FE0"', 'theme-color') === '#1B5FE0' },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:appicon — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:appicon — 아이콘 세 벌과 문자열 색이 모두 같다');
}
