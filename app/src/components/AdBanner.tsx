// app/src/components/AdBanner.tsx — 무료 하단 고정 배너 광고 (AdMob). 프리미엄은 숨김.
// ─────────────────────────────────────────────────────────────────────────
// 무료 사용자 = 하단 배너 고정 / 프리미엄(구독) = 광고 없음(ADR-043 수익 구조).
// react-native-google-mobile-ads 는 *네이티브 모듈* — 재빌드(npm run ios) 전의 dev client 에는
//   없으므로 lazy require 로 가드: 모듈 없음 → __DEV__ 플레이스홀더 / 프로덕션 null (크래시 방지).
// 현재 App ID·unitId = 구글 공식 **테스트 ID** (app.json plugin 포함).
//   ★daniel: AdMob 계정 생성 후 실 ID 교체(아래 PROD_UNIT + app.json). 개발 중엔 테스트 ID 유지(정책 위반 방지).
//   ★출시 전: ATT/UMP 동의 플로우 추가 후 requestNonPersonalizedAdsOnly 해제 검토(지금은 비맞춤 = 동의 불요).
// 로드 실패 시 = 접기(null) — 빈 회색 바보다 콘텐츠에 양보.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../lib/subscription';
import { colors } from '../lib/theme';

// 네이티브 모듈 lazy require — 미포함 빌드(재빌드 전 dev client)에서 import 크래시 방지.
let Ads: any = null;
try { Ads = require('react-native-google-mobile-ads'); } catch { Ads = null; }

// 프로덕션 배너 unitId 슬롯 — ★현재는 구글 테스트 unit. daniel AdMob 계정 후 실값 교체.
const PROD_UNIT: Record<string, string> = {
  ios: 'ca-app-pub-2936938026486482/4542144148',     // 실 iOS 배너(daniel AdMob)
  android: 'ca-app-pub-2936938026486482/4386770475', // 실 Android 배너
};

export function AdBanner() {
  const { isPremium } = useSubscription();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false); // 로드 실패 → 접기

  // SDK 초기화는 루트 _layout 의 initAds() 가 앱 시작 시 1회 담당 — 여기서 중복 호출하면
  //   initAds() 의 adsInited 플래그를 우회해 BannerAd 렌더 시점과 초기화 완료 시점이 어긋나
  //   onAdFailedToLoad → failed=true → 배너가 숨겨지는 레이스 조건이 생긴다.
  //   (버그: 2026-06-28 발견·제거)

  if (isPremium) return null;  // 프리미엄 = 광고 제거
  if (failed) return null;     // 광고 없음 = 자리도 접음

  // 재빌드 전(모듈 없음): 개발에선 자리 확인용 플레이스홀더, 프로덕션은 숨김.
  if (!Ads?.BannerAd) {
    if (!__DEV__) return null;
    return (
      <View style={[styles.placeholderBar, { paddingBottom: insets.bottom }]}>
        <Text style={styles.placeholder}>AD (재빌드 후 실 배너)</Text>
      </View>
    );
  }

  const { BannerAd, BannerAdSize, TestIds } = Ads;
  // 개발 = 항상 테스트 unit(실 unit 클릭은 계정 정지 사유) / 프로덕션 = PROD_UNIT(현재 테스트값, daniel 교체).
  const unitId = __DEV__ ? TestIds.ADAPTIVE_BANNER : (PROD_UNIT[Platform.OS] ?? TestIds.ADAPTIVE_BANNER);
  return (
    <View style={{ backgroundColor: colors.bg, paddingBottom: insets.bottom }}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholderBar: {
    height: 50,
    backgroundColor: colors.sunk,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  placeholder: { fontSize: 11, color: colors.inkFaint, letterSpacing: 3 },
});
