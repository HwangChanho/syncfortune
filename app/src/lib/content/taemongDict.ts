// app/src/lib/content/taemongDict.ts — 태몽 상징 사전 (무료·온디바이스·API 0)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-12: *"태몽은 사주랑 교차해서 풀지말고 단독으로 따로 하자"*
//
// ■ 왜 사주와 분리하나 (daniel stance — 지킬 것)
//   태몽은 **사주명리가 아니라 민속 해몽**이다. 명식을 섞으면 두 체계를 임의로 접붙이는 셈이고,
//   그건 이 프로젝트가 금지한 '명리 발명'이 된다(CLAUDE.md §3.3).
//   ⇒ 태몽 화면은 **명식을 요구하지 않는다**(chartless). 생년월일 없이도 볼 수 있다.
//     퍼널로도 이득이다 — 가입·명식등록 전에 진입할 수 있는 몇 안 되는 콘텐츠다.
//
// ■ 안전 가드 (§4 — 반드시 지킬 것)
//   ★**성별을 단정하지 않는다.** 전통에 '아들 꿈/딸 꿈' 통설이 있지만, 태몽으로 성별을 맞힌다고
//     말하는 순간 ①의학적 사실과 충돌하고 ②틀렸을 때 신뢰가 통째로 무너진다.
//     ⇒ *"예로부터 …로 보았어요"* 라는 **전승 소개**까지만 하고, 판정은 하지 않는다.
//   ★임신·출산·건강을 **예측하지 않는다**(의료 영역). 태몽은 '기다림의 마음을 담는 이야기'로 다룬다.
//   ★흉몽으로 읽힐 소재도 **전향적으로**(§4) — 태몽은 아이에 대한 첫 이야기다. 불안을 심지 않는다.
//
// ■ 구조는 dreamDict 와 같게 맞췄다(같은 화면 관용구·같은 검색 방식).
//   keywords = ko+en+ja 혼합(어느 언어로 검색해도 매칭) · title/meaning = 언어별.
// ═══════════════════════════════════════════════════════════════════════════
import { appLang } from '../i18n';

type Tri = { ko: string; en: string; ja: string };
export type TaemongEntry = {
  keywords: string[];
  title: Tri;
  /** 이 상징이 전통적으로 무엇을 뜻하는가. */
  meaning: Tri;
  /** 그 아이의 결(기질)을 어떻게 보아 왔는가 — 예언이 아니라 **전승 소개**. */
  trait: Tri;
};

const L = (): 'ko' | 'en' | 'ja' => (appLang() as any) ?? 'ko';

