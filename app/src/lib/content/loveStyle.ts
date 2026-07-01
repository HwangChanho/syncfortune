// app/src/lib/loveStyle.ts — '연애 스타일(연애 세포)' 판정(온디바이스·무료·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 가볍게 보기(secLight) 재미·공유. 사주 십신 분포(원국)에서 가장 강한 십신군 → 연애 유형.
//   stance(Claude 초안 — daniel 검수 슬롯): 비겁=주도·직진 / 식상=표현·끼 / 재성=적극·대시 / 관성=헌신·진심 / 인성=배려·순정.
//   §4: 강점 중심·전향적(우열 없음). 정통 진단 아닌 재미 매핑.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod } from '@spec/chart';
import { analyzeTenGods } from '@engine/structure';
import { appLang } from '../i18n';

type G5 = '비겁' | '식상' | '재성' | '관성' | '인성';
// 십신 10 → 5군
const TO5: Record<string, G5> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성', 정인: '인성', 편인: '인성',
};

export type LoveStyleResult = { group: G5; emoji: string; style: string; desc: string; inLove: string; tip: string };

type Loc = { style: string; desc: string; inLove: string; tip: string };
const DATA: Record<G5, { emoji: string; ko: Loc; en: Loc; ja: Loc }> = {
  비겁: {
    emoji: '🔥',
    ko: { style: '주도하는 직진러', desc: '자존심이 강하고 관계를 끌고 가는 연애. 좋아하면 망설임 없이 직진하고, 내 사람은 확실히 챙긴다.', inLove: '주도권을 쥐고 리드하는 편. 지는 걸 싫어해 가끔 기싸움이 나기도.', tip: '상대의 속도도 존중하면 더 오래가는 사이가 돼요.' },
    en: { style: 'The Bold Go-Getter', desc: 'Proud and leads the relationship — when you like someone, you go straight for it and protect your own.', inLove: 'You take the lead; hating to lose can spark little power struggles.', tip: 'Honor your partner’s pace too, and it lasts longer.' },
    ja: { style: '主導する直進タイプ', desc: 'プライドが強く関係を引っ張る恋愛。好きになれば迷わず直進し、自分の人は確実に守る。', inLove: '主導権を握ってリード。負けず嫌いで時に張り合いも。', tip: '相手のペースも尊重すると長続きします。' },
  },
  식상: {
    emoji: '🎤',
    ko: { style: '표현하는 끼쟁이', desc: '애정을 아낌없이 표현하는 다정한 연애. 재치 있고 즐거워서 함께 있으면 웃음이 끊이지 않는다.', inLove: '말과 이벤트로 사랑을 확인시켜 주는 타입. 끼가 많아 인기도 많다.', tip: '한 사람에게 마음을 모으면 신뢰가 더 깊어져요.' },
    en: { style: 'The Expressive Charmer', desc: 'Loves out loud — witty and fun, never a dull moment together.', inLove: 'Shows love through words and surprises; charming and popular.', tip: 'Focus your heart on one, and trust deepens.' },
    ja: { style: '表現するチャーマー', desc: '愛情を惜しみなく表す優しい恋愛。機知に富み一緒にいて楽しい。', inLove: '言葉やイベントで愛を伝えるタイプ。魅力的で人気も。', tip: '一人に心を注ぐと信頼が深まります。' },
  },
  재성: {
    emoji: '💘',
    ko: { style: '적극적인 대시러', desc: '좋아하면 적극적으로 다가가는 연애. 현실 감각도 좋아 데이트도 센스 있게 챙긴다.', inLove: '먼저 대시하고 분위기를 즐겁게 리드. 밀당보다 솔직한 직진형.', tip: '조급함을 조금 덜면 여유로운 매력이 더 살아나요.' },
    en: { style: 'The Active Pursuer', desc: 'Goes after who you like, with a practical touch — dates are well planned.', inLove: 'Makes the first move and keeps things fun; straightforward over mind games.', tip: 'Ease the rush and your relaxed charm shines more.' },
    ja: { style: '積極的なアプローチ派', desc: '好きになれば積極的に近づく恋愛。現実感覚も良くデートも上手。', inLove: '自分からアプローチし楽しくリード。駆け引きより正直な直進型。', tip: '焦りを少し減らすと余裕ある魅力が増します。' },
  },
  관성: {
    emoji: '🤍',
    ko: { style: '헌신하는 진심파', desc: '책임감 있게 진심을 다하는 연애. 한번 마음을 주면 쉽게 변치 않는 든든함이 있다.', inLove: '약속과 신의를 중시하고 안정적. 표현은 서툴러도 마음은 진심.', tip: '마음을 말로도 표현해 주면 오해가 줄어들어요.' },
    en: { style: 'The Devoted Sincere', desc: 'Responsible and gives your whole heart — steadfast once committed.', inLove: 'Values promises and loyalty; steady, sincere even if not expressive.', tip: 'Put feelings into words too, and misunderstandings fade.' },
    ja: { style: '献身的な誠実派', desc: '責任感を持って真心を尽くす恋愛。一度心を許すと変わらない頼もしさ。', inLove: '約束と信義を重んじ安定的。表現は苦手でも心は本物。', tip: '気持ちを言葉でも伝えると誤解が減ります。' },
  },
  인성: {
    emoji: '🌿',
    ko: { style: '배려하는 순정파', desc: '배려 깊고 잔잔한 연애. 상대를 보듬고 이해하는 따뜻함이 큰 매력.', inLove: '받아주고 이해해 주는 헌신형. 먼저 다가가는 건 조금 서툴다.', tip: '가끔은 먼저 마음을 표현하면 관계가 한층 깊어져요.' },
    en: { style: 'The Caring Romantic', desc: 'Considerate and calm — your warmth in embracing and understanding is the charm.', inLove: 'Accepting and devoted; a bit shy to make the first move.', tip: 'Reach out first sometimes, and the bond grows deeper.' },
    ja: { style: '思いやりの純情派', desc: '思いやり深く穏やかな恋愛。相手を包み理解する温かさが魅力。', inLove: '受け入れ理解する献身型。自分から近づくのは少し苦手。', tip: '時には先に気持ちを伝えると関係が深まります。' },
  },
};

/** 사주(원국) 십신 분포에서 가장 강한 십신군 → 연애 스타일. 동률이면 우선순위(관>재>식상>인>비겁). */
export function loveStyle(saju: SajuChart): LoveStyleResult {
  const { detail } = analyzeTenGods(saju);
  const g5: Record<G5, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const [k, n] of Object.entries(detail)) if ((n as number) > 0) g5[TO5[k as TenGod]] += n as number;
  const PRIORITY: G5[] = ['관성', '재성', '식상', '인성', '비겁'];
  let top: G5 = '재성', max = -1;
  for (const g of PRIORITY) if (g5[g] > max) { max = g5[g]; top = g; }
  const d = DATA[top];
  const lang = appLang() as 'ko' | 'en' | 'ja';
  const loc = d[lang] ?? d.ko;
  return { group: top, emoji: d.emoji, style: loc.style, desc: loc.desc, inLove: loc.inLove, tip: loc.tip };
}
