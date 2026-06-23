// app/src/components/Reveal.tsx — 콘텐츠 섹션 등장 애니메이션
// ─────────────────────────────────────────────────────────────────────────
// daniel: 콘텐츠가 이미지+글 정적 나열이라 지루함 → 카드/섹션이 *하나씩 순차로 드러나게*(재미).
//   마운트 시 페이드 + 살짝 슬라이드업. delay(=index×stagger)로 위→아래 순차 등장.
//   useNativeDriver(부드러움·JS 스레드 비점유). 어떤 콘텐츠 섹션이든 감싸서 재사용.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewStyle, type StyleProp } from 'react-native';

export function Reveal({ children, delay = 0, dy = 16, style }: {
  children: ReactNode;
  delay?: number;            // 등장 지연(ms) — 보통 index×80~100으로 순차 stagger
  dy?: number;               // 슬라이드업 시작 오프셋(px)
  style?: StyleProp<ViewStyle>;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = Animated.timing(a, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    t.start();
    return () => t.stop();   // 언마운트 시 정리(빠른 화면 전환 안전)
  }, [a, delay]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
