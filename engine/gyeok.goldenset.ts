// engine/gyeok.goldenset.ts — 격국 판정 골든셋 (daniel 2026-07-28 stance 확정분)
// ─────────────────────────────────────────────────────────────────────────
// ★이 파일이 격국 stance 의 **정본**이다. 코드가 바뀌어도 여기서 막힌다.
//
// daniel 확정(2026-07-28, IMG_8266 "만세력에 격판정이 다 틀린거같은데" 후속):
//   ① **양일간 월지 비견 = 건록** / **양일간 월지 겁재 = 양인** / **음일간 월지 겁재 = 겁재**
//      (음간에는 양인이 없다. 비견 월지는 음양 공통으로 건록 — 록은 음간에도 있다.)
//   ② **투간 우선** — 월지 지장간 중 천간(년·월·시)에 투간한 것으로 격을 잡는다.
//      본기가 잠복이고 중기·여기만 투간했으면 **격이 그쪽으로 바뀐다**.
//   ③ **투간하면 '격' · 투간 못하면 '국'** — 접미가 투간 여부를 나타낸다(정관격 vs 정관국).
//   ④ **이름까지만** — 성격(成格)·파격 판정은 하지 않는다.
//
// ★규칙은 **십신 + 일간 음양**으로만 판정한다(daniel 지시 그대로).
//   12운성 록지 조건을 걸지 않는다 → 己 일간 未월(본기 己=비견, 12운성 관대)도 '건록'으로 간다.
//   ⚠️이 귀결이 의도와 다르면 알려 주십시오 — 아래 [경계] 케이스로 노출해 뒀습니다.
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
  // ── ① 비겁 월지 — 음양이 이름을 가른다 ────────────────────────────────
  {
    label: '양일간(庚) 월지 申 비견 → 건록 · 본기 미투간이라 국',
    birth: '2002-08-30 16:00', sex: '여',
    expectName: '건록국',
    expectBasis: /일간 庚\(양\) → 건록국 · 천간 미투간/,
  },
  {
    label: '음일간(丁) 월지 巳 겁재 → 겁재(음간엔 양인 없음)',
    birth: '1988-05-12 14:30', sex: '여',
    expectName: '겁재국',
    expectBasis: /일간 丁\(음\) → 겁재국/,
  },

  // ── ② 투간 우선 ────────────────────────────────────────────────────────
  {
    label: '투간 우선 — 寅월 본기 甲(상관) 잠복인데 여기 戊(정관) 투간 → 정관격',
    birth: '2000-02-05 10:00', sex: '남',
    expectName: '정관격',
    expectBasis: /여기 戊\(정관\) 천간 월에 투간 → 투간 우선\(본기 甲\(상관\)은 잠복\)/,
  },

  // ── ③ 투간 못하면 '국' ─────────────────────────────────────────────────
  {
    label: '아무것도 투간 안 됨 → 본기 십신 + 국',
    birth: '2003-11-23 10:00', sex: '남',
    expectName: '식신국',
    expectBasis: /천간 미투간 → 식신국/,
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

// ── ④ 불변식 A: 비겁 월지에서 '비견◯·겁재◯'가 잘못 나오지 않는다 ─────────
console.log("\n[불변식] 비겁 월지 이름 = 건록 / 양인 / 겁재 (음양 규칙)");
{
  let bad = 0, n = 0;
  const names = new Set<string>();
  for (let y = 2000; y <= 2005; y++) for (let m = 1; m <= 12; m++) for (const d of [3, 13, 23]) {
    const pt = detectPattern(build(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} 10:00`, '남'));
    names.add(pt.name); n++;
    if (/^비견[격국]$/.test(pt.name)) bad++;      // 비견은 반드시 건록으로 간다
  }
  if (bad === 0) { pass++; console.log(`  ✓ 표본 ${n}건 · 등장 ${[...names].sort().join(', ')}`); }
  else { fail++; console.error(`  ✗ '비견격/비견국'이 ${bad}건 — ①규칙 위반(건록으로 가야 한다)`); }
}

// ── ⑤ 불변식 B: 접미는 투간 여부와 정확히 일치한다 ─────────────────────────
console.log("\n[불변식] '격'=투간 · '국'=미투간 (접미와 revealed 가 어긋나지 않는다)");
{
  let bad = 0, n = 0;
  for (let y = 2000; y <= 2005; y++) for (let m = 1; m <= 12; m++) for (const d of [3, 13, 23]) {
    const pt = detectPattern(build(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} 10:00`, '남'));
    n++;
    const isGyeok = pt.name.endsWith('격');
    if (isGyeok !== pt.revealed) { if (bad < 3) console.error(`  ✗ ${pt.name} · revealed=${pt.revealed} · ${pt.basis}`); bad++; }
  }
  if (bad === 0) { pass++; console.log(`  ✓ 표본 ${n}건 전부 접미=투간여부 일치`); }
  else { fail++; console.error(`  ✗ ${bad}건 어긋남 — ③규칙 위반`); }
}

// ── ⑥ 경계: 음양별 겁재 월지 이름 · 비견이지만 록지 아닌 경우 ───────────────
console.log('\n[경계] daniel 확인용 — 음양별 겁재 / 록지 아닌 비견');
{
  const show: string[] = [];
  for (const [label, birth, sex] of [
    ['양일간(戊) 겁재 월지 → 양인', '1990-01-13 10:00', '남'],
    ['음일간(丁) 겁재 월지 → 겁재', '1988-05-12 14:30', '여'],
    ['己 일간 未월 — 본기 비견이지만 未는 己의 록지가 아니다(그래도 건록으로 간다)', '1990-07-13 10:00', '남'],
  ] as [string, string, '남' | '여'][]) {
    const pt = detectPattern(build(birth, sex));
    show.push(`  · ${label}\n      → ${pt.name} · ${pt.basis}`);
  }
  console.log(show.join('\n'));
  pass++;
}

console.log(fail
  ? `\n❌ 격국 골든  PASS ${pass} / FAIL ${fail}`
  : `\n✅ 격국 골든  PASS ${pass} / FAIL 0 — 음양별 비겁·투간우선·격/국 접미 stance 고정`);
process.exit(fail ? 1 : 0);
