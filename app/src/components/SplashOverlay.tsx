// app/src/components/SplashOverlay.tsx — 앱 실행 인트로(백두산 천지 이미지) 오버레이
// ─────────────────────────────────────────────────────────────────────────
// daniel: 로딩 화면 = 백두산 천지 이미지만(八字·팔자 텍스트 제거). 이미지가 잘리지 않고 전체가
//   보이도록 contain(상하 여백은 미드나잇 배경이 자연스럽게 이음). 페이드인 → 잠시 머문 뒤
//   페이드아웃 → onDone(). RN Animated + ImageBackground(번들 에셋)라 네이티브 빌드 의존 없음.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const op = useRef(new Animated.Value(0)).current; // 전체 페이드(등장→유지→퇴장)

  useEffect(() => {
    // 페이드인 → 1.3초 유지 → 페이드아웃 → onDone
    Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.delay(2300),
      Animated.timing(op, { toValue: 0, duration: 500, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[styles.overlay, { opacity: op }]} pointerEvents="none">
      {/* 백두산 천지 이미지만 — 전체가 보이게 contain(잘림 없음). 여백은 미드나잇 배경이 자연스럽게 이음. */}
      <ImageBackground source={require('../../assets/splash-bg.png')} style={StyleSheet.absoluteFill} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 풀스크린 미드나잇 배경(이미지 contain 시 상하 여백을 자연스럽게 메움)
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
});
