// scripts/check-johu74.ts — **R74: 조후 «룩업»과 «충족»을 가르는가** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 **직접 판정**(되물은 것이 아니라 먼저 주신 것):
//   > "巳月은 화왕절이고 壬水는 巳에서 絶地라 … **어떤 壬水든 巳月에 오면 동일하게 水가 나옴.**"
//   > "**조후 조건이 충족된 이상 주도권은 억부·격국으로 넘어감.**"
//   > 충족 트리거: **월지 외 동일 오행 2개 이상 + 합국 + 천간 투출**
//
// ■ 왜 하네스가 필요한가
//   룩업만 읽으면 **수기로 넘치는 원국에도 «용신 水»** 라는 답이 나온다.
//   그건 화면에 그럴듯하게 뜨고, **아무도 틀렸다고 말해 주지 않는다.**
//   ⇒ Boss 가 준 **사례와 대조군**을 값으로 고정한다.
//
// ■ ★대조군을 Boss 가 직접 지정했다
//   *"골든셋 후보: 이 원국(조후 충족 + 식신생재) vs **대조군(巳月 壬水에 수기 부재)**"*
//   대조군은 **룩업대로 水가 살아 있어야** 한다 — 둘 다 맞아야 이 규칙이 의미가 있다.
//
// 실행: npm run check:johu74
// ═══════════════════════════════════════════════════════════════════════════
import { johuSatisfied, johuDemand } from '../engine/johuSatisfied';
import { detectInteractionsAmong } from '../engine/structure';
import { STEM_ELEM, BRANCH_MAIN, tenGod } from '../engine/saju';
import type { SajuChart, PillarPos, Stem, Branch, ChartPosition } from '../spec/chart';

/** 간지 넷으로 최소 차트를 만든다. ★합충은 **엔진이 계산**한다(손으로 넣지 않는다 — 그러면 엔진을 안 시험한 것이다). */
function chartOf(g: Record<PillarPos, string>): SajuChart {
  const POS: PillarPos[] = ['년', '월', '일', '시'];
  const parts = POS.map((p) => ({ pos: p as ChartPosition, stem: g[p][0] as Stem, branch: g[p][1] as Branch }));
  const day = g['일'][0] as Stem;
  const pillars = Object.fromEntries(POS.map((p, i) => {
    const { stem, branch } = parts[i];
    return [p, {
      stem, branch,
      stemTenGod: tenGod(day, stem),
      branchMainTenGod: tenGod(day, BRANCH_MAIN[branch]),
      hiddenStems: [], isRoot: false,
    }];
  })) as SajuChart['pillars'];
  return {
    pillars,
    dayMaster: { stem: day, element: STEM_ELEM[day] },
    interactions: detectInteractionsAmong(parts),   // ★엔진이 찾는다
    luckCycles: [], currentLuck: {} as never, annual: {} as never,
  } as SajuChart;
}

// ★Boss 가 준 사례 — 丙子 癸巳 壬子 甲辰 (女)
export const CASE = chartOf({ 년: '丙子', 월: '癸巳', 일: '壬子', 시: '甲辰' });
// ★Boss 가 지정한 대조군 — «巳月 壬水에 수기 부재»
//   같은 일간·월지인데 수기가 없다: 년 丙寅 · 시 戊午(火土) — 子도 辰도 없고 천간 水는 일간뿐
export const CONTROL = chartOf({ 년: '丙寅', 월: '癸巳', 일: '壬午', 시: '戊申' });

const isMain = process.argv[1]?.includes('check-johu74');
if (isMain) {
  console.log('\n🌡  R74 — 조후 «룩업» 과 «충족» 을 가르는가\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(44)} ${note}`); };

  // ── J1 룩업은 **월령만** 본다 — 두 원국이 같은 답이어야 한다 ────────────────
  const d1 = johuDemand(CASE), d2 = johuDemand(CONTROL);
  say(d1 === '水' && d2 === '水', 'J1 巳月이면 둘 다 룩업 «水»',
    `사례 ${d1} · 대조군 ${d2}  ← "어떤 壬水든 巳月에 오면 동일하게 水"`);

  // ── J2 ★사례는 **충족** ───────────────────────────────────────────────────
  const a = johuSatisfied(CASE);
  say(a.satisfied, 'J2 사례(丙子 癸巳 壬子 甲辰)는 **조후 득**', a.detail);
  say(a.branchCount >= 2, 'J2a 월지 외 水 지지가 2개 이상', `${a.branchCount}개`);
  say(a.hasCombine, 'J2b 水로 가는 합국이 있다(子辰 반합)', a.hasCombine ? '' : '★엔진이 반합을 못 찾았습니다');
  say(a.hasStem, 'J2c 천간 투출이 있다(癸水)', a.hasStem ? '' : '');

  // ── J3 ★대조군은 **미충족** — 룩업대로 조후 水가 살아 있어야 한다 ──────────
  const b = johuSatisfied(CONTROL);
  say(!b.satisfied, 'J3 대조군(수기 부재)은 **조후 미충족**', b.detail);

  // ── J4 봄·가을은 **판정하지 않는다**(문서가 «참작 가변» 이라고 했다) ────────
  const spring = chartOf({ 년: '丙子', 월: '癸卯', 일: '壬子', 시: '甲辰' });
  const c = johuSatisfied(spring);
  say(!c.known && c.demand === null, 'J4 봄·가을은 판정을 멈춘다(모르면 안 정한다)', c.detail);

  // ── J5 세 신호를 **따로** 돌려준다(합쳐서 숨기지 않는다) ────────────────────
  say(['demand', 'branchCount', 'hasCombine', 'hasStem', 'satisfied'].every((k) => k in a),
    'J5 세 신호를 따로 낸다(사후 변명 장치 방지)', '');

  if (bad) { console.log(`\n❌ ${bad}건 — 룩업만 읽으면 «수기로 넘치는데 水가 용신» 이 나옵니다.\n`); process.exit(1); }
  console.log('\n✅ 룩업은 월령만, 충족은 원국을 본다 — 사례·대조군 모두 맞음\n');
}
