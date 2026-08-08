// engine/attachIndicators.ts — R-ATTACH 지표 **raw 연속 스코어**만 산출 (결정론 · API 0)
// ─────────────────────────────────────────────────────────────────────────
// 출처: 전문가 스펙 2026-08-08 (knowledge/rules/R-ATTACH_성인애착_2026-08-08.md).
//
// ■ 이 파일이 하지 **않는** 것 — 지키지 않으면 R-ATTACH 는 곧바로 무의미해진다
//   1. **가중치를 두지 않는다.** 전문가: *"가중치는 정하지 말고 뽑아내세요 …
//      어떤 지표가 실제로 설명력이 있는지 **데이터가 말하게** 두세요."*
//      → 여기선 raw 량만 낸다. 불안/회피 점수로 합치는 건 ridge 회귀(수집 후)의 몫이다.
//   2. **판정하지 않는다.** '무식상이면 회피형' 같은 결론을 여기서 내리지 않는다.
//   3. **명리 stance 를 발명하지 않는다.** 아래 지표는 전부 **정의상 계산되는 양**이거나
//      기존 엔진이 이미 내던 값의 재노출이다. 새 관법 판정은 하나도 없다(CLAUDE.md §3).
//
// ■ 계층(전문가 확정): **원국 = 구조(baseline)**. 여기선 원국만 쓴다.
//   대운(점수 수준 delta)·세운(관계 사건)은 별도 모듈 — 섞으면 trait/state 가 꼬인다.
//
// ■ 강약 플래그(신강/신약)는 **일부러 넣지 않는다**
//   전문가: *"신강/신약은 세 성분(득령·득지·득세)을 1비트로 뭉갠 손실 압축이고,
//   애착 예측에 쓸 정보는 성분 쪽에 있다. 뭉치면 사라진다."*
//   → `deukryeongScore/deukjiScore/deukseScore` 세 연속값으로 분해해 내보낸다.
// ─────────────────────────────────────────────────────────────────────────
import { STEM_ELEM, HIDDEN, BRANCH_MAIN } from './saju';
import { analyzeTenGods, scoreStrength, classifyStrength, detectInteractions } from './structure';
import type { SajuChart, PillarPos, Element, Stem } from '../spec/chart';

const POS: PillarPos[] = ['년', '월', '일', '시'];
const ORDER: Element[] = ['木', '火', '土', '金', '水']; // 상생 순
/** a 가 b 를 생(生)하는가 — 상생 순에서 바로 다음. */
const sheng = (a: Element, b: Element) => ORDER[(ORDER.indexOf(a) + 1) % 5] === b;
// ※'극(剋)' 헬퍼는 두지 않는다 — 재→인·인→식 극은 groupElements 의 상생 순서로 이미 확정되어 있어
//   따로 판정할 필요가 없다(정의상 항상 성립). 아래에서는 '성립 여부'가 아니라 **양쪽 세력**을 낸다.

/** 일간 오행 기준 5그룹의 오행을 돌려준다(정의상 고정 — stance 아님). */
function groupElements(dayStem: Stem) {
  const me = STEM_ELEM[dayStem];
  const i = ORDER.indexOf(me);
  return {
    비겁: me,
    식상: ORDER[(i + 1) % 5],  // 내가 생하는 것
    재성: ORDER[(i + 2) % 5],  // 내가 극하는 것
    관성: ORDER[(i + 3) % 5],  // 나를 극하는 것
    인성: ORDER[(i + 4) % 5],  // 나를 생하는 것
  };
}

/**
 * 특정 오행의 **지지 통근량** — 네 지지의 지장간에 그 오행이 몇 번 나오는지(본기 가중).
 * ★'무근'을 boolean 으로 판정하지 않는다 — 0 이면 0 이라는 연속량으로 내보내고 해석은 소비처가 한다.
 * @returns 본기 1.0 · 중기/여기 0.5 로 합산한 연속값
 */
function rootAmount(saju: SajuChart, elem: Element): number {
  let n = 0;
  for (const p of POS) {
    const br = saju.pillars[p].branch;
    for (const h of HIDDEN[br]) {
      if (STEM_ELEM[h.stem] !== elem) continue;
      n += h.role === '본기' ? 1 : 0.5;
    }
  }
  return Math.round(n * 10) / 10;
}

/** 원국에서 특정 위치(pos)가 충/형/공망에 걸렸는지 — 개수(연속량). */
function shockAt(saju: SajuChart, pos: PillarPos): { chung: number; hyeong: number } {
  const its = saju.interactions?.length ? saju.interactions : detectInteractions(saju);
  let chung = 0, hyeong = 0;
  for (const it of its) {
    if (it.level === '천간' || !it.members.includes(pos)) continue;
    if (it.type === '충') chung++;
    else if (it.type === '형') hyeong++;
  }
  return { chung, hyeong };
}

