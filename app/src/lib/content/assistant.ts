// app/src/lib/content/assistant.ts — '팔자 도우미' 안내 트리 + 자연어 매칭(순수·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-30: "ai 코치를 컨텐츠 유도 용도로만 쓰자 ai 챗봇 느낌으로. 풀이말고,
//   직접 클릭해서 타고가기 귀찮은 사람들이 **api 진짜 비용 최소한으로** 쓸 수 있게.
//   사주·타로·자미두수 기준으로 먼저 잡고 그다음 하위 카테고리 콘텐츠들 안내·설명·이동.
//   이름도 '팔자 도우미'."
//
// ★설계의 핵심 = **API 0원**.
//   종전 코치는 매 질문마다 Sonnet + 원국 전체 + 보유 풀이를 프롬프트에 실어 보냈다(가장 비싼 경로).
//   그런데 사용자가 실제로 원하는 건 대개 "그 콘텐츠까지 데려다 달라"였다 — 그건 LLM 없이 된다.
//   → 안내는 전부 **결정론**(이 파일). 서버 왕복 0 · 토큰 0 · 오프라인에서도 동작.
//
// ★★LLM 을 안 쓰는 두 번째 이유(더 중요): LLM 은 **없는 콘텐츠를 지어낸다.**
//   "재물운 심층편을 보세요"처럼 존재하지 않는 상품으로 안내하면 최악이다.
//   여기 키는 전부 SECTIONS 에 실재하고, `npm run check:assistant` 가 매번 대조한다.
//
// 구조(3단):
//   ① 도메인   사주 / 타로 / 자미두수        ← daniel 지정 최상위 축
//   ② 주제     애정·관계 / 일·돈 / 시기 …    ← 사주만 깊다(콘텐츠가 여기 몰려 있다)
//   ③ 콘텐츠   SECTIONS 의 실제 카드(이미지·설명·라우트는 SECTIONS 단일 출처에서 가져온다)
//
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────

/** 최상위 축(daniel 지정). 값은 UI 칩 순서와 같다. */
export type AssistDomain = 'saju' | 'tarot' | 'ziwei';

export type AssistTopic = {
  key: string;              // 주제 id(내부)
  domain: AssistDomain;
  label: string;            // 칩·말풍선에 쓰는 이름
  line: string;             // 도우미가 말하는 한 줄(무엇을 볼 수 있는지)
  items: string[];          // ★SECTIONS 의 key(또는 creditKey) — 실재해야 한다(하네스 대조)
};

export type AssistDomainMeta = { key: AssistDomain; label: string; line: string };

/** 도메인 3종 — 도우미가 처음 내미는 선택지. */
export const ASSIST_DOMAINS: AssistDomainMeta[] = [
  { key: 'saju', label: '사주', line: '타고난 구조와 지금의 흐름을 봐요. 가장 많은 풀이가 여기 있어요.' },
  { key: 'tarot', label: '타로', line: '지금 이 순간의 마음을 한 장으로 봐요. 매일 무료예요.' },
  { key: 'ziwei', label: '자미두수', line: '12궁 성반으로 삶의 자리를 봐요. 사주와 다른 각도예요.' },
];

/**
 * 주제 → 콘텐츠. **위에서부터** UI 순서다.
 * ★items 에 적는 키는 contentSections 의 `key` 또는 `creditKey` 여야 한다.
 *   (DeepDiveCta·ContentGrid 가 같은 규칙으로 이미지·라우트를 찾는다 — 단일 출처)
 */
export const ASSIST_TOPICS: AssistTopic[] = [
  // ── 사주 ────────────────────────────────────────────────────────────────
  {
    key: 'love', domain: 'saju', label: '애정·관계',
    line: '인연의 흐름, 지금 그 사람과의 결, 반복되는 관계 패턴을 봐요.',
    items: ['love', 'compat', 'reunion', 'crush', 'relationPattern', 'lovestyle'],
  },
  {
    key: 'work', domain: 'saju', label: '일·돈',
    line: '나에게 맞는 일, 이직·취업 시기, 재물이 모이는 결을 봐요.',
    items: ['jobfit', 'job', 'career', 'wealth', 'talent'],
  },
  {
    key: 'timing', domain: 'saju', label: '시기·흐름',
    line: '언제 움직이면 좋은지, 앞으로의 굴곡을 연도로 봐요.',
    items: ['timeline', 'lifegraph', 'newyear', 'future10', 'taegil'],
  },
  {
    key: 'self', domain: 'saju', label: '나 알기',
    line: '내가 어떤 사람인지, 타고난 강점과 첫인상까지 봐요.',
    items: ['saju', 'persona', 'selfAnalysis', 'impression', 'mbti', 'egen'],
  },
  {
    key: 'today', domain: 'saju', label: '오늘·이달',
    line: '오늘의 기운과 이달의 흐름은 무료로 매일 볼 수 있어요.',
    items: ['today', 'month', 'dayPillar', 'manse'],
  },
  {
    key: 'family', domain: 'saju', label: '가족·자식',
    line: '자식과의 결, 뿌리(조상·가계)의 흐름을 봐요.',
    items: ['child', 'roots', 'name'],
  },
  {
    key: 'remedy', domain: 'saju', label: '개운·관리',
    line: '지금 할 수 있는 것부터 정리해 드려요.',
    items: ['gaeun', 'mission', 'healing', 'gem', 'personal'],
  },
  {
    key: 'fun', domain: 'saju', label: '가볍게',
    line: '재미로 보는 것들이에요. 부담 없이 눌러 보세요.',
    items: ['pastlife', 'joseonjob', 'bok', 'celeb', 'country', 'luck', 'pet', 'dream'],
  },

  // ── 타로 ────────────────────────────────────────────────────────────────
  {
    key: 'tarotDaily', domain: 'tarot', label: '타로 한 장',
    line: '주제를 고르고 한 장을 뽑아요. 하루 한 번 무료예요.',
    items: ['taro'],
  },

  // ── 자미두수 ────────────────────────────────────────────────────────────
  {
    key: 'ziweiChart', domain: 'ziwei', label: '자미두수 풀이',
    line: '12궁 성반으로 봐요. 사주와 겹치는 부분·다른 부분을 함께 읽어요.',
    items: ['ziwei'],
  },
  {
    key: 'ziweiCompat', domain: 'ziwei', label: '자미 궁합',
    line: '궁합은 사주와 자미 두 각도로 같이 봐요.',
    items: ['compat'],
  },
];

