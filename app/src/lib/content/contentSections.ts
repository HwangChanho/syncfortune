// src/lib/content/contentSections.ts — 콘텐츠 카드 목록(단일 출처) + 가격/배지 헬퍼
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-18 IA 개편: 홈에 있던 카드 그리드(35장)를 **하단탭 '풀이'**(/contents)로 분리하면서
//   데이터(이 파일)와 렌더(components/ContentGrid.tsx)를 갈랐다.
//   ★분리 이유: 홈·풀이탭 두 곳에 SECTIONS를 복사하면 카드 하나 추가할 때마다 두 파일을 고쳐야 하고,
//     한쪽을 빠뜨리는 드리프트가 난다(이 프로젝트 반복 실수 패턴). 목록은 여기 한 곳만 고친다.
//
// ※카드를 추가할 때 확인할 것(신규=기존틀 동일 원칙):
//   ① 아래 SECTIONS에 항목 추가 → ② i18n(menu.*·menu.*Desc) ko/en/ja 3종 → ③ 라우트 파일 생성
//   ④ 유료면 coupons.ts CREDIT_KINDS + Edge interpret SERVER_GATED 등록 → ⑤ 유료면 homeTeaser freeHook 티저
// ─────────────────────────────────────────────────────────────────────────
import { CREDIT_KINDS, type CreditKind } from '../billing/coupons';

/** 콘텐츠 카드 1장. premium=프리미엄 허브(사주·자미 등), content=무료 온디바이스 진입 광고 대상, creditKey=유료 결제 키. */
export type MenuItem = {
  key: string;            // React 키 + 티저 매핑 키(homeTeaser). 같은 라우트를 두 번 노출할 땐 반드시 고유(hot* 접두)
  labelKey: string;       // i18n 라벨 키
  descKey?: string;       // i18n 설명 키(티저가 있으면 티저가 우선)
  image?: any;            // 카드 이미지(없으면 텍스트 카드로 렌더)
  route: string;          // 진입 라우트
  ready: boolean;         // false = '준비 중' 안내만
  premium?: boolean;      // 프리미엄 범주(라벨 골드)
  content?: boolean;      // 무료 온디바이스 = 진입 시 보상형 광고 1회
  creditKey?: CreditKind; // 유료 = 가격/쿠폰/풀이있음 배지 대상
};
export type Section = { key: string; titleKey: string; descKey?: string; items: MenuItem[] };

// ── 가격 배지 ────────────────────────────────────────────────────────────
// 유료 콘텐츠 가격 배지 — 정가(19,900) 대비 할인율 + 건당 할인가(₩). 건당가는 CREDIT_KINDS(coupons) 단일 출처.
//   무료(온디바이스) 콘텐츠는 creditKey 없음 → 배지 미표시.
const LIST_PRICE_ORIG = 19900; // 사주·자미 정가(할인율 표시 기준, daniel 06-28)
const CREDIT_PRICE: Record<string, number> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.price]));
/** 천단위 콤마(Hermes Intl 비의존). @example wonFmt(4900) → '₩4,900' */
export const wonFmt = (n: number) => '₩' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 프리미엄 미포함(개별구매 전용) — 프리미엄 명식이어도 '무제한' 배지를 주지 않는다. */
export const HOME_INDIVIDUAL = new Set(['dream', 'followup', 'timeresolve']);
/** 개별 가격 배지 문구. 정가(할인 0/음수)면 금액만. @param key creditKey */
export const priceLabel = (key: string) => {
  const p = CREDIT_PRICE[key] ?? 0;
  const disc = Math.round((1 - p / LIST_PRICE_ORIG) * 100);
  return disc > 0 ? `${disc}% · ${wonFmt(p)}` : wonFmt(p);
};

