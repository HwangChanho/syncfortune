// engine/verify-engine.ts — 결정론 *정확도* 게이트 (공식 산출 ↔ 알려진 명리 정답)
// ─────────────────────────────────────────────────────────────────────────
// 12운성(양간 순행·음간 역행)·공망(순중공망) 같은 '공식' 산출이 명리 표준값과 일치하는지 교차검증.
//   테이블 오류·역행 방향 실수를 게이트로 차단. (신살 매핑은 고정 테이블이라 부차 — run-sinsal로 확인.)
// 실행: npm run verify:engine
// ─────────────────────────────────────────────────────────────────────────
import { twelveStage } from './twelve';
import { gongmang, analyzeSinsal } from './sinsal';
import { detectInteractions } from './structure';
import { buildSajuChart } from './saju';
import { trueSolarOffsetMin } from './solartime';
import type { Stem, Branch, PillarPos, SajuChart, ChartInput } from '../spec/chart';

let ok = true;
const mark = (p: boolean) => (p ? '✅' : '❌');
const check = (desc: string, p: boolean) => { if (!p) ok = false; console.log(`  ${mark(p)} ${desc}`); };

// ── 12운성 (천간 × 지지 → 운성) 알려진 정답 ──
// 양간 순행/음간 역행이 핵심 — 장생지·왕지(건록·제왕) 위주로 검증.
const STAGE_CASES: [Stem, Branch, string][] = [
  ['甲', '亥', '장생'], ['甲', '卯', '제왕'], ['甲', '寅', '건록'],   // 양간 순행
  ['丙', '寅', '장생'], ['丙', '午', '제왕'],
  ['庚', '巳', '장생'], ['庚', '酉', '제왕'], ['庚', '申', '건록'],
  ['壬', '申', '장생'], ['壬', '子', '제왕'],
  ['辛', '子', '장생'], ['辛', '酉', '건록'], ['辛', '申', '제왕'], // 음간 역행 (辛: 子장생→酉건록→申제왕)
  ['乙', '午', '장생'], ['丁', '酉', '장생'], ['癸', '卯', '장생'],
];
console.log('=== 12운성 정확도 (양간 순행·음간 역행) ===');
for (const [s, b, exp] of STAGE_CASES) {
  const got = twelveStage(s, b); const p = got === exp; if (!p) ok = false;
  console.log(`  ${mark(p)} ${s}${b} → ${got}${p ? '' : ` (정답 ${exp})`}`);
}

// ── 공망 (일주 간지 → 순중공망 2지지) 알려진 정답 ──
const GM_CASES: [Stem, Branch, Branch, Branch][] = [
  ['甲', '子', '戌', '亥'],  // 甲子순
  ['甲', '戌', '申', '酉'],  // 甲戌순
  ['甲', '申', '午', '未'],  // 甲申순
  ['甲', '午', '辰', '巳'],  // 甲午순
  ['辛', '丑', '辰', '巳'],  // 辛丑(甲午순)
  ['庚', '申', '子', '丑'],  // 庚申(甲寅순)
  ['癸', '亥', '子', '丑'],  // 癸亥 = 甲寅순 → 공망 子丑
  ['壬', '戌', '子', '丑'],  // 壬戌 = 甲寅순 → 공망 子丑
];
console.log('=== 공망 정확도 (순중공망) ===');
for (const [s, b, e1, e2] of GM_CASES) {
  const got = gongmang(s, b); const p = got[0] === e1 && got[1] === e2; if (!p) ok = false;
  console.log(`  ${mark(p)} ${s}${b}일주 → 공망 ${got.join('·')}${p ? '' : ` (정답 ${e1}·${e2})`}`);
}