export type AttachIndicators = {
  /** 강약을 **분해한** 세 성분(전문가: 뭉치면 정보가 사라진다). 0~1 정규화. */
  deukryeongScore: number; deukjiScore: number; deukseScore: number;
  /** 십신 5그룹 flat 개수 — 그대로(부재=0 이 가장 강한 시그널이라 임계값 없이 낸다). */
  bigyeop: number; siksang: number; jaeseong: number; gwanseong: number; inseong: number;
  /** 10정밀 십신 세기 중 애착 스펙이 지목한 것들(raw). */
  pyeonin: number; jeongin: number; pyeongwan: number; jeonggwan: number;
  /** 재/인/식 **오행 통근량** — '인성 무근'·'재극인'·'인극식'의 재료(판정 아님). */
  inseongRoot: number; jaeseongRoot: number; siksangRoot: number;
  /** 재→인 극 관계가 성립하는 구조인가(정의상 항상 성립하므로 **양쪽 세력**을 함께 낸다). */
  jaeGeukIn: { jae: number; in: number };
  /** 인→식 극. 무식상이면 in>0, sik=0 으로 나온다. */
  inGeukSik: { in: number; sik: number };
  /** 월지(부모궁)·일지(배우자궁) 충·형 — 스펙의 핵심 위치 지표. */
  wolShock: { chung: number; hyeong: number };
  ilShock: { chung: number; hyeong: number };
  /** 관살혼잡 = 정관·편관이 **둘 다** 있는가(정의상 계산). 세기도 함께. */
  gwansalHonjap: boolean;
  /** 종격/전왕 후보 — 엔진 기존 플래그 재노출(자기충족·외부조율 거부 지표 후보). */
  jonggyeokCandidate: boolean;
  /** 참고용 — 회귀에 넣지 말 것(성분으로 이미 들어가 있다). 사람이 눈으로 볼 때만. */
  _refStrengthScore: number;
};

/**
 * R-ATTACH 지표 raw 산출.
 * @param saju 원국(SajuChart). 대운·세운은 **쓰지 않는다**(trait 층 분리).
 * @returns 연속 스코어 묶음 — **가중치·판정 없음**. 회귀 입력용.
 */
export function attachIndicators(saju: SajuChart): AttachIndicators {
  const day = saju.pillars['일'].stem;
  const G = groupElements(day);
  const tg = analyzeTenGods(saju);
  const cs = classifyStrength(saju);
  const st = scoreStrength(saju);

  // ── 득령/득지/득세를 **연속값으로 분해** ────────────────────────────────
  //   엔진 classifyStrength 는 boolean 만 준다. 근거는 이미 연속이므로 여기서 비율로 되살린다.
  //   ★엔진 판정을 바꾸지 않는다 — 별도 노출일 뿐이라 기존 소비처에 영향 0.
  const wolBonElem = STEM_ELEM[BRANCH_MAIN[saju.pillars['월'].branch]];
  //   득령 = 월령이 나를 돕는 정도. 비겁(같은 오행)=1 · 인성(나를 생)=1 · 그 외 0.
  const deukryeongScore = wolBonElem === G.비겁 ? 1 : (sheng(wolBonElem, G.비겁) ? 1 : 0);
  //   득지 = 일지가 나를 돕는 정도. 통근(지장간에 내 오행)량을 0~1 로.
  const ilBr = saju.pillars['일'].branch;
  const ilSelf = HIDDEN[ilBr].reduce((a, h) => a + (STEM_ELEM[h.stem] === G.비겁 ? (h.role === '본기' ? 1 : 0.5) : 0), 0);
  const deukjiScore = Math.min(1, ilSelf);
  //   득세 = 전 자리(천간·지지본기) 중 나를 돕는 비율. classifyStrength 의 favorCnt/foeCnt 와 같은 재료.
  let favor = 0, total = 0;
  for (const p of POS) {
    if (p !== '일') { const e = STEM_ELEM[saju.pillars[p].stem]; favor += (e === G.비겁 || sheng(e, G.비겁)) ? 1 : 0; total++; }
    const be = STEM_ELEM[BRANCH_MAIN[saju.pillars[p].branch]];
    favor += (be === G.비겁 || sheng(be, G.비겁)) ? 1 : 0; total++;
  }
  const deukseScore = total ? Math.round((favor / total) * 100) / 100 : 0;

  const d = tg.distribution, det = tg.detail;
  const g = (k: string) => d[k] ?? 0;
  const x = (k: string) => det[k] ?? 0;

  return {
    deukryeongScore, deukjiScore, deukseScore,
    bigyeop: g('비겁'), siksang: g('식상'), jaeseong: g('재성'), gwanseong: g('관성'), inseong: g('인성'),
    pyeonin: x('편인'), jeongin: x('정인'), pyeongwan: x('편관'), jeonggwan: x('정관'),
    inseongRoot: rootAmount(saju, G.인성),
    jaeseongRoot: rootAmount(saju, G.재성),
    siksangRoot: rootAmount(saju, G.식상),
    // 재→인, 인→식 은 오행 관계상 **항상** 극이 성립한다(정의). 그래서 '성립 여부'가 아니라 **양쪽 세력**을 낸다 —
    //   어느 쪽이 얼마나 센지가 정보이고, 그 비교를 어떻게 쓸지는 회귀가 정한다.
    jaeGeukIn: { jae: g('재성'), in: g('인성') },
    inGeukSik: { in: g('인성'), sik: g('식상') },
    wolShock: shockAt(saju, '월'),
    ilShock: shockAt(saju, '일'),
    gwansalHonjap: x('정관') > 0 && x('편관') > 0,
    jonggyeokCandidate: cs.jonggyeokCandidate,
    _refStrengthScore: st.score,
  };
}

// ⚠️미포함(의도) — 채우려면 stance 확정이 먼저다:
//   · **조후(한난 × 조습 4상한)** — 전문가가 정서조절 축의 핵심으로 지목했으나,
//     현재 `ohaeng.johuSkew` 는 단일 축(한↔난)이라 조습이 빠진다. 2축 연속화는 daniel 검수 슬롯.
//   · 대운 delta / 세운 사건 매핑 — trait/state 분리 원칙상 별도 모듈.
//   · 불안/회피 합성 점수 — **데이터(ridge)가 정한다.** 여기서 만들면 그 순간 사후 변명 장치가 된다.
