// app/src/lib/content/hourFlow.ts — 「오늘의 시간대」 12시진 (무료 · 온디바이스 결정론 · API 0)
// ═══════════════════════════════════════════════════════════════════════════
// 기획: `신규컨텐츠기획문서/신규콘텐츠_기획_2026-08-10.md` §4(C안) · §6-5 순서 3번
//   빈 곳 = **하루 안**. 시간축 콘텐츠가 아홉인데 전부 하루 이상 단위(오늘·이달·올해·10년)다.
//   강점 = **리텐션**(하루에 여러 번 열 이유). 약점 = 깊이가 얕다 → 해자가 아니라 편의 기능이라
//   **무료·온디바이스로만** 낸다(기획서 §9 규칙 5).
//
// ■ ★새 명리 판정이 하나도 없다 — 전부 이미 있는 것의 재사용이다
//   · 시진 표(경계·대표시각) = `engine/sijin.ts` (명식 등록 폼이 쓰던 것)
//   · 시주 干支 = **lunar-javascript** 가 낸다(엔진과 같은 라이브러리) — 오자둔법 표를 따로 안 적는다
//   · 십신·5그룹 = `dailyFortune.GROUP` **그대로 import**(거기서 다시 적으면 두 콘텐츠가 갈린다)
//   · 억부 우호도·합충 = `classifyStrength` · `detectInteractionsAmong`
//
// ■ ⚠️시각 미상 명식에서도 동작해야 한다(기획서 §4 C안 단서)
//   이 콘텐츠는 **오늘 일진**에서 출발하므로 내 시주를 안 쓴다 → 시각 미상이어도 그대로 선다.
//   (내 원국과의 합충을 볼 때만 네 기둥을 쓰는데, 시주가 없으면 그 자리만 빠진다.)
// ═══════════════════════════════════════════════════════════════════════════
import { Solar } from 'lunar-javascript';
import { tenGod } from '@engine/saju';
import { classifyStrength, detectInteractionsAmong } from '@engine/structure';
import { SIJIN } from '../engine/sijin';
import { GROUP } from './tenGodGroup';
import type { SajuChart, Stem, Branch, PillarPos, ChartPosition, TenGod } from '@spec/chart';

/** 한 시진의 결. 점수만 주면 반증이 불가능해지므로 **무엇이 그 점수를 만들었는지**를 함께 낸다. */
export type HourSlot = {
  /** 시진 지지 한자(子丑寅…) · 한글 이름 · 표시용 시간대. `sijin.ts` 그대로. */
  gz: string; ko: string; range: string;
  /** 그 시진의 干支 — 오늘 일간 기준(라이브러리 산출). */
  stem: Stem; branch: Branch;
  /** 내 일간에서 본 그 시진 천간의 십신 · 5그룹. */
  tenGod: TenGod; group: string;
  /** 그 기운이 내 강약에 우호적인가(억부 — `dailyEnergy` 와 같은 기준). */
  favorGood: boolean;
  /** 그 시진 지지가 내 원국과 **합**을 맺는가 / **충·형**으로 부딪히는가. */
  bond: boolean; clash: boolean;
  /** 0~100. 기준 50에서 위 네 가지로만 움직인다(새 가중치를 만들지 않았다 — 아래 주석). */
  score: number;
  /** 지금 이 시각이 이 시진인가(화면이 '지금' 배지를 붙이는 데 쓴다). */
  now: boolean;
};

// ★가감 폭은 `dailyEnergy` 와 **같은 계열**로 맞췄다(억부가 주축 · 합/충이 보조).
//   여기서 다른 숫자를 쓰면 "오늘은 좋은 날인데 시간대는 다 나쁘다" 같은 어긋남이 난다.
const W_FAVOR = 14;   // 억부 우호(주축) — dailyEnergy 와 동일
const W_BOND = 8;     // 합(어우러짐)  — 동일
const W_CLASH = 12;   // 충·형(부딪힘) — 동일

