// app/src/lib/tarot.ts — 타로 78장(Rider-Waite-Smith) + 카테고리·켈틱크로스 스프레드 (무료, 룰·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 이미지 = RWS 1909 덱(퍼블릭 도메인, metabismuth/tarot-json) assets/tarot/*.jpg.
// 카드명·키워드(정/역)는 RWS 표준 의미를 한국어로(타로 공지식). LLM·서버 0 — 온디바이스 룰.
// 스프레드: 카테고리(질문 주제) 선택 → 켈틱크로스 10장(중복 없이 뽑고 정/역 랜덤).
//   ⚠️ require 는 RN 정적 번들이라 78개를 명시(동적 require 불가). 카드 추가 시 IMG·DECK 동기.
// ─────────────────────────────────────────────────────────────────────────

export type Suit = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';

// 질문 주제 키 — 타로 풀이/카드 의미를 '이 주제의 언어'로 분기하는 단위.
// (TARO_CATEGORIES 의 key 와 1:1 — love/work/money/health/general)
export type TopicKey = 'love' | 'work' | 'money' | 'health' | 'general';

// 한 카드의 주제별 정/역 의미. up=정방향, rev=역방향(키워드는 '·'로 구분된 한국어 — 기존 DECK.up/rev 와 동일 형식).
export type TopicMeaning = { up: string; rev: string };

