// app/src/lib/auspiciousDate.ts — 택일(좋은 날 찾기). 무료·온디바이스·표준 명리(Claude stance, daniel 검수 슬롯).
// ─────────────────────────────────────────────────────────────────────────
// 목적(결혼·이사·계약·개업·여행)별로, 향후 N일의 일진(日辰)을 내 사주와 대조해 점수화 → 좋은 날 추천.
// ★stance(표준 통설, daniel 검수): 점수 = 기준 50점에서 — *다각도*로 본다(daniel ④: 카테고리별 다른 날짜).
//   ① 일지 합충형해파 — 그날 지지와 내 일지의 관계: 충(沖) 큰 감점 / 형(刑)·해(害)·파(破) 마찰 감점(목적별 차등)
//      / 육합·삼합 가점. (기존 충·합에 형·해·파를 더해 변별력 ↑)
//   ② 운(運) 다각도 — 그날 지지가 현재 대운·세운 지지와 충/형/합을 이루는지도 본다(약하게). 원국만 보지 않음(가드10).
//   ③ 목적별 선호 십신 — 그날 천간 + *지장간*(여기·중기·정기)이 내 일간에 주는 십신이 목적에 맞으면 가점(지장간=절반 가중).
//   ④ 역마·도화 — 내 일지 삼합국에서 도출. 그날이 내 역마면 이동(여행·이사) 가점, 도화면 인연(소개팅·결혼) 가점 → 카테고리 변별.
//   ⑤ 12운성 — 기세가 왕한 날(장생·관대·건록·제왕) 가점, 쇠한 날(병·사·묘·절) 감점.
//   ⑥ 공망(空亡) 회피 — 그날 지지가 내 일주 기준 공망이면 감점(중요한 일은 비우는 날).
// ⚠️ §4 안전: 흉 단정·공포 금지 — 낮은 날은 '권하지 않음/피하는 게 좋음'으로 전향적. 본문 한자·용어 미노출.
// 서버·LLM 0 — 무료 티어(기획서 §9-5). 일진 계산은 lunar-javascript(오늘의 운세와 동일 결정론).
// ─────────────────────────────────────────────────────────────────────────
import { Solar } from 'lunar-javascript';
import { tenGod, HIDDEN } from '@engine/saju'; // HIDDEN = 지지별 지장간(여기·중기·정기) — 택일 다각도(daniel ④)
import { twelveStage } from '@engine/twelve';
import { gongmang } from '@engine/sinsal';
import { appLang } from './i18n';
import type { SajuChart } from '@spec/chart';

export type Purpose = 'wedding' | 'dating' | 'casual' | 'moving' | 'contract' | 'opening' | 'travel' | 'general';

// 지지 육충(六沖) — 자리가 정면으로 부딪히는 변동
const CHUNG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
// 지지 육합(六合) — 둘이 잘 어울림
const YUKHAP: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
// 삼합(三合) 국 — 같은 국이면 한 방향으로 모임
const SAMHAP: string[][] = [['申', '子', '辰'], ['巳', '酉', '丑'], ['寅', '午', '戌'], ['亥', '卯', '未']];
// 형(刑) — 마찰·구설·시비. 지세지형(寅巳申)·무은지형(丑戌未)·무례지형(子卯)·자형(辰午酉亥). 그날 지지가 내 지지의 형이면 감점.
const HYEONG: Record<string, string[]> = {
  寅: ['巳', '申'], 巳: ['寅', '申'], 申: ['寅', '巳'],   // 寅巳申
  丑: ['戌', '未'], 戌: ['丑', '未'], 未: ['丑', '戌'],   // 丑戌未
  子: ['卯'], 卯: ['子'],                                 // 子卯
  辰: ['辰'], 午: ['午'], 酉: ['酉'], 亥: ['亥'],         // 자형(같은 지지끼리)
};
// 해(害) — 방해·시기·소소한 어긋남(형보다 약함)
const HAE: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
// 파(破) — 깨짐·중단(가장 약함)
const PA: Record<string, string> = { 子: '酉', 酉: '子', 午: '卯', 卯: '午', 申: '巳', 巳: '申', 寅: '亥', 亥: '寅', 辰: '丑', 丑: '辰', 戌: '未', 未: '戌' };
// 역마·도화 — 내 일지(또는 년지) 삼합국에서 도출(표준): 申子辰→역마寅·도화酉 / 寅午戌→申·卯 / 巳酉丑→亥·午 / 亥卯未→巳·子.
//   그날 지지가 내 역마면 '이동(여행·이사)' 가점, 내 도화면 '인연(소개팅·결혼)' 가점 → 목적별 변별.
const YEOKMA: Record<string, string> = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
const DOHWA: Record<string, string> = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };

