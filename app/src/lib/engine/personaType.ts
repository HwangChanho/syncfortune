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
};

// ── ① 일간 물상(R23) ─────────────────────────────────────────────────────
//   image = 그 천간의 형상. tone = 기질 어휘. 이미지 생성 프롬프트의 주 피사체가 된다.
const STEM: Record<Stem, { elem: string; image: string; chip: string; tone: string; trait: string; art: string }> = {
  甲: { elem: '木', image: '큰 나무', chip: '곧음', tone: '곧고 위로 뻗는', trait: '시작하는 힘과 명분이 분명해 앞장서는 결', art: 'a tall straight ancient tree' },
  乙: { elem: '木', image: '덩굴꽃', chip: '유연함', tone: '유연하게 감기는', trait: '부드럽게 파고들어 끝내 자리를 잡는 끈질긴 결', art: 'a slender flowering vine' },
  丙: { elem: '火', image: '태양', chip: '밝음', tone: '밝고 널리 퍼지는', trait: '드러내고 비추는 힘이 커 사람이 모이는 결', art: 'a radiant sun over open sky' },
  丁: { elem: '火', image: '등불', chip: '섬세함', tone: '따뜻하고 섬세한', trait: '가까운 곳을 깊이 밝히는 정교하고 다정한 결', art: 'a warm lantern flame in darkness' },
  戊: { elem: '土', image: '큰 산', chip: '묵직함', tone: '두텁고 흔들리지 않는', trait: '버티고 품어 기준이 되어 주는 묵직한 결', art: 'a vast mountain ridge' },
  己: { elem: '土', image: '기름진 밭', chip: '보살핌', tone: '낮고 부드럽게 품는', trait: '남을 키워 내며 실속을 챙기는 세심한 결', art: 'fertile terraced farmland' },
  庚: { elem: '金', image: '무쇠 도끼', chip: '결단', tone: '단단하고 거침없는', trait: '끊고 밀어붙여 판을 정리하는 결단의 결', art: 'a forged iron blade' },
  辛: { elem: '金', image: '벼린 칼', chip: '예리함', tone: '예리하고 정갈한', trait: '정밀하게 다듬어 값을 만드는 전문성의 결', art: 'a polished gemstone catching light' },
  壬: { elem: '水', image: '큰 강', chip: '스케일', tone: '넓고 끊임없이 흐르는', trait: '멀리 보고 크게 굴리는 활동의 결', art: 'a wide flowing river at dusk' },
  癸: { elem: '水', image: '이슬비', chip: '총명함', tone: '맑고 스며드는', trait: '조용히 살펴 속을 읽어 내는 총명의 결', art: 'soft rain on still water' },
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
    // 이미지 생성 씨앗 — 주 피사체(일간 물상) + 배경(월지 계절). scripts 가 톤 레시피를 덧붙인다.
    imagePrompt: `${s.art}, ${b.scene}, oriental ink and gold accent, mystical, no text`,
  };
}

/** 120종 전체 키(이미지 배치 생성·관리자 화면용). */
export function allPersonaKeys(): string[] {
  const stems: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return stems.flatMap((s) => branches.map((b) => `${s}${b}`));
}
