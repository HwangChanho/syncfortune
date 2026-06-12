// src/app/(app)/index.tsx — 홈 (2열 카드 그리드, 미드나잇 테마, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// 무료(명식·만세력·타로·오늘운세) = 진입 시 전면광고(ADR-043) / 프리미엄(궁합·풀이) = 유료.
// 로그인 게이트 없음(ADR-037). 메뉴 = daniel 제작 카드 이미지(assets/icons/{key}.png, 남색·골드, 라벨 없음).
//   라벨은 코드 t()로 하단 오버레이 → 영·일 다국어 유지(ADR-049).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, ImageBackground, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/useAuth';
import { useEffect, useRef, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showRewardedAd } from '../../lib/ads';
import { ChartPicker } from '../../components/ChartPicker';
import { getDailyFortune, dailyChartReadings } from '../../lib/dailyFortune';
import { useSubscription } from '../../lib/subscription';
import { loadRepChart } from '../../lib/myChart';
import { prewarmReadings } from '../../lib/prewarmReadings';
import { scheduleDailyFortune } from '../../lib/notifications'; // 매일 9시 오늘의 운세 알림
import { buildSajuChart } from '@engine/saju';
import type { Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { playSound } from '../../lib/sounds';
import { BusyOverlay } from '../../components/BusyOverlay'; // 로그아웃 등 긴 콜백 로딩
import { LOVE_PRICE, LOVE_DISCOUNT } from './love'; // 애정흐름 카드 가격 배지(할인 마킹)

type MenuItem = { key: string; labelKey: string; descKey?: string; image?: any; route: string; ready: boolean; premium?: boolean; content?: boolean; priceBadge?: boolean };
type Section = { key: string; titleKey: string; items: MenuItem[] };

// 홈 = 무료 / 프리미엄 / 콘텐츠 3범주(daniel 기획, docs/기획_정보구조_v0.1.md).
//   · 무료: 온디바이스·룰(API 0). · 프리미엄: 사주·자미 2허브(각 풀이·타임라인·궁합). · 콘텐츠: 무료+유료 혼합.
//   명식 등록·전환은 상단 ChartPicker(그리드 제외).
const SECTIONS: Section[] = [
  { key: 'free', titleKey: 'menu.secFree', items: [
    { key: 'manse', labelKey: 'menu.manse', image: require('../../../assets/icons/manse.png'), route: '/charts', ready: true },
    { key: 'today', labelKey: 'menu.today', image: require('../../../assets/icons/today.png'), route: '/today', ready: true },
    { key: 'month', labelKey: 'menu.month', image: require('../../../assets/icons/month.png'), route: '/month', ready: true },
    { key: 'taro', labelKey: 'menu.taro', image: require('../../../assets/icons/taro.png'), route: '/taro', ready: true },
    // 일주론 = 태어난 날 간지로 보는 기질(무료·온디바이스). daniel 카드 이미지(골든 기둥·해달).
    { key: 'dayPillar', labelKey: 'menu.dayPillar', image: require('../../../assets/icons/dayPillar.png'), route: '/dayPillar', ready: true },
  ] },
  // 프리미엄 = 사주·자미 2허브(각 허브 안에 원국풀이·타임라인 큰 카드) + 궁합 독립(사주+자미 교차, daniel).
  { key: 'premium', titleKey: 'menu.secPremium', items: [
    { key: 'saju', labelKey: 'menu.saju', image: require('../../../assets/icons/premium.png'), route: '/premium?domain=saju', ready: true, premium: true },
    { key: 'ziwei', labelKey: 'menu.ziweiHub', image: require('../../../assets/icons/ziwei.png'), route: '/premium?domain=ziwei', ready: true, premium: true },
    { key: 'compat', labelKey: 'menu.compat', image: require('../../../assets/icons/compat.png'), route: '/compat', ready: true, premium: true },
  ] },
  // 콘텐츠 = 가벼운 재미(무료) + 유료 디테일. 펫(무료·온디바이스) / 애정흐름(유료·LLM·가격 마킹).
  { key: 'content', titleKey: 'menu.secContent', items: [
    { key: 'pet', labelKey: 'menu.pet', image: require('../../../assets/icons/pet.png'), route: '/pet', ready: true, content: true },
    { key: 'love', labelKey: 'menu.love', image: require('../../../assets/icons/love.png'), route: '/love', ready: true, content: true, priceBadge: true },
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
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [dayOffset, setDayOffset] = useState(0); // 0=오늘·1=내일(오늘의 기운 카드 토글)
  const fortune = useMemo(() => getDailyFortune(dayOffset), [dayOffset]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // 오늘의 기운 한 줄 풀이(글) — 대표 명식 일간 × 오늘 일진(온디바이스, 무료). 탭 → 오늘의 운세 상세.
  const [todayProse, setTodayProse] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false); // 로그아웃 콜백 동안 오버레이
  async function doLogout() {
    setLoggingOut(true);
    try { await supabase.auth.signOut(); }
    finally { setLoggingOut(false); }
  }
  useEffect(() => {
    (async () => {
      const rep = await loadRepChart();
      if (!rep) return;
      const saju = buildSajuChart(rep.input);
      const r = dailyChartReadings(saju, fortune.dayGanZhi[0] as Stem, fortune.dayGanZhi[1] as Branch);
      const general = r.find((x) => x.key === 'general')?.paragraphs ?? [];
      if (general[0]) setTodayProse(general[0]); // 통합 기조 첫 문단
    })();
  }, [fortune]);

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
    if (!m.premium && m.key !== 'manse') await showRewardedAd().catch(() => false);
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
            <Text style={styles.bannerDate}>{fortune.date}</Text>
            <Text style={styles.bannerPillar}>{dayOffset === 0 ? t('today.dayPillar') : t('today.energyTomorrow')}: <Text style={{ color: colors.ju }}>{fortune.dayGanZhi}</Text></Text>
            {todayProse && <Text style={styles.bannerProse} numberOfLines={3}>{todayProse}</Text>}
            {todayProse && <Text style={styles.bannerMore}>{t('today.more')}</Text>}
          </Pressable>
        </View>

        {/* 대표 명식 선택/전환 (등록한 다른 명식으로 변경) */}
        <ChartPicker />

        {/* 무료 / 프리미엄 / 콘텐츠 3범주 — 큰 섹션 헤더 + 좌우 가로 스크롤 카드(daniel) */}
        {SECTIONS.map((sec) => (
          <View key={sec.key} style={styles.section}>
            {/* '무료' 라벨은 빼고(daniel) 맨 위 기본 섹션은 헤더 없이 — 프리미엄·스페셜만 헤더 표시 */}
            {sec.key !== 'free' && <Text style={styles.sectionH}>{t(sec.titleKey)}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {sec.items.map((m) => {
                const prem = !!m.premium;
                // 콘텐츠(이미지 없음) = 텍스트 카드(제목+설명), 이미지 카드와 시각 구분
                if (!m.image) {
                  return (
                    <Pressable key={m.key} style={[styles.card, styles.textCard]} onPress={() => onPress(m)}>
                      {m.priceBadge && (
                        <View style={styles.priceTag}>
                          <Text style={styles.priceTagText}>{LOVE_DISCOUNT}% · {LOVE_PRICE}</Text>
                        </View>
                      )}
                      <Text style={styles.textCardLabel}>{t(m.labelKey)}</Text>
                      {m.descKey ? <Text style={styles.textCardDesc}>{t(m.descKey)}</Text> : null}
                    </Pressable>
                  );
                }
                return (
                  <Pressable key={m.key} style={styles.card} onPress={() => onPress(m)}>
                    <ImageBackground source={m.image} style={styles.cardImg} imageStyle={styles.cardImgInner} resizeMode="cover">
                      {prem && (
                        <View style={styles.premTag}>
                          <Text style={styles.premTagText}>{t('menu.premiumTag')}</Text>
                        </View>
                      )}
                      {m.priceBadge && (
                        <View style={styles.priceTag}>
                          <Text style={styles.priceTagText}>{LOVE_DISCOUNT}% · {LOVE_PRICE}</Text>
                        </View>
                      )}
                      {/* 하단 라벨 바(반투명 남색) — 가독 + 다국어 */}
                      <View style={styles.labelBar}>
                        <Text style={[styles.cardLabel, prem && styles.cardLabelPrem]}>{t(m.labelKey)}</Text>
                      </View>
                    </ImageBackground>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}

        {/* 로그인 = 선택 */}
        <View style={styles.authRow}>
          {session ? (
            <Pressable onPress={doLogout}>
              <Text style={styles.linkText}>{t('common.logout')} ({session.user.email})</Text>
            </Pressable>
          ) : (
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
  bannerPillar: { ...font.heading, color: colors.ink, marginTop: space(1) },
  bannerProse: { ...font.body, color: colors.inkSoft, marginTop: space(2.5), lineHeight: 22 },
  bannerMore: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  // 범주 섹션(무료/프리미엄/콘텐츠) — 큰 헤더 + 좌우 가로 스크롤
  section: { marginBottom: space(6), marginHorizontal: -space(5) }, // 가로 스크롤이 화면 끝까지 닿도록 wrap 패딩 상쇄
  sectionH: { fontSize: 22, fontWeight: '800', color: colors.ju, marginBottom: space(3), letterSpacing: 0.3, paddingHorizontal: space(5) },
  hRow: { gap: space(3), paddingHorizontal: space(5), paddingVertical: space(1) }, // 카드 사이 간격 + 좌우 여백
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
    width: 156, aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden',
    ...shadow.card, // 박스 테두리 제거(이미지 자체 골드 프레임 사용)
  },
  cardImg: { flex: 1, justifyContent: 'flex-end' },
  cardImgInner: { borderRadius: radius.md },
  labelBar: { backgroundColor: 'rgba(21,19,46,0.72)', paddingVertical: space(2.5), alignItems: 'center' },
  cardLabel: { color: colors.ink, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
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
