// scripts/check-compat.ts — 궁합 결정론 점수 가드(daniel 6기준·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가: 궁합 점수(compatScore)는 daniel 명리 stance를 코드로 박제한 것이다(2026-07-17).
//   ① 계절 한난 상보 ② 상대→나 재/관 ③ 결핍 지지 보완 ④ 일간관계(충>합, 발전형)
//   ⑤ 용신공급+교차합 ⑥ 배우자궁(일지) 형충파해원진귀문 감점.
//   가중치를 누가 손대다 이 서열/부호가 뒤집히면 "궁합 기준이 조용히 바뀐다" — 화면으로는 안 잡힌다.
//   그래서 daniel이 준 기준이 실제 점수에 반영되는지 **불변식**으로 못 박는다.
//
// ★compatScore.ts 는 @engine 을 **타입 전용**으로만 import(런타임 제거) → 이 스크립트가
//   상대경로로 직접 호출해도 alias 없이 tsx 로 돈다(check-sharedchart 와 동일 원리).
//
// 실행: npm run check:compat
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from '../engine/saju';
import { detectInteractions } from '../engine/structure';
import { analyzeCompatibility } from '../engine/compatibility';
import { entry001Self } from '../engine/fixtures/entry-001-self.fixture';
import { compatScore } from '../app/src/lib/content/compatScore';
import type { ChartInput } from '../spec/chart';

let failed = 0;
const fail = (m: string) => { console.error(`  ❌ ${m}`); failed++; };
const pass = (m: string) => console.log(`  ✅ ${m}`);
const ok = (cond: boolean, m: string) => (cond ? pass(m) : fail(m));

// 나 = entry001(일간 辛, 일지 丑). structure 주입(용신 상보용).
const me = buildSajuChart(entry001Self.input);
me.interactions = detectInteractions(me);
me.structure = entry001Self.saju.structure;

const build = (input: ChartInput) => { const c = buildSajuChart(input); c.interactions = detectInteractions(c); return c; };
// 검증용 상대(비PII 예시). 각기 다른 축을 자극하도록 고른 날짜.
const A = build({ birthDateTime: '1996-05-20 14:30', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '서울' }); // 丁巳日 관성·배우자궁 깨끗
const B = build({ birthDateTime: '1988-11-03 09:00', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '부산' }); // 壬戌日 계절상보·식상·배우자궁 형
const C = build({ birthDateTime: '1993-07-12 22:00', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '대구' }); // 甲午日 재성이나 배우자궁 해·원진 2종(귀문은 daniel 관법상 결정론 제외)

const dxA = analyzeCompatibility(me, A), sA = compatScore(dxA);
const dxB = analyzeCompatibility(me, B), sB = compatScore(dxB);
const dxC = analyzeCompatibility(me, C), sC = compatScore(dxC);

console.log('■ check:compat — 궁합 결정론 점수 가드(daniel 6기준)');
console.log(`  나 辛丑 · A ${sA.score}(${sA.tier.ko}) · B ${sB.score}(${sB.tier.ko}) · C ${sC.score}(${sC.tier.ko})`);

console.log('\n[1] 점수 클램프 [15,97] — §4 부정 증폭 금지(극단 회피)');
[sA, sB, sC].forEach((s, i) => ok(s.score >= 15 && s.score <= 97, `${'ABC'[i]} 점수 ${s.score} ∈ [15,97]`));

console.log('\n[2] ② 상대→나 재/관 판정(내 관점·재관 동일)');
ok(sA.jaegwan === '관성', `A: 상대 丁(火)→내 辛(金) = 관성(favorable) [${dxA.partnerToMe.tenGod}]`);
ok(sC.jaegwan === '재성', `C: 상대 甲(木)→내 辛(金) = 재성(favorable) [${dxC.partnerToMe.tenGod}]`);
ok(sB.jaegwan === null, `B: 상대 壬(水)→내 辛(金) = 식상(재/관 아님) [${dxB.partnerToMe.tenGod}]`);

