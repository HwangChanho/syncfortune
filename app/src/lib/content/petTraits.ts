// app/src/lib/petTraits.ts — 반려동물 특징 통변 (온디바이스 템플릿, API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 반려동물은 '운세'보다 *특징·성격* 위주로 가볍게. 동물에 맞게.
//   근거 = 그 아이 사주의 '일간 오행'(타고난 기질의 큰 결) + 동물 종류 색채. 결정론·룰 → 무료·API 0.
//   ※ 재미 콘텐츠(추정) — 의료·수명 단정 금지(가드4), 부정 증폭 금지. 시각 미상이면 큰 결만.
// ─────────────────────────────────────────────────────────────────────────
import type { PetType } from './petChart';
import { appLang } from '../i18n';

// 통변 한 묶음 = 라벨 + 본문 3섹션(기질·사람과의 관계·좋아하는 것/케어).
export type PetReading = { intro: string; sections: { label: string; text: string }[] };

// 오행(일간) → 기질/관계/케어 한 줄씩. 동물 무관한 '큰 결'.
type ElCopy = { temper: string; bond: string; care: string };
type Bundle = {
  labels: { temper: string; bond: string; care: string; health: string };
  intro: (name: string, animal: string) => string;
  noTime: string;
  el: Record<string, ElCopy>;          // key: 木火土金水
  animal: Record<PetType, string>;     // 종류별 한 줄 색채(intro 뒤에 붙음)
  animalCare: Record<PetType, string>; // 종류별 케어 한 줄(care 섹션에 붙음)
  health: Record<string, string>;      // 일간 오행별 건강·케어 포인트(관리축 — 의료 단정 금지, daniel)
};

