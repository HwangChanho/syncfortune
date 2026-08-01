#!/usr/bin/env tsx
// engine/strength3.calibrate.ts — 3주(시각 미상) 강약 **임계값 실측 캘리브레이션**
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-08-01: "B로 가되 임계값은 실측해서 4주랑 중화 비율 맞춰줘"
//
// 왜 필요한가: 시각 미상이면 시주(가중 2.0)를 빼야 하는데(유령 子시라 실재가 아니다),
//   총점 진폭이 줄어드는 만큼 임계 ±2 를 그대로 쓰면 **중화로 몰린다**(간이 측정 19.5%→25.7%).
//   같은 자를 쓰는데 눈금이 안 맞는 셈이라, 3주 전용 임계를 **4주의 중화 비율에 맞춰** 정한다.
//
// 방법: 같은 명식 집합을 ①시각 정확(4주) ②시각 미상(3주)으로 각각 산출하고,
//   3주 점수 분포에서 **4주와 같은 중화 비율**을 내는 임계를 찾는다.
//   ※ scoreStrength 를 그대로 호출하므로 충·합 보정까지 실제 로직이 반영된다(간이 사본 아님).
//
// 사용: npx tsx engine/strength3.calibrate.ts
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from './saju';
import { scoreStrength } from './structure';
import type { ChartInput } from '../spec/chart';

const N_YEARS = 60;      // 1955~2014
const SAMPLES: ChartInput[] = [];
for (let i = 0; i < 3000; i++) {
  const y = 1955 + (i % N_YEARS);
  const m = 1 + ((i * 7) % 12);
  const d = 1 + ((i * 13) % 28);
  const h = (i * 5) % 24;
  const dt = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:00`;
  SAMPLES.push({ birthDateTime: dt, calendar: '양', timeAccuracy: '정확', sex: i % 2 ? '남' : '여', birthPlace: '서울' } as ChartInput);
}

const s4: number[] = [];   // 4주 점수
const s3: number[] = [];   // 3주 점수(같은 명식·시각 미상)
let base중화 = 0;
for (const inp of SAMPLES) {
  try {
    const c4 = buildSajuChart(inp);
    const c3 = buildSajuChart({ ...inp, timeAccuracy: '미상' });
    const r4 = scoreStrength(c4);
    const r3 = scoreStrength(c3);
    s4.push(r4.score); s3.push(r3.score);
    if (r4.verdict === '중화') base중화++;
  } catch { /* 절입 경계 등 산출 불가 표본은 건너뛴다 */ }
}
const n = s4.length;
const baseRatio = base중화 / n;

// 후보 임계를 0.25 간격으로 훑어 4주 중화 비율에 가장 가까운 값을 찾는다
let best = { th: 2, ratio: 0, gap: Infinity };
const table: string[] = [];
for (let th = 0.5; th <= 3.01; th += 0.25) {
  const mid = s3.filter((v) => v > -th && v < th).length / n;
  const gap = Math.abs(mid - baseRatio);
  table.push(`   ±${th.toFixed(2)}  중화 ${(mid * 100).toFixed(1)}%   (차이 ${(gap * 100).toFixed(1)}p)`);
  if (gap < best.gap) best = { th: Math.round(th * 100) / 100, ratio: mid, gap };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
console.log(`\n■ 3주 강약 임계 캘리브레이션 — 표본 ${n} 명식`);
console.log(`   기준(4주, 임계 ±2)  중화 ${pct(baseRatio)}`);
console.log(`\n   후보 임계별 3주 중화 비율:`);
table.forEach((t) => console.log(t));
console.log(`\n   ★가장 근접: **±${best.th}**  →  중화 ${pct(best.ratio)}  (4주와 차이 ${(best.gap * 100).toFixed(1)}p)`);

// 확정값이 코드와 일치하는지(드리프트 방지) — structure.ts 의 THRESHOLD_3 을 읽어 대조
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./structure.ts', import.meta.url), 'utf8');
const m = src.match(/const THRESHOLD_3 = ([\d.]+);/);
const inCode = m ? Number(m[1]) : NaN;
console.log(`\n   structure.ts 의 THRESHOLD_3 = ${inCode}`);
if (inCode !== best.th) {
  console.error(`\n❌ 코드값(${inCode}) ≠ 실측 최적(${best.th}) — structure.ts 의 THRESHOLD_3 을 맞추십시오.\n`);
  process.exit(1);
}
console.log(`   ✅ 코드값이 실측 최적과 일치합니다.\n`);