export type TarotCard = {
  id: string;        // 이미지 키(m00, c01 …)
  name: string;      // 영어명(국제 표준)
  ko: string;        // 한국어명
  suit: Suit;
  up: string;        // 정방향 키워드(범용 — 주제 분기가 없을 때의 기본값)
  rev: string;       // 역방향 키워드(범용)
  // 주제별 의미(있으면 그 주제 풀이/확대 모달에서 up/rev 대신 사용). 없는 주제는 수트 폴백(SUIT_FALLBACK) → 그래도 없으면 범용 up/rev.
  //   ⚠️ stance: RWS(라이더-웨이트) 표준 해석 초안 — daniel 검수 필요(과장·공포 금지, §4 안전 가드 준수).
  //   현 DECK 의 up/rev 가 한국어 단일 문자열이므로 주제 의미도 한국어 문자열로 통일(앱 카드 데이터는 ko 단일 — 메뉴 타이틀만 i18n).
  topics?: Partial<Record<TopicKey, TopicMeaning>>;
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
  { id: 'm00', name: 'The Fool', ko: '바보', suit: 'major', up: '새 시작·모험·순수·자유', rev: '무모·경솔·불안정',
    topics: {
      love: { up: '설렘으로 시작하는 새 인연·순수한 마음·가벼운 첫걸음', rev: '즉흥적 만남·책임감 부족·신중함 결여' },
      work: { up: '새 분야 도전·틀에 매이지 않는 발상·자유로운 시도', rev: '준비 부족·무계획·즉흥적 결정의 위험' },
      money: { up: '새로운 시도·모험적 투자 기회·열린 가능성', rev: '무모한 지출·계획 없는 소비·위험 간과' },
      health: { up: '새 습관 시작하기 좋은 때·가벼운 마음·활력', rev: '부주의·과신으로 인한 방심·생활 리듬 흐트러짐' },
      general: { up: '새로운 출발·자유로운 모험·순수한 가능성', rev: '경솔함·준비 부족·불안정한 시작' },
    } },
  { id: 'm01', name: 'The Magician', ko: '마법사', suit: 'major', up: '의지·창조·능력·기회', rev: '속임수·미숙·재능 낭비',
    topics: {
      love: { up: '주도적으로 다가가는 매력·관계를 만들어 가는 의지·좋은 타이밍', rev: '진심을 숨긴 밀당·말뿐인 약속·진정성 부족' },
      work: { up: '능력 발휘·기회를 현실로 만드는 추진력·필요한 자원이 갖춰짐', rev: '실력 미숙·재능 낭비·보여주기식 처리' },
      money: { up: '수완으로 기회를 잡는 흐름·새 수입원 창출 능력', rev: '과장된 정보·속임수 거래·역량 부족' },
      health: { up: '의지로 컨디션을 끌어올리는 때·관리 효과가 잘 나타남', rev: '잘못된 정보에 휘둘림·작심삼일·관리 소홀' },
      general: { up: '의지와 능력으로 기회를 현실로 만드는 때', rev: '미숙함·속임수·재능을 헛되이 흘려보냄' },
    } },
  { id: 'm02', name: 'The High Priestess', ko: '여사제', suit: 'major', up: '직관·신비·내면·잠재의식', rev: '비밀·감춤·직관 무시',
    topics: {
      love: { up: '말로 다 못한 깊은 감정·직관으로 통하는 사이·아직 드러나지 않은 마음', rev: '속내를 감춤·오해를 부르는 침묵·직관 외면' },
      work: { up: '드러나지 않은 정보의 흐름·직관적 판단이 맞는 때·조용히 살피기', rev: '정보 은폐·소통 부족·중요한 신호를 놓침' },
      money: { up: '아직 드러나지 않은 기회·신중히 지켜볼 때·직감의 가치', rev: '숨겨진 비용·불투명한 거래·정보 부족' },
      health: { up: '몸이 보내는 신호에 귀 기울일 때·마음 깊은 곳의 휴식 필요', rev: '증상 외면·억눌린 감정·신호 무시' },
      general: { up: '직관·내면의 목소리·아직 드러나지 않은 진실', rev: '비밀·감춤·직관을 무시한 판단' },
    } },
  { id: 'm03', name: 'The Empress', ko: '여황제', suit: 'major', up: '풍요·모성·결실·사랑', rev: '의존·정체·과보호',
    topics: {
      love: { up: '따뜻하게 무르익는 사랑·풍요로운 애정·결실 맺는 관계', rev: '지나친 의존·과보호·애정 표현의 정체' },
      work: { up: '창의력이 결실 맺는 때·풍성한 성과·돌봄과 협력의 가치', rev: '정체·아이디어 고갈·과한 참견' },
      money: { up: '풍요와 여유·꾸준히 불어나는 재물·넉넉한 흐름', rev: '과소비·의존적 지출·재정 정체' },
      health: { up: '몸과 마음의 충만함·회복과 돌봄·여유로운 컨디션', rev: '과로 뒤 소진·자기 돌봄 부족·나태' },
      general: { up: '풍요·결실·따뜻한 돌봄의 기운', rev: '의존·정체·지나친 보호' },
    } },
  { id: 'm04', name: 'The Emperor', ko: '황제', suit: 'major', up: '권위·안정·질서·책임', rev: '독선·경직·통제욕',
    topics: {
      love: { up: '듬직하고 안정적인 관계·책임감 있는 상대·든든한 울타리', rev: '지나친 통제·고집·일방적 주도' },
      work: { up: '리더십·체계와 질서·책임 있는 위치·안정된 기반', rev: '독선적 운영·경직된 조직·권위주의' },
      money: { up: '안정적 자산 관리·체계 잡힌 재정·견고한 기반', rev: '경직된 운용·통제 집착·융통성 부족' },
      health: { up: '규칙적 생활이 힘이 되는 때·체계적 관리·안정', rev: '과로를 부르는 완고함·스트레스 누적·경직' },
      general: { up: '안정·질서·책임으로 다지는 기반', rev: '독선·경직됨·지나친 통제욕' },
    } },
  { id: 'm05', name: 'The Hierophant', ko: '교황', suit: 'major', up: '전통·가르침·신념·관습', rev: '독단·고정관념·일탈',
    topics: {
      love: { up: '정식 만남·약속과 결혼·전통적 가치의 관계·신뢰', rev: '형식에 얽매임·관습과의 충돌·자유로운 선택' },
      work: { up: '멘토의 가르침·정도를 따르는 길·검증된 방식·자격', rev: '낡은 관행·고정관념·틀을 벗어난 시도' },
      money: { up: '정석적 관리·전통적 방식의 안정·신뢰할 조언', rev: '관행에 묶인 손해·획일적 판단·새 방식 필요' },
      health: { up: '검증된 방법으로 관리·전문가의 조언 따르기', rev: '근거 없는 민간요법 의존·고집·자가 진단' },
      general: { up: '전통·가르침·신념이 길잡이가 되는 때', rev: '독단·고정관념·관습에서 벗어남' },
    } },
  { id: 'm06', name: 'The Lovers', ko: '연인', suit: 'major', up: '사랑·선택·결합·조화', rev: '갈등·이별·잘못된 선택',
    topics: {
      love: { up: '깊은 사랑과 결합·진심 어린 선택·마음이 통하는 조화', rev: '관계의 갈등·엇갈린 마음·후회되는 선택' },
      work: { up: '좋은 파트너십·가치관이 맞는 협업·중요한 선택', rev: '의견 충돌·잘못된 선택·협력 균열' },
      money: { up: '신뢰로 맺는 거래·균형 잡힌 선택·함께하는 이익', rev: '잘못된 금전 결정·갈등하는 이해관계' },
      health: { up: '몸과 마음의 조화·균형 잡힌 선택·좋은 동반', rev: '균형이 깨진 생활·갈등으로 인한 스트레스' },
      general: { up: '사랑·조화·마음에서 우러난 선택', rev: '갈등·엇갈림·후회되는 선택' },
    } },
  { id: 'm07', name: 'The Chariot', ko: '전차', suit: 'major', up: '의지·전진·승리·통제', rev: '폭주·방향 상실·좌절',
    topics: {
      love: { up: '관계를 밀고 나가는 추진력·적극적 진전·의지로 얻는 결실', rev: '한쪽만의 독주·엇나간 방향·감정 조절 실패' },
      work: { up: '목표를 향한 강한 추진력·승리·통제력 있는 전진', rev: '방향 상실·과속·통제 불능' },
      money: { up: '의지로 이뤄내는 성과·목표 달성·주도적 운용', rev: '무리한 추진·중심 잃은 지출·좌절' },
      health: { up: '의지로 이겨내는 컨디션·꾸준한 단련·전진', rev: '무리한 강행·과부하·번아웃 위험' },
      general: { up: '강한 의지로 전진해 얻는 승리', rev: '방향 상실·폭주·통제력 잃음' },
    } },
  { id: 'm08', name: 'Strength', ko: '힘', suit: 'major', up: '용기·인내·내면의 힘·자제', rev: '나약·자기의심·충동',
    topics: {
      love: { up: '부드럽게 감싸는 사랑·인내로 깊어지는 관계·용기 있는 표현', rev: '자신감 부족·감정 기복·조급함' },
      work: { up: '끈기로 이겨내는 힘·차분한 자제력·역경을 견디는 용기', rev: '자기 의심·인내심 바닥·충동적 대응' },
      money: { up: '흔들림 없는 관리·인내가 부르는 안정·절제', rev: '충동 지출·조급한 결정·자제력 약화' },
      health: { up: '회복으로 향하는 내면의 힘·꾸준한 인내·심신 안정', rev: '의지 약화·스트레스에 휘둘림·기력 저하' },
      general: { up: '용기·인내·부드러운 내면의 힘', rev: '나약함·자기의심·충동' },
    } },
  { id: 'm09', name: 'The Hermit', ko: '은둔자', suit: 'major', up: '성찰·고독·지혜·탐구', rev: '고립·은둔 과다·외면',
    topics: {
      love: { up: '혼자만의 시간이 필요한 때·신중한 마음·내면을 살피는 사랑', rev: '지나친 거리 두기·고립·소통 단절' },
      work: { up: '깊이 파고드는 탐구·전문성·홀로 다지는 실력', rev: '고립된 작업·협업 회피·길을 잃은 방황' },
      money: { up: '신중한 점검·내실 다지기·조용한 절약', rev: '과도한 위축·기회 외면·고립된 판단' },
      health: { up: '충분한 휴식과 성찰·조용한 회복·내면 정리', rev: '지나친 칩거·우울감·외부 도움 거부' },
      general: { up: '성찰·고독 속의 지혜·내면 탐구', rev: '고립·지나친 은둔·현실 외면' },
    } },
  { id: 'm10', name: 'Wheel of Fortune', ko: '운명의 수레바퀴', suit: 'major', up: '운명·전환·기회·순환', rev: '불운·정체·악순환',
    topics: {
      love: { up: '운명적 전환점·새 국면을 맞는 인연·흐름이 바뀌는 때', rev: '관계의 정체·반복되는 패턴·때를 기다림' },
      work: { up: '기회의 전환점·흐름을 타는 때·운이 따르는 변화', rev: '정체된 상황·악순환·때가 무르익지 않음' },
      money: { up: '재물 흐름의 전환·뜻밖의 기회·순환하는 운', rev: '재정 정체·반복되는 손실·운의 하강기' },
      health: { up: '컨디션이 바뀌는 전환점·회복의 흐름·순환', rev: '나아졌다 나빠지는 기복·정체·악순환' },
      general: { up: '운명의 전환·기회·삶의 순환', rev: '불운의 시기·정체·악순환' },
    } },
  { id: 'm11', name: 'Justice', ko: '정의', suit: 'major', up: '균형·정의·인과·공정', rev: '불공정·편견·책임 회피',
    topics: {
      love: { up: '공평한 관계·뿌린 만큼 거두는 인연·균형 잡힌 마음', rev: '불공평한 관계·책임 회피·치우친 마음' },
      work: { up: '공정한 평가·정당한 결과·계약·합리적 판단', rev: '불공정한 처우·편향된 결정·책임 떠넘김' },
      money: { up: '정당한 거래·균형 잡힌 수지·법적 정리', rev: '불공정 거래·금전 분쟁·손익 불균형' },
      health: { up: '균형 잡힌 생활이 답·원인과 결과를 직시·절제', rev: '무절제의 대가·불균형·원인 외면' },
      general: { up: '균형·공정함·인과의 흐름', rev: '불공정·편견·책임 회피' },
    } },
  { id: 'm12', name: 'The Hanged Man', ko: '매달린 사람', suit: 'major', up: '희생·관점 전환·기다림·통찰', rev: '정체·헛된 희생·집착',
    topics: {
      love: { up: '기다림의 시간·다른 시선으로 보는 관계·헌신', rev: '일방적 희생·소모적 기다림·집착' },
      work: { up: '잠시 멈춰 관점을 바꿀 때·인내가 필요한 국면·통찰', rev: '진전 없는 정체·헛된 노력·집착' },
      money: { up: '당장의 이익을 미루는 지혜·관점 전환·인내', rev: '묶인 자금·헛된 투자·미련' },
      health: { up: '쉬어가며 돌아볼 때·관점을 바꾸는 회복·여유', rev: '나아지지 않는 정체·소모·악순환' },
      general: { up: '관점 전환·기다림 속의 통찰·내려놓음', rev: '정체·헛된 희생·집착' },
    } },
  { id: 'm13', name: 'Death', ko: '죽음', suit: 'major', up: '끝·변화·재생·전환', rev: '변화 거부·정체·미련',
    topics: {
      love: { up: '한 관계의 마무리와 새로운 시작·근본적 변화·재생', rev: '끝맺지 못한 미련·변화 거부·과거에 머묾' },
      work: { up: '낡은 방식의 종료·근본적 전환·새 국면으로 재편', rev: '변화 거부·구태 고수·정체' },
      money: { up: '재정 구조의 큰 전환·정리 후 새 출발·청산', rev: '손절 못 함·낡은 방식 집착·정체' },
      health: { up: '나쁜 습관을 끊고 새로 시작·근본적 변화의 때', rev: '변화 회피·낡은 습관 지속·정체' },
      general: { up: '끝과 재생·근본적 전환·새 국면', rev: '변화 거부·정체·미련' },
    } },
  { id: 'm14', name: 'Temperance', ko: '절제', suit: 'major', up: '절제·조화·균형·치유', rev: '불균형·과잉·조급',
    topics: {
      love: { up: '서로 맞춰가는 조화·차분히 무르익는 사랑·치유되는 관계', rev: '균형이 깨진 관계·과한 기대·조급함' },
      work: { up: '조율과 협업·균형 잡힌 진행·차분한 조정', rev: '과욕으로 인한 불균형·조급한 추진·마찰' },
      money: { up: '균형 잡힌 재정·적절한 배분·안정적 조율', rev: '과소비와 인색의 양극단·재정 불균형' },
      health: { up: '몸과 마음의 균형·회복과 치유·절제된 생활', rev: '과로·과식 등 무절제·기복·조급' },
      general: { up: '절제·조화·균형 속의 치유', rev: '불균형·과잉·조급함' },
    } },
  { id: 'm15', name: 'The Devil', ko: '악마', suit: 'major', up: '욕망·속박·집착·유혹', rev: '해방·각성·속박 탈출',
    topics: {
      love: { up: '강한 끌림과 집착·욕망에 묶인 관계·헤어나기 어려운 매혹', rev: '집착에서 벗어남·관계의 속박을 끊음·각성' },
      work: { up: '돈·지위에 매인 상황·과한 야망·끊기 힘든 굴레', rev: '굴레에서 벗어남·악습 정리·자유 회복' },
      money: { up: '물질에 대한 집착·과소비의 유혹·빚의 굴레', rev: '재정 굴레에서 벗어남·과소비 끊기·해방' },
      health: { up: '나쁜 습관·중독적 패턴 주의·욕구에 휘둘림', rev: '나쁜 습관에서 벗어남·중독 극복·회복' },
      general: { up: '욕망·집착·끊기 힘든 굴레', rev: '속박에서 벗어남·각성·해방' },
    } },
  { id: 'm16', name: 'The Tower', ko: '탑', suit: 'major', up: '붕괴·각성·급변·해방', rev: '점진적 변화·재난 회피·고집',
    topics: {
      love: { up: '갑작스러운 관계 변화·충격적 깨달음·낡은 틀의 붕괴', rev: '서서히 드러나는 균열·위기 모면·변화 거부' },
      work: { up: '예기치 못한 급변·구조의 붕괴와 재편·뒤흔드는 각성', rev: '점진적 변화로 충격 완화·위기 회피·고집' },
      money: { up: '갑작스러운 재정 충격·예상 밖 지출·판이 뒤집힘', rev: '큰 손실은 면함·서서히 정리·변화 미룸' },
      health: { up: '갑작스러운 신호에 주의·생활을 뒤흔드는 변화', rev: '큰 고비는 넘김·서서히 회복·경각심 필요' },
      general: { up: '갑작스러운 붕괴와 각성·판을 뒤엎는 변화', rev: '점진적 변화·위기 모면·고집' },
    } },
  { id: 'm17', name: 'The Star', ko: '별', suit: 'major', up: '희망·영감·치유·평온', rev: '절망·실망·신념 상실',
    topics: {
      love: { up: '희망찬 인연·치유되는 마음·잔잔한 행복·진실한 기대', rev: '실망·식어가는 기대·자신감 상실' },
      work: { up: '밝은 전망·영감과 비전·회복되는 의욕·좋은 흐름', rev: '의욕 저하·전망 흐림·신념 흔들림' },
      money: { up: '회복되는 재정·희망적 전망·서서히 나아지는 흐름', rev: '기대 못 미침·전망 불투명·실망' },
      health: { up: '회복과 치유·평온해지는 심신·희망적 회복', rev: '회복 더딤·무기력·기력 소진' },
      general: { up: '희망·치유·잔잔한 평온', rev: '실망·신념 상실·기력 저하' },
    } },
  { id: 'm18', name: 'The Moon', ko: '달', suit: 'major', up: '불안·환상·무의식·혼란', rev: '두려움 해소·진실 드러남·명료',
    topics: {
      love: { up: '모호한 마음·드러나지 않은 진심·불안과 혼란·환상', rev: '오해가 풀림·진실이 드러남·불안 해소' },
      work: { up: '불확실한 상황·드러나지 않은 변수·직관에 의지', rev: '안개가 걷힘·상황 명료해짐·진실 확인' },
      money: { up: '불투명한 흐름·숨은 변수·확신 어려운 때', rev: '실체가 드러남·혼란 해소·명확해짐' },
      health: { up: '원인 모를 불편·심리적 불안·신호가 모호함', rev: '원인이 밝혀짐·불안 가라앉음·명료' },
      general: { up: '불안·환상·드러나지 않은 혼란', rev: '진실이 드러남·불안 해소·명료해짐' },
    } },
  { id: 'm19', name: 'The Sun', ko: '태양', suit: 'major', up: '성공·활력·기쁨·긍정', rev: '일시적 그늘·과신·지연',
    topics: {
      love: { up: '밝고 행복한 사랑·솔직한 기쁨·따뜻한 결실·활기', rev: '잠시 흐려진 기류·과한 기대·표현 부족' },
      work: { up: '성공과 인정·활력 넘치는 성과·밝은 전망', rev: '성과 지연·자만 주의·일시적 그늘' },
      money: { up: '풍요와 성취·밝은 재정·결실 맺는 흐름', rev: '기대보다 더딘 성과·과신·잠시 주춤' },
      health: { up: '넘치는 활력·회복과 생기·밝은 컨디션', rev: '잠깐의 무기력·과신으로 인한 방심·지연' },
      general: { up: '성공·활력·밝은 기쁨', rev: '일시적 그늘·과신·지연' },
    } },
  { id: 'm20', name: 'Judgement', ko: '심판', suit: 'major', up: '부활·결단·각성·재평가', rev: '자기비판·후회·망설임',
    topics: {
      love: { up: '관계를 새 단계로 끌어올리는 결단·재회·깨달음', rev: '과거에 대한 후회·결단 망설임·자책' },
      work: { up: '중요한 결단의 때·재도약·과거를 딛는 각성', rev: '결정 지연·자기 비판·기회 망설임' },
      money: { up: '재정을 재정비하는 결단·새 도약·정산', rev: '과거 결정 후회·결단 미룸·우유부단' },
      health: { up: '생활을 다시 세우는 전환점·회복의 결단·각성', rev: '자책·미루는 관리·결심 흔들림' },
      general: { up: '각성·중요한 결단·재도약', rev: '후회·자기 비판·망설임' },
    } },
  { id: 'm21', name: 'The World', ko: '세계', suit: 'major', up: '완성·성취·통합·여정', rev: '미완성·정체·아쉬움',
    topics: {
      love: { up: '완성된 사랑·하나로 어우러진 관계·결실의 여정', rev: '아직 못 채운 아쉬움·매듭 미완·정체' },
      work: { up: '목표 달성·한 사이클의 완성·성취와 인정', rev: '마무리 부족·미완의 과제·결실 지연' },
      money: { up: '재정적 성취·결실 맺는 마무리·안정된 완성', rev: '목표에 조금 못 미침·미완·정체' },
      health: { up: '회복의 완성·균형 잡힌 심신·온전한 컨디션', rev: '회복 마무리 미흡·아쉬운 정체' },
      general: { up: '완성·성취·하나로 통합되는 여정', rev: '미완성·정체·아쉬움' },
    } },
  // ── 컵 (水, 감정·관계) ──
  { id: 'c01', name: 'Ace of Cups', ko: '컵 에이스', suit: 'cups', up: '새 사랑·감정의 시작·풍요로운 마음', rev: '감정 막힘·공허·사랑 지연',
    topics: {
      love: { up: '새로운 사랑의 시작·마음이 차오름·순수한 설렘', rev: '감정이 막힘·공허함·표현 못 한 마음' },
      work: { up: '열정이 샘솟는 새 시작·만족감·좋은 관계의 출발', rev: '의욕 저하·정서적 소진·동기 부족' },
      money: { up: '기분 좋은 시작·풍요로운 마음가짐·만족스러운 흐름', rev: '감정에 휘둘린 지출·만족 부족·공허' },
      health: { up: '마음이 채워지는 회복·정서적 활력·생기', rev: '정서적 메마름·무기력·스트레스 누적' },
      general: { up: '감정의 새 시작·차오르는 마음·풍요', rev: '감정 막힘·공허함·정서적 지연' },
    } },
  { id: 'c02', name: 'Two of Cups', ko: '컵 2', suit: 'cups', up: '결합·교감·파트너십', rev: '불화·관계 불균형·이별' },
  { id: 'c03', name: 'Three of Cups', ko: '컵 3', suit: 'cups', up: '우정·축하·공동체', rev: '과음·소모적 관계·고립' },
  { id: 'c04', name: 'Four of Cups', ko: '컵 4', suit: 'cups', up: '권태·무관심·재고', rev: '새 기회 포착·각성·수용' },
  { id: 'c05', name: 'Five of Cups', ko: '컵 5', suit: 'cups', up: '상실·후회·실망', rev: '회복·용서·남은 희망' },
  { id: 'c06', name: 'Six of Cups', ko: '컵 6', suit: 'cups', up: '추억·향수·순수·재회', rev: '과거 집착·미성숙·작별' },
  { id: 'c07', name: 'Seven of Cups', ko: '컵 7', suit: 'cups', up: '환상·선택 과다·망상', rev: '현실 직시·결단·명확' },
  { id: 'c08', name: 'Eight of Cups', ko: '컵 8', suit: 'cups', up: '떠남·전환·더 깊은 추구', rev: '미련·정체·방황' },
  { id: 'c09', name: 'Nine of Cups', ko: '컵 9', suit: 'cups', up: '만족·소원 성취·풍요', rev: '과욕·헛된 만족·불만' },
  { id: 'c10', name: 'Ten of Cups', ko: '컵 10', suit: 'cups', up: '행복·가정·완성된 사랑', rev: '가정 불화·이상과 현실의 괴리' },
  { id: 'c11', name: 'Page of Cups', ko: '컵 시종', suit: 'cups', up: '감수성·메시지·창의', rev: '감정 미숙·현실 도피',
    topics: {
      love: { up: '설레는 고백이나 연락·풋풋한 감정·다정한 제안', rev: '미숙한 감정 표현·변덕·진심 회피' },
      work: { up: '창의적 아이디어·기쁜 소식·새 제안', rev: '비현실적 발상·집중 부족·감정 기복' },
      money: { up: '소소한 좋은 소식·기분 좋은 제안·작은 기회', rev: '비현실적 기대·즉흥 지출·계획 부족' },
      health: { up: '마음을 다독이는 작은 변화·정서적 환기', rev: '감정 기복·현실 도피·돌봄 소홀' },
      general: { up: '감수성·반가운 소식·창의적 영감', rev: '감정 미숙·현실 도피·변덕' },
    } },
  { id: 'c12', name: 'Knight of Cups', ko: '컵 기사', suit: 'cups', up: '낭만·제안·이상 추구', rev: '변덕·비현실·실망',
    topics: {
      love: { up: '낭만적인 다가옴·진심 어린 제안·이상적인 구애', rev: '변덕스러운 마음·말뿐인 약속·실망' },
      work: { up: '매력적인 제안·이상을 좇는 추진·설득력', rev: '비현실적 계획·일관성 부족·과장' },
      money: { up: '솔깃한 제안·감성에 기댄 기회·낙관', rev: '실속 없는 제안·충동·기대 어긋남' },
      health: { up: '마음을 따르는 회복·기분 전환·정서적 활기', rev: '들쭉날쭉한 관리·현실 외면·기복' },
      general: { up: '낭만·매력적 제안·이상 추구', rev: '변덕·비현실적 기대·실망' },
    } },
  { id: 'c13', name: 'Queen of Cups', ko: '컵 여왕', suit: 'cups', up: '공감·직관·포용', rev: '감정 과잉·의존·우울',
    topics: {
      love: { up: '깊이 공감하고 품어주는 사랑·따뜻한 직관·정서적 안정', rev: '감정 과잉·지나친 의존·기복' },
      work: { up: '공감으로 이끄는 분위기·섬세한 배려·직관적 통찰', rev: '감정에 휘둘린 판단·번아웃·의존' },
      money: { up: '안정감 있는 관리·직관적 판단·여유로운 마음', rev: '감정적 지출·불안한 결정·의존' },
      health: { up: '마음을 보살피는 회복·정서적 균형·안정', rev: '우울감·감정 소진·자기 돌봄 부족' },
      general: { up: '공감·따뜻한 포용·직관', rev: '감정 과잉·의존·우울감' },
    } },
  { id: 'c14', name: 'King of Cups', ko: '컵 왕', suit: 'cups', up: '감정의 균형·관용·지혜', rev: '감정 억압·조종·변덕',
    topics: {
      love: { up: '감정을 다스리는 성숙한 사랑·너그러운 포용·안정', rev: '속내를 숨김·감정 억압·변덕' },
      work: { up: '침착한 리더십·감정의 균형·노련한 조율', rev: '감정 억누름·은근한 조종·기복' },
      money: { up: '균형 잡힌 관리·너그러우면서 신중한 운용·안정', rev: '감정에 휘둘린 결정·일관성 부족' },
      health: { up: '정서적으로 안정된 회복·차분한 관리·균형', rev: '억눌린 스트레스·감정 소화 못 함·기복' },
      general: { up: '감정의 균형·관용·성숙한 지혜', rev: '감정 억압·은근한 조종·변덕' },
    } },
  // ── 검 (風, 사고·갈등) ──
  { id: 's01', name: 'Ace of Swords', ko: '검 에이스', suit: 'swords', up: '명료·진실·돌파·결단', rev: '혼란·오판·잔혹',
    topics: {
      love: { up: '진실을 마주하는 명료함·솔직한 대화·관계의 돌파구', rev: '오해와 혼란·상처 주는 말·엇갈린 진심' },
      work: { up: '명쾌한 판단·핵심을 꿰뚫는 통찰·결단의 돌파구', rev: '오판·정보 혼선·소통 마찰' },
      money: { up: '명확한 판단으로 잡는 기회·합리적 결단·정리', rev: '잘못된 판단·정보 오류·성급한 결정' },
      health: { up: '원인을 명확히 진단·결단력 있는 관리·돌파', rev: '판단 흐림·스트레스성 긴장·혼란' },
      general: { up: '명료함·진실·결단의 돌파구', rev: '혼란·오판·날카로운 말' },
    } },
  { id: 's02', name: 'Two of Swords', ko: '검 2', suit: 'swords', up: '교착·결정 보류·균형', rev: '결단·진실 직면·혼란 해소' },
  { id: 's03', name: 'Three of Swords', ko: '검 3', suit: 'swords', up: '상심·이별·고통', rev: '회복·용서·고통 완화' },
  { id: 's04', name: 'Four of Swords', ko: '검 4', suit: 'swords', up: '휴식·회복·성찰', rev: '재가동·번아웃·정체' },
  { id: 's05', name: 'Five of Swords', ko: '검 5', suit: 'swords', up: '갈등·패배·이기심', rev: '화해·후회·갈등 종결' },
  { id: 's06', name: 'Six of Swords', ko: '검 6', suit: 'swords', up: '이동·전환·회복으로', rev: '정체·발 묶임·미해결' },
  { id: 's07', name: 'Seven of Swords', ko: '검 7', suit: 'swords', up: '전략·기만·회피', rev: '자백·양심·전략 수정' },
  { id: 's08', name: 'Eight of Swords', ko: '검 8', suit: 'swords', up: '속박·무력감·자기 제한', rev: '해방·자각·탈출' },
  { id: 's09', name: 'Nine of Swords', ko: '검 9', suit: 'swords', up: '불안·악몽·근심', rev: '회복·희망·근심 완화' },
  { id: 's10', name: 'Ten of Swords', ko: '검 10', suit: 'swords', up: '종말·바닥·배신', rev: '회복 시작·재기·최악 통과' },
  { id: 's11', name: 'Page of Swords', ko: '검 시종', suit: 'swords', up: '호기심·경계·정보', rev: '험담·성급·방어 과잉',
    topics: {
      love: { up: '호기심 어린 탐색·솔직한 질문·진심을 확인하려는 마음', rev: '말실수·성급한 단정·뒷말과 오해' },
      work: { up: '예리한 호기심·정보 수집·새 아이디어 탐색', rev: '섣부른 판단·정보 누설·경솔한 언행' },
      money: { up: '정보를 살피는 신중함·기회 탐색·경계심', rev: '성급한 결정·잘못된 정보·경솔한 지출' },
      health: { up: '몸 상태를 관찰하고 알아보기·경각심', rev: '과도한 걱정·확인 안 된 정보에 불안' },
      general: { up: '호기심·정보 탐색·경계심', rev: '성급함·말실수·과한 방어' },
    } },
  { id: 's12', name: 'Knight of Swords', ko: '검 기사', suit: 'swords', up: '돌진·결단·야망', rev: '무모·공격성·성급',
    topics: {
      love: { up: '저돌적으로 다가옴·솔직 담백한 표현·빠른 진전', rev: '성급한 밀어붙임·공격적 언행·조급함' },
      work: { up: '과감한 추진·빠른 결단·목표를 향한 돌진', rev: '무모한 강행·독선·준비 부족' },
      money: { up: '신속한 결단으로 잡는 기회·과감한 실행', rev: '성급한 투자·무모한 지출·충동' },
      health: { up: '의지로 밀어붙이는 회복·빠른 대처·결단', rev: '무리한 강행·과부하·성급한 판단' },
      general: { up: '과감한 돌진·빠른 결단·야망', rev: '무모함·공격성·성급함' },
    } },
  { id: 's13', name: 'Queen of Swords', ko: '검 여왕', suit: 'swords', up: '명석·독립·통찰', rev: '냉정·비판·고립',
    topics: {
      love: { up: '솔직하고 명료한 소통·독립적인 사랑·현명한 거리감', rev: '차가운 태도·비판적 말·마음의 벽' },
      work: { up: '명석한 판단·공정한 분석·독립적 일처리', rev: '지나친 비판·냉담함·소통 단절' },
      money: { up: '냉철한 분석·합리적 관리·객관적 판단', rev: '지나친 인색함·차가운 결정·고립' },
      health: { up: '객관적으로 상태를 파악·이성적 관리·절제', rev: '예민함·스트레스성 긴장·고립감' },
      general: { up: '명석함·독립·날카로운 통찰', rev: '냉정함·과한 비판·고립' },
    } },
  { id: 's14', name: 'King of Swords', ko: '검 왕', suit: 'swords', up: '이성·권위·판단', rev: '독선·냉혹·권력 남용',
    topics: {
      love: { up: '이성적이고 신뢰할 만한 상대·명확한 태도·진중함', rev: '권위적 태도·냉정함·일방적 판단' },
      work: { up: '논리적 판단·권위 있는 결정·공정한 통솔', rev: '독선·냉혹한 처사·권력 남용' },
      money: { up: '냉철한 전략·합리적 결정·체계적 관리', rev: '독단적 판단·융통성 부족·강압' },
      health: { up: '원칙에 따른 관리·이성적 대처·절제', rev: '경직된 고집·스트레스·과한 통제' },
      general: { up: '이성·권위·명확한 판단', rev: '독선·냉혹함·권력 남용' },
    } },
  // ── 완드 (火, 열정·행동) ──
  { id: 'w01', name: 'Ace of Wands', ko: '완드 에이스', suit: 'wands', up: '새 열정·창조·시작', rev: '지연·의욕 상실·좌절',
    topics: {
      love: { up: '불붙는 설렘·뜨거운 끌림·열정적인 새 시작', rev: '식어버린 열정·진전 없는 답답함·의욕 상실' },
      work: { up: '새 프로젝트의 출발·창의적 에너지·강한 추진의 시작', rev: '시작이 지연됨·의욕 저하·동력 부족' },
      money: { up: '새 수입원의 가능성·열정이 부르는 기회·도전', rev: '기회 지연·추진력 부족·흐지부지' },
      health: { up: '솟아나는 활력·운동을 시작할 에너지·생기', rev: '기력 저하·의욕 부진·무기력' },
      general: { up: '새 열정·창조적 에너지·힘찬 시작', rev: '지연·의욕 상실·동력 부족' },
    } },
  { id: 'w02', name: 'Two of Wands', ko: '완드 2', suit: 'wands', up: '계획·미래 설계·결정', rev: '두려움·계획 부족·정체' },
  { id: 'w03', name: 'Three of Wands', ko: '완드 3', suit: 'wands', up: '확장·전망·기다림', rev: '지연·장애·근시안' },
  { id: 'w04', name: 'Four of Wands', ko: '완드 4', suit: 'wands', up: '축하·안정·기반·가정', rev: '불안정·미완성·갈등' },
  { id: 'w05', name: 'Five of Wands', ko: '완드 5', suit: 'wands', up: '경쟁·갈등·혼란', rev: '갈등 회피·화해·협력' },
  { id: 'w06', name: 'Six of Wands', ko: '완드 6', suit: 'wands', up: '승리·인정·성취', rev: '지연·자만·인정 부족' },
  { id: 'w07', name: 'Seven of Wands', ko: '완드 7', suit: 'wands', up: '방어·도전·신념', rev: '압도·포기·수세' },
  { id: 'w08', name: 'Eight of Wands', ko: '완드 8', suit: 'wands', up: '신속·진전·소식', rev: '지연·성급·혼선' },
  { id: 'w09', name: 'Nine of Wands', ko: '완드 9', suit: 'wands', up: '인내·경계·끈기', rev: '소진·방어 과잉·포기 직전' },
  { id: 'w10', name: 'Ten of Wands', ko: '완드 10', suit: 'wands', up: '부담·책임 과중·압박', rev: '위임·내려놓음·번아웃' },
  { id: 'w11', name: 'Page of Wands', ko: '완드 시종', suit: 'wands', up: '열의·탐험·아이디어', rev: '산만·미성숙·지연',
    topics: {
      love: { up: '들뜬 설렘·새로운 만남에 대한 호기심·적극적 관심', rev: '변덕스러운 관심·미성숙한 태도·진전 더딤' },
      work: { up: '열정 가득한 도전·새 아이디어·탐험적 시도', rev: '집중력 부족·산만함·시작만 하고 흐지부지' },
      money: { up: '새 기회를 향한 의욕·시도해 볼 만한 아이디어', rev: '계획 부족·산만한 지출·실행 지연' },
      health: { up: '활동 의욕·새 운동에 대한 흥미·생기', rev: '작심삼일·꾸준함 부족·들쭉날쭉' },
      general: { up: '열의·탐험심·새 아이디어', rev: '산만함·미성숙·지연' },
    } },
  { id: 'w12', name: 'Knight of Wands', ko: '완드 기사', suit: 'wands', up: '모험·열정·행동', rev: '충동·무모·산만',
    topics: {
      love: { up: '열정적으로 다가옴·모험 같은 사랑·적극적 행동', rev: '불같이 식는 마음·충동적 행동·일관성 부족' },
      work: { up: '열정적 추진·모험적 도전·과감한 행동', rev: '충동적 결정·무계획·끝맺음 부족' },
      money: { up: '과감한 시도로 잡는 기회·적극적 실행', rev: '무모한 투자·충동 지출·변덕' },
      health: { up: '활기찬 도전·에너지 넘치는 활동·열정', rev: '무리한 과욕·들쭉날쭉·번아웃' },
      general: { up: '모험·뜨거운 열정·과감한 행동', rev: '충동·무모함·산만함' },
    } },
  { id: 'w13', name: 'Queen of Wands', ko: '완드 여왕', suit: 'wands', up: '자신감·매력·활력', rev: '질투·불안·소진',
    topics: {
      love: { up: '자신감 넘치는 매력·당당한 사랑·밝은 활기', rev: '질투와 불안·자존감 흔들림·기 소진' },
      work: { up: '카리스마 있는 주도·활력 있는 추진·매력적 영향력', rev: '불안과 조급·소진·예민함' },
      money: { up: '당당한 운용·활기찬 시도·자신감 있는 결정', rev: '불안한 판단·과시성 지출·소진' },
      health: { up: '생기 넘치는 활력·자신감 있는 관리·에너지', rev: '기력 소진·스트레스·번아웃' },
      general: { up: '자신감·매력·넘치는 활력', rev: '질투·불안·기력 소진' },
    } },
  { id: 'w14', name: 'King of Wands', ko: '완드 왕', suit: 'wands', up: '리더십·비전·추진력', rev: '독선·성급·과욕',
    topics: {
      love: { up: '듬직하게 이끄는 매력·비전을 함께 그리는 관계·당당함', rev: '일방적 주도·성급함·자기중심적 태도' },
      work: { up: '비전 있는 리더십·강한 추진력·통솔력', rev: '독선적 운영·과욕·성급한 결정' },
      money: { up: '큰 그림을 그리는 운용·과감한 추진·결단', rev: '과욕·무리한 확장·성급한 판단' },
      health: { up: '의지로 주도하는 관리·활력·강한 추진', rev: '무리한 과욕·과로·성급함' },
      general: { up: '리더십·비전·강한 추진력', rev: '독선·성급함·과욕' },
    } },
  // ── 펜타클 (土, 물질·현실) ──
  { id: 'p01', name: 'Ace of Pentacles', ko: '펜타클 에이스', suit: 'pentacles', up: '새 기회·번영·물질의 시작', rev: '기회 상실·탐욕·지연',
    topics: {
      love: { up: '안정적으로 뿌리내리는 관계·현실적 결실의 시작·든든함', rev: '현실적 조건의 벽·진전 지연·안정감 부족' },
      work: { up: '새 기회·실질적 성과의 출발·탄탄한 기반', rev: '기회 놓침·시작 지연·결실 더딤' },
      money: { up: '새 수입원·번영의 시작·실질적 기회', rev: '기회 상실·탐욕·재정 지연' },
      health: { up: '건강한 습관의 시작·안정된 회복·실질적 관리', rev: '관리 미루기·생활 불안정·소홀' },
      general: { up: '새 기회·실질적 번영의 시작·안정', rev: '기회 상실·지연·과욕' },
    } },
  { id: 'p02', name: 'Two of Pentacles', ko: '펜타클 2', suit: 'pentacles', up: '균형·유연·저글링', rev: '불균형·과부하·혼란' },
  { id: 'p03', name: 'Three of Pentacles', ko: '펜타클 3', suit: 'pentacles', up: '협업·기술·성장', rev: '부조화·미숙·갈등' },
  { id: 'p04', name: 'Four of Pentacles', ko: '펜타클 4', suit: 'pentacles', up: '안정·소유·보존', rev: '집착·인색·통제' },
  { id: 'p05', name: 'Five of Pentacles', ko: '펜타클 5', suit: 'pentacles', up: '결핍·어려움·소외', rev: '회복·도움·역경 통과' },
  { id: 'p06', name: 'Six of Pentacles', ko: '펜타클 6', suit: 'pentacles', up: '나눔·관용·균형', rev: '불공정·빚·조건부 도움' },
  { id: 'p07', name: 'Seven of Pentacles', ko: '펜타클 7', suit: 'pentacles', up: '인내·평가·기다림', rev: '조급·헛수고·재평가' },
  { id: 'p08', name: 'Eight of Pentacles', ko: '펜타클 8', suit: 'pentacles', up: '숙련·노력·집중', rev: '태만·완벽주의·정체' },
  { id: 'p09', name: 'Nine of Pentacles', ko: '펜타클 9', suit: 'pentacles', up: '자립·풍요·성취', rev: '과시·불안정·의존' },
  { id: 'p10', name: 'Ten of Pentacles', ko: '펜타클 10', suit: 'pentacles', up: '풍요·유산·안정된 가정', rev: '재정 문제·가족 갈등·불안정' },
  { id: 'p11', name: 'Page of Pentacles', ko: '펜타클 시종', suit: 'pentacles', up: '학습·실용·기회', rev: '게으름·비현실·미루기',
    topics: {
      love: { up: '진중하게 알아가는 관계·성실한 마음·신뢰를 쌓는 시작', rev: '진전 더딤·소극적 태도·현실감 부족' },
      work: { up: '배우며 성장하는 자세·실용적 기회·꾸준한 학습', rev: '게으름·집중 부족·미루는 습관' },
      money: { up: '실속 있는 기회·차근차근 모으기·실용적 계획', rev: '계획 부실·미루는 관리·비현실적 기대' },
      health: { up: '건강 정보를 배우고 실천·꾸준한 관리 시작', rev: '관리 미루기·게으름·작심삼일' },
      general: { up: '배움·실용·새 기회', rev: '게으름·미루기·현실감 부족' },
    } },
  { id: 'p12', name: 'Knight of Pentacles', ko: '펜타클 기사', suit: 'pentacles', up: '성실·근면·책임', rev: '정체·완고·지루함',
    topics: {
      love: { up: '한결같고 듬직한 사랑·책임감 있는 상대·꾸준한 정성', rev: '지루한 정체·답답한 변화 부족·완고함' },
      work: { up: '성실한 노력·책임감 있는 일처리·꾸준한 진전', rev: '진전 없는 정체·융통성 부족·지루함' },
      money: { up: '꾸준한 저축·성실한 관리·안정적 축적', rev: '제자리걸음·과한 보수성·기회 정체' },
      health: { up: '꾸준한 생활 관리·성실한 루틴·안정', rev: '변화 없는 정체·무료함·소극적 관리' },
      general: { up: '성실·근면·책임감', rev: '정체·완고함·지루함' },
    } },
  { id: 'p13', name: 'Queen of Pentacles', ko: '펜타클 여왕', suit: 'pentacles', up: '풍요·실용·돌봄', rev: '물질 집착·자기 소홀',
    topics: {
      love: { up: '따뜻하게 챙기는 사랑·현실적인 돌봄·안정된 풍요', rev: '물질에 치우친 관계·자기 돌봄 소홀·부담' },
      work: { up: '실용적이고 안정된 운영·세심한 관리·다재다능', rev: '일과 삶의 불균형·과부하·소진' },
      money: { up: '알뜰하고 풍요로운 관리·실용적 운용·여유', rev: '물질 집착·인색함과 과소비의 혼선' },
      health: { up: '몸과 생활을 두루 챙기는 균형·안정된 돌봄', rev: '자기 돌봄 뒷전·과로·소진' },
      general: { up: '풍요·실용적 돌봄·안정', rev: '물질 집착·자기 소홀·불균형' },
    } },
  { id: 'p14', name: 'King of Pentacles', ko: '펜타클 왕', suit: 'pentacles', up: '성공·안정·풍요', rev: '물질주의·완고·탐욕',
    topics: {
      love: { up: '든든하고 안정적인 사랑·믿음직한 울타리·여유로운 포용', rev: '물질로 재는 관계·완고함·소유욕' },
      work: { up: '성공과 안정·노련한 경영·풍요로운 성과', rev: '융통성 없는 고집·과한 욕심·보수성' },
      money: { up: '탄탄한 재력·안정적 자산·풍요로운 운용', rev: '물질주의·탐욕·인색한 집착' },
      health: { up: '안정된 생활 기반·여유로운 관리·풍요', rev: '과로 속 방심·완고한 습관·균형 상실' },
      general: { up: '성공·안정·풍요', rev: '물질주의·완고함·탐욕' },
    } },
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

// ── 주제별 풀이 룰 (카테고리 정합 — 같은 카드라도 그 주제의 언어로 읽는다) ──
// TopicKey 는 파일 상단에서 export. (love/work/money/health/general)
const TOPIC_KEYS: TopicKey[] = ['love', 'work', 'money', 'health', 'general'];

/** 임의 문자열 카테고리 key → 지원 TopicKey(미지원/미지정은 general 폴백). */
export function toTopicKey(key: string | undefined): TopicKey {
  return TOPIC_KEYS.includes(key as TopicKey) ? (key as TopicKey) : 'general';
}

// 주제 도메인 명사(메이저 비중 문장용)
const TOPIC_NOUN: Record<TopicKey, string> = {
  love: '관계', work: '일과 진로', money: '재물', health: '몸과 마음', general: '삶 전반',
};
// 주제 × 포지션 서사 프레임 — {현재/도전/뿌리/조언/결과} 키워드를 주제의 맥락에 끼워 읽는다.
const TOPIC_FRAME: Record<TopicKey, (k: { cur: string; ch: string; root: string; adv: string; out: string }) => string> = {
  love: (k) => `지금 마음과 관계에는 '${k.cur}'의 기류가 흐릅니다. 두 사람(혹은 다가올 인연) 사이의 과제는 '${k.ch}'이고, 그 밑바닥에는 '${k.root}'이 깔려 있어요. 관계를 위해서는 '${k.adv}' 쪽으로 움직여 보세요 — 이 흐름의 끝에는 '${k.out}'이 기다립니다.`,
  work: (k) => `일과 진로에서 지금 당신의 자리는 '${k.cur}'입니다. 눈앞의 벽은 '${k.ch}', 그 뿌리는 '${k.root}'에 닿아 있어요. 카드는 '${k.adv}'의 방향을 권합니다 — 그 길을 따르면 일의 흐름은 '${k.out}'으로 향해요.`,
  money: (k) => `돈의 흐름은 지금 '${k.cur}' 상태예요. 재물에서 부딪히는 과제는 '${k.ch}', 그 원인은 '${k.root}'과 얽혀 있습니다. '${k.adv}'를 지침 삼아 움직이면, 금전의 향방은 '${k.out}'으로 흘러갑니다.`,
  health: (k) => `몸과 마음의 컨디션은 지금 '${k.cur}'에 가깝습니다. 돌봐야 할 지점은 '${k.ch}'이고, 그 배경에는 '${k.root}'이 있어요. '${k.adv}'를 처방처럼 챙기면, 컨디션의 흐름은 '${k.out}' 쪽으로 향합니다.`,
  general: (k) => `지금 당신은 '${k.cur}'에서 출발해요. 여기서 마주한 과제는 '${k.ch}', 그 바탕엔 '${k.root}'이 자리합니다. 카드가 권하는 방향은 '${k.adv}', 그 끝에 기다리는 건 '${k.out}'입니다.`,
};
// 우세 수트 × 주제 — 그 기운이 '이 주제에서' 무슨 뜻인지 번역(일반론 금지).
const SUIT_TOPIC: Record<TopicKey, Record<Exclude<Suit, 'major'>, string>> = {
  love: {
    wands: '열정이 관계를 끌고 가는 모양새라, 적극적인 표현이 통하는 때예요.',
    cups: '감정의 교류가 핵심이에요 — 마음을 나누는 만큼 깊어집니다.',
    swords: '말과 판단이 관계를 좌우해요 — 오해가 생기면 바로 대화로 푸세요.',
    pentacles: '시간·돈·거리 같은 현실 조건이 관계에 크게 작용하는 때예요.',
  },
  work: {
    wands: '추진력에 힘이 실리는 시기 — 먼저 움직이는 사람이 기회를 가져갑니다.',
    cups: '사람과 팀워크가 일의 성패를 가릅니다 — 관계를 챙기는 게 곧 일이에요.',
    swords: '판단과 전략이 관건이에요 — 감이 아니라 근거로 결정하세요.',
    pentacles: '꾸준함과 실무 완성도가 그대로 평가로 이어지는 흐름이에요.',
  },
  money: {
    wands: '버는 기회가 활동량에 비례하는 흐름이에요 — 움직인 만큼 들어옵니다.',
    cups: '돈이 감정·관계와 얽혀 움직여요 — 기분에 따른 지출만 조심하세요.',
    swords: '숫자를 차갑게 따져보는 냉정함이 필요한 때예요.',
    pentacles: '재물 기운이 제 영역에 들어와 있어요 — 관리한 만큼 차곡차곡 쌓입니다.',
  },
  health: {
    wands: '에너지는 충분해요 — 과열과 무리만 조심하면 됩니다.',
    cups: '마음 상태가 몸으로 이어지는 때예요 — 감정을 돌보는 게 곧 건강 관리입니다.',
    swords: '신경이 곤두서기 쉬워요 — 머리를 쉬게 하는 것이 우선이에요.',
    pentacles: '잠·식사·운동 같은 생활 리듬이 컨디션을 결정합니다.',
  },
  general: {
    wands: '열정과 행동의 기운이 전반을 이끌어요 — 움직이며 풀리는 때입니다.',
    cups: '감정과 관계의 기운이 중심이에요 — 사람 속에서 답을 찾게 됩니다.',
    swords: '생각과 판단의 기운이 강해요 — 결정할 일들이 앞에 놓입니다.',
    pentacles: '현실과 안정의 기운이 깔려 있어요 — 기반을 다지기 좋은 때입니다.',
  },
};

// ── 수트 폴백 의미 (주제별) ──────────────────────────────────────────────
// 카드에 topics[주제]가 없을 때 사용할 '수트의 그 주제 의미'. 핀(숫자) 카드와, 일부 주제만
// 채운 카드의 빈 주제를 메운다. 수트의 원소적 결을 주제 언어로(컵=감정/관계, 펜타클=재물/현실,
// 소드=사고/갈등/결단, 완드=의욕/행동/성취). major 는 수트 폴백 없음(범용 up/rev 사용).
//   ⚠️ stance: RWS 표준 초안 — daniel 검수 필요(§4 안전: 과장·공포·단정 금지).
const SUIT_FALLBACK: Record<Exclude<Suit, 'major'>, Record<TopicKey, TopicMeaning>> = {
  cups: { // 水 — 감정·관계
    love: { up: '감정의 교류·마음을 나누는 흐름·정이 깊어짐', rev: '감정의 엇갈림·서운함·마음의 거리' },
    work: { up: '사람과의 관계·팀워크·정서적 만족', rev: '관계의 마찰·정서적 소진·의욕 저하' },
    money: { up: '기분 좋은 흐름·관계로 얻는 기회·만족', rev: '감정에 휘둘린 지출·기분 따라 흔들림' },
    health: { up: '마음의 안정이 몸으로·정서적 회복·여유', rev: '스트레스·정서 불안이 몸으로·소진' },
    general: { up: '감정과 관계의 기운·마음이 움직이는 흐름', rev: '감정의 동요·관계의 엇갈림·정서적 피로' },
  },
  pentacles: { // 土 — 재물·현실
    love: { up: '현실적으로 안정된 관계·꾸준한 신뢰·든든함', rev: '현실 조건의 벽·정체·안정감 부족' },
    work: { up: '꾸준한 노력·실질적 성과·탄탄한 기반', rev: '진전 정체·결실 지연·실속 부족' },
    money: { up: '재물 기운이 제 영역에·차곡차곡 쌓이는 흐름·안정', rev: '재정 정체·손실 주의·불안정' },
    health: { up: '생활 리듬과 체력 관리·꾸준한 안정·기반', rev: '생활 불균형·관리 소홀·체력 저하' },
    general: { up: '현실과 안정의 기운·기반을 다지는 흐름', rev: '정체·실속 부족·불안정' },
  },
  swords: { // 風 — 사고·갈등·결단
    love: { up: '솔직한 대화·명료해지는 마음·이성적 판단', rev: '오해와 갈등·상처 주는 말·마음의 벽' },
    work: { up: '명확한 판단·전략과 결단·핵심 통찰', rev: '판단 혼선·소통 마찰·갈등' },
    money: { up: '냉철한 분석·합리적 결단·정리', rev: '오판·성급한 결정·정보 혼선' },
    health: { up: '원인을 분명히 파악·이성적 관리·절제', rev: '신경 긴장·스트레스·불안한 생각' },
    general: { up: '생각과 판단의 기운·결정이 필요한 흐름', rev: '혼란·갈등·날 선 마음' },
  },
  wands: { // 火 — 의욕·행동·성취
    love: { up: '열정과 끌림·적극적 표현·활기찬 관계', rev: '식어가는 열정·조급함·일관성 부족' },
    work: { up: '추진력과 도전·의욕적 시도·성취', rev: '동력 저하·지연·산만함' },
    money: { up: '활동이 부르는 기회·과감한 시도·성취', rev: '추진력 부족·기회 지연·충동' },
    health: { up: '넘치는 활력·활동적 에너지·생기', rev: '기력 소진·무리·번아웃' },
    general: { up: '열정과 행동의 기운·움직이며 풀리는 흐름', rev: '의욕 저하·지연·산만함' },
  },
};

/**
 * 카드 1장의 '그 주제' 의미를 해석한다(정/역 반영). 폴백 체인:
 *   ① card.topics[주제]  → ② (수트가 메이저가 아니면) SUIT_FALLBACK[수트][주제]  → ③ 범용 up/rev.
 * 확대 모달·종합 풀이가 공통으로 쓰는 단일 진실원(주제 정합의 핵심).
 * @param topicKey 지원 TopicKey 또는 임의 문자열(toTopicKey 로 정규화).
 */
export function cardMeaning(card: TarotCard, reversed: boolean, topicKey: string | undefined): string {
  const tk = toTopicKey(topicKey);
  // ① 카드 고유 주제 의미
  const own = card.topics?.[tk];
  if (own) return reversed ? own.rev : own.up;
  // ② 수트 폴백(메이저 제외 — 메이저는 고유 의미가 없으면 범용으로)
  if (card.suit !== 'major') {
    const sf = SUIT_FALLBACK[card.suit][tk];
    if (sf) return reversed ? sf.rev : sf.up;
  }
  // ③ 범용 키워드
  return reversed ? card.rev : card.up;
}

/**
 * 전체 스프레드의 *조합* 종합 풀이 — 주제(topic)의 언어로 읽는다(카테고리 정합).
 * 룰: 주제별 서사 프레임(현재→도전→뿌리→조언→결과) + 메이저 비중(주제 도메인에 전환 기류)
 *     + 우세 수트의 주제 번역 + 정/역 비율(순조/점검) 톤. 온디바이스(LLM 0) — 통계+템플릿.
 * @param topic TARO_CATEGORIES 항목({key, ko}) — key 로 주제 프레임 선택(미지정/미지원 키는 general).
 * ★문구 stance 검수 = daniel 슬롯(통설 기반 초안).
 */
export function combineReading(cards: SpreadCard[], topic: { key: string; ko: string }): string[] {
  if (!cards.length) return [];
  const tk: TopicKey = toTopicKey(topic.key);
  const majors = cards.filter((c) => c.suit === 'major').length;
  const rev = cards.filter((c) => c.reversed).length;
  const cnt: Record<string, number> = { wands: 0, cups: 0, swords: 0, pentacles: 0 };
  cards.forEach((c) => { if (c.suit !== 'major') cnt[c.suit] += 1; });
  const dom = (Object.keys(cnt) as Exclude<Suit, 'major'>[]).sort((a, b) => cnt[b] - cnt[a])[0];
  // 키워드 추출: 주제 의미(cardMeaning)의 첫 토막을 핵심어로(범용 up/rev 절단이 아니라 주제 정합 우선).
  const k = (c: SpreadCard) => cardMeaning(c, c.reversed, tk).split('·')[0];
  const cur = cards[0], out = cards[cards.length - 1];
  const ch = cards[1] ?? cur, root = cards[2] ?? cur, adv = cards[3] ?? out;

  // ① 주제 서사: 5장 흐름을 그 주제의 맥락 문장으로
  const story = TOPIC_FRAME[tk]({ cur: k(cur), ch: k(ch), root: k(root), adv: k(adv), out: k(out) });
  // ② 기운 풀이: 메이저 비중(주제에 큰 전환 기류) + 우세 수트의 주제 번역 + 정/역 톤
  const tone = [
    majors >= 3
      ? `${TOPIC_NOUN[tk]}에 큰 전환의 기류가 움직이고 있어요 — 흐름을 거스르기보다 올라타는 때입니다.`
      : `${TOPIC_NOUN[tk]}은 당신이 직접 풀어갈 수 있는 현실적인 국면이에요.`,
    cnt[dom] >= 2 ? SUIT_TOPIC[tk][dom] : '',
    rev >= 4 ? '뒤집힌 카드가 많아요 — 서두르기보다 차분히 안을 정리하고 가면 좋아요.'
      : rev <= 1 ? '카드의 결이 순조로워요 — 큰 막힘 없이 풀려가는 흐름입니다.'
      : '잘 풀리는 부분과 점검할 부분이 함께 있어요 — 조언 카드를 기준 삼으세요.',
  ].filter(Boolean).join(' ');
  return [story, tone];
}