// 십신 10 → 5그룹(내부 분류). tenGod 반환(비견·겁재…)을 그룹으로.
type TgGroup = '비겁' | '식상' | '재성' | '관성' | '인성';
const GROUP: Record<string, TgGroup> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성', 정인: '인성', 편인: '인성',
};

// 목적별 선호 십신 가중(+점) — 그날 천간 십신이 목적에 맞으면 가점(표준 통설 매핑)
const PURPOSE_PREF: Record<Purpose, Partial<Record<TgGroup, number>>> = {
  wedding: { 관성: 6, 재성: 6, 인성: 3 },   // 혼사 = 배우자·예(관)·살림(재)·안정(인)
  dating: { 재성: 6, 식상: 5, 관성: 3 },    // 소개팅 = 이성운(재)·매력 표현(식상)·인연(관)
  casual: { 식상: 6, 비겁: 4 },             // 가벼운 만남 = 즐거움·표현(식상)·어울림(비겁)
  moving: { 인성: 7, 식상: 3 },             // 이사 = 거처·안정(인), 이동(식상)
  contract: { 인성: 7, 관성: 6 },           // 계약 = 문서(인)·신뢰·공식(관)
  opening: { 식상: 6, 재성: 8 },            // 개업 = 생산·표현(식상)·이익(재)
  travel: { 식상: 5, 재성: 3 },             // 여행·이동 = 활동·표현(식상)
  general: { 인성: 3, 재성: 3, 관성: 3 },   // 일반 길일
};
// 목적별 충(沖) 패널티 — 결혼·계약은 엄격, 여행은 변동 허용
const CHUNG_PENALTY: Record<Purpose, number> = { wedding: -30, contract: -28, opening: -22, general: -22, moving: -20, dating: -18, travel: -12, casual: -10 };
// 목적별 형(刑)·해(害)·파(破) 패널티(충보다 약함) — 결혼·계약은 마찰에 민감, 가벼운 만남·여행은 둔감(daniel 검수 슬롯).
const HYEONG_PENALTY: Record<Purpose, number> = { wedding: -16, contract: -15, opening: -12, general: -10, moving: -10, dating: -9, travel: -7, casual: -5 };
const HAE_PENALTY: Record<Purpose, number> = { wedding: -9, contract: -8, opening: -6, general: -5, moving: -5, dating: -5, travel: -3, casual: -3 };
const PA_PENALTY: Record<Purpose, number> = { wedding: -6, contract: -6, opening: -5, general: -4, moving: -4, dating: -4, travel: -3, casual: -2 };
// 역마(이동)·도화(인연) 가점이 유효한 목적만 — 그 외 목적엔 미적용(카테고리 변별의 핵심).
const YEOKMA_BONUS: Partial<Record<Purpose, number>> = { travel: 12, moving: 10, opening: 4 };
const DOHWA_BONUS: Partial<Record<Purpose, number>> = { dating: 12, casual: 9, wedding: 7 };

