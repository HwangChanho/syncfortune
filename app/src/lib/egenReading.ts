// app/src/lib/egenReading.ts — 에겐/테토 성향 설명(온디바이스 결정론 룰 — LLM 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel(2026-06-30): "에겐테토도 풀이 때 API 소모 → 이것도 결정론으로." 기존엔 점수(egenTeto.ts)는
//   온디바이스였으나 설명(headline/성격/관계/요즘흐름)만 Edge LLM(kind=egen·Haiku)이라 호출당 과금.
//   → 그 4필드를 EGEN_SYSTEM(daniel 작성 stance·톤)을 룰 템플릿으로 옮겨 온디바이스 생성(API 0·무료).
// 톤·원칙(EGEN_SYSTEM 이관): 가볍고 재치 · 성별 단정 금지(기질의 결) · 우열 없음 · 부정 증폭 금지 ·
//   쉬운 말(십신·한자·용어 0) · 바넘("누구나") 회피. 점수(0=에겐~100=테토)에 정박 — 밴드별 문구.
// 결정론: 같은 명식·같은 점수 = 같은 설명(Math.random 금지). 시드 = 점수+유형+근거 십신 해시 → 풀 선택.
//   → dailyFortune.ts 와 동일 패턴(언어별 풀 + 해시 픽).
// ★문구 stance·다국어(en/ja) = daniel 검수 슬롯 — 현재 ko 충실 작성, en/ja 미작성분은 ko 폴백(출시 전 보강).
// ─────────────────────────────────────────────────────────────────────────
import { appLang } from './i18n';
import type { EgenTetoResult } from './egenTeto';

export type EgenReading = { headline: string; personality: string; relationship: string; nowTrend: string };

type Lang = 'ko' | 'en' | 'ja';
type Band = 'teto' | 'balanced' | 'egen';
type Pool = Record<Band, Partial<Record<Lang, string[]>>>;

// 점수 → 밴드 (EGEN_SYSTEM·buildEgenPrompt 임계와 동일: 60↑ 테토 / 40↓ 에겐 / 그 사이 균형)
function band(score: number): Band {
  if (score >= 60) return 'teto';
  if (score <= 40) return 'egen';
  return 'balanced';
}
// FNV-1a 해시(결정론 시드) — dailyFortune.ts 와 동일 방식
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function pick(arr: string[], seed: number): string { return arr[((seed % arr.length) + arr.length) % arr.length]; } // 음수 시드 방어
// 언어별 풀 — 미작성(en/ja)이면 ko 폴백(daniel: 다국어 보강 슬롯)
function from(pool: Pool, b: Band, lang: Lang, seed: number): string {
  const arr = pool[b][lang]?.length ? pool[b][lang]! : pool[b].ko!;
  return pick(arr, seed);
}

