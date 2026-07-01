// app/src/lib/zodiac.ts — 띠·별자리 오늘운세. 무료·온디바이스(API 0)·가벼운 재미.
// ─────────────────────────────────────────────────────────────────────────
// 띠(十二支): 내 띠 지지 vs 오늘 일진 지지의 관계(합·충·비화·무난)로 오늘 한 줄.  ★표준 지지 관계(통설).
// 별자리(양력 12궁): 서양 점성 — 명리 아님. 날짜 시드 기반 가벼운 오늘 메시지(긍정 위주).
// §4: 가벼운 콘텐츠 — 흉 단정 없이 전향적. daniel 검수 슬롯(문구 톤).
// ─────────────────────────────────────────────────────────────────────────
import { getDailyFortune } from './dailyFortune';
import { appLang } from '../i18n';

type L = 'ko' | 'en' | 'ja';
const lang = (): L => (appLang() as L) ?? 'ko';

// ── 띠(12지) ──
export const ANIMAL_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ANIMAL: Record<string, Record<L, string>> = {
  子: { ko: '쥐띠', en: 'Rat', ja: '子(ねずみ)' }, 丑: { ko: '소띠', en: 'Ox', ja: '丑(うし)' },
  寅: { ko: '호랑이띠', en: 'Tiger', ja: '寅(とら)' }, 卯: { ko: '토끼띠', en: 'Rabbit', ja: '卯(うさぎ)' },
  辰: { ko: '용띠', en: 'Dragon', ja: '辰(たつ)' }, 巳: { ko: '뱀띠', en: 'Snake', ja: '巳(へび)' },
  午: { ko: '말띠', en: 'Horse', ja: '午(うま)' }, 未: { ko: '양띠', en: 'Goat', ja: '未(ひつじ)' },
  申: { ko: '원숭이띠', en: 'Monkey', ja: '申(さる)' }, 酉: { ko: '닭띠', en: 'Rooster', ja: '酉(とり)' },
  戌: { ko: '개띠', en: 'Dog', ja: '戌(いぬ)' }, 亥: { ko: '돼지띠', en: 'Pig', ja: '亥(いのしし)' },
};
const CHUNG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const YUKHAP: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const SAMHAP = [['申', '子', '辰'], ['巳', '酉', '丑'], ['寅', '午', '戌'], ['亥', '卯', '未']];

type Rel = 'same' | 'hap' | 'chung' | 'plain';
function branchRel(my: string, day: string): Rel {
  if (my === day) return 'same';
  if (CHUNG[my] === day) return 'chung';
  if (YUKHAP[my] === day || SAMHAP.some((g) => g.includes(my) && g.includes(day))) return 'hap';
  return 'plain';
}
const REL_TEXT: Record<Rel, Record<L, string>> = {
  same: { ko: '내 기운이 살아나는 날 — 미뤄둔 일을 밀어붙이기 좋아요.', en: 'Your energy is up — a good day to push what you put off.', ja: '自分の気が乗る日 — 後回しにした事を進めやすいです。' },
  hap: { ko: '귀인·인연의 도움이 따르는 날 — 부탁이나 만남에 좋아요.', en: 'Helpful people and connections favor you — good for asks and meetings.', ja: '貴人·縁の助けがある日 — 頼みや出会いに良い。' },
  chung: { ko: '변동·부딪힘이 있는 날 — 큰 결정은 미루고 한 박자 천천히.', en: 'A day of shifts and clashes — defer big calls, go a beat slower.', ja: '変動·衝突のある日 — 大きな決定は控えめに。' },
  plain: { ko: '잔잔하고 무난한 흐름 — 평소 페이스대로면 충분해요.', en: 'A calm, steady flow — your usual pace is enough.', ja: '穏やかで無難な流れ — いつものペースで十分。' },
};

export type ZodiacItem = { key: string; label: string; text: string };
/** 오늘 띠별 운세 12종(일진 지지 관계). */
export function chineseZodiacToday(): { date: string; dayBranch: string; items: ZodiacItem[] } {
  const f = getDailyFortune();
  const dayBranch = f.dayGanZhi[1];
  const L = lang();
  const items = ANIMAL_ORDER.map((b) => ({ key: b, label: ANIMAL[b][L], text: REL_TEXT[branchRel(b, dayBranch)][L] }));
  return { date: f.date, dayBranch, items };
}

