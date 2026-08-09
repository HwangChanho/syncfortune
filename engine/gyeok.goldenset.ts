// engine/gyeok.goldenset.ts — 격국 판정 골든셋
// ─────────────────────────────────────────────────────────────────────────
// ★이 파일이 격국 stance 의 **정본**이다. 코드가 바뀌어도 여기서 막힌다.
//
// ■ 현행 stance (2026-08-10) — 상담가 판정 `verify-000c-structure#11`(O) · **daniel 승인(R55 교체)**
//   *"월지가 **생지(寅申巳亥)** 인 경우 지장간 **중기나 정기가 투간되어야** 격이다(여기는 격으로 잡지 않는다).*
//    ***왕지(子午卯酉)** 가 월지면 **월지가 격**이고, **고지(辰戌丑未)** 가 월지면 지장간 **정기만** 격으로 잡는다."*
//   ⇒ 격은 **서거나(◯◯격) 서지 않는다(격 없음)**. **'국' 접미는 폐기**됐다.
//   ⇒ 생지에서는 **본기가 아닌 십신이 격이 될 수 있다**(중기가 투간한 경우) — 이게 R55 와 가장 크게 갈리는 지점.
//
// ■ 그대로 유지되는 축 (daniel stance 2026-07-18 — 격의 '이름'만 정한다)
//   · **비견** → 건록 (양·음 공통 — 록은 음간에도 있다)
//   · **겁재** → 양일간은 **양인** / 음일간은 **겁재** (음간엔 양인이 없다)
//   · 십신 + 일간 음양으로만 판정한다(12운성 록지 조건을 걸지 않는다).
//   · 성격(成格)·파격은 **판정하지 않는다**(명리 발명 금지).
//
// ■ 폐기된 stance (되살아나면 아래 불변식이 잡는다)
//   ① 07-28 '투간 우선' → ② 08-01 '월지 본기 고정 + 투간=격/미투간=국'(R55) → ③ 현행.
//   ②의 '◯◯국' 이름이 다시 나오면 **불변식 B 가 실패**한다.
//
// ★음양 표는 saju.ts 의 STEM_YANG 를 쓴다(표를 새로 만들면 발명·드리프트).
//
// 실행: npm run check:gyeok
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from './saju';
import { detectPattern } from './structure';
import type { ChartInput } from '../spec/chart';

type Case = { label: string; birth: string; sex: '남' | '여'; expectName: string; expectBasis?: RegExp };

const build = (birth: string, sex: '남' | '여') =>
  buildSajuChart({ birthDateTime: birth, calendar: '양', timeAccuracy: '정확', sex, birthPlace: '서울' } as ChartInput, 2026);

const CASES: Case[] = [
  // ── ① 생지(寅申巳亥) — 중기나 정기가 투간해야 격이 선다 ───────────────────
  {
    label: '생지 · 정기(본기)가 투간 → 본기 십신으로 격',
    birth: '1986-05-08 10:00', sex: '남',
    expectName: '편재격',
    expectBasis: /월지 巳\(생지\).*→ 편재격 · 생지 — 정기가 투간/,
  },
  {
    // ★★R55 와 가장 크게 갈리는 케이스 — 본기(상관)가 아니라 **중기(정재)**가 격이 된다.
    //   구 R55 라면 '상관국'이었다.
    label: '생지 · 정기 잠복 + **중기 투간** → 중기 십신이 격이 된다(본기 아님)',
    birth: '1986-02-08 10:00', sex: '남',
    expectName: '정재격',
    expectBasis: /월지 寅\(생지\) 본기 甲\(상관\) → 정재격 · 생지 — 중기가 투간/,
  },
  {
    // '여기(餘氣)는 격으로 잡지 않는다' — 여기만 떴으면 격이 없다.
    label: '생지 · 여기만 투간 → **격 없음**(억지로 본기로 세우지 않는다)',
    birth: '1985-02-08 10:00', sex: '남',
    expectName: '격 없음',
    expectBasis: /월지 寅\(생지\).*격 없음.*여기는 격으로 안 잡는다/,
  },

  // ── ② 왕지(子午卯酉) — 월지가 곧 격. 투간을 보지 않는다 ────────────────────
  {
    label: '왕지 · **미투간이어도** 월지가 곧 격',
    birth: '1985-01-03 10:00', sex: '남',
    expectName: '양인격',
    expectBasis: /월지 子\(왕지\) 본기 癸\(겁재\) · 일간 壬\(양\) → 양인격 · 왕지라 월지가 곧 격\(투간 무관\)/,
  },
  {
    label: '왕지 · 투간한 경우도 같은 격(투간이 격을 바꾸지 않는다)',
    birth: '1985-03-08 10:00', sex: '남',
    expectName: '정인격',
    expectBasis: /월지 卯\(왕지\).*→ 정인격 · 왕지라 월지가 곧 격/,
  },

  // ── ③ 고지(辰戌丑未) — 정기만 격. 중기·여기는 투간해도 안 본다 ─────────────
  {
    label: '고지 · 정기 투간 + 중기도 투간 → **정기로만** 격',
    birth: '1985-08-03 10:00', sex: '남',
    expectName: '정재격',
    expectBasis: /월지 未\(고지\) 본기 己\(정재\) → 정재격 · 고지라 정기만 격\(중기·여기는 안 본다\)/,
  },
  {
    label: '고지 · 아무것도 미투간이어도 정기로 격이 선다',
    birth: '1985-01-08 10:00', sex: '남',
    expectName: '식신격',
    expectBasis: /월지 丑\(고지\).*→ 식신격 · 고지라 정기만 격/,
  },

  // ── ④ 비겁 이름 규칙(daniel stance — 유지) ────────────────────────────────
  {
    label: '음일간(丁) 겁재 → 겁재격 (음간엔 양인이 없다)',
    birth: '1986-05-13 10:00', sex: '남',
    expectName: '겁재격',
    expectBasis: /본기 丙\(겁재\) · 일간 丁\(음\) → 겁재격/,
  },
  {
    label: '양일간(丙) 중기 丙이 격 → 비견이므로 **건록**',
    birth: '1986-03-03 10:00', sex: '남',
    expectName: '건록격',
    expectBasis: /일간 丙\(양\) → 건록격 · 생지 — 중기가 투간/,
  },
];

