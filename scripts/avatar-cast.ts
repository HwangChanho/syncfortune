/**
 * scripts/avatar-cast.ts — 상담가 **열두 얼굴의 단일 원본**(캐스팅 시트)
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"다른 친구들 실사 이미지 작업하자 · 미남 미녀 이미지면 좋겠어"*.
 *
 * ■ 왜 코드에 두는가 (문서가 아니라)
 *   같은 인물 설정이 ①Boss 에게 주는 안내지 ②이미지 생성 프롬프트 ③업로드 스크립트
 *   세 군데에 필요하다. 문서·스크립트에 따로 적으면 **말없이 갈라진다**
 *   ([[duplicate-ui-single-source]] — 주석의 "같다"는 보장이 아니다).
 *   ⇒ 여기 하나만 고치면 브리프(`npm run avatars:brief`)·생성(`avatars:gen`)이 같이 따라온다.
 *
 * ■ 성별·나이는 **말투 설정(persona)에서 끌어온 것**이지 내가 새로 지은 성격이 아니다.
 *   근거를 `why` 에 함께 적어 둔다 — Boss 가 뒤집을 때 무엇을 근거로 정했는지 보이게.
 *   바꾸려면 이 파일의 한 줄만 고치면 된다(재빌드 불필요 — 이미지 재생성만).
 *
 * ■ ★★실존 인물은 만들지 않는다
 *   `nossem`(노쌤)은 실존 인물이라 `real: true` — 생성 대상에서 **제외**된다.
 *   나머지 열하나는 가상의 인물이며, 프롬프트에 "특정 실존 인물·연예인을 닮지 말 것"을
 *   negative 로 못 박는다.
 *
 * ■ ⚠️규격이 왜 정사각인가 (지난주에 두 번 당한 함정)
 *   앱은 사진을 **44px·22px 동그라미**에 `cover` 로 넣는다. 세로 사진을 주면 찌그러지지 않고
 *   **위아래가 잘린다**(=머리·턱이 날아간다). 고장처럼 안 보여서 그냥 지나친다
 *   ([[session-2026-08-23-handoff]]). ⇒ 원본부터 **1:1 정사각**, 얼굴은 중앙 원 안에.
 */

/** 한 사람의 캐스팅 정보. `prompt` 는 여기 필드들로 `buildPrompt()` 가 조립한다. */
export type CastMember = {
  /** consultants.id — 저장 경로(`consultants/<id>.jpg`)와 파일명이 그대로 이것이다 */
  id: string;
  /** 앱에 보이는 이름 */
  name: string;
  /** consultants.tagline — 하는 일 */
  role: string;
  /** 'teacher' = 선생님 AI · 'friend' = 함께하면 좋은 친구들 */
  group: 'teacher' | 'friend';
  /** 성별(생성 프롬프트용). 실존 인물이면 undefined */
  sex?: '남' | '여';
  /** 나이대 텍스트(한국어 표기용) */
  age?: string;
  /** 프롬프트에 들어가는 나이 범위(영문) */
  ageEn?: string;
  /** 한국어 인상 한 줄 — Boss 가 읽고 판단하는 칸 */
  impression?: string;
  /** 성별·나이·인상을 그렇게 정한 근거(persona 의 어느 대목인가) */
  why?: string;
  /** 외모·헤어·의상(영문, 프롬프트 본문) */
  look?: string;
  /** 배경·조명(영문, 프롬프트 본문) */
  bg?: string;
  /** 이 사람만의 주의사항(한국어) — 없으면 생략 */
  caution?: string;
  /** 이 사람만 추가로 붙는 negative(색 정확도처럼 개별 제약이 있을 때) */
  extraNegative?: string;
  /** true = 실존 인물 → **생성 금지**(사진은 Boss 가 직접 준다) */
  real?: boolean;
};

/**
 * 열두 명 공통 촬영 규격(영문 프리픽스).
 *
 * ★44px 동그라미에서 살아남는 사진의 조건이 전부 여기 들어 있다 —
 *   ①얼굴이 프레임의 중앙에 크게 ②눈이 위쪽 1/3 ③배경은 단순·흐리게.
 *   전신·원거리 사진은 그 크기에서 **누구인지 식별 불가**라 아예 negative 로 막는다.
 */