console.log('\n[3] ① 계절 한난 상보(월지 봄여름↔가을겨울)');
ok(sB.seasonComplement === true, `B: 내 卯(봄여름) ↔ 상대 戌(가을겨울) = 상보`);
ok(sA.seasonComplement === false && sC.seasonComplement === false, `A·C: 둘 다 봄여름군 = 상보 아님`);

console.log('\n[4] ⑥ 배우자궁 형충파해원진 감점 — ★2026-08-24 **범위 확대**(Boss "범위 넓혀")');
// ★★여기 있던 `A: 일지 丑·巳 충돌 없음(clean)` 은 **옛 stance** 였다.
//   종전 규칙(두 사람 **일지끼리만**)에서는 깨끗했지만, 전문가 케이스 노트는 상대의 월지·시지가
//   내 배우자궁을 치는 것도 배우자궁 상호작용으로 센다(케이스 003: B 일지 丑 ↔ A 월지·시지 未).
//   ⇒ stance 가 뒤집혔으므로 **코드가 아니라 이 단언을 먼저** 고친다([[harness-can-enforce-wrong-rule]]).
ok(!dxA.spousePalace.clean, `A: 확대 범위가 잡는다 — ${dxA.spousePalace.detail}`);
// ★확대가 실제로 한 일인지 증명한다: 일지끼리가 아니라 **다른 자리**에서 온 hit 가 있어야 한다.
ok(dxA.spousePalace.hits.some((h) => h.at !== '일'),
  `A: 일지 아닌 자리에서 왔다 [${dxA.spousePalace.hits.map((h) => `${h.mine}${h.theirs}${h.kind}@${h.at}`).join(' ')}] — 종전 규칙이면 0건`);
ok(dxB.spousePalace.afflictions.includes('형'), `B: 형 검출 [${dxB.spousePalace.afflictions.join('·')}]`);
ok(dxC.spousePalace.afflictions.length >= 2 && !dxC.spousePalace.afflictions.includes('귀문' as any), `C: ${dxC.spousePalace.afflictions.join('·')}(2종+·귀문 제외 확인)`);
// ★감점이 실제로 먹는가 — **같은 재료에서 배우자궁만 바꿔** 본다.
//   (A·C 실점수 비교는 확대 뒤 다른 항목까지 섞여 흔들린다. 부호는 이렇게 봐야 정확하다.)
{
  const noAffl = compatScore({ ...dxC, spousePalace: { afflictions: [], hits: [], clean: true, detail: '' } } as any).score;
  ok(sC.score < noAffl, `배우자궁 감점이 먹는다 — 있음 ${sC.score} < 없음 ${noAffl}`);
}

console.log('\n[5] ③ 결핍 지지 보완(상대가 내게 없는 지지 글자)');
[dxA, dxB, dxC].forEach((dx, i) => ok(dx.missingFill.chars.length > 0, `${'ABC'[i]}: 결핍 보완 ${dx.missingFill.chars.join('·') || '없음'}`));

console.log('\n[6] ④ 일간관계 서열 — 충>상생>합>비화>상극(일간충=발전형 가점)');
// 산식 부호 확인: 같은 재료에서 dmType 만 바꿔 상대 점수 서열이 유지되는지(합성 dx)
const baseDx = { ...dxA, seasonComplement: { ...dxA.seasonComplement, complementary: false }, partnerToMe: { ...dxA.partnerToMe, favorable: false }, missingFill: { chars: [], detail: '' }, spousePalace: { afflictions: [], hits: [], clean: true, detail: '' }, crossInteractions: [], usefulGodSupply: { element: null, supply: '없음' as const, detail: '' } };
const sc = (type: any) => compatScore({ ...baseDx, dayMasterRelation: { type, detail: '' } } as any).score;
ok(sc('충') > sc('합'), `충(${sc('충')}) > 합(${sc('합')}) — daniel "충이 발전형, 합은 정체"`);
ok(sc('상생') >= sc('합') && sc('합') > sc('상극'), `상생(${sc('상생')}) ≥ 합(${sc('합')}) > 상극(${sc('상극')})`);

console.log(failed ? `\n❌ check:compat 실패 ${failed}건` : '\n✅ check:compat 통과');
process.exit(failed ? 1 : 0);
