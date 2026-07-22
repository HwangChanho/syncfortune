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
import { relationOf, yearLabels, seunBranchOfYear, seunStemOfYear, ageTendencyOf, yieojimOf, type SpouseRelation, type SpouseLabel } from './spouseDualCore';

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

// ── §8 이어짐 관법(daniel 07-22 ground truth) — 짝사랑/대시 '성사·발전' 판정 ──────────────────
//   차트→오행 플래그를 계산해 spouseDualCore.yieojimOf(순수 결정)에 넘긴다(골든 검증 = check:spouse-dual).
//   ★남/여 비대칭: 남명=식상生財(배우자성 파괴 안 됨) / 여명=상관견관→재성 통관 필요. 공통 게이트=배우자궁 합.
const STEM_EL: Record<string, string> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const BR_EL: Record<string, string> = { 寅: '木', 卯: '木', 巳: '火', 午: '火', 辰: '土', 戌: '土', 丑: '土', 未: '土', 申: '金', 酉: '金', 亥: '水', 子: '水' };
const GEN_EL: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // 생(식상)
const CTRL_EL: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };  // 극(재성)

export type YieojimYear = {
  year: number; seun: Branch;
  gungOpen: boolean; gungShaken: boolean; starActive: boolean; sikSang: boolean;
  mine: boolean;   // 내가좋아함(짝사랑) 이어짐
  theirs: boolean; // 상대가좋아함(대시) 이어짐
};

/**
 * §8 이어짐 관법 — 세운별 '내가 좋아함/상대가 좋아함' 성사 판정(결정론·온디바이스·API 0).
 * @param sex '남'|'여'(배우자성=남 재성/여 관성). 미상=남 기본.
 */
export function inyeonYieojim(saju: SajuChart, sex: string | undefined, fromYear: number, years = 8): YieojimYear[] {
  const timeUnknown = (saju as any)?.timeUnknown === true;
  const star = spouseStarBranch(saju, sex, timeUnknown);
  const gung = saju.pillars['일'].branch as Branch;
  const dayEl = STEM_EL[saju.dayMaster.stem] ?? '';
  const sikEl = GEN_EL[dayEl];   // 식상 오행(일간 생)
  const jaeEl = CTRL_EL[dayEl];  // 재성 오행(일간 극)
  const starEl = star ? BR_EL[star.branch] : null;
  const isFemale = sex === '여' || sex === 'F' || sex === 'female';
  // 원국 재성 존재(여명 통관용) — 천간 or 지지 본기 오행 = 재성 오행.
  const pos: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const natalJae = pos.some((p) => { const d = saju.pillars?.[p]; return !!d && (STEM_EL[d.stem] === jaeEl || BR_EL[d.branch] === jaeEl); });

  const out: YieojimYear[] = [];
  for (let i = 0; i < years; i++) {
    const year = fromYear + i;
    const seun = seunBranchOfYear(year);
    const seEl = STEM_EL[seunStemOfYear(year)], sbEl = BR_EL[seun];
    const gRel = relationOf(gung, seun);
    const gungOpen = gRel.sixhe || gRel.banhap || gRel.banghap;
    const gungShaken = gRel.chong || gRel.pa || gRel.wonjin;
    const sRel = star ? relationOf(star.branch, seun) : null;
    const starActive = !!(sRel && (sRel.sixhe || sRel.banhap || sRel.banghap));
    // 배우자성 파괴(남명 가드) = 충 OR 세운(천간/지지) 오행이 배우자성 오행 극.
    const starHurt = !!(sRel && sRel.chong) || (!!starEl && (CTRL_EL[seEl] === starEl || CTRL_EL[sbEl] === starEl));
    // 세운 식상 발동 = 세운 천간 or 지지 본기 오행 = 식상.
    const sikSang = seEl === sikEl || sbEl === sikEl;
    // (여명) 재성 통관 = 원국 재성 존재 AND 그 해 재성 파괴 안 됨(세운이 재성 오행 극 안 함).
    const jaeTonggwan = natalJae && !(CTRL_EL[seEl] === jaeEl || CTRL_EL[sbEl] === jaeEl);
    const { mine, theirs } = yieojimOf({ gungOpen, gungShaken, starActive, sikSang, starHurt, jaeTonggwan, isFemale });
    out.push({ year, seun, gungOpen, gungShaken, starActive, sikSang, mine, theirs });
  }
  return out;
}
