// app/src/lib/content/sokgunghap.ts — 속궁합(성적 궁합) 결정론 (온디바이스·API 0·17+)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-14 기획서 ④. '명시적 성적 궁합' — 두 명식의 *성적 케미* 신호를 결정론으로 산출.
//   토대(발명 아님·표준 명리 신호): ① 도화(桃花·이성 매력, 12신살) ② 홍염(紅艶·끼·성적 매력, 길신)
//   ③ 일지=배우자궁 관계(육합=깊은 몸궁합 / 충=격정·소진 / 형=마찰 / 해=엇박) ④ 일간 음양 상보
//   ⑤ 전체 오행 조화−긴장(analyzeCompatibility 재사용).
//   ★stance = Claude 초안(가중치·성적 해석 문구) — daniel 검수 슬롯(명리 stance·수위는 유저 확정).
//   §4 안전: 17+·'재미로만'·부정 증폭 금지(낮은 케미도 전향적). 성적 주제를 직접 다루되 노골/외설 배제(App Store 17+ 한도).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, Branch, Stem, PillarPos } from '@spec/chart';
import type { SinsalResult } from '@engine/sinsal';
import { analyzeCompatibility } from '@engine/compatibility';

// computeChart(engine.ts) 결과의 구조적 부분 — saju + sinsal 만 있으면 됨(결합도↓).
export type SokSide = { saju: SajuChart; sinsal: SinsalResult };

const POS: PillarPos[] = ['년', '월', '일', '시'];
const YANG_STEM = new Set<Stem>(['甲', '丙', '戊', '庚', '壬']); // 양간

// ── 일지(배우자궁) 지지 관계 테이블(표준 명리 — 발명 아님) ──
const SIXHE: [Branch, Branch][] = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']]; // 육합
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]; // 충
const HAE: [Branch, Branch][] = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']];   // 해(害)
const SAMHYEONG = new Set<string>(['寅巳', '巳申', '申寅', '丑戌', '戌未', '未丑']); // 삼형 대표쌍
const JAHYEONG = new Set<Branch>(['辰', '午', '酉', '亥']); // 자형(같은 글자)

const has = (list: [Branch, Branch][], a: Branch, b: Branch) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export type SpousePalaceRel = '육합' | '충' | '형' | '해' | '무';
/** 두 일지(배우자궁) 관계 판정 — 성적 궁합의 핵심 축. 우선순위: 합>충>형>해. */
function spousePalaceRel(a: Branch, b: Branch): SpousePalaceRel {
  if (has(SIXHE, a, b)) return '육합';
  if (has(CHONG, a, b)) return '충';
  if (SAMHYEONG.has(`${a}${b}`) || SAMHYEONG.has(`${b}${a}`) || (a === b && JAHYEONG.has(a))) return '형';
  if (has(HAE, a, b)) return '해';
  return '무';
}

// ── 매력 신호 추출(한 명식) ──
type Charm = { dohwa: number; hongyeom: number; total: number };
/** 도화(12신살·중복 자리 제거) + 홍염(길신) 적중 개수 = 그 사람의 '이성/성적 매력' 신호. */
function charmOf(side: SokSide): Charm {
  // 도화: twelve 각 기둥에서 name==='도화' 인 자리 수(자리 기준 유니크).
  let dohwa = 0;
  for (const p of POS) if ((side.sinsal.twelve[p] ?? []).some((x) => x.name === '도화')) dohwa++;
  // 홍염: sinsal 배열에서 name==='홍염' 의 hits 자리 수.
  const hy = side.sinsal.sinsal.find((s) => s.name === '홍염');
  const hongyeom = hy ? hy.hits.length : 0;
  return { dohwa, hongyeom, total: dohwa + hongyeom };
}

// ── 등급(속궁합 특화·전향적 라벨·§4) ──
export type SokTier = { key: string; min: number; emoji: string; ko: string; en: string; ja: string };
export const SOK_TIERS: SokTier[] = [
  { key: 'blaze',  min: 84, emoji: '🔥', ko: '불꽃 케미',   en: 'Blazing Chemistry', ja: '燃える相性' },
  { key: 'hot',    min: 70, emoji: '💋', ko: '뜨거운 끌림', en: 'Hot Attraction',    ja: '熱い惹かれ' },
  { key: 'warm',   min: 57, emoji: '💗', ko: '잘 맞는 몸궁합', en: 'In Sync',         ja: '好相性' },
  { key: 'tease',  min: 44, emoji: '😏', ko: '밀당형',       en: 'Push & Pull',       ja: '駆け引き型' },
  { key: 'slow',   min: 30, emoji: '🌙', ko: '천천히 데워지는', en: 'Slow Burn',      ja: 'じっくり型' },
  { key: 'spark',  min: 0,  emoji: '⚡', ko: '극과 극의 격정', en: 'Opposite Sparks', ja: '正反対の情熱' },
];
export function sokTierOf(score: number): SokTier {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return SOK_TIERS.find((x) => s >= x.min) ?? SOK_TIERS[SOK_TIERS.length - 1];
}
export function sokTierLabel(tier: SokTier, lang: 'ko' | 'en' | 'ja'): string {
  return (tier as any)[lang] ?? tier.ko;
}

