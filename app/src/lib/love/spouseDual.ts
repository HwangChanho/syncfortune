// app/src/lib/love/spouseDual.ts — R-SPOUSE-DUAL 배우자 이원 궁위 결정론 엔진 (L1·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 스펙: /R-SPOUSE-DUAL_spec.md (daniel Draft v0.1 + 2026-07-20 §7 확정). 노션 도화 코멘트(07-20)와 한 세트:
//   ★"도화 발동 '시점'은 없다"(daniel) → 재회/애정 timing 은 도화-충이 아니라 **배우자성/궁 × 세운 개입**에서 나온다.
//
// 두 축(§1): 배우자성(配偶星)=남 재성/여 관성이 놓인 지지(월·년·시=이상형) / 배우자궁(配偶宮)=일지(실질·정궁).
// 세운 라벨(§3)·강도(§7.1)·시나리오(§7.2)·나이대(§7.3)의 순수 규칙은 spouseDualCore 에 있고, 여기선 그걸
//   실제 차트(배우자성 위치 산출=십신 필요)에 얹어 종합 산출한다.
// ★검증: 辛丑 케이스(§3.2 2026~2033) 골든 = scripts/check-spouse-dual. 실제 상대 사주 입력 시 R46 궁합 override(§6).
// ⚠️명리 stance = daniel ground truth(스펙). 결정론 인코딩(발명 아님).
// ─────────────────────────────────────────────────────────────────────────
import { tenGod, HIDDEN } from '@engine/saju';
import type { SajuChart, Branch, Stem, TenGod, PillarPos } from '@spec/chart';
import { relationOf, yearLabels, seunBranchOfYear, ageTendencyOf, type SpouseRelation, type SpouseLabel } from './spouseDualCore';

export { relationOf, yearLabels, seunBranchOfYear } from './spouseDualCore';
export type { SpouseRelation, SpouseLabel } from './spouseDualCore';

/** 배우자성 지지 위치(월>년>시 우선, 본기 재/관 → 없으면 지장간 재/관). 없으면 null. */
export function spouseStarBranch(saju: SajuChart, sex: string | undefined, timeUnknown: boolean): { branch: Branch; pos: PillarPos } | null {
  const dm = saju.dayMaster.stem;
  const gods: TenGod[] = sex === '여' ? ['정관', '편관'] : ['정재', '편재']; // 남=재/여=관(미상=남 기본)
  const pref: PillarPos[] = timeUnknown ? ['월', '년'] : ['월', '년', '시']; // 일지는 궁이라 제외
  const isGod = (s: Stem) => gods.includes(tenGod(dm, s));
  for (const p of pref) { const b = saju.pillars?.[p]?.branch as Branch | undefined; if (b && HIDDEN[b]?.[0] && isGod(HIDDEN[b][0].stem)) return { branch: b, pos: p }; } // 1차: 본기
  for (const p of pref) { const b = saju.pillars?.[p]?.branch as Branch | undefined; if (b && HIDDEN[b]?.some((h) => isGod(h.stem))) return { branch: b, pos: p }; } // 2차: 지장간
  return null;
}

export type SpouseYear = { year: number; seun: Branch; labels: SpouseLabel[]; ignition: number; settle: number };
export type SpouseDual = {
  star: { branch: Branch; pos: PillarPos } | null; // 배우자성 위치(이상형 신호)
  gung: Branch;                                     // 배우자궁(일지·실질)
  base: SpouseRelation;                             // 성↔궁 관계(격각/충/원진/파/합) = 이상형 vs 실배우자 괴리축
  age: { elder: number; younger: number };          // 나이대 경향(§7.3)
  timeline: SpouseYear[];                            // 연도별 세운 라벨·발동/안착 강도
  settleProbability: number;                         // 시나리오 A(발동→안착) 확률(%) — §7.2 자동 제시(실측 override 전)
};

/**
 * 배우자 이원 궁위 종합 산출(결정론). @param fromYear 시작 연도 @param years 표시 연수(기본 8).
 *   §7.2 시나리오 확률 = 첫 발동(EVENT/TYPE_A_ACTIVE) 이후 창에서 안착(합 궁·복음) vs 재발동(충 성) 힘의 비율.
 */
export function analyzeSpouseDual(saju: SajuChart, sex: string | undefined, fromYear: number, years = 8): SpouseDual {
  const timeUnknown = (saju as any)?.timeUnknown === true;
  const star = spouseStarBranch(saju, sex, timeUnknown);
  const gung = saju.pillars['일'].branch as Branch;
  const base = relationOf(star ? star.branch : gung, gung); // 성 없으면 궁 자기관계(=same, 괴리 없음)

  const timeline: SpouseYear[] = [];
  for (let i = 0; i < years; i++) {
    const year = fromYear + i;
    const seun = seunBranchOfYear(year);
    const labels = yearLabels(star ? star.branch : null, gung, seun);
    const gRel = relationOf(gung, seun);
    const sRel = star ? relationOf(star.branch, seun) : null;
    timeline.push({ year, seun, labels, ignition: Math.max(gRel.ignition, sRel?.ignition ?? 0), settle: Math.max(gRel.settle, sRel?.settle ?? 0) });
  }

  // §7.2 안착 확률 — 첫 발동 이후 창에서 '안착(TYPE_B_SETTLE/CONFIRM)' 힘 vs '재발동(TYPE_A_RESOLVE)' 힘.
  const firstActive = timeline.findIndex((t) => t.labels.includes('EVENT_CANDIDATE') || t.labels.includes('TYPE_A_ACTIVE'));
  let settleProbability = 0;
  if (firstActive >= 0) {
    let settleForce = 0, resolveForce = 0;
    for (let i = firstActive + 1; i < timeline.length; i++) {
      const t = timeline[i];
      if (t.labels.includes('TYPE_B_SETTLE') || t.labels.includes('CONFIRM')) settleForce += t.settle || 60;
      if (t.labels.includes('TYPE_A_RESOLVE')) resolveForce += star ? relationOf(star.branch, t.seun).ignition : 0;
    }
    settleProbability = settleForce + resolveForce > 0 ? Math.round((settleForce / (settleForce + resolveForce)) * 100) : 50;
  }

  const yearB = saju.pillars?.['년']?.branch as Branch | undefined;
  const hourB = timeUnknown ? undefined : (saju.pillars?.['시']?.branch as Branch | undefined);
  return { star, gung, base, age: ageTendencyOf(star ? star.branch : null, yearB, gung, hourB), timeline, settleProbability };
}