let pass = 0, fail = 0;
console.log('\n🔎 격국 골든셋 (상담가 판정 2026-08-03 · daniel 승인 08-10)\n');

for (const c of CASES) {
  const pt = detectPattern(build(c.birth, c.sex));
  const nameOk = !c.expectName || pt.name === c.expectName;
  const basisOk = !c.expectBasis || c.expectBasis.test(pt.basis);
  if (nameOk && basisOk) { pass++; console.log(`  ✓ ${c.label}\n      → ${pt.name} · ${pt.basis}`); }
  else {
    fail++;
    console.error(`  ✗ ${c.label}`);
    if (!nameOk) console.error(`      이름: ${pt.name}(기대 ${c.expectName})`);
    if (!basisOk) console.error(`      근거가 규칙과 안 맞음: ${pt.basis}`);
  }
}

// ── ⑤ 격의 복수 성립 (`verify-000c-structure#6` · O) — verify-110 실물 재현 ──────────
//   상담가: *"해중 갑목이 투간되어 있어서 **편관격**도 가능하고, **무계합으로 정재격**도 가능하다."*
//   명식 戊午 癸亥 戊戌 甲寅 — 亥(생지) 중기 甲 투간 → 편관격 / 일간 戊가 월간 癸(정재)와 합 → 정재격 후보.
//   ★주 판정(name)은 투간 쪽으로 두고, 합으로 서는 격은 **동급 후보**(candidates)로만 얹는다 —
//     어느 쪽이 주(主)인지는 판정에 없어서 순위를 만들지 않았다(발명 금지).
console.log('\n[복수 성립] verify-110 재현 — 투간으로 서는 격 + 합으로 서는 격');
{
  const s = {
    pillars: {
      '년': { position: '년', stem: '戊', branch: '午', stemTenGod: '비견', branchMainTenGod: '정인', hiddenStems: [], isRoot: false },
      '월': {
        position: '월', stem: '癸', branch: '亥', stemTenGod: '정재', branchMainTenGod: '편재',
        hiddenStems: [{ stem: '壬', role: '본기', tenGod: '편재' }, { stem: '甲', role: '중기', tenGod: '편관' }, { stem: '戊', role: '여기', tenGod: '비견' }],
        isRoot: false,
      },
      '일': { position: '일', stem: '戊', branch: '戌', stemTenGod: '비견', branchMainTenGod: '비견', hiddenStems: [], isRoot: true },
      '시': { position: '시', stem: '甲', branch: '寅', stemTenGod: '편관', branchMainTenGod: '편관', hiddenStems: [], isRoot: false },
    },
    dayMaster: { stem: '戊', element: '土' }, interactions: [], luckCycles: [], currentLuck: {}, annual: {},
  } as unknown as Parameters<typeof detectPattern>[0];
  const pt = detectPattern(s);
  const ok1 = pt.name === '편관격';                       // 중기 甲 투간 → 편관격(상담가와 일치)
  const ok2 = pt.candidates.includes('정재격');            // 무계합 → 정재격 동급 후보
  const ok3 = /합으로 서는 격 후보: 戊癸합→정재격/.test(pt.basis);
  if (ok1 && ok2 && ok3) { pass++; console.log(`  ✓ ${pt.name} · 후보 [${pt.candidates.join(', ')}]`); }
  else {
    fail++;
    console.error(`  ✗ 기대: 편관격 + 후보에 정재격 + 합 근거 표기`);
    console.error(`      실제: ${pt.name} · [${pt.candidates.join(', ')}]\n      ${pt.basis}`);
  }
}