// ── 콘텐츠 카드 목록 ─────────────────────────────────────────────────────
// 무료 / 프리미엄 / 콘텐츠 3범주(daniel 기획, docs/기획_정보구조_v0.1.md).
//   · 무료: 온디바이스·룰(API 0). · 프리미엄: 사주·자미 2허브(각 풀이·타임라인·궁합). · 콘텐츠: 무료+유료 혼합.
//   명식 등록·전환은 홈 상단 ChartPicker(그리드 제외).
export const SECTIONS: Section[] = [
  // ★자기이해 먼저(App Store 4.3, daniel 07-11): 정밀분석('나는 어떤 사람인가')을 최상단으로.
  //   프리미엄 = 사주·자미 2허브(각 허브 안에 원국풀이·타임라인 큰 카드) + 궁합 독립(사주+자미 교차, daniel).
  { key: 'premium', titleKey: 'menu.secPremium', descKey: 'menu.secPremiumDesc', items: [
    // premium 섹션 5종 — creditKey 부여(배지=badgeFor 명식별 상태: 프리미엄「무제한」·풀이있음「풀이있음·만료일」·쿠폰「쿠폰 N장」·그 외 개별가, daniel 07-08).
    { key: 'saju', labelKey: 'menu.saju', descKey: 'menu.sajuDesc', image: require('../../../assets/icons/premium.jpg'), route: '/reading', ready: true, premium: true, creditKey: 'reading' },        // 허브 제거 → 원국풀이 직접 진입(daniel 07-01)
    { key: 'ziwei', labelKey: 'menu.ziweiHub', descKey: 'menu.ziweiHubDesc', image: require('../../../assets/icons/ziwei.jpg'), route: '/ziwei', ready: true, premium: true, creditKey: 'ziwei' },        // 허브 제거 → 자미 원국풀이 직접
    { key: 'compat', labelKey: 'menu.compat', descKey: 'menu.compatDesc', image: require('../../../assets/icons/compat.jpg'), route: '/compat', ready: true, premium: true, creditKey: 'compat' },
    { key: 'timeline', labelKey: 'menu.timeline', descKey: 'menu.timelineDesc', image: require('../../../assets/icons/timeline.jpg'), route: '/timeline', ready: true, premium: true, creditKey: 'timeline' }, // 연도별 인생 타임라인 = 프리미엄 4종(사주·자미·궁합·타임라인) — 홈 리스트 누락 수정(daniel 07-02)
    // 신규(daniel 2026-07-02): 자식운 = 프리미엄 5번째 콘텐츠(프리미엄 무료·비프리미엄 개별 유료).
    { key: 'child', labelKey: 'menu.child', descKey: 'menu.childDesc', image: require('../../../assets/icons/child.jpg'), route: '/child', ready: true, premium: true, creditKey: 'child' },
  ] },
  // 오늘·명식(만세력·오늘/이달의 운세·일주) — 자기이해 섹션 아래로(daniel 07-11).
  { key: 'free', titleKey: 'menu.secFree', items: [
    { key: 'manse', labelKey: 'menu.manse', descKey: 'menu.manseDesc', image: require('../../../assets/icons/manse.jpg'), route: '/charts', ready: true },
    { key: 'today', labelKey: 'menu.today', descKey: 'menu.todayTileDesc', image: require('../../../assets/icons/today.jpg'), route: '/today', ready: true },
    { key: 'month', labelKey: 'menu.month', descKey: 'menu.monthTileDesc', image: require('../../../assets/icons/month.jpg'), route: '/month', ready: true },
    { key: 'dayPillar', labelKey: 'menu.dayPillar', descKey: 'menu.dayPillarDesc', image: require('../../../assets/icons/dayPillar.jpg'), route: '/dayPillar', ready: true },
  ] },
  // ★인기(daniel 07-06: '가장 많이 찾는'→'인기'로 개칭·서브타이틀 제거). 유료 유도(재회/짝사랑/취업) + 인기 무료(연애스타일·반려동물) 혼합.
  //   무료 '질문형' 원본은 '가볍게 보기'에도 그대로 있다(의도된 중복) — ★키는 고유(hot*)로 React 키 충돌 방지.
  { key: 'hot', titleKey: 'menu.secContent', items: [
    { key: 'hotReunionAsk', labelKey: 'menu.reunionAsk', descKey: 'menu.reunionAskDesc', image: require('../../../assets/icons/reunion.jpg'), route: '/reunionAsk', ready: true, content: true },
    { key: 'hotCrushAsk', labelKey: 'menu.crushAsk', descKey: 'menu.crushAskDesc', image: require('../../../assets/icons/crush.jpg'), route: '/crushAsk', ready: true, content: true },
    { key: 'hotJobAsk', labelKey: 'menu.jobAsk', descKey: 'menu.jobAskDesc', image: require('../../../assets/icons/job.jpg'), route: '/jobAsk', ready: true, content: true },
    // daniel 07-06: 인기에 연애스타일·반려동물 추가(무료 온디바이스, light 원본과 동일·hot* 고유키).
    { key: 'hotLovestyle', labelKey: 'menu.lovestyle', descKey: 'menu.lovestyleTileDesc', image: require('../../../assets/icons/lovestyle.jpg'), route: '/lovestyle', ready: true, content: true },
    { key: 'hotPet', labelKey: 'menu.pet', descKey: 'menu.petDesc', image: require('../../../assets/icons/pet.jpg'), route: '/pet', ready: true, content: true },
    // 커뮤니티는 하단 탭바(BottomNav)로 이동 — 카드에서 제거, 탭에서 상시 접근(원격 플래그 게이트는 BottomNav 쪽).
  ] },
  // 스페셜 = 유료 LLM 콘텐츠(애정흐름·인생그래프·신년 등). 골드 라인아트 타일 이미지(Recraft).
  { key: 'special', titleKey: 'menu.secSpecial', descKey: 'menu.secContentDesc', items: [
    // daniel(2026-06-24): 신년운세 = 시즌 콘텐츠라 리스트 제일 앞.
    { key: 'newyear', labelKey: 'menu.newyear', descKey: 'menu.newyearTileDesc', image: require('../../../assets/icons/newyear.jpg'), route: '/newyear', ready: true, content: true, creditKey: 'newyear' },
    { key: 'love', labelKey: 'menu.love', descKey: 'menu.loveDesc', image: require('../../../assets/icons/love.jpg'), route: '/love', ready: true, content: true, creditKey: 'love' },
    // ※속궁합(sokgunghap)은 결정론(온디바이스·API 0)이라 무료 → '가볍게 보기'(light) 섹션으로 이동(daniel 07-18). 원격 플래그 게이트는 유지.
    // 신규(daniel 2026-07-05): 재회·짝사랑·취업 유료 깊은 풀이. 무료 '질문형' 진입은 '가볍게 보기'에서 결정론 미리보기 → 이 유료로 유도(daniel 모델).
    { key: 'reunion', labelKey: 'menu.reunion', descKey: 'menu.reunionDesc', image: require('../../../assets/icons/reunion.jpg'), route: '/reunion', ready: true, content: true, creditKey: 'reunion' },
    { key: 'crush', labelKey: 'menu.crush', descKey: 'menu.crushDesc', image: require('../../../assets/icons/crush.jpg'), route: '/crush', ready: true, content: true, creditKey: 'crush' },
    { key: 'job', labelKey: 'menu.job', descKey: 'menu.jobDesc', image: require('../../../assets/icons/job.jpg'), route: '/job', ready: true, content: true, creditKey: 'job' },
    { key: 'lifegraph', labelKey: 'menu.lifegraph', descKey: 'menu.lifegraphDesc', image: require('../../../assets/icons/lifegraph.jpg'), route: '/lifegraph', ready: true, content: true, creditKey: 'lifegraph' },
    // 신규(daniel 2026-07-02): 10년 뒤 나의 모습(대운·세운 스페셜, 개별 유료).
    { key: 'future10', labelKey: 'menu.future10', descKey: 'menu.future10Desc', image: require('../../../assets/icons/future10.jpg'), route: '/future10', ready: true, content: true, creditKey: 'future10' },
  ] },
  // 심층 분석(daniel 2026-06) — 사주/자미 깊은 해석 유료. timeResolve(태어난 시 찾기)도 자기이해 진입점으로 배치.
  { key: 'deep', titleKey: 'menu.secDeep', descKey: 'menu.secDeepDesc', items: [
    // TPR: 시 모르는 사용자가 인생 사건으로 시를 좁히는 결정론 도구(LLM 0). 990 1회 결제로 도구 영구 해제(daniel 06-28).
    { key: 'timeResolve', labelKey: 'menu.timeResolve', descKey: 'menu.timeResolveDesc', image: require('../../../assets/icons/timeResolve.jpg'), route: '/timeResolve', ready: true, creditKey: 'timeresolve' },
    { key: 'roots', labelKey: 'menu.roots', descKey: 'menu.rootsDesc', image: require('../../../assets/icons/roots.jpg'), route: '/roots', ready: true, content: true, creditKey: 'roots' },
    { key: 'image', labelKey: 'menu.image', descKey: 'menu.imageDesc', image: require('../../../assets/icons/image.jpg'), route: '/image', ready: true, content: true, creditKey: 'image' },
    { key: 'mission', labelKey: 'menu.mission', descKey: 'menu.missionDesc', image: require('../../../assets/icons/mission.jpg'), route: '/mission', ready: true, content: true, creditKey: 'mission' },
    { key: 'talent', labelKey: 'menu.talent', descKey: 'menu.talentDesc', image: require('../../../assets/icons/talent.jpg'), route: '/talent', ready: true, content: true, creditKey: 'talent' },
    // 신규(daniel 2026-06-23): 별자리 운세(유료 LLM). ※수비학은 무료화(온디바이스·API 0)되어 light 섹션으로 이동.
    { key: 'astrology', labelKey: 'menu.astrology', descKey: 'menu.astrologyDesc', image: require('../../../assets/icons/astrology.jpg'), route: '/astrology', ready: true, content: true, creditKey: 'astrology' },
    // 신규(daniel 2026-06): 사업가의 나 vs 직장인의 나.
    { key: 'career', labelKey: 'menu.career', descKey: 'menu.careerDesc', image: require('../../../assets/icons/career.jpg'), route: '/career', ready: true, content: true, creditKey: 'career' },
    // 신규(daniel 2026-07-13): 나에게 어울리는 직업(직업 적성 딥리포트 EEL — career 사업가vs직장인과 별개).
    { key: 'jobfit', labelKey: 'menu.jobfit', descKey: 'menu.jobfitDesc', image: require('../../../assets/icons/jobfit.jpg'), route: '/jobfit', ready: true, content: true, creditKey: 'jobfit' },
    // daniel #18(2026-06-24): 맞춤 개운법(원국+지금 운 → 구체 처방·살풀이). 부적/만다라 이미지.
    { key: 'gaeun', labelKey: 'menu.gaeun', descKey: 'menu.gaeunDesc', image: require('../../../assets/icons/gaeun.jpg'), route: '/gaeun', ready: true, content: true, creditKey: 'gaeun' },
  ] },
  // 가볍게 = 무료·온디바이스 재미(펫·성격유형·택일·행운·띠별자리·이름풀이·꿈해몽). API 0(daniel: 스페셜 아래 무료 따로).
  { key: 'light', titleKey: 'menu.secLight', descKey: 'menu.secLightDesc', items: [
    // 세계 인물 매칭 — 무료·결정론(온디바이스 사주 유사도·API 0). daniel 07-18: 유료 배지 제거·가볍게 보기로 이동.
    { key: 'celeb', labelKey: 'menu.celeb', descKey: 'menu.celebDesc', image: require('../../../assets/icons/celeb.jpg'), route: '/celeb', ready: true, content: true },
    // 속궁합(성적 궁합·17+·온디바이스 결정론 무료). daniel 07-18: special→light 이동. ★원격 플래그(features.sokgunghap)로 게이트 —
    //   관리자만 노출(재제출 안전판), 심사 통과 후 공개. 렌더 시 ContentGrid 가 useFeatureOn('sokgunghap')로 필터.
    { key: 'sokgunghap', labelKey: 'menu.sokgunghap', descKey: 'menu.sokgunghapDesc', image: require('../../../assets/icons/love.jpg'), route: '/sokgunghap', ready: true, content: true },
    // 신규(daniel 2026-07-13·4.3 자기분석): 나 분석 종합 + 관계 패턴 — 무료 온디바이스(사주 엔진).
    { key: 'selfAnalysis', labelKey: 'menu.selfAnalysis', descKey: 'menu.selfAnalysisDesc', image: require('../../../assets/icons/persona.jpg'), route: '/selfanalysis', ready: true, content: true },
    { key: 'relationPattern', labelKey: 'menu.relationPattern', descKey: 'menu.relationPatternDesc', image: require('../../../assets/icons/compat.jpg'), route: '/relationpattern', ready: true, content: true },
    // 신규(daniel 기획서 Phase2 2026-07-14): 퍼스널 오행 — 오행 컬러/코디/메이크업/자동차(무료 온디바이스·결정론). BM(뷰티/패션 제휴) 토대.
    { key: 'personal', labelKey: 'menu.personal', descKey: 'menu.personalDesc', image: require('../../../assets/icons/personal.jpg'), route: '/personal', ready: true, content: true },
    // 신규(daniel 2026-07-05): 재회·짝사랑·취업 무료 '질문형'(올해 결정론 미리보기) → 화면 CTA로 유료 깊은 풀이 유도.
    { key: 'reunionAsk', labelKey: 'menu.reunionAsk', descKey: 'menu.reunionAskDesc', image: require('../../../assets/icons/reunion.jpg'), route: '/reunionAsk', ready: true, content: true },
    { key: 'crushAsk', labelKey: 'menu.crushAsk', descKey: 'menu.crushAskDesc', image: require('../../../assets/icons/crush.jpg'), route: '/crushAsk', ready: true, content: true },
    { key: 'jobAsk', labelKey: 'menu.jobAsk', descKey: 'menu.jobAskDesc', image: require('../../../assets/icons/job.jpg'), route: '/jobAsk', ready: true, content: true },
    { key: 'taro', labelKey: 'menu.taro', descKey: 'menu.taroDesc', image: require('../../../assets/icons/taro.jpg'), route: '/taro', ready: true, content: true },
    { key: 'pet', labelKey: 'menu.pet', descKey: 'menu.petDesc', image: require('../../../assets/icons/pet.jpg'), route: '/pet', ready: true, content: true },
    { key: 'persona', labelKey: 'menu.persona', descKey: 'menu.personaTileDesc', image: require('../../../assets/icons/persona.jpg'), route: '/persona', ready: true, content: true },
    { key: 'impression', labelKey: 'menu.impression', descKey: 'menu.impressionDesc', image: require('../../../assets/icons/impression.jpg'), route: '/impression', ready: true, content: true },
    { key: 'egen', labelKey: 'menu.egen', descKey: 'menu.egenTileDesc', image: require('../../../assets/icons/egen.jpg'), route: '/egenteto', ready: true, content: true },
    { key: 'mbti', labelKey: 'menu.mbti', descKey: 'menu.mbtiTileDesc', image: require('../../../assets/icons/mbti.jpg'), route: '/mbti', ready: true, content: true }, // 사주로 보는 MBTI(무료·온디바이스, daniel 2026-06-23)
    // 수비학은 별자리·점성술 콘텐츠로 병합(daniel 2026-06-24 재유료·디테일) — 별도 무료 메뉴 제거.
    { key: 'joseonjob', labelKey: 'menu.joseonjob', descKey: 'menu.joseonjobTileDesc', image: require('../../../assets/icons/joseonjob.jpg'), route: '/joseonjob', ready: true, content: true },
    { key: 'lovestyle', labelKey: 'menu.lovestyle', descKey: 'menu.lovestyleTileDesc', image: require('../../../assets/icons/lovestyle.jpg'), route: '/lovestyle', ready: true, content: true },
    { key: 'bok', labelKey: 'menu.bok', descKey: 'menu.bokTileDesc', image: require('../../../assets/icons/bok.jpg'), route: '/bok', ready: true, content: true },
    { key: 'pastlife', labelKey: 'menu.pastlife', descKey: 'menu.pastlifeTileDesc', image: require('../../../assets/icons/pastlife.jpg'), route: '/pastlife', ready: true, content: true },
    { key: 'healing', labelKey: 'menu.healing', descKey: 'menu.healingTileDesc', image: require('../../../assets/icons/healing.jpg'), route: '/healing', ready: true, content: true },
    { key: 'taegil', labelKey: 'menu.taegil', descKey: 'menu.taegilTileDesc', image: require('../../../assets/icons/taegil.jpg'), route: '/taegil', ready: true, content: true },
    // daniel #A(2026-06-24): 내가 살기 좋은 곳(원국 조후→기후/방위·국기, 무료·온디바이스).
    { key: 'country', labelKey: 'menu.country', descKey: 'menu.countryDesc', image: require('../../../assets/icons/country.jpg'), route: '/country', ready: true, content: true },
    { key: 'luck', labelKey: 'menu.luck', descKey: 'menu.luckTileDesc', image: require('../../../assets/icons/luck.jpg'), route: '/luck', ready: true, content: true },
    // 별자리(/zodiac)는 점성술 콘텐츠로 병합(daniel 2026-06-23) — 별도 카드 제거. /zodiac 라우트는 유지(딥링크 안전).
    { key: 'name', labelKey: 'menu.name', descKey: 'menu.nameTileDesc', image: require('../../../assets/icons/name.jpg'), route: '/name', ready: true, content: true },
    { key: 'dream', labelKey: 'menu.dream', descKey: 'menu.dreamTileDesc', image: require('../../../assets/icons/dream.jpg'), route: '/dream', ready: true, content: true },
  ] },
];

