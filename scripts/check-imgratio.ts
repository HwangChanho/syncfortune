/**
 * scripts/check-imgratio.ts — 고정 크기 박스와 **그림의 실제 비율**이 맞는가
 * ─────────────────────────────────────────────────────────────────────────
 * 2026-08-22 Boss *"상단 로고 왜저래"* — 홈 헤더 로고가 콩알만 하게 떠 있었다.
 *
 * ■ 무슨 일이었나
 *   자산 `brand/v3/wordmark.png` 는 **340×470 세로형**(심볼 위·글자 아래)인데
 *   스타일이 `{ width: 108, height: 34 }` **가로형**이었다.
 *   `contentFit="contain"` 은 비율을 지키므로 34px 높이에 맞추면서
 *   폭이 **25px**(34 × 340/470)로 줄었다 — 박스의 4분의 1만 채운 것이다.
 *
 * ■ ★이 사고가 눈에 안 띄는 이유
 *   비율이 안 맞아도 그림은 **찌그러지지 않는다**(그게 `contain` 이 하는 일이다).
 *   그냥 **작아진다.** 그래서 "왜 이렇게 작지?" 라고 생각할 뿐 고장으로 안 읽힌다.
 *   ⇒ 눈이 아니라 **숫자로** 봐야 잡힌다.
 *
 * ■ 판정
 *   `contentFit="contain"` + `styles.X` 에 width·height 가 **둘 다 고정 숫자**인 경우,
 *   자산의 실제 비율과 박스 비율이 **2배 이상** 어긋나면 실패.
 *   ⚠️2배로 느슨하게 잡는 이유: 여백을 의도적으로 둔 자리가 있다. 진짜 사고만 잡는다.
 *
 * 실행: npm run check:imgratio   (자가테스트: --selftest)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const ROOTS = ['app/src'];
const ASSETS = 'app/assets';
/** 어긋남 허용 배수 — 이보다 크면 사고로 본다. */
const MAX_SKEW = 2.0;