// ── 자연어 매칭(키워드) ──────────────────────────────────────────────────
// ★"챗봇 느낌"의 실체 = 사용자가 아무렇게나 써도 알아듣는 것. LLM 없이 하려면 **동의어를 넓게** 깔아야 한다.
//   여기 못 걸리면 도우미는 지어내지 않고 **선택지를 다시 내민다**(잘못된 안내보다 낫다).
type Rule = { topic: string; words: string[] };

/** 주제 매칭 — 구체적인 말이 먼저 걸리게 위에서부터. */
const TOPIC_RULES: Rule[] = [
  { topic: 'love', words: ['연애', '사랑', '애정', '인연', '남자친구', '여자친구', '남친', '여친', '썸', '짝사랑', '고백', '재회', '헤어', '이별', '전남친', '전여친', '결혼', '배우자', '궁합', '잘 맞', '소개팅', '연애운'] },
  { topic: 'work', words: ['일', '직업', '직장', '취업', '이직', '퇴사', '면접', '합격', '적성', '진로', '커리어', '승진', '사업', '돈', '재물', '재산', '수입', '금전', '월급', '빚', '투자할', '부업'] },
  { topic: 'timing', words: ['언제', '시기', '올해', '내년', '앞으로', '몇 살', '타이밍', '흐름', '대운', '세운', '길일', '날 잡', '택일', '10년'] },
  { topic: 'self', words: ['나는', '내가 어떤', '성격', '성향', '어떤 사람', '강점', '장점', '재능', '잘하는', '자기이해', '첫인상', 'mbti', '유형'] },
  { topic: 'today', words: ['오늘', '이달', '이번 달', '내일', '일진', '만세력', '명식', '일주'] },
  { topic: 'family', words: ['자식', '자녀', '아이', '임신', '출산', '부모', '가족', '조상', '이름', '작명'] },
  { topic: 'remedy', words: ['개운', '좋아지려면', '어떻게 해야', '방법', '해소', '힐링', '부적', '보석', '색', '관리'] },
  { topic: 'fun', words: ['전생', '조선', '복', '유명인', '연예인', '닮은', '나라', '반려', '강아지', '고양이', '꿈', '해몽', '재미'] },
  { topic: 'tarotDaily', words: ['타로', '카드 뽑', '한 장'] },
  { topic: 'ziweiChart', words: ['자미', '두수', '성반', '12궁', '자미두수'] },
];

/** 도메인만 언급한 경우(주제까지는 안 좁혀진 상태) */
const DOMAIN_RULES: Array<{ domain: AssistDomain; words: string[] }> = [
  { domain: 'tarot', words: ['타로'] },
  { domain: 'ziwei', words: ['자미', '두수', '성반'] },
  { domain: 'saju', words: ['사주', '팔자', '명리'] },
];

export type AssistMatch =
  | { kind: 'topic'; topic: AssistTopic }
  | { kind: 'domain'; domain: AssistDomain }
  | { kind: 'none' };

/**
 * 사용자가 쓴 말 → 안내 대상.
 * @param text 자유 입력(또는 추천 질문)
 * @returns topic(가장 좋음) · domain(덜 좁혀짐) · none(선택지 다시 제시)
 *
 * ★순서: 주제가 먼저다. "타로로 연애 볼래" 처럼 둘 다 걸리면 **더 구체적인 주제**를 준다.
 *   단 타로·자미 주제는 도메인 단어 자체가 주제 단어라 자연히 맞물린다.
 */
export function matchAssist(text: string): AssistMatch {
  const q = (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return { kind: 'none' };
  for (const r of TOPIC_RULES) {
    if (r.words.some((w) => q.includes(w.toLowerCase()))) {
      const topic = ASSIST_TOPICS.find((t) => t.key === r.topic);
      if (topic) return { kind: 'topic', topic };
    }
  }
  for (const r of DOMAIN_RULES) {
    if (r.words.some((w) => q.includes(w.toLowerCase()))) return { kind: 'domain', domain: r.domain };
  }
  return { kind: 'none' };
}

/** 도메인의 주제 목록(UI 순서 보존). */
export function topicsOf(domain: AssistDomain): AssistTopic[] {
  return ASSIST_TOPICS.filter((t) => t.domain === domain);
}

/** 하네스·검증용 — 안내가 가리키는 콘텐츠 키 전부(중복 제거). */
export function assistItemKeys(): string[] {
  return [...new Set(ASSIST_TOPICS.flatMap((t) => t.items))];
}

/** 첫 인사에 함께 보여줄 예시 질문(자유 입력이 뭘 알아듣는지 알려 준다). */
export const ASSIST_EXAMPLES: string[] = [
  '연애운 보고 싶어',
  '이직 시기 언제야',
  '오늘 기운 어때',
  '타로 한 장 뽑을래',
];
