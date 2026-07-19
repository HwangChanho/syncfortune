// app/src/lib/engine/personaType.ts — 사주 성격유형 120종 (일간 10 × 월지 12), 무료·온디바이스·API 0
// ─────────────────────────────────────────────────────────────────────────
// daniel 요청(2026-07-18): 성격유형을 120가지로 분류해 홈에 노출(기준 = 적용/대표 명식).
//
// ★분류 축 = **일간(10) × 월지(12)** — daniel 확정.
//   근거: 전문가 검수 **"전체 기운은 월지만 봐도 된다 · 월지를 뺀 모든 글자가 힘을 합쳐도 월지를 못 이긴다 ·
//   기준점은 월지의 계절"**(2026-07-14). 일간=나 자신, 월지=내가 놓인 계절·격의 근거(R55).
//   → 격국(월지 본기 십신)은 이 조합에서 파생되므로 정보 손실이 없다.
//
// ★120개를 손으로 쓰지 않고 **3축 조합으로 생성**한다:
//   ① 일간 물상(R23 천간 형상화 — 甲=동량목·辛=보석/칼 …)
//   ② 월지 계절·기운(조후의 출발점)
//   ③ **일간→월지 십신**(= 격, R55) ← 변별력의 핵심. 같은 辛金이라도 卯월(재)과 子월(식상)은 다른 사람이다.
//   이러면 daniel 검수 대상이 120개가 아니라 **22개 항목 + 조합 규칙**으로 줄어든다(★검수 슬롯).
//
// ⚠️ 명리 stance = daniel ground truth. 아래 물상·기질 어휘는 기존 규칙(R23 물상·R39 십신 영역·
//    전문가 월지 절대우위)에서 파생한 *Claude Code 초안*이며 daniel 검수/수정 슬롯이다.
// ⚠️ §4 안전: 단정·부정 증폭 금지. 약점은 반드시 '관리축'으로. 의료·심리 진단 금지.
// ─────────────────────────────────────────────────────────────────────────
import type { Stem, Branch, TenGod } from '@engine/../spec/chart';

export type PersonaType = {
  key: string;          // '辛卯' — 일간+월지
  name: string;         // 유형명(홈 카드 타이틀)
  keywords: string[];   // 칩 3개
  summary: string;      // 홈 카드·상세 공통 한 문단
  element: string;      // 일간 오행(테마색·이미지 톤)
  season: string;       // 월지 계절
  gyeok: TenGod | '?';  // 격(월지 본기 십신) — R55
  imagePrompt: string;  // 120장 이미지 생성용 프롬프트 씨앗(scripts/persona-images)
  dayStem: string;      // 일간 글자(폴백 카드에 크게 표시 — 이미지 120장 생성 전까지의 시각 앵커)
  monthBranch: string;  // 월지 글자(위와 같음)
  /**
   * 상세 화면이 쓰는 **조합 원재료** — 3축(일간 물상 / 월지 계절 / 격)을 따로 보여주기 위한 것.
   * ★상세 화면에서 명리 어휘를 새로 지어내지 않으려고 노출한다. 여기 담긴 문구는 전부 아래
   *   STEM·BRANCH·GYEOK 22개 항목에서 그대로 온 값이다(= daniel 검수 대상이 22개로 유지된다).
   */
  parts: {
    stemImage: string;  // 일간 물상('벼린 칼')
    stemTrait: string;  // 일간 기질 문장
    stemTone: string;   // 일간 결('예리하고 정갈한')
    seasonMood: string; // 월지 계절 기운
    gyeokLabel: string; // 격 이름표('기회') — 격을 못 구하면 빈 문자열
    gyeokAxis: string;  // 격의 무게중심 문장 — 격을 못 구하면 빈 문자열
  };
};

