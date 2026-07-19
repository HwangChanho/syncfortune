// app/src/lib/content/sokgunghapReadings.ts — 속궁합 통변 콘텐츠(성인 17+·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// analyzeSokgunghap 결과 → 사람이 읽는 성적 궁합 통변(ko/en/ja). ★daniel 검수 슬롯(수위·명리 stance).
//   원칙: 성적 주제를 직접·솔직하게 다루되 노골/외설 배제(App Store 17+ 한도). '재미로만'.
//   §4: 부정 증폭 금지 — 낮은 케미도 전향적(맞춰가는 재미). 진단엔 처방 동반(가드5).
// ─────────────────────────────────────────────────────────────────────────
import type { SokResult, SpousePalaceRel } from './sokgunghap';

type L = { ko: string; en: string; ja: string };
const pick = (m: L, lang: 'ko' | 'en' | 'ja') => m[lang] ?? m.ko;

// ── 등급별 몸궁합 서사(17+ 감각적·솔직 / 노골적 행위·자세 묘사는 배제=App Store 한도) ──
const TIER_BODY: Record<string, L> = {
  blaze: {
    ko: '손끝만 스쳐도 불이 붙는 조합이에요. 눈빛 하나에 숨이 달라지고, 살결이 닿는 순간 서로의 리듬을 본능적으로 읽어냅니다. 밤이 짧게 느껴지는 케미 — 격정이 강한 만큼 낮의 다정함도 챙기면 오래 뜨거워요.',
    en: 'One brush of the fingertips and it ignites. A single look changes your breath, and the moment skin meets you read each other on instinct. Nights feel short—keep daytime tenderness too and the heat lasts.',
    ja: '指先が触れるだけで火がつく組み合わせ。視線一つで息が変わり、肌が触れた瞬間、互いのリズムを本能で読み取ります。夜が短く感じる相性。',
  },
  hot: {
    ko: '서로를 확실히 원하는 관계예요. 처음의 긴장이 오래 가고, 익숙해져도 몸이 먼저 반응합니다. 한 사람이 더 달아오를 때가 있으니 그 온도를 맞춰주면 훨씬 진해져요.',
    en: 'You clearly want each other. The early tension lingers, and even familiar, your body responds first. One of you runs hotter—match that heat and it deepens.',
    ja: '互いを確かに求める関係。最初の緊張が長く続き、慣れても体が先に反応します。片方が熱くなる時、その温度を合わせるとぐっと濃くなります。',
  },
  warm: {
    ko: '편안하면서도 은근히 뜨거운 궁합이에요. 화려한 불꽃보다 깊고 오래가는 감각 — 서로가 뭘 좋아하는지 솔직히 속삭이면 밤의 만족도가 확 올라갑니다.',
    en: 'Comfortable, yet quietly hot. Less fireworks, more deep and lasting sensation—whisper honestly about what you each like and satisfaction climbs fast.',
    ja: '心地よくも密かに熱い相性。派手な炎より深く続く感覚。互いの好みを素直に囁けば、夜の満足度がぐっと上がります。',
  },
  tease: {
    ko: '밀고 당기는 긴장이 짜릿한 조합이에요. 늘 맞진 않아도 그 간극이 오히려 애를 태웁니다. 분위기와 타이밍으로 상대를 달구는 게 이 궁합의 재미예요.',
    en: 'A push-and-pull that’s electric. You won’t always align, but the gap makes you ache for more. Teasing with mood and timing is the fun of this match.',
    ja: '押して引く緊張がゾクゾクする組み合わせ。いつも噛み合わなくても、その隙間がかえって焦らす。雰囲気とタイミングで焦らすのが楽しさ。',
  },
  slow: {
    ko: '천천히 달아오르는 사이예요. 처음엔 온도차가 있어도, 익숙해질수록 몸이 열립니다. 서두르지 않고 감각을 쌓아갈수록 깊어지는 슬로우 케미.',
    en: 'A slow burn. There’s a gap at first, but you open up as you grow familiar. The more you build sensation without rushing, the deeper it gets.',
    ja: 'じっくり燃える仲。最初は温度差があっても、慣れるほど体が開きます。焦らず感覚を重ねるほど深まるスロー相性。',
  },
  spark: {
    ko: '극과 극이 부딪히는 격정형이에요. 강렬하게 당겼다가 온도가 확 엇갈리기도 — 그 낙차가 오히려 잊기 힘든 밤을 만듭니다. 다름을 탐색으로 즐기면 특별해져요.',
    en: 'Opposites colliding—pure intensity. You pull hard, then temperatures swing apart—and that gap makes nights hard to forget. Enjoy the difference as exploration.',
    ja: '正反対がぶつかる情熱型。強烈に引き合い、温度が急にすれ違うことも。その落差が忘れがたい夜を作ります。',
  },
};

