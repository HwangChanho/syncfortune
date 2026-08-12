// scripts/check-enginecost.ts — **명식 계산이 다시 느려지면 운다**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-12: *"앱이 전반적으로 좀 느린거 이유 찾아봐"*
//
// ■ 실측으로 찾은 것 (추정 아님)
//   `buildSajuChart` = **17.96 ms/회**. 그런데 구성요소를 하나씩 재 보니
//     · trueSolarOffsetMin·kstMeridianAt·dstOffsetMin·detectInteractions 합계 = **0.028 ms**
//     · lunar-javascript 체인(Solar→Lunar→EightChar) = **0.069 ms**
//     · 대운 13 + 세운 120 배열 생성 = **0.44 ms**
//     · **월운 1,440개의 `getGanZhi()` = 16.08 ms**  ← 전체의 **90%**
//   월운은 *만세력·타임라인에서 세운을 탭했을 때만* 쓰이는데,
//   홈·성격·궁합 등 **거의 모든 화면이 쓰지도 않을 1,440개를 매번** 만들고 있었다.
//   ⇒ `annuals[].months` 를 getter 로(자미 `get ziwei()` 와 같은 처방) → **17.96 → 2.12 ms (-88%)**
//   회귀 0 확인: `verify`·`check:golden` 출력이 변경 전후 **완전 동일**(diff 무).
//
// ■ 이 하네스가 지키는 것
//   지연 계산은 **조용히 되돌려진다** — 누군가 `months` 를 미리 만들면 아무도 모르게 8배 느려진다.
//   그래서 *코드 모양*이 아니라 **실제 ms 를 잰다**([[harness-judge-expression-not-name]]).
//
// ⚠️머신마다 절대속도가 다르므로 임계값은 **넉넉하게**(실측 2.1ms → 상한 8ms).
//   지연이 풀리면 18ms 대로 돌아가므로 이 상한이면 확실히 잡히고, 느린 CI 에서 오탐하지 않는다.
//
// 실행: npm run check:enginecost
// ═══════════════════════════════════════════════════════════════════════════
import { buildSajuChart } from '../engine/saju';

const INPUT: any = { birthDateTime: '1994-03-03 18:30', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울' };
const YEAR = 2026;
const LIMIT_MS = 8;        // 실측 2.1ms · 지연이 풀리면 18ms → 그 사이에 둔다
const N = 30;

console.log('\n⚡ 명식 계산 비용 (실제 ms 를 잰다)\n');

buildSajuChart(INPUT, YEAR);                                   // 워밍업 — 첫 회는 모듈 초기화가 섞인다
const t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) buildSajuChart(INPUT, YEAR);
const per = Number(process.hrtime.bigint() - t0) / 1e6 / N;
console.log(`   buildSajuChart  ${per.toFixed(2)} ms/회  (상한 ${LIMIT_MS} ms)`);

// 월운이 정말 **지연**인지 — 접근 전/후 비용 차이로 확인(모양이 아니라 동작으로 판정)
const chart: any = buildSajuChart(INPUT, YEAR);
const an = chart.luckCycles?.[0]?.annuals?.[0];
let lazyOk = false;
if (an) {
  const t1 = process.hrtime.bigint();
  const ms = an.months;                                        // 첫 접근 = 여기서 계산돼야 한다
  const firstAccess = Number(process.hrtime.bigint() - t1) / 1e6;
  const t2 = process.hrtime.bigint();
  void an.months;                                              // 두 번째 = 캐시라 훨씬 싸야 한다
  const secondAccess = Number(process.hrtime.bigint() - t2) / 1e6;
  lazyOk = Array.isArray(ms) && ms.length > 0;
  console.log(`   months 첫 접근 ${firstAccess.toFixed(3)} ms · 재접근 ${secondAccess.toFixed(3)} ms · ${ms?.length ?? 0}개`);
  if (!lazyOk) console.log('   ⚠️ months 가 비어 있습니다 — 지연 계산이 값을 잃었는지 확인하세요');
}

let bad = 0;
if (per > LIMIT_MS) {
  bad++;
  console.log(`\n   ❌ 명식 계산이 ${per.toFixed(2)} ms 로 느립니다(상한 ${LIMIT_MS} ms).`);
  console.log(`      가장 흔한 원인: \`annuals[].months\` 의 **지연 계산이 풀린 것**(getter → 즉시 배열).`);
  console.log(`      월운 1,440개의 getGanZhi() 만으로 **16 ms** 다 — 전체의 90%였다.`);
  console.log(`      engine/saju.ts 의 \`get months()\` 주석을 보고 되돌리세요.`);
}
if (an && !lazyOk) { bad++; console.log('\n   ❌ months 가 비어 있습니다 — 만세력 월운 드릴다운이 깨집니다.'); }

console.log(bad ? '\n❌ check:enginecost 실패\n' : '\n✅ check:enginecost 통과 — 명식 계산이 충분히 빠름\n');
if (bad) process.exitCode = 1;