// ── 별자리(양력 12궁) ──
export const SIGNS: { key: string; ko: string; en: string; ja: string; from: [number, number]; to: [number, number] }[] = [
  { key: 'aries', ko: '양자리', en: 'Aries', ja: '牡羊座', from: [3, 21], to: [4, 19] },
  { key: 'taurus', ko: '황소자리', en: 'Taurus', ja: '牡牛座', from: [4, 20], to: [5, 20] },
  { key: 'gemini', ko: '쌍둥이자리', en: 'Gemini', ja: '双子座', from: [5, 21], to: [6, 21] },
  { key: 'cancer', ko: '게자리', en: 'Cancer', ja: '蟹座', from: [6, 22], to: [7, 22] },
  { key: 'leo', ko: '사자자리', en: 'Leo', ja: '獅子座', from: [7, 23], to: [8, 22] },
  { key: 'virgo', ko: '처녀자리', en: 'Virgo', ja: '乙女座', from: [8, 23], to: [9, 22] },
  { key: 'libra', ko: '천칭자리', en: 'Libra', ja: '天秤座', from: [9, 23], to: [10, 22] },
  { key: 'scorpio', ko: '전갈자리', en: 'Scorpio', ja: '蠍座', from: [10, 23], to: [11, 22] },
  { key: 'sagittarius', ko: '사수자리', en: 'Sagittarius', ja: '射手座', from: [11, 23], to: [12, 21] },
  { key: 'capricorn', ko: '염소자리', en: 'Capricorn', ja: '山羊座', from: [12, 22], to: [1, 19] },
  { key: 'aquarius', ko: '물병자리', en: 'Aquarius', ja: '水瓶座', from: [1, 20], to: [2, 18] },
  { key: 'pisces', ko: '물고기자리', en: 'Pisces', ja: '魚座', from: [2, 19], to: [3, 20] },
];
/** 양력 월·일 → 별자리 key (없으면 null). */
export function signOf(month: number, day: number): string | null {
  for (const s of SIGNS) {
    const [fm, fd] = s.from, [tm, td] = s.to;
    if (fm === tm) { if (month === fm && day >= fd && day <= td) return s.key; }
    else if ((month === fm && day >= fd) || (month === tm && day <= td)) return s.key;
  }
  return null;
}
const SIGN_MSGS: Record<L, string[]> = {
  ko: ['좋은 소식이 들려올 수 있는 날이에요.', '주변과 호흡이 잘 맞아 협업이 수월해요.', '작은 행운이 따르니 가볍게 도전해 보세요.', '잠시 숨 고르며 나를 돌보기 좋은 날.', '집중력이 살아나 일이 잘 풀려요.', '뜻밖의 만남이나 기회가 있을 수 있어요.'],
  en: ['Good news may reach you today.', 'You sync well with others — teamwork flows.', 'Small luck follows; try something lightly.', 'A good day to pause and care for yourself.', 'Your focus sharpens and work goes smoothly.', 'An unexpected meeting or chance may come.'],
  ja: ['良い知らせが届くかもしれない日。', '周囲と息が合い、協力がスムーズ。', '小さな幸運が続く — 軽く挑戦を。', '一息ついて自分を労わるのに良い日。', '集中力が冴え、物事が運びます。', '思いがけない出会いや機会があるかも。'],
};
const seedOf = (date: string) => Number(date.replace(/-/g, '')) || 0; // YYYYMMDD
/** 오늘 별자리별 메시지 12종(날짜 시드 — 같은 날 고정). */
export function westernZodiacToday(): { date: string; items: ZodiacItem[] } {
  const f = getDailyFortune();
  const L = lang();
  const msgs = SIGN_MSGS[L];
  const base = seedOf(f.date);
  const items = SIGNS.map((s, i) => ({ key: s.key, label: (s as any)[L] ?? s.ko, text: msgs[(base + i) % msgs.length] }));
  return { date: f.date, items };
}
