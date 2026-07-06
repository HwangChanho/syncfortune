// app/src/lib/bokType.ts — '타고난 복(福) 유형' 판정(온디바이스·무료·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 가볍게 보기(secLight) 재미·공유. 사주 십신 분포(원국)에서 가장 강한 십신군 → 타고난 복.
//   stance(Claude 초안 — daniel 검수 슬롯): 재성=재복 / 인성=귀인복 / 식상=식복 / 관성=관복 / 비겁=인복.
//   §4: 강점 중심·전향적. 정통 진단 아닌 재미 매핑. 살리는 법(처방) 동반(가드5).
//
// ★B4(daniel 2026-07-06): 정/편·식/상 **분리** + **비겁 신강약 게이트**.
//   ① 정/편 분리: 각 십신군을 正/偏 두 갈래로(비견≠겁재·정재≠편재·식신≠상관·정관≠편관·정인≠편인).
//   ② 비겁 게이트: 비견=조력·동료복(순긍정) / 겁재=경쟁·탈재 리스크가 기본이나 —
//      **신약이면 겁재도 부조(扶助)** = 약한 나를 받쳐 주는 든든한 조력복으로 반전(scoreStrength verdict).
//      (사업가 careerGauge가 겁재에 파재 플래그 단 것과 동일 사상 — 신강일 때만 탈재 경계.)
//   선택은 **2단계**: ① 지배 십신군(5, 합계 — 기존과 동일·이미지 매핑 유지) → ② 군 내 正/偏 강한 쪽(동률·부재=正).
//   §4 웰빙: 겁재·상관·편관의 부정 뉘앙스는 '복' 프레임 안에서 전향적으로(강점+살리는 법).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod } from '@spec/chart';
import { analyzeTenGods, scoreStrength } from '@engine/structure'; // scoreStrength = 신강약 게이트(B4 겁재 부조 반전)
import { appLang } from '../i18n';

type G5 = '비겁' | '식상' | '재성' | '관성' | '인성';
type Pol = '정' | '편'; // 正=비견·식신·정재·정관·정인 / 偏=겁재·상관·편재·편관·편인.
const TO10: Record<TenGod, { g: G5; pol: Pol }> = {
  비견: { g: '비겁', pol: '정' }, 겁재: { g: '비겁', pol: '편' },
  식신: { g: '식상', pol: '정' }, 상관: { g: '식상', pol: '편' },
  정재: { g: '재성', pol: '정' }, 편재: { g: '재성', pol: '편' },
  정관: { g: '관성', pol: '정' }, 편관: { g: '관성', pol: '편' },
  정인: { g: '인성', pol: '정' }, 편인: { g: '인성', pol: '편' },
};

export type BokResult = { group: G5; emoji: string; bok: string; desc: string; how: string };