const KO: Bundle = {
  labels: { temper: '타고난 기질', bond: '사람과의 호흡', care: '좋아하는 것 · 케어 팁', health: '건강 · 케어 포인트' },
  intro: (name, animal) => `${name}는 타고난 결이 또렷한 ${animal}예요.`,
  noTime: '태어난 시각을 몰라서 큰 결만 봤어요. 그래도 기질은 또렷하게 드러나요.',
  el: {
    '木': {
      temper: '호기심이 많고 활발해요. 새로운 곳·새로운 냄새에 먼저 다가가고, 자라고 싶어 하는 기운이 강해 자기만의 리듬으로 쑥쑥 커요.',
      bond: '곁을 좋아하지만 묶여 있는 건 답답해해요. 자유를 조금 주면 더 잘 따르고, 함께 산책하거나 움직일 때 가장 행복해해요.',
      care: '뛰고 탐색할 공간이 필요해요. 새 장난감·새 루트를 자주 바꿔 주면 지루해하지 않아요.',
    },
    '火': {
      temper: '표현이 솔직하고 정이 넘쳐요. 기쁘면 온몸으로 반기고, 사람의 기분을 금세 따라 느끼는 다정한 아이예요.',
      bond: '관심을 먹고 자라요. 눈 맞춤·칭찬에 크게 반응하고, 외로움을 잘 타니 자주 말 걸어 주면 안정돼요.',
      care: '따뜻한 자리와 놀이 시간을 좋아해요. 너무 흥분하면 쉬 지치니 신나는 놀이 뒤엔 차분한 휴식을 챙겨 주세요.',
    },
    '土': {
      temper: '느긋하고 듬직해요. 큰 변화보다 익숙한 걸 좋아하고, 어지간한 일엔 잘 흔들리지 않는 안정감이 있어요.',
      bond: '한번 마음을 주면 오래가요. 천천히 신뢰를 쌓는 타입이라, 재촉하지 않고 기다려 주면 깊이 따라요.',
      care: '규칙적인 생활을 좋아해요. 밥·산책 시간을 일정하게 지켜 주면 가장 편안해해요.',
    },
    '金': {
      temper: '깔끔하고 자기 기준이 분명해요. 좋고 싫음이 또렷하고, 단정한 환경에서 마음이 놓이는 야무진 아이예요.',
      bond: '거리를 스스로 정해요. 억지로 안기보다 자기 페이스를 존중해 주면 오히려 먼저 다가와요.',
      care: '깨끗한 잠자리·정돈된 공간을 좋아해요. 일관된 규칙(되는 것·안 되는 것)이 분명할수록 안정돼요.',
    },
    '水': {
      temper: '영리하고 눈치가 빨라요. 분위기를 잘 읽고 상황에 유연하게 맞추는, 속이 깊은 아이예요.',
      bond: '교감이 섬세해요. 말투·표정의 작은 변화도 알아채니, 부드럽게 대해 주면 마음을 활짝 열어요.',
      care: '조용하고 안정된 환경을 좋아해요. 낯선 자극이 많으면 예민해질 수 있으니 자기만의 안전한 공간을 만들어 주세요.',
    },
  },
  animal: {
    dog: '마음을 그대로 보여 주는 강아지', cat: '자기 세계가 분명한 고양이', rabbit: '여리고 섬세한 토끼',
    hamster: '작지만 야무진 햄스터', bird: '호기심 많고 명랑한 새', fish: '잔잔하게 곁을 지키는 물고기',
    reptile: '느긋하고 신비로운 친구', other: '특별한 우리 아이',
  },
  animalCare: {
    dog: '함께 걷는 시간이 곧 사랑 표현이에요.', cat: '혼자만의 높은 자리를 하나 만들어 주면 좋아해요.',
    rabbit: '놀랄 일이 적은 조용한 환경이 중요해요.', hamster: '밤에 활동하니 낮엔 푹 자게 두세요.',
    bird: '말 걸어 주고 소리로 교감하면 잘 따라요.', fish: '물·온도를 일정하게 지켜 주는 게 핵심이에요.',
    reptile: '온도와 빛을 일정하게 맞춰 주면 편안해해요.', other: '그 아이의 속도에 맞춰 주는 게 제일이에요.',
  },
  health: {
    '木': '활동량이 많은 만큼 다리·관절에 무리가 가지 않게. 과하게 뛴 날은 쉬어 가고, 정기 검진으로 컨디션을 살펴 주세요.',
    '火': '쉽게 흥분해 체력 소모가 커요. 더위·과열에 약할 수 있으니 시원한 환경과 충분한 수분, 신나게 논 뒤 휴식을 챙겨 주세요.',
    '土': '잘 먹는 만큼 소화·체중 관리가 포인트. 식사량과 산책을 규칙적으로 지켜 비만을 예방해 주세요.',
    '金': '환경 변화·먼지에 호흡기가 예민할 수 있어요. 깨끗한 공기와 정돈된 잠자리로 컨디션을 지켜 주세요.',
    '水': '예민해서 스트레스에 컨디션이 흔들리기 쉬워요. 따뜻하고 일정한 환경으로 안정감을 주면 좋아요.',
  },
};