// ── ① 일간 물상(R23) ─────────────────────────────────────────────────────
//   image = 그 천간의 형상. tone = 기질 어휘. art/char/symbol = 이미지 생성 재료.
//
// ★char/symbol (daniel 2026-07-19 "케릭터화 · 상징성 강하게" 확정 = D4 톤):
//   성격유형 카드는 '사물 그림'이 아니라 **그 물상의 성격을 가진 인물 캐릭터**로 간다.
//   · char   = 캐릭터 아키타입(어떤 사람인가). 천간 음양을 결에 반영 — 양간(甲丙戊庚壬)=당당·전면,
//              음간(乙丁己辛癸)=섬세·정교. ★성별은 지정하지 않는다(사용자 성별과 무관해야 하므로).
//   · symbol = 화면을 지배할 핵심 상징물. **따로 떼어 '크게'를 강제**하는 게 핵심 —
//              캐릭터 묘사 안에 상징을 섞어 넣었더니 丙(태양)이 '그냥 붉은 머리 소녀'로 나왔다(실측 실패).
//   ⚠️어휘는 시각 표현이라 명리 판정이 아니지만, 물상 해석은 R23 기반이므로 daniel 검수 슬롯이다.
const STEM: Record<Stem, {
  elem: string; image: string; chip: string; tone: string; trait: string; art: string;
  char: string; symbol: string;
}> = {
  甲: { elem: '木', image: '큰 나무', chip: '곧음', tone: '곧고 위로 뻗는', trait: '시작하는 힘과 명분이 분명해 앞장서는 결', art: 'a tall straight ancient tree',
        char: 'an upright noble guardian with a calm commanding presence', symbol: 'a great ancient tree with vast spreading branches' },
  乙: { elem: '木', image: '덩굴꽃', chip: '유연함', tone: '유연하게 감기는', trait: '부드럽게 파고들어 끝내 자리를 잡는 끈질긴 결', art: 'a slender flowering vine',
        char: 'a graceful supple figure with a quietly persistent air', symbol: 'lush flowering vines curling and blossoming' },
  丙: { elem: '火', image: '태양', chip: '밝음', tone: '밝고 널리 퍼지는', trait: '드러내고 비추는 힘이 커 사람이 모이는 결', art: 'a radiant sun over open sky',
        char: 'a radiant figure crowned with light, warm and outgoing', symbol: 'a blazing golden sun disc radiating rays' },
  丁: { elem: '火', image: '등불', chip: '섬세함', tone: '따뜻하고 섬세한', trait: '가까운 곳을 깊이 밝히는 정교하고 다정한 결', art: 'a warm lantern flame in darkness',
        char: 'a gentle attentive figure with a soft glowing warmth', symbol: 'a large ornate lantern with a living flame' },
  戊: { elem: '土', image: '큰 산', chip: '묵직함', tone: '두텁고 흔들리지 않는', trait: '버티고 품어 기준이 되어 주는 묵직한 결', art: 'a vast mountain ridge',
        char: 'a steadfast broad-shouldered figure, immovable and protective', symbol: 'a towering mountain ridge and great boulders' },
  己: { elem: '土', image: '기름진 밭', chip: '보살핌', tone: '낮고 부드럽게 품는', trait: '남을 키워 내며 실속을 챙기는 세심한 결', art: 'fertile terraced farmland',
        char: 'a nurturing warm figure with an unhurried caring air', symbol: 'golden ripening grain fields and fertile earth' },
  庚: { elem: '金', image: '무쇠 도끼', chip: '결단', tone: '단단하고 거침없는', trait: '끊고 밀어붙여 판을 정리하는 결단의 결', art: 'a forged iron blade',
        char: 'a resolute warrior figure with an unflinching gaze', symbol: 'a massive forged iron axe and sparking anvil' },
  辛: { elem: '金', image: '벼린 칼', chip: '예리함', tone: '예리하고 정갈한', trait: '정밀하게 다듬어 값을 만드는 전문성의 결', art: 'a polished gemstone catching light',
        char: 'an elegant precise figure with a refined poised bearing', symbol: 'a gleaming polished blade and brilliant cut gemstones' },
  壬: { elem: '水', image: '큰 강', chip: '스케일', tone: '넓고 끊임없이 흐르는', trait: '멀리 보고 크게 굴리는 활동의 결', art: 'a wide flowing river at dusk',
        char: 'a bold far-gazing voyager with a wide open bearing', symbol: 'a vast flowing river and surging waves' },
  癸: { elem: '水', image: '이슬비', chip: '총명함', tone: '맑고 스며드는', trait: '조용히 살펴 속을 읽어 내는 총명의 결', art: 'soft rain on still water',
        char: 'a serene perceptive mystic with quiet knowing eyes', symbol: 'fine silver rain, drifting mist and still water ripples' },
};

