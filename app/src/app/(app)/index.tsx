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
import { useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { showInterstitialAd } from '../../lib/ads';
import { ChartPicker } from '../../components/ChartPicker';
import { getDailyFortune } from '../../lib/dailyFortune';
import { colors, radius, space, shadow, font } from '../../lib/theme';

type MenuItem = { key: string; labelKey: string; image: any; route: string; ready: boolean; premium?: boolean };

const MENU: MenuItem[] = [
  // 명식 등록 타일은 홈 그리드에서 제외(daniel 요청) — 등록·전환은 상단 ChartPicker 로.
  { key: 'manse', labelKey: 'menu.manse', image: require('../../../assets/icons/manse.png'), route: '/charts', ready: true },
  { key: 'taro', labelKey: 'menu.taro', image: require('../../../assets/icons/taro.png'), route: '/taro', ready: true },
  { key: 'today', labelKey: 'menu.today', image: require('../../../assets/icons/today.png'), route: '/today', ready: true },
  { key: 'premium', labelKey: 'menu.premium', image: require('../../../assets/icons/premium.png'), route: '/register', ready: true, premium: true },
  { key: 'compat', labelKey: 'menu.compat', image: require('../../../assets/icons/compat.png'), route: '/compat', ready: true, premium: true },
  { key: 'ziwei', labelKey: 'menu.ziwei', image: require('../../../assets/icons/ziwei.png'), route: '/ziwei', ready: true, premium: true },
];

function TwinklingStars() {
  const starAnims = useRef([new Animated.Value(0.3), new Animated.Value(0.5), new Animated.Value(0.2)]).current;

  useEffect(() => {
    starAnims.forEach((anim, i) => {
      const duration = 1500 + i * 800;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.Text style={[styles.star, { top: '15%', left: '20%', opacity: starAnims[0] }]}>✦</Animated.Text>
      <Animated.Text style={[styles.star, { top: '40%', right: '15%', opacity: starAnims[1] }]}>✧</Animated.Text>
      <Animated.Text style={[styles.star, { top: '75%', left: '35%', opacity: starAnims[2] }]}>✦</Animated.Text>
      <Animated.Text style={[styles.star, { top: '25%', right: '30%', opacity: starAnims[0], transform: [{ scale: 0.7 }] }]}>✧</Animated.Text>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const fortune = useMemo(() => getDailyFortune(), []);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
  }, []);

  async function onPress(m: MenuItem) {
    if (!m.ready) { Alert.alert(t(m.labelKey), t('common.comingSoon')); return; }
    // 무료 메뉴 = 진입 시 전면광고(ADR-043). 프리미엄은 광고 없이(해당 화면에서 구독 게이트).
    if (!m.premium) await showInterstitialAd();
    router.push(m.route);
  }

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bgImage} resizeMode="cover">
    <TwinklingStars />
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 언어 토글 (한·영·일) */}
      <View style={styles.langRow}>
        {(['ko', 'en', 'ja'] as const).map((lng) => (
          <Pressable key={lng} onPress={() => i18n.changeLanguage(lng)} hitSlop={6}>
            <Text style={[styles.langBtn, i18n.language === lng && styles.langOn]}>{lng.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        {/* 헤더 */}
        <Text style={styles.title}>{t('appName')}</Text>
        <Text style={styles.sub}>{t('tagline')}</Text>
        <View style={styles.divider} />

        {/* 오늘의 운세 배너 (요약) */}
        <View style={styles.fortuneBanner}>
          <Text style={styles.bannerDate}>{fortune.date}</Text>
          <Text style={styles.bannerPillar}>{t('today.dayPillar')}: <Text style={{ color: colors.ju }}>{fortune.dayGanZhi}</Text></Text>
        </View>

        {/* 대표 명식 선택/전환 (등록한 다른 명식으로 변경) */}
        <ChartPicker />

        {/* 2열 카드 그리드 — 이미지 + 하단 라벨 오버레이(코드 t() = 다국어) */}
        <View style={styles.grid}>
          {MENU.map((m) => {
            const prem = !!m.premium;
            return (
              <Pressable key={m.key} style={styles.card} onPress={() => onPress(m)}>
                <ImageBackground source={m.image} style={styles.cardImg} imageStyle={styles.cardImgInner} resizeMode="cover">
                  {prem && (
                    <View style={styles.premTag}>
                      <Text style={styles.premTagText}>{t('menu.premiumTag')}</Text>
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
        </View>

        {/* 로그인 = 선택 */}
        <View style={styles.authRow}>
          {session ? (
            <Pressable onPress={() => supabase.auth.signOut()}>
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  star: { position: 'absolute', color: colors.ju, fontSize: 16 },
  screen: { backgroundColor: 'rgba(21,19,46,0.3)' }, // 별밤 배경 위 반투명 남색 — 카드·텍스트 가독
  wrap: { padding: space(5), paddingTop: space(12), paddingBottom: space(10) }, // 헤더 숨김 → status bar 여백 확보
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space(3), marginBottom: space(2) },
  langBtn: { fontSize: 13, color: colors.inkFaint, fontWeight: '600' },
  langOn: { color: colors.ju },
  title: { ...font.display },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(2) },
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.ju, marginTop: space(4), marginBottom: space(6) },
  fortuneBanner: {
    backgroundColor: 'rgba(34,31,68,0.6)', padding: space(4), borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, marginBottom: space(6),
  },
  bannerDate: { ...font.caption, color: colors.inkSoft },
  bannerPillar: { ...font.heading, color: colors.ink, marginTop: space(1) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space(4) },
  // 카드 비율 384:512(3:4). 이미지 cover + 하단 라벨 오버레이.
  card: {
    width: '47.5%', aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden',
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
