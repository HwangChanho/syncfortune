// app/src/lib/auspiciousDate.ts — 택일(좋은 날 찾기). 무료·온디바이스·표준 명리(Claude stance, daniel 검수 슬롯).
// ─────────────────────────────────────────────────────────────────────────
// 목적(결혼·이사·계약·개업·여행)별로, 향후 N일의 일진(日辰)을 내 사주와 대조해 점수화 → 좋은 날 추천.
// ★stance(표준 통설, daniel 검수): 점수 = 기준 50점에서
//   ① 일지 충(沖) 회피 — 그날 지지가 내 일지를 충하면 큰 감점(본인·배우자 자리 흔들림). 목적별 패널티 차등.
//   ② 일지 합(合) 가점 — 육합/삼합이면 흐름이 잘 맞음.
//   ③ 목적별 선호 십신 — 그날 천간이 내 일간에 주는 십신이 목적에 맞으면 가점(예: 개업=식상·재성, 계약=인성·관성).
//   ④ 12운성 — 기세가 왕한 날(장생·관대·건록·제왕) 가점, 쇠한 날(병·사·묘·절) 감점.
//   ⑤ 공망(空亡) 회피 — 그날 지지가 내 일주 기준 공망이면 감점(중요한 일은 비우는 날).
// ⚠️ §4 안전: 흉 단정·공포 금지 — 낮은 날은 '권하지 않음/피하는 게 좋음'으로 전향적. 본문 한자·용어 미노출.
// 서버·LLM 0 — 무료 티어(기획서 §9-5). 일진 계산은 lunar-javascript(오늘의 운세와 동일 결정론).
// ─────────────────────────────────────────────────────────────────────────
import { Solar } from 'lunar-javascript';
import { tenGod } from '@engine/saju';
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

const WANG = new Set(['장생', '관대', '건록', '제왕']); // 기세 왕성
const SOI = new Set(['병', '사', '묘', '절']);           // 기세 쇠퇴
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// ── 이유 문구(일상어·앱 언어, 한자/용어 미노출) ──
type Lang = 'ko' | 'en' | 'ja';
const REASON: Record<Lang, { hap: string; samhap: string; fit: (p: string) => string; wang: string; chung: string; gongmang: string }> = {
  ko: {
    hap: '흐름이 잘 맞아 무난하게 진행하기 좋은 날이에요.',
    samhap: '여러 기운이 한 방향으로 모여 큰일을 벌이기 좋아요.',
    fit: (p) => `${p}에 어울리는 기운이 들어오는 날이에요.`,
    wang: '기세가 올라 있어 시작에 활력이 붙어요.',
    chung: '자리가 부딪히는 변동이 있어 권하지 않아요.',
    gongmang: '기운이 비는 날이라 중요한 일은 피하는 게 좋아요.',
  },
  en: {
    hap: 'The flow lines up well — a smooth day to go ahead.',
    samhap: 'Several currents gather one way — good for taking on something big.',
    fit: (p) => `A day whose energy suits ${p}.`,
    wang: 'Momentum is up, lending energy to fresh starts.',
    chung: 'There’s a clashing shift in the air — not recommended.',
    gongmang: 'An empty-feeling day — better to avoid important matters.',
  },
  ja: {
    hap: '流れがよく噛み合い、無難に進めやすい日です。',
    samhap: 'いくつもの気が一方向に集まり、大きな事を始めるのに良い日です。',
    fit: (p) => `${p}に合う気が入ってくる日です。`,
    wang: '勢いが上がっていて、始めることに活力がつきます。',
    chung: '位置がぶつかる変動があり、おすすめしません。',
    gongmang: '気が空く日なので、大事な事は避けるのが良いです。',
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

/** 하루 점수화 — 위 ①~⑤ stance 합산. dayStem/dayBranch = 그날 일진 천간/지지. */
function scoreDay(saju: SajuChart, dayStem: string, dayBranch: string, purpose: Purpose): { score: number; reasons: string[] } {
  const me = saju.dayMaster.stem;
  const myBranch = saju.pillars['일'].branch;
  const R = REASON[appLang()];
  let score = 50;
  const reasons: string[] = [];

  // ① 충(가장 강함) — 충이면 합 판정 생략(상충 우선)
  if (CHUNG[myBranch] === dayBranch) {
    score += CHUNG_PENALTY[purpose];
    reasons.push(R.chung);
  } else {
    // ② 합 가점
    if (YUKHAP[myBranch] === dayBranch) { score += 14; reasons.push(R.hap); }
    const sg = SAMHAP.find((g) => g.includes(myBranch) && g.includes(dayBranch));
    if (sg && myBranch !== dayBranch) { score += 12; reasons.push(R.samhap); }
  }

  // ③ 목적별 선호 십신(그날 천간)
  const group = GROUP[tenGod(me as any, dayStem as any)];
  const pref = group ? (PURPOSE_PREF[purpose][group] ?? 0) : 0;
  if (pref > 0) { score += pref; reasons.push(R.fit(purposeLabel(purpose))); }

  // ④ 12운성(그날 지지에서의 일간 기세)
  const stage = twelveStage(me as any, dayBranch as any);
  if (WANG.has(stage)) { score += 8; reasons.push(R.wang); }
  else if (SOI.has(stage)) { score -= 8; }

  // ⑤ 공망 회피
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
