// scripts/check-herosize.ts — 전폭 이미지가 데스크톱에서 화면을 통째로 먹지 않게
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (daniel 2026-08-17: *"웹에서 풀이쪽 배너가 너무 커"*)
//   전폭 히어로는 `width:'100%' + aspectRatio` 로 크기를 잡는다.
//   폰(390px)에선 알맞은데 데스크톱 본문 컬럼(1120px)에서는 **비율이 그대로 곱해진다**:
//     · 「다음 단계」 배너 `aspectRatio 1.6` → **700px**(화면 세로가 800px다) — 실측
//     · 풀이 본문 히어로 `1.75` → 544px
//     · 타로 카드 `0.58`(세로) → **1310px**
//   ⇒ **비율만으로 크기를 정하면 폭이 커질수록 세로가 폭주한다.** 폰만 보고 만들면 못 본다.
//
// 무엇을 지키나
//   H1. 상한값이 상식적인가 — `HERO_CAP` 을 **실행해서** 본다
//   H2. 전폭 비율 이미지를 가진 파일은 **상한 훅을 쓰는가**(`useHeroCap`/`usePortraitCap`)
//       — 새 히어로를 추가해도 이 규칙이 잡는다
//
// ★H2 는 '이름이 있는지'가 아니라 **그 파일에 전폭 비율 스타일이 실제로 있는지**로 판정한다.
// ★음성 테스트: `npx tsx scripts/check-herosize.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { HERO_CAP } from '../app/src/lib/ui/heroCaps';

const SCAN_DIRS = ['app/src/components', 'app/src/app', 'app/src/screens'];
const CAP_MODULE = 'app/src/lib/ui/heroSize.ts';

/**
 * 상한이 필요 없는 자리 — 이유를 함께 적는다(적지 못하면 면제하지 않는다).
 * key = 파일 경로 · why = 왜 안 커지는가
 */
const EXEMPT: Record<string, string> = {
  // 그리드 칸은 폭이 열 수에서 나오므로 컬럼이 넓어져도 칸은 안 커진다
  'app/src/components/ContentGrid.tsx': '카드 폭이 열 수에서 파생(cardW) — 전폭이 아니다',
  // 달력 칸(1/7 폭)·작은 옵션 버튼은 maxHeight 로 이미 묶여 있다
  'app/src/app/(app)/taegil.tsx': '달력 칸 = 폭의 1/7, 정사각 — 전폭이 아니다',
  'app/src/app/(app)/attach.tsx': '옵션 버튼 — maxHeight 44 로 이미 묶여 있다',
};

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석을 지운 '코드만'(스타일 리터럴은 남긴다 — 그게 검사 대상이다). */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * 한 줄이 **전폭 비율 박스**인지 — `width: '100%'` 와 `aspectRatio: <숫자>` 가 함께 있는가.
 * @returns 걸리면 그 줄의 비율값, 아니면 null
 */
export function fullWidthAspect(line: string): number | null {
  if (!/width:\s*['"]100%['"]/.test(line)) return null;
  const m = line.match(/aspectRatio:\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// ── H1. 상한값(실행) ────────────────────────────────────────────────────────
if (!(HERO_CAP.banner > 0 && HERO_CAP.banner <= 360)) {
  fail('H1', `HERO_CAP.banner = ${HERO_CAP.banner} — 유도 배너는 360px 이하여야 한다(화면을 먹으면 배너가 아니라 벽이다)`);
}
if (!(HERO_CAP.reading > HERO_CAP.banner && HERO_CAP.reading <= 480)) {
  fail('H1', `HERO_CAP.reading = ${HERO_CAP.reading} — 읽는 화면 히어로는 배너보다 크되 480px 이하여야 한다`);
}

// ── H2. 전폭 비율 이미지를 가진 파일은 상한 훅을 쓰는가 ──────────────────────
for (const file of SCAN_DIRS.flatMap((d) => walk(d))) {
  const norm = file.split(path.sep).join('/');
  if (norm === CAP_MODULE) continue;
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const hits: number[] = [];
  for (const line of code.split('\n')) {
    const r = fullWidthAspect(line);
    if (r != null) hits.push(r);
  }
  if (!hits.length) continue;
  if (EXEMPT[norm]) continue;
  if (/use(Hero|Portrait)Cap\s*\(/.test(code)) continue;   // 상한을 쓰고 있다
  fail('H2', `${norm} — 전폭 비율 박스(aspectRatio ${hits.join(', ')})가 상한 없이 있다.\n        데스크톱 컬럼(1120px)에서 ${hits.map((r) => Math.round(1120 / r)).join('px, ')}px 로 자란다 — \`useHeroCap\`/\`usePortraitCap\` 을 쓸 것`);
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'H2: 전폭+비율 줄을 문다', run: () => fullWidthAspect("  card: { width: '100%', aspectRatio: 1.6, borderRadius: 20 },") === 1.6 },
    { name: 'H2: 세로 비율도 문다', run: () => fullWidthAspect("  big: { width: '100%', aspectRatio: 0.58 },") === 0.58 },
    { name: 'H2: 폭이 고정이면 안 문다(오탐 없음)', run: () => fullWidthAspect("  card: { width: 168, aspectRatio: 0.72 },") === null },
    { name: 'H2: 비율이 없으면 안 문다(오탐 없음)', run: () => fullWidthAspect("  box: { width: '100%', height: 40 },") === null },
    { name: 'H2: 주석 속 예시는 안 문다', run: () => fullWidthAspect(stripComments("  // card: { width: '100%', aspectRatio: 1.6 },").trim()) === null },
    { name: 'H1: 배너 상한이 상식 범위', run: () => HERO_CAP.banner > 0 && HERO_CAP.banner <= 360 },
    { name: 'H1: 읽기 히어로가 배너보다 큼', run: () => HERO_CAP.reading > HERO_CAP.banner },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:herosize — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:herosize — 전폭 히어로 상한 (배너 ${HERO_CAP.banner}px · 읽기 ${HERO_CAP.reading}px)`);