// ── 카드 순차 로딩 오프셋 ────────────────────────────────────────────────
// 카드 이미지를 한 프레임에 전부(약 35장) 디코드하면 스레드가 포화돼 로딩이 밀린다(daniel: "이미지 로딩이 너무 김").
//   해법 = 카드마다 '전역 순번'을 부여하고 그 순번이 공개분(revealCount)에 들어올 때만 이미지를 mount.
//   CARD_REVEAL_OFFSETS[secIdx] = 그 섹션 시작 전까지의 누적 카드 수(= 첫 카드의 전역 순번).
//     카드 전역 순번 = CARD_REVEAL_OFFSETS[secIdx] + itemIdx (섹션·항목 순서 = 화면 위→아래 순서).
//   SECTIONS는 정적이라 모듈 로드 시 1회만 계산(렌더마다 재계산 안 함).
export const CARD_REVEAL_OFFSETS: number[] = (() => {
  const offsets: number[] = [];
  let acc = 0;
  for (const sec of SECTIONS) { offsets.push(acc); acc += sec.items.length; }
  return offsets;
})();
/** 전체 카드 수 — 공개 완료 판정(revealCount >= TOTAL_CARDS)에 사용. */
export const TOTAL_CARDS = SECTIONS.reduce((n, s) => n + s.items.length, 0);