// 일간 오행 → 이미지 색조. 앱의 '일간 오행별 앱색'(2026-07-15 리디자인)과 같은 결로 맞춘다.
const ELEM_COLOR: Record<string, string> = {
  木: 'jade green', 火: 'warm crimson', 土: 'golden ochre', 金: 'silver white', 水: 'deep indigo',
};

/** 받침 유무로 목적격 조사(을/를) 선택 — '기회을/돌파을' 같은 비문 방지. */
function eul(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return '를';        // 한글이 아니면 기본값
  return (last - 0xac00) % 28 === 0 ? '를' : '을';        // 받침 없음 → 를
}

// ── ② 월지 계절·기운(조후의 출발점) ──────────────────────────────────────
const BRANCH: Record<Branch, { season: string; mood: string; scene: string }> = {
  寅: { season: '이른 봄', mood: '얼어붙은 땅을 밀어 올리며 새로 여는', scene: 'early spring forest, first buds' },
  卯: { season: '한봄', mood: '한창 자라 뻗어 나가는', scene: 'lush spring meadow in full bloom' },
  辰: { season: '늦봄', mood: '축축한 흙에 기운을 갈무리하는', scene: 'damp spring earth after rain' },
  巳: { season: '초여름', mood: '빠르게 달아오르며 퍼지는', scene: 'bright early summer light' },
  午: { season: '한여름', mood: '가장 뜨겁게 드러나는', scene: 'blazing midsummer noon' },
  未: { season: '늦여름', mood: '무르익어 거두기 직전의', scene: 'golden late summer field' },
  申: { season: '초가을', mood: '서늘해지며 결실을 다듬는', scene: 'crisp early autumn air' },
  酉: { season: '한가을', mood: '단단하게 여물어 갈무리하는', scene: 'harvest ripe autumn orchard' },
  戌: { season: '늦가을', mood: '거둔 것을 창고에 넣고 마무리하는', scene: 'dry late autumn dusk' },
  亥: { season: '초겨울', mood: '물이 깊어지며 안으로 모으는', scene: 'still deep winter water' },
  子: { season: '한겨울', mood: '가장 고요히 안으로 응축하는', scene: 'silent midwinter night' },
  丑: { season: '늦겨울', mood: '언 땅 속에서 봄을 준비하는', scene: 'frozen soil before thaw' },
};

// ── ③ 격(월지 본기 십신) → 삶의 무게중심(R39 십신 영역과 같은 결) ────────
const GYEOK: Record<string, { label: string; axis: string; kw: string }> = {
  비견: { label: '자립', axis: '스스로 서서 동등하게 겨루는', kw: '주체' },
  겁재: { label: '경쟁', axis: '겨루고 나누며 몰아치는', kw: '승부' },
  식신: { label: '표현', axis: '꾸준히 만들어 내놓는', kw: '몰입' },
  상관: { label: '재능', axis: '틀을 넘어 드러내는', kw: '재기' },
  정재: { label: '실속', axis: '차곡차곡 쌓아 지키는', kw: '성실' },
  편재: { label: '기회', axis: '크게 벌여 굴리는', kw: '수완' },
  정관: { label: '규범', axis: '자리와 명예를 지키는', kw: '책임' },
  편관: { label: '돌파', axis: '압력을 힘으로 바꾸는', kw: '결단' },
  정인: { label: '축적', axis: '배우고 받아 안정을 만드는', kw: '학습' },
  편인: { label: '통찰', axis: '남다른 각도로 파고드는', kw: '직관' },
};

/**
 * 일간 + 월지 → 성격유형(120종 중 하나).
 * @param dayStem      일간(천간)
 * @param monthBranch  월지(지지)
 * @param gyeok        월지 본기 십신(= 격, R55 detectPattern 의 name 에서 '격' 제거한 값)
 * ※ gyeok 을 못 구하면(구버전 차트) 계절·물상만으로 서술한다 — 없는 걸 지어내지 않는다.
 */
