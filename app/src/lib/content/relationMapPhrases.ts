// app/src/lib/content/relationMapPhrases.ts — 관계 지도 문구(3개 언어)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-14: *"문구는 우리가 만들고 저거보다 좀더 디테일하게"*
//
// ■ 왜 우리 문구를 새로 쓰나
//   참고한 화면의 문장("겨울 밤비형"·"바위틈에서 물이 솟듯" 같은 것)은 **그 앱의 창작물**이다.
//   베끼면 저작권 문제이기도 하지만, 무엇보다 **우리 해자가 안 쌓인다**(CLAUDE.md §3 축적).
//   구조는 참고하되 문장은 전부 새로 쓴다.
//
// ■ '더 디테일하게' = 한 겹을 더 얹는다
//   참고 화면: 비유 + 설명 + 주의  (3겹)
//   우리:      비유 + 설명 + 주의 + **처방**  (4겹)
//   ★처방은 취향이 아니라 **규칙**이다 — CLAUDE.md §3.1 가드5 "처방 없이 묘사로 끝내지 말 것".
//     "이 관계는 이렇다"로 끝내면 사용자가 할 수 있는 게 없다.
//
// ■ 역할 이름 = 생활어(daniel 선택 2026-08-14)
//   명리를 몰라도 바로 읽히게. 원어(인성·비견…)는 화면 구석에 작게 병기해 용어를 잃지 않는다.
//
// ⚠️건강·재물 단정 금지(§4)는 여기도 같다 — 관계를 **평가**하지 않는다.
//   "이 사람은 당신에게 해롭다" 같은 말은 쓰지 않는다. 사람을 점수로 재는 화면이 되면 안 된다.
// ═══════════════════════════════════════════════════════════════════════════
import type { RelationRole } from '@engine/relationMap';
import type { Element } from '@spec/chart';

export type Lang = 'ko' | 'en' | 'ja';

/** 역할 한 칸의 문구 4겹. */
export type RolePhrase = {
  /** 화면에 크게 뜨는 생활어 이름 */
  name: string;
  /** 명리 원어(작게 병기) */
  term: string;
  /** 한 줄 비유 — 관계의 그림 */
  image: string;
  /** 무슨 사이인가 */
  meaning: string;
  /** 이 조합이 오래가려면 무엇을 조심하나 */
  caution: string;
  /** ★처방 — 그래서 어떻게 지내면 좋은가(가드5) */
  advice: string;
};

const KO: Record<RelationRole, RolePhrase> = {
  인성: {
    name: '날 끌어주는 사람', term: '인성(印星)',
    image: '마른 흙에 물이 스미듯, 있으면 내가 채워지는 사이',
    meaning: '먼저 손을 내밀지 않아도 배울 게 생기는 사람이에요. 조언이든 기회든, 이 사람 쪽에서 나에게 흘러 들어옵니다.',
    caution: '기대는 게 편해서 판단까지 맡겨 버리기 쉬워요. 이 사람 말이 곧 내 결론이 되면 관계가 상하로 굳습니다.',
    advice: '받은 만큼 근황을 먼저 전하세요. 조언은 듣되 결정은 내가 한다는 선만 지키면 오래 갑니다.',
  },
  비견: {
    name: '같은 결의 사람', term: '비견(比肩)',
    image: '나란히 선 두 그루 나무처럼, 말 안 해도 통하는 사이',
    meaning: '속도와 방식이 닮아서 설명이 짧아도 통해요. 같이 있으면 편하고, 함께 벌이는 일이 잘 굴러갑니다.',
    caution: '닮은 만큼 원하는 것도 겹칩니다. 같은 자리를 두고 서면 그때부터 편했던 만큼 불편해져요.',
    advice: '역할을 미리 갈라 두세요. "이건 네가, 저건 내가"가 정해져 있으면 이 관계는 가장 든든한 축이 됩니다.',
  },
  식상: {
    name: '내가 챙기게 되는 사람', term: '식상(食傷)',
    image: '내 안의 물이 흘러 나가듯, 자연스레 마음이 쓰이는 사이',
    meaning: '묻지 않아도 챙겨주고 싶어지는 사람이에요. 내가 가진 것을 꺼내 쓰게 되고, 그 과정에서 내 표현도 늘어납니다.',
    caution: '주는 쪽이 나로 굳어지면 어느 순간 지칩니다. 서운함은 대개 이 자리에서 생겨요.',
    advice: '가끔은 부탁하는 쪽이 되어 보세요. 받아 본 사람이라야 주는 마음을 압니다.',
  },
  재성: {
    name: '내가 움직이게 되는 사람', term: '재성(財星)',
    image: '손에 잡히는 결실처럼, 내가 나서서 만들어 가는 사이',
    meaning: '이 사람과는 일이 구체적으로 굴러갑니다. 계획을 세우고 실행하게 되는, 결과가 남는 관계예요.',
    caution: '성과로만 이어지면 일이 끝났을 때 할 말이 없어집니다. 관계가 용건 단위로 짧아져요.',
    advice: '용건 없이 연락하는 날을 만들어 두세요. 그 한 번이 이 관계의 수명을 늘립니다.',
  },
  관성: {
    name: '날 긴장시키는 사람', term: '관성(官星)',
    image: '쇠를 두드리는 망치처럼, 부딪히면서 모양이 잡히는 사이',
    meaning: '편하지만은 않은데 이상하게 신경 쓰이는 사람이에요. 이 사람 앞에서는 흐트러지지 않게 되고, 그래서 나를 끌어올립니다.',
    caution: '긴장이 길어지면 위축으로 바뀝니다. 맞추기만 하다 보면 내 결이 지워져요.',
    advice: '이 사람이 하는 말과 그 사람 자체를 분리해 들으세요. 배울 건 챙기고 눈치는 두고 오면 됩니다.',
  },
};