// ── headline: 유형 별명(재치 한 줄) ──
const HEADLINE: Pool = {
  teto: {
    ko: ['일단 부딪치고 보는 직진파', '앞장서야 직성이 풀리는 추진형', '솔직하고 당당한 에너지 부자', '하고 싶으면 바로 움직이는 행동파'],
    en: ['A charge-ahead go-getter', 'Born to take the lead', 'Bold, high-energy type', 'Acts the moment they want to'],
    ja: ['まず動く直進派', '先頭に立ちたいタイプ', 'エネルギッシュで率直', 'やりたいと思ったらすぐ動く'],
  },
  balanced: {
    ko: ['상황 따라 꺼내 쓰는 유연한 균형형', '직진과 여유를 오가는 변신형', '밀당이 자연스러운 중간 조율자', '셀 땐 세고 평소엔 부드러운 양면파'],
    en: ['A flexible all-rounder', 'Switches between drive and ease', 'A natural at give-and-take', 'Firm when needed, soft as a rule'],
    ja: ['状況で使い分ける柔軟派', '直進と余裕を行き来するタイプ', '駆け引き上手な調整役', '締める時は締め普段は柔らか'],
  },
  egen: {
    ko: ['다 품어주는 넉넉한 여유파', '한 박자 쉬어가는 부드러운 사람', '조용히 단단한 안정형', '곁에 있으면 편안해지는 다정파'],
    en: ['Warm and easygoing', 'Takes a gentle pace', 'Quietly steady', 'Calming to be around'],
    ja: ['包み込む余裕派', '一拍おく穏やかなタイプ', '静かで芯が強い', 'そばにいると安心する人'],
  },
};
// ── personality: 평소 기질이 드러나는 모습(각 2~3문장) ──
const PERSONALITY: Pool = {
  teto: {
    ko: [
      '하고 싶은 게 생기면 망설이기보다 일단 시작해요. 부딪치면서 길을 찾고 솔직하게 표현하는 편이라, 곁에 있으면 시원시원하다는 말을 자주 들어요.',
      '에너지가 밖으로 향해서 자연스럽게 분위기를 이끌어요. 가만히 기다리기보다 먼저 움직이고, 한번 정하면 밀어붙이는 힘이 있어요.',
      '주도권을 쥐는 게 편하고 승부욕도 있는 편이에요. 직선적이라 가끔 오해를 사기도 하지만, 뒤끝 없는 시원함이 매력이에요.',
      '도전 앞에서 잘 물러서지 않아요. 새로운 일일수록 눈이 반짝이고, 가만있기보다 뭐라도 벌이는 쪽이 마음 편한 사람이에요.',
    ],
    en: [
      'When you want something, you start right away instead of hesitating. You find your way by diving in and say things straight — people call you refreshingly direct.',
      'Your energy points outward, so you naturally set the mood. You move first rather than wait, and once you decide, you push it through.',
      'You like taking the lead and have a competitive streak. Being so direct can cause the odd misunderstanding, but your no-grudges openness is your charm.',
      "You don't back down from a challenge. The newer it is, the more your eyes light up — you'd rather start something than sit still.",
    ],
    ja: [
      'やりたいことができると迷うより先に動きます。ぶつかりながら道を見つけ率直に表現するので、一緒にいると気持ちいいと言われます。',
      'エネルギーが外に向くので自然と場を引っ張ります。待つより先に動き、一度決めたら押し進める力があります。',
      '主導権を握るのが楽で勝負欲もある方です。直球すぎて誤解されることもありますが、後腐れない爽やかさが魅力です。',
      '挑戦の前で引きません。新しいことほど目が輝き、じっとしているより何かを始める方が落ち着きます。',
    ],
  },
  balanced: {
    ko: [
      '상황을 보고 직진할 때와 물러설 때를 자연스럽게 가려요. 세게 나가야 할 땐 세고 받아줘야 할 땐 받아주는 균형 감각이 있어요.',
      '한쪽으로 치우치지 않아서 사람들 사이에서 조율을 잘해요. 분위기를 읽고 톤을 맞추는 데 능해, 어디서든 무난하게 섞여요.',
      '평소엔 부드럽다가도 필요할 땐 단단해져요. 그때그때 다른 모습이 변덕이 아니라, 상황에 맞춰 꺼내 쓰는 유연함이에요.',
      '추진력과 차분함을 둘 다 가지고 있어요. 덕분에 일이든 관계든 극단으로 치닫지 않고 중심을 잘 잡는 편이에요.',
    ],
    en: [
      'You naturally sense when to push and when to step back. Strong when you need to be, receptive when it counts — you have a real sense of balance.',
      "You don't lean too far either way, so you're good at smoothing things over between people. You read the room and match the tone, fitting in anywhere.",
      "Usually soft, but you firm up when it matters. Your shifting sides aren't fickleness — it's flexibility you pull out as the moment needs.",
      'You carry both drive and calm, so neither work nor relationships swing to extremes — you keep the center.',
    ],
    ja: [
      '押す時と引く時を自然に見分けます。強く出るべき時は強く、受けるべき時は受ける、バランス感覚があります。',
      'どちらにも偏らないので人の間の調整が上手です。空気を読みトーンを合わせ、どこでも無理なく馴染みます。',
      '普段は柔らかいけれど必要な時は芯が出ます。その時々で違う姿は気まぐれではなく、状況に合わせて出す柔軟さです。',
      '推進力と落ち着きの両方を持つので、仕事も関係も極端に走らず中心を保ちます。',
    ],
  },
  egen: {
    ko: [
      '서두르기보다 한 박자 쉬어가며 살펴요. 부드럽게 받아들이고 품는 결이라, 곁에 있으면 마음이 놓인다는 말을 들어요.',
      '경쟁에서 이기는 것보다 편안한 관계가 더 좋아요. 모나지 않게 배려하고 차분히 자기 페이스를 지키는 안정감이 있어요.',
      '큰소리로 끌기보다 조용히 스며들어요. 다그치지 않고 기다려 주는 너그러움이 있어, 사람들이 곁에서 마음을 잘 풀어요.',
      '급한 결정보다 충분히 생각하고 움직여요. 부드러워 보여도 속은 단단해서, 한번 품은 마음은 오래 가는 사람이에요.',
    ],
    en: [
      'You look around and take a beat rather than rush. You take things in gently, so people feel at ease around you.',
      'A comfortable relationship matters more to you than winning. You\'re considerate without sharp edges and keep your own calm pace.',
      'You blend in quietly rather than pulling loudly. Your patient, unhurried warmth lets people open up beside you.',
      'You think things through before moving. You may look soft, but you\'re firm inside — once you take someone to heart, it lasts.',
    ],
    ja: [
      '急ぐより一拍おいて見回します。柔らかく受け入れる質なので、そばにいると安心すると言われます。',
      '勝つことより心地よい関係が好きです。角を立てず気遣い、自分のペースを静かに守る安定感があります。',
      '大声で引っ張るより静かに馴染みます。せかさず待つ寛さがあり、人がそばで心を解きます。',
      '急がず十分考えて動きます。柔らかく見えても芯は強く、一度抱いた想いは長く続きます。',
    ],
  },
};
// ── relationship: 연애·사람 관계의 결(각 2~3문장) ──
const RELATIONSHIP: Pool = {
  teto: {
    ko: [
      '마음이 가면 먼저 다가가는 편이에요. 표현을 아끼지 않고 이끄는 연애를 좋아해서, 솔직한 직진이 상대에겐 매력으로 닿아요.',
      '관계에서도 끌고 가는 쪽이 편해요. 좋고 싫음이 분명하고, 함께 뭔가를 해나가는 활기찬 사이를 좋아해요.',
      '끌리면 바로 행동으로 보여줘요. 밀당보다 직진이라, 차분히 받아주고 맞춰 주는 상대와 특히 잘 어울려요.',
    ],
    en: [
      "When you like someone, you tend to make the first move. You don't hold back and like to lead — your honest, direct approach reads as charm.",
      "You're comfortable steering the relationship too. Your likes and dislikes are clear, and you enjoy a lively bond where you do things together.",
      "When you're drawn to someone, you show it through action. Direct over playing games, you click especially well with a calm, accommodating partner.",
    ],
    ja: [
      '好きになると先に近づく方です。表現を惜しまずリードする恋を好み、率直な直球が相手には魅力に映ります。',
      '関係でも引っ張る方が楽です。好き嫌いがはっきりして、一緒に何かをする活気ある仲を好みます。',
      '惹かれたらすぐ行動で示します。駆け引きより直進なので、落ち着いて受け止めてくれる相手と特に合います。',
    ],
  },
  balanced: {
    ko: [
      '상대에 맞춰 다가갈 때와 기다릴 때를 잘 조절해요. 너무 들이대지도 빼지도 않는 밀당이 자연스러워 편안한 연애를 해요.',
      '이끌 줄도 맞춰 줄 줄도 알아요. 상대의 결에 따라 톤을 바꿔서, 나와 다른 성향과도 무리 없이 어울려요.',
      '관계에서 균형을 중요하게 봐요. 한쪽이 일방적이지 않게 조율하는 편이라, 오래 가는 사이를 잘 만들어요.',
    ],
    en: [
      'You adjust well between approaching and waiting, depending on the person. Neither pushy nor distant, your natural give-and-take makes for an easy relationship.',
      'You can both lead and follow. You shift your tone to the other person, so you get along even with quite different types.',
      'You value balance in a relationship. You keep things from becoming one-sided, so you build bonds that last.',
    ],
    ja: [
      '相手に合わせて近づく時と待つ時を上手く調整します。押しすぎず引きすぎない駆け引きが自然で、心地よい恋をします。',
      'リードもフォローもできます。相手の質に合わせてトーンを変えるので、違うタイプとも無理なく合います。',
      '関係でバランスを大切にします。一方的にならないよう調整するので、長く続く仲を作ります。',
    ],
  },
  egen: {
    ko: [
      '먼저 들이대기보다 천천히 마음을 열어요. 다정하게 받아주고 배려하는 결이라, 곁에 있으면 편안하다는 말을 자주 들어요.',
      '다툼보다 화목을 더 원해요. 상대의 말을 잘 들어주고 품어주는 편이라, 적극적으로 다가와 주는 상대와 잘 어울려요.',
      '조용히 오래 가는 사랑을 좋아해요. 표현이 요란하진 않아도 한결같아서, 시간이 갈수록 더 깊어지는 사이를 만들어요.',
    ],
    en: [
      'You open up slowly rather than rushing in. You\'re warm and considerate, so people often feel at ease with you.',
      'You want harmony over conflict. You listen well and hold space, so you pair nicely with someone who comes to you actively.',
      'You like a quiet, lasting love. It may not be flashy, but you\'re steady — the kind of bond that deepens over time.',
    ],
    ja: [
      '先に押すより、ゆっくり心を開きます。優しく受け止め気遣う質なので、そばにいると安心すると言われます。',
      '争いより和を望みます。相手の話をよく聞き包むので、積極的に近づいてくれる相手と合います。',
      '静かで長く続く愛が好きです。派手ではなくても一途で、時が経つほど深まる仲を作ります。',
    ],
  },
};
// ── nowTrend: 요즘 흐름에서 이 성향이 어떻게 움직이는지(점수에 운이 반영됨 — 각 2~3문장) ──
const NOWTREND: Pool = {
  teto: {
    ko: [
      '요즘은 평소보다 추진력이 더 붙는 흐름이에요. 미뤄둔 일을 밀어붙이기 좋은 때라, 하고 싶던 걸 시작하면 탄력이 붙어요.',
      '지금은 앞으로 나아가려는 기운이 강해요. 망설이던 일에 한 발 내딛기 좋고, 적극적으로 움직일수록 길이 열려요.',
      '에너지가 밖으로 향하는 시기예요. 도전이나 새 시도가 잘 맞아서, 부딪쳐 보는 만큼 얻는 게 있는 흐름이에요.',
    ],
    en: [
      "Lately your drive is running higher than usual. It's a good time to push the things you've put off — start what you've wanted to and momentum builds.",
      "Right now the urge to move forward is strong. It's a good moment to step toward what you've hesitated over; the more actively you move, the more doors open.",
      'Your energy is turned outward these days. Challenges and new tries suit you, so there\'s gain in the measure you dive in.',
    ],
    ja: [
      '最近は普段より推進力が増す流れです。先延ばしにした事を押し進めるのに良い時で、やりたかった事を始めると弾みがつきます。',
      '今は前へ進もうとする気が強いです。迷っていた事に一歩踏み出すのに良く、積極的に動くほど道が開けます。',
      'エネルギーが外へ向く時期です。挑戦や新しい試みが合い、ぶつかる分だけ得るものがある流れです。',
    ],
  },
  balanced: {
    ko: [
      '요즘은 직진과 여유 사이에서 균형을 잡기 좋아요. 밀어붙일 일과 내려놓을 일을 가리면 한결 수월해져요.',
      '지금은 상황을 보며 유연하게 움직이면 좋은 때예요. 한쪽으로 치우치지 않는 당신의 감각이 특히 빛나는 시기예요.',
      '세게 나갈 때와 쉬어 갈 때를 잘 고르면 되는 흐름이에요. 무리해서 정하기보다 흐름에 맞추면 자연스럽게 풀려요.',
    ],
    en: [
      "Lately it's a good time to balance drive and ease. Sorting what to push and what to let go makes things much smoother.",
      'Right now moving flexibly as you read the situation works well. Your knack for not leaning either way shines especially now.',
      "It's a flow where choosing when to push and when to rest pays off. Going with the current beats forcing decisions.",
    ],
    ja: [
      '最近は直進と余裕のバランスを取るのに良い流れです。押す事と手放す事を分けると一段と楽になります。',
      '今は状況を見て柔軟に動くと良い時です。どちらにも偏らないあなたの感覚が特に光る時期です。',
      '強く出る時と休む時を上手く選べば良い流れです。無理に決めるより流れに合わせると自然に解けます。',
    ],
  },
  egen: {
    ko: [
      '요즘은 한 박자 쉬어가며 살피기 좋은 흐름이에요. 서두르기보다 차분히 가다듬을 때라, 마음의 여유를 챙기면 좋아요.',
      '지금은 받아들이고 정비하는 기운이 강해요. 크게 벌이기보다 곁을 돌보고 채우면 더 단단해지는 시기예요.',
      '안으로 차분해지는 흐름이에요. 무리해서 끌고 가기보다 부드럽게 흘러가면, 오히려 더 멀리 가는 때예요.',
    ],
    en: [
      "Lately it's a good time to take a beat and look around. It's a moment to settle calmly rather than rush, so tend to your peace of mind.",
      'Right now the energy to take in and regroup is strong. Caring for what\'s near and filling up beats launching big — it makes you steadier.',
      "It's a flow that turns quietly inward. Flowing gently beats forcing things along — sometimes that takes you farther.",
    ],
    ja: [
      '最近は一拍おいて見回すのに良い流れです。急ぐより落ち着いて整える時なので、心の余裕を大切に。',
      '今は受け入れ整える気が強いです。大きく広げるより身近を世話し満たすと、より芯が強くなる時期です。',
      '内へ静かになる流れです。無理に引っ張るより柔らかく流れると、かえって遠くへ行ける時です。',
    ],
  },
};

/**
 * 에겐/테토 성향 설명(온디바이스) — egenTeto() 점수·유형·근거로 4필드 생성.
 * EGEN_SYSTEM(LLM) 대체: 톤·stance 동일, API 0·무료. 같은 명식·점수 = 같은 설명(결정론 시드).
 */
export function buildEgenReading(res: EgenTetoResult): EgenReading {
  const l = appLang();
  const lang: Lang = l === 'en' ? 'en' : l === 'ja' ? 'ja' : 'ko';
  const b = band(res.tetoScore);
  // 시드 = 점수+유형+근거 십신(명식 변별) → 필드마다 다른 파생 시드로 풀에서 한 문구 고정 선택
  const seed = hash(`${res.tetoScore}|${res.type}|${res.reasons.join(',')}`);
  return {
    headline: from(HEADLINE, b, lang, seed),
    personality: from(PERSONALITY, b, lang, seed * 7 + 1),
    relationship: from(RELATIONSHIP, b, lang, seed * 13 + 3),
    nowTrend: from(NOWTREND, b, lang, seed * 17 + 5),
  };
}