const EN: Bundle = {
  labels: { temper: 'Natural temperament', bond: 'Bond with people', care: 'Likes & care tips', health: 'Health & care' },
  intro: (name, animal) => `${name} is a ${animal} with a clear, distinct nature.`,
  noTime: "Without a birth time we read only the broad strokes — but the temperament still comes through clearly.",
  el: {
    '木': {
      temper: 'Curious and lively. First to explore new places and smells, with a strong drive to grow at their own pace.',
      bond: 'Loves being near you but dislikes being tied down. Give a little freedom and they follow happily — happiest moving or walking together.',
      care: 'Needs room to run and explore. Rotate toys and routes often so they never get bored.',
    },
    '火': {
      temper: 'Openly affectionate and expressive. Greets you with their whole body and quickly mirrors your mood.',
      bond: 'Thrives on attention. Responds big to eye contact and praise; gets lonely easily, so talk to them often.',
      care: 'Loves warm spots and playtime. Burns out if over-excited — follow lively play with calm rest.',
    },
    '土': {
      temper: 'Easygoing and steady. Prefers the familiar over big changes, with a calm that rarely rattles.',
      bond: 'Once they trust you, it lasts. A slow-trust type — wait without rushing and they bond deeply.',
      care: 'Loves routine. Keep meals and walks on a steady schedule and they feel most at ease.',
    },
    '金': {
      temper: 'Tidy with clear preferences. Strong likes and dislikes; feels secure in a neat environment.',
      bond: 'Sets their own distance. Respect their pace rather than forcing cuddles, and they come to you first.',
      care: 'Loves a clean bed and orderly space. The clearer the rules, the more settled they are.',
    },
    '水': {
      temper: 'Clever and quick to read the room. Flexible and deep, adapting smoothly to situations.',
      bond: 'Subtle and attuned — notices small shifts in your voice and face. Be gentle and they open right up.',
      care: 'Loves quiet, stable surroundings. Too much novelty can make them anxious, so give them a safe corner.',
    },
  },
  animal: {
    dog: 'open-hearted dog', cat: 'self-possessed cat', rabbit: 'gentle, sensitive rabbit',
    hamster: 'small but sharp hamster', bird: 'curious, cheerful bird', fish: 'quietly steady fish',
    reptile: 'calm, mysterious companion', other: 'one-of-a-kind little one',
  },
  animalCare: {
    dog: 'Time walking together is love itself.', cat: 'Give them one high perch of their own.',
    rabbit: 'A quiet, low-surprise environment matters most.', hamster: 'They are nocturnal — let them sleep by day.',
    bird: 'Talk and chirp with them and they bond well.', fish: 'Steady water and temperature is the key.',
    reptile: 'Keep heat and light consistent and they relax.', other: 'Moving at their pace is what matters most.',
  },
  health: {
    '木': 'Active by nature, so go easy on legs and joints. Rest after big-run days and use regular checkups to keep tabs.',
    '火': 'Excitable, so they burn energy fast and can struggle with heat — keep them cool, well-hydrated, and rested after lively play.',
    '土': 'Hearty eaters, so watch digestion and weight. Keep portions and walks regular to prevent obesity.',
    '金': 'Airways can be sensitive to dust and change. Clean air and a tidy bed keep them in good shape.',
    '水': 'Sensitive, so stress can throw off their condition. Warm, steady surroundings give them stability.',
  },
};