// ── 관계 스타일(리드×템포×강도) — '디테일'을 성향·케미로(노골적 행위·자세 아님·★daniel 검수) ──
const LEAD: Record<string, L> = {
  주도: { ko: '한 명이 확실히 리드하고, 상대가 기꺼이 이끌리는 조합', en: 'one clearly leads and the other happily follows', ja: '一方が確かにリードし、相手が喜んで導かれる' },
  대등: { ko: '서로 대등하게 주고받으며 밀당하는 조합', en: 'you give and take as equals', ja: '対等に与え合い駆け引きする' },
  헌신: { ko: '한 명이 정성껏 맞춰주고 상대가 그 배려에 녹는 조합', en: 'one devotedly attunes and the other melts into it', ja: '一方が丁寧に合わせ、相手がその配慮に溶ける' },
};
const TEMPO: Record<string, L> = {
  fast: { ko: '처음부터 빠르게 뜨거워지는 템포', en: 'a fast, heats-up-early tempo', ja: '最初から速く熱くなるテンポ' },
  slow: { ko: '천천히 감각을 쌓아 올리는 슬로우 템포', en: 'a slow tempo that builds sensation', ja: 'じっくり感覚を積むスローテンポ' },
  wave: { ko: '달아올랐다 식었다 파도치는 템포', en: 'a rise-and-fall, wave-like tempo', ja: '高まっては引く波のようなテンポ' },
};
const INTENSITY: Record<string, L> = {
  deep: { ko: '깊고 진하게 몰입하는 강도', en: 'deep, absorbed intensity', ja: '深く濃く没入する強度' },
  fierce: { ko: '강렬하게 몰아치는 격정', en: 'a fierce, driving passion', ja: '激しく畳みかける情熱' },
  sensual: { ko: '감각적으로 탐닉하는 무드', en: 'a sensual, indulgent mood', ja: '感覚的に耽る雰囲気' },
  gentle: { ko: '부드럽게 서로를 맞춰가는 결', en: 'a gentle, attuning touch', ja: '柔らかく合わせていく質感' },
};

// ── 배우자궁(일지) 관계별 침실 케미 ──
const SPOUSE_NOTE: Record<SpousePalaceRel, L> = {
  육합: { ko: '배우자궁(일지)이 육합 — 몸과 마음이 자연스럽게 맞물리는 깊은 궁합이에요.', en: 'Your spouse palaces (day branch) harmonize—a deep, natural fit of body and mind.', ja: '配偶者宮(日支)が六合 — 体と心が自然に噛み合う深い相性。' },
  충:   { ko: '배우자궁이 충 — 강렬하게 끌리지만 쉽게 소진돼요. 격정 뒤 회복 시간을 서로 존중해 주세요.', en: 'Spouse palaces clash—intense pull, but easily drained. Respect each other’s recovery after the heat.', ja: '配偶者宮が冲 — 強烈に惹かれるが消耗しやすい。情熱の後の回復時間を尊重して。' },
  형:   { ko: '배우자궁이 형 — 미묘한 마찰이 있어요. 원하는 걸 말로 분명히 하면 마찰이 케미로 바뀝니다.', en: 'Spouse palaces in 형 (friction)—say what you want clearly and friction becomes chemistry.', ja: '配偶者宮が刑 — 微妙な摩擦あり。望みを言葉で明確にすれば摩擦が相性に変わる。' },
  해:   { ko: '배우자궁이 해 — 가끔 엇박이 나요. 서두르지 말고 신호를 읽어주면 잘 맞아갑니다.', en: 'Spouse palaces in 해 (off-beat)—don’t rush; reading each other’s signals brings you in sync.', ja: '配偶者宮が害 — たまにすれ違う。焦らず信号を読めば噛み合う。' },
  무:   { ko: '배우자궁은 직접 작용은 없어요. 매력·오행 궁합이 케미를 이끕니다.', en: 'No direct spouse-palace tie—charm and element harmony lead the chemistry.', ja: '配偶者宮の直接作用はなし — 魅力と五行の相性が導く。' },
};

