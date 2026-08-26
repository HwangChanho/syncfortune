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
import { COIN_PRICE } from '../billing/coinPrices';
// ★시안 카드 아이콘(Boss 제공 2026-08-18) — 시안 p05·p14 의 카드 그리드에 **그 그림이 그 카드에** 있었다.
//   투명 PNG 라 카드 배경 위에 얹힌다(기존 사진 카드와 결이 다르지만, 그게 시안이다).
import { contentIcon, freeTrioIcon } from '../ui/brandAsset';   // ★가격 표기를 운으로(daniel 07-28)

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
  /** 목록(ContentGrid)에서만 숨긴다 — 데이터는 남는다.
   *  ★왜 지우지 않고 숨기나: 도우미 안내·추천(RelatedContent)·후기 태그가 이 표에서 라벨·이미지를 찾는다.
   *    실제로 'month' 를 지웠더니 check:assistant 가 "도우미가 죽은 링크를 내민다"로 잡았다(2026-08-06). */
  hiddenInList?: boolean;
};
/**
 * @param chipKey 상단 카테고리 칩용 **짧은** 라벨 키(daniel 2026-08-06 "상단에 연애 재물 사람 등등
 *   카테고리별로 있어서 선택할 수 있게"). 섹션 제목('나는 어떤 사람인가')은 칩에 넣기엔 길다 —
 *   칩은 한눈에 훑는 게 목적이라 2~4자로 따로 둔다. 없으면 titleKey 를 쓴다.
 */