const WANG = new Set(['장생', '관대', '건록', '제왕']); // 기세 왕성
const SOI = new Set(['병', '사', '묘', '절']);           // 기세 쇠퇴
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// ── 이유 문구(일상어·앱 언어, 한자/용어 미노출) ──
type Lang = 'ko' | 'en' | 'ja';
const REASON: Record<Lang, { hap: string; samhap: string; fit: (p: string) => string; wang: string; chung: string; gongmang: string; friction: string; luckClash: string; luckFlow: string; yeokma: string; dohwa: string }> = {
  ko: {
    hap: '흐름이 잘 맞아 무난하게 진행하기 좋은 날이에요.',
    samhap: '여러 기운이 한 방향으로 모여 큰일을 벌이기 좋아요.',
    fit: (p) => `${p}에 어울리는 기운이 들어오는 날이에요.`,
    wang: '기세가 올라 있어 시작에 활력이 붙어요.',
    chung: '자리가 부딪히는 변동이 있어 권하지 않아요.',
    gongmang: '기운이 비는 날이라 중요한 일은 피하는 게 좋아요.',
    friction: '기운이 어긋나 마찰·구설이 생기기 쉬워 권하지 않아요.',
    luckClash: '지금의 큰 흐름(운)과 그날 기운이 어긋나 조심스러운 날이에요.',
    luckFlow: '지금의 흐름(운)과도 잘 맞아 더 든든한 날이에요.',
    yeokma: '움직임·이동의 기운이 좋은 날이에요.',
    dohwa: '인연·매력의 기운이 살아나는 날이에요.',
  },
  en: {
    hap: 'The flow lines up well — a smooth day to go ahead.',
    samhap: 'Several currents gather one way — good for taking on something big.',
    fit: (p) => `A day whose energy suits ${p}.`,
    wang: 'Momentum is up, lending energy to fresh starts.',
    chung: 'There’s a clashing shift in the air — not recommended.',
    gongmang: 'An empty-feeling day — better to avoid important matters.',
    friction: 'Energies grate against each other — friction or disputes are likely, so not recommended.',
    luckClash: 'The day’s energy runs against your current larger flow — a day to be careful.',
    luckFlow: 'It also fits your current flow well — an even more reassuring day.',
    yeokma: 'A day with good energy for movement and travel.',
    dohwa: 'A day when the energy of attraction and connection comes alive.',
  },
  ja: {
    hap: '流れがよく噛み合い、無難に進めやすい日です。',
    samhap: 'いくつもの気が一方向に集まり、大きな事を始めるのに良い日です。',
    fit: (p) => `${p}に合う気が入ってくる日です。`,
    wang: '勢いが上がっていて、始めることに活力がつきます。',
    chung: '位置がぶつかる変動があり、おすすめしません。',
    gongmang: '気が空く日なので、大事な事は避けるのが良いです。',
    friction: '気がすれ違い、摩擦や口論が起きやすいのでおすすめしません。',
    luckClash: '今の大きな流れ（運）とその日の気が食い違う、慎重になりたい日です。',
    luckFlow: '今の流れ（運）にもよく合う、より心強い日です。',
    yeokma: '移動・旅の気が良い日です。',
    dohwa: '縁・魅力の気が生きてくる日です。',
  },
};

// 목적 메타(라벨·이모지) — 화면 칩 + 이유 문구의 목적명
export const PURPOSES: { key: Purpose; ko: string; en: string; ja: string }[] = [
  { key: 'wedding', ko: '결혼·예식', en: 'Wedding', ja: '結婚・式' },
  { key: 'dating', ko: '소개팅', en: 'Blind date', ja: 'お見合い' },
  { key: 'casual', ko: '가벼운 만남', en: 'Casual date', ja: '気軽な出会い' },
  { key: 'moving', ko: '이사', en: 'Moving', ja: '引越し' },
  { key: 'contract', ko: '계약', en: 'Contract', ja: '契約' },
  { key: 'opening', ko: '개업·오픈', en: 'Opening', ja: '開業' },
  { key: 'travel', ko: '여행·이동', en: 'Travel', ja: '旅行・移動' },
];

export function purposeLabel(p: Purpose): string {
  const m = PURPOSES.find((x) => x.key === p);
  const l = appLang();
  return m ? (m as any)[l] ?? m.ko : '';
}

export type AuspiciousDay = {
  date: string;       // YYYY-MM-DD
  weekday: number;    // 0(일)~6(토)
  ganzhi: string;     // 그날 일진 간지(干支) — 내부/배지용
  score: number;      // 0~100(높을수록 좋음)
  reasons: string[];  // 일상어 이유(추천 사유·회피 사유)
};

