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
import { A } from '../../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다
import { COIN_PRICE } from '../billing/coinPrices';   // ★가격 표기를 운으로(daniel 07-28)

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

/**
 * '인기' 섹션 사본 키(hot*) → 원본 콘텐츠 키.
 * ★왜 필요한가: 인기 섹션은 같은 콘텐츠를 한 번 더 보여주는 **숏컷**이라 React 키 충돌을 피하려
 *   `hotPet` 처럼 접두를 붙인다. 그런데 NEW 배지·'내 얘기' 티저는 **원본 키**로 등록돼 있어서
 *   사본 카드만 배지도 티저도 없이 밋밋해졌다(같은 카드인데 인기 칸에서만 설명이 다름).
 *   사본 키를 그 표들에 또 적는 방법도 있지만 그러면 출시일·티저가 두 곳이 되어 언젠가 갈린다.
 *   → **키 규칙을 아는 이 파일이** 사본→원본 변환을 소유하고, 표는 원본 하나만 유지한다.
 * @param key MenuItem.key (예: 'hotWealth')
 * @returns 원본 키(예: 'wealth'). 사본이 아니면 그대로 돌려준다.
 * @example baseKey('hotJobAsk') // 'jobAsk'
 */
export const baseKey = (key: string) =>
  (/^hot[A-Z]/.test(key) ? key.charAt(3).toLowerCase() + key.slice(4) : key);

// ── 가격 배지 ────────────────────────────────────────────────────────────
// 유료 콘텐츠 가격 배지 — 정가(19,900) 대비 할인율 + 건당 할인가(₩). 건당가는 CREDIT_KINDS(coupons) 단일 출처.
//   무료(온디바이스) 콘텐츠는 creditKey 없음 → 배지 미표시.
// ★가짜 할인율 제거(daniel 2026-07-26 "네 판단대로 바꿔").
//   기존: `LIST_PRICE_ORIG = 19900`(사주 정가) **하나를 기준으로 모든 콘텐츠의 할인율**을 계산 →
//   궁합 ₩2,900 이 "85%", 자식운 ₩4,900 이 "75%" 로 표시됐다. 그런데 두 상품이 19,900 이었던 적은 없다.
//   · 사실과 다름: CREDIT_KINDS 에는 애초에 '정가' 필드가 없다(price 하나뿐) = 할인율의 근거 데이터가 없음
//   · 리스크: 종전 거래가격 없는 할인율 표시는 표시광고법 위반 소지 + 심사에서 걸릴 여지
//   · 일관성: 사주(19,900)만 할인율이 없고 나머지는 다 붙어 배지 형식도 제각각이었다
//   → 실제 할인이 생기면 그때 CREDIT_KINDS 에 정가 필드를 두고 **상품별 실제 종전가** 기준으로 되살릴 것.
const CREDIT_PRICE: Record<string, number> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.price]));
/** 천단위 콤마(Hermes Intl 비의존). @example wonFmt(4900) → '₩4,900' */
export const wonFmt = (n: number) => '₩' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** 프리미엄 미포함(개별구매 전용) — 프리미엄 명식이어도 '무제한' 배지를 주지 않는다. */
export const HOME_INDIVIDUAL = new Set(['dream', 'followup', 'timeresolve']);
/** 개별 가격 배지 문구 — **금액만**(할인율 미표시. 위 주석 참조). @param key creditKey */
/**
 * 콘텐츠 카드에 표시할 가격.
 * ★2026-07-28 코인 전환(daniel "풀이탭에는 금액 말고 코인으로 나와야지"):
 *   결제 수단이 코인이 됐으므로 **보이는 가격도 코인**이어야 한다. 원화로 보이면 사용자가
 *   '원화로 결제하는 줄' 알고 들어갔다가 코인 확인 창을 만난다(기대와 실제가 어긋남).
 *   코인가가 없는 항목(신규 등록 누락 — check:coins 가 잡는다)만 원화로 폴백한다.
 */
export const priceLabel = (key: string) => {
  const coin = COIN_PRICE[key as keyof typeof COIN_PRICE];
  return coin != null ? `${coin} 운` : wonFmt(CREDIT_PRICE[key] ?? 0);
};