type Loc = { bok: string; desc: string; how: string };
type Variant = { emoji: string; ko: Loc; en: Loc; ja: Loc };
const DATA: Record<G5, Record<Pol, Variant>> = {
  재성: {
    정: { // 정재 — 성실히 모으는 안정적 재복
      emoji: '💰',
      ko: { bok: '재물복', desc: '성실하게 모으고 지키는 안정적인 재물복을 타고났어요. 꾸준함이 쌓여 노력한 만큼 손에 쥐는 힘이 있습니다.', how: '차곡차곡 모으되 베풀 줄도 알면 재물복이 더 크게 돌아와요.' },
      en: { bok: 'Wealth Fortune', desc: 'Born with a steady wealth fortune — diligent at saving and keeping, so effort turns into what you hold.', how: 'Save bit by bit but give too, and fortune returns greater.' },
      ja: { bok: '財運の福', desc: '堅実に貯め守る安定した財運。こつこつ積み重ね、努力した分だけ手にする力があります。', how: '着実に貯めつつ施すことも知れば、財運がより大きく巡ります。' },
    },
    편: { // 편재 — 큰 흐름·기회·확장의 재복. §4: 씀씀이/관리 처방
      emoji: '🎰',
      ko: { bok: '기회복(재물)', desc: '큰 흐름과 기회를 타는 스케일 있는 재물복을 타고났어요. 돈이 크게 오가는 판을 읽고 굴리는 감각이 남다릅니다.', how: '벌이는 만큼 관리도 함께하고, 통 큰 씀씀이를 조절하면 기회가 실속으로 남아요.' },
      en: { bok: 'Opportunity Fortune', desc: 'Born with a large-scale wealth fortune that rides big flows and chances — a rare feel for reading and moving money.', how: 'Manage as much as you make, and rein in big spending — then opportunity becomes real gain.' },
      ja: { bok: '機会の福（財）', desc: '大きな流れとチャンスに乗るスケールある財運。お金が大きく動く場を読み回す感覚に優れます。', how: '稼ぐぶん管理も一緒に、大きな出費を調整すれば、機会が実利として残ります。' },
    },
  },
  인성: {
    정: { // 정인 — 정통 학문·문서·귀인(기존 인성 유지)
      emoji: '📚',
      ko: { bok: '귀인복', desc: '도와주는 사람과 배움의 복을 타고났어요. 곁에 늘 든든한 어른·스승·후원자가 있고, 문서·자격운도 좋습니다.', how: '배움을 이어 가고 인연을 소중히 하면 귀인이 더 많이 따라요.' },
      en: { bok: 'Mentor Fortune', desc: 'Blessed with helpers and learning — steady elders, teachers, and patrons by your side, with luck in documents and credentials.', how: 'Keep learning and cherish your ties, and more mentors appear.' },
      ja: { bok: '貴人の福', desc: '助けてくれる人と学びの福。頼れる年長者・師・後援者が常にそばにおり、文書・資格運も良好。', how: '学びを続け縁を大切にすれば貴人がより多く付きます。' },
    },
    편: { // 편인 — 남다른 전문성·직관·기예의 복
      emoji: '🔮',
      ko: { bok: '재주복(전문)', desc: '남다른 직관과 전문 기예의 복을 타고났어요. 한 분야를 깊이 파고드는 몰입과 통찰이 큰 자산입니다.', how: '몰입할 분야 하나를 정해 깊이 파면, 그 남다름이 든든한 복이 돼요.' },
      en: { bok: 'Craft Fortune', desc: 'Born with a fortune of rare intuition and specialized craft — deep immersion and insight in a field are your great asset.', how: 'Pick one field to dive deep into, and that distinctiveness becomes a solid fortune.' },
      ja: { bok: '才の福（専門）', desc: '人と違う直感と専門技芸の福。一つの分野を深く掘る没入と洞察が大きな財産です。', how: '没入する分野を一つ定めて深く掘れば、その独自性が頼もしい福になります。' },
    },
  },
  식상: {
    정: { // 식신 — 먹을 복·여유(기존 식상 유지)
      emoji: '🍀',
      ko: { bok: '식복(여유복)', desc: '먹을 복과 여유의 복을 타고났어요. 재능과 즐길 거리가 풍부해, 어디서든 굶지 않고 인생을 즐길 줄 압니다.', how: '재능을 나누고 표현할수록 즐거움과 복이 함께 커져요.' },
      en: { bok: 'Bounty Fortune', desc: 'Born with comfort and plenty — rich in talent and joys, you know how to enjoy life and never go hungry.', how: 'Share and express your gifts, and joy and fortune grow together.' },
      ja: { bok: '食の福（余裕の福）', desc: '食べる福と余裕の福。才能と楽しみが豊かで、どこでも食いはぐれず人生を楽しめます。', how: '才能を分かち表すほど、楽しみと福が共に大きくなります。' },
    },
    편: { // 상관 — 톡톡 튀는 재주·표현·인기의 복. §4: 갈고닦아 결과로
      emoji: '🎨',
      ko: { bok: '재능복(표현)', desc: '톡톡 튀는 재주와 표현의 복을 타고났어요. 남을 즐겁게 하고 시선을 끄는 끼가 어디서든 기회를 만듭니다.', how: '재능을 갈고닦아 결과로 보여 주면, 그 반짝임이 실속 있는 복으로 이어져요.' },
      en: { bok: 'Talent Fortune', desc: 'Born with a fortune of sparkling talent and expression — the flair to delight others and draw eyes makes chances anywhere.', how: 'Polish your gift and show it in results, and that sparkle turns into real fortune.' },
      ja: { bok: '才能の福（表現）', desc: 'きらめく才と表現の福。人を楽しませ視線を集めるセンスが、どこでも機会を作ります。', how: '才能を磨き結果で見せれば、その輝きが実のある福につながります。' },
    },
  },
  관성: {
    정: { // 정관 — 이름·자리·명예(기존 관성 유지)
      emoji: '🎖️',
      ko: { bok: '관복(명예복)', desc: '이름과 자리의 복을 타고났어요. 책임을 맡으면 빛나고, 인정받아 높은 자리에 오르는 힘이 있습니다.', how: '맡은 책임을 묵묵히 다하면 자리와 명예가 따라와요.' },
      en: { bok: 'Honor Fortune', desc: 'Born for name and position — you shine when given responsibility and rise to be recognized.', how: 'Quietly fulfill your duties, and rank and honor follow.' },
      ja: { bok: '官の福（名誉の福）', desc: '名と地位の福。責任を担うと輝き、認められて高い地位に上る力があります。', how: '担った責任を黙々と果たせば、地位と名誉が付いてきます。' },
    },
    편: { // 편관 — 위기·경쟁을 뚫는 돌파·권위의 복. §4: 압박을 성장동력으로
      emoji: '⚔️',
      ko: { bok: '돌파복(권위)', desc: '위기와 경쟁을 정면으로 뚫는 돌파의 복을 타고났어요. 압박이 큰 자리일수록 오히려 존재감이 빛납니다.', how: '밀려오는 압박을 성장의 동력으로 삼으면, 남들이 못 넘는 고비에서 복이 열려요.' },
      en: { bok: 'Breakthrough Fortune', desc: 'Born with a fortune for breaking through crisis and rivalry head-on — the higher the pressure, the more your presence shines.', how: 'Turn incoming pressure into growth, and fortune opens at the hurdles others can’t clear.' },
      ja: { bok: '突破の福（権威）', desc: '危機と競争を正面から突き抜ける突破の福。プレッシャーの大きい場ほど存在感が輝きます。', how: '押し寄せる圧を成長の力に変えれば、人が越えられない山場で福が開きます。' },
    },
  },
  비겁: {
    정: { // 비견 — 사람·동료복(순긍정)
      emoji: '🤝',
      ko: { bok: '인복(사람복)', desc: '사람과 동료의 복을 타고났어요. 힘들 때 함께해 줄 이들이 곁에 있고, 의리로 뭉친 내 편이 큰 자산입니다.', how: '의리를 지키고 먼저 손 내밀면 사람복이 더 두터워져요.' },
      en: { bok: 'People Fortune', desc: 'Blessed with friends and allies — people stand by you in hard times, and your loyal circle is a great asset.', how: 'Keep your word and reach out first, and your circle grows stronger.' },
      ja: { bok: '人の福（人脈の福）', desc: '人と仲間の福。辛い時に共にいてくれる人がそばにおり、義理で結ばれた味方が大きな財産です。', how: '義理を守り先に手を差し伸べれば、人の福がより厚くなります。' },
    },
    편: { // 겁재(기본=신강·중화) — 경쟁 속에서 크는 승부·추진복. §4: 나눔으로 탈재 방지
      emoji: '🏇',
      ko: { bok: '승부복(추진복)', desc: '경쟁 속에서 크는 승부의 복을 타고났어요. 지지 않으려는 근성과 추진력이 큰일을 밀고 나가는 힘이 됩니다.', how: '함께 나누고 손잡을수록 경쟁이 협력이 되어, 새어 나갈 복을 오래가는 복으로 지켜요.' },
      en: { bok: 'Contender Fortune', desc: 'Born with a fortune that grows through rivalry — the grit not to lose and your drive push big things forward.', how: 'The more you share and team up, rivalry becomes cooperation — keeping fortune that would leak into fortune that lasts.' },
      ja: { bok: '勝負の福（推進）', desc: '競争の中で伸びる勝負の福。負けまいとする根性と推進力が大きな事を押し進める力に。', how: '分かち合い手を組むほど競争が協力になり、漏れる福を長く続く福として守れます。' },
    },
  },
};

