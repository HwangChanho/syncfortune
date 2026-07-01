// app/src/lib/healingMethod.ts — '나만의 힐링 방법'(가볍게 보기·무료·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel O: 명식 오행 균형으로 '나에게 맞는 쉼·자기돌봄'을 가볍게 안내.
//   · 일간 오행      = 나의 기본 충전 방식(어떻게 쉬어야 기운이 차는지)
//   · 가장 적은 오행 = 채우면 좋은 기운(보완 활동 + 색·공간·음식)
//   · 가장 많은 오행 = 비우면 좋은 기운(과다 해소; 8글자 중 3+ 일 때만 노출)
//   · 일간 오행      = 마음 한마디(전향적 위로)
//   ★stance(Claude 초안 — daniel 검수 슬롯): 전통 오행 상징(오색·오미·오방)에 기댄
//     가벼운 자기돌봄 매핑. §4: 의료 단정 금지·재미와 다독임 톤(정통 진단 아님).
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, branchElement, elementColor } from '../engine/ohaeng';
import { appLang } from '../i18n';

type Elem = '木' | '火' | '土' | '金' | '水';
type L = 'ko' | 'en' | 'ja';

// 오행 일상어 라벨(본문 노출 — 한자 대신)
const ELEM_LABEL: Record<Elem, Record<L, string>> = {
  木: { ko: '나무', en: 'Wood', ja: '木' }, 火: { ko: '불', en: 'Fire', ja: '火' },
  土: { ko: '흙', en: 'Earth', ja: '土' }, 金: { ko: '쇠', en: 'Metal', ja: '金' }, 水: { ko: '물', en: 'Water', ja: '水' },
};
// 일간 오행별 히어로 이모지(이미지 폴백 — HEAL_IMG 없을 때 화면에서 사용)
export const HEAL_EMOJI: Record<Elem, string> = { 木: '🌿', 火: '🌅', 土: '🏡', 金: '🤍', 水: '💧' };

