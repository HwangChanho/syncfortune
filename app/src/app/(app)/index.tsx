// src/app/(app)/index.tsx — 홈 (2열 카드 그리드, 미드나잇 테마, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// 무료(명식·만세력·타로·오늘운세) = 진입 시 전면광고(ADR-043) / 프리미엄(궁합·풀이) = 유료.
// 로그인 게이트 없음(ADR-037). 메뉴 = daniel 제작 카드 이미지(assets/icons/{key}.jpg, 남색·골드, 라벨 없음).
//   라벨은 코드 t()로 하단 오버레이 → 영·일 다국어 유지(ADR-049).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, Pressable, ScrollView, StyleSheet, ImageBackground, Animated, AppState, Dimensions, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image'; // 이미지 자동 다운샘플(표시 크기로 디코딩) — 홈 카드 24장 메모리·랙 해결
import { HomeBackdrop } from '../../components/HomeBackdrop'; // 홈 배경 애니(별/태양 + 걷는 선비) — 스플래시와 공유
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/useAuth';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { showRewardedAd, adTestMode } from '../../lib/core/ads'; // 무료 온디바이스 콘텐츠 진입 보상형 광고(오늘/이달 제외)
import { isAdmin } from '../../lib/core/admin'; // 관리자·프리미엄 = 무료 진입 광고 제외
import { ChartPicker } from '../../components/ChartPicker';
import { getDailyFortune, dailyHeadline, dailyPreview } from '../../lib/content/dailyFortune';
import { stemElement, branchElement, elementColor, elementText } from '../../lib/engine/ohaeng'; // 오늘의 기운 = 오행색 네모 한자
import { useGenProgress, clearGenProgress } from '../../lib/backend/genProgress'; // 풀이 진행률(다중·route별, 풀이중 홈 나가도 % — daniel)
import { useSubscription } from '../../lib/billing/subscription';
import { loadRepChart, subscribeRepChange } from '../../lib/engine/myChart';
import { isPremiumForChart } from '../../lib/billing/premiumStore'; // 명식별 프리미엄(홈 카드 '이용중' 표시)
import { needsYearRepurchase } from '../../lib/billing/repurchase'; // 지난 해 연도 풀이 → '재구매' 배지(daniel 07-08)
import { prewarmReadings, prewarmDaily } from '../../lib/backend/prewarmReadings';
import { scheduleDailyFortune } from '../../lib/backend/notifications'; // 매일 9시 오늘의 운세 알림
import { buildSajuChart } from '@engine/saju';
import type { Stem, Branch } from '@spec/chart';
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { useHomeViewMode } from '../../lib/ui/homeView'; // 홈 보기 방식(카드/리스트) 저장·토글(daniel)
import { playSound } from '../../lib/ui/sounds';
import { BusyOverlay } from '../../components/BusyOverlay'; // 로그아웃 등 긴 콜백 로딩
import { PressableScale } from '../../components/PressableScale'; // 탭 피드백(눌림 표시)
import { CREDIT_KINDS, loadCredits, type CreditKind } from '../../lib/billing/coupons'; // 유료 카드 가격/상태 배지 + 쿠폰 잔량
import { appLang } from '../../lib/i18n'; // 대표 명식에 이 콘텐츠 풀이가 이미 있는지 조회(배지 '풀이있음')

type MenuItem = { key: string; labelKey: string; descKey?: string; image?: any; route: string; ready: boolean; premium?: boolean; content?: boolean; creditKey?: CreditKind };
type Section = { key: string; titleKey: string; descKey?: string; items: MenuItem[] };

// 유료 콘텐츠 가격 배지 — 정가(9,900) 대비 할인율 + 건당 할인가(₩). 건당가는 CREDIT_KINDS(coupons) 단일 출처.
//   무료(온디바이스) 콘텐츠는 creditKey 없음 → 배지 미표시.
const LIST_PRICE_ORIG = 19900; // 사주·자미 정가(할인율 표시 기준, daniel 06-28)
const CREDIT_PRICE: Record<string, number> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.price]));
const wonFmt = (n: number) => '₩' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); // 천단위 콤마(Hermes Intl 비의존)
const HOME_INDIVIDUAL = new Set(['dream', 'followup', 'timeresolve']); // 프리미엄 미포함(개별구매 전용) — 그 외는 프리미엄 명식이면 '이용중'
const priceLabel = (key: string) => {
  const p = CREDIT_PRICE[key] ?? 0;
  const disc = Math.round((1 - p / LIST_PRICE_ORIG) * 100);
  return disc > 0 ? `${disc}% · ${wonFmt(p)}` : wonFmt(p); // 정가(할인 0/음수)는 가격만
};

