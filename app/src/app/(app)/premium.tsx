// src/app/(app)/premium.tsx — 프리미엄 허브 (사주 / 자미두수 분기)
// ─────────────────────────────────────────────────────────────────────────
// daniel 기획 개정: 프리미엄 = 사주·자미 도메인. 각 허브 안에 *원국풀이·인생 타임라인*을
//   큰 카드 가로스크롤(한 화면 1.5~2개 보이게, 좌우 패딩)로. 궁합은 허브에서 빼서 독립(홈 프리미엄).
//   풀이만 도메인별로 다르고(원국 풀이 ↔ 명반 풀이) 타임라인은 공통(차트 레벨).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ImageBackground, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, shadow, font } from '../../lib/theme';

type HubItem = { key: string; icon: any; labelKey: string; descKey: string; route: string };

// 세로 스택 — 한 화면에 1.5~2개 보이게(카드 높이 = 화면높이 × 0.42), 좌우 패딩(daniel).
const SCREEN_H = Dimensions.get('window').height;
const CARD_H = Math.round(SCREEN_H * 0.42);

const ICON = {
  saju: require('../../../assets/icons/premium.jpg'),
  ziwei: require('../../../assets/icons/ziwei.jpg'),
  timeline: require('../../../assets/icons/timeline.jpg'),
};

// 도메인별 허브 = 원국풀이(도메인별) + 인생 타임라인(공통). 궁합은 독립(홈 프리미엄)으로 분리.
const HUBS: Record<string, { titleKey: string; items: HubItem[] }> = {
  saju: {
    titleKey: 'menu.saju',
    items: [
      { key: 'reading', icon: ICON.saju, labelKey: 'premiumHub.sajuReading', descKey: 'premiumHub.sajuReadingDesc', route: '/reading' },
      { key: 'timeline', icon: ICON.timeline, labelKey: 'menu.timeline', descKey: 'menu.timelineDesc', route: '/timeline' },
    ],
  },
  ziwei: {
    titleKey: 'menu.ziweiHub',
    items: [
      { key: 'reading', icon: ICON.ziwei, labelKey: 'premiumHub.ziweiReading', descKey: 'premiumHub.ziweiReadingDesc', route: '/ziwei' },
      { key: 'timeline', icon: ICON.timeline, labelKey: 'menu.timeline', descKey: 'menu.timelineDesc', route: '/timeline' },
    ],
  },
};

export default function PremiumHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const { domain } = useLocalSearchParams<{ domain?: string }>();
  const hub = useMemo(() => HUBS[domain === 'ziwei' ? 'ziwei' : 'saju'], [domain]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: t(hub.titleKey) }} />
      <Text style={styles.h}>{t(hub.titleKey)}</Text>
      <Text style={styles.sub}>{t('premiumHub.sub')}</Text>

      {/* 원국풀이·인생 타임라인 = 큰 카드 세로 스택(한 화면 1.5~2개, 좌우 패딩) */}
      {hub.items.map((it) => (
        <Pressable key={it.key} style={styles.card} onPress={() => router.push(it.route)}>
          <ImageBackground source={it.icon} style={styles.cardImg} imageStyle={styles.cardImgInner} resizeMode="cover">
            <View style={styles.labelBar}>
              <Text style={styles.cardLabel}>{t(it.labelKey)}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{t(it.descKey)}</Text>
            </View>
          </ImageBackground>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  // 좌우 패딩(daniel) — 카드가 화면 양옆에서 떨어지게
  wrap: { paddingTop: space(5), paddingBottom: space(12), paddingHorizontal: space(5) },
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5) },
  // 큰 카드 — 전체폭(좌우 패딩 적용) × 높이 0.42화면 → 세로로 한 화면 1.5~2개
  card: { width: '100%', height: CARD_H, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space(4), ...shadow.card },
  cardImg: { flex: 1, justifyContent: 'flex-end' },
  cardImgInner: { borderRadius: radius.lg },
  // 하단 라벨 바(반투명 남색) — 제목 + 설명
  labelBar: { backgroundColor: 'rgba(21,19,46,0.78)', paddingVertical: space(4), paddingHorizontal: space(4) },
  cardLabel: { color: colors.ju, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  cardDesc: { color: colors.inkSoft, fontSize: 13, marginTop: space(1.5), lineHeight: 18 },
});