export const TAEMONG_DICT: TaemongEntry[] = [
  {
    keywords: ['용', 'dragon', '龍', 'りゅう', 'ドラゴン'],
    title: { ko: '용', en: 'Dragon', ja: '龍' },
    meaning: {
      ko: '태몽 중에서도 가장 귀하게 여겨 온 상징이에요. 큰 그릇과 남다른 앞길을 뜻한다고 보았어요.',
      en: 'Long held as the most auspicious of conception dreams — a symbol of great capacity and an uncommon path ahead.',
      ja: '胎夢の中でも最も貴いとされてきた象徴です。大きな器と並外れた行く末を意味すると見ました。',
    },
    trait: {
      ko: '뜻이 크고 사람을 이끄는 힘이 있다고 보았어요. 무엇을 하든 자기 길을 내는 아이라고요.',
      en: 'Said to carry big intentions and a pull that others follow — a child who carves their own way.',
      ja: '志が大きく人を導く力があると見ました。何をしても自分の道を切り開く子だと。',
    },
  },
  {
    keywords: ['호랑이', '범', 'tiger', '虎', 'とら'],
    title: { ko: '호랑이', en: 'Tiger', ja: '虎' },
    meaning: {
      ko: '기개와 위엄의 상징이에요. 두려움 없이 제 몫을 해내는 아이를 뜻한다고 보았어요.',
      en: 'A symbol of spirit and dignity — read as a child who does their part without fear.',
      ja: '気概と威厳の象徴。恐れずに自分の役割を果たす子を意味すると見ました。',
    },
    trait: {
      ko: '한번 마음먹으면 물러서지 않는 결이라고 해요. 곧고 씩씩한 기운이에요.',
      en: 'A nature that does not back down once set — upright and brave.',
      ja: '一度決めたら退かない質だと言います。まっすぐで凛とした気です。',
    },
  },
  {
    keywords: ['뱀', '구렁이', 'snake', 'serpent', '蛇', 'へび'],
    title: { ko: '뱀·구렁이', en: 'Snake', ja: '蛇' },
    meaning: {
      ko: '지혜와 재물을 함께 지닌 상징이에요. 품에 들어오거나 따라오면 특히 귀하게 보았어요.',
      en: 'A symbol holding both wisdom and wealth — especially prized when it comes into your arms or follows you.',
      ja: '知恵と財を併せ持つ象徴。懐に入る·付いてくると特に貴いと見ました。',
    },
    trait: {
      ko: '속이 깊고 판단이 빠르다고 보았어요. 서두르지 않고 때를 아는 결이에요.',
      en: 'Said to be deep-minded and quick to judge — knowing the right moment without rushing.',
      ja: '内が深く判断が早いと見ました。急がず時を知る質です。',
    },
  },
  {
    keywords: ['잉어', '물고기', '붕어', 'fish', 'carp', '鯉', '魚', 'さかな'],
    title: { ko: '잉어·물고기', en: 'Carp / Fish', ja: '鯉·魚' },
    meaning: {
      ko: '결실과 풍요의 상징이에요. 큰 물고기를 안거나 잡으면 더 귀하게 여겼어요.',
      en: 'A symbol of fruition and abundance — holding or catching a large one was prized all the more.',
      ja: '結実と豊かさの象徴。大きな魚を抱く·捕ると、より貴いとされました。',
    },
    trait: {
      ko: '막힌 데서도 길을 찾아 나아가는 결이라고 해요. 꾸준함이 힘이 되는 아이예요.',
      en: 'A nature that finds a way even where things are blocked — steadiness becomes their strength.',
      ja: '塞がった所でも道を見つけて進む質。粘り強さが力になる子です。',
    },
  },
  {
    keywords: ['복숭아', '과일', '사과', '감', 'peach', 'fruit', 'apple', '桃', '果物'],
    title: { ko: '복숭아·과일', en: 'Peach / Fruit', ja: '桃·果物' },
    meaning: {
      ko: '잘 익은 열매는 오래 기다린 결실을 뜻해요. 받아서 품에 안는 꿈을 특히 좋게 보았어요.',
      en: 'Ripe fruit means a long-awaited fruition — receiving and holding it was seen as especially good.',
      ja: '熟した実は長く待った結実を意味します。受け取って抱く夢を特に良いと見ました。',
    },
    trait: {
      ko: '보드랍고 사랑받는 결이라고 해요. 곁을 환하게 만드는 아이예요.',
      en: 'A soft, well-loved nature — a child who brightens the space around them.',
      ja: '柔らかく愛される質。周りを明るくする子です。',
    },
  },
  {
    keywords: ['꽃', '연꽃', '장미', '난초', 'flower', 'lotus', '花', 'はな'],
    title: { ko: '꽃', en: 'Flower', ja: '花' },
    meaning: {
      ko: '아름다움과 귀함의 상징이에요. 활짝 핀 꽃일수록 좋게 보았어요.',
      en: 'A symbol of beauty and preciousness — the fuller the bloom, the better it was read.',
      ja: '美しさと貴さの象徴。満開であるほど良いと見ました。',
    },
    trait: {
      ko: '감이 섬세하고 표현이 고운 결이라고 해요.',
      en: 'A finely tuned, gracefully expressive nature.',
      ja: '感性が細やかで表現の美しい質だと言います。',
    },
  },
  {
    keywords: ['해', '달', '별', '햇빛', 'sun', 'moon', 'star', '太陽', '月', '星'],
    title: { ko: '해·달·별', en: 'Sun / Moon / Star', ja: '太陽·月·星' },
    meaning: {
      ko: '밝게 드러나는 앞길을 뜻해요. 품에 안기거나 삼키는 꿈을 크게 보았어요.',
      en: 'Means a path that shines out clearly — embracing or swallowing them was read as great.',
      ja: '明るく開ける行く末を意味します。抱く·飲み込む夢を大きく見ました。',
    },
    trait: {
      ko: '눈에 띄고 남에게 길이 되어 주는 결이라고 해요.',
      en: 'A nature that stands out and becomes a path for others.',
      ja: '目立ち、人の道しるべになる質だと言います。',
    },
  },
  {
    keywords: ['구슬', '보석', '반지', '금', '진주', 'jewel', 'pearl', 'gold', 'ring', '宝石', '真珠'],
    title: { ko: '구슬·보석', en: 'Jewel / Pearl', ja: '玉·宝石' },
    meaning: {
      ko: '귀하게 얻은 보배를 뜻해요. 맑고 흠 없는 구슬일수록 좋게 보았어요.',
      en: 'Means a treasure preciously gained — the clearer and more flawless, the better.',
      ja: '貴く得た宝を意味します。澄んで傷のない玉ほど良いと見ました。',
    },
    trait: {
      ko: '맑고 단단한 결이라고 해요. 스스로 빛을 내는 아이예요.',
      en: 'A clear, solid nature — a child who shines on their own.',
      ja: '澄んで硬い質。自ら光を放つ子です。',
    },
  },
  {
    keywords: ['소', '말', '돼지', 'cow', 'ox', 'horse', 'pig', '牛', '馬', '豚'],
    title: { ko: '소·말·돼지', en: 'Ox / Horse / Pig', ja: '牛·馬·豚' },
    meaning: {
      ko: '든든함과 복을 뜻하는 상징이에요. 돼지는 재물, 소는 성실, 말은 활달함으로 보았어요.',
      en: 'Symbols of steadiness and blessing — pig for wealth, ox for diligence, horse for liveliness.',
      ja: '頼もしさと福の象徴。豚は財、牛は誠実、馬は活発さと見ました。',
    },
    trait: {
      ko: '몸과 마음이 튼튼하고 제 몫을 다하는 결이라고 해요.',
      en: 'A sturdy nature in body and mind that carries its own weight.',
      ja: '心身が丈夫で自分の役割を果たす質だと言います。',
    },
  },
  {
    keywords: ['물', '바다', '강', '샘', '폭포', 'water', 'sea', 'river', '水', '海', '川'],
    title: { ko: '물·바다·강', en: 'Water / Sea / River', ja: '水·海·川' },
    meaning: {
      ko: '맑은 물은 넉넉함과 흐름을 뜻해요. 물이 맑고 넓을수록 좋게 보았어요.',
      en: 'Clear water means abundance and flow — the clearer and wider, the better.',
      ja: '澄んだ水は豊かさと流れを意味します。清く広いほど良いと見ました。',
    },
    trait: {
      ko: '두루 어울리고 막힘이 적은 결이라고 해요.',
      en: 'A nature that mixes easily and meets few blockages.',
      ja: '広く馴染み、詰まりの少ない質だと言います。',
    },
  },
  {
    keywords: ['산', '나무', '숲', '바위', 'mountain', 'tree', 'forest', 'rock', '山', '木'],
    title: { ko: '산·나무', en: 'Mountain / Tree', ja: '山·木' },
    meaning: {
      ko: '뿌리내림과 오래감을 뜻해요. 크고 곧은 나무일수록 좋게 보았어요.',
      en: 'Means taking root and lasting long — the taller and straighter the tree, the better.',
      ja: '根を張り長く続くことを意味します。大きくまっすぐな木ほど良いと見ました。',
    },
    trait: {
      ko: '느려도 깊게 자라는 결이라고 해요. 오래 가는 힘이 있어요.',
      en: 'A nature that grows deep even if slow — with staying power.',
      ja: 'ゆっくりでも深く育つ質。長く続く力があります。',
    },
  },
  {
    keywords: ['새', '학', '봉황', '제비', 'bird', 'crane', 'phoenix', '鳥', '鶴', '鳳凰'],
    title: { ko: '새·학·봉황', en: 'Bird / Crane / Phoenix', ja: '鳥·鶴·鳳凰' },
    meaning: {
      ko: '멀리 나아감과 귀한 소식을 뜻해요. 흰 새·학은 특히 맑게 보았어요.',
      en: 'Means going far and precious news — white birds and cranes were read as especially pure.',
      ja: '遠くへ進むことと貴い知らせを意味します。白い鳥·鶴は特に清いと見ました。',
    },
    trait: {
      ko: '자유롭고 시야가 넓은 결이라고 해요.',
      en: 'A free nature with a wide view.',
      ja: '自由で視野の広い質だと言います。',
    },
  },
];

/** 인기 상징 — 화면 상단 칩(무엇을 검색해야 할지 모를 때의 출발점). */
export const TAEMONG_POPULAR = ['용', '호랑이', '뱀', '잉어', '복숭아', '구슬', '해', '꽃'];

/** 언어별 표시값 — dreamDict 와 같은 접근자 이름(화면이 두 사전을 같은 방식으로 다룬다). */
export const taemongTitle = (e: TaemongEntry) => e.title[L()];
export const taemongMeaning = (e: TaemongEntry) => e.meaning[L()];
export const taemongTrait = (e: TaemongEntry) => e.trait[L()];

/**
 * 상징 검색 — 공백·대소문자 무시, 부분일치.
 * @param q 사용자가 입력한 말(어느 언어든)
 * @returns 맞는 항목들(없으면 빈 배열 — 화면이 'AI 풀이' 로 안내한다)
 */
export function searchTaemong(q: string): TaemongEntry[] {
  const s = q.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return [];
  return TAEMONG_DICT.filter((e) => e.keywords.some((k) => {
    const kk = k.toLowerCase().replace(/\s+/g, '');
    return kk.includes(s) || s.includes(kk);
  }));
}
