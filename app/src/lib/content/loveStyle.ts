// app/src/lib/loveStyle.ts — '연애 스타일(연애 세포)' 판정(온디바이스·무료·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 가볍게 보기(secLight) 재미·공유. 사주 십신 분포(원국)에서 가장 강한 십신군 → 연애 유형.
//   stance(Claude 초안 — daniel 검수 슬롯): 비겁=주도·직진 / 식상=표현·끼 / 재성=적극·대시 / 관성=관계 / 인성=배려.
//   §4: 강점 중심·전향적(우열 없음). 정통 진단 아닌 재미 매핑.
//
// ★B3(daniel 2026-07-06): 정/편·식/상 **분리**. 기존 5-lump 는 관성=“헌신·진심”으로 뭉개
//   *칠살(편관)*까지 “헌신”으로 오표기했다(여성 배우자성 해석 체감오류 직결 → 우선수정).
//   → 이제 각 십신군을 **正/偏 두 갈래**로 나눠 서술한다:
//     · 관성: 정관=헌신·책임·정식 관계 / 편관(칠살)=강렬·긴장·끌림(통제·집착은 완충).
//     · 비겁: 비견=든든한 직진 / 겁재=승부욕·경쟁심.  · 식상: 식신=다정한 표현 / 상관=톡톡 튀는 끼.
//     · 재성: 정재=성실한 챙김 / 편재=스케일 큰 대시.  · 인성: 정인=배려·순정 / 편인=독특한 감성.
//   선택은 **2단계**: ① 지배 십신군(5, 합계 — 기존과 동일해 견고·이미지 매핑 유지) →
//                    ② 그 군 안에서 正/偏 중 강한 쪽(동률·부재는 正=순한 기본값).
//   ⚠️ 성별 반대의미(여성의 관성=배우자성 등)는 SajuChart에 성별이 없어 여기선 성별 무관 서술 —
//      성별 종속 뉘앙스는 daniel 검수 슬롯. 핵심 수정(편관≠헌신)은 극성 기반이라 성별 없이도 해소.
//   §4 웰빙: 겁재·상관·편관의 부정 뉘앙스(경쟁·구설·집착)는 전향적으로 완충(강점+처방 tip).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod } from '@spec/chart';
import { analyzeTenGods } from '@engine/structure';
import { appLang } from '../i18n';

type G5 = '비겁' | '식상' | '재성' | '관성' | '인성';
type Pol = '정' | '편'; // 正(안정·정형) / 偏(비정형·강렬). 비겁은 비견=正·겁재=偏로 매핑(동일氣 vs 탈재 경쟁).
// 십신 10 → (5군, 극성). 正=비견·식신·정재·정관·정인 / 偏=겁재·상관·편재·편관·편인.
const TO10: Record<TenGod, { g: G5; pol: Pol }> = {
  비견: { g: '비겁', pol: '정' }, 겁재: { g: '비겁', pol: '편' },
  식신: { g: '식상', pol: '정' }, 상관: { g: '식상', pol: '편' },
  정재: { g: '재성', pol: '정' }, 편재: { g: '재성', pol: '편' },
  정관: { g: '관성', pol: '정' }, 편관: { g: '관성', pol: '편' },
  정인: { g: '인성', pol: '정' }, 편인: { g: '인성', pol: '편' },
};

export type LoveStyleResult = { group: G5; emoji: string; style: string; desc: string; inLove: string; tip: string };

