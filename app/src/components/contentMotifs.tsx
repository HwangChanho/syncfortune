// app/src/components/contentMotifs.tsx — 심층 콘텐츠별 SVG 모티프(보는 맛)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 콘텐츠마다 특징을 살린 시각 + 애니. 무거운 이미지 대신 SVG(색 동적·용량 0)로 모티프를 그린다.
//   · 뿌리(나무): 가지=드러난 나 / 뿌리=품은 힘 — 뿌리가 아래로 자라나는 그리기 애니.
//   · 비치는 나(오라): 오행 5색 동심 링이 바깥부터 차례로 번지는 빛 애니.
//   · 사명(별자리): 별들이 선으로 이어지고 북극성이 반짝이는 애니.
// strokeDashoffset/그리기 애니는 네이티브 드라이버 미지원 → useNativeDriver:false, opacity 펄스만 true.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import { colors } from '../lib/theme';
import { elementColor } from '../lib/engine/ohaeng';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const ALine = Animated.createAnimatedComponent(Line);

// ── 명식의 뿌리: 나무(가지 위 / 뿌리 아래, 자라나는 애니) ──
export function RootsTree({ size = 132 }: { size?: number }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [grow]);
  const off = grow.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }); // 뿌리 그리기
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* 줄기 */}
      <Line x1={50} y1={28} x2={50} y2={60} stroke={colors.ju} strokeWidth={3} strokeLinecap="round" />
      {/* 가지 + 잎(드러난 나) */}
      <Line x1={50} y1={36} x2={37} y2={25} stroke={colors.ju} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={50} y1={40} x2={63} y2={27} stroke={colors.ju} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={37} cy={24} r={5} fill={colors.ju} opacity={0.9} />
      <Circle cx={63} cy={26} r={5.5} fill={colors.ju} opacity={0.9} />
      <Circle cx={50} cy={20} r={6.5} fill={colors.ju} />
      {/* 땅선 */}
      <Line x1={26} y1={62} x2={74} y2={62} stroke={colors.line} strokeWidth={1} strokeDasharray="3 3" />
      {/* 뿌리(품은 힘) — 아래로 자라나는 그리기 애니 */}
      <APath d="M50 60 C 44 72, 33 76, 27 88" stroke={colors.ju} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={120} strokeDashoffset={off} opacity={0.6} />
      <APath d="M50 60 C 56 72, 67 76, 73 88" stroke={colors.ju} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeDasharray={120} strokeDashoffset={off} opacity={0.7} />
      <APath d="M50 60 L 50 90" stroke={colors.ju} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeDasharray={120} strokeDashoffset={off} opacity={0.45} />
    </Svg>
  );
}

// ── 비치는 나: 오행 5색 동심 링이 바깥부터 번지는 빛(오라) ──
export function ImageAura({ size = 132 }: { size?: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const RINGS = ['水', '金', '土', '火', '木'] as const; // 바깥→안(차례로 번짐)
  useEffect(() => {
    Animated.stagger(160, RINGS.map((_, i) =>
      Animated.timing(fade, { toValue: i + 1, duration: 420, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    )).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: false }),
    ])).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const centerR = pulse.interpolate({ inputRange: [0, 1], outputRange: [9, 12] });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {RINGS.map((el, i) => {
        const r = 44 - i * 8;
        const op = fade.interpolate({ inputRange: [i, i + 1], outputRange: [0, 0.55 - i * 0.05], extrapolate: 'clamp' });
        return <ACircle key={el} cx={50} cy={50} r={r} stroke={elementColor[el]} strokeWidth={3} fill="none" opacity={op} />;
      })}
      {/* 중앙 = 나(빛나는 점, 은은한 펄스) */}
      <ACircle cx={50} cy={50} r={centerR} fill={colors.ju} />
    </Svg>
  );
}

