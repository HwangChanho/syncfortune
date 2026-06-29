// src/app/(app)/index.tsx — 홈 (2열 카드 그리드, 미드나잇 테마, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// 무료(명식·만세력·타로·오늘운세) = 진입 시 전면광고(ADR-043) / 프리미엄(궁합·풀이) = 유료.
// 로그인 게이트 없음(ADR-037). 메뉴 = daniel 제작 카드 이미지(assets/icons/{key}.jpg, 남색·골드, 라벨 없음).
//   라벨은 코드 t()로 하단 오버레이 → 영·일 다국어 유지(ADR-049).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, Pressable, ScrollView, StyleSheet, ImageBackground, Animated, AppState, Dimensions, Easing } from 'react-native';
import Svg, { Path, Ellipse, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg'; // 선비 실루엣 + 산수화풍 한지산(daniel)
import { Image as ExpoImage } from 'expo-image'; // 이미지 자동 다운샘플(표시 크기로 디코딩) — 홈 카드 24장 메모리·랙 해결
import { Alert } from '../../lib/alert'; // 커스텀 알림(앱 디자인)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/useAuth';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { showRewardedAd } from '../../lib/ads';
import { isAdmin } from '../../lib/admin'; // 관리자·프리미엄 = 무료 진입 광고 제외
import { ChartPicker } from '../../components/ChartPicker';
import { getDailyFortune, dailyHeadline, dailyPreview } from '../../lib/dailyFortune';
import { stemElement, branchElement, elementColor, elementText } from '../../lib/ohaeng'; // 오늘의 기운 = 오행색 네모 한자
import { useGenProgress, clearGenProgress } from '../../lib/genProgress'; // 풀이 진행률(다중·route별, 풀이중 홈 나가도 % — daniel)
import { useSubscription } from '../../lib/subscription';
import { loadRepChart, subscribeRepChange } from '../../lib/myChart';
import { prewarmReadings, prewarmDaily } from '../../lib/prewarmReadings';
import { scheduleDailyFortune } from '../../lib/notifications'; // 매일 9시 오늘의 운세 알림
import { buildSajuChart } from '@engine/saju';
import type { Stem, Branch } from '@spec/chart';
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { playSound } from '../../lib/sounds';
import { BusyOverlay } from '../../components/BusyOverlay'; // 로그아웃 등 긴 콜백 로딩
import { CREDIT_KINDS, type CreditKind } from '../../lib/coupons'; // 유료 콘텐츠 카드 가격 배지(정가 대비 할인)

type MenuItem = { key: string; labelKey: string; descKey?: string; image?: any; route: string; ready: boolean; premium?: boolean; content?: boolean; creditKey?: CreditKind };
type Section = { key: string; titleKey: string; descKey?: string; items: MenuItem[] };

// 유료 콘텐츠 가격 배지 — 정가(9,900) 대비 할인율 + 건당 할인가(₩). 건당가는 CREDIT_KINDS(coupons) 단일 출처.
//   무료(온디바이스) 콘텐츠는 creditKey 없음 → 배지 미표시.
const LIST_PRICE_ORIG = 19900; // 사주·자미 정가(할인율 표시 기준, daniel 06-28)
const CREDIT_PRICE: Record<string, number> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.price]));
const wonFmt = (n: number) => '₩' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); // 천단위 콤마(Hermes Intl 비의존)
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
    { key: 'saju', labelKey: 'menu.saju', descKey: 'menu.sajuDesc', image: require('../../../assets/icons/premium.jpg'), route: '/premium?domain=saju', ready: true, premium: true },
    { key: 'ziwei', labelKey: 'menu.ziweiHub', descKey: 'menu.ziweiHubDesc', image: require('../../../assets/icons/ziwei.jpg'), route: '/premium?domain=ziwei', ready: true, premium: true },
    { key: 'compat', labelKey: 'menu.compat', descKey: 'menu.compatDesc', image: require('../../../assets/icons/compat.jpg'), route: '/compat', ready: true, premium: true },
  ] },
  // 스페셜 = 유료 LLM 콘텐츠(애정흐름·인생그래프·신년). 골드 라인아트 타일 이미지(Recraft).
  { key: 'content', titleKey: 'menu.secContent', descKey: 'menu.secContentDesc', items: [
    // daniel(2026-06-24): 신년운세 = 시즌 콘텐츠라 리스트 제일 앞.
    { key: 'newyear', labelKey: 'menu.newyear', descKey: 'menu.newyearTileDesc', image: require('../../../assets/icons/newyear.jpg'), route: '/newyear', ready: true, content: true, creditKey: 'newyear' },
    { key: 'love', labelKey: 'menu.love', descKey: 'menu.loveDesc', image: require('../../../assets/icons/love.jpg'), route: '/love', ready: true, content: true, creditKey: 'love' },
    { key: 'lifegraph', labelKey: 'menu.lifegraph', descKey: 'menu.lifegraphDesc', image: require('../../../assets/icons/lifegraph.jpg'), route: '/lifegraph', ready: true, content: true, creditKey: 'lifegraph' },
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

function TwinklingStars() {
  const starAnims = useRef([new Animated.Value(0.3), new Animated.Value(0.5), new Animated.Value(0.2)]).current;
  const shootingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 반짝이는 별들
    starAnims.forEach((anim, i) => {
      const duration = 1500 + i * 800;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration, useNativeDriver: true }),
        ])
      ).start();
    });

    // 유성 애니메이션 (8초마다 한 번씩)
    const runShootingStar = () => {
      shootingAnim.setValue(0);
      Animated.timing(shootingAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(runShootingStar, 7000 + Math.random() * 3000);
      });
    };
    runShootingStar();
  }, []);

  const shootX = shootingAnim.interpolate({ inputRange: [0, 1], outputRange: [400, -100] });
  const shootY = shootingAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 400] });
  const shootOpacity = shootingAnim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.Text style={[styles.star, { top: '15%', left: '20%', opacity: starAnims[0] }]}>✦</Animated.Text>
      <Animated.Text style={[styles.star, { top: '40%', right: '15%', opacity: starAnims[1] }]}>✧</Animated.Text>
      <Animated.Text style={[styles.star, { top: '75%', left: '35%', opacity: starAnims[2] }]}>✦</Animated.Text>
      <Animated.Text style={[styles.star, { top: '25%', right: '30%', opacity: starAnims[0], transform: [{ scale: 0.7 }] }]}>✧</Animated.Text>
      
      {/* 유성 */}
      <Animated.View
        style={[
          styles.shootingStar,
          {
            transform: [{ translateX: shootX }, { translateY: shootY }, { rotate: '-45deg' }],
            opacity: shootOpacity,
          },
        ]}
      />
    </View>
  );
}