// 오행별 힐링 카피 — recharge(일간일 때)·nourish(부족일 때)·release(과다일 때)·색/공간/음식·마음 한마디
type Loc = { recharge: string; nourish: string; release: string; color: string; place: string; food: string; mind: string };
const DATA: Record<Elem, Record<L, Loc>> = {
  木: {
    ko: { recharge: '새로운 자극과 움직임으로 충전돼요. 산책·여행·배움으로 기운이 쭉 뻗어요.', nourish: '자연과 초록을 가까이 하면 채워져요. 식물을 키우거나 숲·공원을 걸어 보세요.', release: '벌여 놓은 일을 줄이고 하나에 집중해 보세요. 가지치기하듯 정리하면 가벼워져요.', color: '초록·청록', place: '숲·공원처럼 나무가 있는 곳', food: '새싹·채소와 신맛 나는 음식, 따뜻한 차', mind: '조금 느려도 괜찮아요. 멈춤도 자라기 위한 시간이에요.' },
    en: { recharge: 'New stimulation and movement recharge you — walks, travel, and learning let your energy stretch out.', nourish: 'Being near nature and greenery fills you up. Grow a plant or walk in a forest or park.', release: 'Trim what you’ve spread too thin and focus on one thing — pruning lightens you.', color: 'Green & Teal', place: 'forests and parks — places with trees', food: 'sprouts, vegetables, sour flavors, warm tea', mind: 'It’s okay to be a little slow. Even a pause is time to grow.' },
    ja: { recharge: '新しい刺激と動きで充電。散歩·旅·学びで気がぐんと伸びます。', nourish: '自然と緑を身近に置くと満ちます。植物を育てたり森·公園を歩いて。', release: '広げすぎた事を減らし一つに集中。剪定するように整えると軽くなります。', color: '緑·青緑', place: '森·公園など木のある場所', food: '新芽·野菜と酸味のある食べ物、温かいお茶', mind: '少し遅くても大丈夫。止まるのも育つための時間です。' },
  },
  火: {
    ko: { recharge: '표현하고 발산할 때 충전돼요. 사람들과 웃고 나누면 기운이 살아나요.', nourish: '밝은 빛과 따뜻함을 더해 보세요. 햇볕을 쬐고 좋아하는 사람과 시간을 보내면 온기가 차요.', release: '과열됐다 싶을 땐 식혀 주세요. 혼자 조용히 쉬는 시간으로 열을 내려요.', color: '빨강·분홍', place: '햇살이 드는 밝고 따뜻한 곳', food: '쓴맛 나는 음식과 따뜻한 차 한 잔', mind: '다 태우지 않아도 돼요. 꺼지지 않게 천천히 데우세요.' },
    en: { recharge: 'Expressing and letting things out recharge you — laughing and sharing with people brings you alive.', nourish: 'Add bright light and warmth. Soak up the sun and spend time with people you love.', release: 'When you overheat, cool down — quiet time alone lowers the flame.', color: 'Red & Pink', place: 'bright, sunlit, warm places', food: 'bitter flavors and a warm cup of tea', mind: 'You don’t have to burn it all. Warm slowly so the flame stays lit.' },
    ja: { recharge: '表現し発散する時に充電。人と笑い分かち合うと元気が湧きます。', nourish: '明るい光と温もりを足して。日を浴び、好きな人と過ごすと温まります。', release: '過熱したら冷まして。一人で静かに休む時間で熱を下げます。', color: '赤·ピンク', place: '日の差す明るく暖かい場所', food: '苦味のある食べ物と温かいお茶', mind: '全部燃やさなくていい。消えないようゆっくり温めて。' },
  },
  土: {
    ko: { recharge: '익숙하고 안정된 환경에서 충전돼요. 규칙적인 일상이 마음을 단단하게 해 줘요.', nourish: '안정과 루틴을 더해 보세요. 정해진 시간에 자고 먹는 규칙이 중심을 잡아 줘요.', release: '너무 무거워졌다면 비워 보세요. 묵힌 짐을 내려놓고 가볍게 움직여요.', color: '노랑·베이지', place: '집처럼 익숙한 나만의 공간', food: '단맛 나는 곡물·뿌리채소', mind: '천천히 단단해지는 중이에요. 흔들려도 중심은 거기 있어요.' },
    en: { recharge: 'Familiar, stable surroundings recharge you — a steady routine makes your heart firm.', nourish: 'Add stability and routine. Sleeping and eating on a set schedule centers you.', release: 'If it has grown too heavy, empty out — set down old burdens and move lightly.', color: 'Yellow & Beige', place: 'home — your own familiar space', food: 'sweet grains and root vegetables', mind: 'You’re slowly growing solid. Even when shaken, your center is right there.' },
    ja: { recharge: '慣れた安定した環境で充電。規則的な日常が心を強くします。', nourish: '安定とルーティンを足して。決まった時間に寝て食べる習慣が軸を作ります。', release: '重くなりすぎたら手放して。溜めた荷を下ろし軽く動いて。', color: '黄·ベージュ', place: '家のような慣れた自分の空間', food: '甘味のある穀物·根菜', mind: 'ゆっくり固まっている途中。揺れても軸はそこにあります。' },
  },
  金: {
    ko: { recharge: '정리되고 깔끔한 공간에서 충전돼요. 군더더기를 덜어내면 마음이 맑아져요.', nourish: '정돈과 마무리를 더해 보세요. 공간을 정리하고 끊을 건 끊으면 가벼워져요.', release: '너무 날카로워졌다면 부드럽게 풀어 주세요. 완벽을 조금 내려놓고 여백을 둬요.', color: '흰색·금색', place: '깔끔하게 정돈된 조용한 방', food: '매운맛·흰 음식과 깨끗한 물', mind: '다 완벽하지 않아도 충분해요. 빈틈이 숨 쉬는 자리예요.' },
    en: { recharge: 'Tidy, clean spaces recharge you — clearing the clutter clears your mind.', nourish: 'Add order and closure. Tidy your space and cut what needs cutting to feel lighter.', release: 'When you’ve grown too sharp, soften — set down some perfectionism and leave white space.', color: 'White & Gold', place: 'a neat, quiet, tidy room', food: 'spicy or white foods and clean water', mind: 'You don’t have to be perfect to be enough. The gaps are where you breathe.' },
    ja: { recharge: '整った清潔な空間で充電。無駄を削ぐと心が澄みます。', nourish: '整頓と仕上げを足して。空間を片付け、断つべきは断つと軽くなります。', release: '鋭くなりすぎたら柔らかく。完璧主義を少し下ろし余白を持って。', color: '白·金', place: 'きれいに整った静かな部屋', food: '辛味·白い食べ物と清らかな水', mind: '完璧でなくても十分。隙間は呼吸する場所です。' },
  },
  水: {
    ko: { recharge: '조용함과 휴식으로 충전돼요. 혼자만의 시간에 기운이 차올라요.', nourish: '고요와 흐름을 더해 보세요. 물가 산책·목욕·충분한 잠이 마음을 적셔 줘요.', release: '생각이 너무 깊어졌다면 흘려보내세요. 몸을 움직여 가라앉은 기운을 돌려요.', color: '검정·파랑', place: '물가나 조용하고 어둑한 공간', food: '짠맛·국물 있는 음식과 충분한 물', mind: '멈춘 게 아니라 고이는 중이에요. 충분히 잠겨도 괜찮아요.' },
    en: { recharge: 'Quiet and rest recharge you — your energy rises in time alone.', nourish: 'Add stillness and flow. A walk by water, a bath, and enough sleep moisten your heart.', release: 'When thoughts run too deep, let them flow — move your body to circulate what’s settled.', color: 'Black & Blue', place: 'by water, or a quiet dim space', food: 'salty, brothy foods and plenty of water', mind: 'You haven’t stopped — you’re gathering. It’s okay to soak a while.' },
    ja: { recharge: '静けさと休息で充電。一人の時間に気が満ちます。', nourish: '静けさと流れを足して。水辺の散歩·入浴·十分な睡眠が心を潤します。', release: '考えが深くなりすぎたら流して。体を動かし沈んだ気を巡らせて。', color: '黒·青', place: '水辺や静かで薄暗い空間', food: '塩味·汁物と十分な水', mind: '止まったのではなく溜まっている途中。十分浸かっても大丈夫。' },
  },
};

