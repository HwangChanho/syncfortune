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

// 오행별 상징 — 색(대표 hex + 이름)·방위·수리(하도수)·어울리는 소품·코디·음식
// ★food/wear 추가(daniel 2026-07-26 "음식 추천 코디 추천 같은 추천 콘텐츠 더 넣자").
//   stance: **오행-오미(五味)·오색(五色) 표준 대응**(통설) — 木=신맛/청, 火=쓴맛/적, 土=단맛/황,
//   金=매운맛/백, 水=짠맛/흑. 색은 위 color 와 같은 계열이라 따로 만들지 않고 '코디 표현'만 덧붙인다.
//   ⚠️음식·코디 문구 = Claude 초안 → daniel 검수 슬롯(위 색·방위와 동일 취급).
//   §4: 의료·영양 단정 금지 — '오늘 곁에 두면 좋은 결' 수준의 재미 콘텐츠로만.
const DATA: Record<Elem, {
  hex: string; color: Record<L, string>; dir: Record<L, string>; nums: number[]; item: Record<L, string>;
  food: Record<L, string>; wear: Record<L, string>;
}> = {
  木: { hex: '#3E8E5A', color: { ko: '초록·청록', en: 'Green & Teal', ja: '緑·青緑' }, dir: { ko: '동쪽', en: 'East', ja: '東' }, nums: [3, 8], item: { ko: '화분·나무 소품·책', en: 'plants, wooden items, books', ja: '植物·木の小物·本' },
    food: { ko: '새콤한 것·푸른 잎채소·나물', en: 'sour foods, leafy greens', ja: '酸味·青菜' }, wear: { ko: '초록 포인트에 리넨·면 같은 자연스러운 소재', en: 'green accents, natural fabrics', ja: '緑の小物·自然素材' } },
  火: { hex: '#C0392B', color: { ko: '빨강·분홍', en: 'Red & Pink', ja: '赤·ピンク' }, dir: { ko: '남쪽', en: 'South', ja: '南' }, nums: [2, 7], item: { ko: '향초·따뜻한 조명', en: 'candles, warm lighting', ja: 'キャンドル·暖色照明' },
    food: { ko: '따뜻하게 구운 것·향이 진한 차', en: 'grilled dishes, aromatic tea', ja: '焼き物·香り高いお茶' }, wear: { ko: '붉은 기 한 점으로 시선을 모으는 코디', en: 'one red accent piece', ja: '赤を一点差し' } },
  土: { hex: '#B8860B', color: { ko: '노랑·베이지', en: 'Yellow & Beige', ja: '黄·ベージュ' }, dir: { ko: '중앙', en: 'Center', ja: '中央' }, nums: [5, 10], item: { ko: '도자기·돌 소품', en: 'ceramics, stone items', ja: '陶器·石の小物' },
    food: { ko: '단맛 도는 곡물·뿌리채소·호박', en: 'grains, root vegetables', ja: '穀物·根菜' }, wear: { ko: '베이지·카멜로 차분하게 맞춘 톤온톤', en: 'beige & camel tone-on-tone', ja: 'ベージュのトーンオントーン' } },
  金: { hex: '#C9A14A', color: { ko: '흰색·금색', en: 'White & Gold', ja: '白·金' }, dir: { ko: '서쪽', en: 'West', ja: '西' }, nums: [4, 9], item: { ko: '금속 액세서리·시계', en: 'metal accessories, watches', ja: '金属アクセ·時計' },
    food: { ko: '알싸한 것·무·배·흰살 생선', en: 'pungent foods, white fish', ja: '辛味·白身魚' }, wear: { ko: '흰 셔츠에 금속 액세서리로 깔끔하게', en: 'white shirt + metal accessory', ja: '白シャツ+金属アクセ' } },
  水: { hex: '#3A6EA5', color: { ko: '검정·파랑', en: 'Black & Blue', ja: '黒·青' }, dir: { ko: '북쪽', en: 'North', ja: '北' }, nums: [1, 6], item: { ko: '유리·물 관련 소품', en: 'glass, water-themed items', ja: 'ガラス·水関連の小物' },
    food: { ko: '담백한 국물·해조류·검은콩', en: 'clear broth, seaweed, black beans', ja: 'すまし汁·海藻·黒豆' }, wear: { ko: '네이비·블랙으로 떨어지는 실루엣', en: 'navy & black clean silhouette', ja: 'ネイビー·黒のシルエット' } },
};

// 오행 한 글자 라벨(다국어) — 본문 노출용(한자 대신 일상어)
const ELEM_LABEL: Record<Elem, Record<L, string>> = {
  木: { ko: '나무', en: 'Wood', ja: '木' }, 火: { ko: '불', en: 'Fire', ja: '火' }, 土: { ko: '흙', en: 'Earth', ja: '土' },
  金: { ko: '쇠', en: 'Metal', ja: '金' }, 水: { ko: '물', en: 'Water', ja: '水' },
};

export type LuckyToday = {
  date: string; elemLabel: string; hex: string; color: string; dir: string; nums: number[]; item: string;
  food: string;  // 오늘 기운에 어울리는 음식·맛(오미)
  wear: string;  // 오늘 기운에 어울리는 코디(오색 기반 표현)
};

/** 오늘의 행운 — 일진 천간 오행 기준. 명식 불필요(누구나 오늘 기운). */
export function luckyToday(): LuckyToday {
  const f = getDailyFortune();
  const el = stemElement(f.dayGanZhi[0]) as Elem;
  const L = (appLang() as L) ?? 'ko';
  const d = DATA[el];
  return { date: f.date, elemLabel: ELEM_LABEL[el][L], hex: d.hex, color: d.color[L], dir: d.dir[L], nums: d.nums, item: d.item[L], food: d.food[L], wear: d.wear[L] };
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
