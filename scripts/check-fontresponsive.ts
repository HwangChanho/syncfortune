// scripts/check-fontresponsive.ts — 글자 배율이 뷰포트에 반응하되, **글자와 상자가 같이** 움직인다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (daniel 2026-08-17)
//   ① *"홈에 바이오리듬도 퍼센트가 다음라인으로 넘어가"*
//      원인: 값 칸이 **고정 폭(52px)** 인데 글자는 전역 패치가 배율만큼 키운다 →
//      글자만 커져 넘쳤다(실측: 「감정 -43%」만 두 줄, 높이 54px).
//   ② *"반응형은 브라우저의 확대 축소 사이즈에 따라서 글씨크기를 바꿔서 반응하게 해야지"*
//      → 폭에서 보정치를 뽑아 설정 배율에 곱한다(`webFontFactor`).
//
// 무엇을 지키나
//   F1. 보정 곡선을 **실행해서** 본다 — 폰 폭은 1(앱과 동일) · 최대 1(넓다고 키우지 않는다) · 단조 증가
//   F2. 네이티브는 항상 1 — 앱은 한 픽셀도 안 바뀐다(daniel *"앱도 병행할꺼야"*)
//   F3. 보정이 **글자와 상자 양쪽에** 적용된다 — 전역 패치가 읽는 값과 context 의 값이 같은 식이어야 한다.
//       한쪽만 넣으면 ①번 증상(글자만 커지고 상자는 그대로)이 그대로 재현된다.
//   F4. 설정 화면은 **사용자가 고른 값**(rawScale)으로 단계를 판정한다 — 보정된 값으로 보면 아무 단계도 안 켜진다.
//
// ★음성 테스트: `npx tsx scripts/check-fontresponsive.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import { webFontFactor, PHONE_MAX, NARROW_W, WIDE_W } from '../app/src/lib/ui/webFontFactor';

const PROVIDER = 'app/src/lib/ui/fontScale.tsx';
const SETTINGS = 'app/src/app/(app)/settings.tsx';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
/** 주석을 지운 '코드만'. */
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

// ── F1. 곡선(실행) ──────────────────────────────────────────────────────────
{
  const phone = webFontFactor(390, true);
  if (phone !== 1) fail('F1', `폰 폭(390)의 보정치가 ${phone} — 폰 웹은 앱과 같아야 하므로 1 이어야 한다`);

  const widths = [NARROW_W, 1100, 1300, WIDE_W, 2400];
  const vals = widths.map((w) => webFontFactor(w, true));
  if (Math.max(...vals) > 1) fail('F1', `보정치가 1을 넘는다(${Math.max(...vals)}) — 넓다고 글자를 키우면 넘침만 늘어난다`);
  if (Math.min(...vals) < 0.8) fail('F1', `보정치가 너무 작다(${Math.min(...vals)}) — 0.8 미만은 읽기 어렵다`);
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] < vals[i - 1]) fail('F1', `곡선이 단조 증가가 아니다: ${widths[i - 1]}→${vals[i - 1]}, ${widths[i]}→${vals[i]}`);
  }
  if (!(PHONE_MAX <= NARROW_W)) fail('F1', `PHONE_MAX(${PHONE_MAX}) 가 NARROW_W(${NARROW_W}) 보다 크다 — 구간이 겹친다`);
}

// ── F2. 네이티브 불변 ───────────────────────────────────────────────────────
for (const w of [390, 900, 1710]) {
  if (webFontFactor(w, false) !== 1) fail('F2', `네이티브 보정치가 1이 아니다(width=${w}) — 앱 화면이 바뀐다`);
}

// ── F3. 글자·상자 양쪽 적용 ─────────────────────────────────────────────────
{
  const raw = read(PROVIDER);
  if (raw == null) fail('F3', `${PROVIDER} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`);
  else {
    const code = codeOnly(raw);
    if (!/webFontFactor\s*\(/.test(code)) {
      fail('F3', `${PROVIDER} — 폭 보정을 쓰지 않는다. 글자 크기가 창 크기에 반응하지 않는다`);
    }
    // 전역 Text 패치가 읽는 값(currentScale)에 보정이 들어갔는가
    if (!/currentScale\s*=\s*effective/.test(code)) {
      fail('F3', `${PROVIDER} — 전역 패치가 읽는 \`currentScale\` 에 보정된 값이 안 들어간다(글자가 안 따라온다)`);
    }
    // context(=ls 가 쓰는 값)에도 보정이 들어갔는가
    if (!/scale:\s*effective/.test(code)) {
      fail('F3', `${PROVIDER} — context 에 보정 안 된 값을 내려보낸다. \`ls()\`(상자)가 글자를 못 따라가 **넘친다**`);
    }
    if (!/rawScale/.test(code)) {
      fail('F3', `${PROVIDER} — 사용자가 고른 원본(rawScale)을 안 내려보낸다. 설정 화면이 단계를 판정하지 못한다`);
    }
  }
}

// ── F4. 설정 화면 ───────────────────────────────────────────────────────────
{
  const raw = read(SETTINGS);
  if (raw == null) fail('F4', `${SETTINGS} 이 없다`);
  else {
    const code = codeOnly(raw);
    if (/Math\.abs\(scale\s*-/.test(code)) {
      fail('F4', `${SETTINGS} — 보정된 \`scale\` 로 단계를 판정한다. \`rawScale\` 이어야 한다(아무 단계도 안 켜진다)`);
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'F1: 폰 폭은 보정 없음(=1)', run: () => webFontFactor(390, true) === 1 },
    { name: 'F1: 좁은 데스크톱은 줄어든다', run: () => webFontFactor(1000, true) < 1 },
    { name: 'F1: 넓어도 1을 안 넘는다', run: () => webFontFactor(4000, true) <= 1 },
    { name: 'F1: 폭이 커질수록 커진다(단조)', run: () => webFontFactor(1100, true) <= webFontFactor(1400, true) },
    { name: 'F2: 네이티브는 항상 1', run: () => webFontFactor(1710, false) === 1 },
    { name: 'F1: 이상한 입력에도 1', run: () => webFontFactor(NaN, true) === 1 && webFontFactor(0, true) === 1 },
    { name: 'F3: currentScale 미반영을 문다', run: () => !/currentScale\s*=\s*effective/.test('currentScale = scale;') },
    { name: 'F3: context 미반영을 문다', run: () => !/scale:\s*effective/.test('value={{ scale, setScale }}') },
    { name: 'F4: scale 로 판정하면 문다', run: () => /Math\.abs\(scale\s*-/.test('const on = Math.abs(scale - s.scale) < 0.001;') },
    { name: 'F4: rawScale 로 판정하면 통과', run: () => !/Math\.abs\(scale\s*-/.test('const on = Math.abs(rawScale - s.scale) < 0.001;') },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:fontresponsive — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:fontresponsive — 폭 보정(${webFontFactor(NARROW_W, true)}~${webFontFactor(WIDE_W, true)}) · 글자와 상자가 함께 · 네이티브 불변`);