/**
 * 오늘 하루를 12시진으로 갈라 각 구간의 결을 낸다.
 *
 * @param saju  내 원국. **시주가 없어도 된다**(이 콘텐츠는 오늘 일진에서 출발한다).
 * @param dateISO 'YYYY-MM-DD' — 오늘(또는 내일) 날짜. 시진 干支는 이 날짜로 뽑는다.
 * @param nowHour 지금 시각의 '시'(0~23). 넘기지 않으면 '지금' 배지를 아무 데도 안 붙인다.
 * @returns 12개 시진. **子시부터 순서대로**(하루의 시작이 子시라 시간표가 자연스럽다).
 *
 * @example
 *   const slots = hourFlow(saju, '2026-08-10', new Date().getHours());
 *   slots.find((s) => s.now)?.ko   // '미시'
 */
export function hourFlow(saju: SajuChart, dateISO: string, nowHour?: number): HourSlot[] {
  const me = saju.dayMaster.stem;
  const sc = classifyStrength(saju);
  const strong = sc.type === '신왕' || sc.type === '신강';
  const weak = sc.type === '신약';
  const [y, m, d] = dateISO.split('-').map(Number);

  // 내 원국 네 기둥 — 시진과의 합충을 보려고 미리 만든다(시주가 비면 그 자리만 빠진다).
  const POS: PillarPos[] = ['년', '월', '일', '시'];
  const natal = POS
    .filter((p) => saju.pillars[p]?.branch)
    .map((p) => ({ pos: p as ChartPosition, stem: saju.pillars[p].stem, branch: saju.pillars[p].branch }));

  return SIJIN.map((sj) => {
    // 시주 干支 — 엔진과 **같은 라이브러리**에 맡긴다(오자둔법 표를 여기 다시 적지 않는다).
    const [hh] = sj.hm.split(':').map(Number);
    const gz = (Solar as any).fromYmdHms(y, m, d, hh, 0, 0).getLunar().getTimeInGanZhi() as string;
    const stem = gz[0] as Stem;
    const branch = sj.gz as Branch;   // 지지는 시진 정의 그대로(라이브러리 값과 동일하지만 정의가 정본)

    const tg = tenGod(me, stem);
    const group = GROUP[tg];
    // 억부 우호도 — `dailyEnergy` 와 같은 기준. 중화는 어느 쪽도 불리하지 않다고 본다.
    const favorGood = weak ? (group === '비겁' || group === '인성')
      : strong ? (group === '식상' || group === '재성' || group === '관성')
      : true;

    // 그 시진이 내 원국과 맺는 관계 — 시간층이라 **거리 조건 예외**(`000c#5`)가 자동 적용된다
    //   (`detectInteractionsAmong` 은 '시운' 을 원국 자리로 세지 않아 인접 검사를 통과시킨다).
    const links = detectInteractionsAmong([...natal, { pos: '월운' as ChartPosition, stem, branch }])
      .filter((it) => it.members.includes('월운' as ChartPosition) && it.level !== '천간');
    const bond = links.some((it) => it.type === '합');
    const clash = links.some((it) => it.type === '충' || it.type === '형');

    let s = 50 + (favorGood ? W_FAVOR : -W_FAVOR) + (bond ? W_BOND : 0) - (clash ? W_CLASH : 0);
    s = Math.max(20, Math.min(90, Math.round(s)));

    // '지금' 판정 — 시진 경계는 `range`('23–01시')가 아니라 대표시각에서 ±1시간으로 되돌린다.
    //   子시만 날짜를 걸쳐 있어(23~01) 따로 본다.
    const now = nowHour == null ? false
      : sj.gz === '子' ? (nowHour >= 23 || nowHour < 1)
      : nowHour >= hh - 1 && nowHour < hh + 1;

    return { gz: sj.gz, ko: sj.ko, range: sj.range, stem, branch, tenGod: tg, group, favorGood, bond, clash, score: s, now };
  });
}

/**
 * 하루 중 **가장 좋은 시간대 / 가장 조심할 시간대**를 하나씩 고른다.
 * @param slots `hourFlow` 결과
 * @returns 최고·최저 각각 하나. 동점이면 이른 시진(하루 순서)이 이긴다.
 * ★"나쁜 시간"이라 부르지 않는다 — §4 가드(흉 단정 금지). 화면 문구도 '조심'까지만 쓴다.
 */
export function hourPeaks(slots: HourSlot[]): { best: HourSlot; care: HourSlot } {
  const best = slots.reduce((a, b) => (b.score > a.score ? b : a));
  const care = slots.reduce((a, b) => (b.score < a.score ? b : a));
  return { best, care };
}
