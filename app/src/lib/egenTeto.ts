// app/src/lib/egenTeto.ts — 애겐/테토 점수(온디바이스): 십신 분포(원국+대운+세운) → 테토↔에겐 스펙트럼
// ─────────────────────────────────────────────────────────────────────────
// stance(daniel★ 2026-06-18): 관성·상관·비겁 = 테토(직진·주도·끼·자기세력) / 식신·인성 = 에겐(여유·수용·배움)
//   재성 = 반반(중립, 점수 제외). 원국 십신 분포 + 현재 대운·세운 십신을 합산해 점수화.
//   점수 = 테토 / (테토 + 에겐) × 100 (0=완전 에겐, 100=완전 테토). 설명 통변은 Edge LLM(kind=egen).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod } from '@spec/chart';
import { analyzeTenGods } from '@engine/structure';
import { tenGod } from '@engine/saju';

// 테토 십신(daniel): 편관·정관(관성) + 상관 + 비견·겁재(비겁)
const TETO: TenGod[] = ['편관', '정관', '상관', '비견', '겁재'];
// 에겐 십신(daniel): 식신 + 편인·정인(인성)
const EGEN: TenGod[] = ['식신', '편인', '정인'];
// 재성(편재·정재) = 중립 → 점수에서 제외(반반)

export type EgenTetoResult = {
  tetoScore: number;            // 0(에겐) ~ 100(테토)
  type: 'teto' | 'egen' | 'balanced';
  teto: number; egen: number;   // 가중 합(원국 분포 + 운 각 +1)
  reasons: string[];            // 점수 근거 십신(많은 순)
};

/** 사주(원국+현재 대운·세운)의 십신 분포로 애겐/테토 점수 산출. */
export function egenTeto(saju: SajuChart): EgenTetoResult {
  const { detail } = analyzeTenGods(saju);      // 10정밀 십신 분포(원국 천간·지지)
  let teto = 0, egen = 0;
  const tHits: Record<string, number> = {};
  for (const [k, n] of Object.entries(detail)) {
    if (n <= 0) continue;
    if (TETO.includes(k as TenGod)) { teto += n; tHits[k] = n; }
    else if (EGEN.includes(k as TenGod)) { egen += n; tHits[k] = n; }
  }
  // 현재 운(대운·세운)의 십신 — 시점 반영(원국 1글자와 동급 가중)
  const day = saju.dayMaster.stem;
  const luckTg = saju.currentLuck ? tenGod(day, saju.currentLuck.stem) : null;
  const annTg = saju.annual ? tenGod(day, saju.annual.stem) : null;
  for (const tg of [luckTg, annTg]) {
    if (!tg) continue;
    if (TETO.includes(tg)) { teto += 1; tHits[tg] = (tHits[tg] ?? 0) + 1; }
    else if (EGEN.includes(tg)) { egen += 1; tHits[tg] = (tHits[tg] ?? 0) + 1; }
  }
  const total = teto + egen;
  const tetoScore = total > 0 ? Math.round((teto / total) * 100) : 50;
  const type: EgenTetoResult['type'] = tetoScore >= 60 ? 'teto' : tetoScore <= 40 ? 'egen' : 'balanced';
  const reasons = Object.entries(tHits).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { tetoScore, type, teto, egen, reasons };
}
