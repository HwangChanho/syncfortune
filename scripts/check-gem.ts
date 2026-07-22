// scripts/check-gem.ts — R-GEM v0.1 결정론 골든 가드 (daniel 스펙·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가: 보석 추천(recommendGem)은 용신·희신·기신(computeYongsinApprox) 위에 '조후 오버라이드'와
//   '서양탄생석 대조(match/debunk)'를 얹은 결정론이다. 누군가 오행→보석 매핑, 조후 트리거 지지, match 판정을
//   손대면 "추천 보석이 조용히 바뀐다" — 화면으론 안 잡힌다. 골든 엔트리 #1(daniel 원국)로 못 박는다.
//
// ★recommendGem → computeYongsinApprox 는 @engine/structure 를 '런타임' import 한다(scoreStrength).
//   그래서 이 스크립트는 반드시 app tsconfig 로 alias 를 풀어 실행한다:
//     tsx --tsconfig app/tsconfig.json scripts/check-gem.ts   (package.json check:gem)
//
// ⚠️강약 라벨 텐션(문서화): 스펙/골든은 daniel 차트를 '신약'(전문가 재판정 2026-07-14)으로 기술하나,
//   앱 결정론 엔진 scoreStrength 는 이 차트를 '신강'(ADR-009)으로 판정한다. 단 두 경로 모두 용신 土·희신 金 으로
//   수렴하므로 보석 추천 결과는 동일 — 그래서 이 하네스는 '강약 라벨'이 아니라 '최종 용신·희신·보석'에 assert 한다.
//
// 실행: npm run check:gem
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from '../engine/saju';
import { entry001Self } from '../engine/fixtures/entry-001-self.fixture';
import { computeYongsinApprox } from '../app/src/lib/content/yongsinApprox';
import { recommendGem } from '../app/src/lib/content/gemRecommend';
import { gemCopy, gemCopyLength } from '../app/src/lib/content/gemCopy';
import type { ChartInput } from '../spec/chart';

let pass = 0, fail = 0;
const ok = (cond: boolean, msg: string) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL:', msg); } };
const build = (input: ChartInput) => buildSajuChart(input, 2026);

// ── 골든 엔트리 #1 — daniel 甲戌·丁卯·辛丑·丁酉 (male, 1994-03-16 酉시) ──────────────
console.log('§ 골든 #1 — daniel 원국(辛金 일간·월지 卯) · 생월 3월');
const saju = build(entry001Self.input);
const rec = recommendGem(saju, 3); // 양력 3월생

// 참고 로그: 엔진이 실제로 산출한 강약·용신(텐션 문서화용·assert 아님)
const y = computeYongsinApprox(saju);
console.log(`   [info] scoreStrength verdict=${y.strengthVerdict} · method=${y.method} · 용신=${y.yongsin} 희신=${y.huisin} 기신=${y.gisin}`);
console.log(`   [info] 골든 전문가 판정(fixture)=${entry001Self.saju.structure?.strength.verdict}  ← 스펙 '신약' 앵커(두 경로 모두 土/金 수렴)`);

// (1) 주보석 = 용신 土 · 조후 오버라이드 미발동(월지 卯) · 대표석 시트린
ok(rec.primaryGem.element === '土', `주보석 오행 = 土 (억부용신) [got ${rec.primaryGem.element}]`);
ok(rec.primaryGem.basis === 'eokbu', `basis = 'eokbu' (월지 卯 → 조후 비발동) [got ${rec.primaryGem.basis}]`);
ok(rec.primaryGem.tiers.standard.key === 'citrine' && rec.primaryGem.tiers.standard.ko === '시트린', '대표석(土 standard) = 시트린(citrine)');
// (2) 보조석 = 희신 金 · 피할 보석 = 기신 火
ok(rec.secondaryGem?.element === '金', `보조석 오행 = 金 (희신) [got ${rec.secondaryGem?.element}]`);
ok(rec.avoidGem.element === '火', `피할 보석 오행 = 火 (기신) [got ${rec.avoidGem.element}]`);
// (3) 서양탄생석 3월 = 아쿠아마린(水)
ok(rec.westernBirthstone.month === 3 && rec.westernBirthstone.gem === 'aquamarine' && rec.westernBirthstone.element === '水',
  `서양탄생석 3월 = aquamarine(水) [got ${rec.westernBirthstone.gem}/${rec.westernBirthstone.element}]`);