/**
 * ★**한국 전통 상담가 결**(Boss 2026-08-25 *"실제 무속인처럼 꾸며서 보여줘야 할꺼같고"*).
 *
 * ■ 왜 이 결로 정했나
 *   Boss 지시는 *"무속인처럼"* 이지만, 우리가 하는 것은 **명리(命理)** 다 — 글을 읽는 학문이지
 *   신내림·굿이 아니다. 그래서 **한국 전통 역술가**의 결로 간다:
 *   한복·한지·서재·붓·목재. 이국적이고 신비롭되 **앱이 하는 일과 그림이 맞는다.**
 *   ⚠️굿·부적·촛불 제단 같은 무속 기호는 쓰지 않는다(도메인이 틀리고, 심사에서도 불리하다).
 *
 * ■ 색은 **앱 팔레트를 따른다** — 카멜(2026-08-25 전환). 종전 배경의 라벤더 기를 걷었다.
 */
const TRADITION =
  'wearing a modern hanbok-inspired top with clean lines (jeogori-style collar or wrapped neckline), ' +
  'natural fabric texture in warm earth tones — camel, ochre, deep brown, off-white hanji paper tone, ' +
  'set in a quiet traditional Korean study: hanji paper wall, dark wood, soft daylight through a lattice window, ' +
  'calm and grounded presence of someone who reads and interprets, not theatrical';

export const HOUSE_STYLE =
  'photorealistic portrait photograph, square 1:1 composition, head-and-shoulders framing, ' +
  'face centered in the frame and filling about 60% of the frame height, eyes on the upper third, ' +
  'top of head about 10% below the top edge, shoulders at the bottom edge, ' +
  'shot on 85mm portrait lens at f/2.0, face tack sharp, background softly out of focus, ' +
  'soft natural key light from front-left with gentle fill, no harsh shadow across the face, ' +
  'natural skin texture with visible pores and fine hair detail, subtle natural retouching, ' +
  'attractive photogenic Korean face, editorial headshot for a mobile app profile, high detail';

/**
 * 열두 명 공통 negative.
 *
 * ★두 가지를 특히 막는다:
 *   ①**작은 동그라미에서 죽는 구도**(전신·원거리·이마/턱 잘림·기울어진 수평)
 *   ②**실존 인물 닮음**(가상의 인물이어야 한다 — 초상권·퍼블리시티)
 */
export const NEGATIVE =
  'text, watermark, logo, signature, caption, border, frame, collage, ' +
  'plastic skin, airbrushed, waxy, doll-like, uncanny, over-smoothed, heavy beauty filter, ' +
  'anime, illustration, painting, drawing, 3d render, cgi, cartoon, stylized, ' +
  'full body, distant shot, small face, off-center face, cropped forehead, cropped chin, tilted horizon, ' +
  'multiple people, extra person in background, extra limbs, extra fingers, deformed hands, hands near face, ' +
  'sunglasses, hat covering the face, mask, cosplay, ' +
  'celebrity, famous person, recognizable public figure, ' +
  'cluttered background, busy pattern, brand logo on clothing, ' +
  'oversaturated, harsh direct flash, heavy vignette, low quality, blurry, jpeg artifacts';

/**
 * 열두 명. 순서는 앱 목록(`consultants.sort_order`)과 같다.
 * ★`persona` 원문은 DB(consultants.persona)에 있다 — 여기 `why` 는 그 요약이다.
 */