// ── 합충형해 (detectInteractions 로직 — 화성립·반합·형 등) 알려진 정답 ──
function mk(br: [Branch, Branch, Branch, Branch]): SajuChart {
  const P: PillarPos[] = ['년', '월', '일', '시'];
  const pillars = {} as Record<PillarPos, any>;
  P.forEach((p, i) => { pillars[p] = { position: p, stem: '甲', branch: br[i], stemTenGod: '비견', branchMainTenGod: '비견', hiddenStems: [], isRoot: false }; });
  return { pillars, dayMaster: { stem: '甲', element: '木' }, interactions: [], luckCycles: [], currentLuck: {} as any, annual: {} as any } as SajuChart;
}
const INT_CASES: [string, [Branch, Branch, Branch, Branch], string][] = [
  ['子丑 육합', ['子', '丑', '巳', '巳'], '子丑合化土'],
  ['卯戌 육합', ['卯', '戌', '巳', '巳'], '卯戌合化火'],
  ['辰酉 육합', ['辰', '酉', '巳', '巳'], '辰酉合化金'],
  ['卯酉 충', ['卯', '酉', '巳', '巳'], '卯酉冲'],
  ['辰戌 충', ['辰', '戌', '巳', '巳'], '辰戌冲'],
  ['寅午 반합火', ['寅', '午', '巳', '巳'], '寅午半合火'],
  ['申子 반합水', ['申', '子', '巳', '巳'], '申子半合水'],
  ['丑戌 형', ['丑', '戌', '寅', '卯'], '丑戌刑'],
  ['午午 자형(반합 아님)', ['午', '午', '寅', '卯'], '午午自刑'], // 같은 글자=자형, 半合 오검출 회귀 방지
];
console.log('=== 합충형해 정확도 (detectInteractions 로직) ===');
for (const [desc, br, must] of INT_CASES) {
  const got = detectInteractions(mk(br)).map((i) => i.detail);
  const p = got.some((d) => d.includes(must)); if (!p) ok = false;
  console.log(`  ${mark(p)} ${desc}${p ? ` → ${must} ✓` : ` → ${got.join(', ') || '(없음)'} (기대 ${must})`}`);
}

// ── 신살 일반화 (타 일간 차트 — 자기차트 n=1 넘어 규칙이 임의 차트에 일반 적용되는지) ──
function mkSaju(st: [Stem, Stem, Stem, Stem], br: [Branch, Branch, Branch, Branch]): SajuChart {
  const P: PillarPos[] = ['년', '월', '일', '시'];
  const pillars = {} as Record<PillarPos, any>;
  P.forEach((p, i) => { pillars[p] = { position: p, stem: st[i], branch: br[i], stemTenGod: '비견', branchMainTenGod: '비견', hiddenStems: [], isRoot: false }; });
  return { pillars, dayMaster: { stem: st[2], element: '木' }, interactions: [], luckCycles: [], currentLuck: {} as any, annual: {} as any } as SajuChart;
}
console.log('=== 신살 일반화 (타 일간 차트 — n=1 넘어 규칙 일반화) ===');
{
  const rA = analyzeSinsal(mkSaju(['庚', '丙', '甲', '壬'], ['子', '午', '寅', '戌'])); // 일간 甲, 년지 子·일지 寅
  const rok = rA.sinsal.find((s) => s.name === '정록');
  check('甲 일간 정록=寅 (일지 적중)', rok?.glyphs[0] === '寅' && !!rok.hits.some((h) => h.pos === '일'));
  check('일지 寅 → 지살(일지 기준)', rA.twelve['일'].find((t) => t.bases.includes('일'))?.name === '지살');
  check('일지 寅 → 역마(년지 子 기준 ≠ 일지기준 = 전부 산출)', rA.twelve['일'].find((t) => t.bases.includes('년'))?.name === '역마');

  const rB = analyzeSinsal(mkSaju(['丙', '戊', '庚', '甲'], ['申', '子', '辰', '未'])); // 일간 庚
  const rokB = rB.sinsal.find((s) => s.name === '정록');
  check('庚 일간 정록=申 (년지 적중)', rokB?.glyphs[0] === '申' && !!rokB.hits.some((h) => h.pos === '년'));
  check('庚 천을귀인 未 적중(시지)', !!rB.sinsal.find((s) => s.name === '천을귀인')?.hits.some((h) => h.pos === '시'));
  check('일지 辰 → 화개(일지 기준)', rB.twelve['일'].find((t) => t.bases.includes('일'))?.name === '화개');
}

// ── 진태양시 보정 (경도차 + 균시차) — 시주가 보정으로 바뀌는지 ──
console.log('=== 진태양시 보정 (시계시 → 출생지 태양시) ===');
{
  const yeosu = (h: number, mi: number): ChartInput => ({ birthDateTime: `2001-06-15 ${h}:${mi}`, calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '여수', birthLon: 127.66 });
  const off = trueSolarOffsetMin(yeosu(17, 30), 2001, 6, 15);
  check(`여수 2001-06-15 보정 ≈ -39분 (실측 ${off.toFixed(1)}분, 17:30→17:06)`, off < -36 && off > -42);
  check('17:30 여수 → 시지 酉 (보정 17:06, 酉시 유지)', buildSajuChart(yeosu(17, 30)).pillars['시'].branch === '酉');
  check('17:05 여수 → 시지 申 (보정 16:26 — 미보정이면 酉)', buildSajuChart(yeosu(17, 5)).pillars['시'].branch === '申');
}

if (!ok) { console.log('\n❌ 정확도 게이트 실패 — 공식/테이블 점검'); process.exitCode = 1; }
else console.log('\n🎯 결정론 정확도 통과 — 12운성·공망·합충·신살·진태양시 일반화 확인');
