// app/src/components/PressableScale.tsx
// ─────────────────────────────────────────────────────────────────────────
// 탭 피드백(눌림 표시·daniel 07-01): 누르면 살짝 작아지고(scale) 흐려졌다가(opacity) 스프링으로 복귀.
//   Pressable 드롭인 대체 — style·onPress 등 그대로 쓰고, 누른 순간 시각 피드백만 더한다.
//   ref 전달(forwardRef)하므로 measureInWindow 등 필요한 곳(홈 카드)에서도 그대로 동작.
//   ★정적 style·함수형 style(({pressed})=>…) 모두 지원 = 어떤 Pressable이든 안전한 드롭인(daniel 07-02: 모든 버튼 누름 애니).
// ─────────────────────────────────────────────────────────────────────────
import { forwardRef, useRef } from 'react';
import { Animated, Pressable, type PressableProps } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  scaleTo?: number; // 눌렀을 때 축소 배율(기본 0.96)
  dimTo?: number;   // 눌렀을 때 불투명도(기본 0.82)
};

export const PressableScale = forwardRef<any, Props>(function PressableScale(
  { style, scaleTo = 0.96, dimTo = 0.82, onPressIn, onPressOut, onPress, children, ...rest },
  ref,
) {
  const a = useRef(new Animated.Value(0)).current; // 0=평상 / 1=눌림
  // ★연타 이중실행 차단(daniel 2026-08-05 "예약 알림이 두 번씩 등록돼").
  //   실측: push_campaigns 두 행의 created_at 이 **마이크로초까지 동일** — 같은 순간 두 탭이
  //   둘 다 나갔다는 뜻이다. 화면들의 busy state 가드는 setState 가 다음 렌더에야 반영돼
  //   같은 프레임 2탭을 못 막는다(08-02 알림 이중발화와 같은 뿌리).
  //   ⇒ 모든 버튼의 길목인 여기서 ref(동기)로 막는다. 350ms 안의 재탭 = 무시.
  //   ⚠️ 350ms 는 '같은 버튼' 기준(인스턴스별) — 다른 버튼을 이어 누르는 것은 안 막는다.
  const lastPress = useRef(0);
  const guardedPress: Props['onPress'] = onPress
    ? (e) => {
        const now = Date.now();
        if (now - lastPress.current < 350) return;
        lastPress.current = now;
        onPress(e);
      }
    : undefined;
  const anim = {
    transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
    opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, dimTo] }),
  };
  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      onPress={guardedPress}
      onPressIn={(e) => { Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 0 }).start(); onPressIn?.(e); }}
      onPressOut={(e) => { Animated.spring(a, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 8 }).start(); onPressOut?.(e); }}
      // 정적 style이면 [style, anim] / 함수형 style이면 (state)=>[style(state), anim] — 둘 다 안전.
      style={typeof style === 'function' ? (state: any) => [(style as any)(state), anim] : [style as any, anim]}
    >
      {children as any}
    </AnimatedPressable>
  );
});