// ★B4 신강약 게이트: 겁재(비겁 偏)라도 **신약이면 탈재가 아니라 부조(扶助)** = 든든한 조력복으로 반전.
//   신강·중화일 때만 위 '승부복(+나눔 처방)'을 쓰고, 신약일 때 이 조력복으로 교체(scoreStrength verdict 소비).
const GEOBJAE_WEAK: Variant = {
  emoji: '🤲',
  ko: { bok: '조력복(든든한 내 편)', desc: '나를 받쳐 주는 든든한 조력의 복을 타고났어요. 혼자 버겁던 일도 함께 밀어 주는 사람들이 있어, 힘을 얻고 다시 일어서는 저력이 있습니다.', how: '기대는 걸 미안해 말고 손을 맞잡으세요 — 함께할수록 약한 데가 채워져 복이 커져요.' },
  en: { bok: 'Support Fortune', desc: 'Born with a fortune of solid support — even what felt too heavy alone gets pushed along by people beside you, giving you the resilience to rise again.', how: 'Don’t feel bad leaning on others — join hands, and what’s weak gets filled, so fortune grows.' },
  ja: { bok: '助力の福（頼れる味方）', desc: '自分を支えてくれる頼もしい助力の福。一人では手に余ることも共に押してくれる人がいて、力を得て立ち直る底力があります。', how: '頼るのを申し訳なく思わず手を取り合って——共にいるほど弱さが埋まり、福が大きくなります。' },
};

