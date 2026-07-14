// app/src/lib/content/sokgunghapReadings.ts — 속궁합 통변 콘텐츠(성인 17+·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// analyzeSokgunghap 결과 → 사람이 읽는 성적 궁합 통변(ko/en/ja). ★daniel 검수 슬롯(수위·명리 stance).
//   원칙: 성적 주제를 직접·솔직하게 다루되 노골/외설 배제(App Store 17+ 한도). '재미로만'.
//   §4: 부정 증폭 금지 — 낮은 케미도 전향적(맞춰가는 재미). 진단엔 처방 동반(가드5).
// ─────────────────────────────────────────────────────────────────────────
import type { SokResult, SpousePalaceRel } from './sokgunghap';

type L = { ko: string; en: string; ja: string };
const pick = (m: L, lang: 'ko' | 'en' | 'ja') => m[lang] ?? m.ko;

// ── 등급별 몸궁합 서사(전향적·17+) ──
const TIER_BODY: Record<string, L> = {
  blaze: {
    ko: '몸의 대화가 유난히 잘 통하는 조합이에요. 말보다 눈빛·온도로 먼저 통하고, 서로의 리듬을 금세 읽어냅니다. 끌림이 강한 만큼 감정도 빨리 달아오르니, 뜨거움이 관계 전체를 삼키지 않게 낮의 대화도 함께 챙겨 주세요.',
    en: 'Your bodies speak the same language. You read each other by look and warmth before words, and fall into rhythm fast. The pull is strong—just keep daytime conversation alive so the heat doesn’t run the whole relationship.',
    ja: '体の対話が特によく通じる組み合わせ。言葉より視線と温度で先に通じ、互いのリズムをすぐ読み取ります。惹かれが強いぶん感情も早く高まるので、昼の会話も大切に。',
  },
  hot: {
    ko: '서로에게 확실히 끌리는 관계예요. 처음의 긴장감이 오래 가고, 익숙해져도 설렘이 잘 식지 않습니다. 한 사람이 더 뜨거울 때가 있으니, 속도를 맞춰 주면 더 깊어져요.',
    en: 'A clear, lasting attraction. The early spark stays, and familiarity doesn’t dull it much. One of you may run hotter—matching pace makes it deeper.',
    ja: 'はっきり惹かれ合う関係。最初の緊張感が長く続き、慣れてもときめきが冷めにくい。片方が熱いときは、速度を合わせるとより深まります。',
  },
  warm: {
    ko: '편안하면서도 잘 맞는 몸궁합이에요. 화려한 불꽃보다 오래가는 온기 쪽 — 서로 무엇을 좋아하는지 솔직히 나누면 만족도가 쭉 올라갑니다.',
    en: 'Comfortable and well-matched. Less fireworks, more lasting warmth—being honest about what each of you enjoys pushes satisfaction way up.',
    ja: '心地よくよく合う相性。派手な炎より続く温もり。互いの好みを素直に話せば満足度がぐっと上がります。',
  },
  tease: {
    ko: '밀고 당기는 재미가 있는 조합이에요. 늘 맞지는 않아도 그 간극이 오히려 긴장감을 만듭니다. 타이밍과 분위기를 서로 맞춰가는 게 열쇠예요.',
    en: 'A push-and-pull dynamic. You won’t always align, but the gap itself creates tension. Syncing timing and mood is the key.',
    ja: '押して引く楽しさのある組み合わせ。いつも噛み合わなくても、その隙間が緊張感を生む。タイミングと雰囲気を合わせるのが鍵。',
  },
  slow: {
    ko: '천천히 데워지는 사이예요. 처음엔 온도차가 있어도, 시간을 두고 서로에게 익숙해질수록 잘 맞아갑니다. 조급함보다 신뢰가 스위치예요.',
    en: 'A slow burn. There may be a temperature gap at first, but you sync as you grow familiar. Trust—not rushing—is the switch.',
    ja: 'じっくり温まる仲。最初は温度差があっても、時間をかけて慣れるほど噛み合う。焦りより信頼がスイッチ。',
  },
  spark: {
    ko: '극과 극이 부딪히는 격정형이에요. 강렬하게 끌리다가도 온도가 확 엇갈릴 수 있어요. 다름을 탐색으로 받아들이면 오히려 특별한 케미가 됩니다.',
    en: 'Opposites colliding—intense. You attract hard, then temperatures can swing apart. Treating difference as exploration turns it into a rare chemistry.',
    ja: '正反対がぶつかる情熱型。強烈に惹かれても温度が急にすれ違うことも。違いを探索として受け入れると特別な相性に。',
  },
};