export const CAST: CastMember[] = [
  {
    id: 'nossem',
    name: '노쌤',
    role: '사주 전반',
    group: 'teacher',
    real: true,
    caution: '★실존 인물 — 생성하지 않는다. 사진은 Boss 가 준 파일을 쓴다(이미 등록됨).',
  },
  {
    id: 'love_seoyun',
    name: '한서윤',
    role: '연애 · 궁합',
    group: 'teacher',
    sex: '여',
    age: '20대 후반~30대 초',
    ageEn: 'late 20s',
    impression: '감정을 먼저 받아 주고 편에 서는 사람. 마주 앉아 듣는 얼굴 — 눈이 먼저 웃는다.',
    why: 'persona: "아 그거 진짜 속상하죠" 처럼 공감 먼저 · 말끝 "-죠?" "-잖아요" · 탓하지 않는다',
    look:
      'a warm and beautiful Korean woman in her late 20s, shoulder-length soft wavy dark brown hair, ' +
      'warm-toned light makeup, smiling eyes, gentle closed-lip smile, cream-colored soft knit top, ' +
      'leaning very slightly toward the camera as if listening',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window',
  },
  {
    id: 'guide_minjae',
    name: '강민재',
    role: '사업 · 재물',
    group: 'teacher',
    sex: '남',
    age: '30대 중후반',
    ageEn: 'mid 30s',
    impression: '위로보다 방법을 먼저 주는 사람. 과장하지 않는 표정, 단정한 차림.',
    why: 'persona: 숫자와 시기를 좋아해 "언제까지 무엇을" · 말끝 "-습니다"/"-요" 혼용 · 과장하지 않는다',
    look:
      'a handsome composed Korean man in his mid 30s, neat short black hair, clean-shaven, ' +
      'calm confident expression with a faint closed-lip smile, straight posture, ' +
      'charcoal dress shirt with no tie under a dark navy blazer',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window',
  },
  {
    id: 'tarot_harin',
    name: '정하린',
    role: '타로',
    group: 'teacher',
    sex: '여',
    age: '20대 후반',
    ageEn: 'late 20s',
    impression: '장면을 그리듯 말하고 여운을 남기는 사람. 어두운 배경, 차분한 조명.',
    why: 'persona: "지금 카드에는 …가 보여요" · 문장이 짧고 여운이 있다 · 단정하지 않는다',
    look:
      'an elegant beautiful Korean woman in her late 20s, long straight black hair, ' +
      'cool-toned soft makeup with deep berry lip, calm knowing gaze into the camera, ' +
      'quiet mysterious expression, black or dark burgundy silk blouse, small delicate gold earrings',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window' +
      'candle-warm accent far out of focus',
  },
  {
    id: 'tarot_doyun',
    name: '송도윤',
    role: '고민 정리',
    group: 'teacher',
    sex: '남',
    age: '30대 초',
    ageEn: 'early 30s',
    impression: '말하기보다 듣는 쪽. 재촉하지 않는 인상, 부드럽게 낮춘 시선.',
    why: 'persona: 먼저 "무엇이 제일 걸리세요?" 하고 묻는다 · 느긋하고 결론을 서두르지 않는다',
    caution: '시선을 완전히 내리면 44px 에서 눈이 사라진다 — **살짝 낮추되 카메라를 본다**.',
    look:
      'a gentle handsome Korean man in his early 30s, soft medium-length black hair slightly tousled, ' +
      'thin round metal glasses, quiet attentive expression, chin very slightly lowered but eyes on the camera, ' +
      'oatmeal-colored knit sweater',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window',
  },
  {
    id: 'ziwei_yujin',
    name: '최자미',
    role: '인생 흐름',
    group: 'teacher',
    sex: '여',
    age: '30대 후반~40대 초',
    ageEn: 'late 30s',
    impression: '지금 일을 큰 구간에 놓고 보는 사람. 차분하고 정적인 구도.',
    why: 'persona: "올해만 보면 답답한데, 흐름으로 보면 …" · 말이 차분하고 조금 느리다',
    look:
      'a refined graceful Korean woman in her late 30s, dark hair with soft volume neatly styled, ' +
      'serene composed expression, direct steady gaze, mature elegance, ' +
      'deep plum or navy silk blouse, minimal jewelry',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window',
  },
  {
    id: 'astro_taehyun',
    name: '성태현',
    role: '운의 타이밍',
    group: 'teacher',
    sex: '남',
    age: '20대 후반',
    ageEn: 'late 20s',
    impression: '가볍고 밝게 말하며 자주 되묻는 사람. 호기심 있는 표정.',
    why: 'persona: 호기심이 많아 되묻는 편 · 말끝이 가볍고 밝다 · "지금은 아니고, 조금 뒤"',
    look:
      'a bright handsome Korean man in his late 20s, clean-cut short black hair, ' +
      'open curious expression with an easy natural smile, one eyebrow very slightly raised, ' +
      'light blue oxford shirt with the top button open',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window',
  },
  {
    id: 'beauty_jjinya',
    name: '차예린',
    role: '메이크업',
    group: 'friend',
    sex: '여',
    age: '20대 중반',
    ageEn: 'mid 20s',
    impression: '텐션이 높고 말이 빠른 사람. 밝고 채도 있는 톤.',
    why: 'persona: "이거 완전 언니 스타일!" 처럼 감탄사 · 칭찬을 아끼지 않는다 · 말끝 "-야" "-지"',
    look:
      'a strikingly pretty Korean woman in her mid 20s, glossy styled long hair, ' +
      'polished K-beauty glam makeup with dewy skin, defined brows and coral lip, ' +
      'lively bright smile with visible energy, chic black top',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window',
  },
  {
    id: 'color_bombom',
    name: '한봄',
    role: '어울리는 색',
    group: 'friend',
    sex: '여',
    age: '20대 후반',
    ageEn: 'late 20s',
    impression: '색을 말할 때 이유를 함께 주는 사람. 차분하고 설명을 잘한다.',
    why: 'persona: "얼굴이 화사해 보이는 건 …이라서요" · 따뜻함/차가움 기준으로 정리 · 말끝 "-요"',
    caution:
      '★색을 다루는 사람이라 **사진의 색이 정확해야 한다** — 색 캐스트가 도는 조명·배경은 쓰지 않는다(안내지에도 명시된 조건).',
    extraNegative: 'color cast, tinted lighting, colored gel light, orange or blue tinted background',
    look:
      'a clean-featured lovely Korean woman in her late 20s, simple straight hair, ' +
      'natural true-to-tone makeup, warm approachable but composed expression, ' +
      'plain soft white top with no pattern',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window' +
      'no color cast anywhere in the frame',
  },
  {
    id: 'car_unni',
    name: '차유나',
    role: '차 고르기',
    group: 'friend',
    sex: '여',
    age: '30대 초',
    ageEn: 'early 30s',
    impression: '툭툭 던지고 결론부터 말하는 사람. 꾸밈 적은 편안한 인상.',
    why: 'persona: "그 예산이면 이 급이 낫지" · 단점을 숨기지 않는다 · 말끝 "-지" "-야"',
    look:
      'a cool good-looking Korean woman in her early 30s, low-maintenance straight bob or loose ponytail, ' +
      'minimal makeup, relaxed confident half-smile, slight head tilt, direct frank gaze, ' +
      'simple denim shirt over a plain black tee',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window',
  },
  {
    id: 'travel_jini',
    name: '여지니',
    role: '여행',
    group: 'friend',
    sex: '여',
    age: '20대 중반',
    ageEn: 'mid 20s',
    impression: '들뜨고 장소가 그려지게 말하는 사람. 야외광이 어울린다.',
    why: 'persona: "거긴 아침이 진짜 좋아요" 처럼 시간대·감각을 함께 준다 · 느낌표를 쓴다',
    look:
      'a bright pretty Korean woman in her mid 20s, sun-kissed healthy skin, ' +
      'hair lightly moved by a breeze, wide open genuine smile, ' +
      'casual white linen shirt',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window' +
      'hint of sky and greenery, no landmark',
  },
  {
    id: 'heal_yuri',
    name: '서유리',
    role: '마음 돌보기',
    group: 'friend',
    sex: '여',
    age: '30대 초',
    ageEn: 'early 30s',
    impression: '느리고 조용하며 문장 사이에 쉼이 있는 사람. 부드러운 저채도.',
    why: 'persona: 해결하려 들지 않고 곁에 있어 준다 · "그랬군요" 를 먼저 한다 · 말끝 "-요"',
    look:
      'a serene beautiful Korean woman in her early 30s, hair loosely tied back with a few soft strands, ' +
      'soft low-contrast natural makeup, calm gentle eyes, faint reassuring smile, ' +
      'oatmeal or sage linen shirt',
    bg: 'clean softly blurred hanji-paper and dark-wood interior in warm camel tones, soft daylight from a lattice window',
  },
];

/**
 * 한 사람의 최종 생성 프롬프트를 조립한다.
 *
 * @param m 캐스팅 정보
 * @returns `{ prompt, negative }` — 이미지 생성기에 그대로 넣는 영문 문자열
 * @throws 실존 인물(`real: true`)이면 생성 금지이므로 오류를 던진다
 */
export function buildPrompt(m: CastMember): { prompt: string; negative: string } {
  if (m.real) throw new Error(`${m.name}(${m.id}) 은 실존 인물 — 이미지를 생성하지 않는다`);
  // ★전통 레이어는 **look 뒤·bg 앞**에 넣는다 — 인물 묘사를 먼저 잡고 의상·공간을 얹는 순서.
  //   ⚠️노쌤은 실존 인물이라 애초에 생성 대상이 아니다(`real: true`).
  const prompt = [HOUSE_STYLE, m.look, TRADITION, m.bg].filter(Boolean).join(', ');
  const negative = [NEGATIVE, m.extraNegative].filter(Boolean).join(', ');
  return { prompt, negative };
}

/** 생성 대상(=실존 인물을 뺀 열한 명). */
export const TO_GENERATE = CAST.filter((m) => !m.real);