// 홈 = 무료 / 프리미엄 / 콘텐츠 3범주(daniel 기획, docs/기획_정보구조_v0.1.md).
//   · 무료: 온디바이스·룰(API 0). · 프리미엄: 사주·자미 2허브(각 풀이·타임라인·궁합). · 콘텐츠: 무료+유료 혼합.
//   명식 등록·전환은 상단 ChartPicker(그리드 제외).
const SECTIONS: Section[] = [
  { key: 'free', titleKey: 'menu.secFree', items: [
    { key: 'manse', labelKey: 'menu.manse', descKey: 'menu.manseDesc', image: require('../../../assets/icons/manse.jpg'), route: '/charts', ready: true },
    { key: 'today', labelKey: 'menu.today', descKey: 'menu.todayTileDesc', image: require('../../../assets/icons/today.jpg'), route: '/today', ready: true },
    { key: 'month', labelKey: 'menu.month', descKey: 'menu.monthTileDesc', image: require('../../../assets/icons/month.jpg'), route: '/month', ready: true },
    { key: 'dayPillar', labelKey: 'menu.dayPillar', descKey: 'menu.dayPillarDesc', image: require('../../../assets/icons/dayPillar.jpg'), route: '/dayPillar', ready: true },
  ] },
  // 프리미엄 = 사주·자미 2허브(각 허브 안에 원국풀이·타임라인 큰 카드) + 궁합 독립(사주+자미 교차, daniel).
  { key: 'premium', titleKey: 'menu.secPremium', descKey: 'menu.secPremiumDesc', items: [
    // premium 섹션 5종 — creditKey 부여(배지=badgeFor 명식별 상태: 프리미엄「무제한」·풀이있음「풀이있음·만료일」·쿠폰「쿠폰 N장」·그 외 개별가, daniel 07-08).
    { key: 'saju', labelKey: 'menu.saju', descKey: 'menu.sajuDesc', image: require('../../../assets/icons/premium.jpg'), route: '/reading', ready: true, premium: true, creditKey: 'reading' },        // 허브 제거 → 원국풀이 직접 진입(daniel 07-01)
    { key: 'ziwei', labelKey: 'menu.ziweiHub', descKey: 'menu.ziweiHubDesc', image: require('../../../assets/icons/ziwei.jpg'), route: '/ziwei', ready: true, premium: true, creditKey: 'ziwei' },        // 허브 제거 → 자미 원국풀이 직접
    { key: 'compat', labelKey: 'menu.compat', descKey: 'menu.compatDesc', image: require('../../../assets/icons/compat.jpg'), route: '/compat', ready: true, premium: true, creditKey: 'compat' },
    { key: 'timeline', labelKey: 'menu.timeline', descKey: 'menu.timelineDesc', image: require('../../../assets/icons/timeline.jpg'), route: '/timeline', ready: true, premium: true, creditKey: 'timeline' }, // 연도별 인생 타임라인 = 프리미엄 4종(사주·자미·궁합·타임라인) — 홈 리스트 누락 수정(daniel 07-02)
    // 신규(daniel 2026-07-02): 자식운 = 프리미엄 5번째 콘텐츠(프리미엄 무료·비프리미엄 개별 유료). premium.jpg 아이콘 재사용(전용 이미지 추후).
    { key: 'child', labelKey: 'menu.child', descKey: 'menu.childDesc', image: require('../../../assets/icons/child.jpg'), route: '/child', ready: true, premium: true, creditKey: 'child' },
  ] },
  // ★가장 많이 찾는(광고/유료 유도용, daniel 07-05) — 무료 '질문형'(재회/짝사랑/취업)을 프리미엄 바로 밑에 중복
  //   노출해 눈길을 끌고 → 화면 CTA로 유료 깊은 풀이 유도. 원본은 '가볍게 보기'에도 그대로(의도된 중복).
  //   ★키는 고유(hot*)로 — 같은 라우트라도 React 키/카드 ref 충돌 방지. 라벨·이미지·라우트는 light 원본과 동일.
  // ★인기(daniel 07-06: '가장 많이 찾는'→'인기'로 개칭·서브타이틀 제거). 유료 유도(재회/짝사랑/취업) + 인기 무료(연애스타일·반려동물) 혼합.
  { key: 'hot', titleKey: 'menu.secContent', items: [
    { key: 'hotReunionAsk', labelKey: 'menu.reunionAsk', descKey: 'menu.reunionAskDesc', image: require('../../../assets/icons/reunion.jpg'), route: '/reunionAsk', ready: true, content: true },
    { key: 'hotCrushAsk', labelKey: 'menu.crushAsk', descKey: 'menu.crushAskDesc', image: require('../../../assets/icons/crush.jpg'), route: '/crushAsk', ready: true, content: true },
    { key: 'hotJobAsk', labelKey: 'menu.jobAsk', descKey: 'menu.jobAskDesc', image: require('../../../assets/icons/job.jpg'), route: '/jobAsk', ready: true, content: true },
    // daniel 07-06: 인기에 연애스타일·반려동물 추가(무료 온디바이스, light 원본과 동일·hot* 고유키로 React 키 충돌 방지).
    { key: 'hotLovestyle', labelKey: 'menu.lovestyle', descKey: 'menu.lovestyleTileDesc', image: require('../../../assets/icons/lovestyle.jpg'), route: '/lovestyle', ready: true, content: true },
    { key: 'hotPet', labelKey: 'menu.pet', descKey: 'menu.petDesc', image: require('../../../assets/icons/pet.jpg'), route: '/pet', ready: true, content: true },
  ] },
  // 스페셜 = 유료 LLM 콘텐츠(애정흐름·인생그래프·신년 등). 골드 라인아트 타일 이미지(Recraft). (옛 '가장 많이 찾는' → daniel 07-05 스페셜로 개칭)
  { key: 'special', titleKey: 'menu.secSpecial', descKey: 'menu.secContentDesc', items: [
    // daniel(2026-06-24): 신년운세 = 시즌 콘텐츠라 리스트 제일 앞.
    { key: 'newyear', labelKey: 'menu.newyear', descKey: 'menu.newyearTileDesc', image: require('../../../assets/icons/newyear.jpg'), route: '/newyear', ready: true, content: true, creditKey: 'newyear' },
    { key: 'love', labelKey: 'menu.love', descKey: 'menu.loveDesc', image: require('../../../assets/icons/love.jpg'), route: '/love', ready: true, content: true, creditKey: 'love' },
    // 신규(daniel 2026-07-05): 재회·짝사랑·취업 유료 깊은 풀이 = '가장 많이 찾는'에 가격 노출. 무료 '질문형' 진입은
    //   '가볍게 보기' 섹션(reunionAsk/crushAsk/jobAsk)에서 결정론 미리보기 → 이 유료로 유도(daniel 모델).
    { key: 'reunion', labelKey: 'menu.reunion', descKey: 'menu.reunionDesc', image: require('../../../assets/icons/reunion.jpg'), route: '/reunion', ready: true, content: true, creditKey: 'reunion' },
    { key: 'crush', labelKey: 'menu.crush', descKey: 'menu.crushDesc', image: require('../../../assets/icons/crush.jpg'), route: '/crush', ready: true, content: true, creditKey: 'crush' },
    { key: 'job', labelKey: 'menu.job', descKey: 'menu.jobDesc', image: require('../../../assets/icons/job.jpg'), route: '/job', ready: true, content: true, creditKey: 'job' },
    { key: 'lifegraph', labelKey: 'menu.lifegraph', descKey: 'menu.lifegraphDesc', image: require('../../../assets/icons/lifegraph.jpg'), route: '/lifegraph', ready: true, content: true, creditKey: 'lifegraph' },
    // 신규(daniel 2026-07-02): 10년 뒤 나의 모습(대운·세운 스페셜, 개별 유료). lifegraph.jpg 아이콘 재사용(전용 이미지 추후).
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
    // 신규(daniel 2026-06-23): 별자리 운세(유료 LLM). ※수비학은 무료화(온디바이스·API 0)되어 light 섹션으로 이동(daniel: 비용 안 들면 무료).
    { key: 'astrology', labelKey: 'menu.astrology', descKey: 'menu.astrologyDesc', image: require('../../../assets/icons/astrology.jpg'), route: '/astrology', ready: true, content: true, creditKey: 'astrology' },
    // 신규(daniel 2026-06): 사업가의 나 vs 직장인의 나.
    { key: 'career', labelKey: 'menu.career', descKey: 'menu.careerDesc', image: require('../../../assets/icons/career.jpg'), route: '/career', ready: true, content: true, creditKey: 'career' },
    // daniel #B(2026-06-24): 세계를 움직이는 사람들 — 유명인 사주 ↔ 나 매칭(재미·추정, 투자/정치 단정 금지). 유료(1회로 전 인물).
    { key: 'celeb', labelKey: 'menu.celeb', descKey: 'menu.celebDesc', image: require('../../../assets/icons/celeb.jpg'), route: '/celeb', ready: true, content: true, creditKey: 'celeb' },
    // daniel #18(2026-06-24): 맞춤 개운법(원국+지금 운 → 구체 처방·살풀이). 부적/만다라 이미지.
    { key: 'gaeun', labelKey: 'menu.gaeun', descKey: 'menu.gaeunDesc', image: require('../../../assets/icons/gaeun.jpg'), route: '/gaeun', ready: true, content: true, creditKey: 'gaeun' },
  ] },
  // 가볍게 = 무료·온디바이스 재미(펫·성격유형·택일·행운·띠별자리·이름풀이·꿈해몽). API 0(daniel: 스페셜 아래 무료 따로).
  { key: 'light', titleKey: 'menu.secLight', descKey: 'menu.secLightDesc', items: [
    // 신규(daniel 2026-07-05): 재회·짝사랑·취업 무료 '질문형'(올해 결정론 미리보기) → 화면 CTA로 유료 깊은 풀이 유도. 가볍게 보기에 배치.
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
    // daniel #A(2026-06-24): 내가 살기 좋은 곳(원국 조후→기후/방위·국기, 무료·온디바이스). country.jpg 연결(daniel: 홈 카드 이미지 누락 — image 필드 자체가 없어 빈 카드였음).
    { key: 'country', labelKey: 'menu.country', descKey: 'menu.countryDesc', image: require('../../../assets/icons/country.jpg'), route: '/country', ready: true, content: true },
    { key: 'luck', labelKey: 'menu.luck', descKey: 'menu.luckTileDesc', image: require('../../../assets/icons/luck.jpg'), route: '/luck', ready: true, content: true },
    // 별자리(/zodiac)는 점성술 콘텐츠로 병합(daniel 2026-06-23) — 별도 홈 카드 제거. /zodiac 라우트는 유지(딥링크 안전).
    { key: 'name', labelKey: 'menu.name', descKey: 'menu.nameTileDesc', image: require('../../../assets/icons/name.jpg'), route: '/name', ready: true, content: true },
    { key: 'dream', labelKey: 'menu.dream', descKey: 'menu.dreamTileDesc', image: require('../../../assets/icons/dream.jpg'), route: '/dream', ready: true, content: true },
  ] },
];

