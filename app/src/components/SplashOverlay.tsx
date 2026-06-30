// app/src/components/SplashOverlay.tsx — 앱 실행 인트로(緣 SyncFortune) 애니메이션 오버레이
// ─────────────────────────────────────────────────────────────────────────
// daniel: 앱 시작 시 제목이 애니메이션과 함께 나왔다 사라지면 좋겠다.
//   → 緣(골드 한자)이 살짝 회전·확대하며 등장 + SyncFortune 페이드인 → 잠시 머문 뒤 전체 페이드아웃.
//   끝나면 onDone() → 부모가 언마운트. 네이티브 모듈 없이 RN Animated 만 사용(빌드 의존 없음).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { colors, font, space } from '../lib/theme';

export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const op = useRef(new Animated.Value(0)).current;     // 전체 페이드(등장→유지→퇴장)
  const scale = useRef(new Animated.Value(0.82)).current; // 로고 확대(스프링)
  const glyph = useRef(new Animated.Value(0)).current;   // 緣 회전 + 제목 페이드
  const swing = useRef(new Animated.Value(0)).current;   // 緣 좌우 원형 회전(세로 가운데축 rotateY·daniel)

  useEffect(() => {
    // 緣 회전 등장(독립) — 전체 시퀀스와 병행
    Animated.timing(glyph, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // 緣 좌우 원형 회전 — 세로 가운데축 기준 동전 뒤집듯 좌우로(daniel: 좌우로 가운데축 원형방향)
    Animated.loop(Animated.sequence([
      Animated.timing(swing, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(swing, { toValue: -1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    // 전체: 페이드인+확대 → 0.9초 유지 → 페이드아웃 → onDone
    Animated.sequence([
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
      Animated.delay(900),
      Animated.timing(op, { toValue: 0, duration: 500, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  const rotateY = swing.interpolate({ inputRange: [-1, 1], outputRange: ['-55deg', '55deg'] });

  return (
    <Animated.View style={[styles.overlay, { opacity: op }]} pointerEvents="none">
      <Animated.Text style={[styles.glyph, { transform: [{ perspective: 800 }, { scale }, { rotateY }] }]}>緣</Animated.Text>
      <Animated.Text style={[styles.title, { opacity: glyph }]}>SyncFortune</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 미드나잇 배경 풀스크린 — 정적 스플래시(app.json) 위를 자연스럽게 덮어 인트로 연출
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  glyph: { fontSize: 96, fontWeight: '900', color: colors.ju, lineHeight: 110 }, // 緣 — 골드
  title: { ...font.heading, color: colors.ink, letterSpacing: 2, marginTop: space(3) },
});