/** 파일 크기(px). `sips` 는 macOS 기본 도구라 별도 설치가 필요 없다. */
function dims(file: string): { w: number; h: number } | null {
  try {
    const out = execSync(`sips -g pixelWidth -g pixelHeight ${JSON.stringify(file)}`, { encoding: 'utf8' });
    const w = /pixelWidth:\s*(\d+)/.exec(out)?.[1];
    const h = /pixelHeight:\s*(\d+)/.exec(out)?.[1];
    return w && h ? { w: Number(w), h: Number(h) } : null;
  } catch { return null; }
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

/** `styles.<name>` 의 width·height 를 숫자로. 둘 다 고정 숫자일 때만 돌려준다. */
function boxOf(src: string, name: string): { w: number; h: number } | null {
  const m = new RegExp(`\\b${name}\\s*:\\s*\\{([^}]*)\\}`).exec(src);
  if (!m) return null;
  const w = /\bwidth:\s*(\d+)/.exec(m[1])?.[1];
  const h = /\bheight:\s*(\d+)/.exec(m[1])?.[1];
  return w && h ? { w: Number(w), h: Number(h) } : null;
}

/** 자산 경로 문자열(브랜드 헬퍼의 `A('...')` 또는 require 리터럴) → 실제 파일 경로. */
function assetPath(rel: string): string | null {
  const p = join(ASSETS, rel);
  return existsSync(p) ? p : null;
}

export function scan(files: string[], assetMap: Map<string, string>): string[] {
  const bad: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // `<ExpoImage source={helper()} style={styles.X} contentFit="contain"` (속성 순서 무관)
    for (const m of src.matchAll(/<(?:ExpoImage|Image)\b([^>]*?)\/?>/gs)) {
      const tag = m[1];
      if (!/contentFit=["']contain["']/.test(tag)) continue;
      const styleName = /style=\{(?:\[)?styles\.(\w+)/.exec(tag)?.[1];
      if (!styleName) continue;
      const box = boxOf(src, styleName);
      if (!box) continue;
      // source={helper()} 또는 source={require('...')}
      const helper = /source=\{(\w+)\(\)\}/.exec(tag)?.[1];
      const req = /source=\{require\(['"]([^'"]+)['"]\)\}/.exec(tag)?.[1];
      let file: string | null = null;
      if (helper && assetMap.has(helper)) file = assetPath(assetMap.get(helper)!);
      else if (req) file = existsSync(req) ? req : null;
      if (!file) continue;
      const d = dims(file);
      if (!d) continue;
      const rBox = box.w / box.h, rImg = d.w / d.h;
      const skew = Math.max(rBox / rImg, rImg / rBox);
      if (skew >= MAX_SKEW) {
        const drawn = rImg > rBox
          ? { w: box.w, h: Math.round(box.w / rImg) }
          : { w: Math.round(box.h * rImg), h: box.h };
        bad.push(
          `${f}: \`styles.${styleName}\`(${box.w}×${box.h}) 에 ${file.split('/').pop()}(${d.w}×${d.h}) — ` +
          `비율이 ${skew.toFixed(1)}배 어긋나 실제로는 ${drawn.w}×${drawn.h} 로 그려집니다`,
        );
      }
    }
  }
  return bad;
}

/** 브랜드 헬퍼 이름 → 자산 상대경로. `brandAsset.ts` 에서 읽는다(사본을 만들지 않는다). */
function brandMap(): Map<string, string> {
  const out = new Map<string, string>();
  let src = '';
  try { src = readFileSync('app/src/lib/ui/brandAsset.ts', 'utf8'); } catch { return out; }
  const dir = /const BRAND_DIR = '([^']+)'/.exec(src)?.[1] ?? '';
  for (const m of src.matchAll(/export const (\w+) = \(\) => A\(`\$\{BRAND_DIR\}\/([\w.-]+)`\)/g)) {
    out.set(m[1], `${dir}/${m[2]}`);
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  // 자가테스트 — 실제 파일을 건드리지 않고 판정 로직만 본다
  console.log('🧪 check:imgratio 자가테스트');
  const box = { w: 108, h: 34 }, img = { w: 340, h: 470 };
  const skew = Math.max((box.w / box.h) / (img.w / img.h), (img.w / img.h) / (box.w / box.h));
  const drawnW = Math.round(box.h * (img.w / img.h));
  const ok1 = skew >= MAX_SKEW;                    // 사고 케이스는 잡혀야
  const ok2 = drawnW === 25;                        // 실제 그려지는 폭 계산이 맞아야
  const sq = Math.max((1 / 1) / (100 / 96), (100 / 96) / (1 / 1));
  const ok3 = sq < MAX_SKEW;                        // 살짝 다른 건 통과해야(오탐 방지)
  console.log(`  ${ok1 ? '✅' : '❌'} 108×34 박스 + 340×470 그림 → ${skew.toFixed(1)}배(기준 ${MAX_SKEW}) 잡힘`);
  console.log(`  ${ok2 ? '✅' : '❌'} 실제 그려지는 폭 ${drawnW}px 계산`);
  console.log(`  ${ok3 ? '✅' : '❌'} 100×96 박스 + 정사각 그림은 통과(오탐 없음)`);
  process.exit(ok1 && ok2 && ok3 ? 0 : 1);
}

const files = ROOTS.flatMap((r) => walk(r));
const bad = scan(files, brandMap());
console.log('\n🖼  check:imgratio — 고정 박스와 그림의 실제 비율\n');
if (bad.length) {
  for (const b of bad) console.log(`   ❌ ${b}`);
  console.log('\n  → 박스를 그림 비율에 맞추거나, 그 자리에 맞는 자산을 쓰세요.');
  console.log(`\n❌ check:imgratio 실패 — ${bad.length}건`);
  process.exit(1);
}
console.log('   ✅ contain 이미지의 박스 비율이 전부 자산과 맞습니다');