/** 하루 점수화 — 위 ①~⑥ stance 합산(다각도). dayStem/dayBranch = 그날 일진 천간/지지. */
function scoreDay(saju: SajuChart, dayStem: string, dayBranch: string, purpose: Purpose): { score: number; reasons: string[] } {
  const me = saju.dayMaster.stem;
  const myBranch = saju.pillars['일'].branch;
  const R = REASON[appLang()];
  let score = 50;
  const reasons: string[] = [];

  // ① 일지 합/충 — 충이면 합 판정 생략(상충 우선)
  if (CHUNG[myBranch] === dayBranch) {
    score += CHUNG_PENALTY[purpose];
    reasons.push(R.chung);
  } else {
    if (YUKHAP[myBranch] === dayBranch) { score += 14; reasons.push(R.hap); }
    const sg = SAMHAP.find((g) => g.includes(myBranch) && g.includes(dayBranch));
    if (sg && myBranch !== dayBranch) { score += 12; reasons.push(R.samhap); }
  }
  // ① 일지 형/해/파 — 충과 별개로 누적(충+형 겹치면 더 흉). 사유는 가장 강한 마찰 1회만 노출.
  let friction = false;
  const addFriction = () => { if (!friction) { reasons.push(R.friction); friction = true; } };
  if ((HYEONG[myBranch] ?? []).includes(dayBranch)) { score += HYEONG_PENALTY[purpose]; addFriction(); }
  if (HAE[myBranch] === dayBranch) { score += HAE_PENALTY[purpose]; addFriction(); }
  if (PA[myBranch] === dayBranch) { score += PA_PENALTY[purpose]; addFriction(); }

  // ② 운(運) 다각도 — 그날 지지가 현재 대운·세운 지지와 충·형(감점)/합·삼합(가점). 원국 일지보다 약하게(가드10).
  const luckBranches = [(saju as any).currentLuck?.branch, (saju as any).annual?.branch].filter(Boolean) as string[];
  let luckClash = false, luckFlow = false;
  for (const lb of luckBranches) {
    if (CHUNG[lb] === dayBranch || (HYEONG[lb] ?? []).includes(dayBranch)) { score -= 6; luckClash = true; }
    else if (YUKHAP[lb] === dayBranch || SAMHAP.some((g) => g.includes(lb) && g.includes(dayBranch) && lb !== dayBranch)) { score += 5; luckFlow = true; }
  }
  if (luckClash) reasons.push(R.luckClash);
  else if (luckFlow) reasons.push(R.luckFlow);

  // ③ 목적별 선호 십신 — 그날 천간(full) + 지장간(여기·중기·정기, 절반 가중)
  let pref = 0;
  const surf = GROUP[tenGod(me as any, dayStem as any)];
  if (surf) pref += PURPOSE_PREF[purpose][surf] ?? 0;
  for (const h of (HIDDEN[dayBranch as keyof typeof HIDDEN] ?? [])) {
    const g = GROUP[tenGod(me as any, h.stem as any)];
    if (g) pref += (PURPOSE_PREF[purpose][g] ?? 0) * 0.5;
  }
  if (pref > 0) { score += pref; reasons.push(R.fit(purposeLabel(purpose))); }

  // ④ 역마(이동)·도화(인연) — 내 일지 삼합국 기준. 목적에 해당할 때만 가점(카테고리 변별).
  if (YEOKMA[myBranch] === dayBranch && YEOKMA_BONUS[purpose] != null) { score += YEOKMA_BONUS[purpose]!; reasons.push(R.yeokma); }
  if (DOHWA[myBranch] === dayBranch && DOHWA_BONUS[purpose] != null) { score += DOHWA_BONUS[purpose]!; reasons.push(R.dohwa); }

  // ⑤ 12운성(그날 지지에서의 일간 기세)
  const stage = twelveStage(me as any, dayBranch as any);
  if (WANG.has(stage)) { score += 8; reasons.push(R.wang); }
  else if (SOI.has(stage)) { score -= 8; }

  // ⑥ 공망 회피
  const [g1, g2] = gongmang(saju.pillars['일'].stem as any, myBranch as any);
  if (dayBranch === g1 || dayBranch === g2) { score -= 15; reasons.push(R.gongmang); }

  return { score: clamp(score), reasons };
}

/**
 * 택일 — 오늘부터 days일간의 일진을 내 사주로 점수화. 화면이 정렬·필터해 추천.
 * @param saju 대표 명식 / @param purpose 목적 / @param days 탐색 기간(기본 90)
 */
export function findAuspiciousDays(saju: SajuChart, purpose: Purpose, days = 90): AuspiciousDay[] {
  const out: AuspiciousDay[] = [];
  const base = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const gz = (Solar as any).fromDate(d).getLunar().getDayInGanZhi() as string; // 그날 일진 간지
    const { score, reasons } = scoreDay(saju, gz[0], gz[1], purpose);
    out.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      weekday: d.getDay(), ganzhi: gz, score, reasons,
    });
  }
  return out;
}
