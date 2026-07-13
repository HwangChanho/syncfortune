// app/src/lib/content/relationPattern.ts — 관계 패턴 분석('왜 내 관계는 반복되는가')
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-13(4.3 신규 moat): 궁합 '운세'가 아니라, 타고난 *원국 구조*로 반복되는 관계 결을 읽는 *심리 통찰*.
//   ★결정론·온디바이스·API 0. inyeonGauge(daniel APPROVED·love-timing-baeuja 스탠스)와 동일 신호를 *정적(원국)* 으로:
//     ① 배우자궁(일지) 지장간 본기 십신 → '끌리는 사람의 결'(반복해 끌리는 유형)
//     ② 배우자궁(일지)의 원국 충/합/형 → '관계 역학'(변동추구/결속/마찰 성향)
//     ③ 원국 도화(왕지) 밀도 → '매력·인연 밀도'
//     ④ 인연星(남=재성/여=관성) 개수 → '관계에서 나의 방식'
//   ★십신→파트너 결·역학 문구는 표준 명리 물상 기반이나 = daniel 검수/튜닝 슬롯(발명 아님·룰 산출만).
// ─────────────────────────────────────────────────────────────────────────
import { tenGod, HIDDEN } from '@engine/saju';
import { DOHWA } from '../love/inyeonGauge'; // 도화 왕지(子午卯酉) — 이미 정의됨(재사용)
import type { SajuChart, Stem, Branch, TenGod, PillarPos } from '@spec/chart';

// 표준 합충형 테이블(통설 — inyeonGauge와 동일 값·모듈 경계상 로컬 정의)
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
const SIXHE: [Branch, Branch][] = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
const SANHE: Branch[][] = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
const SANHYEONG: Branch[][] = [['寅', '巳', '申'], ['丑', '戌', '未']]; // 삼형
const SANGHYEONG: [Branch, Branch][] = [['子', '卯']];                 // 상형
const pairIn = (list: [Branch, Branch][], a: Branch, b: Branch) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// 십신 → '반복해 끌리는 파트너 결'(표준 물상 — daniel 튜닝 슬롯)
const PARTNER_BY_SIPSIN: Partial<Record<TenGod, string>> = {
  정재: '성실하고 현실감각 있는, 안정적으로 곁을 지켜 주는 사람',
  편재: '활동적이고 스케일 큰, 매력 있고 자유로운 사람',
  정관: '책임감 있고 반듯한, 신뢰를 주는 사람',
  편관: '카리스마와 강단이 있는, 나를 이끌어 주는 사람',
  정인: '따뜻하고 지적인, 나를 품어 주는 사람',
  편인: '독특하고 통찰 있는, 정신적으로 통하는 사람',
  식신: '편안하고 다정한, 함께 있으면 즐거운 사람',
  상관: '재능 있고 표현력 있는, 자극과 영감을 주는 사람',
  비견: '대등하고 독립적인, 친구처럼 나란한 사람',
  겁재: '열정적이고 승부욕 있는, 강렬하게 끌어당기는 사람',
};

export type RelationPattern = {
  drawnTo: string;      // 끌리는 사람의 결
  dynamic: string;      // 관계 역학
  attraction: string;   // 매력·인연 밀도
  myStyle: string;      // 관계에서 나의 방식
  spousePalace: string; // 배우자궁 글자(참고 표기)
};

