// engine/gyeok.goldenset.ts — 격국 판정 골든셋 (daniel 2026-07-28 stance 확정분)
// ─────────────────────────────────────────────────────────────────────────
// ★이 파일이 격국 stance 의 **정본**이다. 코드가 바뀌어도 여기서 막힌다.
//
// daniel 확정(2026-07-28, IMG_8266 "만세력에 격판정이 다 틀린거같은데" 후속):
//   ① 월지가 **비겁**이면 팔격으로 잡지 않는다 → **건록격 / 월겁격**
//   ② **투출 우선** — 월지 지장간 중 천간(년·월·시)에 투출한 것으로 격을 잡는다.
//      본기가 잠복이고 중기·여기만 투출했으면 **격이 그쪽으로 바뀐다**.
//   ③ **격 이름까지만** — 성격(成格)·파격 판정은 하지 않는다.
//
// ★내가 임의로 정하지 않은 것(발명 금지, §3):
//   · '건록' 여부는 **12운성(twelveStage)** 으로 판정한다. "본기 십신이 비견"과 건록(록지)은 다르다 —
//     己 일간 未월은 본기 己(비견)이지만 록지는 午라 건록이 아니다. 록지 표를 새로 만들면 발명이 되므로
//     이미 결정론으로 존재하는 12운성을 근거로 삼았다.
//   · 여러 지장간이 동시에 투출하면 **본기 > 중기 > 여기** 순으로 잡는다(지장간 세력 순서).
//
// ⚠️daniel 확인 대기(내 판단이 들어간 지점 — 아래 §확인필요 케이스로 노출):
//   ⓐ 월지 본기가 **비견인데 록지가 아닌** 경우(己 未월 등)를 '월겁격'으로 뒀다.
//   ⓑ 월지가 비겁일 때 다른 지장간이 투출해도 **건록격/월겁격을 유지**한다(투출은 후보로만 표기).
//
// 실행: npm run check:gyeok
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from './saju';
import { detectPattern } from './structure';
import { twelveStage } from './twelve';
import type { ChartInput } from '../spec/chart';

type Case = { label: string; birth: string; sex: '남' | '여'; expectName: string; expectBasis?: RegExp };

const build = (birth: string, sex: '남' | '여') =>
  buildSajuChart({ birthDateTime: birth, calendar: '양', timeAccuracy: '정확', sex, birthPlace: '서울' } as ChartInput, 2026);

const CASES: Case[] = [
  // ── ① 비겁 월지 = 건록격 / 월겁격 ──────────────────────────────────────
  {
    label: 'IMG_8266 원본 — 庚 일간 申월(록지) · 본기 잠복 · 戊壬 투출',
    birth: '2002-08-30 16:00', sex: '여',
    expectName: '건록격',
    expectBasis: /건록.*비겁 월지는 팔격으로 잡지 않는다/,
  },
  {
    label: '丁 일간 巳월 — 본기 丙(겁재) → 월겁격',
    birth: '1988-05-12 14:30', sex: '여',
    expectName: '월겁격',
  },

  // ── ② 투출 우선 — 본기 잠복인데 중기·여기가 투출하면 격이 바뀐다 ────────
  //   (아래 두 건은 '투출 우선' 문구가 근거에 찍히는지로 규칙 발동을 확인한다)
  {
    label: '투출 우선 발동 — 寅월 본기 甲(상관) 잠복인데 여기 戊(정관)가 투출 → 정관격',
    birth: '2000-02-05 10:00', sex: '남',
    expectName: '정관격',
    expectBasis: /여기 戊\(정관\) 천간 월에 투출 → 투출 우선\(본기 甲\(상관\)은 잠복\)/,
  },

  // ── ③ 아무것도 투출 안 하면 본기로 잡되 '잠복' 표기 ──────────────────────
  {
    label: '전부 잠복 — 본기로 잡고 잠복 표기',
    birth: '2003-11-23 10:00', sex: '남',
    expectName: '',
    expectBasis: /천간 미투출\(잠복\)/,
  },
];

let pass = 0, fail = 0;
console.log('\n🔎 격국 골든셋 (daniel 2026-07-28 stance)\n');

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

// ── ④ 불변식: 팔격에 비견격·겁재격이 **절대** 나오면 안 된다 ──────────────
console.log('\n[불변식] 비견격·겁재격 이름이 나오지 않는다(비겁 월지는 건록/월겁으로 간다)');
{
  let bad = 0, n = 0;
  const names = new Set<string>();
  for (let y = 2000; y <= 2005; y++) for (let m = 1; m <= 12; m++) for (const d of [3, 13, 23]) {
    const pt = detectPattern(build(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} 10:00`, '남'));
    names.add(pt.name); n++;
    if (pt.name === '비견격' || pt.name === '겁재격') bad++;
  }
  if (bad === 0) { pass++; console.log(`  ✓ 표본 ${n}건 · 등장 격 ${[...names].sort().join(', ')}`); }
  else { fail++; console.error(`  ✗ 비견격/겁재격이 ${bad}건 나왔다 — ①규칙 위반`); }
}

// ── ⑤ 건록 판정 근거가 12운성인지(록지 표를 따로 만들지 않았는지) ──────────
console.log('\n[근거] 건록 = 12운성 판정(록지 표 자작 금지)');
{
  const t: [string, string, string][] = [
    ['庚', '申', '건록'], ['甲', '寅', '건록'], ['乙', '卯', '건록'], ['丁', '午', '건록'],
    ['己', '未', '관대'],  // ★본기 己=비견이지만 록지가 아니다 — 건록격이 되면 안 된다
    ['丙', '午', '제왕'],
  ];
  let off = 0;
  for (const [stem, branch, want] of t) {
    const got = twelveStage(stem as never, branch as never);
    if (got !== want) { console.error(`  ✗ ${stem}일간 ${branch}월 → ${got}(기대 ${want})`); off++; }
  }
  if (!off) { pass++; console.log(`  ✓ ${t.length}건 일치(己 未월=관대 → 건록격 아님)`); }
  else fail++;
}

console.log(fail
  ? `\n❌ 격국 골든  PASS ${pass} / FAIL ${fail}`
  : `\n✅ 격국 골든  PASS ${pass} / FAIL 0 — 비겁특칙·투출우선·이름한정 stance 고정`);
process.exit(fail ? 1 : 0);