// ─────────────────────────────────────────────────────────────────────────
// 홈 카드 순차 로딩(daniel: "이미지 로딩이 너무 김 — 한번에 다 하지 말고 위→아래로 하나씩").
//   문제: SECTIONS 전체(약 35장)를 한 프레임에 렌더하면 모든 카드 이미지가 동시에 디코드 → 스레드 포화 → 로딩 지연·랙.
//   해법: 카드마다 '전역 순번'을 부여하고, 그 순번이 공개분(revealCount)에 들어올 때만 이미지를 mount(디코드 시작).
//        → 디코드 작업이 위→아래 시간축으로 분산되어, 위쪽 카드가 즉시 뜨고 아래로 한 장씩 채워진다.
//   CARD_REVEAL_OFFSETS[secIdx] = 그 섹션이 시작되기 전까지의 누적 카드 수(= 첫 카드의 전역 순번).
//     카드 전역 순번 = CARD_REVEAL_OFFSETS[secIdx] + itemIdx (섹션·항목 순서 = 화면 위→아래 순서).
//   SECTIONS는 정적이라 모듈 로드 시 1회만 계산(렌더마다 재계산 안 함).
const CARD_REVEAL_OFFSETS: number[] = (() => {
  const offsets: number[] = [];
  let acc = 0;
  for (const sec of SECTIONS) { offsets.push(acc); acc += sec.items.length; }
  return offsets;
})();
const TOTAL_CARDS = SECTIONS.reduce((n, s) => n + s.items.length, 0); // 전체 카드 수(공개 완료 판정 = revealCount >= TOTAL_CARDS)