const EN: Record<RelationRole, RolePhrase> = {
  인성: {
    name: 'Someone who lifts you', term: 'Resource (印星)',
    image: 'Like water soaking into dry ground — you fill up just by being around them',
    meaning: 'You end up learning something without asking. Advice, chances, openings — they tend to flow from their side to yours.',
    caution: 'Leaning gets comfortable, and soon you hand over your judgement too. Once their words become your conclusions, the relationship hardens into a ladder.',
    advice: 'Reach out first now and then. Take the advice, but keep the deciding for yourself — that line is what keeps it healthy.',
  },
  비견: {
    name: 'Someone cut from your cloth', term: 'Peer (比肩)',
    image: 'Two trees standing side by side — little needs saying',
    meaning: 'Your pace and your methods rhyme, so half-sentences land. Things you start together tend to move.',
    caution: 'Being alike means wanting alike. The moment you both reach for the same seat, the ease turns into friction.',
    advice: 'Split the roles early. With "this is yours, that is mine" settled, this becomes the sturdiest tie you have.',
  },
  식상: {
    name: 'Someone you look after', term: 'Output (食傷)',
    image: 'Water running out of you — care goes their way without being asked',
    meaning: 'You want to look out for them before they ask. You spend what you have on them, and your own voice grows in the doing.',
    caution: 'If giving becomes only your job, it wears thin. Quiet resentment usually starts right here.',
    advice: 'Let yourself ask for something once in a while. People understand giving best after they have received.',
  },
  재성: {
    name: 'Someone who gets you moving', term: 'Wealth (財星)',
    image: 'Fruit you can hold — you step up and build it together',
    meaning: 'Things get concrete with this person. You plan, you act, and something is left over at the end.',
    caution: 'If it runs on results alone, you have nothing to say once the work ends. The relationship shrinks to errands.',
    advice: 'Keep one day for reaching out with no agenda. That single call is what extends this one.',
  },
  관성: {
    name: 'Someone who keeps you sharp', term: 'Authority (官星)',
    image: 'A hammer on metal — the shape comes from the striking',
    meaning: 'Not exactly easy, yet you keep thinking about them. You do not slouch in front of this person, and that pulls you up.',
    caution: 'Tension held too long turns into shrinking. Match them endlessly and your own grain gets sanded off.',
    advice: 'Hear what they say apart from who they are. Take the lesson home and leave the flinching behind.',
  },
};

