// app/src/components/ZodiacWheel.tsx — 황도 12궁 회전 휠(별자리 콘텐츠 재미)
// ─────────────────────────────────────────────────────────────────────────
// daniel B: 별자리 화면에 회전 휠. 정적 12궁 글리프(태양별자리 강조) + *포인터가 돌아
//   내 태양별자리에 안착*(운명의 수레바퀴 — 글리프는 똑바로 유지해 가독성 확보).
//   마운트 시 2바퀴 + 내 별자리 각도만큼 회전 후 감속 정지(Easing.out).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

const GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
// 영문 별자리명(astrology.big3.sun) → 인덱스(양자리=0 …)
const SIGN_ORDER = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

export function ZodiacWheel({ sunSign, size = 220 }: { sunSign?: string; size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const sunIdx = Math.max(0, SIGN_ORDER.indexOf(sunSign ?? '')); // 못 찾으면 0(양자리)
  useEffect(() => {
    spin.setValue(0);
    // 2바퀴(720°) + 내 별자리 위치(sunIdx*30°)만큼 돌아 안착 — 감속(out)으로 '딱' 멈춤
    Animated.timing(spin, { toValue: 1, duration: 2600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [spin, sunIdx]);
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${720 + sunIdx * 30}deg`] });
  const c = size / 2;
  const rGlyph = c - 22;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginBottom: 8 }}>
      {/* 정적 휠 — 12궁 글리프(똑바로), 태양별자리 강조 */}
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={c - 5} stroke="rgba(212,175,110,0.35)" strokeWidth={1.2} fill="none" />
        <Circle cx={c} cy={c} r={c - 38} stroke="rgba(212,175,110,0.15)" strokeWidth={1} fill="none" />
        {GLYPHS.map((g, i) => {
          const th = ((-90 + i * 30) * Math.PI) / 180; // 양자리(i=0) 12시 방향
          const x = c + rGlyph * Math.cos(th);
          const y = c + rGlyph * Math.sin(th);
          const on = i === sunIdx;
          return (
            <SvgText key={i} x={x} y={y + (on ? 8 : 6)} fontSize={on ? 23 : 16} fill={on ? '#E9C77B' : 'rgba(230,220,245,0.5)'} textAnchor="middle" fontWeight="bold">{g}</SvgText>
          );
        })}
      </Svg>
      {/* 회전 포인터 — 마운트 시 돌아 내 태양별자리(12시 기준 sunIdx*30°)에 안착 */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: rot }] }}>
        <Svg width={size} height={size}>
          <Line x1={c} y1={c} x2={c} y2={16} stroke="rgba(212,175,110,0.85)" strokeWidth={2} />
          <Circle cx={c} cy={13} r={5} fill="#E9C77B" />
          <Circle cx={c} cy={c} r={3} fill="rgba(212,175,110,0.9)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
