// engine/verify-engine.ts — 결정론 *정확도* 게이트 (공식 산출 ↔ 알려진 명리 정답)
// ─────────────────────────────────────────────────────────────────────────
// 12운성(양간 순행·음간 역행)·공망(순중공망) 같은 '공식' 산출이 명리 표준값과 일치하는지 교차검증.
//   테이블 오류·역행 방향 실수를 게이트로 차단. (신살 매핑은 고정 테이블이라 부차 — run-sinsal로 확인.)
// 실행: npm run verify:engine
// ─────────────────────────────────────────────────────────────────────────
import { twelveStage } from './twelve';
import { gongmang } from './sinsal';
import { detectInteractions } from './structure';
import type { Stem, Branch, PillarPos, SajuChart } from '../spec/chart';

let ok = true;
const mark = (p: boolean) => (p ? '✅' : '❌');

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
  ['辛', '丑', '辰', '巳'],  // 辛丑(甲午순) — 본인
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

if (!ok) { console.log('\n❌ 정확도 게이트 실패 — 공식/테이블 점검'); process.exitCode = 1; }
else console.log('\n🎯 결정론 정확도 통과 — 12운성·공망·합충형해가 명리 표준과 일치');