// ── 나의 사명: 별자리(별들이 선으로 이어지고 북극성 반짝) ──
export function MissionStars({ size = 132 }: { size?: number }) {
  const draw = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  // 별 좌표(북극성 = 가장 큰, 위쪽)
  const STARS = [[50, 20], [30, 40], [44, 56], [68, 48], [60, 74]];
  useEffect(() => {
    Animated.timing(draw, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(twinkle, { toValue: 1, duration: 900, useNativeDriver: false }),
      Animated.timing(twinkle, { toValue: 0, duration: 900, useNativeDriver: false }),
    ])).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const off = draw.interpolate({ inputRange: [0, 1], outputRange: [160, 0] });
  const polR = twinkle.interpolate({ inputRange: [0, 1], outputRange: [7, 9] });
  // 별 잇는 경로
  const path = `M${STARS[0][0]} ${STARS[0][1]} L${STARS[1][0]} ${STARS[1][1]} L${STARS[2][0]} ${STARS[2][1]} L${STARS[3][0]} ${STARS[3][1]} L${STARS[4][0]} ${STARS[4][1]}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* 별자리 선(그려지는 애니) */}
      <APath d={path} stroke={colors.ju} strokeWidth={1.2} fill="none" opacity={0.5} strokeDasharray={160} strokeDashoffset={off} />
      {/* 작은 별들(자미 보조) */}
      {STARS.slice(1).map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={3.5} fill={colors.ju} opacity={0.8} />)}
      {/* 북극성(사명) — 반짝이는 큰 별 */}
      <ACircle cx={STARS[0][0]} cy={STARS[0][1]} r={polR} fill={colors.ju} />
      <Circle cx={STARS[0][0]} cy={STARS[0][1]} r={3} fill={colors.bg} />
    </Svg>
  );
}

// ── 나의 애정흐름: 두 마음을 잇는 인연의 실 + 중앙 하트(점 펄스) ──
export function LoveThread({ size = 132 }: { size?: number }) {
  const draw = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;
  const PINK = '#E5749B';
  useEffect(() => {
    Animated.timing(draw, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(beat, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(beat, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ])).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const off = draw.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
  const pr = beat.interpolate({ inputRange: [0, 1], outputRange: [6, 7.6] });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* 두 사람을 잇는 인연의 실(그려지는 애니) */}
      <APath d="M22 38 Q 50 76, 78 38" stroke={PINK} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeDasharray={120} strokeDashoffset={off} opacity={0.6} />
      {/* 양쪽 사람(점, 은은한 펄스) */}
      <ACircle cx={22} cy={38} r={pr} fill={PINK} opacity={0.9} />
      <ACircle cx={78} cy={38} r={pr} fill={PINK} opacity={0.9} />
      {/* 중앙 하트 */}
      <Path d="M50 50 C 46 44, 37 45, 37 53 C 37 61, 50 68, 50 68 C 50 68, 63 61, 63 53 C 63 45, 54 44, 50 50 Z" fill={PINK} />
    </Svg>
  );
}

// ── 신년운세: 열두 달이 차례로 차오르는 한 해의 수레바퀴 + 중앙 빛 ──
export function NewyearWheel({ size = 132 }: { size?: number }) {
  const fill = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const GOLD = colors.ju;
  useEffect(() => {
    Animated.timing(fill, { toValue: 1, duration: 1700, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: false }),
    ])).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cr = glow.interpolate({ inputRange: [0, 1], outputRange: [5, 7] });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* 12달 눈금 — 12시 방향부터 시계방향으로 차례로 차오름 */}
      {Array.from({ length: 12 }).map((_, i) => {
        const ang = (i / 12) * 2 * Math.PI - Math.PI / 2;
        const x1 = 50 + 32 * Math.cos(ang), y1 = 50 + 32 * Math.sin(ang);
        const x2 = 50 + 42 * Math.cos(ang), y2 = 50 + 42 * Math.sin(ang);
        const op = fill.interpolate({ inputRange: [i / 12, (i + 1) / 12], outputRange: [0.18, 1], extrapolate: 'clamp' });
        return <ALine key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth={3} strokeLinecap="round" opacity={op} />;
      })}
      <Circle cx={50} cy={50} r={20} fill="none" stroke={GOLD} strokeWidth={1.4} opacity={0.35} />
      {/* 중앙 빛(은은한 펄스) */}
      <ACircle cx={50} cy={50} r={cr} fill={GOLD} />
    </Svg>
  );
}
