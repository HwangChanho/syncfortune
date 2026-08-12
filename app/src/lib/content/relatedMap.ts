// app/src/lib/content/relatedMap.ts — 콘텐츠 연관 큐레이션(단일 출처·순수 데이터)
// ─────────────────────────────────────────────────────────────────────────
// kind → 이어서 보면 좋은 콘텐츠 2~3개. **두 곳이 같은 동선을 쓴다**:
//   ① 콘텐츠 상세 하단 크로스셀 — `components/RelatedContent`
//   ② 풀이 탭 '다음 단계' 히어로 — `lib/content/nextStep`(퍼널 진입점)
// 진입점과 상세 하단이 서로 다른 길을 제안하면 '타고타고 들어가는' 흐름이 끊기므로 한 곳에서만 정의한다.
//
// ★컴포넌트가 아니라 여기(lib/content)에 두는 이유: 순수 데이터라 RN 에 의존하지 않아야
//   하네스(check:nextstep)가 앱 런타임 없이 검증할 수 있다.
// ⚠️큐레이션 = 마케팅/UX 판단(명리 아님) — daniel 조정 슬롯.
// ─────────────────────────────────────────────────────────────────────────

/** kind → 연관 콘텐츠. 값은 유료 CreditKind 또는 무료 콘텐츠 키(personal 등) 혼합.
 *  ★2026-08-06 daniel 이 **체인을 직접 지정**했다(궁합→속궁합·연애스타일·관계패턴·사람들이 보는 나 등).
 *    노출 메뉴가 4카테고리×4항목으로 좁아진 대신, 나머지 35개는 **이 맵으로만 도달**한다 —
 *    즉 여기가 끊기면 그 콘텐츠는 검색 말고는 길이 없다. 항목을 뺄 때 반드시 체인을 함께 본다. */
export const RELATED: Record<string, string[]> = {
  reading: ['personal', 'roots', 'celeb', 'egen'],
  ziwei: ['mission', 'reading', 'astrology'],
  compat: ['sokgunghap', 'lovestyle', 'relationPattern', 'impression'],
  lovestyle: ['crush', 'reunion', 'love', 'taro'],   // 연애 스타일 → 애정흐름·궁합·짝사랑(daniel 07-27: 화면마다 추천이 달랐다)
  love: ['compat', 'crush', 'reunion'],
  career: ['jobfit', 'talent', 'job'],
  jobfit: ['career', 'talent', 'mission'],
  wealth: ['career', 'talent', 'mission', 'lifegraph'], // ★compat 추가(07-26): '혼자 vs 함께' 섹션을 읽은 뒤 실제 상대 궁합으로 잇는 동선 // 재물 딥리포트 → 사업가·직업적성·10년뒤(재물 동선)
  talent: ['jobfit', 'mission', 'personal'],
  mission: ['talent', 'roots', 'image'],
  roots: ['mission', 'image', 'talent'],
  image: ['personal', 'mission', 'talent'], // 비치는 나 → 퍼스널 오행(첫인상·컬러 동선)
  newyear: ['lifegraph', 'gaeun', 'love'],
  lifegraph: ['timeline', 'mission', 'country'],
  gaeun: ['personal', 'newyear', 'love'],   // 개운법 → 퍼스널 오행(컬러 보완 동선)
  astrology: ['reading', 'love', 'compat'],
  future10: ['career', 'timeline', 'gaeun'],
  child: ['love', 'compat', 'reading'],
  crush: ['love', 'compat', 'reunion'],
  reunion: ['love', 'crush', 'compat'],
  job: ['jobfit', 'career', 'talent'],
  timeline: ['lifegraph', 'newyear', 'roots'],
  daily: ['gaeun', 'bok', 'lifegraph', 'future10'],     // 오늘의 운세 하단 → 퍼스널 오행(코디)·개운·애정 동선(daniel 기획서②-피드백)
  personal: ['healing', 'talent', 'dayPillar'], // 퍼스널 오행 → 개운·연애스타일·애정

  // ── 2026-07-27 전면 부착(daniel "전부 붙여") — 추천이 없던 화면들의 큐레이션 ────────
  //   ⚠️추천 '대상'은 CreditKind 또는 personal/lovestyle 만 해석된다(그 외는 RelatedContent 가 걸러 낸다).
  //     그래서 무료 콘텐츠(행운·펫·타로 등)는 *출발지*로만 쓰고, 도착지는 유효 키로만 골랐다.
  //   ⚠️큐레이션 = 마케팅/UX 판단(명리 아님) — ★daniel 조정 슬롯.
  bok: ['gaeun', 'mission', 'roots'],
  charts: ['reading', 'ziwei', 'timeline'],
  country: ['roots', 'celeb', 'image'],
  crushAsk: ['crush', 'love', 'compat'],
  dayPillar: ['reading', 'love', 'career'],
  dream: ['taemong', 'gaeun', 'mission'],
  taemong: ['dream', 'child', 'gaeun'],
  egenteto: ['personal', 'lovestyle', 'image'],
  healing: ['gaeun', 'mission', 'personal'],
  impression: ['image', 'personal', 'celeb'],
  jobAsk: ['jobfit', 'joseonjob', 'talent'],
  joseonjob: ['career', 'jobfit', 'talent'],
  luck: ['gaeun', 'mission', 'dream'],
  mbti: ['personal', 'lovestyle', 'image'],
  month: ['timeline', 'gaeun', 'future10'],
  name: ['roots', 'reading', 'image'],
  pastlife: ['roots', 'celeb', 'image'],
  personatype: ['personal', 'lovestyle', 'image'],
  pet: ['child', 'compat', 'love'],
  relationpattern: ['compat', 'love', 'crush'],
  reunionAsk: ['reunion', 'love', 'compat'],
  selfanalysis: ['reading', 'talent', 'career'],
  sokgunghap: ['compat', 'love', 'lovestyle'],
  taegil: ['gaeun', 'newyear', 'mission'],
  taro: ['dream', 'gaeun', 'mission'],
  timeResolve: ['reading', 'ziwei', 'timeline'],
};
