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

/** kind → 연관 콘텐츠. 값은 유료 CreditKind 또는 무료 콘텐츠 키(personal 등) 혼합. */
export const RELATED: Record<string, string[]> = {
  reading: ['love', 'career', 'talent'],
  ziwei: ['mission', 'reading', 'astrology'],
  compat: ['love', 'crush', 'reunion'],
  lovestyle: ['love', 'compat', 'crush'],   // 연애 스타일 → 애정흐름·궁합·짝사랑(daniel 07-27: 화면마다 추천이 달랐다)
  love: ['compat', 'crush', 'reunion'],
  career: ['jobfit', 'talent', 'job'],
  jobfit: ['career', 'talent', 'mission'],
  wealth: ['career', 'compat', 'jobfit'], // ★compat 추가(07-26): '혼자 vs 함께' 섹션을 읽은 뒤 실제 상대 궁합으로 잇는 동선 // 재물 딥리포트 → 사업가·직업적성·10년뒤(재물 동선)
  talent: ['jobfit', 'mission', 'personal'],
  mission: ['talent', 'roots', 'image'],
  roots: ['mission', 'image', 'talent'],
  image: ['personal', 'mission', 'talent'], // 비치는 나 → 퍼스널 오행(첫인상·컬러 동선)
  newyear: ['lifegraph', 'gaeun', 'love'],
  lifegraph: ['newyear', 'roots', 'career'],
  gaeun: ['personal', 'newyear', 'love'],   // 개운법 → 퍼스널 오행(컬러 보완 동선)
  astrology: ['reading', 'love', 'compat'],
  future10: ['career', 'timeline', 'gaeun'],
  child: ['love', 'compat', 'reading'],
  crush: ['love', 'compat', 'reunion'],
  reunion: ['love', 'crush', 'compat'],
  job: ['jobfit', 'career', 'talent'],
  timeline: ['lifegraph', 'newyear', 'roots'],
  daily: ['personal', 'gaeun', 'love'],     // 오늘의 운세 하단 → 퍼스널 오행(코디)·개운·애정 동선(daniel 기획서②-피드백)
  personal: ['gaeun', 'lovestyle', 'love'], // 퍼스널 오행 → 개운·연애스타일·애정
};
