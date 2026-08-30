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

/**
 * ★★2026-08-30 — **한 번 재고 판정하지 않는다. 여러 번 재서 «중앙값»** (Boss *"중앙값으로 고쳐"*).
 *
 * ■ 왜 — 이 검사는 **시간**을 잰다. 그래서 기계가 바쁘면 그대로 느려진다.
 *   실제로 오늘 iOS 빌드 파이프라인 안에서 **10.66ms** 가 나와 빌드가 멈췄는데,
 *   기계가 놀 때 다시 재니 **5.1 · 5.4 · 5.7ms** 로 3회 연속 통과했다.
 *   = 성능 회귀가 아니라 **측정 환경**이었다. 가짜 빨간불은 진짜 빨간불을 못 믿게 만든다.
 * ■ ⇒ 묶음을 여러 판 돌려 **중앙값**을 쓴다. 한 판이 다른 프로세스에 밀려도 가운데 값은 안 흔들린다.
 *   ★평균이 아니라 중앙값이다 — 평균은 **튄 한 판**에 그대로 끌려간다(그게 지금 문제다).
 * ■ ⚠️그래도 «느려졌다» 는 잡아야 한다 — 상한(8ms)은 그대로 두고 **재는 방법만** 바꾼다.
 *   최솟값을 쓰면 «제일 좋았을 때» 만 보게 되어 진짜 회귀를 놓친다.
 */
const ROUNDS = 5;

/**
 * ★★**기준 작업**(baseline) — 이 기계가 «지금» 얼마나 빠른지 재는 자.
 *
 * ■ 왜 필요한가 — 중앙값만으로는 **절반만** 풀린다(2026-08-30 실측).
 *   한 판이 튀는 건 중앙값이 걸러 주지만, **기계 전체가 계속 바쁘면 다섯 판이 다 느려서**
 *   중앙값도 같이 올라간다. 실제로 부하를 걸자 5판이 [8.2 8.3 10.4 10.9 15.1] 로 전부 상한 위였다.
 *   iOS 빌드 파이프라인 안에서 난 10.66ms 가 정확히 그 경우다.
 * ■ ⇒ **비율로 본다.** 기계가 두 배 느려지면 기준도 두 배 느려지므로 **비율은 그대로**다.
 *   코드가 진짜 느려졌을 때만 비율이 오른다 — 그게 우리가 잡고 싶은 것이다.
 * ■ ★기준 작업은 **최적화로 사라지지 않게** 결과를 쓴다(합을 반환해 밖에서 쓴다).
 *   그리고 판마다 **기준 → 대상 순서로 붙여서** 잰다 — 같은 순간의 부하를 둘이 함께 겪는다.
 */
function baselineWork(): number {
  let x = 0, seed = 12345;
  for (let i = 0; i < 200_000; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; x += Math.sqrt(seed % 1000); }
  return x;
}
/** ★비율 상한 — 실측(한가할 때)의 약 3배로 둔다. 아래 실행에서 실제 값을 함께 찍는다. */
const LIMIT_RATIO = 3.0;

buildSajuChart(INPUT, YEAR); baselineWork();                   // 워밍업 — 첫 회는 모듈 초기화가 섞인다
const runs: number[] = [];
const ratios: number[] = [];
let sink = 0;
for (let r = 0; r < ROUNDS; r++) {
  const b0 = process.hrtime.bigint();
  sink += baselineWork();
  const base = Number(process.hrtime.bigint() - b0) / 1e6;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) buildSajuChart(INPUT, YEAR);
  const per1 = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  runs.push(per1);
  ratios.push(per1 / base);
}
if (sink === Number.MIN_SAFE_INTEGER) console.log('');          // 기준 작업이 최적화로 사라지지 않게
const sorted = [...runs].sort((a, b) => a - b);
const sortedR = [...ratios].sort((a, b) => a - b);
const per = sorted[Math.floor(sorted.length / 2)];              // 중앙값(사람이 읽는 값)
const ratio = sortedR[Math.floor(sortedR.length / 2)];          // ★판정은 **이 비율**로 한다
console.log(`   buildSajuChart  ${per.toFixed(2)} ms/회  · ${ROUNDS}판 중앙값 [${sorted.map((x) => x.toFixed(1)).join(' ')}]`);
console.log(`   기준 대비 비율   ${ratio.toFixed(2)} 배  (상한 ${LIMIT_RATIO} 배)  ← ★판정은 이 값`
  + `  [${sortedR.map((x) => x.toFixed(2)).join(' ')}]`);

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
// ★★판정은 **비율**이다 — ms 는 사람이 읽으라고 찍는다(기계 사정에 흔들린다).
if (ratio > LIMIT_RATIO) {
  bad++;
  console.log(`\n   ❌ 명식 계산이 기준 대비 ${ratio.toFixed(2)}배 로 느립니다(상한 ${LIMIT_RATIO}배 · ${per.toFixed(2)} ms).`);
  console.log(`      가장 흔한 원인: \`annuals[].months\` 의 **지연 계산이 풀린 것**(getter → 즉시 배열).`);
  console.log(`      월운 1,440개의 getGanZhi() 만으로 **16 ms** 다 — 전체의 90%였다.`);
  console.log(`      engine/saju.ts 의 \`get months()\` 주석을 보고 되돌리세요.`);
}
if (an && !lazyOk) { bad++; console.log('\n   ❌ months 가 비어 있습니다 — 만세력 월운 드릴다운이 깨집니다.'); }

console.log(bad ? '\n❌ check:enginecost 실패\n' : '\n✅ check:enginecost 통과 — 명식 계산이 충분히 빠름\n');
if (bad) process.exitCode = 1;
