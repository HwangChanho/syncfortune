// app/src/lib/lifeGraph.ts — 인생 그래프(대운별 '용신 부합도' 점수 곡선). 무료·온디바이스·API 0.
// ─────────────────────────────────────────────────────────────────────────
// daniel 확정(2026-06): 점수 = 용신 부합도. 내게 필요한 기운(용신) 오행이 들어오는 대운 = 상승,
//   용신을 극하는 기운(기신) 대운 = 하강. 10년 단위(대운)로 곡선 + 변곡점 표시(시각화·공유).
// ★산식 가중치(천간 ×1.5 / 동일 +3·생 +1·극 −2)는 daniel 검수 슬롯 — 기본 stance 로 시작.
// 용신(saju.structure.usefulGod.value)이 오행이면 직접, 십신이면 일간 기준 오행으로 변환.
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, branchElement } from '../engine/ohaeng';
import type { SajuChart } from '@spec/chart';

const ELEMS = ['木', '火', '土', '金', '水'];
const GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // X 가 생하는 오행
const CTRL: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // X 가 극하는 오행

// 십신 → 오행(일간 기준). value 가 십신(TenGod)일 때 용신 오행으로 환산.
function tenGodToElement(tg: string, dayEl: string): string {
  if (tg.includes('비') || tg.includes('겁')) return dayEl;                                  // 비겁 = 일간
  if (tg.includes('식') || tg.includes('상')) return GEN[dayEl];                             // 식상 = 일간이 생
  if (tg.includes('재')) return CTRL[dayEl];                                                 // 재성 = 일간이 극
  if (tg.includes('관') || tg.includes('살')) return Object.keys(CTRL).find((k) => CTRL[k] === dayEl) ?? dayEl; // 관성 = 일간을 극
  if (tg.includes('인')) return Object.keys(GEN).find((k) => GEN[k] === dayEl) ?? dayEl;     // 인성 = 일간을 생
  return dayEl;
}

// 들어온 오행이 용신에 얼마나 부합? 동일 +3 / 그 오행이 용신을 생 +1 / 용신을 극(기신) −2 / 한신 0.
function elemScore(el: string, useEl: string): number {
  if (el === useEl) return 3;
  if (GEN[el] === useEl) return 1;
  if (CTRL[el] === useEl) return -2;
  return 0;
}

export type LifePoint = { startAge: number; endAge: number; gz: string; score: number; turning: boolean; current: boolean };

/**
 * 대운별 용신 부합 점수(0~100) 곡선 + 변곡점.
 * @returns points(대운별) · usefulElement(쓴 용신 오행) · hasUseful(용신 산출 여부 — 없으면 폴백 사용)
 */
export function lifeGraph(saju: SajuChart): { points: LifePoint[]; usefulElement: string; hasUseful: boolean } {
  const dayEl = saju.dayMaster.element as string;
  const uvRaw = saju.structure?.usefulGod?.value as string | undefined;
  const hasUseful = !!uvRaw;
  // 용신: 오행이면 직접 / 십신이면 변환 / 없으면 일간을 생하는 오행(인성)으로 보수적 폴백.
  const useEl = uvRaw && ELEMS.includes(uvRaw) ? uvRaw
    : uvRaw ? tenGodToElement(uvRaw, dayEl)
    : (Object.keys(GEN).find((k) => GEN[k] === dayEl) ?? dayEl);

  const cur = saju.currentLuck?.startAge;
  const raw = (saju.luckCycles ?? []).map((lc) => ({
    lc,
    raw: elemScore(stemElement(lc.stem), useEl) * 1.5 + elemScore(branchElement(lc.branch), useEl),
  }));
  if (!raw.length) return { points: [], usefulElement: useEl, hasUseful };

  // 0~100 정규화(min~max → 20~90). 평탄하면 중앙(55).
  const vals = raw.map((r) => r.raw);
  const min = Math.min(...vals), max = Math.max(...vals);
  const norm = (v: number) => (max === min ? 55 : Math.round(20 + ((v - min) / (max - min)) * 70));

  return {
    points: raw.map((r, i) => {
      const score = norm(r.raw);
      const prev = i > 0 ? norm(raw[i - 1].raw) : score;
      return {
        startAge: r.lc.startAge,
        endAge: r.lc.startAge + 9,
        gz: `${r.lc.stem}${r.lc.branch}`,
        score,
        turning: i > 0 && Math.abs(score - prev) >= 25, // 인접 대운 대비 25점↑ 급변 = 변곡점
        current: r.lc.startAge === cur,
      };
    }),
    usefulElement: useEl,
    hasUseful,
  };
}