export type SokResult = {
  score: number;                 // 끌림 총점 0~100([18,96] 클램프 — 극단 회피)
  kissScore: number;             // 키스궁합(감정·설렘 축) — 일간 케미+음양+매력
  bedScore: number;              // 관계(밤)궁합(신체 축) — 배우자궁 일지+홍염+음양+매력
  tier: SokTier;
  myCharm: Charm;
  partnerCharm: Charm;
  spouse: SpousePalaceRel;       // 일지(배우자궁) 관계
  dmType: '합' | '충' | '상생' | '상극' | '비화';
  yinyangComplement: boolean;    // 일간 음양 상보(양-음)
  harmony: number;
  tension: number;
  signals: string[];             // 결정론 근거(화면 칩)
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(x)));

// 일지 관계 → 점수 가중(★daniel 검수 슬롯). 육합=깊은 몸궁합, 충=격정이나 소진, 형=마찰, 해=엇박.
const SPOUSE_W: Record<SpousePalaceRel, number> = { 육합: 16, 충: 8, 형: -4, 해: -6, 무: 0 };
// 일간 관계 가중(★). 합=강한 성적 끌림.
const DM_W: Record<SokResult['dmType'], number> = { 합: 12, 상생: 6, 비화: 2, 상극: -2, 충: 6 }; // 충=대립이나 성적 긴장은 오히려 +

/**
 * 두 명식 → 속궁합 점수·등급·신호. 결정론(같은 쌍=같은 결과).
 * 산식(★daniel 검수 슬롯): base 52 + 매력(양쪽 도화·홍염) + 일지관계 + 일간관계 + 음양상보 + (조화−긴장).
 */
export function analyzeSokgunghap(me: SokSide, other: SokSide): SokResult {
  const myCharm = charmOf(me);
  const partnerCharm = charmOf(other);
  const aB = me.saju.pillars['일'].branch, bB = other.saju.pillars['일'].branch;
  const spouse = spousePalaceRel(aB, bB);

  const dx = analyzeCompatibility(me.saju, other.saju);
  const dmType = dx.dayMasterRelation.type;
  const harmony = dx.harmony.length, tension = dx.tension.length;

  const aYang = YANG_STEM.has(me.saju.dayMaster.stem);
  const bYang = YANG_STEM.has(other.saju.dayMaster.stem);
  const yinyangComplement = aYang !== bYang; // 양-음 = 성적 상보(음양 조화)

  // 매력 가중: 양쪽 합이 클수록 불꽃(둘 다 끼 있음). 한쪽만 높으면 온도차.
  const charmSum = myCharm.total + partnerCharm.total;
  const charmW = Math.min(18, charmSum * 3);             // 자리당 3점, 최대 18
  const bothCharmed = myCharm.total > 0 && partnerCharm.total > 0 ? 4 : 0; // 양쪽 다 = 시너지

  let s = 52 + charmW + bothCharmed + SPOUSE_W[spouse] + DM_W[dmType] + (yinyangComplement ? 6 : 0) + (harmony - tension) * 3;
  s = Math.max(18, Math.min(96, Math.round(s)));

  // 하위 점수(★daniel 검수 슬롯) — 끌림 총점과 별개 축.
  //   키스궁합(감정·설렘) = 일간 케미 + 음양 상보 + 매력. / 관계(밤)궁합(신체) = 배우자궁 일지 + 홍염(성적 매력) + 음양 + 매력.
  const hongyeomSum = myCharm.hongyeom + partnerCharm.hongyeom;
  const kissScore = clamp(52 + DM_W[dmType] * 1.6 + (yinyangComplement ? 10 : 0) + Math.min(16, charmSum * 3), 20, 97);
  const bedScore = clamp(50 + SPOUSE_W[spouse] * 1.4 + Math.min(14, hongyeomSum * 4) + (yinyangComplement ? 8 : 0) + Math.min(10, charmSum * 2), 20, 97);

  // 결정론 근거 칩(화면 표시·근거 투명성)
  const signals: string[] = [];
  if (spouse !== '무') signals.push(`배우자궁 일지 ${aB}·${bB} ${spouse}`);
  signals.push(`일간 ${dmType}`);
  if (myCharm.total) signals.push(`나 매력(도화 ${myCharm.dohwa}·홍염 ${myCharm.hongyeom})`);
  if (partnerCharm.total) signals.push(`상대 매력(도화 ${partnerCharm.dohwa}·홍염 ${partnerCharm.hongyeom})`);
  signals.push(yinyangComplement ? '음양 상보' : '음양 동질');
  if (harmony) signals.push(`조화 ${harmony}`);
  if (tension) signals.push(`긴장 ${tension}`);

  return { score: s, kissScore, bedScore, tier: sokTierOf(s), myCharm, partnerCharm, spouse, dmType, yinyangComplement, harmony, tension, signals };
}