// 조선 산수화풍 한지산(daniel ③) — 겹겹의 연봉(원경·중경·근경 수묵 농담) + 운무 + 달, 그 능선을 따라 걷는 갓 쓴 선비.
//   ★개선: 단일 각진 능선 → 부드러운 베지어 연봉 3겹(원근 = 농담·불투명도 차) + 산 사이 운무 띠 + 옅은 달.
//   선비 위치(bottom 62)·근경 능선 높이는 검증값 보존 — 뒤로 원경/중경 산만 추가해 깊이를 만든다.
function SeonbiWalk() {
  const W = Dimensions.get('window').width;
  const walk = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const mist = useRef(new Animated.Value(0)).current; // 운무 잔잔한 좌우 흐름(산수화 운치)
  useEffect(() => {
    Animated.loop(Animated.timing(walk, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(mist, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(mist, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
  }, []);
  const tx = walk.interpolate({ inputRange: [0, 1], outputRange: [-44, W + 44] });   // 화면 밖→밖 가로 이동(루프)
  const ty = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] });         // 걸음 bob(위아래)
  const mistX = mist.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });     // 운무 좌우 흐름
  const DARK = '#0C0A22'; const GOLD = 'rgba(212,175,110,0.45)';
  return (
    <View style={styles.seonbiLayer} pointerEvents="none">
      <Svg width={W} height={140} style={{ position: 'absolute', bottom: 0 }}>
        <Defs>
          {/* 근경(가까운 산) 수묵 — 능선(위) 진하고 아래로 더 어두워지는 먹빛 */}
          <LinearGradient id="ink-near" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0E0B26" stopOpacity="0.99" /><Stop offset="1" stopColor="#070512" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* 달(옅은 보름) + 은은한 무리 — 산 너머 */}
        <Circle cx={W * 0.78} cy={30} r={17} fill="rgba(231,222,196,0.05)" />
        <Circle cx={W * 0.78} cy={30} r={10.5} fill="rgba(231,222,196,0.15)" />
        {/* 원경(먼 산) — 옅은 라벤더 안개(수묵 농담 '담') */}
        <Path d={`M0,140 L0,50 Q${W * 0.16},30 ${W * 0.34},46 Q${W * 0.5},60 ${W * 0.66},34 Q${W * 0.82},22 ${W},40 L${W},140 Z`} fill="rgba(120,112,165,0.20)" />
        <Path d={`M0,50 Q${W * 0.16},30 ${W * 0.34},46 Q${W * 0.5},60 ${W * 0.66},34 Q${W * 0.82},22 ${W},40`} stroke="rgba(150,142,195,0.22)" strokeWidth={1} fill="none" />
        {/* 중경(중간 산) — '중' 농담 */}
        <Path d={`M0,140 L0,64 Q${W * 0.2},46 ${W * 0.4},62 Q${W * 0.58},74 ${W * 0.76},50 Q${W * 0.88},40 ${W},56 L${W},140 Z`} fill="rgba(40,36,82,0.78)" />
        <Path d={`M0,64 Q${W * 0.2},46 ${W * 0.4},62 Q${W * 0.58},74 ${W * 0.76},50 Q${W * 0.88},40 ${W},56`} stroke="rgba(120,110,170,0.16)" strokeWidth={1} fill="none" />
        {/* 근경(가까운 산) — 가장 진한 '농' + 금장 윤곽. 완만·높게 = 선비(bottom 58) 발이 능선에 닿음 */}
        <Path d={`M0,140 L0,76 Q${W * 0.18},64 ${W * 0.36},74 Q${W * 0.52},80 ${W * 0.66},62 Q${W * 0.82},72 ${W},66 L${W},140 Z`} fill="url(#ink-near)" />
        <Path d={`M0,76 Q${W * 0.18},64 ${W * 0.36},74 Q${W * 0.52},80 ${W * 0.66},62 Q${W * 0.82},72 ${W},66`} stroke={GOLD} strokeWidth={1} fill="none" />
      </Svg>
      {/* 운무 띠 — 중경·근경 사이 옅은 가로 안개(살짝 좌우로 흐름) */}
      <Animated.View style={{ position: 'absolute', bottom: 62, left: 0, right: 0, transform: [{ translateX: mistX }] }} pointerEvents="none">
        <Svg width={W} height={28}>
          <Ellipse cx={W * 0.3} cy={16} rx={W * 0.36} ry={6.5} fill="rgba(173,164,200,0.06)" />
          <Ellipse cx={W * 0.74} cy={11} rx={W * 0.3} ry={5} fill="rgba(173,164,200,0.05)" />
        </Svg>
      </Animated.View>
      {/* 걷는 선비(갓 + 도포 + 지팡이) — 근경 능선 위 */}
      <Animated.View style={{ position: 'absolute', bottom: 58, transform: [{ translateX: tx }, { translateY: ty }] }}>
        <Svg width={42} height={64} viewBox="0 0 42 64">
          <Ellipse cx={21} cy={14} rx={15} ry={3.4} fill={DARK} stroke={GOLD} strokeWidth={0.6} />{/* 갓 챙 */}
          <Path d="M15,14 Q15,6.5 21,6.5 Q27,6.5 27,14 Z" fill={DARK} stroke={GOLD} strokeWidth={0.6} />{/* 갓 대우 */}
          <Circle cx={21} cy={18.5} r={3.3} fill={DARK} />{/* 머리 */}
          <Path d="M16,21.5 L26,21.5 L29,53 L13,53 Z" fill={DARK} stroke={GOLD} strokeWidth={0.6} />{/* 두루마기 */}
          <Path d="M26,23.5 L29,24.5 L28,33 L25,30.5 Z" fill={DARK} />{/* 소맷자락 */}
          <Line x1={29} y1={25} x2={34} y2={55} stroke={GOLD} strokeWidth={1.3} />{/* 지팡이 */}
        </Svg>
      </Animated.View>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 오늘의 기운 배너 본문(읽는 글) 글자 크기 반영
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

  async function onPress(m: MenuItem) {
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
    // 무료(비프리미엄) 진입 = 보상형 광고(daniel). 단 만세력은 제외(만세력은 명식 10개↑ 추가 시 게이트).
    //   광고 실패/미시청이어도 무료 콘텐츠는 진입 보장(광고는 스킵 가능) — 프리미엄은 광고 없음.
    // 무료 진입 보상형 광고 — 단, 프리미엄·관리자는 제외(광고 없음). 만세력·프리미엄 카드도 제외.
    if (!m.premium && m.key !== 'manse' && !isPremium && !admin) await showRewardedAd().catch(() => false);
    router.push(m.route);
  }

  return (
    <ImageBackground source={bgSource} style={styles.bgImage} resizeMode="cover">
    <TwinklingStars />
    <SeonbiWalk />
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* 헤더 — 타이틀 옆에 계정(사람) 아이콘: 탭 → 계정 관리·프리미엄 구매(설정)(daniel) */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('appName')}</Text>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={styles.accountBtn}>
            <Text style={styles.accountIcon}>👤</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>{t('tagline')}</Text>
        <View style={styles.divider} />
        {/* 통변 생성 진행률(daniel) — 여러 개 동시 풀이 가능 → route별 배너 여러 개. 탭=그 화면 이동 + 그 배너만 닫기. */}
        {gen.map((g) => (g.total > 0 && g.done >= g.total ? (
          // 완료(daniel 이슈13): '풀이 보기' — 탭하면 그 화면 이동 + 그 배너만 닫기(다른 풀이 배너는 유지).
          <Pressable key={g.route} onPress={() => { clearGenProgress(g.route); router.push(g.route as any); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(4), marginBottom: space(3), gap: space(2) }}>
            <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(13), flex: 1 }}>{g.label} 풀이가 완성됐어요!</Text>
            <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(13) }}>풀이 보기 ›</Text>
          </Pressable>
        ) : (
          <Pressable key={g.route} onPress={() => router.push(g.route as any)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.juSoft, borderColor: colors.ju, borderWidth: 1, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(4), marginBottom: space(3), gap: space(2) }}>
            <Text style={{ color: colors.ju, fontWeight: '700', fontSize: fs(13), flex: 1 }}>{g.label} 풀이 중… {g.total > 1 ? `${g.done}/${g.total} ` : ''}{genPct(g.done, g.total, g.startedAt)}%</Text>
            <Text style={{ color: colors.ju, fontWeight: '700', fontSize: fs(13) }}>이어보기 ›</Text>
          </Pressable>
        )))}

        {/* 오늘/내일 기운 — 토글 또는 좌우 슬라이드(가로 페이징·daniel). 본문 탭 → 상세(분야별, 같은 offset). */}
        <View style={styles.fortuneBanner}>
          {!hasChart ? (
            // H1(daniel): 명식 미등록 → 오늘/내일 운세 대신 등록 안내(탭하면 등록창)
            <Pressable onPress={() => router.push('/register')} style={{ alignItems: 'center', paddingVertical: space(5), gap: space(2) }}>
              <Text style={{ color: colors.ju, fontWeight: '900', fontSize: fs(16), textAlign: 'center' }}>{t('home.noChartTitle', '명식을 등록하면 오늘·내일 운세를 봐요')}</Text>
              <Text style={{ color: colors.inkSoft, fontSize: fs(13), textAlign: 'center' }}>{t('home.noChartSub', '생년월일시로 나의 사주를 먼저 등록해 주세요')}</Text>
              <View style={{ backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(2) }}>
                <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(14) }}>{t('home.noChartCta', '+ 명식 등록')}</Text>
              </View>
            </Pressable>
          ) : (<>
          <View style={styles.dayToggle}>
            {([0, 1] as const).map((off) => (
              <Pressable key={off} style={[styles.dayTogChip, dayOffset === off && styles.dayTogChipOn]} onPress={() => goDay(off)}>
                <Text style={[styles.dayTogTx, dayOffset === off && styles.dayTogTxOn]}>{t(off === 0 ? 'today.today' : 'today.tomorrow')}</Text>
              </Pressable>
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
                  <Pressable key={off} style={{ width: pageW }} onPress={() => router.push(`/today?offset=${off}`)}>
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
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          </>)}
        </View>

        {/* 대표 명식 선택/전환 (등록한 다른 명식으로 변경) — 전환 시 오늘의 기운 즉시 재계산(daniel) */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />

        {/* 무료 / 프리미엄 / 콘텐츠 3범주 — 큰 섹션 헤더 + 좌우 가로 스크롤 카드(daniel) */}
        {SECTIONS.map((sec) => {
          const isLight = sec.key === 'light'; // '가볍게 보기' = 항목이 많아 가로 스크롤 대신 2열 줄바꿈(daniel)
          const isDeep = sec.key === 'deep';   // '나에 대해 알기' = 5개 넘어 2줄(컬럼 정렬) 가로 스크롤(daniel 2026-06-23)
          const cards = sec.items.map((m) => {
            const prem = !!m.premium;
            // 콘텐츠(이미지 없음) = 텍스트 카드(제목+설명), 이미지 카드와 시각 구분
            if (!m.image) {
              return (
                <Pressable key={m.key} style={[styles.card, styles.textCard]} onPress={() => onPress(m)}>
                  {m.creditKey && (
                    <View style={styles.priceTag}>
                      <Text style={styles.priceTagText}>{priceLabel(m.creditKey)}</Text>
                    </View>
                  )}
                  <Text style={styles.textCardLabel}>{t(m.labelKey)}</Text>
                  {m.descKey ? <Text style={styles.textCardDesc}>{t(m.descKey)}</Text> : null}
                </Pressable>
              );
            }
            return (
              <Pressable key={m.key} style={styles.card} onPress={() => onPress(m)}>
                <View style={styles.cardImg}>
                  {/* expo-image 다운샘플 유지(메모리·랙) + 켄번스 느린 줌(daniel #21). absoluteFill 배경 + 위 오버레이. */}
                  <KenBurnsCard source={m.image} />
                  {prem && (
                    <View style={styles.premTag}>
                      <Text style={styles.premTagText}>{t('menu.premiumTag')}</Text>
                    </View>
                  )}
                  {m.creditKey && (
                    <View style={styles.priceTag}>
                      <Text style={styles.priceTagText}>{priceLabel(m.creditKey)}</Text>
                    </View>
                  )}
                  {/* 하단 라벨 바(반투명 남색) — 라벨 + 간략 설명(daniel: 콘텐츠별 설명) */}
                  <View style={styles.labelBar}>
                    <Text style={[styles.cardLabel, prem && styles.cardLabelPrem]}>{t(m.labelKey)}</Text>
                    {m.descKey ? <Text style={styles.cardDesc} numberOfLines={2}>{t(m.descKey)}</Text> : null}
                  </View>
                </View>
              </Pressable>
            );
          });
          return (
            <View key={sec.key} style={styles.section}>
              {/* '무료' 라벨은 빼고(daniel) 맨 위 기본 섹션은 헤더 없이 — 프리미엄·스페셜만 헤더 표시 */}
              <Text style={styles.sectionH}>{t(sec.titleKey)}</Text>
              {sec.key !== 'free' && sec.descKey ? <Text style={styles.sectionDesc}>{t(sec.descKey)}</Text> : null}
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
            <Pressable onPress={() => router.push('/login')}>
              <Text style={styles.linkText}>{t('common.loginOptional')}</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </ScrollView>
    <BusyOverlay visible={loggingOut} message={t('common.loggingOut')} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  seonbiLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 }, // 산길 걷는 선비 + 능선(배경 하단·daniel)
  star: { position: 'absolute', color: colors.ju, fontSize: 16 },
  shootingStar: {
    position: 'absolute', width: 100, height: 2,
    backgroundColor: colors.ju, borderRadius: radius.pill,
    shadowColor: colors.ju, shadowOpacity: 0.8, shadowRadius: 4, elevation: 5,
  },
  screen: { backgroundColor: colors.overlaySoft },
 // 별밤 배경 위 반투명 남색 — 카드·텍스트 가독
  wrap: { padding: space(5), paddingTop: space(12), paddingBottom: space(10) }, // 헤더 숨김 → status bar 여백 확보
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(2) },
  langRow: { flexDirection: 'row', gap: space(3) },
  langBtn: { fontSize: 13, color: colors.inkFaint, fontWeight: '600' },
  langOn: { color: colors.ju },
  gear: { fontSize: 20, color: colors.inkSoft },
  title: { ...font.display },
  // 타이틀 + 계정(사람) 아이콘 한 줄
  // 헤더 행 — 전체를 살짝 아래로(타이틀 너무 위 방지), 아이콘은 타이틀 하단 정렬(daniel)
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space(4) },
  // 계정 아이콘 — 타이틀 옆, 살짝 왼쪽·아래로
  accountBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.ju, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34,31,68,0.5)', marginRight: space(2), marginBottom: space(1) },
  accountIcon: { fontSize: 20 },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(2) },
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.ju, marginTop: space(4), marginBottom: space(6) },
  fortuneBanner: {
    backgroundColor: 'rgba(34,31,68,0.6)', padding: space(4), borderRadius: radius.md,
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
  // 범주 섹션(무료/프리미엄/콘텐츠) — 큰 헤더 + 좌우 가로 스크롤
  section: { marginBottom: space(6), marginHorizontal: -space(5) }, // 가로 스크롤이 화면 끝까지 닿도록 wrap 패딩 상쇄
  sectionH: { fontSize: 22, fontWeight: '800', color: colors.ju, marginBottom: space(1), letterSpacing: 0.3, paddingHorizontal: space(5) },
  sectionDesc: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), paddingHorizontal: space(5), lineHeight: 18 },
  hRow: { gap: space(3), paddingHorizontal: space(5), paddingVertical: space(1) }, // 카드 사이 간격 + 좌우 여백(가로 스크롤)
  // '가볍게 보기' 좌우 스크롤 2줄 — 5개씩 위/아래로(daniel). 카드 크기(162) 유지, 가로 스크롤.
  grid2col: { gap: space(3) },                       // 윗줄·아랫줄 세로 간격
  grid2row: { flexDirection: 'row', gap: space(3) }, // 한 줄 카드 가로 간격
  // 콘텐츠 텍스트 카드(이미지 없음) — 이미지 카드와 동일 비율, 제목+설명 하단 정렬
  textCard: { backgroundColor: 'rgba(34,31,68,0.6)', borderWidth: 1, borderColor: colors.juLine, justifyContent: 'flex-end', padding: space(4) },
  textCardLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
  textCardDesc: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 18 },
  // 가격 마킹 배지 — 프리미엄 마크와 동일(골드 pill·다크 텍스트·10pt/700, daniel)
  priceTag: {
    position: 'absolute', top: space(2.5), right: space(2.5), zIndex: 1,
    backgroundColor: colors.ju, borderRadius: radius.pill,
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
  labelBar: { backgroundColor: colors.overlayStrong, paddingVertical: space(2.5), alignItems: 'center' },
  cardLabel: { color: colors.ink, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  cardDesc: { color: colors.inkSoft, fontSize: 10.5, lineHeight: 13.5, textAlign: 'center', marginTop: 3, paddingHorizontal: space(1.5) },
  cardLabelPrem: { color: colors.ju }, // 프리미엄 = 골드 라벨
  premTag: {
    position: 'absolute', top: space(2.5), right: space(2.5),
    backgroundColor: colors.ju, borderRadius: radius.pill,
    paddingHorizontal: space(2), paddingVertical: space(0.5),
  },
  premTagText: { color: '#15132E', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  authRow: { marginTop: space(8), marginBottom: space(4), alignItems: 'center' },
  linkText: { color: colors.ju, fontSize: 14 },
});
