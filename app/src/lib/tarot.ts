// app/src/lib/tarot.ts — 타로 78장(Rider-Waite-Smith) + 카테고리·켈틱크로스 스프레드 (무료, 룰·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 이미지 = RWS 1909 덱(퍼블릭 도메인, metabismuth/tarot-json) assets/tarot/*.jpg.
// 카드명·키워드(정/역)는 RWS 표준 의미를 한국어로(타로 공지식). LLM·서버 0 — 온디바이스 룰.
// 스프레드: 카테고리(질문 주제) 선택 → 켈틱크로스 10장(중복 없이 뽑고 정/역 랜덤).
//   ⚠️ require 는 RN 정적 번들이라 78개를 명시(동적 require 불가). 카드 추가 시 IMG·DECK 동기.
// ─────────────────────────────────────────────────────────────────────────

export type Suit = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
export type TarotCard = {
  id: string;        // 이미지 키(m00, c01 …)
  name: string;      // 영어명(국제 표준)
  ko: string;        // 한국어명
  suit: Suit;
  up: string;        // 정방향 키워드
  rev: string;       // 역방향 키워드
};

// 수트 메타 — 한글명·원소·색(미드나잇 테마 카드 띠 색)
export const SUIT_META: Record<Suit, { ko: string; element: string; color: string }> = {
  major:     { ko: '메이저', element: '—', color: '#C9A14A' },   // 골드
  wands:     { ko: '완드',   element: '火', color: '#C0392B' },   // 불
  cups:      { ko: '컵',     element: '水', color: '#3A6EA5' },   // 물
  swords:    { ko: '검',     element: '風', color: '#7A8AA0' },   // 바람
  pentacles: { ko: '펜타클', element: '土', color: '#3E8E5A' },   // 흙
};

// 이미지 정적 require (RN 번들). id → 모듈
const IMG: Record<string, any> = {
  m00: require('../../assets/tarot/m00.jpg'), m01: require('../../assets/tarot/m01.jpg'), m02: require('../../assets/tarot/m02.jpg'),
  m03: require('../../assets/tarot/m03.jpg'), m04: require('../../assets/tarot/m04.jpg'), m05: require('../../assets/tarot/m05.jpg'),
  m06: require('../../assets/tarot/m06.jpg'), m07: require('../../assets/tarot/m07.jpg'), m08: require('../../assets/tarot/m08.jpg'),
  m09: require('../../assets/tarot/m09.jpg'), m10: require('../../assets/tarot/m10.jpg'), m11: require('../../assets/tarot/m11.jpg'),
  m12: require('../../assets/tarot/m12.jpg'), m13: require('../../assets/tarot/m13.jpg'), m14: require('../../assets/tarot/m14.jpg'),
  m15: require('../../assets/tarot/m15.jpg'), m16: require('../../assets/tarot/m16.jpg'), m17: require('../../assets/tarot/m17.jpg'),
  m18: require('../../assets/tarot/m18.jpg'), m19: require('../../assets/tarot/m19.jpg'), m20: require('../../assets/tarot/m20.jpg'),
  m21: require('../../assets/tarot/m21.jpg'),
  c01: require('../../assets/tarot/c01.jpg'), c02: require('../../assets/tarot/c02.jpg'), c03: require('../../assets/tarot/c03.jpg'),
  c04: require('../../assets/tarot/c04.jpg'), c05: require('../../assets/tarot/c05.jpg'), c06: require('../../assets/tarot/c06.jpg'),
  c07: require('../../assets/tarot/c07.jpg'), c08: require('../../assets/tarot/c08.jpg'), c09: require('../../assets/tarot/c09.jpg'),
  c10: require('../../assets/tarot/c10.jpg'), c11: require('../../assets/tarot/c11.jpg'), c12: require('../../assets/tarot/c12.jpg'),
  c13: require('../../assets/tarot/c13.jpg'), c14: require('../../assets/tarot/c14.jpg'),
  s01: require('../../assets/tarot/s01.jpg'), s02: require('../../assets/tarot/s02.jpg'), s03: require('../../assets/tarot/s03.jpg'),
  s04: require('../../assets/tarot/s04.jpg'), s05: require('../../assets/tarot/s05.jpg'), s06: require('../../assets/tarot/s06.jpg'),
  s07: require('../../assets/tarot/s07.jpg'), s08: require('../../assets/tarot/s08.jpg'), s09: require('../../assets/tarot/s09.jpg'),
  s10: require('../../assets/tarot/s10.jpg'), s11: require('../../assets/tarot/s11.jpg'), s12: require('../../assets/tarot/s12.jpg'),
  s13: require('../../assets/tarot/s13.jpg'), s14: require('../../assets/tarot/s14.jpg'),
  w01: require('../../assets/tarot/w01.jpg'), w02: require('../../assets/tarot/w02.jpg'), w03: require('../../assets/tarot/w03.jpg'),
  w04: require('../../assets/tarot/w04.jpg'), w05: require('../../assets/tarot/w05.jpg'), w06: require('../../assets/tarot/w06.jpg'),
  w07: require('../../assets/tarot/w07.jpg'), w08: require('../../assets/tarot/w08.jpg'), w09: require('../../assets/tarot/w09.jpg'),
  w10: require('../../assets/tarot/w10.jpg'), w11: require('../../assets/tarot/w11.jpg'), w12: require('../../assets/tarot/w12.jpg'),
  w13: require('../../assets/tarot/w13.jpg'), w14: require('../../assets/tarot/w14.jpg'),
  p01: require('../../assets/tarot/p01.jpg'), p02: require('../../assets/tarot/p02.jpg'), p03: require('../../assets/tarot/p03.jpg'),
  p04: require('../../assets/tarot/p04.jpg'), p05: require('../../assets/tarot/p05.jpg'), p06: require('../../assets/tarot/p06.jpg'),
  p07: require('../../assets/tarot/p07.jpg'), p08: require('../../assets/tarot/p08.jpg'), p09: require('../../assets/tarot/p09.jpg'),
  p10: require('../../assets/tarot/p10.jpg'), p11: require('../../assets/tarot/p11.jpg'), p12: require('../../assets/tarot/p12.jpg'),
  p13: require('../../assets/tarot/p13.jpg'), p14: require('../../assets/tarot/p14.jpg'),
};

