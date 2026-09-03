// scripts/check-crop.ts — 사진이 **칸에 맞게** 저장되는지 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31
//   *"내가 등록한 프로필 사진이 너무 확대돼서 나와 … 사진 축소 확대해서 그 칸에 맞춰두면
//     그대로 나와야해 배경사진도 동일"*)
//
// ■ 원인은 «고르는 화면» 과 «그리는 화면» 의 비율이 달랐던 것
//   ⚠️`expo-image-picker` 의 `allowsEditing` 은 **iOS 에서 언제나 정사각형**이다
//     (`aspect` 는 안드로이드 전용). 9:16 배경 칸에 정사각형이 들어가 가로가 잘리며 확대됐다.
//   ⇒ 자르기를 우리가 하고, **그리는 칸과 같은 비율**로 자른다.
//
// 무엇을 지키나
//   C1 원본 픽커(`pickImageUri`)가 `allowsEditing` 을 **끈다** — 켜면 iOS 가 정사각을 강제한다
//   C2 프로필 카드가 고른 사진을 **자르기 창으로 보낸다**(고르자마자 업로드하지 않는다)
//   C3 ★배경 자르기 비율이 **프로필 창이 그리는 비율과 같다**
//      — 이 저장소가 반복해서 데인 «두 곳이 서로를 모른다» 부류다. 어긋나면 또 잘린다
//   C4 최소 배율이 1 이상 — 그 아래면 칸에 **빈 곳**이 생긴다
//   C5 ★자르기 **셈 자체**를 숫자로 검증한다 — 틀려도 오류가 안 나는 곳이라 눈으로는 못 잡는다
//
// ★음성 테스트: `npx tsx scripts/check-crop.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { coverBase, panLimits, cropRect } from '../app/src/lib/media/cropMath';
import { join } from 'node:path';
import type { CropRect } from '../app/src/lib/media/cropMath';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
/** ★주석을 **같은 길이의 공백**으로 지운다 — 자리(indexOf 비교)가 안 흔들리게. */
export const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
   .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기 ──────────────────────────────────────────────────────────────────

/** `pickImageUri` 안에서 `allowsEditing` 이 꺼져 있는가. */
export function editingOff(src: string): boolean | null {
  const s = strip(src);
  const i = s.indexOf('export async function pickImageUri');
  if (i < 0) return null;                       // 함수가 없으면 단정하지 않는다
  const body = s.slice(i, i + 1200);
  const m = body.match(/allowsEditing\s*:\s*(true|false)/);
  return m ? m[1] === 'false' : null;
}

/**
 * 고른 사진이 **자르기 창을 거치는가**(바로 업로드하지 않는가).
 *
 * ★네 갈래(웹 프로필·웹 배경·폰 프로필·폰 배경)가 **전부** 한 자리로 모여야 한다.
 *   한 갈래만 빠져도 그 면에서만 옛 동작이 남는다.
 * ★2026-08-31 개정 — 자르기 창을 **화면 뿌리**로 올리면서 카드가 `<CropSheet/>` 를
 *   직접 그리지 않게 됐다. ⇒ «무엇을 부르는가» 로 본다(자리·이름이 아니라 뜻).
 *   ⚠️바로 올리는 길이 남아 있으면 그것도 잡는다 — 자르기를 건너뛰는 게 곧 이 버그다.
 */
