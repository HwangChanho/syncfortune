// scripts/check-personalcolor.ts — 한봄의 **퍼스널 컬러 규칙**을 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01 *"한봄한테 학습시켜"* — 규칙 전문은 Boss 가 적었다(★받아적은 것).
//
// ■ ★★왜 하네스가 필요한가 — **두 가지가 조용히 깨진다**
//   ①판정이 **말로** 새어 나가면 실행마다 갈린다 ⇒ 엔진(`personalColor`)이 정한다.
//   ②재료를 주면 **사주로 답한다.** 자미(08-27)·나비(08-28)에서 두 번 겪었고,
//     Boss 는 한봄에게 *"사주 용어에 대한 언급은 하지말아야한다"* 고 못 박았다.
//     ⇒ 한봄에게는 원국 대신 **결론 한 줄**만 준다. 그 배선이 깨지면 여기서 문다.
//
// ■ ★사본이 둘이다(앱 · Edge) — `supabase/` 가 gitignore 라 하나로 못 둔다.
//   ⇒ **첫 줄(경로)만 빼고 바이트가 같아야 한다.** 갈리면 문다.
//
// 무엇을 지키나
//   C1 월지 열둘이 **웜/쿨로 빠짐없이** 갈린다(하나라도 빠지면 그 달 태생이 판정 불가)
//   C2 목화↔금수 갈래가 Boss 문면대로다(웜: 봄/가을 · 쿨: 여름/겨울)
//   C3 정반대는 **같은 계열 안**이다(웜↔웜 · 쿨↔쿨)
//   C4 土 는 **어느 쪽도 아니다**
//   C5 시각 미상이면 **시주를 뺀다**(유령 子시가 결론을 뒤집는다)
//   C6 앱·Edge 두 사본이 **같다**
//   C7 Edge 가 색 담당에게 **사주 블록을 안 준다**(대체한다)
//
// ★음성 테스트: `npx tsx scripts/check-personalcolor.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { personalColor, WARM_BRANCHES, COOL_BRANCHES, OPPOSITE } from '../app/src/lib/color/personalColor';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

const P = (n: number, el: string) => Array.from({ length: n }, () => ({ stem: el, branch: el }));

