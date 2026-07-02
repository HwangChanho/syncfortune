// app/src/components/SplashOverlay.tsx — 앱 실행 인트로(백두산 천지 이미지) 오버레이
// ─────────────────────────────────────────────────────────────────────────
// daniel: 로딩 화면 = 백두산 천지 이미지만(八字·팔자 텍스트 제거). 이미지가 잘리지 않고 전체가
//   보이도록 contain(상하 여백은 미드나잇 배경이 자연스럽게 이음). 페이드인 → 잠시 머문 뒤
//   페이드아웃 → onDone(). RN Animated + ImageBackground(번들 에셋)라 네이티브 빌드 의존 없음.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, Text, Dimensions } from 'react-native';
import { colors } from '../lib/theme';

export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const op = useRef(new Animated.Value(0)).current; // 전체 페이드(등장→유지→퇴장)
  // 八字를 상단 여백(이미지 contain 시 위쪽 미드나잇 공간)에 *이미지와 안 겹치게* 최대한 크게(daniel 07-02).
  //   이미지 비율 832:1216 → contain 높이 = 화면폭×1216/832, 상단 여백 = (화면높이−높이)/2. 여백의 60%로 크게, 기기별 자동.
  const { width: W, height: H } = Dimensions.get('window');
  const SHIFT = Math.round(H * 0.06); // ★이미지·글자 함께 아래로(daniel 07-02: 로딩화면 더 아래로) — 화면 높이의 6%
  const topMargin = Math.max(0, (H - (W * 1216) / 832) / 2);
  const hanjaSize = Math.min(104, Math.max(40, Math.round(topMargin * 0.6)));
  const hanjaTop = Math.max(14, Math.round(topMargin + SHIFT - hanjaSize - 5)); // 이미지와 함께 SHIFT만큼 내려, 이미지 바로 위(5pt) 유지

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
      <ImageBackground source={require('../../assets/splash-bg.png')} style={[StyleSheet.absoluteFill, { transform: [{ translateY: SHIFT }] }]} resizeMode="contain" />
      {/* 좌상단 八字(노란색) — 브랜드 표식(daniel 07-01) */}
      <Text style={[styles.hanja, { fontSize: hanjaSize, top: hanjaTop }]}>八字</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 풀스크린 미드나잇 배경(이미지 contain 시 상하 여백을 자연스럽게 메움)
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  // 좌상단 八字 — 브랜드 골드(노란색), 어두운 천지 이미지 위 가독 위해 그림자(daniel 07-01)
  hanja: { position: 'absolute', top: 64, left: 26, fontSize: 36, fontWeight: '900', color: colors.ju, letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
});