export function goesThroughCrop(src: string): boolean {
  const s = strip(src);
  /**
   * ⚠️★**개수로 세지 않는다**(2026-09-03 규칙 수정).
   *   종전엔 «부르는 곳 4회» 를 요구했다. 그런데 폰 두 갈래를 **한 함수로 합치자**
   *   3회가 되어 멀쩡한 코드가 빨간불이 났다 — 규칙이 «구조» 가 아니라 «횟수» 를 본 탓이다.
   *   ⇒ 취지는 그대로다: **고른 사진은 반드시 자르기를 거친다.**
   *     ①`cropThenUpload` 를 실제로 부르는 곳이 **하나라도** 있고
   *     ②고른 것을 **그대로** 올리는 길이 **없어야** 한다(아래 검사가 진짜 자물쇠다).
   */
  if (!/cropThenUpload\s*\(/.test(s)) return false;
  // ★네 갈래(웹 프로필·웹 배경·폰 프로필·폰 배경)가 다 있는지는 **진입점**으로 본다.
  for (const entry of ['onPickWeb', 'onCoverFile', 'onPickNative', 'onPickCoverNative']) {
    if (!new RegExp(`\\b${entry}\\b`).test(s)) return false;
  }
  // ⚠️**고른 것을 그대로** 올리는 길이 남아 있나 — 그게 곧 «자르기를 건너뛴다» 는 뜻이다.
  //   `f`·`file` = 웹 파일 입력이 준 원본. 자른 뒤 바이트는 다른 이름으로 온다.
  //   ★들여쓰기·자리에 기대지 않는다(리팩터링에 눈이 머는 판정을 안 만든다).
  return !/upload(?:My)?(?:Avatar|Cover)\s*\(\s*(?:f|file)\s*\)/.test(s);
}


/** 배경 자르기 비율(가로/세로)을 읽는다. */
export function coverAspect(src: string): number | null {
  const m = strip(src).match(/COVER_ASPECT\s*=\s*(\d+)\s*\/\s*(\d+)/);
  return m ? Number(m[1]) / Number(m[2]) : null;
}

/** 설정 화면 **미리보기**가 배경을 그리는 비율. */
export function previewAspect(src: string): number | null {
  const m = strip(src).match(/cover\s*:\s*\{[^}]*aspectRatio\s*:\s*(\d+)\s*\/\s*(\d+)/);
  return m ? Number(m[1]) / Number(m[2]) : null;
}

/** 프로필 창이 배경을 그리는 비율을 읽는다. */
export function panelAspect(src: string): number | null {
  const m = strip(src).match(/VIDEO_RATIO\s*=\s*(\d+)\s*\/\s*(\d+)/);
  return m ? Number(m[1]) / Number(m[2]) : null;
}

/** 최소 배율이 1 이상인가. */
export function minScaleOk(src: string): boolean | null {
  const m = strip(src).match(/MIN_SCALE\s*=\s*([\d.]+)/);
  return m ? Number(m[1]) >= 1 : null;
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const PICK = 'app/src/lib/media/pickImage.ts';
  const CARD = 'app/src/components/settings/MyProfileCard.tsx';
  const SHEET = 'app/src/components/talk/ProfileSheet.tsx';
  const HOST = 'app/src/app/(app)/_layout.tsx';
  const CROP = 'app/src/components/media/CropSheet.tsx';

  const pick = read(PICK), card = read(CARD), sheet = read(SHEET), cropSrc = read(CROP);

  if (!pick) fail('C0', `${PICK} 를 못 읽었다`);
  else if (editingOff(pick) === false) {
    fail('C1', `${PICK} 의 \`pickImageUri\` 가 \`allowsEditing: true\` 다.\n        `
      + '⚠️iOS 의 그 편집기는 **언제나 정사각형**이라(`aspect` 는 안드로이드 전용)\n        '
      + '9:16 배경이 잘리며 확대된다 — Boss 가 지적한 «너무 확대돼서 나와» 가 그대로 돌아온다');
  }

  if (!card) fail('C0', `${CARD} 를 못 읽었다`);
  else if (!goesThroughCrop(card)) {
    fail('C2', `${CARD} 가 고른 사진을 **자르기 창으로 안 보낸다**.\n        `
      + '웹 2갈래(파일 입력) + 폰 2갈래(앨범) — **진입점 넷**이 다 있고 자르기를 거쳐야 한다.\n        '
      + '자르기를 건너뛰고 **고른 것을 그대로** 올리는 길이 남아 있어도 잡는다.\n        '
      + '★한 갈래만 빠져도 그 면에서만 옛 동작이 남는다 — 오늘 프로필 오버레이에서 겪은 그 부류다');
  }

  // C6 ★자르기 창은 **화면 뿌리**에서 그린다 — 카드 안이면 `absoluteFill` 이 부모를 채운다
  const host = read(HOST);
  if (!host) fail('C0', `${HOST} 를 못 읽었다`);
  else if (!/<CropHost\s*\/>/.test(strip(host))) {
    fail('C6', `${HOST} 가 \`<CropHost/>\` 를 안 그린다.\n        `
      + '⚠️카드 안에서 그리면 `absoluteFill` 이 **부모를 채워** 화면을 못 덮는다(2026-08-31 웹 실측:\n        '
      + '뒤 폼이 비치고 버튼이 칸 위에 겹쳤다). 폰은 더 나쁘다 — `settings` 뿌리가 `ScrollView` 라\n        '
      + '오버레이 높이가 **스크롤 전체 높이**가 된다(`check:overlayroot` 가 그때 생긴 규칙이다)');
  }
  if (card && /<CropSheet/.test(strip(card))) {
    fail('C6', `${CARD} 가 \`<CropSheet/>\` 를 **직접** 그린다 — 뿌리(\`CropHost\`)에 맡길 것`);
  }

  if (card && sheet) {
    const a = coverAspect(card), b = panelAspect(sheet);
    if (a === null) fail('C3', `${CARD} 에 \`COVER_ASPECT\` 가 없다 — 배경 자르기 비율을 못 읽는다`);
    else if (b === null) fail('C3', `${SHEET} 에 \`VIDEO_RATIO\` 가 없다 — 그리는 비율을 못 읽는다`);
    else if (Math.abs(a - b) > 0.001) {
      fail('C3', `배경 **자르는 비율 ${a.toFixed(4)}** ≠ **그리는 비율 ${b.toFixed(4)}**.\n        `
        + '★자른 대로 안 보인다 — 한쪽만 고치면 Boss 지적이 그대로 돌아온다.\n        '
        + `자르기 ${CARD} \`COVER_ASPECT\` · 그리기 ${SHEET} \`VIDEO_RATIO\``);
    }
  }

  // C3 ★설정 화면 **미리보기**도 같은 비율이어야 한다 — 자리가 셋이면 셋 다 봐야 한다
  if (card) {
    const a = coverAspect(card), p = previewAspect(card);
    if (a !== null && p === null) {
      fail('C3', `${CARD} 의 배경 **미리보기에 비율이 없다**(\`cover\` 스타일의 \`aspectRatio\`).\n        `
        + '⚠️고정 높이로 두면 9:16 그림이 **가운데 얇은 한 겹**으로만 보인다 —\n        '
        + '「맞춰 둔 것」과 「보이는 것」이 또 갈린다(Boss 2026-08-31 *"배경사진도 동일"*)');
    } else if (a !== null && p !== null && Math.abs(a - p) > 0.001) {
      fail('C3', `배경 **자르는 비율 ${a.toFixed(4)}** ≠ **미리보기 비율 ${p.toFixed(4)}** (${CARD}).\n        `
        + '★자리가 셋이다: 자르기 · 프로필 창 · 설정 미리보기. 셋이 같아야 한다');
    }
  }

  if (!cropSrc) fail('C0', `${CROP} 를 못 읽었다`);
  else if (minScaleOk(cropSrc) === false) {
    fail('C4', `${CROP} 의 \`MIN_SCALE\` 이 1 보다 작다 — 칸에 **빈 곳**이 생긴다`);
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  // ★진입점 넷 + 자르기 경유 — **횟수가 아니라 구조**다(2026-09-03 규칙 수정)
  const cardOK = 'const COVER_ASPECT = 9 / 16;\n'
    + 'const cropThenUpload = async (u, k) => { await uploadMyAvatar(img); };\n'
    + 'const onPickWeb = () => {}; const onCoverFile = () => {};\n'
    + 'const onPickNative = () => { cropThenUpload(a,"avatar"); };\n'
    + 'const onPickCoverNative = () => { cropThenUpload(b,"cover"); };';
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'C1 allowsEditing: false 면 통과',
      run: () => editingOff(`export async function pickImageUri() {\n allowsEditing: false,\n}`) === true },
    { name: 'C1 allowsEditing: true 면 문다',
      run: () => editingOff(`export async function pickImageUri() {\n allowsEditing: true,\n}`) === false },
    { name: 'C1 다른 함수의 true 에 안 속는다',
      run: () => editingOff(`export async function pickImage() { allowsEditing: true }\n`
        + `export async function pickImageUri() {\n allowsEditing: false,\n}`) === true },
    { name: 'C1 함수가 없으면 단정하지 않는다', run: () => editingOff('const a = 1;') === null },
    { name: 'C2 진입점 넷 + 자르기면 통과', run: () => goesThroughCrop(cardOK) === true },
    { name: 'C2 ★진입점 하나가 빠지면 문다',
      run: () => goesThroughCrop(cardOK.replace('const onPickCoverNative = () => { cropThenUpload(b,"cover"); };', '')) === false },
    { name: 'C2 ★자르기를 아예 안 부르면 문다',
      run: () => goesThroughCrop(cardOK.replace(/cropThenUpload\([^)]*\);/g, '')) === false },
    { name: 'C2 ★두 갈래를 한 함수로 합쳐도 통과(횟수로 안 센다)',
      run: () => goesThroughCrop('const COVER_ASPECT = 9 / 16;\nconst cropThenUpload = async (u,k)=>{};\n'
        + 'const pick = (k) => cropThenUpload(u, k);\n'
        + 'const onPickWeb=()=>{}; const onCoverFile=()=>{}; const onPickNative=()=>pick("avatar"); const onPickCoverNative=()=>pick("cover");') === true },
    { name: 'C2 ★고른 것을 그대로 올리는 길이 남으면 문다(자르기 건너뜀)',
      run: () => goesThroughCrop(`${cardOK}\nconst onFile = async (f) => { await uploadMyCover(f); };`) === false },
    { name: 'C2 자른 바이트를 올리는 것은 정상',
      run: () => goesThroughCrop(`${cardOK}\nconst ok = await uploadMyCover(cropped);`) === true },
    { name: 'C3 두 비율이 같으면 통과',
      run: () => coverAspect(cardOK) === panelAspect('const VIDEO_RATIO = 9 / 16;') },
    { name: 'C3 비율이 어긋나면 잡힌다',
      run: () => Math.abs((coverAspect('const COVER_ASPECT = 3 / 4;') ?? 0)
                        - (panelAspect('const VIDEO_RATIO = 9 / 16;') ?? 0)) > 0.001 },
    { name: 'C6 뿌리가 <CropHost/> 를 그리면 통과',
      run: () => /<CropHost\s*\/>/.test(strip('<BottomNav />\n<CropHost />\n</View>')) === true },
    { name: 'C6 안 그리면 문다',
      run: () => /<CropHost\s*\/>/.test(strip('<BottomNav />\n</View>')) === false },
    { name: 'C6 주석 속 <CropHost/> 에 안 속는다',
      run: () => /<CropHost\s*\/>/.test(strip('// <CropHost />\nconst a=1;')) === false },
    { name: 'C6 카드가 <CropSheet/> 를 직접 그리면 문다',
      run: () => /<CropSheet/.test(strip('<CropSheet uri={u} />')) === true },
    { name: 'C3 미리보기 비율을 읽는다',
      run: () => previewAspect(`  cover: { width: 96, aspectRatio: 9 / 16, borderRadius: 8 },`) === 9 / 16 },
    { name: 'C3 미리보기가 고정 높이면 못 읽는다(=문다)',
      run: () => previewAspect(`  cover: { height: 110, borderRadius: 8 },`) === null },
    { name: 'C3 미리보기가 다른 비율이면 갈린다',
      run: () => Math.abs((previewAspect(`  cover: { aspectRatio: 3 / 4 },`) ?? 0) - 9 / 16) > 0.001 },
    { name: 'C4 MIN_SCALE 1 이면 통과', run: () => minScaleOk('const MIN_SCALE = 1;') === true },
    { name: 'C4 MIN_SCALE 0.5 면 문다', run: () => minScaleOk('const MIN_SCALE = 0.5;') === false },
    { name: '주석 속 코드에 안 속는다',
      run: () => goesThroughCrop(cardOK.split('\n').map((l) => `// ${l}`).join('\n')) === false },
    { name: '주석을 지워도 **자리**가 안 밀린다',
      run: () => { const s = strip('AB/* xx */CD'); return s.length === 'AB/* xx */CD'.length; } },
  ];
  // ── C5 셈 검증 — 손으로 푼 답과 맞춰 본다 ──────────────────────────────
  /** 2000×1000 가로 사진을 300×300(1:1) 칸에: base = max(300/2000, 300/1000) = 0.3 */
  const wide = { iw: 2000, ih: 1000, fw: 300, fh: 300, base: 0.3, scale: 1 };
  /** 1000×1000 을 300×300 칸에: base = 0.3, 원본이 꼭 맞는다 */
  const square = { iw: 1000, ih: 1000, fw: 300, fh: 300, base: 0.3, scale: 1 };
  const eq = (a: CropRect, b: CropRect) =>
    a.originX === b.originX && a.originY === b.originY && a.width === b.width && a.height === b.height;

  cases.push(
    { name: 'C5 base 는 cover 규칙(둘 중 큰 쪽)', run: () => coverBase(2000, 1000, 300, 300) === 0.3 },
    { name: 'C5 세로로 긴 사진도 큰 쪽', run: () => coverBase(1000, 4000, 300, 300) === 0.3 },
    { name: 'C5 정사각이 꼭 맞으면 원본 전체',
      run: () => eq(cropRect({ ...square, tx: 0, ty: 0 }), { originX: 0, originY: 0, width: 1000, height: 1000 }) },
    { name: 'C5 가로 사진 가운데 = 좌우가 똑같이 잘린다',
      run: () => eq(cropRect({ ...wide, tx: 0, ty: 0 }), { originX: 500, originY: 0, width: 1000, height: 1000 }) },
    { name: 'C5 왼쪽 끝까지 끌면 originX = 0',
      run: () => eq(cropRect({ ...wide, tx: panLimits(wide).maxX, ty: 0 }),
                    { originX: 0, originY: 0, width: 1000, height: 1000 }) },
    { name: 'C5 오른쪽 끝까지 끌면 원본 오른쪽에 붙는다',
      run: () => { const r = cropRect({ ...wide, tx: -panLimits(wide).maxX, ty: 0 });
                   return r.originX + r.width === 2000; } },
    { name: 'C5 2배 키우면 자르는 폭이 절반',
      run: () => cropRect({ ...wide, scale: 2, tx: 0, ty: 0 }).width === 500 },
    { name: 'C5 키워도 가운데는 가운데',
      run: () => { const r = cropRect({ ...wide, scale: 2, tx: 0, ty: 0 });
                   return r.originX + r.width / 2 === 1000; } },
    { name: 'C5 ★한계 밖으로 끌어도 원본을 안 벗어난다',
      run: () => { const r = cropRect({ ...wide, tx: 99999, ty: -99999 });
                   return r.originX >= 0 && r.originY >= 0
                       && r.originX + r.width <= 2000 && r.originY + r.height <= 1000; } },
    { name: 'C5 세로 칸(9:16)에 가로 사진 — 세로를 꽉 채운다',
      run: () => { const b = coverBase(2000, 1000, 300, 533);
                   const r = cropRect({ iw: 2000, ih: 1000, fw: 300, fh: 533, base: b, scale: 1, tx: 0, ty: 0 });
                   return r.height === 1000 && r.width < 700; } },
    { name: 'C5 크기를 모르면(0) 조용히 0 — 던지지 않는다',
      run: () => cropRect({ iw: 0, ih: 0, fw: 300, fh: 300, base: 1, scale: 1, tx: 0, ty: 0 }).width === 0 },
    { name: 'C5 한계는 칸보다 작은 사진에서 0(음수가 아니다)',
      run: () => panLimits({ iw: 100, ih: 100, fw: 300, fh: 300, base: 1, scale: 1 }).maxX === 0 },
  );

  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:crop — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:crop — 사진이 그리는 칸과 같은 비율로 잘려 저장된다');