// ── 콘텐츠 카드 목록 ─────────────────────────────────────────────────────
// ★2026-08-06 주제(고민) 축 재편 — daniel "너무 나열되어있어서 뭐가뭔지 모르겠어 가독성이 너무 안좋아".
//
//   [기존] 가격·체계 축: 나를 이해하기(프리미엄) / 가볍게 보기 / 오늘·명식 / 인기 / 스페셜 / 나에 대해 알기
//   [문제] 실측으로 셋:
//     ① **같은 뜻의 섹션이 둘** — '나를 이해하기'(유료 5종)와 '나에 대해 알기'(심층 9종)는 이름만으로 구분 불가.
//     ② **'가볍게 보기' 한 칸에 25개**(전체 51개의 절반) — 세계인물·속궁합·자기분석·타로·MBTI·꿈해몽이 한 바구니.
//        카드뷰에서 5개씩 **가로 5줄**이라 대부분이 화면 밖에 숨었다.
//     ③ **한 주제가 세 섹션에 흩어짐** — 연애를 찾으려면 궁합(프리미엄)·재회/짝사랑(가볍게)·애정흐름(스페셜)을
//        각각 뒤져야 했다. 사용자는 '유료냐 무료냐'가 아니라 **"연애가 궁금하다"**로 찾는다.
//   [해법] 섹션 = **무엇이 궁금한가**(연애/돈·일/나/시기/재미/도구). 유·무료는 섹션이 아니라 **카드 배지**로 구분한다.
//        가격 축은 이미 badgeFor() 가 명식별 상태(무제한·풀이있음·쿠폰·가격)로 더 정확히 표시하므로 중복이었다.
//
//   ※항목의 정의(route·image·creditKey·플래그)는 **하나도 바꾸지 않았다** — 배치만 옮겼다.
//     key 를 유지했으므로 티저(homeTeaser)·NEW 배지·추천(RelatedContent)·후기 태그 매핑은 그대로 동작한다.
//   ※'인기'(hot)만 주제가 아닌 **숏컷** 성격이라 최상단에 남긴다(daniel 07-06·07-23 배치 결정 유지).
//     그 안의 hot* 키는 원본과 같은 라우트를 가리키는 **의도된 중복**이다.
export const SECTIONS: Section[] = [
  // ── 0. 인기(숏컷) — 주제 축 밖. 요즘 많이 찾는 것만 한 줄. ─────────────────
  // ★daniel 07-06: '가장 많이 찾는'→'인기'로 개칭·서브타이틀 제거.
  //   무료 '질문형' 원본은 아래 주제 섹션에도 그대로 있다(의도된 중복) — ★키는 고유(hot*)로 React 키 충돌 방지.
  { key: 'hot', titleKey: 'menu.secContent', items: [
    // 재물 딥리포트(유료 EEL 딥리포트) — 인기로 배치(daniel 07-23 '재물 딥리포트도 인기로 옮겨'). NEW 배지+NEW-우선 정렬로 상단 노출.
    //   ★키는 사본 규칙대로 hot* — 원본 `wealth` 는 '돈·일·진로' 섹션에 있다. 배지·티저는 baseKey 로 원본을 따라간다.
    { key: 'hotWealth', labelKey: 'menu.wealth', descKey: 'menu.wealthDesc', image: A('icons/wealth.jpg'), route: '/wealth', ready: true, content: true, creditKey: 'wealth' },
    { key: 'hotReunionAsk', labelKey: 'menu.reunionAsk', descKey: 'menu.reunionAskDesc', image: A('icons/reunion.jpg'), route: '/reunionAsk', ready: true, content: true },
    { key: 'hotCrushAsk', labelKey: 'menu.crushAsk', descKey: 'menu.crushAskDesc', image: A('icons/crush.jpg'), route: '/crushAsk', ready: true, content: true },
    { key: 'hotJobAsk', labelKey: 'menu.jobAsk', descKey: 'menu.jobAskDesc', image: A('icons/job.jpg'), route: '/jobAsk', ready: true, content: true },
    // daniel 07-06: 인기에 연애스타일·반려동물 추가(무료 온디바이스, 원본과 동일·hot* 고유키).
    { key: 'hotLovestyle', labelKey: 'menu.lovestyle', descKey: 'menu.lovestyleTileDesc', image: A('icons/lovestyle.jpg'), route: '/lovestyle', ready: true, content: true },
    { key: 'hotPet', labelKey: 'menu.pet', descKey: 'menu.petDesc', image: A('icons/pet.jpg'), route: '/pet', ready: true, content: true },
    // 커뮤니티는 하단 탭바(BottomNav)로 이동 — 카드에서 제거, 탭에서 상시 접근(원격 플래그 게이트는 BottomNav 쪽).
  ] },

  // ── 1. 연애·궁합 — "사람 사이가 궁금하다" ────────────────────────────────
  //   흩어져 있던 궁합(프리미엄)·재회/짝사랑 질문형(가볍게)·애정흐름/재회/짝사랑 유료(스페셜)를 한자리로.
  //   무료 '질문형'(…Ask) 바로 옆에 유료 깊은 풀이를 둔다 — 미리보기→깊은 풀이 퍼널이 눈에 보이게(daniel 07-05 모델).
  { key: 'love', titleKey: 'menu.secLove', descKey: 'menu.secLoveDesc', items: [
    { key: 'compat', labelKey: 'menu.compat', descKey: 'menu.compatDesc', image: A('icons/compat.jpg'), route: '/compat', ready: true, premium: true, creditKey: 'compat' },
    { key: 'love', labelKey: 'menu.love', descKey: 'menu.loveDesc', image: A('icons/love.jpg'), route: '/love', ready: true, content: true, creditKey: 'love' },
    // 무료 질문형(올해 결정론 미리보기) → 화면 CTA로 유료 깊은 풀이 유도(daniel 2026-07-05).
    { key: 'reunionAsk', labelKey: 'menu.reunionAsk', descKey: 'menu.reunionAskDesc', image: A('icons/reunion.jpg'), route: '/reunionAsk', ready: true, content: true },
    { key: 'reunion', labelKey: 'menu.reunion', descKey: 'menu.reunionDesc', image: A('icons/reunion.jpg'), route: '/reunion', ready: true, content: true, creditKey: 'reunion' },
    { key: 'crushAsk', labelKey: 'menu.crushAsk', descKey: 'menu.crushAskDesc', image: A('icons/crush.jpg'), route: '/crushAsk', ready: true, content: true },
    { key: 'crush', labelKey: 'menu.crush', descKey: 'menu.crushDesc', image: A('icons/crush.jpg'), route: '/crush', ready: true, content: true, creditKey: 'crush' },
    { key: 'lovestyle', labelKey: 'menu.lovestyle', descKey: 'menu.lovestyleTileDesc', image: A('icons/lovestyle.jpg'), route: '/lovestyle', ready: true, content: true },
    { key: 'relationPattern', labelKey: 'menu.relationPattern', descKey: 'menu.relationPatternDesc', image: A('icons/relationPattern.jpg'), route: '/relationpattern', ready: true, content: true },
    { key: 'impression', labelKey: 'menu.impression', descKey: 'menu.impressionDesc', image: A('icons/impression.jpg'), route: '/impression', ready: true, content: true },
    // 자식운 = 가족 인연이라 이 주제로(원래 '프리미엄' 5종 중 하나, daniel 2026-07-02).
    { key: 'child', labelKey: 'menu.child', descKey: 'menu.childDesc', image: A('icons/child.jpg'), route: '/child', ready: true, premium: true, creditKey: 'child' },
    // 속궁합(성적 궁합·17+·온디바이스 결정론 무료). ★원격 플래그(features.sokgunghap)로 게이트 —
    //   관리자만 노출(재제출 안전판), 심사 통과 후 공개. 렌더 시 ContentGrid 가 useFeatureOn('sokgunghap')로 필터.
    { key: 'sokgunghap', labelKey: 'menu.sokgunghap', descKey: 'menu.sokgunghapDesc', image: A('icons/sokgunghap.jpg'), route: '/sokgunghap', ready: true, content: true },
  ] },

  // ── 2. 돈·일·진로 — "먹고사는 것이 궁금하다" ──────────────────────────────
  //   재물(인기)·직업적성/사업가vs직장인(심층)·취업(스페셜)·취업질문(가볍게)이 흩어져 있던 것을 모았다.
  { key: 'money', titleKey: 'menu.secMoney', descKey: 'menu.secMoneyDesc', items: [
    { key: 'wealth', labelKey: 'menu.wealth', descKey: 'menu.wealthDesc', image: A('icons/wealth.jpg'), route: '/wealth', ready: true, content: true, creditKey: 'wealth' },
    // 신규(daniel 2026-07-13): 나에게 어울리는 직업(직업 적성 딥리포트 EEL — career 사업가vs직장인과 별개).
    { key: 'jobfit', labelKey: 'menu.jobfit', descKey: 'menu.jobfitDesc', image: A('icons/jobfit.jpg'), route: '/jobfit', ready: true, content: true, creditKey: 'jobfit' },
    // 신규(daniel 2026-06): 사업가의 나 vs 직장인의 나.
    { key: 'career', labelKey: 'menu.career', descKey: 'menu.careerDesc', image: A('icons/career.jpg'), route: '/career', ready: true, content: true, creditKey: 'career' },
    { key: 'jobAsk', labelKey: 'menu.jobAsk', descKey: 'menu.jobAskDesc', image: A('icons/job.jpg'), route: '/jobAsk', ready: true, content: true },
    { key: 'job', labelKey: 'menu.job', descKey: 'menu.jobDesc', image: A('icons/job.jpg'), route: '/job', ready: true, content: true, creditKey: 'job' },
    { key: 'talent', labelKey: 'menu.talent', descKey: 'menu.talentDesc', image: A('icons/talent.jpg'), route: '/talent', ready: true, content: true, creditKey: 'talent' },
    { key: 'mission', labelKey: 'menu.mission', descKey: 'menu.missionDesc', image: A('icons/mission.jpg'), route: '/mission', ready: true, content: true, creditKey: 'mission' },
    { key: 'joseonjob', labelKey: 'menu.joseonjob', descKey: 'menu.joseonjobTileDesc', image: A('icons/joseonjob.jpg'), route: '/joseonjob', ready: true, content: true },
  ] },

  // ── 3. 나는 어떤 사람인가 — "본질·성격이 궁금하다" ────────────────────────
  //   ★자기이해 우선(App Store 4.3, daniel 07-11) 원칙은 유지 — 사주·자미 원국풀이가 이 섹션의 머리.
  //   기존 '나를 이해하기'(유료)와 '나에 대해 알기'(심층)가 이름만으로 구분 안 되던 문제를 하나로 합쳐 해소.
  { key: 'self', titleKey: 'menu.secSelf', descKey: 'menu.secSelfDesc', items: [
    { key: 'saju', labelKey: 'menu.saju', descKey: 'menu.sajuDesc', image: A('icons/premium.jpg'), route: '/reading', ready: true, premium: true, creditKey: 'reading' },        // 허브 제거 → 원국풀이 직접 진입(daniel 07-01)
    { key: 'ziwei', labelKey: 'menu.ziweiHub', descKey: 'menu.ziweiHubDesc', image: A('icons/ziwei.jpg'), route: '/ziwei', ready: true, premium: true, creditKey: 'ziwei' },        // 허브 제거 → 자미 원국풀이 직접
    // 신규(daniel 2026-07-13·4.3 자기분석): 나 분석 종합 — 무료 온디바이스(사주 엔진).
    { key: 'selfAnalysis', labelKey: 'menu.selfAnalysis', descKey: 'menu.selfAnalysisDesc', image: A('icons/selfAnalysis.jpg'), route: '/selfanalysis', ready: true, content: true },
    { key: 'persona', labelKey: 'menu.persona', descKey: 'menu.personaTileDesc', image: A('icons/persona.jpg'), route: '/personatype', ready: true, content: true }, // route=120종 통합(daniel 2026-07-20)
    { key: 'mbti', labelKey: 'menu.mbti', descKey: 'menu.mbtiTileDesc', image: A('icons/mbti.jpg'), route: '/mbti', ready: true, content: true }, // 사주로 보는 MBTI(무료·온디바이스, daniel 2026-06-23)
    { key: 'egen', labelKey: 'menu.egen', descKey: 'menu.egenTileDesc', image: A('icons/egen.jpg'), route: '/egenteto', ready: true, content: true },
    { key: 'image', labelKey: 'menu.image', descKey: 'menu.imageDesc', image: A('icons/image.jpg'), route: '/image', ready: true, content: true, creditKey: 'image' },
    { key: 'roots', labelKey: 'menu.roots', descKey: 'menu.rootsDesc', image: A('icons/roots.jpg'), route: '/roots', ready: true, content: true, creditKey: 'roots' },
    // 신규(daniel R-GEM v0.1): 내 사주 보석 — 용신 기반 보석 추천(무료 온디바이스·결정론·API 0). 바이럴 공유카드→유료 심층분석 퍼널.
    { key: 'gem', labelKey: 'menu.gem', descKey: 'menu.gemDesc', image: A('icons/gem.jpg'), route: '/gem', ready: true, content: true },
    // 신규(daniel 기획서 Phase2 2026-07-14): 퍼스널 오행 — 오행 컬러/코디/메이크업/자동차. BM(뷰티/패션 제휴) 토대.
    { key: 'personal', labelKey: 'menu.personal', descKey: 'menu.personalDesc', image: A('icons/personal.jpg'), route: '/personal', ready: true, content: true },
    // 세계 인물 매칭 — 무료·결정론(온디바이스 사주 유사도·API 0).
    { key: 'celeb', labelKey: 'menu.celeb', descKey: 'menu.celebDesc', image: A('icons/celeb.jpg'), route: '/celeb', ready: true, content: true },
  ] },

  // ── 4. 시기와 흐름 — "언제가 궁금하다" ───────────────────────────────────
  //   오늘/이달(무료)·타임라인(프리미엄)·인생그래프/신년/10년뒤(스페셜)·개운법(심층)·택일/행운(가볍게) 통합.
  //   시간 스케일 순서(오늘 → 이달 → 올해 → 10년 → 평생)로 두어 무엇이 더 긴 호흡인지 배치로 읽히게 한다.
  { key: 'flow', titleKey: 'menu.secFlow', descKey: 'menu.secFlowDesc', items: [
    { key: 'today', labelKey: 'menu.today', descKey: 'menu.todayTileDesc', image: A('icons/today.jpg'), route: '/today', ready: true },
    { key: 'month', labelKey: 'menu.month', descKey: 'menu.monthTileDesc', image: A('icons/month.jpg'), route: '/month', ready: true },
    // daniel(2026-06-24): 신년운세 = 시즌 콘텐츠라 이 섹션 앞쪽.
    { key: 'newyear', labelKey: 'menu.newyear', descKey: 'menu.newyearTileDesc', image: A('icons/newyear.jpg'), route: '/newyear', ready: true, content: true, creditKey: 'newyear' },
    // 신규(daniel 2026-07-02): 10년 뒤 나의 모습(대운·세운 스페셜, 개별 유료).
    { key: 'future10', labelKey: 'menu.future10', descKey: 'menu.future10Desc', image: A('icons/future10.jpg'), route: '/future10', ready: true, content: true, creditKey: 'future10' },
    { key: 'timeline', labelKey: 'menu.timeline', descKey: 'menu.timelineDesc', image: A('icons/timeline.jpg'), route: '/timeline', ready: true, premium: true, creditKey: 'timeline' },
    { key: 'lifegraph', labelKey: 'menu.lifegraph', descKey: 'menu.lifegraphDesc', image: A('icons/lifegraph.jpg'), route: '/lifegraph', ready: true, content: true, creditKey: 'lifegraph' },
    // daniel #18(2026-06-24): 맞춤 개운법(원국+지금 운 → 구체 처방·살풀이). 부적/만다라 이미지.
    { key: 'gaeun', labelKey: 'menu.gaeun', descKey: 'menu.gaeunDesc', image: A('icons/gaeun.jpg'), route: '/gaeun', ready: true, content: true, creditKey: 'gaeun' },
    { key: 'taegil', labelKey: 'menu.taegil', descKey: 'menu.taegilTileDesc', image: A('icons/taegil.jpg'), route: '/taegil', ready: true, content: true },
    { key: 'luck', labelKey: 'menu.luck', descKey: 'menu.luckTileDesc', image: A('icons/luck.jpg'), route: '/luck', ready: true, content: true },
  ] },

  // ── 5. 가볍게 보는 재미 — "심각하지 않게" ────────────────────────────────
  //   ★기존 '가볍게 보기'(25개 잡탕)에서 **정말 가벼운 것만** 남겼다. 나머지는 위 주제로 갔다.
  { key: 'fun', titleKey: 'menu.secFun', descKey: 'menu.secFunDesc', items: [
    { key: 'taro', labelKey: 'menu.taro', descKey: 'menu.taroDesc', image: A('icons/taro.jpg'), route: '/taro', ready: true, content: true },
    { key: 'pet', labelKey: 'menu.pet', descKey: 'menu.petDesc', image: A('icons/pet.jpg'), route: '/pet', ready: true, content: true },
    // 신규(daniel 2026-06-23): 별자리 운세(유료 LLM). ※수비학은 여기로 병합됨(별도 카드 없음).
    { key: 'astrology', labelKey: 'menu.astrology', descKey: 'menu.astrologyDesc', image: A('icons/astrology.jpg'), route: '/astrology', ready: true, content: true, creditKey: 'astrology' },
    { key: 'dayPillar', labelKey: 'menu.dayPillar', descKey: 'menu.dayPillarDesc', image: A('icons/dayPillar.jpg'), route: '/dayPillar', ready: true },
    { key: 'pastlife', labelKey: 'menu.pastlife', descKey: 'menu.pastlifeTileDesc', image: A('icons/pastlife.jpg'), route: '/pastlife', ready: true, content: true },
    { key: 'bok', labelKey: 'menu.bok', descKey: 'menu.bokTileDesc', image: A('icons/bok.jpg'), route: '/bok', ready: true, content: true },
    { key: 'healing', labelKey: 'menu.healing', descKey: 'menu.healingTileDesc', image: A('icons/healing.jpg'), route: '/healing', ready: true, content: true },
    // daniel #A(2026-06-24): 내가 살기 좋은 곳(원국 조후→기후/방위·국기, 무료·온디바이스).
    { key: 'country', labelKey: 'menu.country', descKey: 'menu.countryDesc', image: A('icons/country.jpg'), route: '/country', ready: true, content: true },
    { key: 'name', labelKey: 'menu.name', descKey: 'menu.nameTileDesc', image: A('icons/name.jpg'), route: '/name', ready: true, content: true },
    { key: 'dream', labelKey: 'menu.dream', descKey: 'menu.dreamTileDesc', image: A('icons/dream.jpg'), route: '/dream', ready: true, content: true },
    // 별자리(/zodiac)는 점성술 콘텐츠로 병합(daniel 2026-06-23) — 별도 카드 제거. /zodiac 라우트는 유지(딥링크 안전).
  ] },

  // ── 6. 명식·도구 — 콘텐츠가 아니라 '보는 장치' ───────────────────────────
  //   만세력·시 찾기는 읽을거리가 아니라 도구라 주제 섹션과 성격이 다르다 → 맨 아래 별도.
  { key: 'tool', titleKey: 'menu.secTool', descKey: 'menu.secToolDesc', items: [
    { key: 'manse', labelKey: 'menu.manse', descKey: 'menu.manseDesc', image: A('icons/manse.jpg'), route: '/charts', ready: true },
    // TPR: 시 모르는 사용자가 인생 사건으로 시를 좁히는 결정론 도구(LLM 0). 990 1회 결제로 도구 영구 해제(daniel 06-28).
    { key: 'timeResolve', labelKey: 'menu.timeResolve', descKey: 'menu.timeResolveDesc', image: A('icons/timeResolve.jpg'), route: '/timeResolve', ready: true, creditKey: 'timeresolve' },
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