// 홈 카드 켄번스 — 정적 이미지를 아주 느리게 줌(daniel #21: 카드가 '가볍게' 살아 움직이게).
//   정적 일러스트라 내부 요소 자체를 움직일 순 없어, 느린 줌으로 생동감을 준다. native 드라이버=GPU라 스크롤 영향 최소.
function KenBurnsCard({ source }: { source: any }) {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(s, { toValue: 1, duration: 6500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(s, { toValue: 0, duration: 6500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [s]);
  const scale = s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
      <ExpoImage source={source} style={[StyleSheet.absoluteFill, styles.cardImgInner]} contentFit="cover" cachePolicy="memory-disk" transition={120} />
    </Animated.View>
  );
}

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 오늘의 기운 배너 본문(읽는 글) 글자 크기 반영
  const { viewMode, setViewMode } = useHomeViewMode(); // 홈 메뉴 보기 방식(카드/리스트) — 저장·토글(daniel)
  const gen = useGenProgress(); // 통변 생성 진행률(풀이중 홈 나가면 여기 배너로 %)
  // I(daniel): %가 움직이도록 — 진행 중 풀이가 있으면 주기 리렌더(단일 콜의 추정 % 갱신). 진행 없으면 타이머 미동작.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!gen.some((g) => g.active && g.done < g.total)) return;
    const id = setInterval(() => setTick((x) => x + 1), 700);
    return () => clearInterval(id);
  }, [gen]);
  // 홈 배너 % — multi(사주16/자미12)=저장 기반 실제값, single(총1)=시작~저장 추정(저장되면 done>=total로 완료 분기=100%)
  const genPct = (done: number, total: number, startedAt: number) => total > 1
    ? Math.round((done / total) * 100)
    : Math.min(95, Math.max(3, Math.round(((Date.now() - startedAt) / 20000) * 100)));
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [admin, setAdmin] = useState(false);
  const [repServerChartId, setRepServerChartId] = useState<string | null>(null); // 현재 대표 명식 serverChartId(홈 카드 프리미엄 판정 — 명식 전환 시 재평가)
  // 홈 유료 카드 배지(명식별 상태·daniel 07-08) — 현 대표 명식의 쿠폰 잔량 + 이미 생성된 풀이(카테고리·생성일).
  const [credits, setCredits] = useState<Record<string, number>>({});                            // creditKey별 쿠폰 잔량('쿠폰 N장')
  const [readingRows, setReadingRows] = useState<{ category: string; created_at: string }[]>([]); // 이 명식의 기존 풀이('풀이있음 · 만료일')
  // session 반응형 — 로그아웃(session=null) 즉시 관리자 메뉴 숨김(daniel). 빈 deps면 마운트 1회라 창 전환 전까지 살아있었음.
  useEffect(() => { if (!session) { setAdmin(false); return; } isAdmin().then(setAdmin).catch(() => {}); }, [session]);
  const [dayOffset, setDayOffset] = useState(0); // 0=오늘·1=내일(오늘의 기운 카드 토글)
  // 날짜 키 — 홈을 켜둔 채 자정이 지나도 갱신되게(③). 포커스·앱 복귀 시 재확인.
  const [dateKey, setDateKey] = useState(() => new Date().toDateString());
  // 오늘·내일 둘 다 미리 계산(daniel: 좌우 슬라이드 — 손가락 따라 미끄러지는 가로 페이징)
  const fortunes = useMemo(() => [getDailyFortune(0), getDailyFortune(1)], [dateKey]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // 오늘/내일 가로 페이징(네이티브 슬라이드) 제어 — 페이지 폭은 onLayout 으로 확정(초기엔 대략값=깜빡임 방지)
  const fortunePager = useRef<ScrollView>(null);
  const [pageW, setPageW] = useState(Dimensions.get('window').width - space(5) * 2 - space(4) * 2);
  const goDay = (off: number) => { setDayOffset(off); fortunePager.current?.scrollTo({ x: off * pageW, animated: true }); };
  // 오늘·내일 각각의 한 줄 풀이(글)+캐치 타이틀 — 대표 명식 일간 × 그날 일진(온디바이스). [0]=오늘 [1]=내일.
  const [dayData, setDayData] = useState<{ headline: string | null; prose: string | null }[]>([{ headline: null, prose: null }, { headline: null, prose: null }]);
  const [hasChart, setHasChart] = useState<boolean>(true); // H1(daniel): 대표 명식 유무 — 없으면 오늘/내일 배너를 '명식 등록 안내'로(탭→등록)
  const [reloadKey, setReloadKey] = useState(0); // 명식 변경(전환·수정) 감지 — 포커스마다 오늘의 기운 재계산(daniel: 명식 수정 시 id 동일이라 갱신 안 되던 버그)
  const [loggingOut, setLoggingOut] = useState(false); // 로그아웃 콜백 동안 오버레이
  // 카드 이미지 순차 공개(daniel) — 위→아래로 한 장씩 mount. 전역 순번 < revealCount 인 카드만 이미지 로드.
  //   ★타이머(시간 기반)를 택한 이유: 가장 단순·안정적. expo-image onLoad 체인 방식은 이미지 하나라도
  //     로드 실패/지연하면 거기서 멈춰(stall) 아래 카드가 영영 안 뜨는 위험이 있음. 타이머는 절대 멈추지 않는다.
  //   첫 장은 즉시(빈 화면 깜빡임 방지), 이후 ~90ms 간격으로 한 장씩. 전부 공개되면 effect가 일찍 return → 타이머 정지.
  //   탭 화면이라 마운트 유지 → 한 번 공개되면 revealCount가 TOTAL_CARDS로 남아, 재포커스 시엔 placeholder 없이 즉시 표시(캐시).
  const [revealCount, setRevealCount] = useState(1);
  useEffect(() => {
    if (revealCount >= TOTAL_CARDS) return; // 모두 공개됨 → 더 이상 타이머 안 검(정지)
    const id = setTimeout(() => setRevealCount((c) => c + 1), 90); // 한 장씩 위→아래 공개(디코드 시간 분산)
    return () => clearTimeout(id);
  }, [revealCount]);
  async function doLogout() {
    setLoggingOut(true);
    try { await supabase.auth.signOut(); }
    finally { setLoggingOut(false); }
  }
  // 홈 포커스 시(명식 변경 후 복귀 포함) 날짜·대표 명식 재확인 → 오늘의 기운 갱신(①③)
  useFocusEffect(useCallback(() => {
    setDateKey(new Date().toDateString());
    setReloadKey((k) => k + 1); // 홈 복귀마다 재계산 트리거 → 명식 전환·수정 모두 반영(daniel)
  }, []));
  // 명식 전역 변경(전환·수정·★로그아웃 클리어) 구독 → 오늘의 기운 즉시 재계산. 로그아웃 시 화면 전환 없이 명식이 비워지면 바로 빈 상태로(daniel).
  useEffect(() => subscribeRepChange(() => setReloadKey((k) => k + 1)), []);
  // 백그라운드→포그라운드(자정 넘겨 홈 유지) 시 날짜 재확인(③)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setDateKey(new Date().toDateString()); });
    return () => sub.remove();
  }, []);
  // 대표 명식 × 오늘·내일 일진 → 각 날의 한 줄 풀이+캐치(둘 다 미리 = 슬라이드 시 즉시 표시). ①③ 재계산.
  useEffect(() => {
    (async () => {
      const rep = await loadRepChart();
      setHasChart(!!rep); // H1: 명식 유무 → 오늘/내일 배너 분기(등록안내 vs 운세)
      setRepServerChartId(rep?.serverChartId ?? null); // 홈 카드 프리미엄 판정용(명식 전환 시 reloadKey로 이 effect 재실행=재평가)
      if (!rep) { setDayData([{ headline: null, prose: null }, { headline: null, prose: null }]); return; }
      const saju = buildSajuChart(rep.input);
      const calc = (f: typeof fortunes[number]) => ({
        // 미리보기 본문 = 조합형(매일·오늘≠내일 다르게, API 0). 상세 화면은 전체 풀이(dailyChartReadings) 별도.
        prose: dailyPreview(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch),
        headline: dailyHeadline(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch),
      });
      setDayData([calc(fortunes[0]), calc(fortunes[1])]);
    })();
  }, [fortunes, reloadKey]);

  // 홈 유료 카드 배지 데이터 — 대표 명식의 쿠폰 잔량 + 기존 풀이(카테고리+생성일) 로드.
  //   deps: 명식 전환(repServerChartId)·홈 복귀/명식 수정(reloadKey)·로그인 상태(session). 로그인·명식 없으면 비움(null 가드).
  useEffect(() => {
    if (!session || !repServerChartId) { setCredits({}); setReadingRows([]); return; }
    let alive = true;
    (async () => {
      const cr = await loadCredits().catch((): Record<string, number> => ({})); // 쿠폰 잔량(로그인=서버·비로그인=로컬)
      const { data } = await supabase                                            // 이 명식에 이미 있는 풀이(카테고리+생성일)
        .from('readings').select('category, created_at')
        .eq('chart_id', repServerChartId).eq('lang', appLang());
      if (!alive) return;
      setCredits(cr);
      setReadingRows((data ?? []) as { category: string; created_at: string }[]);
    })().catch(() => {});
    return () => { alive = false; };
  }, [repServerChartId, reloadKey, session]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
  }, []);

  // 매일 9시 '오늘의 운세' 알림 스케줄(향후 14일치, 진입마다 갱신). 네이티브 모듈/권한 없으면 no-op.
  useEffect(() => { scheduleDailyFortune().catch(() => {}); }, []);

  // 프로 구독자 풀이 선생성(daniel: "구독하면 통변 1회는 미리 돌아가게") — 홈 진입 시
  //   대표 명식의 전 영역(사주16+자미12)을 백그라운드 생성. 멱등(캐시된 영역 skip = 재과금 0).
  useEffect(() => {
    if (!session || !isPremium) return;
    (async () => {
      const rep = await loadRepChart();
      if (rep) prewarmReadings(rep, session); // fire-and-forget — 실패해도 앱 흐름 무관
      if (rep) prewarmDaily(rep, session);    // H2(daniel): 오늘·내일 정확한 운세(LLM) 미리 생성 → /today 즉시(프리미엄만, 구독이 비용 커버)
    })();
  }, [session, isPremium]);

  // ★카드 연타·중복 진입 차단(daniel) — 네비가 진행 중이면 다음 탭을 즉시 무시(같은/다른 화면 이중 push 방지).
  //   동기 ref라 state 리렌더 전에도 막힌다. 광고 시청 구간에도 잠금 유지 → 광고 중 다른 카드 탭이 먹지 않음.
  const navigatingRef = useRef(false);
  // ★카드 진입 애니(daniel 07-01): 탭한 카드가 그 자리에서 확대되어 화면 중앙으로 나오며 페이드아웃 → 컨텐츠 진입.
  //   measureInWindow로 카드 위치를 재 '그 자리에서' 시작(진짜 그 카드가 앞으로 나오는 느낌). 이미지 카드에만(텍스트는 즉시).
  const cardRefs = useRef<Record<string, View | null>>({});
  // 카드 → 컨텐츠 진입: 확대 오버레이 제거(daniel 07-02 "확대 별로"). '누른 느낌'=PressableScale + 화면 페이드 전환으로 대체 → 바로 이동.
  function launchCard(m: MenuItem) { router.navigate(m.route); }
  async function onPress(m: MenuItem) {
    if (navigatingRef.current) return;                 // 이미 진입 처리 중 — 연타 무시
    playSound('click');
    if (!m.ready) { Alert.alert(t(m.labelKey), t('common.comingSoon')); return; }
    // daniel #8(2026-06-24): 무료 콘텐츠는 로그인 없이(광고 보면 OK·온디바이스라 서버 불필요). 로그인은 *유료/구매(계정 귀속)* 콘텐츠에만 필요.
    //   (LLM 무료 콘텐츠 = 에겐테토는 점수만 비로그인 표시·설명 LLM은 화면 내 로그인 유도. 오늘/이달 운세는 서버차트 필요 → 추후 익명세션 백엔드.)
    if ((m.premium || m.creditKey) && !session) {
      Alert.alert(t('login.needTitle', '로그인이 필요해요'), t('login.needContentMsg', '이 콘텐츠를 보려면 로그인해 주세요. 로그인하면 구매·풀이가 계정에 안전하게 저장돼요.'), [
        { text: t('login.go', '로그인'), onPress: () => router.push('/login') },
        { text: t('common.cancel', '취소'), style: 'cancel' },
      ]);
      return;
    }
    navigatingRef.current = true;                      // 진입 경로 잠금(연타 이중 push 차단)
    // ★무료 온디바이스 콘텐츠 진입 = 보상형 광고 1회(daniel 07-02: 오늘/이달 제외 나머지 무료는 진입 시 바로 광고).
    //   scope=content 카드 & 유료(creditKey) 아님. 오늘·이달의 운세는 content 플래그가 없어 자동 제외(그 화면 내부에 '광고 보고 보기' 별도).
    //   프리미엄=광고 없음. 관리자=평소 제외하되 테스트광고 모드면 게이트 동작. 카드 탭=유저 개시(보상형 정책 OK).
    if (m.content && !m.creditKey && !isPremium && (!admin || adTestMode())) await showRewardedAd().catch(() => false);
    launchCard(m);
    setTimeout(() => { navigatingRef.current = false; }, 900); // 광고+진입 커버 후 해제(연타 이중 push 차단)
  }

  // ★홈 유료 카드 배지(daniel 07-08) — 가격 대신 '명식별 상태'를 보여준다. 우선순위대로 첫 매칭 반환:
  //   ① 프리미엄(대표 명식 지정) = '무제한' — 단 개별전용 3종(dream/followup/timeresolve)은 프리미엄 커버 밖이라 제외.
  //   ② 이 명식에 이 콘텐츠 풀이가 이미 있음 = '풀이있음 · {만료일}'(생성일+1년, ExpiryNote와 동일 YYYY.MM.DD).
  //   ③ 이 creditKey 쿠폰 잔량 > 0 = '쿠폰 {n}장'.
  //   ④ 그 외 = 개별 가격(priceLabel, 기존). creditKey 없으면 null(배지 없이 › 셰브런).
  //   리스트뷰·카드뷰가 이 헬퍼 하나만 쓴다(단일 출처). 데이터는 위 useEffect가 대표 명식 기준으로 적재.
  function badgeFor(m: MenuItem): string | null {
    const ck = m.creditKey;
    if (!ck) return null;                                                                  // 무료 콘텐츠 = 배지 없음
    if (isPremiumForChart(repServerChartId) && !HOME_INDIVIDUAL.has(ck)) return '무제한';   // ①
    // ② 올해(또는 연도무관) 풀이 우선 → '풀이있음 · 만료일'. 지난 해 연도 풀이(newyear_2026 등)만 있으면 → '재구매'(daniel 07-08 수익구조).
    const nowD = new Date();
    const matched = readingRows.filter((r) => r.category === ck || r.category.startsWith(ck + '_'));
    const cur = matched.find((r) => !needsYearRepurchase(r.category, nowD)); // 현재연도 or 연도무관 풀이(재구매 불필요)
    if (cur?.created_at) {
      const d = new Date(cur.created_at);
      d.setFullYear(d.getFullYear() + 1);
      const exp = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      return `풀이있음 · ${exp}`;
    }
    if (matched.length > 0) return '재구매'; // 지난 해 연도 풀이만 남음 → 올해 것으로 재구매 유도(진입 시 category=올해라 새 게이트)
    if ((credits[ck] ?? 0) > 0) return `쿠폰 ${credits[ck]}장`;                              // ③
    return priceLabel(ck);                                                                 // ④ 개별 가격
  }

  return (
    <ImageBackground source={bgSource} style={styles.bgImage} resizeMode="cover">
    <HomeBackdrop />
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* 헤더 — 타이틀 옆에 계정(사람) 아이콘: 탭 → 계정 관리·프리미엄 구매(설정)(daniel) */}
        <View style={styles.headerRow}>
          {/* 타이틀·서브타이틀 = 좌측 컬럼. ★왼쪽 못박기(daniel 07-02: 여전히 가운데로 보임 → 명시 좌측): 컬럼 alignItems:flex-start + 텍스트 textAlign:left. 👤만 우측 y축 가운데 */}
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={styles.title}>{t('appName')}</Text>
            <Text style={styles.sub}>{t('tagline')}</Text>
          </View>
          <PressableScale onPress={() => router.push('/settings')} hitSlop={10} style={styles.accountBtn}>
            <Text style={styles.accountIcon}>👤</Text>
          </PressableScale>
        </View>
        <View style={styles.divider} />
        {/* 통변 생성 진행률(daniel) — 여러 개 동시 풀이 가능 → route별 배너 여러 개. 탭=그 화면 이동 + 그 배너만 닫기. */}
        {gen.map((g) => (g.total > 0 && g.done >= g.total ? (
          // 완료(daniel 이슈13): '풀이 보기' — 탭하면 그 화면 이동 + 그 배너만 닫기(다른 풀이 배너는 유지).
          <PressableScale key={g.route} onPress={() => { clearGenProgress(g.route); router.navigate(g.route as any); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(4), marginBottom: space(3), gap: space(2) }}>
            <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(13), flex: 1 }}>{g.chartLabel ? g.chartLabel + ' — ' : ''}{g.label} 풀이가 완성됐어요!</Text>
            <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(13) }}>풀이 보기 ›</Text>
          </PressableScale>
        ) : (
          <PressableScale key={g.route} onPress={() => router.navigate(g.route as any)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.juSoft, borderColor: colors.ju, borderWidth: 1, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(4), marginBottom: space(3), gap: space(2) }}>
            <Text style={{ color: colors.ju, fontWeight: '700', fontSize: fs(13), flex: 1 }}>{g.restored ? `이전에 진행중이던 ${g.chartLabel ? g.chartLabel + ' — ' : ''}${g.label} 풀이가 있어요` : `${g.chartLabel ? g.chartLabel + ' — ' : ''}${g.label} 풀이 중… ${g.total > 1 ? `${g.done}/${g.total} ` : ''}${genPct(g.done, g.total, g.startedAt)}%`}</Text>
            <Text style={{ color: colors.ju, fontWeight: '700', fontSize: fs(13) }}>이어보기 ›</Text>
          </PressableScale>
        )))}

        {/* 오늘/내일 기운 — 토글 또는 좌우 슬라이드(가로 페이징·daniel). 본문 탭 → 상세(분야별, 같은 offset). */}
        <View style={styles.fortuneBanner}>
          {!hasChart ? (
            // H1(daniel): 명식 미등록 → 오늘/내일 운세 대신 등록 안내(탭하면 등록창)
            <PressableScale onPress={() => router.push('/register')} style={{ alignItems: 'center', paddingVertical: space(5), gap: space(2) }}>
              <Text style={{ color: colors.ju, fontWeight: '900', fontSize: fs(16), textAlign: 'center' }}>{t('home.noChartTitle', '명식을 등록하면 오늘·내일 운세를 봐요')}</Text>
              <Text style={{ color: colors.inkSoft, fontSize: fs(13), textAlign: 'center' }}>{t('home.noChartSub', '생년월일시로 나의 사주를 먼저 등록해 주세요')}</Text>
              <View style={{ backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(2) }}>
                <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(14) }}>{t('home.noChartCta', '+ 명식 등록')}</Text>
              </View>
            </PressableScale>
          ) : (<>
          <View style={styles.dayToggle}>
            {([0, 1] as const).map((off) => (
              <PressableScale key={off} style={[styles.dayTogChip, dayOffset === off && styles.dayTogChipOn]} onPress={() => goDay(off)}>
                <Text style={[styles.dayTogTx, dayOffset === off && styles.dayTogTxOn]}>{t(off === 0 ? 'today.today' : 'today.tomorrow')}</Text>
              </PressableScale>
            ))}
          </View>
          {/* 가로 페이징 = 손가락 따라 슬라이드. onLayout 으로 페이지 폭 확정 → 한 페이지씩 스냅. */}
          <View onLayout={(e) => setPageW(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={fortunePager}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setDayOffset(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageW)))}
            >
              {([0, 1] as const).map((off) => {
                const f = fortunes[off];
                const d = dayData[off];
                return (
                  <PressableScale key={off} style={{ width: pageW }} onPress={() => router.push(`/today?offset=${off}`)}>
                    <Text style={styles.bannerDate}>{f.date} ({t('today.weekdaysShort').split(',')[new Date(f.date + 'T00:00:00').getDay()] ?? ''})</Text>
                    <View style={styles.bannerPillarRow}>
                      <Text style={styles.bannerPillar}>{off === 0 ? t('today.dayPillar') : t('today.energyTomorrow')}</Text>
                      <View style={styles.gzBoxRow}>
                        {[f.dayGanZhi[0], f.dayGanZhi[1]].map((ch, i) => {
                          const el = i === 0 ? stemElement(ch) : branchElement(ch); // 천간·지지 오행
                          return (
                            <View key={i} style={[styles.gzBox, { backgroundColor: elementColor[el] }]}>
                              <Text style={[styles.gzBoxTx, { color: elementText[el] }]}>{ch}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    {d.headline && <Text style={[styles.bannerHeadline, { fontSize: fs(16) }]}>{d.headline}</Text>}
                    {d.prose && <Text style={[styles.bannerProse, { fontSize: fs(15), lineHeight: fs(22) }]} numberOfLines={3}>{d.prose}</Text>}
                    {d.prose && <Text style={styles.bannerMore}>{t('today.more')}</Text>}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>
          </>)}
        </View>

        {/* 대표 명식 선택/전환 (등록한 다른 명식으로 변경) — 전환 시 오늘의 기운 즉시 재계산(daniel) */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />

        {/* 홈 보기 방식 토글(daniel: "홈에서 카드뷰↔리스트뷰 변경") — 아래 메뉴를 카드/리스트로 전환.
            우측 정렬 세그먼트(카드 ▦ / 리스트 ☰), 활성 골드 강조, 선택은 저장(다음 실행에도 유지). */}
        <View style={styles.viewToggleRow}>
          <View style={styles.viewToggle}>
            {(['card', 'list'] as const).map((mode) => (
              <PressableScale
                key={mode}
                style={[styles.viewTogChip, viewMode === mode && styles.viewTogChipOn]}
                onPress={() => setViewMode(mode)}
              >
                <Text style={[styles.viewTogTx, viewMode === mode && styles.viewTogTxOn]}>
                  {mode === 'card' ? '▦' : '☰'} {t(mode === 'card' ? 'menu.viewCard' : 'menu.viewList')}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {/* 무료 / 프리미엄 / 콘텐츠 3범주 — 큰 섹션 헤더 + 좌우 가로 스크롤 카드(daniel) */}
        {SECTIONS.map((sec, secIdx) => {
          const isLight = sec.key === 'light'; // '가볍게 보기' = 항목이 많아 가로 스크롤 대신 2열 줄바꿈(daniel)
          const isDeep = sec.key === 'deep';   // '나에 대해 알기' = 5개 넘어 2줄(컬럼 정렬) 가로 스크롤(daniel 2026-06-23)
          // 섹션 헤더(밴드/타이틀 + 설명) — 카드뷰·리스트뷰가 동일하게 재사용(중복 제거·정합).
          const sectionHeader = (
            <>
              {/* '무료' 라벨은 빼고(daniel) 맨 위 기본 섹션은 헤더 없이 — 프리미엄·스페셜만 헤더 표시 */}
              {sec.key === 'hot' ? (
                // ★'가장 많이 찾는' 홈 강조(daniel 07-05) — 연한 골드 하이라이트 밴드(테두리·🔥 제거). 프리미엄 바로 밑 광고/유료유도 섹션. colors.juSoft/ju = 라이트/다크 자동.
                <View style={styles.sectionHotBand}>
                  <Text style={styles.sectionHotTx}>{t(sec.titleKey)}</Text>
                </View>
              ) : (
                <Text style={styles.sectionH}>{t(sec.titleKey)}</Text>
              )}
              {sec.key !== 'free' && sec.descKey ? <Text style={styles.sectionDesc}>{t(sec.descKey)}</Text> : null}
            </>
          );

          // ── 리스트뷰(daniel: "리스트로 좀 더 보기 편한 뷰") ─────────────────────────
          //   카드뷰의 순차 공개·켄번스 줌 없이, 각 항목을 세로 '행'으로: 작은 썸네일(좌) + 제목·설명(가운데)
          //   + 가격 배지/셰브런(우). 썸네일이 작아(≈54px) expo-image 다운샘플로 전량 즉시 로드해도 가볍다.
          //   가격/프리미엄 판정·진입(onPress)은 카드뷰와 완전히 동일한 헬퍼를 재사용(단일 출처).
          if (viewMode === 'list') {
            return (
              <View key={sec.key} style={styles.section}>
                {sectionHeader}
                <View style={styles.listBody}>
                  {sec.items.map((m) => {
                    const prem = !!m.premium;
                    // 배지 텍스트 = 카드뷰와 동일 규칙(badgeFor 단일 출처: 무제한/풀이있음·만료일/쿠폰/금액). creditKey 없으면 › 셰브런.
                    const priceTxt = badgeFor(m);
                    return (
                      <PressableScale key={m.key} style={styles.listRow} onPress={() => onPress(m)}>
                        {m.image ? (
                          // 썸네일(작아서 순차 공개 불필요 — expo-image 다운샘플로 메모리·랙 무시할 수준)
                          <ExpoImage source={m.image} style={styles.listThumb} contentFit="cover" cachePolicy="memory-disk" transition={120} />
                        ) : (
                          // 이미지 없는 항목(텍스트 카드) = 라벨 첫 글자 골드 썸네일 placeholder(행 정렬 유지)
                          <View style={[styles.listThumb, styles.listThumbPlaceholder]}>
                            <Text style={styles.listThumbGlyph}>{t(m.labelKey).slice(0, 1)}</Text>
                          </View>
                        )}
                        <View style={styles.listTextCol}>
                          <Text style={[styles.listLabel, prem && styles.listLabelPrem]} numberOfLines={1}>{t(m.labelKey)}</Text>
                          {m.descKey ? <Text style={styles.listDesc} numberOfLines={2}>{t(m.descKey)}</Text> : null}
                        </View>
                        {priceTxt ? (
                          <View style={styles.listPriceTag}><Text style={styles.listPriceTx}>{priceTxt}</Text></View>
                        ) : (
                          <Text style={styles.listChevron}>›</Text>
                        )}
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            );
          }

          // ── 카드뷰(기본·기존 유지) — 순차 공개 + 켄번스 가로 스크롤 ──────────────────
          const cards = sec.items.map((m, itemIdx) => {
            const prem = !!m.premium;
            const badge = badgeFor(m); // 유료 카드 배지(명식별 상태: 무제한/풀이있음/쿠폰/금액) — 텍스트·이미지 카드 공용 단일 출처
            // 순차 공개 — 이 카드의 전역 순번(섹션 오프셋 + 항목 인덱스 = 화면 위→아래 순서)이 공개분에 들어왔는지.
            //   revealed=false면 이미지 대신 미드나잇 빈 박스만 렌더(디코드 미발생) → 차례가 오면 KenBurnsCard로 교체.
            const revealed = CARD_REVEAL_OFFSETS[secIdx] + itemIdx < revealCount;
            // 콘텐츠(이미지 없음) = 텍스트 카드(제목+설명), 이미지 카드와 시각 구분
            if (!m.image) {
              return (
                <PressableScale key={m.key} ref={(n) => { cardRefs.current[m.key] = n; }} style={[styles.card, styles.textCard]} onPress={() => onPress(m)}>
                  {badge && (
                    <View style={styles.priceTag}>
                      <Text style={styles.priceTagText}>{badge}</Text>
                    </View>
                  )}
                  <Text style={styles.textCardLabel}>{t(m.labelKey)}</Text>
                  {m.descKey ? <Text style={styles.textCardDesc}>{t(m.descKey)}</Text> : null}
                </PressableScale>
              );
            }
            return (
              <PressableScale key={m.key} ref={(n) => { cardRefs.current[m.key] = n; }} style={styles.card} onPress={() => onPress(m)}>
                <View style={styles.cardImg}>
                  {/* expo-image 다운샘플 유지(메모리·랙) + 켄번스 느린 줌(daniel #21). absoluteFill 배경 + 위 오버레이. */}
                  {/* 순차 로딩(daniel) — 차례가 온 카드만 이미지 mount, 그 전엔 미드나잇 빈 박스(디코드 분산). 라벨/배지는 그대로 유지(레이아웃 동일). */}
                  {revealed
                    ? <KenBurnsCard source={m.image} />
                    : <View style={[StyleSheet.absoluteFill, styles.cardImgInner, styles.cardPlaceholder]} />}
                  {/* 유료 카드 배지(daniel 07-08) — 명식별 상태: 프리미엄=「무제한」(개별전용 3종 제외)·기존 풀이=「풀이있음 · 만료일」·쿠폰 보유=「쿠폰 N장」·그 외=가격. badgeFor 단일 출처. */}
                  {badge && (
                    <View style={styles.priceTag}>
                      <Text style={styles.priceTagText}>{badge}</Text>
                    </View>
                  )}
                  {/* 하단 라벨 바(반투명 남색) — 라벨 + 간략 설명(daniel: 콘텐츠별 설명) */}
                  <View style={styles.labelBar}>
                    <Text style={[styles.cardLabel, prem && styles.cardLabelPrem]}>{t(m.labelKey)}</Text>
                    {m.descKey ? <Text style={styles.cardDesc} numberOfLines={2}>{t(m.descKey)}</Text> : null}
                  </View>
                </View>
              </PressableScale>
            );
          });
          return (
            <View key={sec.key} style={styles.section}>
              {sectionHeader}
              {isLight ? (
                // 좌우 스크롤 — 한 줄 5개씩, 5개 넘으면 아래 줄로 쌓음(daniel: 두번째 줄 5개 초과 시 세번째 줄로). 가로 스크롤 유지.
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                  <View style={styles.grid2col}>
                    {Array.from({ length: Math.ceil(cards.length / 5) }, (_, r) => (
                      <View key={r} style={styles.grid2row}>{cards.slice(r * 5, r * 5 + 5)}</View>
                    ))}
                  </View>
                </ScrollView>
              ) : isDeep ? (
                // 나에 대해 알기 — 5개 넘어 2줄(컬럼 정렬: 위/아래 번갈아 배치) 가로 스크롤(daniel)
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                  <View style={styles.grid2col}>
                    <View style={styles.grid2row}>{cards.filter((_, i) => i % 2 === 0)}</View>
                    <View style={styles.grid2row}>{cards.filter((_, i) => i % 2 === 1)}</View>
                  </View>
                </ScrollView>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>{cards}</ScrollView>
              )}
            </View>
          );
        })}

        {/* 로그인 = 선택 (로그아웃은 설정에서 — daniel: 홈 하단 로그아웃 버튼 제거) */}
        <View style={styles.authRow}>
          {!session && (
            <PressableScale onPress={() => router.push('/login')}>
              <Text style={styles.linkText}>{t('common.loginOptional')}</Text>
            </PressableScale>
          )}
        </View>
      </Animated.View>
    </ScrollView>
    <BusyOverlay visible={loggingOut} message={t('common.loggingOut')} />
    {/* 카드 확대 진입 오버레이 제거(daniel 07-02 "확대 별로") — PressableScale 누른 느낌 + 화면 페이드 전환으로 대체 */}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  screen: { backgroundColor: colors.overlaySoft },
 // 별밤 배경 위 반투명 남색 — 카드·텍스트 가독
  wrap: { padding: space(5), paddingTop: space(12), paddingBottom: space(10) }, // 헤더 숨김 → status bar 여백 확보
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(2) },
  langRow: { flexDirection: 'row', gap: space(3) },
  langBtn: { fontSize: 13, color: colors.inkFaint, fontWeight: '600' },
  langOn: { color: colors.ju },
  gear: { fontSize: 20, color: colors.inkSoft },
  title: { ...font.display, textAlign: 'left' as const }, // ★좌측 못박기(daniel 07-02)
  // 타이틀 + 계정(사람) 아이콘 한 줄
  // 헤더 행 — 전체를 살짝 아래로(타이틀 너무 위 방지), 아이콘은 타이틀 하단 정렬(daniel)
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(4) }, // 👤 아이콘만 좌측 타이틀·서브 컬럼 기준 y축 가운데(daniel 07-02)
  // 계정 아이콘 — 타이틀 옆, 살짝 왼쪽·아래로
  accountBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.ju, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.juSoft, marginRight: space(2), marginBottom: space(1) },
  accountIcon: { fontSize: 20 },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(2), textAlign: 'left' as const }, // ★좌측 못박기(daniel 07-02)
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.ju, marginTop: space(4), marginBottom: space(6) },
  fortuneBanner: {
    backgroundColor: colors.juSoft, padding: space(4), borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, marginBottom: space(6),
  },
  // 오늘/내일 토글(배너 상단)
  dayToggle: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  dayTogChip: { paddingHorizontal: space(4), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line },
  dayTogChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  dayTogTx: { fontSize: 13, fontWeight: '800', color: colors.inkSoft },
  dayTogTxOn: { color: '#15132E' },
  bannerDate: { ...font.caption, color: colors.inkSoft },
  bannerPillar: { ...font.heading, color: colors.ink },
  bannerPillarRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(1.5) },
  gzBoxRow: { flexDirection: 'row', gap: space(1) },
  gzBox: { width: 30, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  gzBoxTx: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  bannerHeadline: { ...font.body, color: colors.ju, fontWeight: '800', fontSize: 16, marginTop: space(3) }, // 오늘의 기운을 아우르는 캐치 타이틀
  bannerProse: { ...font.body, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 22 },
  bannerMore: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  // 홈 보기 방식(카드/리스트) 토글 — 오늘/내일 토글과 동일한 pill 세그먼트, 우측 정렬(daniel).
  viewToggleRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: space(4) },
  viewToggle: { flexDirection: 'row', gap: space(1), backgroundColor: colors.overlay, borderRadius: radius.pill, padding: space(1), borderWidth: 1, borderColor: colors.line },
  viewTogChip: { paddingHorizontal: space(3.5), paddingVertical: space(1.5), borderRadius: radius.pill },
  viewTogChipOn: { backgroundColor: colors.ju }, // 활성 = 골드(라이트/다크 자동)
  viewTogTx: { fontSize: 13, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.2 },
  viewTogTxOn: { color: '#15132E' }, // 골드 위 다크 텍스트(오늘/내일 토글과 동일)
  // 범주 섹션(무료/프리미엄/콘텐츠) — 큰 헤더 + 좌우 가로 스크롤
  section: { marginBottom: space(6), marginHorizontal: -space(5) }, // 가로 스크롤이 화면 끝까지 닿도록 wrap 패딩 상쇄
  sectionH: { fontSize: 22, fontWeight: '800', color: colors.ju, marginBottom: space(1), letterSpacing: 0.3, paddingHorizontal: space(5) },
  // ★'가장 많이 찾는' 홈 강조 밴드(daniel 07-05) — 연한 골드 틴트 칩(juSoft)+골드 글씨. 테두리·🔥 제거(daniel). 라이트/다크 자동.
  sectionHotBand: { alignSelf: 'flex-start', marginHorizontal: space(5), marginBottom: space(1), backgroundColor: colors.juSoft, borderRadius: radius.md, paddingVertical: space(2), paddingHorizontal: space(3.5) },
  sectionHotTx: { fontSize: 21, fontWeight: '900', color: colors.ju, letterSpacing: 0.3 },
  sectionDesc: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), paddingHorizontal: space(5), lineHeight: 18 },
  hRow: { gap: space(3), paddingHorizontal: space(5), paddingVertical: space(1) }, // 카드 사이 간격 + 좌우 여백(가로 스크롤)
  // '가볍게 보기' 좌우 스크롤 2줄 — 5개씩 위/아래로(daniel). 카드 크기(162) 유지, 가로 스크롤.
  grid2col: { gap: space(3) },                       // 윗줄·아랫줄 세로 간격
  grid2row: { flexDirection: 'row', gap: space(3) }, // 한 줄 카드 가로 간격
  // 콘텐츠 텍스트 카드(이미지 없음) — 이미지 카드와 동일 비율, 제목+설명 하단 정렬
  textCard: { backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.juLine, justifyContent: 'flex-end', padding: space(4) },
  textCardLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
  textCardDesc: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 18 },
  // 가격 마킹 배지 — 프리미엄 마크와 동일(골드 pill·다크 텍스트·10pt/700, daniel)
  priceTag: {
    position: 'absolute', top: space(2.5), right: space(2.5), zIndex: 1,
    backgroundColor: colors.badgeGold, borderRadius: radius.pill, // ★배지 금색(라이트도 다크 금색·daniel 07-07)
    paddingHorizontal: space(2), paddingVertical: space(0.5),
  },
  priceTagText: { color: '#15132E', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  // 카드 비율 384:512(3:4). 가로 스크롤 → 고정폭. 이미지 cover + 하단 라벨 오버레이.
  card: {
    width: 162, aspectRatio: 0.72, borderRadius: radius.md, overflow: 'hidden', // 카드 높이 더 줄임(daniel: 0.6→0.66→0.72)
    ...shadow.card, // 박스 테두리 제거(이미지 자체 골드 프레임 사용)
  },
  cardImg: { flex: 1, justifyContent: 'flex-end' },
  cardImgInner: { borderRadius: radius.md },
  // 순차 공개 전 카드 자리 — 미드나잇 빈 박스(이미지 디코드 전 placeholder). 카드와 같은 크기·둥근 모서리 유지(레이아웃 안 흔들림).
  cardPlaceholder: { backgroundColor: colors.juSoft },
  labelBar: { backgroundColor: colors.labelScrim, paddingVertical: space(2.5), alignItems: 'center' }, // 라이트=거의 불투명(카드 이미지 비침 차단·daniel)
  cardLabel: { color: colors.ink, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  cardDesc: { color: colors.inkSoft, fontSize: 10.5, lineHeight: 13.5, textAlign: 'center', marginTop: 3, paddingHorizontal: space(1.5) },
  cardLabelPrem: { color: colors.ju }, // 프리미엄 = 골드 라벨
  premTag: {
    position: 'absolute', top: space(2.5), right: space(2.5),
    backgroundColor: colors.badgeGold, borderRadius: radius.pill, // ★배지 금색 통일(daniel 07-07)
    paddingHorizontal: space(2), paddingVertical: space(0.5),
  },
  premTagText: { color: '#15132E', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  // ── 리스트뷰(daniel: "보기 편한 뷰") — 세로 행: 썸네일 + 텍스트(제목·설명) + 가격/셰브런 ──
  //   카드뷰보다 조밀·가독 우선. card 배경 + line 테두리 + soft 그림자로 한지/미드나잇 배경 위에서 또렷하게.
  listBody: { paddingHorizontal: space(5), gap: space(2), marginTop: space(1) }, // section 의 -space(5) 를 상쇄해 콘텐츠 폭 정렬
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingVertical: space(2.5), paddingHorizontal: space(3),
    ...shadow.soft,
  },
  listThumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.juSoft }, // 로드 전 골드틴트 자리
  listThumbPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.juLine }, // 이미지 없는 항목
  listThumbGlyph: { fontSize: 22, fontWeight: '800', color: colors.ju },
  listTextCol: { flex: 1, justifyContent: 'center' }, // 가운데 텍스트 컬럼(남는 폭 차지 → 가격/셰브런 우측 고정)
  listLabel: { fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: 0.2 },
  listLabelPrem: { color: colors.ju }, // 프리미엄 = 골드 라벨(카드뷰와 동일 신호)
  listDesc: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 17, marginTop: 2 },
  listPriceTag: { flexShrink: 0, backgroundColor: colors.badgeGold, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  listPriceTx: { color: '#15132E', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  listChevron: { flexShrink: 0, fontSize: 24, fontWeight: '700', color: colors.inkFaint, paddingHorizontal: space(1) },
  authRow: { marginTop: space(8), marginBottom: space(4), alignItems: 'center' },
  linkText: { color: colors.ju, fontSize: 14 },
});