type Loc = { style: string; desc: string; inLove: string; tip: string };
type Variant = { emoji: string; ko: Loc; en: Loc; ja: Loc };
// DATA[군][正/偏] — 정/편 두 갈래로 완전 분리(B3). group 키는 5군 유지(이미지 매핑·결과 호환).
const DATA: Record<G5, Record<Pol, Variant>> = {
  비겁: {
    정: { // 비견 — 든든한 직진(동료 같은 편안함)
      emoji: '🔥',
      ko: { style: '주도하는 직진러', desc: '자존심이 강하고 관계를 끌고 가는 연애. 좋아하면 망설임 없이 직진하고, 내 사람은 확실히 챙깁니다.', inLove: '주도권을 쥐고 리드하는 편. 친구처럼 편안하면서도 내 편은 끝까지 지켜줘요.', tip: '상대의 속도도 존중하면 더 오래가는 사이가 돼요.' },
      en: { style: 'The Bold Go-Getter', desc: 'Proud and leads the relationship — when you like someone, you go straight for it and protect your own.', inLove: 'You take the lead, easy like a friend, yet you have your partner’s back to the end.', tip: 'Honor your partner’s pace too, and it lasts longer.' },
      ja: { style: '主導する直進タイプ', desc: 'プライドが強く関係を引っ張る恋愛。好きになれば迷わず直進し、自分の人は確実に守る。', inLove: '主導権を握ってリード。友達のように気楽で、味方は最後まで守ります。', tip: '相手のペースも尊重すると長続きします。' },
    },
    편: { // 겁재 — 승부욕·경쟁심(강한 추진). §4: 경쟁심을 매력으로 전향, 져주는 여유 처방
      emoji: '⚡',
      ko: { style: '승부욕 있는 리드러', desc: '지고는 못 사는 승부욕이 매력인 연애. 밀어붙이는 추진력이 강해, 원하는 사람에게는 물러섬 없이 다가갑니다.', inLove: '기싸움도 은근 즐기는 열정파. 승부욕이 관계에선 서로를 향한 몰입으로 나타나요.', tip: '가끔은 먼저 져 주는 여유가 오히려 상대의 마음을 크게 열어 줘요.' },
      en: { style: 'The Spirited Leader', desc: 'A love where your can’t-lose drive is the charm — you push forward and approach the one you want without backing off.', inLove: 'A passionate type who half-enjoys the tug-of-war; that drive shows up as devotion to each other.', tip: 'Letting them win now and then opens their heart even wider.' },
      ja: { style: '負けん気のリードタイプ', desc: '負けず嫌いが魅力の恋愛。押し出す推進力が強く、望む人には引かずに近づきます。', inLove: '張り合いもどこか楽しむ情熱派。負けん気は関係では互いへの没入として現れます。', tip: '時々あえて譲る余裕が、かえって相手の心を大きく開きます。' },
    },
  },
  식상: {
    정: { // 식신 — 다정한 표현(꾸준·따뜻)
      emoji: '🎤',
      ko: { style: '다정한 표현가', desc: '애정을 아낌없이 꾸준히 표현하는 따뜻한 연애. 편안하고 즐거워서 함께 있으면 마음이 놓입니다.', inLove: '말과 챙김으로 사랑을 자주 확인시켜 주는 타입. 은은하게 오래가는 다정함이 강점이에요.', tip: '표현이 익숙한 만큼, 가끔 상대의 말도 가만히 들어 주면 더 깊어져요.' },
      en: { style: 'The Warm Expresser', desc: 'A warm love that shows affection freely and steadily — easygoing and pleasant, you feel at ease together.', inLove: 'Reassures with words and small care; your quiet, lasting warmth is the strength.', tip: 'You express easily — so listen quietly sometimes too, and it deepens.' },
      ja: { style: '優しい表現者', desc: '愛情を惜しみなく、こまめに表す温かい恋愛。気楽で楽しく、一緒にいると心が落ち着く。', inLove: '言葉と気遣いで愛をよく伝えるタイプ。じんわり長く続く優しさが強み。', tip: '表現が得意なぶん、時々相手の話も静かに聞くと深まります。' },
    },
    편: { // 상관 — 톡톡 튀는 끼(재치·인기). §4: 구설 대신 '한 사람 집중'으로 전향
      emoji: '✨',
      ko: { style: '톡톡 튀는 매력파', desc: '재치와 끼가 반짝이는 자유로운 연애. 함께 있으면 웃음이 끊이지 않고, 어디서든 시선을 끄는 매력이 있어요.', inLove: '이벤트와 재치로 분위기를 이끄는 타입. 끼가 많아 인기도 많은 편이에요.', tip: '한 사람에게 마음을 모으면 그 매력이 신뢰로 바뀌어 더 깊어져요.' },
      en: { style: 'The Sparkling Charmer', desc: 'A free-spirited love where wit and flair sparkle — never a dull moment, and you draw eyes anywhere.', inLove: 'Leads the mood with surprises and wit; charming and popular.', tip: 'Focus your heart on one, and that charm turns into trust.' },
      ja: { style: 'きらめくチャーマー', desc: '機知とセンスが光る自由な恋愛。一緒にいると笑いが絶えず、どこでも視線を集める魅力。', inLove: 'イベントと機知で場をリードするタイプ。魅力的で人気も。', tip: '一人に心を注ぐと、その魅力が信頼に変わって深まります。' },
    },
  },
  재성: {
    정: { // 정재 — 성실한 챙김(안정·현실감각)
      emoji: '💝',
      ko: { style: '성실한 챙김러', desc: '꾸준하고 성실하게 챙기는 안정적인 연애. 현실 감각이 좋아 상대를 실질적으로 살뜰히 돌봅니다.', inLove: '작은 것도 세심하게 챙기며 신뢰를 쌓는 타입. 화려하기보다 든든해요.', tip: '가끔은 계획을 벗어난 깜짝 이벤트가 관계에 설렘을 더해 줘요.' },
      en: { style: 'The Steady Caretaker', desc: 'A stable love that cares diligently and steadily — with a practical touch, you look after your partner in real ways.', inLove: 'Builds trust by tending to the small things; dependable over flashy.', tip: 'An off-plan surprise now and then adds a spark to the bond.' },
      ja: { style: '誠実な世話やき', desc: 'こまめに誠実に尽くす安定した恋愛。現実感覚が良く、相手を実質的に細やかに世話します。', inLove: '小さなことも丁寧に気遣い信頼を積むタイプ。派手より頼もしい。', tip: '時々は計画外のサプライズが関係にときめきを足します。' },
    },
    편: { // 편재 — 스케일 큰 대시(통 큰·밀당). §4: 조급함 완충
      emoji: '💘',
      ko: { style: '스케일 큰 대시러', desc: '좋아하면 통 크게 다가가는 화끈한 연애. 감각 있게 분위기를 만들고 이벤트도 시원시원하게 챙깁니다.', inLove: '먼저 대시하고 분위기를 즐겁게 리드. 밀당도 여유롭게 즐기는 편이에요.', tip: '조급함을 조금 덜고 한 곳에 마음을 모으면 여유로운 매력이 더 살아나요.' },
      en: { style: 'The Big-Hearted Pursuer', desc: 'A bold love that goes after who you like in a big way — you set the mood with flair and handle dates generously.', inLove: 'Makes the first move and leads the fun; enjoys a little push-and-pull with ease.', tip: 'Ease the rush and gather your heart in one place — your relaxed charm shines more.' },
      ja: { style: 'スケールの大きいアプローチ派', desc: '好きになれば大胆に近づく熱い恋愛。センスよく雰囲気を作り、イベントも気前よく。', inLove: '自分からアプローチし楽しくリード。駆け引きも余裕で楽しむ。', tip: '焦りを少し減らし一つに心を注ぐと、余裕ある魅力が増します。' },
    },
  },
  관성: {
    정: { // 정관 — 헌신·책임·정식 관계(기존 관성 유지)
      emoji: '🤍',
      ko: { style: '헌신하는 진심파', desc: '책임감 있게 진심을 다하는 연애. 한번 마음을 주면 쉽게 변치 않는 든든함이 있습니다.', inLove: '약속과 신의를 중시하고 안정적. 표현은 서툴러도 마음은 진심이에요.', tip: '마음을 말로도 표현해 주면 오해가 줄어들어요.' },
      en: { style: 'The Devoted Sincere', desc: 'Responsible and gives your whole heart — steadfast once committed.', inLove: 'Values promises and loyalty; steady, sincere even if not expressive.', tip: 'Put feelings into words too, and misunderstandings fade.' },
      ja: { style: '献身的な誠実派', desc: '責任感を持って真心を尽くす恋愛。一度心を許すと変わらない頼もしさ。', inLove: '約束と信義を重んじ安定的。表現は苦手でも心は本物。', tip: '気持ちを言葉でも伝えると誤解が減ります。' },
    },
    편: { // 편관(칠살) — 강렬·긴장·끌림. ★B3 핵심 수정: '헌신' 오표기 제거. §4: 통제·집착은 완충
      emoji: '❤️‍🔥',
      ko: { style: '강렬한 끌림파', desc: '뜨겁고 강렬한, 긴장감이 매력이 되는 연애. 한번 빠지면 깊이 몰입하고, 밀도 높은 사랑을 합니다.', inLove: '끌림이 강해 관계에 몰입도가 높은 타입. 그 강렬함이 상대에게는 짜릿한 매력이 돼요.', tip: '통제하려 하기보다 믿고 여백을 주면, 그 강렬함이 오래가는 깊이로 바뀌어요.' },
      en: { style: 'The Intense Attraction', desc: 'A hot, intense love where the tension itself becomes the charm — once you fall, you dive in deep and love densely.', inLove: 'A type with strong pull and high immersion; that intensity reads as a thrilling charm.', tip: 'Trust and give some space rather than control, and the intensity turns into lasting depth.' },
      ja: { style: '強烈な惹かれ合い', desc: '熱く強烈で、緊張感が魅力になる恋愛。一度はまると深く没入し、密度の高い愛をします。', inLove: '惹かれる力が強く没入度が高いタイプ。その強烈さが相手にはスリリングな魅力に。', tip: '支配しようとせず信じて余白を与えると、強烈さが長く続く深さに変わります。' },
    },
  },
  인성: {
    정: { // 정인 — 배려·순정(기존 인성 유지)
      emoji: '🌿',
      ko: { style: '배려하는 순정파', desc: '배려 깊고 잔잔한 연애. 상대를 보듬고 이해하는 따뜻함이 큰 매력.', inLove: '받아주고 이해해 주는 헌신형. 먼저 다가가는 건 조금 서툴러요.', tip: '가끔은 먼저 마음을 표현하면 관계가 한층 깊어져요.' },
      en: { style: 'The Caring Romantic', desc: 'Considerate and calm — your warmth in embracing and understanding is the charm.', inLove: 'Accepting and devoted; a bit shy to make the first move.', tip: 'Reach out first sometimes, and the bond grows deeper.' },
      ja: { style: '思いやりの純情派', desc: '思いやり深く穏やかな恋愛。相手を包み理解する温かさが魅力。', inLove: '受け入れ理解する献身型。自分から近づくのは少し苦手。', tip: '時には先に気持ちを伝えると関係が深まります。' },
    },
    편: { // 편인 — 독특한 감성·깊은 몰입(남다른 결)
      emoji: '🌙',
      ko: { style: '독특한 감성파', desc: '남다른 감성과 깊은 몰입이 매력인 연애. 흔한 방식보다 나만의 결로 사람을 아끼는 은근한 매력이 있어요.', inLove: '섬세하고 사려 깊게, 상대의 미묘한 마음까지 읽어 주는 타입. 표현은 은근하지만 깊어요.', tip: '느끼는 것을 조금 더 자주 말로 꺼내면 오해 없이 마음이 잘 전해져요.' },
      en: { style: 'The Unique Soul', desc: 'A love charmed by a distinctive sensibility and deep immersion — you cherish people your own way, with a quiet magnetism.', inLove: 'Delicate and thoughtful, reading even subtle feelings; expression is understated but deep.', tip: 'Voice what you feel a little more often, and your heart comes through without misunderstanding.' },
      ja: { style: '独特な感性派', desc: '人と違う感性と深い没入が魅力の恋愛。ありふれた形より自分の流儀で人を大切にする、じんわりした魅力。', inLove: '繊細で思慮深く、相手の微妙な心まで読むタイプ。表現は控えめでも深い。', tip: '感じたことをもう少し言葉に出すと、誤解なく心が伝わります。' },
    },
  },
};