/** 카드 id → 이미지 모듈 (없으면 undefined). */
export function cardImage(id: string): any {
  return IMG[id];
}

// 78장 덱 (RWS 표준 키워드 한국어). 정(up)/역(rev).
export const DECK: TarotCard[] = [
  // ── 메이저 아르카나 22 ──
  { id: 'm00', name: 'The Fool', ko: '바보', suit: 'major', up: '새 시작·모험·순수·자유', rev: '무모·경솔·불안정' },
  { id: 'm01', name: 'The Magician', ko: '마법사', suit: 'major', up: '의지·창조·능력·기회', rev: '속임수·미숙·재능 낭비' },
  { id: 'm02', name: 'The High Priestess', ko: '여사제', suit: 'major', up: '직관·신비·내면·잠재의식', rev: '비밀·감춤·직관 무시' },
  { id: 'm03', name: 'The Empress', ko: '여황제', suit: 'major', up: '풍요·모성·결실·사랑', rev: '의존·정체·과보호' },
  { id: 'm04', name: 'The Emperor', ko: '황제', suit: 'major', up: '권위·안정·질서·책임', rev: '독선·경직·통제욕' },
  { id: 'm05', name: 'The Hierophant', ko: '교황', suit: 'major', up: '전통·가르침·신념·관습', rev: '독단·고정관념·일탈' },
  { id: 'm06', name: 'The Lovers', ko: '연인', suit: 'major', up: '사랑·선택·결합·조화', rev: '갈등·이별·잘못된 선택' },
  { id: 'm07', name: 'The Chariot', ko: '전차', suit: 'major', up: '의지·전진·승리·통제', rev: '폭주·방향 상실·좌절' },
  { id: 'm08', name: 'Strength', ko: '힘', suit: 'major', up: '용기·인내·내면의 힘·자제', rev: '나약·자기의심·충동' },
  { id: 'm09', name: 'The Hermit', ko: '은둔자', suit: 'major', up: '성찰·고독·지혜·탐구', rev: '고립·은둔 과다·외면' },
  { id: 'm10', name: 'Wheel of Fortune', ko: '운명의 수레바퀴', suit: 'major', up: '운명·전환·기회·순환', rev: '불운·정체·악순환' },
  { id: 'm11', name: 'Justice', ko: '정의', suit: 'major', up: '균형·정의·인과·공정', rev: '불공정·편견·책임 회피' },
  { id: 'm12', name: 'The Hanged Man', ko: '매달린 사람', suit: 'major', up: '희생·관점 전환·기다림·통찰', rev: '정체·헛된 희생·집착' },
  { id: 'm13', name: 'Death', ko: '죽음', suit: 'major', up: '끝·변화·재생·전환', rev: '변화 거부·정체·미련' },
  { id: 'm14', name: 'Temperance', ko: '절제', suit: 'major', up: '절제·조화·균형·치유', rev: '불균형·과잉·조급' },
  { id: 'm15', name: 'The Devil', ko: '악마', suit: 'major', up: '욕망·속박·집착·유혹', rev: '해방·각성·속박 탈출' },
  { id: 'm16', name: 'The Tower', ko: '탑', suit: 'major', up: '붕괴·각성·급변·해방', rev: '점진적 변화·재난 회피·고집' },
  { id: 'm17', name: 'The Star', ko: '별', suit: 'major', up: '희망·영감·치유·평온', rev: '절망·실망·신념 상실' },
  { id: 'm18', name: 'The Moon', ko: '달', suit: 'major', up: '불안·환상·무의식·혼란', rev: '두려움 해소·진실 드러남·명료' },
  { id: 'm19', name: 'The Sun', ko: '태양', suit: 'major', up: '성공·활력·기쁨·긍정', rev: '일시적 그늘·과신·지연' },
  { id: 'm20', name: 'Judgement', ko: '심판', suit: 'major', up: '부활·결단·각성·재평가', rev: '자기비판·후회·망설임' },
  { id: 'm21', name: 'The World', ko: '세계', suit: 'major', up: '완성·성취·통합·여정', rev: '미완성·정체·아쉬움' },
  // ── 컵 (水, 감정·관계) ──
  { id: 'c01', name: 'Ace of Cups', ko: '컵 에이스', suit: 'cups', up: '새 사랑·감정의 시작·풍요로운 마음', rev: '감정 막힘·공허·사랑 지연' },
  { id: 'c02', name: 'Two of Cups', ko: '컵 2', suit: 'cups', up: '결합·교감·파트너십', rev: '불화·관계 불균형·이별' },
  { id: 'c03', name: 'Three of Cups', ko: '컵 3', suit: 'cups', up: '우정·축하·공동체', rev: '과음·소모적 관계·고립' },
  { id: 'c04', name: 'Four of Cups', ko: '컵 4', suit: 'cups', up: '권태·무관심·재고', rev: '새 기회 포착·각성·수용' },
  { id: 'c05', name: 'Five of Cups', ko: '컵 5', suit: 'cups', up: '상실·후회·실망', rev: '회복·용서·남은 희망' },
  { id: 'c06', name: 'Six of Cups', ko: '컵 6', suit: 'cups', up: '추억·향수·순수·재회', rev: '과거 집착·미성숙·작별' },
  { id: 'c07', name: 'Seven of Cups', ko: '컵 7', suit: 'cups', up: '환상·선택 과다·망상', rev: '현실 직시·결단·명확' },
  { id: 'c08', name: 'Eight of Cups', ko: '컵 8', suit: 'cups', up: '떠남·전환·더 깊은 추구', rev: '미련·정체·방황' },
  { id: 'c09', name: 'Nine of Cups', ko: '컵 9', suit: 'cups', up: '만족·소원 성취·풍요', rev: '과욕·헛된 만족·불만' },
  { id: 'c10', name: 'Ten of Cups', ko: '컵 10', suit: 'cups', up: '행복·가정·완성된 사랑', rev: '가정 불화·이상과 현실의 괴리' },
  { id: 'c11', name: 'Page of Cups', ko: '컵 시종', suit: 'cups', up: '감수성·메시지·창의', rev: '감정 미숙·현실 도피' },
  { id: 'c12', name: 'Knight of Cups', ko: '컵 기사', suit: 'cups', up: '낭만·제안·이상 추구', rev: '변덕·비현실·실망' },
  { id: 'c13', name: 'Queen of Cups', ko: '컵 여왕', suit: 'cups', up: '공감·직관·포용', rev: '감정 과잉·의존·우울' },
  { id: 'c14', name: 'King of Cups', ko: '컵 왕', suit: 'cups', up: '감정의 균형·관용·지혜', rev: '감정 억압·조종·변덕' },
  // ── 검 (風, 사고·갈등) ──
  { id: 's01', name: 'Ace of Swords', ko: '검 에이스', suit: 'swords', up: '명료·진실·돌파·결단', rev: '혼란·오판·잔혹' },
  { id: 's02', name: 'Two of Swords', ko: '검 2', suit: 'swords', up: '교착·결정 보류·균형', rev: '결단·진실 직면·혼란 해소' },
  { id: 's03', name: 'Three of Swords', ko: '검 3', suit: 'swords', up: '상심·이별·고통', rev: '회복·용서·고통 완화' },
  { id: 's04', name: 'Four of Swords', ko: '검 4', suit: 'swords', up: '휴식·회복·성찰', rev: '재가동·번아웃·정체' },
  { id: 's05', name: 'Five of Swords', ko: '검 5', suit: 'swords', up: '갈등·패배·이기심', rev: '화해·후회·갈등 종결' },
  { id: 's06', name: 'Six of Swords', ko: '검 6', suit: 'swords', up: '이동·전환·회복으로', rev: '정체·발 묶임·미해결' },
  { id: 's07', name: 'Seven of Swords', ko: '검 7', suit: 'swords', up: '전략·기만·회피', rev: '자백·양심·전략 수정' },
  { id: 's08', name: 'Eight of Swords', ko: '검 8', suit: 'swords', up: '속박·무력감·자기 제한', rev: '해방·자각·탈출' },
  { id: 's09', name: 'Nine of Swords', ko: '검 9', suit: 'swords', up: '불안·악몽·근심', rev: '회복·희망·근심 완화' },
  { id: 's10', name: 'Ten of Swords', ko: '검 10', suit: 'swords', up: '종말·바닥·배신', rev: '회복 시작·재기·최악 통과' },
  { id: 's11', name: 'Page of Swords', ko: '검 시종', suit: 'swords', up: '호기심·경계·정보', rev: '험담·성급·방어 과잉' },
  { id: 's12', name: 'Knight of Swords', ko: '검 기사', suit: 'swords', up: '돌진·결단·야망', rev: '무모·공격성·성급' },
  { id: 's13', name: 'Queen of Swords', ko: '검 여왕', suit: 'swords', up: '명석·독립·통찰', rev: '냉정·비판·고립' },
  { id: 's14', name: 'King of Swords', ko: '검 왕', suit: 'swords', up: '이성·권위·판단', rev: '독선·냉혹·권력 남용' },
  // ── 완드 (火, 열정·행동) ──
  { id: 'w01', name: 'Ace of Wands', ko: '완드 에이스', suit: 'wands', up: '새 열정·창조·시작', rev: '지연·의욕 상실·좌절' },
  { id: 'w02', name: 'Two of Wands', ko: '완드 2', suit: 'wands', up: '계획·미래 설계·결정', rev: '두려움·계획 부족·정체' },
  { id: 'w03', name: 'Three of Wands', ko: '완드 3', suit: 'wands', up: '확장·전망·기다림', rev: '지연·장애·근시안' },
  { id: 'w04', name: 'Four of Wands', ko: '완드 4', suit: 'wands', up: '축하·안정·기반·가정', rev: '불안정·미완성·갈등' },
  { id: 'w05', name: 'Five of Wands', ko: '완드 5', suit: 'wands', up: '경쟁·갈등·혼란', rev: '갈등 회피·화해·협력' },
  { id: 'w06', name: 'Six of Wands', ko: '완드 6', suit: 'wands', up: '승리·인정·성취', rev: '지연·자만·인정 부족' },
  { id: 'w07', name: 'Seven of Wands', ko: '완드 7', suit: 'wands', up: '방어·도전·신념', rev: '압도·포기·수세' },
  { id: 'w08', name: 'Eight of Wands', ko: '완드 8', suit: 'wands', up: '신속·진전·소식', rev: '지연·성급·혼선' },
  { id: 'w09', name: 'Nine of Wands', ko: '완드 9', suit: 'wands', up: '인내·경계·끈기', rev: '소진·방어 과잉·포기 직전' },
  { id: 'w10', name: 'Ten of Wands', ko: '완드 10', suit: 'wands', up: '부담·책임 과중·압박', rev: '위임·내려놓음·번아웃' },
  { id: 'w11', name: 'Page of Wands', ko: '완드 시종', suit: 'wands', up: '열의·탐험·아이디어', rev: '산만·미성숙·지연' },
  { id: 'w12', name: 'Knight of Wands', ko: '완드 기사', suit: 'wands', up: '모험·열정·행동', rev: '충동·무모·산만' },
  { id: 'w13', name: 'Queen of Wands', ko: '완드 여왕', suit: 'wands', up: '자신감·매력·활력', rev: '질투·불안·소진' },
  { id: 'w14', name: 'King of Wands', ko: '완드 왕', suit: 'wands', up: '리더십·비전·추진력', rev: '독선·성급·과욕' },
  // ── 펜타클 (土, 물질·현실) ──
  { id: 'p01', name: 'Ace of Pentacles', ko: '펜타클 에이스', suit: 'pentacles', up: '새 기회·번영·물질의 시작', rev: '기회 상실·탐욕·지연' },
  { id: 'p02', name: 'Two of Pentacles', ko: '펜타클 2', suit: 'pentacles', up: '균형·유연·저글링', rev: '불균형·과부하·혼란' },
  { id: 'p03', name: 'Three of Pentacles', ko: '펜타클 3', suit: 'pentacles', up: '협업·기술·성장', rev: '부조화·미숙·갈등' },
  { id: 'p04', name: 'Four of Pentacles', ko: '펜타클 4', suit: 'pentacles', up: '안정·소유·보존', rev: '집착·인색·통제' },
  { id: 'p05', name: 'Five of Pentacles', ko: '펜타클 5', suit: 'pentacles', up: '결핍·어려움·소외', rev: '회복·도움·역경 통과' },
  { id: 'p06', name: 'Six of Pentacles', ko: '펜타클 6', suit: 'pentacles', up: '나눔·관용·균형', rev: '불공정·빚·조건부 도움' },
  { id: 'p07', name: 'Seven of Pentacles', ko: '펜타클 7', suit: 'pentacles', up: '인내·평가·기다림', rev: '조급·헛수고·재평가' },
  { id: 'p08', name: 'Eight of Pentacles', ko: '펜타클 8', suit: 'pentacles', up: '숙련·노력·집중', rev: '태만·완벽주의·정체' },
  { id: 'p09', name: 'Nine of Pentacles', ko: '펜타클 9', suit: 'pentacles', up: '자립·풍요·성취', rev: '과시·불안정·의존' },
  { id: 'p10', name: 'Ten of Pentacles', ko: '펜타클 10', suit: 'pentacles', up: '풍요·유산·안정된 가정', rev: '재정 문제·가족 갈등·불안정' },
  { id: 'p11', name: 'Page of Pentacles', ko: '펜타클 시종', suit: 'pentacles', up: '학습·실용·기회', rev: '게으름·비현실·미루기' },
  { id: 'p12', name: 'Knight of Pentacles', ko: '펜타클 기사', suit: 'pentacles', up: '성실·근면·책임', rev: '정체·완고·지루함' },
  { id: 'p13', name: 'Queen of Pentacles', ko: '펜타클 여왕', suit: 'pentacles', up: '풍요·실용·돌봄', rev: '물질 집착·자기 소홀' },
  { id: 'p14', name: 'King of Pentacles', ko: '펜타클 왕', suit: 'pentacles', up: '성공·안정·풍요', rev: '물질주의·완고·탐욕' },
];