// (4) matchType = debunk (土 ≠ 水)
ok(rec.matchType === 'debunk', `matchType = 'debunk' (土≠水) [got ${rec.matchType}]`);
// (5) 골든 앵커: 전문가 판정 = 신약(daniel 전문가 재판정 ground truth)
ok(entry001Self.saju.structure?.strength.verdict === '신약', "골든 전문가 판정(fixture) = '신약'");

// ── 카피 4요소(120자 이내 + 원국 구체 삽입) ──────────────────────────────
console.log('\n§ 카피 템플릿(gemCopy) — 120자 이내 · 원국 구체(辛金) 삽입');
const dm = saju.dayMaster;
const copy = gemCopy({
  dayStem: dm.stem, dayEl: dm.element, monthBranch: saju.pillars['월'].branch,
  primaryEl: rec.primaryGem.element, basis: rec.primaryGem.basis, birthMonth: 3,
  westernKo: rec.westernBirthstone.ko, primaryGemKo: rec.primaryGem.tiers.standard.ko, matchType: rec.matchType,
});
console.log(`   hook   : ${copy.hook}\n   insight: ${copy.insight}\n   basis  : ${copy.basis}\n   cta    : ${copy.cta}`);
ok(gemCopyLength(copy) <= 120, `카드 4요소 총 ${gemCopyLength(copy)}자 ≤ 120`);
ok(copy.basis.includes('辛金'), "근거 1줄에 원국 구체(辛金 일간) 삽입 — 보일러플레이트 아님");
ok(copy.hook.includes('아쿠아마린') && copy.hook.includes('3월'), '훅에 생월·서양탄생석 반영');

// ── match 분기(같은 차트·11월 탄생석=土) ─────────────────────────────────
console.log('\n§ match 분기 — 같은 차트에 11월(토파즈=土) → 주보석 土와 일치');
const rec11 = recommendGem(saju, 11);
ok(rec11.westernBirthstone.element === '土', `11월 탄생석 오행 = 土 [got ${rec11.westernBirthstone.element}]`);
ok(rec11.matchType === 'match', `matchType = 'match' (土==土) [got ${rec11.matchType}]`);

// ── 조후 오버라이드(안 A) 골든 ───────────────────────────────────────────
console.log('\n§ 조후 오버라이드 — 겨울 극한(火 부재) → 주보석 火');
const winter = build({ birthDateTime: '1988-12-25 08:00', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울' }); // 월지 子·원국 火 없음
const recW = recommendGem(winter, 12);
ok(winter.pillars['월'].branch === '子', `(전제) 월지 = 子 [got ${winter.pillars['월'].branch}]`);
ok(recW.primaryGem.element === '火' && recW.primaryGem.basis === 'johu_override', `주보석 = 火 · basis 'johu_override' [got ${recW.primaryGem.element}/${recW.primaryGem.basis}]`);
ok(recW.primaryGem.tiers.standard.key === 'garnet', '火 대표석 = 가넷(garnet)');

console.log('\n§ 조후 오버라이드 — 여름 극서(水 부재) → 주보석 水');
const summer = build({ birthDateTime: '1994-06-10 11:00', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울' }); // 월지 午·원국 水 없음
const recS = recommendGem(summer, 6);
ok(summer.pillars['월'].branch === '午', `(전제) 월지 = 午 [got ${summer.pillars['월'].branch}]`);
ok(recS.primaryGem.element === '水' && recS.primaryGem.basis === 'johu_override', `주보석 = 水 · basis 'johu_override' [got ${recS.primaryGem.element}/${recS.primaryGem.basis}]`);
ok(recS.primaryGem.tiers.standard.key === 'aquamarine', '水 대표석 = 아쿠아마린(aquamarine)');

console.log('\n§ 오버라이드 가드 — 겨울이라도 원국에 火 있으면 미발동(억부 유지)');
const winterHasFire = build({ birthDateTime: '1990-01-05 10:00', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울' }); // 월지 子이나 원국 火 존재
const recWF = recommendGem(winterHasFire, 1);
ok(winterHasFire.pillars['월'].branch === '子', `(전제) 월지 = 子 [got ${winterHasFire.pillars['월'].branch}]`);
ok(recWF.primaryGem.basis === 'eokbu', `火 존재 → 오버라이드 미발동(basis 'eokbu') [got ${recWF.primaryGem.basis}]`);

console.log(`\n${'='.repeat(40)}\nPASS ${pass} / FAIL ${fail}`);
declare const process: { exit(c?: number): never };
if (fail > 0) process.exit(1);
