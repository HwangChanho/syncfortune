// engine/elementPower.goldenset.ts — 오행 세력 2모드 골든(회귀 고정)
// 기준: golden/entry-001-self.md (甲戌 丁卯 辛丑 丁酉) — 卯戌合化火 성립(丁 양투)·丑酉半合은 미성립(판정 없음).
// 실측 2026-08-05: 기본 25/25/25/25/0 → 합화 ON 火50 → +조후궁성 火61.
// ⚠️계수(WANG_COEF·GUNG_WEIGHT·발달 임계)가 daniel 검수로 바뀌면 이 기대값도 함께 갱신할 것.
import { buildSajuChart } from './saju';
import { detectInteractions } from './structure';
import { elementPower } from './elementPower';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) console.log(`  ✓ ${name}`);
  else { console.error(`  ✗ ${name}\n     got  ${g}\n     want ${w}`); fail++; }
};

const saju = buildSajuChart({ birthDateTime: '1994-03-16 18:00', calendar: '양', sex: '남', birthPlace: '여수' } as never);
(saju as { interactions?: unknown }).interactions = detectInteractions(saju);
const pct = (r: ReturnType<typeof elementPower>) =>
  Object.fromEntries((Object.entries(r.power) as [string, number][]).map(([k, v]) => [k, Math.round((100 * v) / r.total)]));

console.log('elementPower 골든 — 골든 #1(辛丑)');
const base = elementPower(saju, { hap: false, johuGung: false });
eq('기본(개수 비율)', pct(base), { 木: 25, 火: 25, 土: 25, 金: 25, 水: 0 });
eq('발달 라벨(水 부재)', base.labels, { 水: '부재' });
const hap = elementPower(saju, { hap: true, johuGung: false });
eq('합화 ON — 卯戌→火(성립)·반합 미적용', pct(hap), { 木: 13, 火: 50, 土: 13, 金: 25, 水: 0 });
const both = elementPower(saju, { hap: true, johuGung: true });
eq('합화+조후궁성', pct(both), { 木: 13, 火: 61, 土: 7, 金: 19, 水: 0 });
// 음성: 성립 안 된 반합만 있는 차트에서 hap ON = 변화 없음
const saju2 = buildSajuChart({ birthDateTime: '1991-02-06 08:30', calendar: '양', sex: '남', birthPlace: '서울' } as never);
(saju2 as { interactions?: unknown }).interactions = detectInteractions(saju2);
eq('음성 — 성립 합 없으면 무변화', pct(elementPower(saju2, { hap: true, johuGung: false })), pct(elementPower(saju2, { hap: false, johuGung: false })));

console.log(fail ? `\n❌ 실패 ${fail}` : '\n✅ elementPower 골든 통과');
process.exit(fail ? 1 : 0);