// 5장 스프레드 포지션 (한국어 의미) — 현재→도전→뿌리→조언→결과
export const SPREAD_POSITIONS: string[] = [
  '현재 상황', '도전·장애', '뿌리·원인', '조언·방향', '결과·흐름',
];

// 질문 카테고리 (스프레드 주제)
export const TARO_CATEGORIES: { key: string; ko: string; emoji: string }[] = [
  { key: 'love', ko: '연애·관계', emoji: '💕' },
  { key: 'work', ko: '직업·진로', emoji: '💼' },
  { key: 'money', ko: '재물·금전', emoji: '💰' },
  { key: 'health', ko: '건강·심신', emoji: '🌿' },
  { key: 'general', ko: '종합 운세', emoji: '🔮' },
];

export type SpreadCard = TarotCard & { reversed: boolean; position: string };

// Fisher-Yates 셔플(런타임 Math.random — 결정론 엔진 아님, 재미 영역).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 포지션 수만큼 중복 없이 뽑고 각 카드에 정/역방향(랜덤)·포지션을 부여. */
export function drawSpread(positions: string[]): SpreadCard[] {
  const picked = shuffle(DECK).slice(0, positions.length);
  return picked.map((card, i) => ({ ...card, reversed: Math.random() < 0.5, position: positions[i] }));
}