/** 관계 패턴 분석 — 원국 구조로 반복되는 관계 결. gender: 'male'|'female'(미상이면 재·관 둘 다 언급). */
export function relationPattern(saju: SajuChart, gender?: 'male' | 'female'): RelationPattern {
  const day = saju.dayMaster.stem;
  const P = saju.pillars;
  const spouseBranch = P['일'].branch as Branch;

  // ① 배우자궁(일지) 지장간 본기 → 끌리는 결
  const hidden = (HIDDEN as any)[spouseBranch] as Stem[] ?? [];
  const mainHidden = hidden[hidden.length - 1] ?? day;
  const partnerSip = tenGod(day, mainHidden) as TenGod;
  const drawnTo = `당신의 배우자 자리(일지 ${spouseBranch})에는 ${(PARTNER_BY_SIPSIN[partnerSip] ?? '깊이 통하는 사람')}에게 반복해 끌리는 결이 있어요. 무의식적으로 이런 사람을 곁에 두려는 경향이 나타납니다.`;

  // ② 배우자궁 원국 충/합/형 — 다른 세 기둥과의 관계
  const others: PillarPos[] = (['년', '월', '시'] as PillarPos[]).filter((p) => P[p]);
  let chung = false, hap = false, hyeong = false;
  for (const p of others) {
    const b = P[p].branch as Branch;
    if (pairIn(CHONG, spouseBranch, b)) chung = true;
    if (pairIn(SIXHE, spouseBranch, b) || SANHE.some((g) => g.includes(spouseBranch) && g.includes(b))) hap = true;
    if (pairIn(SANGHYEONG, spouseBranch, b) || SANHYEONG.some((g) => g.includes(spouseBranch) && g.includes(b)) || spouseBranch === b) hyeong = true;
  }
  const dynamic = chung
    ? '배우자 자리가 부딪힘(충)을 품고 있어, 관계에 변화·자극·거리 조절이 반복돼요. 안정보다 역동을 찾고, 한 번씩 관계를 크게 흔들며 재정비하는 패턴이 있습니다.'
    : hap
      ? '배우자 자리가 강하게 결속(합)돼 있어, 한번 마음을 주면 깊이 얽히는 편이에요. 밀착·헌신이 강점이자, 거리가 좁아 서로에게 스며드는 패턴이 반복됩니다.'
      : hyeong
        ? '배우자 자리에 마찰(형)의 결이 있어, 가까워질수록 부딪히고 조율하는 과정이 반복돼요. 갈등을 통해 관계를 다듬는 성장형 패턴입니다.'
        : '배우자 자리가 비교적 담담해, 관계에서 큰 기복보다 자기 페이스를 지키는 편이에요. 서두르지 않고 천천히 맞춰 가는 패턴입니다.';

  // ③ 도화 밀도(원국 왕지)
  const branches = (['년', '월', '일', '시'] as PillarPos[]).filter((p) => P[p]).map((p) => P[p].branch as Branch);
  const dohwaCount = branches.filter((b) => DOHWA.includes(b)).length;
  const attraction = dohwaCount >= 2
    ? '타고난 끌림(도화)이 진해, 사람을 끌어당기는 매력이 자연스럽게 나와요. 인연의 밀도가 높은 만큼, 다가오는 사람을 고르는 안목이 관건입니다.'
    : dohwaCount === 1
      ? '적당한 끌림(도화)이 있어, 필요할 때 매력을 발하는 편이에요. 은근하게 스며드는 인연이 잘 맞습니다.'
      : '요란한 끌림보다 진솔함으로 다가가는 결이에요. 시간을 두고 신뢰가 쌓이는 관계에서 빛납니다.';

  // ④ 인연星(남=재성/여=관성) 개수 — 관계에서 나의 방식
  const inyeonSet = gender === 'male' ? ['정재', '편재'] : gender === 'female' ? ['정관', '편관'] : ['정재', '편재', '정관', '편관'];
  let inyeonCount = 0;
  for (const p of (['년', '월', '시'] as PillarPos[])) {
    if (!P[p]) continue;
    if (inyeonSet.includes(tenGod(day, P[p].stem as Stem))) inyeonCount++;
    const hd = (HIDDEN as any)[P[p].branch] as Stem[] ?? [];
    if (hd.length && inyeonSet.includes(tenGod(day, hd[hd.length - 1]))) inyeonCount++;
  }
  const myStyle = inyeonCount >= 2
    ? '인연을 부르는 기운(인연星)이 넉넉해, 관계에 적극적이고 주도적으로 다가가는 편이에요. 여러 인연 속에서 나에게 맞는 결을 가려내는 게 성장 포인트입니다.'
    : inyeonCount === 1
      ? '인연의 기운이 또렷해, 한 사람에게 마음을 모으는 집중형이에요. 깊이 있는 관계에서 안정감을 찾습니다.'
      : '인연의 기운이 은근해, 관계를 서두르기보다 나 자신을 먼저 세우고 채워 갈 때 좋은 인연이 따라옵니다.';

  return { drawnTo, dynamic, attraction, myStyle, spousePalace: spouseBranch };
}