const JA: Record<RelationRole, RolePhrase> = {
  인성: {
    name: '引き上げてくれる人', term: '印星(いんせい)',
    image: '乾いた土に水が染みるように、そばにいるだけで満たされる間柄',
    meaning: '頼まなくても学びが生まれる人です。助言も機会も、この人のほうから流れ込んできます。',
    caution: '頼るのが心地よくて、判断まで委ねてしまいがち。この人の言葉がそのまま結論になると、関係が上下で固まります。',
    advice: '受け取った分、こちらから近況を伝えて。助言は聞きつつ決めるのは自分——その線だけ守れば長く続きます。',
  },
  비견: {
    name: '同じ質の人', term: '比肩(ひけん)',
    image: '並んで立つ二本の木のように、言わなくても通じる間柄',
    meaning: '速度もやり方も似ていて、短い言葉で通じます。一緒に始めたことはよく回ります。',
    caution: '似ている分、欲しいものも重なります。同じ席を取り合った瞬間、楽だった分だけ気まずくなります。',
    advice: '役割を先に分けておいて。「これは君、あれは私」が決まっていれば、最も心強い柱になります。',
  },
  식상: {
    name: 'つい世話を焼く人', term: '食傷(しょくしょう)',
    image: '自分の中の水が流れ出るように、自然と気にかけてしまう間柄',
    meaning: '頼まれる前に世話を焼きたくなる人です。持っているものを使うことになり、その過程で自分の表現も育ちます。',
    caution: '与える側が自分に固定されると、いつか消耗します。もやもやはたいていこの場所から生まれます。',
    advice: 'たまにはお願いする側に回ってみて。受け取った人こそ、与える気持ちがわかります。',
  },
  재성: {
    name: '自分を動かす人', term: '財星(ざいせい)',
    image: '手に取れる実りのように、自ら動いて作っていく間柄',
    meaning: 'この人とは物事が具体的に進みます。計画して実行して、結果が残る関係です。',
    caution: '成果だけでつながると、仕事が終わった時に話すことがなくなります。用件単位の短い関係になりがち。',
    advice: '用がなくても連絡する日を作っておいて。その一回がこの関係の寿命を延ばします。',
  },
  관성: {
    name: '緊張させてくる人', term: '官星(かんせい)',
    image: '鉄を打つ槌のように、ぶつかりながら形が決まる間柄',
    meaning: '楽ではないのに、なぜか気になる人。この人の前では気が緩まず、それが自分を引き上げます。',
    caution: '緊張が長引くと萎縮に変わります。合わせてばかりだと自分の質が消えていきます。',
    advice: 'この人の言葉と、この人自身を分けて聞いて。学ぶものだけ持ち帰り、顔色は置いてくればいい。',
  },
};

const TABLE: Record<Lang, Record<RelationRole, RolePhrase>> = { ko: KO, en: EN, ja: JA };

/** 역할 문구를 가져온다. 모르는 언어는 ko 로 떨어진다(빈 화면보다 낫다). */
export function rolePhrase(lang: Lang, role: RelationRole): RolePhrase {
  return (TABLE[lang] ?? KO)[role];
}

/** 오행 상생/상극을 한자로 — 화면에 근거로 작게 붙인다(예: 金生水). */
export function elemRelationLabel(mine: Element, theirs: Element): string {
  const SHENG: Record<Element, Element> = { 水: '木', 木: '火', 火: '土', 土: '金', 金: '水' };
  const KE: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  if (mine === theirs) return `${mine}比和`;               // 비화 — `金金` 은 표기가 아니다(관용은 比和)
  if (SHENG[theirs] === mine) return `${theirs}生${mine}`;  // 상대가 나를 생
  if (SHENG[mine] === theirs) return `${mine}生${theirs}`;  // 내가 상대를 생
  if (KE[mine] === theirs) return `${mine}剋${theirs}`;     // 내가 상대를 극
  return `${theirs}剋${mine}`;                              // 상대가 나를 극
}

/**
 * 궁합으로 잇는 문구 — **정직하게** 쓴다.
 *
 * ★참고 화면은 "이 점수는 여덟 글자 중 한 글자로 본 것"이라며 유도한다. 우리는 그 말을 못 쓴다 —
 *   우리 케미는 이미 **여섯 기준**(계절·재관·결핍·일간관계·용신·배우자궁)으로 여덟 글자를 다 본다.
 *   같은 문구를 쓰면 거짓말이 된다([[no-fabrication-honesty]]).
 *   ⇒ 우리 유도는 "무엇이 더 있는가"로 간다: 점수 → **이유·시기·처방**.
 */
export function compatHook(lang: Lang, name: string, chemi: number): { title: string; body: string; cta: string } {
  if (lang === 'en') return {
    title: `${chemi} with ${name} — the number is the short version`,
    body: 'The score already reads both charts in full. What it cannot hold is the why: where you fit, where you grind, when it gets easier, and what to do about it.',
    cta: `Read ${name} and you, properly`,
  };
  if (lang === 'ja') return {
    title: `${name}さんとケミ ${chemi} — 数字は要約です`,
    body: 'この点数はすでに二人の八字すべてを見ています。ただ数字には入らないものがある——噛み合う場所、ぶつかる場所、楽になる時期、そしてどう付き合えばいいか。',
    cta: `${name}さんとの相性をちゃんと見る`,
  };
  return {
    title: `${name}님과 케미 ${chemi} — 숫자는 요약이에요`,
    body: '이 점수는 두 사람의 여덟 글자를 이미 다 보고 낸 값이에요. 다만 숫자에 담기지 않는 게 있어요 — 어디서 맞고 어디서 부딪히는지, 언제 편해지는지, 그때 무엇을 하면 되는지.',
    cta: `${name}님과의 궁합 제대로 보기`,
  };
}
