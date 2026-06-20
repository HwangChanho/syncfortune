// src/app/(app)/index.tsx — 홈 (2열 카드 그리드, 미드나잇 테마, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// 무료(명식·만세력·타로·오늘운세) = 진입 시 전면광고(ADR-043) / 프리미엄(궁합·풀이) = 유료.
// 로그인 게이트 없음(ADR-037). 메뉴 = daniel 제작 카드 이미지(assets/icons/{key}.jpg, 남색·골드, 라벨 없음).
//   라벨은 코드 t()로 하단 오버레이 → 영·일 다국어 유지(ADR-049).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, Pressable, ScrollView, StyleSheet, ImageBackground, Animated, AppState } from 'react-native';
import { Alert } from '../../lib/alert'; // 커스텀 알림(앱 디자인)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/useAuth';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { showRewardedAd } from '../../lib/ads';
import { isAdmin } from '../../lib/admin'; // 관리자·프리미엄 = 무료 진입 광고 제외
import { ChartPicker } from '../../components/ChartPicker';
import { getDailyFortune, dailyChartReadings, dailyHeadline } from '../../lib/dailyFortune';
import { stemElement, branchElement, elementColor, elementText } from '../../lib/ohaeng'; // 오늘의 기운 = 오행색 네모 한자
import { useSubscription } from '../../lib/subscription';
import { loadRepChart } from '../../lib/myChart';
import { prewarmReadings } from '../../lib/prewarmReadings';
import { scheduleDailyFortune } from '../../lib/notifications'; // 매일 9시 오늘의 운세 알림
import { buildSajuChart } from '@engine/saju';
import type { Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { playSound } from '../../lib/sounds';
import { BusyOverlay } from '../../components/BusyOverlay'; // 로그아웃 등 긴 콜백 로딩
import { CREDIT_KINDS, type CreditKind } from '../../lib/coupons'; // 유료 콘텐츠 카드 가격 배지(정가 대비 할인)

type MenuItem = { key: string; labelKey: string; descKey?: string; image?: any; route: string; ready: boolean; premium?: boolean; content?: boolean; creditKey?: CreditKind };
type Section = { key: string; titleKey: string; descKey?: string; items: MenuItem[] };

// 유료 콘텐츠 가격 배지 — 정가(9,900) 대비 할인율 + 건당 할인가(₩). 건당가는 CREDIT_KINDS(coupons) 단일 출처.
//   무료(온디바이스) 콘텐츠는 creditKey 없음 → 배지 미표시.
const LIST_PRICE_ORIG = 9900;
const CREDIT_PRICE: Record<string, number> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.price]));
const wonFmt = (n: number) => '₩' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); // 천단위 콤마(Hermes Intl 비의존)
const priceLabel = (key: string) => {
  const p = CREDIT_PRICE[key] ?? 0;
  const disc = Math.round((1 - p / LIST_PRICE_ORIG) * 100);
  return `${disc}% · ${wonFmt(p)}`;
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
    { key: 'love', labelKey: 'menu.love', descKey: 'menu.loveDesc', image: require('../../../assets/icons/love.jpg'), route: '/love', ready: true, content: true, creditKey: 'love' },
    { key: 'lifegraph', labelKey: 'menu.lifegraph', descKey: 'menu.lifegraphDesc', image: require('../../../assets/icons/lifegraph.jpg'), route: '/lifegraph', ready: true, content: true, creditKey: 'lifegraph' },
    { key: 'newyear', labelKey: 'menu.newyear', descKey: 'menu.newyearTileDesc', image: require('../../../assets/icons/newyear.jpg'), route: '/newyear', ready: true, content: true, creditKey: 'newyear' },
  ] },
  // 심층 분석(daniel 2026-06) — 사주/자미 깊은 해석 유료.
  { key: 'deep', titleKey: 'menu.secDeep', descKey: 'menu.secDeepDesc', items: [
    { key: 'roots', labelKey: 'menu.roots', descKey: 'menu.rootsDesc', image: require('../../../assets/icons/roots.jpg'), route: '/roots', ready: true, content: true, creditKey: 'roots' },
    { key: 'image', labelKey: 'menu.image', descKey: 'menu.imageDesc', image: require('../../../assets/icons/image.jpg'), route: '/image', ready: true, content: true, creditKey: 'image' },
    { key: 'mission', labelKey: 'menu.mission', descKey: 'menu.missionDesc', image: require('../../../assets/icons/mission.jpg'), route: '/mission', ready: true, content: true, creditKey: 'mission' },
    // 신규(daniel 2026-06): 사업가의 나 vs 직장인의 나.
    { key: 'career', labelKey: 'menu.career', descKey: 'menu.careerDesc', image: require('../../../assets/icons/career.jpg'), route: '/career', ready: true, content: true, creditKey: 'career' },
  ] },
  // 가볍게 = 무료·온디바이스 재미(펫·성격유형·택일·행운·띠별자리·이름풀이·꿈해몽). API 0(daniel: 스페셜 아래 무료 따로).
  { key: 'light', titleKey: 'menu.secLight', descKey: 'menu.secLightDesc', items: [
    { key: 'taro', labelKey: 'menu.taro', descKey: 'menu.taroDesc', image: require('../../../assets/icons/taro.jpg'), route: '/taro', ready: true, content: true },
    { key: 'pet', labelKey: 'menu.pet', descKey: 'menu.petDesc', image: require('../../../assets/icons/pet.jpg'), route: '/pet', ready: true, content: true },
    { key: 'persona', labelKey: 'menu.persona', descKey: 'menu.personaTileDesc', image: require('../../../assets/icons/persona.jpg'), route: '/persona', ready: true, content: true },
    { key: 'egen', labelKey: 'menu.egen', descKey: 'menu.egenTileDesc', image: require('../../../assets/icons/egen.jpg'), route: '/egenteto', ready: true, content: true },
    { key: 'joseonjob', labelKey: 'menu.joseonjob', descKey: 'menu.joseonjobTileDesc', image: require('../../../assets/icons/joseonjob.jpg'), route: '/joseonjob', ready: true, content: true },
    { key: 'lovestyle', labelKey: 'menu.lovestyle', descKey: 'menu.lovestyleTileDesc', image: require('../../../assets/icons/lovestyle.jpg'), route: '/lovestyle', ready: true, content: true },
    { key: 'bok', labelKey: 'menu.bok', descKey: 'menu.bokTileDesc', image: require('../../../assets/icons/bok.jpg'), route: '/bok', ready: true, content: true },
    { key: 'pastlife', labelKey: 'menu.pastlife', descKey: 'menu.pastlifeTileDesc', image: require('../../../assets/icons/pastlife.jpg'), route: '/pastlife', ready: true, content: true },
    { key: 'healing', labelKey: 'menu.healing', descKey: 'menu.healingTileDesc', image: require('../../../assets/icons/healing.jpg'), route: '/healing', ready: true, content: true },
    { key: 'taegil', labelKey: 'menu.taegil', descKey: 'menu.taegilTileDesc', image: require('../../../assets/icons/taegil.jpg'), route: '/taegil', ready: true, content: true },
    { key: 'luck', labelKey: 'menu.luck', descKey: 'menu.luckTileDesc', image: require('../../../assets/icons/luck.jpg'), route: '/luck', ready: true, content: true },
    { key: 'zodiac', labelKey: 'menu.zodiac', descKey: 'menu.zodiacTileDesc', image: require('../../../assets/icons/zodiac.jpg'), route: '/zodiac', ready: true, content: true },
    { key: 'name', labelKey: 'menu.name', descKey: 'menu.nameTileDesc', image: require('../../../assets/icons/name.jpg'), route: '/name', ready: true, content: true },
    { key: 'dream', labelKey: 'menu.dream', descKey: 'menu.dreamTileDesc', image: require('../../../assets/icons/dream.jpg'), route: '/dream', ready: true, content: true },
  ] },
];

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

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 오늘의 기운 배너 본문(읽는 글) 글자 크기 반영
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [admin, setAdmin] = useState(false);
  useEffect(() => { isAdmin().then(setAdmin).catch(() => {}); }, []);
  const [dayOffset, setDayOffset] = useState(0); // 0=오늘·1=내일(오늘의 기운 카드 토글)
  // 날짜 키 — 홈을 켜둔 채 자정이 지나도 갱신되게(③). 포커스·앱 복귀 시 재확인.
  const [dateKey, setDateKey] = useState(() => new Date().toDateString());
  const fortune = useMemo(() => getDailyFortune(dayOffset), [dayOffset, dateKey]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // 오늘의 기운 한 줄 풀이(글) — 대표 명식 일간 × 오늘 일진(온디바이스, 무료). 탭 → 오늘의 운세 상세.
  const [todayProse, setTodayProse] = useState<string | null>(null);
  const [todayHeadline, setTodayHeadline] = useState<string | null>(null); // 오늘의 기운 한 줄 타이틀(그날을 아우르는 캐치)
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
  // 백그라운드→포그라운드(자정 넘겨 홈 유지) 시 날짜 재확인(③)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setDateKey(new Date().toDateString()); });
    return () => sub.remove();
  }, []);
  // 대표 명식(repId) × 오늘 일진(fortune) → 한 줄 풀이. 둘 중 하나만 바뀌어도 재계산(①③)
  useEffect(() => {
    (async () => {
      const rep = await loadRepChart();
      if (!rep) { setTodayProse(null); setTodayHeadline(null); return; }
      const saju = buildSajuChart(rep.input);
      const r = dailyChartReadings(saju, fortune.dayGanZhi[0] as Stem, fortune.dayGanZhi[1] as Branch);
      const general = r.find((x) => x.key === 'general')?.paragraphs ?? [];
      setTodayProse(general[0] ?? null); // 통합 기조 첫 문단
      setTodayHeadline(dailyHeadline(saju, fortune.dayGanZhi[0] as Stem, fortune.dayGanZhi[1] as Branch)); // 그날을 아우르는 캐치 타이틀
    })();
  }, [fortune, reloadKey]);

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
    })();
  }, [session, isPremium]);

  async function onPress(m: MenuItem) {
    playSound('click');
    if (!m.ready) { Alert.alert(t(m.labelKey), t('common.comingSoon')); return; }
    // 무료(비프리미엄) 진입 = 보상형 광고(daniel). 단 만세력은 제외(만세력은 명식 10개↑ 추가 시 게이트).
    //   광고 실패/미시청이어도 무료 콘텐츠는 진입 보장(광고는 스킵 가능) — 프리미엄은 광고 없음.
    // 무료 진입 보상형 광고 — 단, 프리미엄·관리자는 제외(광고 없음). 만세력·프리미엄 카드도 제외.
    if (!m.premium && m.key !== 'manse' && !isPremium && !admin) await showRewardedAd().catch(() => false);
    router.push(m.route);
  }

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bgImage} resizeMode="cover">
    <TwinklingStars />
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

        {/* 오늘/내일 기운 배너 — 상단 토글로 오늘↔내일, 본문 탭 → 상세(분야별, 같은 offset 전달). */}
        <View style={styles.fortuneBanner}>
          <View style={styles.dayToggle}>
            {([0, 1] as const).map((off) => (
              <Pressable key={off} style={[styles.dayTogChip, dayOffset === off && styles.dayTogChipOn]} onPress={() => setDayOffset(off)}>
                <Text style={[styles.dayTogTx, dayOffset === off && styles.dayTogTxOn]}>{t(off === 0 ? 'today.today' : 'today.tomorrow')}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => router.push(`/today?offset=${dayOffset}`)}>
            <Text style={styles.bannerDate}>{fortune.date} ({t('today.weekdaysShort').split(',')[new Date(fortune.date.replace(/-/g, '/')).getDay()] ?? ''})</Text>
            <View style={styles.bannerPillarRow}>
              <Text style={styles.bannerPillar}>{dayOffset === 0 ? t('today.dayPillar') : t('today.energyTomorrow')}</Text>
              <View style={styles.gzBoxRow}>
                {[fortune.dayGanZhi[0], fortune.dayGanZhi[1]].map((ch, i) => {
                  const el = i === 0 ? stemElement(ch) : branchElement(ch); // 천간·지지 오행
                  return (
                    <View key={i} style={[styles.gzBox, { backgroundColor: elementColor[el] }]}>
                      <Text style={[styles.gzBoxTx, { color: elementText[el] }]}>{ch}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            {todayHeadline && <Text style={[styles.bannerHeadline, { fontSize: fs(16) }]}>{todayHeadline}</Text>}
            {todayProse && <Text style={[styles.bannerProse, { fontSize: fs(15), lineHeight: fs(22) }]} numberOfLines={3}>{todayProse}</Text>}
            {todayProse && <Text style={styles.bannerMore}>{t('today.more')}</Text>}
          </Pressable>
        </View>

        {/* 대표 명식 선택/전환 (등록한 다른 명식으로 변경) — 전환 시 오늘의 기운 즉시 재계산(daniel) */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />

        {/* 무료 / 프리미엄 / 콘텐츠 3범주 — 큰 섹션 헤더 + 좌우 가로 스크롤 카드(daniel) */}
        {SECTIONS.map((sec) => {
          const isLight = sec.key === 'light'; // '가볍게 보기' = 항목이 많아 가로 스크롤 대신 2열 줄바꿈(daniel)
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
                <ImageBackground source={m.image} style={styles.cardImg} imageStyle={styles.cardImgInner} resizeMode="contain">
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
                </ImageBackground>
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
  star: { position: 'absolute', color: colors.ju, fontSize: 16 },
  shootingStar: {
    position: 'absolute', width: 100, height: 2,
    backgroundColor: colors.ju, borderRadius: radius.pill,
    shadowColor: colors.ju, shadowOpacity: 0.8, shadowRadius: 4, elevation: 5,
  },
  screen: { backgroundColor: 'rgba(21,19,46,0.3)' },
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
  dayTogChip: { paddingHorizontal: space(4), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: 'rgba(21,19,46,0.5)', borderWidth: 1, borderColor: colors.line },
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
    width: 162, aspectRatio: 0.6, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.sunk,
    ...shadow.card, // 박스 테두리 제거(이미지 자체 골드 프레임 사용)
  },
  cardImg: { flex: 1, justifyContent: 'flex-end' },
  cardImgInner: { borderRadius: radius.md },
  labelBar: { backgroundColor: 'rgba(21,19,46,0.72)', paddingVertical: space(2.5), alignItems: 'center' },
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