/** 카드 1장 뽑기(데일리 등 호환용). */
export function drawCard(): TarotCard & { reversed: boolean } {
  const card = DECK[Math.floor(Math.random() * DECK.length)];
  return { ...card, reversed: Math.random() < 0.5 };
}

// 수트별 에너지(종합 풀이 서술용)
const SUIT_ENERGY: Record<Suit, string> = {
  major: '운명·전환',
  wands: '열정·행동·추진',
  cups: '감정·관계·교감',
  swords: '사고·판단·갈등',
  pentacles: '현실·물질·안정',
};

/**
 * 전체 스프레드의 *조합* 종합 풀이(카드 하나하나가 아니라 흐름 전체).
 * 룰: 핵심 포지션(현재→결과) + 메이저 비중(운명성) + 우세 수트(에너지) + 정/역 비율(순조/장애).
 * 온디바이스(LLM 0) — 통계+템플릿. 깊은 서사 통변은 추후 프리미엄(LLM) 여지.
 */
export function combineReading(cards: SpreadCard[]): string[] {
  if (!cards.length) return [];
  const majors = cards.filter((c) => c.suit === 'major').length;
  const rev = cards.filter((c) => c.reversed).length;
  const cnt: Record<string, number> = { wands: 0, cups: 0, swords: 0, pentacles: 0 };
  cards.forEach((c) => { if (c.suit !== 'major') cnt[c.suit] += 1; });
  const dom = (Object.keys(cnt) as Suit[]).sort((a, b) => cnt[b] - cnt[a])[0];
  const cur = cards[0];                 // 현재 상황
  const out = cards[cards.length - 1];  // 최종 결과
  const kw = (c: SpreadCard) => (c.reversed ? c.rev : c.up);

  // 5장을 따로따로가 아니라 '하나의 흐름'으로 엮는다: 현재→도전→뿌리→조언→결과를 접속해 서사로,
  //   마지막에 전체 톤(메이저 비중·우세 수트·정/역)을 한 문단으로 종합한다.
  const nm = (c: SpreadCard) => `${c.ko}${c.reversed ? '(뒤집힘)' : ''}`;
  const ch = cards[1] ?? cur;   // 도전·장애
  const root = cards[2] ?? cur; // 뿌리·원인
  const adv = cards[3] ?? out;  // 조언·방향
  return [
    `지금 당신은 ${nm(cur)} 자리에서 출발해요 — ${kw(cur)}. 그 안에서 ${nm(ch)}의 도전을 마주하고(${kw(ch)}), 이 모든 것의 바탕엔 ${nm(root)}가 깔려 있습니다(${kw(root)}).`,
    `그래서 카드가 건네는 조언은 ${nm(adv)} — ${kw(adv)}. 이 방향으로 움직이면, 흐름은 자연스럽게 ${nm(out)}로 향합니다(${kw(out)}).`,
    `전체적으로 보면 ${majors >= 3 ? '인생의 큰 전환점이 움직이는' : '당신이 직접 풀어갈 현실적인 일들이 중심인'} 시기예요.${cnt[dom] >= 2 ? ` ${SUIT_META[dom].ko}(${SUIT_ENERGY[dom]})의 기운이 흐름을 이끌고,` : ''} ${rev >= 4 ? '지금은 밀어붙이기보다 잠시 멈춰 안을 정리하는 게 좋습니다.' : rev <= 1 ? '큰 막힘 없이 비교적 순조롭게 풀려갑니다.' : '잘 풀리는 부분과 점검할 부분이 함께 있어요.'}`,
  ];
}