function run() {
  // C1 열두 지지가 빠짐없이 갈린다
  const ALL = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const covered = new Set([...WARM_BRANCHES, ...COOL_BRANCHES]);
  const missing = ALL.filter((b) => !covered.has(b as any));
  if (missing.length) {
    fail('C1', `월지 ${missing.join('·')} 가 **어느 쪽에도 없다** — 그 달에 태어난 사람은 판정이 안 된다`);
  }
  if (WARM_BRANCHES.length + COOL_BRANCHES.length !== 12) {
    fail('C1', `웜 ${WARM_BRANCHES.length} + 쿨 ${COOL_BRANCHES.length} = 12 가 아니다(겹치거나 빠졌다)`);
  }

  // C2 갈래
  const warmGrowth = personalColor('午', P(4, '木'));
  const warmHarvest = personalColor('午', P(4, '金'));
  const coolGrowth = personalColor('子', P(4, '木'));
  const coolHarvest = personalColor('子', P(4, '金'));
  if (warmGrowth?.tone !== '봄 웜톤') fail('C2', `웜 + 목화 → 봄 웜톤이어야 하는데 ${warmGrowth?.tone}`);
  if (warmHarvest?.tone !== '가을 웜톤') fail('C2', `웜 + 금수 → 가을 웜톤이어야 하는데 ${warmHarvest?.tone}`);
  if (coolGrowth?.tone !== '여름 쿨톤') fail('C2', `쿨 + 목화 → 여름 쿨톤이어야 하는데 ${coolGrowth?.tone}`);
  if (coolHarvest?.tone !== '겨울 쿨톤') fail('C2', `쿨 + 금수 → 겨울 쿨톤이어야 하는데 ${coolHarvest?.tone}`);

  // C3 정반대는 같은 계열
  for (const [a, b] of Object.entries(OPPOSITE)) {
    const same = (a.includes('웜') && b.includes('웜')) || (a.includes('쿨') && b.includes('쿨'));
    if (!same) fail('C3', `${a} 의 정반대가 ${b} 다 — **계열을 가로질렀다**(Boss 문면은 계열 안이다)`);
    if (OPPOSITE[b as keyof typeof OPPOSITE] !== a) fail('C3', `${a}↔${b} 가 서로를 안 가리킨다`);
  }

  // C4 土 는 안 센다
  const soil = personalColor('午', [{ stem: '土', branch: '土' }, { stem: '木', branch: '木' }, { stem: '土', branch: '土' }]);
  if (!soil || soil.growth !== 2 || soil.harvest !== 0) {
    fail('C4', `土 를 세고 있다 — 목화 ${soil?.growth} · 금수 ${soil?.harvest} (기대: 2 · 0).\n        `
      + 'Boss 문면은 «목화» 와 «금수» 뿐이다. 土 를 한쪽에 붙이면 그건 내가 만든 규칙이 된다');
  }

  // C5 시각 미상이면 시주를 뺀다 — 가짜 시주가 결론을 뒤집는 예
  const four = [{ stem: '木', branch: '木' }, { stem: '木', branch: '木' }, { stem: '金', branch: '金' }, { stem: '金', branch: '金' }];
  const known = personalColor('午', four, false);
  const unknown = personalColor('午', four, true);
  if (known?.growth !== 4 || known?.harvest !== 4) fail('C5', '네 기둥을 다 세지 않았다');
  if (unknown?.growth !== 4 || unknown?.harvest !== 2) {
    fail('C5', `시각 미상인데 **시주를 세고 있다** — 목화 ${unknown?.growth} · 금수 ${unknown?.harvest} (기대: 4 · 2).\n        `
      + '⚠️시각을 모르면 엔진이 유령 子시를 만든다(`spec/chart.ts` §timeUnknown).\n        '
      + '그 가짜 두 글자가 **봄↔가을을 뒤집을 수 있다**');
  }
  if (!known?.tie) fail('C5', '목화 = 금수 인데 `tie` 가 안 섰다 — 되물어 좁혀야 하는 자리다');

  // C6 두 사본이 같은가
  const a = 'app/src/lib/color/personalColor.ts';
  const b = 'supabase/functions/_shared/personalColor.ts';
  if (!existsSync(b)) console.log('⏭  C6 건너뜀 — `supabase/` 가 없다(gitignore). **못 쟀다**');
  else {
    const strip = (p: string) => readFileSync(p, 'utf8').split('\n').slice(1).join('\n');
    if (strip(a) !== strip(b)) {
      fail('C6', '앱과 Edge 의 판정 파일이 **갈렸다**.\n        '
        + '★첫 줄(경로)만 다르고 나머지는 바이트가 같아야 한다 — 갈리면 화면과 대화가 다른 톤을 말한다');
    }
  }

  // C7 Edge 가 색 담당에게 사주를 안 준다
  const t = 'supabase/functions/talk/index.ts';
  if (!existsSync(t)) console.log('⏭  C7 건너뜀 — `supabase/` 가 없다. **못 쟀다**');
  else {
    const src = readFileSync(t, 'utf8');
    if (!/spec\.includes\('color'\)/.test(src) || !/chartBlock\s*=\s*cb\s*\|\|/.test(src)) {
      fail('C7', '색 담당에게 차트 블록을 **대체해 주는 배선이 없다**.\n        '
        + '⚠️«사주 블록에 색 블록을 더한다» 면 재료가 남고 — **재료가 남으면 쓴다**\n        '
        + '(자미 08-27 · 나비 08-28 에서 두 번 겪었다)');
    }
    if (!/isColorReader\s*&&\s*!chartRow/.test(src)) {
      fail('C7', '차트가 **아예 없을 때** 색 담당이 되묻게 하는 배선이 없다.\n        '
        + '⚠️일반 지문(「차트 없이 일반적으로 답한다」)이 남으면 **눈대중으로 톤을 단정한다**');
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    { name: 'C2 웜+목화 = 봄웜', run: () => personalColor('卯', P(4, '木'))?.tone === '봄 웜톤' },
    { name: 'C2 웜+금수 = 가을웜', run: () => personalColor('申', P(4, '水'))?.tone === '가을 웜톤' },
    { name: 'C2 쿨+목화 = 여름쿨', run: () => personalColor('亥', P(4, '火'))?.tone === '여름 쿨톤' },
    { name: 'C2 쿨+금수 = 겨울쿨', run: () => personalColor('丑', P(4, '金'))?.tone === '겨울 쿨톤' },
    { name: 'C1 ★모르는 글자는 null(지어내지 않는다)', run: () => personalColor('X', P(4, '木')) === null },
    { name: 'C3 봄웜의 반대는 가을웜', run: () => personalColor('卯', P(4, '木'))?.opposite === '가을 웜톤' },
    { name: 'C3 겨울쿨의 반대는 여름쿨', run: () => personalColor('子', P(4, '金'))?.opposite === '여름 쿨톤' },
    { name: 'C4 ★土 만 있으면 둘 다 0', run: () => { const v = personalColor('午', P(4, '土')); return v?.growth === 0 && v?.harvest === 0; } },
    { name: 'C5 ★동수면 tie 가 선다', run: () => personalColor('午', [{ stem: '木', branch: '金' }])?.tie === true },
    { name: 'C5 ★시각 미상이면 세 기둥만', run: () => personalColor('午', P(4, '木'), true)?.growth === 6 },
    { name: 'C5 시각 알면 네 기둥', run: () => personalColor('午', P(4, '木'), false)?.growth === 8 },
    { name: '계열 표시가 맞다', run: () => personalColor('子', P(4, '木'))?.family === '쿨톤' },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:personalcolor — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:personalcolor — 톤은 엔진이 정하고, 한봄에게 사주 재료가 안 간다');
}
