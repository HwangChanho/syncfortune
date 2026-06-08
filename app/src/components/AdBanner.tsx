// app/src/components/AdBanner.tsx — 무료 하단 고정 배너 광고 (AdMob). 프리미엄은 숨김.
// ─────────────────────────────────────────────────────────────────────────
// 무료 사용자 = 하단 배너 고정 / 프리미엄(구독) = 광고 없음(ADR-043 수익 구조).
// AdMob 실연동(react-native-google-mobile-ads BannerAd) 전엔 placeholder. daniel 계정·adUnitId 후.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { useSubscription } from '../lib/subscription';
import { colors } from '../lib/theme';

export function AdBanner() {
  const { isPremium } = useSubscription();
  if (isPremium) return null; // 프리미엄 = 광고 제거

  // TODO(daniel AdMob): <BannerAd unitId={...} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
  //   useSubscription 으로 무료만 렌더. 광고 로드 실패 시 자리 유지 or 접기 정책 결정.
  return (
    <View style={styles.banner}>
      <Text style={styles.placeholder}>AD</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 50,
    backgroundColor: colors.sunk,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  placeholder: { fontSize: 11, color: colors.inkFaint, letterSpacing: 3 },
});
