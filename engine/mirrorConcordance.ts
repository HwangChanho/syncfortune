// engine/mirrorConcordance.ts — R60 v0.2.0 §4 D0_CONCORDANCE 게이트
// ─────────────────────────────────────────────────────────────────────────
// 스펙: R60-MIRROR-ROMANCE v0.2.0 §4 (원문 rule_id=R48 · 프로젝트 번호는 R60)
//
// ★무엇을 하는가: **경상명식(파생 기법)을 성궁론(정통) 판정과 대조**해 채택 여부를 정한다.
//   v0.1.0 은 경상명식이 단독 판정자였다. v0.2.0 은 성궁이 결론을 내고, 경상은
//   그 결론과 **일치할 때만** 세부 묘사를 공급한다. 어긋나면 버린다.
//
// ★★임계값을 코드에 박지 않는다(스펙 §4.3):
//   T_HIGH=0.70 / T_LOW=0.40 은 **PILOT_01 단일 샘플 기준 잠정값**이다.
//   최소 30개 명식으로 분포를 측정하기 전까지는 확정이 아니며,
//   ⚠️중앙값이 T_LOW 아래로 나오면 **임계값을 낮춰 통과시키지 말고 경상명식 기법 자체를 재검토**한다.
//   (수치를 기대에 맞춰 내리는 건 보상해킹이다 — CLAUDE.md 규칙7)
// ─────────────────────────────────────────────────────────────────────────
import { STEM_ELEM } from './saju';
import type { Element, TenGod } from '../spec/chart';
import type { StarPalaceReport } from './starPalace';
import type { MirrorProfile } from './mirrorProfile';

/** ★스펙 §4.3 — 외부화. 인라인 상수 금지. 샘플 확보 후 재설정 대상. */
export const R60_THRESHOLDS = {
  T_HIGH: Number(globalThis.process?.env?.R60_T_HIGH ?? 0.70),
  T_LOW: Number(globalThis.process?.env?.R60_T_LOW ?? 0.40),
};

export type RenderMode = 'FULL' | 'DESCRIPTIVE_ONLY' | 'STAR_PALACE_ONLY';

export type ConcordanceAxis = { key: string; weight: number; match: 0 | 0.5 | 1; note: string };
export type ConcordanceReport = {
  score: number;
  axes: ConcordanceAxis[];
  render: RenderMode;
  confidenceDelta: number;
  flags: string[];
};

const W = {
  A1_STAR_OHAENG: 0.25,
  A2_STAR_TYPE: 0.15,
  A3_PALACE_JOHU: 0.20,
  A4_PALACE_SIPSEONG: 0.20,
  A5_CHUNG_OPEN: 0.15,
  A6_SPOUSE_ABSENT: 0.05,
};

/** 오행 거리 → 일치도(같음 1 / 상생 0.5 / 그 외 0). */
const ELEM_ORDER: Element[] = ['木', '火', '土', '金', '水'];
function elemMatch(a?: Element, b?: Element): 0 | 0.5 | 1 {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d = (ELEM_ORDER.indexOf(b) - ELEM_ORDER.indexOf(a) + 5) % 5;
  return d === 1 || d === 4 ? 0.5 : 0;    // 상생 이웃
}

const isPyeon = (t?: TenGod) => !!t && ['편재', '편관', '편인', '겁재', '상관'].includes(t);

/**
 * 성궁 판정 ↔ 경상 프로파일 6축 대조.
 * @param sp   성궁론 1차 판정(정통 · 상위)
 * @param ideal 합경 프로파일(이상형 · 파생)
 * @param real  충경 프로파일(실배우자 · 파생)
 */