// ── 배우자궁(일지) 관계별 침실 케미 ──
const SPOUSE_NOTE: Record<SpousePalaceRel, L> = {
  육합: { ko: '배우자궁(일지)이 육합 — 몸과 마음이 자연스럽게 맞물리는 깊은 궁합이에요.', en: 'Your spouse palaces (day branch) harmonize—a deep, natural fit of body and mind.', ja: '配偶者宮(日支)が六合 — 体と心が自然に噛み合う深い相性。' },
  충:   { ko: '배우자궁이 충 — 강렬하게 끌리지만 쉽게 소진돼요. 격정 뒤 회복 시간을 서로 존중해 주세요.', en: 'Spouse palaces clash—intense pull, but easily drained. Respect each other’s recovery after the heat.', ja: '配偶者宮が冲 — 強烈に惹かれるが消耗しやすい。情熱の後の回復時間を尊重して。' },
  형:   { ko: '배우자궁이 형 — 미묘한 마찰이 있어요. 원하는 걸 말로 분명히 하면 마찰이 케미로 바뀝니다.', en: 'Spouse palaces in 형 (friction)—say what you want clearly and friction becomes chemistry.', ja: '配偶者宮が刑 — 微妙な摩擦あり。望みを言葉で明確にすれば摩擦が相性に変わる。' },
  해:   { ko: '배우자궁이 해 — 가끔 엇박이 나요. 서두르지 말고 신호를 읽어주면 잘 맞아갑니다.', en: 'Spouse palaces in 해 (off-beat)—don’t rush; reading each other’s signals brings you in sync.', ja: '配偶者宮が害 — たまにすれ違う。焦らず信号を読めば噛み合う。' },
  무:   { ko: '배우자궁은 직접 작용은 없어요 — 매력·오행 궁합이 케미를 이끕니다.', en: 'No direct spouse-palace tie—charm and element harmony lead the chemistry.', ja: '配偶者宮の直接作用はなし — 魅力と五行の相性が導く。' },
};

// ── 처방(가드5·진단엔 처방 동반) — 매력 온도차별 ──
const ADVICE: { cond: (r: SokResult) => boolean; text: L }[] = [
  {
    cond: (r) => r.myCharm.total > 0 && r.partnerCharm.total === 0,
    text: { ko: '내 끌림이 더 앞서요 — 상대의 속도를 기다려 주면 상대도 마음을 엽니다.', en: 'You run ahead—wait for their pace and they open up too.', ja: '自分の惹かれが先行 — 相手の速度を待てば相手も心を開く。' },
  },
  {
    cond: (r) => r.partnerCharm.total > 0 && r.myCharm.total === 0,
    text: { ko: '상대가 더 적극적이에요 — 솔직하게 반응해 주면 관계가 훨씬 편해져요.', en: 'They’re more forward—responding honestly makes it much easier.', ja: '相手が積極的 — 素直に反応すれば関係がずっと楽に。' },
  },
  {
    cond: (r) => r.tension > r.harmony,
    text: { ko: '긴장이 조화보다 커요 — 분위기·타이밍을 맞추는 대화가 케미를 살립니다.', en: 'Tension outweighs harmony—talking about mood and timing revives the chemistry.', ja: '緊張が調和より大きい — 雰囲気・タイミングの会話が相性を生かす。' },
  },
  {
    cond: () => true, // 기본 처방
    text: { ko: '무엇을 좋아하는지 솔직히 나누는 것 — 그게 어떤 궁합이든 최고의 개운법이에요.', en: 'Sharing what you each enjoy—honestly—is the best boost for any match.', ja: '互いの好みを素直に話すこと — どんな相性でも最高の開運法。' },
  },
];

export type SokReading = { headline: string; body: string; spouseNote: string; advice: string };

/** 결정론 결과 → 통변(ko/en/ja). 화면이 그대로 렌더. ★daniel 검수 슬롯. */
export function sokgunghapReading(r: SokResult, lang: 'ko' | 'en' | 'ja'): SokReading {
  const body = pick(TIER_BODY[r.tier.key] ?? TIER_BODY.warm, lang);
  const spouseNote = pick(SPOUSE_NOTE[r.spouse], lang);
  const advice = pick((ADVICE.find((a) => a.cond(r)) ?? ADVICE[ADVICE.length - 1]).text, lang);
  const headline = `${r.tier.emoji} ${(r.tier as any)[lang] ?? r.tier.ko} · ${r.score}`;
  return { headline, body, spouseNote, advice };
}