export function personaOf(dayStem: Stem, monthBranch: Branch, gyeok?: string): PersonaType {
  const s = STEM[dayStem], b = BRANCH[monthBranch];
  const g = gyeok ? GYEOK[gyeok] : undefined;
  const name = `${b.season}의 ${s.image}`;                     // 예: '한봄의 벼린 칼'
  const keywords = [s.chip, b.season, g?.kw ?? s.elem].filter(Boolean).slice(0, 3);
  const summary = g
    ? `${b.season}의 ${s.image} 같은 사람이에요. ${b.mood} 계절에 태어나 ${s.trait}${eul(s.trait)} 타고났고, 삶의 무게중심은 ${g.axis} 쪽(${g.label})에 놓여 있어요. 그래서 ${s.tone} 방식으로 ${g.label}${eul(g.label)} 풀어 갑니다.`
    : `${b.season}의 ${s.image} 같은 사람이에요. ${b.mood} 계절에 태어나 ${s.trait}${eul(s.trait)} 타고났어요.`;
  return {
    key: `${dayStem}${monthBranch}`,
    name, keywords, summary,
    element: s.elem, season: b.season, gyeok: (gyeok as TenGod) ?? '?',
    // 이미지 생성 씨앗(daniel 2026-07-19 확정 톤 = 동양 판타지 인물 흉상). 실측 실패 3건에서 도출한 필수 조건:
    //   ① **구도를 맨 앞에** 둔다 — 뒤에 두면 SDXL 이 무시한다(허리위 지시가 씹혀 전신·팔벌린 그림이 나왔다).
    //   ② **흉상(가슴 위) 크롭** — 손·발을 프레임 밖으로 빼 기형을 원천 차단(daniel "막 손가락 6개").
    //      허리 위 + 소매 감춤도 시도했으나, 도끼·칼을 '드는' 유형에서 손이 다시 나와 뭉개졌다(庚申 실측).
    //   ③ 상징은 **손에 들리지 않고 배경에 크게 떠 있게** — 들게 하면 손이 필연적으로 등장한다.
    //      또 캐릭터 묘사에 상징을 섞으면 상징이 묻힌다(丙=태양이 '그냥 소녀'로 나온 실패).
    //   ※symbol 은 이미 관사·크기 형용사(great/blazing/towering…)를 품으므로 'a huge' 를 덧대지 않는다(관사 중복).
    imagePrompt: `close-up bust portrait, head and shoulders only, tightly cropped at the chest, `
      + `stylized oriental fantasy character, ${s.char}, wearing hanbok-inspired robes, `
      + `${s.symbol} floating large in the background behind them, ${b.scene} softly beyond, `
      + `${ELEM_COLOR[s.elem]} color atmosphere with gold accents, `
      + `painterly digital art, centered single character, no text`,
    dayStem, monthBranch,
    // 상세 화면용 원재료(3축을 따로 렌더) — 전부 위 22개 항목에서 온 값. 격이 없으면 격 칸만 빈 문자열.
    parts: {
      stemImage: s.image, stemTrait: s.trait, stemTone: s.tone,
      seasonMood: b.mood,
      gyeokLabel: g?.label ?? '', gyeokAxis: g?.axis ?? '',
    },
  };
}

/**
 * 이미지 생성용 공통 negative 프롬프트 — imagePrompt 와 **한 쌍**이라 여기 함께 둔다.
 * (프롬프트만 정본화하고 negative 를 스크립트에 흘리면, 나중에 재생성할 때 손 기형이 다시 살아난다.)
 * 손·발 항목이 앞쪽에 몰려 있는 이유: 흉상 크롭으로 1차 차단하고 여기서 2차로 막는 이중 방어.
 */
export const IMAGE_NEGATIVE_PROMPT =
  'hands, fingers, extra fingers, six fingers, fused fingers, malformed hands, bad hands, '
  + 'poorly drawn hands, mutated hands, extra limbs, extra arms, deformed feet, bad feet, '
  + 'bad anatomy, disfigured, long neck, full body, legs, feet, '
  + 'text, letters, words, numbers, watermark, signature, logo, '
  + 'blurry, low quality, cluttered, multiple characters, crowd, nsfw, photo, 3d render, '
  + 'tarot card, crescent moon, zodiac symbols';

/** 120종 전체 키(이미지 배치 생성·관리자 화면용). */
export function allPersonaKeys(): string[] {
  const stems: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return stems.flatMap((s) => branches.map((b) => `${s}${b}`));
}