// 표본 — 아래 불변식들이 함께 쓴다
const SAMPLE = (() => {
  const out: ReturnType<typeof detectPattern>[] = [];
  for (let y = 2000; y <= 2005; y++) for (let m = 1; m <= 12; m++) for (const d of [3, 13, 23])
    out.push(detectPattern(build(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} 10:00`, '남')));
  return out;
})();

// ── 불변식 A: 비겁 월지에서 '비견격'이 그대로 나오지 않는다(건록으로 간다) ────
console.log("\n[불변식 A] 비겁 = 건록 / 양인 / 겁재 (음양 규칙)");
{
  const bad = SAMPLE.filter((pt) => /^비견격$/.test(pt.name)).length;
  const names = [...new Set(SAMPLE.map((p) => p.name))].sort();
  if (bad === 0) { pass++; console.log(`  ✓ 표본 ${SAMPLE.length}건 · 등장 ${names.join(', ')}`); }
  else { fail++; console.error(`  ✗ '비견격'이 ${bad}건 — 건록으로 가야 한다`); }
}

// ── 불변식 B: **폐기된 '국' 접미가 되살아나지 않는다** ────────────────────────
//   R55(투간=격/미투간=국)는 2026-08-10 에 교체됐다. 이 stance 가 코드로 되돌아오면 여기서 막힌다.
console.log("\n[불변식 B] 폐기된 '◯◯국' 이름이 어디에도 없다 (R55 회귀 방지)");
{
  const bad = SAMPLE.filter((pt) => pt.name.endsWith('국'));
  if (bad.length === 0) { pass++; console.log(`  ✓ 표본 ${SAMPLE.length}건 전부 '격' 또는 '격 없음'`); }
  else { fail++; console.error(`  ✗ '국' 접미 ${bad.length}건 (예: ${bad[0].name}) — R55 로 되돌아갔다`); }
}

// ── 불변식 C: 소비처 안전판 — 격이 없어도 월지 본기 십신은 **항상** 있다 ──────
//   ★이게 없으면 '격 없음'을 받은 화면이 `name.replace(/격/,'')` 로 십신을 뽑다가 조용히 깨진다
//     (실제로 R55 의 '국' 접미가 그런 사고를 냈다 — gyeokguk-stance-r55).
console.log('\n[불변식 C] monthMainTenGod 는 격 성립과 무관하게 항상 채워진다(소비처 안전판)');
{
  const TENGODS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  const bad = SAMPLE.filter((pt) => !TENGODS.includes(pt.monthMainTenGod));
  const none = SAMPLE.filter((pt) => !pt.established);
  const noneOk = none.every((pt) => TENGODS.includes(pt.monthMainTenGod) && pt.name === '격 없음');
  if (bad.length === 0 && noneOk) {
    pass++;
    console.log(`  ✓ 표본 ${SAMPLE.length}건 전부 십신 보유 · 그중 격 불성립 ${none.length}건도 십신은 있다`);
  } else { fail++; console.error(`  ✗ monthMainTenGod 비정상 ${bad.length}건 · 격없음 케이스 정합 ${noneOk}`); }
}

// ── 불변식 D: 월지 종류별 규칙이 실제로 그렇게 갈린다 ────────────────────────
console.log('\n[불변식 D] 왕지·고지는 항상 격이 서고, 격이 안 서는 것은 생지뿐이다');
{
  const bad = SAMPLE.filter((pt) => !pt.established && pt.branchKind !== '생지');
  if (bad.length === 0) { pass++; console.log(`  ✓ 격 불성립 ${SAMPLE.filter((p) => !p.established).length}건 전부 생지`); }
  else { fail++; console.error(`  ✗ 생지가 아닌데 격이 안 선 것 ${bad.length}건 (${bad[0].branchKind})`); }
}

// ── 경계: daniel 확인용 ─────────────────────────────────────────────────────
console.log('\n[경계] daniel 확인용 — 록지가 아닌 비견 / 격이 서지 않는 명식');
{
  for (const [label, birth, sex] of [
    ['己 일간 未월 — 본기 비견이지만 未는 己의 록지가 아니다(그래도 건록으로 간다)', '1990-07-13 10:00', '남'],
    ['생지 巳월 · 여기만 투간 → 격이 서지 않는다', '1988-05-12 14:30', '여'],
  ] as [string, string, '남' | '여'][]) {
    const pt = detectPattern(build(birth, sex));
    console.log(`  · ${label}\n      → ${pt.name}(established=${pt.established}, 월지본기=${pt.monthMainTenGod}) · ${pt.basis}`);
  }
  pass++;
}

console.log(fail
  ? `\n❌ 격국 골든  PASS ${pass} / FAIL ${fail}`
  : `\n✅ 격국 골든  PASS ${pass} / FAIL 0 — 월지 종류별 성립(생지/왕지/고지) · 비겁 이름 · '국' 폐기 · 소비처 안전판`);
process.exit(fail ? 1 : 0);
