// engine/triangulate.ts — 사주+자미+MBTI 삼각 통합 (ROADMAP F2)
// ─────────────────────────────────────────────────────────────────────────
// ★ 규칙2: **블렌딩 금지** — 셋을 섞어 하나로 만들지 않는다. 각 축을 *독립* 평가한 뒤
//   '수렴(일치도)'만 메타로 측정한다. 최종 관계 조언은 LLM 통변 + daniel 검수.
// ★ 규칙9: 자미두수 깊은 합혼 진단은 전문가 없이 위임 금지 → 자미는 *보조 참고*(부처궁 성계)까지만.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, ZiweiChart } from '../spec/chart';
import { analyzeCompatibility } from './compatibility';

export type MBTI =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP' | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ' | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

/** MBTI 상성(간이) — N/S(세계관·소통) 일치 중요 + 나머지 차원 보완 가점. ※ 표준 초안, daniel 검수 슬롯 */
function mbtiCompatibility(a: MBTI, b: MBTI): { score: number; verdict: string; detail: string } {
  const ax = [...a], bx = [...b]; // [E/I, N/S, F/T, J/P]
  const sameNS = ax[1] === bx[1];
  const complement = (ax[0] !== bx[0] ? 1 : 0) + (ax[2] !== bx[2] ? 1 : 0) + (ax[3] !== bx[3] ? 1 : 0);
  const score = (sameNS ? 2 : -1) + complement; // N/S 일치=소통 기반, 보완 차원=끌림 가점
  const verdict = score >= 3 ? '상성 좋음' : score >= 1 ? '무난' : '노력 필요';
  return { score, verdict, detail: `N/S ${sameNS ? '일치(소통 기반)' : '상이(세계관 차이)'} · 보완차원 ${complement}/3 (E·I, F·T, J·P)` };
}

export interface TriPerson {
  saju: SajuChart;     // structure 권장(용신 상보)
  ziwei?: ZiweiChart;  // 보조(부처궁 참고)
  mbti?: MBTI;
}

export interface AxisVerdict {
  axis: '사주' | 'MBTI' | '자미';
  verdict: string;
  positive: boolean | null; // null = 미입력/판정보류(자미 보조)
  detail: string;
}

export interface TriangulateDx {
  axes: AxisVerdict[];                              // 셋 독립 평가
  convergence: { aligned: boolean; summary: string }; // 수렴(일치도) 메타 — 블렌딩 아님
  note: string;
}

/** 셋 독립 평가 → 수렴 측정 (블렌딩 금지) */
export function triangulate(me: TriPerson, other: TriPerson): TriangulateDx {
  const axes: AxisVerdict[] = [];

  // ── 축1: 사주 (C1 결정론) ──
  const sc = analyzeCompatibility(me.saju, other.saju);
  const sajuPos = sc.harmony.length >= sc.tension.length;
  axes.push({
    axis: '사주', verdict: sajuPos ? '조화 우세' : '긴장 우세', positive: sajuPos,
    detail: `조화 ${sc.harmony.length}·긴장 ${sc.tension.length} · 일간 ${sc.dayMasterRelation.type} · 용신공급 ${sc.usefulGodSupply.supply}`,
  });

  // ── 축2: MBTI (독립) ──
  if (me.mbti && other.mbti) {
    const mc = mbtiCompatibility(me.mbti, other.mbti);
    axes.push({ axis: 'MBTI', verdict: `${me.mbti}×${other.mbti} ${mc.verdict}`, positive: mc.score >= 1, detail: mc.detail });
  } else {
    axes.push({ axis: 'MBTI', verdict: '미입력', positive: null, detail: '양측 MBTI 필요' });
  }

  // ── 축3: 자미 (보조 — 규칙9, 깊은 합혼 X) ──
  if (me.ziwei) {
    const sp = me.ziwei.palaces.find((p) => p.name === '부처궁');
    const stars = sp?.majorStars.map((s) => s.name).join('·') || '무주성(차성·대궁 참조)';
    axes.push({ axis: '자미', verdict: '보조 참고', positive: null, detail: `내 부처궁(${sp?.branch ?? '?'}) 주성: ${stars} — 깊은 합혼 진단은 전문가(규칙9)` });
  } else {
    axes.push({ axis: '자미', verdict: '미산출', positive: null, detail: '자미 명식 필요' });
  }

  // ── 수렴: 판정된 축(사주·MBTI)의 방향 일치도 ──
  const decided = axes.filter((a) => a.positive !== null);
  const aligned = decided.length >= 2 && decided.every((a) => a.positive === decided[0].positive);
  const summary = decided.length < 2
    ? '판정 축 부족 — 입력 보강 필요'
    : aligned
      ? `사주·MBTI 같은 방향(${decided[0].positive ? '긍정' : '주의'}) → 수렴(신뢰↑)`
      : '축별 방향 상이 → 영역마다 강약 다름(예: 끌림은 좋으나 일상 마찰 등)';

  return {
    axes,
    convergence: { aligned, summary },
    note: '규칙2: 블렌딩 아님 — 셋 독립 평가 후 수렴(일치도)만 측정. 최종 관계 조언은 LLM 통변 + daniel 검수.',
  };
}
