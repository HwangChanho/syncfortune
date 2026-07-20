// scripts/check-spouse-dual.ts — R-SPOUSE-DUAL 결정론 가드 (daniel 스펙·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가: 배우자 이원 궁위(spouseDualCore)는 daniel 스펙(/R-SPOUSE-DUAL_spec.md §3·§7)을 코드로 박제한 것.
//   세운 라벨(EVENT/TYPE_A±/TYPE_B/CONFIRM)·발동/안착 강도(충90·원진70·파50·격각40 / 육합80·반합50·방합40)가
//   누군가 손대다 서열/매핑이 뒤집히면 "인연 timing 기준이 조용히 바뀐다" — 화면으론 안 잡힌다. 불변식으로 못 박는다.
//
// 골든 = daniel 辛丑 케이스(스펙 §3.2). 배우자성=卯(편재)·배우자궁=丑. 2026~2033 라벨이 스펙 표와 일치해야.
//   ★spouseDualCore 는 @engine 을 런타임 import 하지 않으므로(타입 전용) 이 스크립트가 tsx 로 직접 돈다(check-compat 원리).
// 실행: npm run check:spouse-dual
// ─────────────────────────────────────────────────────────────────────────
import { relationOf, yearLabels, seunBranchOfYear, type SpouseLabel } from '../app/src/lib/love/spouseDualCore';
import type { Branch } from '../spec/chart';

let pass = 0, fail = 0;
const ok = (cond: boolean, msg: string) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL:', msg); } };
const setEq = (a: SpouseLabel[], b: SpouseLabel[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

console.log('§ 발동/안착 강도(§7.1 daniel 07-20)');
ok(relationOf('子', '午').ignition === 90 && relationOf('子', '午').chong, '충 = 발동 90');
ok(relationOf('子', '未').ignition === 70 && relationOf('子', '未').wonjin, '원진 = 발동 70 (子未)');
ok(relationOf('子', '酉').ignition === 50 && relationOf('子', '酉').pa, '파 = 발동 50 (子酉)');
ok(relationOf('丑', '卯').ignition === 40 && relationOf('丑', '卯').gyeokgak, '격각 = 발동 40 (丑卯·사이 寅)');
ok(relationOf('子', '丑').settle === 80 && relationOf('子', '丑').sixhe, '육합 = 안착 80 (子丑)');
ok(relationOf('卯', '未').settle === 50 && relationOf('卯', '未').banhap, '반합 = 안착 50 (卯未·亥卯未 왕지卯)');
ok(relationOf('寅', '卯').settle === 40 && relationOf('寅', '卯').banghap, '방합 = 안착 40 (寅卯·왕지卯)');
ok(relationOf('亥', '丑').settle === 0, '半방(왕지 없음) 미성립 = 안착 0 (亥丑·子 없음)');

console.log('\n§ 세운 지지 산출(연도→지지)');
const seunExp: [number, Branch][] = [[2026, '午'], [2027, '未'], [2028, '申'], [2029, '酉'], [2030, '戌'], [2031, '亥'], [2032, '子'], [2033, '丑']];
for (const [y, b] of seunExp) ok(seunBranchOfYear(y) === b, `${y} 세운지지 = ${b}`);

console.log('\n§ 辛丑 골든 — 배우자성 卯(편재) · 배우자궁 丑 · 세운 라벨(스펙 §3.2)');
const STAR: Branch = '卯', GUNG: Branch = '丑';
const expected: Record<number, SpouseLabel[]> = {
  2026: [],                                        // 午: 丑午원진·卯午파 = 긴장, 라벨 없음(불안정기)
  2027: ['EVENT_CANDIDATE', 'TYPE_A_ACTIVE'],      // 未: 丑未충(궁 발동) + 卯未반합(성 활성) — 분기점
  2028: [],                                        // 申: 卯申원진 = 본인 방합기, 배우자 라벨 없음
  2029: ['TYPE_A_RESOLVE', 'TYPE_B_SETTLE'],       // 酉: 卯酉충(성 정리) + 酉丑반합(궁 정착) — 귀결점
  2030: ['TYPE_A_ACTIVE'],                         // 戌: 卯戌육합(성 활성·신규 인연 후보기)
  2031: ['TYPE_A_ACTIVE'],                         // 亥: 亥卯반합(성 활성·삼합 진전 최고점)
  2032: ['TYPE_B_SETTLE'],                         // 子: 子丑육합(궁 정착·화려→정착 이동)
  2033: ['CONFIRM'],                               // 丑: 복음(궁 확정)
};
for (const [yStr, exp] of Object.entries(expected)) {
  const y = Number(yStr);
  const got = yearLabels(STAR, GUNG, seunBranchOfYear(y));
  ok(setEq(got, exp), `${y} 라벨 [${got.join(', ') || '없음'}] == 스펙 [${exp.join(', ') || '없음'}]`);
}

console.log(`\n${'='.repeat(40)}\nPASS ${pass} / FAIL ${fail}`);
if (fail > 0) process.exit(1);
