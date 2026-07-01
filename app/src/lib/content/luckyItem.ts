// app/src/lib/luckyItem.ts — 오늘의 행운(색·방향·숫자·아이템). 무료·온디바이스(API 0)·표준 오행 상징.
// ─────────────────────────────────────────────────────────────────────────
// 오늘 일진(日辰) 천간의 오행 = '오늘의 기운'. 그 오행의 상징(색·방위·수리·소품)을 행운 아이템으로 추천.
//   ★stance: 전통 오행 상징(색=오색, 방위=오방, 수리=하도수)·통설. daniel 검수 슬롯.
//   §4: 재미·가벼운 콘텐츠 — 단정·미신 조장 없이 '오늘 곁에 두면 좋은 결' 정도로.
// ─────────────────────────────────────────────────────────────────────────
import { getDailyFortune } from './dailyFortune';
import { stemElement, branchElement } from '../engine/ohaeng';
import { appLang } from '../i18n';

type Elem = '木' | '火' | '土' | '金' | '水';
type L = 'ko' | 'en' | 'ja';

// 오행별 상징 — 색(대표 hex + 이름)·방위·수리(하도수)·어울리는 소품
const DATA: Record<Elem, { hex: string; color: Record<L, string>; dir: Record<L, string>; nums: number[]; item: Record<L, string> }> = {
  木: { hex: '#3E8E5A', color: { ko: '초록·청록', en: 'Green & Teal', ja: '緑·青緑' }, dir: { ko: '동쪽', en: 'East', ja: '東' }, nums: [3, 8], item: { ko: '화분·나무 소품·책', en: 'plants, wooden items, books', ja: '植物·木の小物·本' } },
  火: { hex: '#C0392B', color: { ko: '빨강·분홍', en: 'Red & Pink', ja: '赤·ピンク' }, dir: { ko: '남쪽', en: 'South', ja: '南' }, nums: [2, 7], item: { ko: '향초·따뜻한 조명', en: 'candles, warm lighting', ja: 'キャンドル·暖色照明' } },
  土: { hex: '#B8860B', color: { ko: '노랑·베이지', en: 'Yellow & Beige', ja: '黄·ベージュ' }, dir: { ko: '중앙', en: 'Center', ja: '中央' }, nums: [5, 10], item: { ko: '도자기·돌 소품', en: 'ceramics, stone items', ja: '陶器·石の小物' } },
  金: { hex: '#C9A14A', color: { ko: '흰색·금색', en: 'White & Gold', ja: '白·金' }, dir: { ko: '서쪽', en: 'West', ja: '西' }, nums: [4, 9], item: { ko: '금속 액세서리·시계', en: 'metal accessories, watches', ja: '金属アクセ·時計' } },
  水: { hex: '#3A6EA5', color: { ko: '검정·파랑', en: 'Black & Blue', ja: '黒·青' }, dir: { ko: '북쪽', en: 'North', ja: '北' }, nums: [1, 6], item: { ko: '유리·물 관련 소품', en: 'glass, water-themed items', ja: 'ガラス·水関連の小物' } },
};

// 오행 한 글자 라벨(다국어) — 본문 노출용(한자 대신 일상어)
const ELEM_LABEL: Record<Elem, Record<L, string>> = {
  木: { ko: '나무', en: 'Wood', ja: '木' }, 火: { ko: '불', en: 'Fire', ja: '火' }, 土: { ko: '흙', en: 'Earth', ja: '土' },
  金: { ko: '쇠', en: 'Metal', ja: '金' }, 水: { ko: '물', en: 'Water', ja: '水' },
};

export type LuckyToday = {
  date: string; elemLabel: string; hex: string; color: string; dir: string; nums: number[]; item: string;
};

/** 오늘의 행운 — 일진 천간 오행 기준. 명식 불필요(누구나 오늘 기운). */
export function luckyToday(): LuckyToday {
  const f = getDailyFortune();
  const el = stemElement(f.dayGanZhi[0]) as Elem;
  const L = (appLang() as L) ?? 'ko';
  const d = DATA[el];
  return { date: f.date, elemLabel: ELEM_LABEL[el][L], hex: d.hex, color: d.color[L], dir: d.dir[L], nums: d.nums, item: d.item[L] };
}

// 내 명식의 부족 오행(가장 적은 오행) 보완 색 — 명식 있으면 상시 추천(개인화). saju.pillars 필요.
export function weakElementColor(saju: any): { elemLabel: string; hex: string; color: string } | null {
  if (!saju?.pillars) return null;
  const cnt: Record<Elem, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  (['년', '월', '일', '시'] as const).forEach((p) => {
    const d = saju.pillars[p];
    if (d) { cnt[stemElement(d.stem) as Elem]++; cnt[branchElement(d.branch) as Elem]++; }
  });
  const L = (appLang() as L) ?? 'ko';
  const weak = (Object.entries(cnt) as [Elem, number][]).sort((a, b) => a[1] - b[1])[0][0];
  return { elemLabel: ELEM_LABEL[weak][L], hex: DATA[weak].hex, color: DATA[weak].color[L] };
}