// ── 처방(가드5·진단엔 처방 동반) — 매력 온도차별 ──
const ADVICE: { cond: (r: SokResult) => boolean; text: L }[] = [
  {
    cond: (r) => r.myCharm.total > 0 && r.partnerCharm.total === 0,
    text: { ko: '내 끌림이 더 앞서요. 상대의 속도를 기다려 주면 상대도 마음을 엽니다.', en: 'You run ahead—wait for their pace and they open up too.', ja: '自分の惹かれが先行 — 相手の速度を待てば相手も心を開く。' },
  },
  {
    cond: (r) => r.partnerCharm.total > 0 && r.myCharm.total === 0,
    text: { ko: '상대가 더 적극적이에요. 솔직하게 반응해 주면 관계가 훨씬 편해져요.', en: 'They’re more forward—responding honestly makes it much easier.', ja: '相手が積極的 — 素直に反応すれば関係がずっと楽に。' },
  },
  {
    cond: (r) => r.tension > r.harmony,
    text: { ko: '긴장이 조화보다 커요. 분위기·타이밍을 맞추는 대화가 케미를 살립니다.', en: 'Tension outweighs harmony—talking about mood and timing revives the chemistry.', ja: '緊張が調和より大きい — 雰囲気・タイミングの会話が相性を生かす。' },
  },
  {
    cond: () => true, // 기본 처방
    text: { ko: '무엇을 좋아하는지 솔직히 나누는 것 — 그게 어떤 궁합이든 최고의 개운법이에요.', en: 'Sharing what you each enjoy—honestly—is the best boost for any match.', ja: '互いの好みを素直に話すこと — どんな相性でも最高の開運法。' },
  },
];

/** 관계 스타일(리드×템포×강도) — 결정론 신호에서 조합. ★daniel 검수. */
function styleLine(r: SokResult, lang: 'ko' | 'en' | 'ja'): string {
  const lead = r.dmType === '상극' ? '주도' : r.dmType === '상생' ? '헌신' : '대등';
  const charmSum = r.myCharm.total + r.partnerCharm.total;
  const tempo = r.spouse === '충' ? 'wave' : charmSum >= 3 ? 'fast' : 'slow';
  const hy = r.myCharm.hongyeom + r.partnerCharm.hongyeom;
  const intensity = r.spouse === '육합' ? 'deep' : r.spouse === '충' ? 'fierce' : hy >= 2 ? 'sensual' : 'gentle';
  return `${pick(LEAD[lead], lang)} · ${pick(TEMPO[tempo], lang)} · ${pick(INTENSITY[intensity], lang)}`;
}

export type SokReading = { headline: string; body: string; style: string; spouseNote: string; advice: string };

/** 결정론 결과 → 통변(ko/en/ja). 화면이 그대로 렌더. ★daniel 검수 슬롯. */
export function sokgunghapReading(r: SokResult, lang: 'ko' | 'en' | 'ja'): SokReading {
  const body = pick(TIER_BODY[r.tier.key] ?? TIER_BODY.warm, lang);
  const style = styleLine(r, lang);
  const spouseNote = pick(SPOUSE_NOTE[r.spouse], lang);
  const advice = pick((ADVICE.find((a) => a.cond(r)) ?? ADVICE[ADVICE.length - 1]).text, lang);
  const headline = `${r.tier.emoji} ${(r.tier as any)[lang] ?? r.tier.ko} · ${r.score}`;
  return { headline, body, style, spouseNote, advice };
}