export function concordanceOf(sp: StarPalaceReport, ideal: MirrorProfile, real: MirrorProfile): ConcordanceReport {
  const axes: ConcordanceAxis[] = [];

  // A1 — 星의 귀결 오행 ↔ 합경 일간 오행(이상형의 뼈대)
  {
    const m = elemMatch(sp.star.transformedTo, ideal.ilganElement);
    axes.push({ key: 'A1_STAR_OHAENG', weight: W.A1_STAR_OHAENG, match: m,
      note: `星귀결 ${sp.star.transformedTo ?? '-'} ↔ 합경일간 ${ideal.ilganElement}` });
  }

  // A2 — 星의 정/편 ↔ 합경 일간의 음양(스펙 §7.1: "편재 우세 ↔ 화려·주도형" = 1.0)
  //   ★合化 **이전**의 星 십신을 쓴다 — 합화 귀결은 A1 이 이미 본다(같은 사실을 두 축이 세면 중복 가중).
  //   양간 = 드러나고 주도하는 결(偏 과 정합) · 음간 = 안으로 수렴하는 결(正 과 정합).
  {
    const starTg = sp.star.starTenGods.find((tg) => isPyeon(tg) === isPyeon(sp.star.primaryTenGod ?? tg));
    const raw = sp.star.primaryTenGod ?? starTg;
    const m: 0 | 0.5 | 1 = raw ? (isPyeon(raw) === ideal.ilganYang ? 1 : 0) : 0.5;
    axes.push({ key: 'A2_STAR_TYPE', weight: W.A2_STAR_TYPE, match: m,
      note: `星 ${raw ?? '-'} ↔ 합경일간 ${ideal.ilgan}(${ideal.ilganYang ? '양·주도' : '음·수렴'})` });
  }

  // A3 — 宮 조후 ↔ 충경 조후(실배우자의 정서 온도)
  {
    const diff = Math.abs(sp.palace.johu - real.D3_TEMP);
    const m: 0 | 0.5 | 1 = diff <= 0.35 ? 1 : diff <= 0.7 ? 0.5 : 0;
    axes.push({ key: 'A3_PALACE_JOHU', weight: W.A3_PALACE_JOHU, match: m,
      note: `宮조후 ${sp.palace.johu} ↔ 충경 ${real.D3_TEMP} (차 ${diff.toFixed(2)})` });
  }

  // A4 — 宮 지장간 십신 ↔ 충경 천간 십신(어떤 결의 사람인가)
  {
    const palaceTg = new Set(sp.palace.hidden.map((h) => h.tenGod));
      const GROUP: Record<string, string> = {
      비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성',
      정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
    };
    // ★스펙 §7.1 은 **충경 천간** 십신과 대조한다("丑중 편인·식신 ↔ 癸水 편인 兩透").
    //   지지 본기까지 합산한 분포(D4_TOP2)를 쓰면 이 대조가 흐려진다 — 실제로 그래서 0 이 나왔다.
    const realStem = new Set(real.stemTenGods);
    const exact = [...palaceTg].filter((t) => realStem.has(t)).length;               // 십신 그대로 일치
    const palaceGroups = new Set([...palaceTg].map((t) => GROUP[t]));
    const groupHit = [...realStem].filter((t) => palaceGroups.has(GROUP[t])).length; // 군 단위 일치
    const m: 0 | 0.5 | 1 = exact >= 1 ? 1 : groupHit >= 1 ? 0.5 : 0;
    axes.push({ key: 'A4_PALACE_SIPSEONG', weight: W.A4_PALACE_SIPSEONG, match: m,
      note: `宮지장간 ${[...palaceTg].join(',')} ↔ 충경천간 ${[...realStem].join(',')}` });
  }

  // A5 — 宮 충 개고 글자 ↔ 충경 일간(인연이 열릴 때 나오는 사람)
  {
    const opens = sp.palace.chungOpensTo;
    const m: 0 | 0.5 | 1 = opens.includes(real.ilgan) ? 1
      : opens.some((st) => STEM_ELEM[st] === real.ilganElement) ? 0.5 : 0;
    axes.push({ key: 'A5_CHUNG_OPEN', weight: W.A5_CHUNG_OPEN, match: m,
      note: `개고 ${opens.join(',') || '-'} ↔ 충경일간 ${real.ilgan}` });
  }

  // A6 — 宮 배우자성 부재 ↔ 충경이 비재성적 매력인가
  {
    // ★여기도 **천간** 기준 — 宮에 배우자성이 없으면 실인연이 '재성적(화려) 매력'이 아닌 경로로 온다.
    const WEALTH: TenGod[] = ['정재', '편재'];
    const realStemHasWealth = real.stemTenGods.some((t) => WEALTH.includes(t));
    const m: 0 | 0.5 | 1 = sp.palace.hasSpouseStar ? 0.5 : (realStemHasWealth ? 0 : 1);
    axes.push({ key: 'A6_SPOUSE_ABSENT', weight: W.A6_SPOUSE_ABSENT, match: m,
      note: `宮배우자성 ${sp.palace.hasSpouseStar ? '있음' : '없음'} ↔ 충경천간 ${real.stemTenGods.join(',')}` });
  }

  const score = Math.round(axes.reduce((a, x) => a + x.weight * x.match, 0) * 100) / 100;

  // ── 3단 게이트(스펙 §4.2) ──
  const flags: string[] = [];
  let render: RenderMode; let confidenceDelta = 0;
  if (score >= R60_THRESHOLDS.T_HIGH) {
    render = 'FULL'; confidenceDelta = 0.15;               // 경상 정식 채택 · 성궁과 병렬 렌더
  } else if (score >= R60_THRESHOLDS.T_LOW) {
    render = 'DESCRIPTIVE_ONLY';                            // 성궁이 결론 · 경상은 스타일 묘사만
  } else {
    render = 'STAR_PALACE_ONLY'; flags.push('MIRROR_DIVERGENT');   // 경상 미노출
  }

  return { score, axes, render, confidenceDelta, flags };
}