export type Section = {
  key: string; titleKey: string; descKey?: string; chipKey?: string;
  /**
   * 섹션 대표 아이콘 — **한 장씩 보여 주는 자리**(도우미 안내 카드)의 폴백.
   *
   * ★왜 카드 그리드에는 안 쓰나: 그리드는 여러 장이 나란히 뜬다. 섹션 아이콘을 채우면
   *   같은 그림이 아홉 번 반복돼 뜻이 사라진다(사진에서 겪은 문제 · `check:cardart` 주석).
   *   반대로 도우미는 **한 번에 한 장**이라 반복이 보이지 않는다 —
   *   거기서는 그림이 없는 것보다 카테고리 그림이라도 있는 게 낫다
   *   (daniel IMG_8311 *"이미지랑 같이 노출"* — 그림이 없으면 글자 버튼으로 떨어진다).
   */
  icon?: Parameters<typeof contentIcon>[0];
  items: MenuItem[];
};

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
export const HOME_INDIVIDUAL = new Set(['dream', 'followup', 'timeresolve', 'taemong']);
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
  // ── 연애 ───────────────────────────────────────────────────────────────
  //   무료 질문형·가벼운 것 먼저, 깊은 유료는 그 뒤(daniel '유료를 대놓고 앞에 빼지 말라').
  { key: 'love', icon: 'heart', titleKey: 'menu.secLove', descKey: 'menu.secLoveDesc', chipKey: 'menu.chipLove', items: [
    { key: 'reunionAsk', labelKey: 'menu.reunionAsk', descKey: 'menu.reunionAskDesc', image: contentIcon('ring'), route: '/reunionAsk', ready: true, content: true },
    { key: 'crushAsk', labelKey: 'menu.crushAsk', descKey: 'menu.crushAskDesc', image: contentIcon('heart'), route: '/crushAsk', ready: true, content: true },
    { key: 'lovestyle', labelKey: 'menu.lovestyle', descKey: 'menu.lovestyleTileDesc', image: contentIcon('heart'), route: '/lovestyle', ready: true, content: true },
    { key: 'relationPattern', labelKey: 'menu.relationPattern', descKey: 'menu.relationPatternDesc', image: contentIcon('family'), route: '/relationpattern', ready: true, content: true },
    { key: 'sokgunghap', labelKey: 'menu.sokgunghap', descKey: 'menu.sokgunghapDesc', image: contentIcon('heart'), route: '/sokgunghap', ready: true, content: true },
    // 관계 지도(daniel 2026-08-14) — **무료 결정론**(온디바이스·API 0원). 궁합의 앞 단계이자 유입로다.
    //   ⚠️전용 아이콘이 아직 없어 compat 이미지를 함께 쓴다(이미지 제작은 별건 — 깨진 칸보다 낫다).
    // ★2026-08-16: 궁합 이미지를 같이 쓰고 있었다 — 3열 그리드에서 궁합 카드와 **나란히** 같은 그림이 떠
    //   복사 실수처럼 보였다. 관계 지도는 자기 히어로 이미지가 이미 있다(`icons/relmap/hero.jpg`).
    { key: 'relationmap', labelKey: 'menu.relationmap', descKey: 'menu.relationmapDesc', image: contentIcon('family'), route: '/relationmap', ready: true, content: true },
    { key: 'compat', labelKey: 'menu.compat', descKey: 'menu.compatDesc', image: contentIcon('family'), route: '/compat', ready: true, premium: true, creditKey: 'compat' },
    // ★궁합을 **관계마다** 노출한다(Boss 2026-08-25 *"연인 카테고리만 하지말고 … 해당 카테고리에
    //   맞는 궁합으로 바로 넘어가서 비용지불하고 볼수있게"*). 종전엔 연애 섹션에 하나뿐이라
    //   직장·가족 궁합이 **있는 줄도 모르는** 상태였다.
    //   ⚠️`creditKey` 는 전부 'compat' 로 같다 — 관계별 과금은 화면 안에서 갈린다(여기서 나누면 두 갈래가 된다).
    { key: 'compat_marriage', labelKey: 'menu.compatMarriage', descKey: 'menu.compatMarriageDesc', image: contentIcon('ring'), route: '/compat?rel=marriage', ready: true, premium: true, creditKey: 'compat' },
    { key: 'love', labelKey: 'menu.love', descKey: 'menu.loveDesc', image: contentIcon('ring'), route: '/love', ready: true, content: true, creditKey: 'love' },
    { key: 'crush', labelKey: 'menu.crush', descKey: 'menu.crushDesc', image: contentIcon('heart'), route: '/crush', ready: true, content: true, creditKey: 'crush' },
    { key: 'reunion', labelKey: 'menu.reunion', descKey: 'menu.reunionDesc', image: contentIcon('ring'), route: '/reunion', ready: true, content: true, creditKey: 'reunion' },
    // 「관계의 고비」(2026-08-10) — 애정 축에서 비어 있던 칸(이별 그 자체·삼각). reunion 은 헤어진 *다음* 이야기다.
    //   ★무료 온디바이스 결정론(API 0) — L1(쟁합·충 세력·합 거리·배우자궁 개폐)이 그대로 화면이 된다.
    //   ⚠️카드 설명은 **중립**으로 둔다 — 목록에서 먼저 이별을 들추지 않는다(기획서 §4 가드 4).
    { key: 'crisis', labelKey: 'menu.crisis', descKey: 'menu.crisisDesc', image: contentIcon('ring'), route: '/crisis', ready: true, content: true },
    { key: 'child', labelKey: 'menu.child', descKey: 'menu.childDesc', image: contentIcon('family'), route: '/child', ready: true, premium: true, creditKey: 'child' },
  ] },

  // ── 오늘의 운세 ───────────────────────────────────────────────────────────────
  //   ★'이달의 운세'만 목록에서 숨긴다 — 상단 펼침 카드(MonthHeroCard)로 이미 펼쳐 보이므로 중복.
  { key: 'today', icon: 'crystal', titleKey: 'menu.secToday', descKey: 'menu.secTodayDesc', chipKey: 'menu.chipToday', items: [
    { key: 'today', labelKey: 'menu.today', descKey: 'menu.todayTileDesc', image: contentIcon('crystal'), route: '/today', ready: true },
    { key: 'luck', labelKey: 'menu.luck', descKey: 'menu.luckTileDesc', image: contentIcon('crystal'), route: '/luck', ready: true, content: true },
    { key: 'taegil', labelKey: 'menu.taegil', descKey: 'menu.taegilTileDesc', image: contentIcon('crystal'), route: '/taegil', ready: true, content: true },
    { key: 'month', labelKey: 'menu.month', descKey: 'menu.monthTileDesc', image: contentIcon('crystal'), route: '/month', ready: true, hiddenInList: true },
    { key: 'newyear', labelKey: 'menu.newyear', descKey: 'menu.newyearTileDesc', image: contentIcon('crystal'), route: '/newyear', ready: true, content: true, creditKey: 'newyear' },
    { key: 'future10', labelKey: 'menu.future10', descKey: 'menu.future10Desc', image: contentIcon('crystal'), route: '/future10', ready: true, content: true, creditKey: 'future10' },
    { key: 'timeline', labelKey: 'menu.timeline', descKey: 'menu.timelineDesc', image: contentIcon('book'), route: '/timeline', ready: true, premium: true, creditKey: 'timeline' },
    { key: 'lifegraph', labelKey: 'menu.lifegraph', descKey: 'menu.lifegraphDesc', image: contentIcon('book'), route: '/lifegraph', ready: true, content: true, creditKey: 'lifegraph' },
    { key: 'gaeun', labelKey: 'menu.gaeun', descKey: 'menu.gaeunDesc', image: contentIcon('crystal'), route: '/gaeun', ready: true, content: true, creditKey: 'gaeun' },
  ] },

  // ── 나 분석 ───────────────────────────────────────────────────────────────
  //   가입 직후 첫 콘텐츠 축. 무료 자기이해가 앞, 사주 원국풀이 등 유료는 뒤.
  { key: 'self', icon: 'idcard', titleKey: 'menu.secSelf', descKey: 'menu.secSelfDesc', chipKey: 'menu.chipSelf', items: [
    // ★맨 앞이다 — 유형은 **입구**이므로 «나 분석» 의 첫 칸이 맞다(기획서 §2-A)
    { key: 'mycard', labelKey: 'menu.mycard', descKey: 'menu.mycardDesc', image: contentIcon('idcard'), route: '/mycard', ready: true, content: true },
    { key: 'typematch', labelKey: 'menu.typematch', descKey: 'menu.typematchDesc', image: contentIcon('family'), route: '/typematch', ready: true, content: true },
    { key: 'selfAnalysis', labelKey: 'menu.selfAnalysis', descKey: 'menu.selfAnalysisDesc', image: contentIcon('idcard'), route: '/selfanalysis', ready: true, content: true },
    { key: 'impression', labelKey: 'menu.impression', descKey: 'menu.impressionDesc', image: contentIcon('idcard'), route: '/impression', ready: true, content: true },
    { key: 'persona', labelKey: 'menu.persona', descKey: 'menu.personaTileDesc', image: contentIcon('idcard'), route: '/personatype', ready: true, content: true },
    { key: 'mbti', labelKey: 'menu.mbti', descKey: 'menu.mbtiTileDesc', image: contentIcon('idcard'), route: '/mbti', ready: true, content: true },
    { key: 'egen', labelKey: 'menu.egen', descKey: 'menu.egenTileDesc', image: contentIcon('idcard'), route: '/egenteto', ready: true, content: true },
    { key: 'attach', labelKey: 'menu.attach', descKey: 'menu.attachDesc', image: contentIcon('heart'), route: '/attach', ready: true, content: true },
    { key: 'gem', labelKey: 'menu.gem', descKey: 'menu.gemDesc', image: contentIcon('crystal'), route: '/gem', ready: true, content: true },
    { key: 'personal', labelKey: 'menu.personal', descKey: 'menu.personalDesc', image: contentIcon('idcard'), route: '/personal', ready: true, content: true },
    { key: 'celeb', labelKey: 'menu.celeb', descKey: 'menu.celebDesc', image: contentIcon('idcard'), route: '/celeb', ready: true, content: true },
    { key: 'dayPillar', labelKey: 'menu.dayPillar', descKey: 'menu.dayPillarDesc', image: contentIcon('book'), route: '/dayPillar', ready: true },
    { key: 'bok', labelKey: 'menu.bok', descKey: 'menu.bokTileDesc', image: contentIcon('crystal'), route: '/bok', ready: true, content: true },
    { key: 'saju', labelKey: 'menu.saju', descKey: 'menu.sajuDesc', image: contentIcon('book'), route: '/reading', ready: true, premium: true, creditKey: 'reading' },
    { key: 'image', labelKey: 'menu.image', descKey: 'menu.imageDesc', image: contentIcon('idcard'), route: '/image', ready: true, content: true, creditKey: 'image' },
    { key: 'roots', labelKey: 'menu.roots', descKey: 'menu.rootsDesc', image: contentIcon('book'), route: '/roots', ready: true, content: true, creditKey: 'roots' },
  ] },

  // ── 직업·재물 ───────────────────────────────────────────────────────────────
  //   무료 질문형(취업 언제 될까?)·조선시대 직업이 앞.
  { key: 'work', icon: 'briefcase', titleKey: 'menu.secWork', descKey: 'menu.secWorkDesc', chipKey: 'menu.chipWork', items: [
    { key: 'compat_coworker', labelKey: 'menu.compatCoworker', descKey: 'menu.compatCoworkerDesc', image: contentIcon('family'), route: '/compat?rel=coworker', ready: true, premium: true, creditKey: 'compat' },
    { key: 'compat_senior', labelKey: 'menu.compatSenior', descKey: 'menu.compatSeniorDesc', image: contentIcon('family'), route: '/compat?rel=senior', ready: true, premium: true, creditKey: 'compat' },
    { key: 'compat_business', labelKey: 'menu.compatBusiness', descKey: 'menu.compatBusinessDesc', image: contentIcon('family'), route: '/compat?rel=business', ready: true, premium: true, creditKey: 'compat' },
    { key: 'jobAsk', labelKey: 'menu.jobAsk', descKey: 'menu.jobAskDesc', image: contentIcon('idcard'), route: '/jobAsk', ready: true, content: true },
    { key: 'joseonjob', labelKey: 'menu.joseonjob', descKey: 'menu.joseonjobTileDesc', image: contentIcon('briefcase'), route: '/joseonjob', ready: true, content: true },
    { key: 'jobfit', labelKey: 'menu.jobfit', descKey: 'menu.jobfitDesc', image: contentIcon('briefcase'), route: '/jobfit', ready: true, content: true, creditKey: 'jobfit' },
    { key: 'career', labelKey: 'menu.career', descKey: 'menu.careerDesc', image: contentIcon('moneybag'), route: '/career', ready: true, content: true, creditKey: 'career' },
    { key: 'job', labelKey: 'menu.job', descKey: 'menu.jobDesc', image: contentIcon('briefcase'), route: '/job', ready: true, content: true, creditKey: 'job' },
    { key: 'wealth', labelKey: 'menu.wealth', descKey: 'menu.wealthDesc', image: contentIcon('coin'), route: '/wealth', ready: true, content: true, creditKey: 'wealth' },
    { key: 'talent', labelKey: 'menu.talent', descKey: 'menu.talentDesc', image: contentIcon('book'), route: '/talent', ready: true, content: true, creditKey: 'talent' },
    { key: 'mission', labelKey: 'menu.mission', descKey: 'menu.missionDesc', image: contentIcon('book'), route: '/mission', ready: true, content: true, creditKey: 'mission' },
  ] },

  // ── 라이프 ───────────────────────────────────────────────────────────────
  //   ★신설 — 위 네 축에 들어가지 않는 흥미·힐링 콘텐츠(daniel '분류 안 되는 건 신규로 만들어서').
  { key: 'life', icon: 'book', titleKey: 'menu.secLife', descKey: 'menu.secLifeDesc', chipKey: 'menu.chipLife', items: [
    { key: 'compat_family', labelKey: 'menu.compatFamily', descKey: 'menu.compatFamilyDesc', image: contentIcon('family'), route: '/compat?rel=family', ready: true, premium: true, creditKey: 'compat' },
    { key: 'compat_friend', labelKey: 'menu.compatFriend', descKey: 'menu.compatFriendDesc', image: contentIcon('family'), route: '/compat?rel=friend', ready: true, premium: true, creditKey: 'compat' },
    { key: 'taro', labelKey: 'menu.taro', descKey: 'menu.taroDesc', image: freeTrioIcon('taro'), route: '/taro', ready: true, content: true },
    { key: 'pet', labelKey: 'menu.pet', descKey: 'menu.petDesc', image: contentIcon('family'), route: '/pet', ready: true, content: true },
    { key: 'pastlife', labelKey: 'menu.pastlife', descKey: 'menu.pastlifeTileDesc', image: contentIcon('book'), route: '/pastlife', ready: true, content: true },
    { key: 'healing', labelKey: 'menu.healing', descKey: 'menu.healingTileDesc', image: contentIcon('health'), route: '/healing', ready: true, content: true },
    { key: 'country', labelKey: 'menu.country', descKey: 'menu.countryDesc', image: contentIcon('crystal'), route: '/country', ready: true, content: true },
    { key: 'name', labelKey: 'menu.name', descKey: 'menu.nameTileDesc', image: contentIcon('book'), route: '/name', ready: true, content: true },
    { key: 'dream', labelKey: 'menu.dream', descKey: 'menu.dreamTileDesc', image: contentIcon('crystal'), route: '/dream', ready: true, content: true },
    { key: 'taemong', labelKey: 'menu.taemong', descKey: 'menu.taemongTileDesc', image: contentIcon('family'), route: '/taemong', ready: true, content: true },
    { key: 'ziwei', labelKey: 'menu.ziweiHub', descKey: 'menu.ziweiHubDesc', image: freeTrioIcon('ziwei'), route: '/ziwei', ready: true, premium: true, creditKey: 'ziwei' },
    { key: 'astrology', labelKey: 'menu.astrology', descKey: 'menu.astrologyDesc', image: freeTrioIcon('astro'), route: '/astrology', ready: true, content: true, creditKey: 'astrology' },
  ] },

  // ── 도구 ───────────────────────────────────────────────────────────────
  //   ★신설 — 콘텐츠가 아니라 '보는 장치'.
  { key: 'tool', icon: 'book', titleKey: 'menu.secTool', descKey: 'menu.secToolDesc', chipKey: 'menu.chipTool', items: [
    { key: 'manse', labelKey: 'menu.manse', descKey: 'menu.manseDesc', image: contentIcon('book'), route: '/charts', ready: true },
    { key: 'timeResolve', labelKey: 'menu.timeResolve', descKey: 'menu.timeResolveDesc', image: contentIcon('book'), route: '/timeResolve', ready: true, creditKey: 'timeresolve' },
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

/**
 * 유료(운으로 여는) 콘텐츠의 라우트 집합.
 * ★용도: **유료 콘텐츠 화면에서는 광고를 띄우지 않는다**(daniel 2026-08-06 "유료 컨텐츠는 광고 다 빼").
 *   돈을 낸 화면에 광고가 붙어 있으면 그 자체가 과금 유도로 읽힌다 — 무료는 광고로,
 *   유료는 값으로 값을 받는다는 경계를 코드로 못박는다.
 * ★왜 목록이 아니라 여기서 파생하나: 유료 콘텐츠가 늘 때마다 광고 예외 목록을 따로 관리하면
 *   반드시 한쪽이 빠진다(이 프로젝트 반복 실수). creditKey 라는 **사실 하나**에서 자동으로 나온다.
 */
/**
 * 콘텐츠 화면의 라우트 **전체** — 웹 레이아웃이 "이건 읽는 화면"이라고 판정하는 데 쓴다.
 * ★손으로 나열하지 않는다. 콘텐츠가 늘면 이 목록도 같이 는다(`PAID_ROUTES` 와 같은 원리).
 */
export const CONTENT_ROUTES: string[] = Array.from(
  new Set(SECTIONS.flatMap((s) => s.items).map((m) => m.route)),
);

export const PAID_ROUTES: string[] = Array.from(
  new Set(SECTIONS.flatMap((s) => s.items).filter((m) => m.creditKey).map((m) => m.route)),
);
