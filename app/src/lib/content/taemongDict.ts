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
  // ★소·말·돼지를 갈랐다(daniel 검수 위임 2026-08-12) — 셋의 뜻이 실제로 다른데 한 항목에 묶으니
  //   '아이의 결'이 "튼튼하다"로 뭉뚱그려졌다. '돼지'를 검색한 사람이 소·말까지 읽을 이유도 없고,
  //   다른 항목은 전부 단일이라 일관성도 깨졌다.
  {
    keywords: ['돼지', '멧돼지', 'pig', 'boar', '豚', 'いのしし'],
    title: { ko: '돼지', en: 'Pig', ja: '豚' },
    meaning: {
      ko: '재물과 복이 들어오는 대표 상징이에요. 품에 안거나 따라오면 더 좋게 보았어요.',
      en: 'The classic symbol of wealth and blessing coming in — better still if you hold one or it follows you.',
      ja: '財と福が入る代表的な象徴。抱く·付いてくるとより良いと見ました。',
    },
    trait: {
      ko: '아쉬울 것 없이 넉넉한 결이라고 해요. 사람도 재물도 곁에 모이는 아이예요.',
      en: 'A nature of easy plenty — a child around whom both people and means gather.',
      ja: '不足なく豊かな質。人も財も周りに集まる子です。',
    },
  },
  {
    keywords: ['소', '황소', 'cow', 'ox', 'bull', '牛', 'うし'],
    title: { ko: '소', en: 'Ox', ja: '牛' },
    meaning: {
      ko: '성실과 든든함의 상징이에요. 크고 살진 소일수록 좋게 보았어요.',
      en: 'A symbol of diligence and dependability — the larger and healthier, the better.',
      ja: '誠実と頼もしさの象徴。大きく肥えた牛ほど良いと見ました。',
    },
    trait: {
      ko: '한 걸음씩 끝까지 가는 결이라고 해요. 맡은 일을 놓지 않는 아이예요.',
      en: 'A nature that goes step by step to the end — a child who does not drop what they take on.',
      ja: '一歩ずつ最後まで行く質。任されたことを手放さない子です。',
    },
  },
  {
    keywords: ['말', '망아지', 'horse', 'pony', '馬', 'うま'],
    title: { ko: '말', en: 'Horse', ja: '馬' },
    meaning: {
      ko: '활달함과 나아감의 상징이에요. 힘차게 달리는 말을 특히 좋게 보았어요.',
      en: 'A symbol of liveliness and forward motion — a galloping horse was read as especially good.',
      ja: '活発さと前進の象徴。力強く駆ける馬を特に良いと見ました。',
    },
    trait: {
      ko: '가만있지 못하고 넓게 다니는 결이라고 해요. 세상을 많이 보는 아이예요.',
      en: 'A nature that cannot sit still and roams wide — a child who sees much of the world.',
      ja: 'じっとしていられず広く動く質。世の中を多く見る子です。',
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
  // ★추가(daniel 검수 위임) — 한국 태몽에 매우 흔한데 빠져 있었다.
  //   ⚠️고추·가지처럼 **성별을 암시하는 소재는 넣지 않는다**(§4) — 전통에 있어도 이 앱은 성별을 말하지 않는다.
  {
    keywords: ['밤', '대추', '알밤', '밤송이', 'chestnut', 'jujube', '栗', 'なつめ'],
    title: { ko: '밤·대추', en: 'Chestnut / Jujube', ja: '栗·なつめ' },
    meaning: {
      ko: '자손과 결실을 함께 뜻하는 상징이에요. 알이 굵고 여럿일수록 좋게 보았어요.',
      en: 'A symbol of both offspring and fruition — the plumper and more plentiful, the better.',
      ja: '子孫と結実を併せて意味する象徴。実が大きく多いほど良いと見ました。',
    },
    trait: {
      ko: '단단하고 야무진 결이라고 해요. 작아도 속이 꽉 찬 아이예요.',
      en: 'A firm, tightly-put-together nature — small perhaps, but full inside.',
      ja: '硬くしっかりした質。小さくても中身の詰まった子です。',
    },
  },
  {
    keywords: ['알', '달걀', '계란', '새알', 'egg', '卵', 'たまご'],
    title: { ko: '알', en: 'Egg', ja: '卵' },
    meaning: {
      ko: '이제 막 시작되는 생명을 뜻해요. 깨지지 않은 온전한 알을 좋게 보았어요.',
      en: 'Means a life just beginning — an unbroken, whole egg was read as good.',
      ja: '今まさに始まる命を意味します。割れていない完全な卵を良いと見ました。',
    },
    trait: {
      ko: '품은 것이 많아 앞으로 열릴 게 많은 결이라고 해요.',
      en: 'A nature holding much within, with much still to open ahead.',
      ja: '内に多くを抱え、これから開くものが多い質だと言います。',
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
export const TAEMONG_POPULAR = ['용', '호랑이', '뱀', '잉어', '복숭아', '돼지', '밤', '해'];

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