export type HealingResult = {
  dayElem: Elem; weakElem: Elem; excessElem: Elem; hasExcess: boolean;
  emoji: string; dayLabel: string; weakLabel: string; excessLabel: string; hex: string;
  recharge: string; nourish: string; release: string; color: string; place: string; food: string; mind: string;
};

/**
 * 나만의 힐링 방법 — 명식 8글자(천간4·지지4)의 오행 분포에서 도출.
 * @param saju computeChart(input).saju (pillars 필요)
 * @returns 명식 없으면 null. 일간=충전 방식, 최소 오행=채움, 최대 오행=비움(3+일 때).
 */
export function healingMethod(saju: any): HealingResult | null {
  if (!saju?.pillars) return null;
  // 8글자 오행 카운트(천간·지지) — 분포로 부족/과다 판정
  const cnt: Record<Elem, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  (['년', '월', '일', '시'] as const).forEach((p) => {
    const d = saju.pillars[p];
    if (d) { cnt[stemElement(d.stem) as Elem]++; cnt[branchElement(d.branch) as Elem]++; }
  });
  const day = saju.pillars['일'];
  const dayElem = stemElement(day?.stem ?? '戊') as Elem;           // 일간 오행 = 나의 본질
  const sorted = (Object.entries(cnt) as [Elem, number][]).sort((a, b) => a[1] - b[1]);
  const weakElem = sorted[0][0];                                    // 가장 적은 오행 = 채움
  const excessElem = sorted[sorted.length - 1][0];                  // 가장 많은 오행 = 비움
  const hasExcess = sorted[sorted.length - 1][1] >= 3;              // 8글자 중 3+ = 뚜렷한 과다일 때만 노출

  const L = (appLang() as L) ?? 'ko';
  const dl = DATA[dayElem][L], wl = DATA[weakElem][L], el = DATA[excessElem][L];
  return {
    dayElem, weakElem, excessElem, hasExcess,
    emoji: HEAL_EMOJI[dayElem],
    dayLabel: ELEM_LABEL[dayElem][L], weakLabel: ELEM_LABEL[weakElem][L], excessLabel: ELEM_LABEL[excessElem][L],
    hex: elementColor[weakElem],
    recharge: dl.recharge,                       // 일간 오행 — 충전 방식
    nourish: wl.nourish, color: wl.color, place: wl.place, food: wl.food, // 부족 오행 — 채움(활동·색·공간·음식)
    release: el.release,                         // 과다 오행 — 비움
    mind: dl.mind,                               // 일간 오행 — 마음 한마디
  };
}
