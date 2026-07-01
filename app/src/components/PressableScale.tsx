// app/src/components/PressableScale.tsx
// ─────────────────────────────────────────────────────────────────────────
// 탭 피드백(눌림 표시·daniel 07-01): 누르면 살짝 작아지고(scale) 흐려졌다가(opacity) 스프링으로 복귀.
//   Pressable 드롭인 대체 — style·onPress 등 그대로 쓰고, 누른 순간 시각 피드백만 더한다.
//   ref 전달(forwardRef)하므로 measureInWindow 등 필요한 곳(홈 카드)에서도 그대로 동작.
//   ※ style 이 함수(({pressed})=>…)인 Pressable에는 쓰지 말 것(정적 style 전용).
// ─────────────────────────────────────────────────────────────────────────
import { forwardRef, useRef } from 'react';
import { Animated, Pressable, type PressableProps } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  scaleTo?: number; // 눌렀을 때 축소 배율(기본 0.96)
  dimTo?: number;   // 눌렀을 때 불투명도(기본 0.82)
};

export const PressableScale = forwardRef<any, Props>(function PressableScale(
  { style, scaleTo = 0.96, dimTo = 0.82, onPressIn, onPressOut, children, ...rest },
  ref,
) {
  const a = useRef(new Animated.Value(0)).current; // 0=평상 / 1=눌림
  const anim = {
    transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
    opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, dimTo] }),
  };
  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      onPressIn={(e) => { Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 0 }).start(); onPressIn?.(e); }}
      onPressOut={(e) => { Animated.spring(a, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 8 }).start(); onPressOut?.(e); }}
      style={[style as any, anim]}
    >
      {children as any}
    </AnimatedPressable>
  );
});
