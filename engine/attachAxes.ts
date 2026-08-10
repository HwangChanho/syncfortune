// engine/attachAxes.ts — R-ATTACH 사주 쪽 **불안·회피 2축 v0** (결정론 · API 0)
// ─────────────────────────────────────────────────────────────────────────
// `attachIndicators`(raw 지표) + `johu2`(조후 2축) → 전문가 §4 가 지정한 **축 배정**대로 묶는다.
//
// ══════════════════════════════════════════════════════════════════════════
// 🔴 2026-08-10 — **이 파일의 축 배정은 상담가 검증에서 기각됐다**(`verify-000e-attach` 15/15 X)
//   · `#13`(X) *"무식상·인극식을 회피 축에, 인성 무근·재극인을 불안 축에"* → 기각
//   · `#14`(X) 조후 한(寒)→회피 · 조(燥)→불안 배정 → 기각
//   · `#15`(X) *"비중 미정인 채 콘텐츠를 먼저 내보내도 된다"* → 기각 (이미 vc56 으로 출하된 뒤였다)
//   대신 상담가가 준 **판정법 원문**(세 문항에 같은 답):
//     > 남자사주에 재성의 유무와 관련없이 **정재 입장**에서 본다. (여자는 **정관**).
//     > 일간이 **감당 가능하면 안정형**이고, **감당이 어려우면 회피형**이다.
//     > 안정이나 회피가 **극단으로 가면 불안정**이다.
//   ⇒ 2축(불안×회피) 이 아니라 **안정↔회피 한 축 + 양 극단=불안정** 구조다. 지금 코드와 형태가 다르다.
//   ⚠️**'감당 가능'의 기준이 판정에 없다** → `verify-000h` D 로 되물었다. 답이 오기 전에 내가 정하면 발명이다.
//   그동안 이 v0 는 **화면에 '검증되지 않은 가설·재설계 중'이라고 적은 채** 남겨 둔다(문구 수정 완료).
//   ★새 축을 세울 때 이 파일을 고치지 말고 **새 파일로** 만들 것 — v0 결과와 섞이면 회귀 비교가 불가능해진다.
// ══════════════════════════════════════════════════════════════════════════
//
// ■ 여기서 내가 정한 것과 정하지 않은 것을 분명히 한다  (⚠️아래 '전문가가 줬다'는 위 판정으로 무효)
//   · ~~**방향(어느 지표가 어느 축인가) = 전문가가 §4 에서 이미 줬다.** 내가 고른 게 아니다.~~ → `#13`·`#14` 로 기각
//   · **크기(가중치) = 모른다.** 그래서 **전부 같은 무게**로 둔다(v0-equal).
//     이건 그럴듯한 숫자를 지어내는 것과 다르다 — *"크기를 아직 모른다"* 를 코드로 적은 것이다.
//     N=300~500 이 쌓이면 ridge 회귀가 이 자리를 그대로 갈아끼운다(§5).
//   · 그래서 `version` 을 값에 실어 보낸다. 화면이 "가설"이라고 말할 근거이자,
//     나중에 회귀 가중치로 바뀌었을 때 **옛 결과와 구분**하는 표식이다.
//
// ■ 조후는 base·surround 를 **합치지 않고 각각 한 표씩** 넣는다
//   johu2 가 둘을 안 합치는 이유(합성 비율 미판정)를 여기서 몰래 되돌리면 안 된다.
//   같은 무게 원칙을 그대로 적용하면 자연스럽게 각각이 독립 기여가 된다.
//
// ⚠️이 파일은 **점수를 만들 뿐 유형을 선언하지 않는다.** '당신은 회피형' 같은 판정은 화면이 하지 않는다(§6).
// ─────────────────────────────────────────────────────────────────────────
import { attachIndicators } from './attachIndicators';
import { johu2 } from './johu2';
import type { SajuChart } from '../spec/chart';

/** 축 기여 한 항목 — 화면에서 "무엇이 이 점수를 밀었나"를 그대로 보여주려고 라벨을 함께 낸다. */
export type Contribution = {
  /** 안정적인 키(로그·회귀 컬럼명). */
  key: string;
  /** 사람이 읽을 이름 — 명리 용어 그대로(풀어쓰기는 화면 몫). */
  label: string;
  /** 0~1 로 정규화한 기여도. 0 = 이 지표가 이 축을 전혀 안 민다. */
  value: number;
};

export type AttachAxis = {
  /** 0~1. 기여들의 **단순 평균**(= 동일 가중). */
  score: number;
  contributions: Contribution[];
};

export type AttachAxes = {
  anxiety: AttachAxis;
  avoidance: AttachAxis;
  /** 가중치 산정 방식. 회귀로 교체되면 여기가 바뀐다 — 결과를 비교할 때 반드시 같이 볼 것. */
  version: 'v0-equal';
};

/** 0~1 로 자르기. */
const c01 = (n: number) => Math.max(0, Math.min(1, n));
/** n 개 이상이면 1 이 되는 완만한 정규화(개수형 지표용). */
const ratio = (n: number, full: number) => c01(n / full);