/**
 * 사주(원국) 십신 분포 → 연애 스타일(2단계). 동률이면 우선순위(관>재>식상>인>비겁).
 *  1단계: 지배 십신군(5, 합계) — 기존과 동일(결과·이미지 매핑 견고).
 *  2단계: 그 군 안에서 正/偏 중 강한 쪽 → 연애 결을 分離(B3: 편관≠정관 등). 동률·부재는 正(순한 기본값).
 */
export function loveStyle(saju: SajuChart): LoveStyleResult {
  const { detail } = analyzeTenGods(saju);
  const g5: Record<G5, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  // 군별 正/偏 세부 합 — 2단계 극성 판정용
  const pol: Record<G5, { 정: number; 편: number }> = {
    비겁: { 정: 0, 편: 0 }, 식상: { 정: 0, 편: 0 }, 재성: { 정: 0, 편: 0 }, 관성: { 정: 0, 편: 0 }, 인성: { 정: 0, 편: 0 },
  };
  for (const [k, n] of Object.entries(detail)) {
    if (!((n as number) > 0)) continue;
    const m = TO10[k as TenGod];
    if (!m) continue;
    g5[m.g] += n as number;
    pol[m.g][m.pol] += n as number;
  }
  // 1단계: 지배 군
  const PRIORITY: G5[] = ['관성', '재성', '식상', '인성', '비겁'];
  let top: G5 = '재성', max = -1;
  for (const g of PRIORITY) if (g5[g] > max) { max = g5[g]; top = g; }
  // 2단계: 군 내 正/偏 — 偏이 더 강할 때만 偏, 동률·부재는 正(순한 기본값)
  const p: Pol = pol[top].편 > pol[top].정 ? '편' : '정';
  const v = DATA[top][p];
  const lang = appLang() as 'ko' | 'en' | 'ja';
  const loc = v[lang] ?? v.ko;
  return { group: top, emoji: v.emoji, style: loc.style, desc: loc.desc, inLove: loc.inLove, tip: loc.tip };
}
