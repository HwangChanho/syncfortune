// engine/mirrorConcordance.audit.ts — R60 v0.2.0 §4.3 임계값 분포 측정(30+ 샘플)
// ─────────────────────────────────────────────────────────────────────────
// 스펙 §11-1 **최우선 과제**: T_HIGH=0.70 / T_LOW=0.40 은 **PILOT_01 단일 샘플 잠정값**이다.
//   30개 이상 명식으로 concordance 분포를 측정해야 확정할 수 있다.
//
// ★★판정 기준(스펙이 못박은 것 — 어기면 보상해킹이다):
//   · 중앙값이 T_LOW(0.40) **아래**로 나오면 → 임계값을 낮춰 통과시키지 말고
//     **경상명식 기법 자체를 재검토**한다. (CLAUDE.md 규칙7)
//   · 분포가 이봉(bimodal)이면 → 일간 오행·음양별 별도 임계값 검토.
//
// ⚠️이건 '측정'이지 '판정'이 아니다. 숫자를 보고 무엇을 할지는 daniel 이 정한다.
// 실행: npx tsx engine/mirrorConcordance.audit.ts
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from './saju';
import { analyzeStarPalace } from './starPalace';
import { deriveHapMirror, deriveChungMirror, toMirrorChart } from './mirrorRomance';
import { profileOf } from './mirrorProfile';
import { concordanceOf, R60_THRESHOLDS } from './mirrorConcordance';
import type { ChartInput, Stem, PillarPos } from '../spec/chart';

const POS: PillarPos[] = ['년', '월', '일', '시'];

// 가공 명식 표본 — 연/월/일/시·성별을 흩어 일간·계절·강약이 골고루 섞이게 한다(실인물 아님).
const YEARS = [1968, 1975, 1981, 1986, 1990, 1994, 1999, 2003];
const MDS = ['01-17', '03-28', '05-09', '07-21', '09-05', '11-14'];
const HMS = ['03:10', '09:45', '14:20', '21:55'];

type Row = { label: string; day: Stem; score: number; render: string; axes: Record<string, number> };
const rows: Row[] = [];

for (const y of YEARS) {
  for (const md of MDS) {
    for (const hm of HMS) {
      for (const sex of ['남', '여'] as const) {
        if (rows.length >= 120) break;                       // 충분히 모이면 중단(스펙 요구 30+)
        const input: ChartInput = { birthDateTime: `${y}-${md} ${hm}`, calendar: '양', timeAccuracy: '정확', sex, birthPlace: '서울' };
        try {
          const ch: any = buildSajuChart(input);
          const P: any = {};
          for (const p of POS) P[p] = { stem: ch.pillars[p].stem, branch: ch.pillars[p].branch };
          const sp = analyzeStarPalace(P, sex);
          const ns = POS.map((p) => P[p].stem) as Stem[];
          const mc = toMirrorChart({ pillars: P });
          const c = concordanceOf(sp, profileOf(deriveHapMirror(mc), ns), profileOf(deriveChungMirror(mc).chart, ns));
          const axes: Record<string, number> = {};
          for (const a of c.axes) axes[a.key] = a.match;
          rows.push({ label: `${y}-${md} ${hm} ${sex}`, day: P['일'].stem, score: c.score, render: c.render, axes });
        } catch { /* 산출 실패 표본은 건너뛴다 */ }
      }
    }
  }
}

const scores = rows.map((r) => r.score).sort((a, b) => a - b);
const q = (p: number) => scores[Math.floor((scores.length - 1) * p)];
const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

console.log(`\n📊 R60 concordance 분포  (표본 ${rows.length}개 · 가공 명식)\n`);
console.log(`   최소 ${q(0).toFixed(2)} · 25% ${q(0.25).toFixed(2)} · **중앙 ${q(0.5).toFixed(2)}** · 75% ${q(0.75).toFixed(2)} · 최대 ${q(1).toFixed(2)}`);
console.log(`   평균 ${mean.toFixed(3)}`);

// 히스토그램 — 이봉(bimodal) 여부를 눈으로 본다
console.log('\n   구간 분포');
for (let lo = 0; lo < 1; lo += 0.1) {
  const n = scores.filter((s) => s >= lo && s < lo + 0.1 + (lo >= 0.9 ? 0.01 : 0)).length;
  console.log(`   ${lo.toFixed(1)}~${(lo + 0.1).toFixed(1)}  ${'█'.repeat(Math.round(n / Math.max(1, rows.length / 40)))} ${n}`);
}

// 현재 임계값으로 갈리는 렌더 비율
const cnt = { FULL: 0, DESCRIPTIVE_ONLY: 0, STAR_PALACE_ONLY: 0 } as Record<string, number>;
for (const r of rows) cnt[r.render]++;
console.log(`\n   현재 임계값(T_HIGH=${R60_THRESHOLDS.T_HIGH} · T_LOW=${R60_THRESHOLDS.T_LOW}) 적용 시`);
for (const k of Object.keys(cnt)) console.log(`   ${k.padEnd(18)} ${cnt[k]}개 (${Math.round(cnt[k] / rows.length * 100)}%)`);

// 축별 평균 일치도 — 어느 축이 발목을 잡는지
console.log('\n   축별 평균 일치도(낮은 축이 분포를 끌어내린다)');
const keys = Object.keys(rows[0].axes);
for (const k of keys) {
  const m = rows.reduce((a, r) => a + r.axes[k], 0) / rows.length;
  console.log(`   ${k.padEnd(20)} ${m.toFixed(2)} ${'▏'.repeat(Math.round(m * 20))}`);
}

// ★스펙 §4.3 판정
const med = q(0.5);
console.log('\n' + '─'.repeat(60));
if (med < R60_THRESHOLDS.T_LOW) {
  console.log(`🔴 중앙값 ${med.toFixed(2)} < T_LOW ${R60_THRESHOLDS.T_LOW}`);
  console.log('   ⚠️스펙 §4.3: **임계값을 낮추지 말고 경상명식 기법 자체를 재검토**한다.');
  console.log('   (숫자를 기대에 맞춰 내리는 건 보상해킹 — CLAUDE.md 규칙7)');
  console.log('   → daniel 판단 필요. 전문가 검수 세트 verify-000b-romance #11 과 함께 볼 것.');
} else {
  console.log(`🟢 중앙값 ${med.toFixed(2)} >= T_LOW ${R60_THRESHOLDS.T_LOW} — 기법이 성궁 판정과 일정 수준 정합한다.`);
  console.log(`   임계값 후보: T_LOW=${q(0.25).toFixed(2)}(25%) · T_HIGH=${q(0.75).toFixed(2)}(75%) — daniel 확정 대상.`);
}
console.log('─'.repeat(60) + '\n');