const JA: Bundle = {
  labels: { temper: '生まれもった気質', bond: '人との相性', care: '好きなこと · ケアのコツ', health: '健康 · ケアのポイント' },
  intro: (name, animal) => `${name}は、生まれもった結がはっきりした${animal}です。`,
  noTime: '生まれた時刻が分からないので大きな結だけ見ました — それでも気質ははっきり出ています。',
  el: {
    '木': {
      temper: '好奇心が強く活発。新しい場所や匂いに真っ先に近づき、自分のリズムでぐんぐん育ちたがる気が強い子です。',
      bond: 'そばは好きですが縛られるのは苦手。少し自由をあげると懐き、一緒に歩いたり動くときが一番幸せです。',
      care: '走り回って探索できる空間が必要。おもちゃやルートをこまめに変えると飽きません。',
    },
    '火': {
      temper: '素直で愛情たっぷり。嬉しいと全身で迎え、人の気分をすぐ感じ取るやさしい子です。',
      bond: '関心を糧に育ちます。目線や褒め言葉に大きく反応し、寂しがり屋なのでよく話しかけると落ち着きます。',
      care: '暖かい場所と遊ぶ時間が好き。興奮しすぎると疲れるので、はしゃいだ後は静かな休息を。',
    },
    '土': {
      temper: 'のんびりどっしり。大きな変化より慣れたものを好み、たいていのことに動じない安定感があります。',
      bond: '一度心を許すと長続き。ゆっくり信頼を築くタイプなので、急かさず待つと深く懐きます。',
      care: '規則正しい生活が好き。ごはんや散歩の時間を一定に保つと一番安心します。',
    },
    '金': {
      temper: 'きれい好きで自分の基準がはっきり。好き嫌いが明確で、整った環境で安心するしっかり者です。',
      bond: '距離を自分で決めます。無理に抱くより自分のペースを尊重すると、むしろ先に寄ってきます。',
      care: '清潔な寝床と整った空間が好き。ルール（OK・NG）が一貫しているほど落ち着きます。',
    },
    '水': {
      temper: '賢くて察しが早い。空気をよく読み、状況に柔軟に合わせる芯の深い子です。',
      bond: '交感が繊細。声や表情の小さな変化も気づくので、やさしく接すると心を開きます。',
      care: '静かで安定した環境が好き。刺激が多いと敏感になるので、自分だけの安全な場所を作ってあげて。',
    },
  },
  animal: {
    dog: 'まっすぐな犬', cat: '自分の世界をもつ猫', rabbit: '繊細なうさぎ',
    hamster: '小さくてもしっかり者のハムスター', bird: '好奇心旺盛で明るい鳥', fish: '静かにそばにいる魚',
    reptile: 'のんびりして神秘的な子', other: '特別なうちの子',
  },
  animalCare: {
    dog: '一緒に歩く時間がそのまま愛情表現です。', cat: '自分だけの高い場所を一つ作ると喜びます。',
    rabbit: '驚きの少ない静かな環境が大切です。', hamster: '夜行性なので昼はぐっすり寝かせて。',
    bird: '話しかけ、声で交感するとよく懐きます。', fish: '水と温度を一定に保つのが肝心です。',
    reptile: '温度と光を一定にすると安心します。', other: 'その子のペースに合わせるのが一番です。',
  },
  health: {
    '木': '活動量が多いぶん、脚や関節に無理をさせないように。走りすぎた日は休ませ、定期検診で体調を見てあげて。',
    '火': '興奮しやすく体力の消耗が大きめ。暑さに弱いことがあるので、涼しい環境と十分な水分、遊んだ後の休息を。',
    '土': 'よく食べるぶん消化と体重の管理がポイント。食事量と散歩を規則的に保って肥満を予防して。',
    '金': '環境の変化やほこりに呼吸器が敏感なことも。きれいな空気と整った寝床で体調を守って。',
    '水': '繊細でストレスに体調が左右されやすい子。暖かく一定した環境で安心感を与えてあげて。',
  },
};

const T: Record<string, Bundle> = { ko: KO, en: EN, ja: JA };

/**
 * 반려동물 특징 통변(온디바이스). 일간 오행(큰 결) + 동물 색채로 구성.
 * @param saju computeChart(input).saju (일간 오행·시주 미상 여부 사용)
 * @param petType 동물 종류 / @param name 이름
 */
export function getPetTraits(saju: any, petType: PetType, name: string): PetReading {
  const b = T[appLang()] ?? KO;
  const el = String(saju?.dayMaster?.element ?? '土');
  const c = b.el[el] ?? b.el['土'];
  const animal = b.animal[petType] ?? b.animal.other;
  const timeUnknown = saju?.timeUnknown === true;
  const intro = b.intro(name, animal);
  // 건강은 관리축만(의료 단정 금지) — 수의사 상담 면책 한 줄을 덧붙인다(가드4).
  const vetNote = appLang() === 'en' ? ' (For real health concerns, please see your vet.)'
    : appLang() === 'ja' ? '（実際の健康は獣医にご相談ください。）'
    : ' (실제 건강은 수의사와 상담하세요.)';
  const sections = [
    { label: b.labels.temper, text: c.temper },
    { label: b.labels.bond, text: c.bond },
    { label: b.labels.care, text: `${c.care} ${b.animalCare[petType] ?? b.animalCare.other}` },
    { label: b.labels.health, text: `${b.health[el] ?? b.health['土']}${vetNote}` },
  ];
  // 시각 미상이면 안내 한 줄을 intro 뒤에 덧붙임(가드: 시주 해석 제외)
  return { intro: timeUnknown ? `${intro}\n${b.noTime}` : intro, sections };
}
