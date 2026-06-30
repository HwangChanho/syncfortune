// app/src/components/SplashOverlay.tsx — 앱 실행 인트로(八字 팔자) 오버레이 + 백두산 천지 배경
// ─────────────────────────────────────────────────────────────────────────
// daniel: 로딩 화면 = 백두산 천지(미드나잇골드 신비) 배경 + 상단에 八字(앱 한자) + 팔자.
//   배경 위에 八字·팔자가 페이드+스케일로 등장 → 잠시 머문 뒤 전체 페이드아웃.
//   (좌우 회전 애니는 daniel 요청으로 제거.) 끝나면 onDone() → 부모가 언마운트.
//   RN Animated + ImageBackground(번들 에셋)라 네이티브 빌드 의존 없음.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet } from 'react-native';
import { colors, font, space } from '../lib/theme';

export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const op = useRef(new Animated.Value(0)).current;       // 전체 페이드(등장→유지→퇴장)
  const scale = useRef(new Animated.Value(0.82)).current; // 八字 확대(스프링)
  const glyph = useRef(new Animated.Value(0)).current;    // 八字·팔자 페이드인

  useEffect(() => {
    // 八字·팔자 페이드인(독립)
    Animated.timing(glyph, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // 전체: 페이드인+확대 → 1.1초 유지 → 페이드아웃 → onDone
    Animated.sequence([
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
      Animated.delay(1100),
      Animated.timing(op, { toValue: 0, duration: 500, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[styles.overlay, { opacity: op }]} pointerEvents="none">
      {/* 백두산 천지 배경(미드나잇골드 신비) — 풀스크린 cover */}
      <ImageBackground source={require('../../assets/splash-bg.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* 상단: 八字(앱 한자) + 팔자 — 배경 위, 회전 없이 페이드+스케일만(daniel) */}
      <Animated.Text style={[styles.glyph, { opacity: glyph, transform: [{ scale }] }]}>八字</Animated.Text>
      <Animated.Text style={[styles.title, { opacity: glyph }]}>팔자</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 풀스크린 — 八字·팔자를 상단에 정렬(daniel: 이미지 상단에 앱 한자). 배경 로드 전 어두운 fallback.
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'flex-start', paddingTop: space(16), zIndex: 999 },
  glyph: { fontSize: 84, fontWeight: '900', color: colors.ju, lineHeight: 96, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } }, // 八字 — 골드
  title: { ...font.heading, color: colors.onImage, letterSpacing: 3, marginTop: space(2), textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 1 } },
});