/**
 * 사주(원국) 십신 분포 → 타고난 복(2단계 + 신강약 게이트). 동률이면 우선순위(재>관>인>식상>비겁).
 *  1단계: 지배 십신군(5, 합계) — 기존과 동일. 2단계: 군 내 正/偏 강한 쪽(동률·부재=正).
 *  ★게이트(B4): 겁재(비겁 偏)이고 **신약**이면 조력복(부조)으로 반전. 신강·중화는 승부복(+나눔 처방).
 */
export function bokType(saju: SajuChart): BokResult {
  const { detail } = analyzeTenGods(saju);
  const g5: Record<G5, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
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
  const PRIORITY: G5[] = ['재성', '관성', '인성', '식상', '비겁'];
  let top: G5 = '재성', max = -1;
  for (const g of PRIORITY) if (g5[g] > max) { max = g5[g]; top = g; }
  const p: Pol = pol[top].편 > pol[top].정 ? '편' : '정';
  // ★게이트: 겁재(비겁 偏) + 신약 → 조력복(부조 반전). 그 외는 표준 DATA.
  const weak = scoreStrength(saju).verdict === '신약';
  const v: Variant = (top === '비겁' && p === '편' && weak) ? GEOBJAE_WEAK : DATA[top][p];
  const lang = appLang() as 'ko' | 'en' | 'ja';
  const loc = v[lang] ?? v.ko;
  return { group: top, emoji: v.emoji, bok: loc.bok, desc: loc.desc, how: loc.how };
}