/**
 * 사주 원국 → 불안·회피 2축 v0.
 *
 * @param saju 원국(SajuChart). 대운·세운은 쓰지 않는다 — 이 층은 **trait(구조)** 다(§2).
 * @returns 두 축의 점수(0~1)와 **기여 내역**. 기여를 항상 함께 내보내는 이유는,
 *          점수만 보여주면 반증이 불가능해지기 때문이다(§3 반증가능성 제약).
 */
export function attachAxes(saju: SajuChart): AttachAxes {
  const x = attachIndicators(saju);
  const j = johu2(saju);

  // ── 불안 축 (상실 공포·과잉 근접추구) — 전문가 §4 목록 그대로 ──────────────
  const anxiety: Contribution[] = [
    // '인성 무근 또는 재극인 — 안전기지 손상'. 무근(통근 0)이거나 재가 인보다 셀 때.
    { key: 'inseong_damaged', label: '인성 무근 · 재극인',
      value: c01(Math.max(x.inseongRoot === 0 ? 1 : 0, x.jaeGeukIn.jae > x.jaeGeukIn.in ? 0.6 : 0)) },
    // '신약 + 관살 태과, 특히 관살혼잡'. 강약은 **플래그를 안 쓰고** 성분(득령·득지·득세)의 약함으로 본다.
    { key: 'gwansal_pressure', label: '관살 압박(관살혼잡 포함)',
      value: c01(ratio(x.gwanseong, 3) * (1 - (x.deukryeongScore + x.deukjiScore + x.deukseScore) / 3)
        + (x.gwansalHonjap ? 0.3 : 0)) },
    { key: 'jae_excess', label: '재성 태과', value: ratio(x.jaeseong, 3) },
    { key: 'wol_shock', label: '월지 충·형(부모궁)', value: ratio(x.wolShock.chung + x.wolShock.hyeong, 2) },
    { key: 'bigyeop_absent', label: '비겁 전무(수평적 지지 결여)', value: x.bigyeop === 0 ? 1 : 0 },
    // 조열 = 暖(hanNan +) · 燥(joSeup −). ★base 와 surround 를 각각 한 표씩(합성 비율 미판정).
    { key: 'johu_warm_base', label: '월령이 따뜻함', value: c01(j.hanNan.base) },
    { key: 'johu_warm_surround', label: '주변 글자가 덥힘', value: c01(j.hanNan.surround / 3) },
    { key: 'johu_dry_base', label: '일지가 건조함', value: c01(-j.joSeup.base) },
    { key: 'johu_dry_surround', label: '주변 글자가 말림', value: c01(-j.joSeup.surround / 3) },
  ];

  // ── 회피 축 (친밀 거리두기·정서 차단) ────────────────────────────────────
  const avoidance: Contribution[] = [
    // ★§4 가 '가장 강한 단일 지표'로 지목. 그래도 **가중치를 더 주지 않는다** — 세다는 것도 데이터가 말할 몫이다.
    { key: 'siksang_blocked', label: '무식상 · 인극식(정서 표현 차단)',
      value: x.siksang === 0 ? 1 : c01(x.inGeukSik.in > x.inGeukSik.sik ? 0.6 : 0) },
    { key: 'pyeonin_strong', label: '편인 강(조건부 돌봄)', value: ratio(x.pyeonin, 2) },
    { key: 'il_shock', label: '일지 충·형(배우자궁)', value: ratio(x.ilShock.chung + x.ilShock.hyeong, 2) },
    { key: 'self_sufficient', label: '인다신강 · 종격(외부 조율 거부)',
      value: c01((x.jonggyeokCandidate ? 0.7 : 0) + ratio(x.inseong, 3) * (x.deukseScore >= 0.5 ? 1 : 0)) },
    // 한습 = 寒(hanNan −) · 濕(joSeup +).
    { key: 'johu_cold_base', label: '월령이 차가움', value: c01(-j.hanNan.base) },
    { key: 'johu_cold_surround', label: '주변 글자가 식힘', value: c01(-j.hanNan.surround / 3) },
    { key: 'johu_wet_base', label: '일지가 습함', value: c01(j.joSeup.base) },
    { key: 'johu_wet_surround', label: '주변 글자가 적심', value: c01(j.joSeup.surround / 3) },
  ];

  const avg = (cs: Contribution[]) =>
    Math.round((cs.reduce((a, b) => a + b.value, 0) / cs.length) * 1000) / 1000;
  // 기여도는 소수 셋째 자리까지만 — 화면이 그대로 찍어도 되게. ★평균은 **반올림 전 값**으로 낸다
  //   (표시용으로 자른 값을 다시 평균 내면 점수가 미세하게 달라져 두 화면이 갈린다).
  const round = (cs: Contribution[]) => cs.map((c) => ({ ...c, value: Math.round(c.value * 1000) / 1000 }));

  return {
    anxiety: { score: avg(anxiety), contributions: round(anxiety) },
    avoidance: { score: avg(avoidance), contributions: round(avoidance) },
    version: 'v0-equal',
  };
}
