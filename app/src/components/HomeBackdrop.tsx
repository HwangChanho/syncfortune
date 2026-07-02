// app/src/components/HomeBackdrop.tsx — 홈 배경 애니 레이어(재사용)
// ─────────────────────────────────────────────────────────────────────────
// 홈(index.tsx)에서 분리한 배경 애니를 로딩 스플래시와 공유하기 위해 컴포넌트화(daniel 07-02).
//   구성: ①다크=반짝이는 별+유성(TwinklingStars) / 라이트=태양 글로우+회전 광선(SunGlow)
//         ②조선 산수화풍 능선 위를 걷는 갓 쓴 선비(SeonbiWalk) — 테마 무관 공통 오버레이.
//   HomeBackdrop = 위 둘을 activeScheme에 맞춰 합성한 단일 진입점. 홈·스플래시 어디서든 <HomeBackdrop /> 한 줄.
// ─────────────────────────────────────────────────────────────────────────
import { useRef, useEffect } from 'react';
import { Animated, Easing, Dimensions, View, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg'; // 선비 실루엣 + 산수화풍 한지산(daniel)
import { colors, radius, activeScheme } from '../lib/theme';

// 다크 배경 — 반짝이는 별 3개(각기 다른 주기) + 8초마다 대각선으로 흐르는 유성.
//   ★export: 전역 콘텐츠 배경(ContentBackdrop)이 다크 밤하늘 위에 동일한 별·유성을 재사용(daniel 07-02).
export function TwinklingStars() {
  const starAnims = useRef([new Animated.Value(0.3), new Animated.Value(0.5), new Animated.Value(0.2)]).current;
  const shootingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 반짝이는 별들
    starAnims.forEach((anim, i) => {
      const duration = 1500 + i * 800;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration, useNativeDriver: true }),
        ])
      ).start();
    });

    // 유성 애니메이션 (8초마다 한 번씩)
    const runShootingStar = () => {
      shootingAnim.setValue(0);
      Animated.timing(shootingAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(runShootingStar, 7000 + Math.random() * 3000);
      });
    };
    runShootingStar();
  }, []);

  const shootX = shootingAnim.interpolate({ inputRange: [0, 1], outputRange: [400, -100] });
  const shootY = shootingAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 400] });
  const shootOpacity = shootingAnim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.Text style={[styles.star, { top: '15%', left: '20%', opacity: starAnims[0] }]}>✦</Animated.Text>
      <Animated.Text style={[styles.star, { top: '40%', right: '15%', opacity: starAnims[1] }]}>✧</Animated.Text>
      <Animated.Text style={[styles.star, { top: '75%', left: '35%', opacity: starAnims[2] }]}>✦</Animated.Text>
      <Animated.Text style={[styles.star, { top: '25%', right: '30%', opacity: starAnims[0], transform: [{ scale: 0.7 }] }]}>✧</Animated.Text>

      {/* 유성 */}
      <Animated.View
        style={[
          styles.shootingStar,
          {
            transform: [{ translateX: shootX }, { translateY: shootY }, { rotate: '-45deg' }],
            opacity: shootOpacity,
          },
        ]}
      />
    </View>
  );
}

// 라이트모드 배경 — 우측 상단 태양(글로우 맥동 + 광선 천천히 회전). 다크의 별·유성에 대응(daniel 06-30).
function SunGlow() {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [pulse, spin]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const glowOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.58] });
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={styles.sunWrap} pointerEvents="none">
      <Animated.View style={[styles.sunRays, { transform: [{ rotate: rot }] }]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} style={[styles.sunRay, { transform: [{ rotate: `${i * 30}deg` }] }]} />
        ))}
      </Animated.View>
      <Animated.View style={[styles.sunGlow, { transform: [{ scale }], opacity: glowOp }]} />
      <View style={styles.sunCore} />
    </View>
  );
}

// 조선 산수화풍 한지산(daniel ③) — 겹겹의 연봉(원경·중경·근경 수묵 농담) + 운무 + 달, 그 능선을 따라 걷는 갓 쓴 선비.
//   ★개선: 단일 각진 능선 → 부드러운 베지어 연봉 3겹(원근 = 농담·불투명도 차) + 산 사이 운무 띠 + 옅은 달.
//   선비 위치(bottom 62)·근경 능선 높이는 검증값 보존 — 뒤로 원경/중경 산만 추가해 깊이를 만든다.
function SeonbiWalk() {
  const W = Dimensions.get('window').width;
  const walk = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const mist = useRef(new Animated.Value(0)).current; // 운무 잔잔한 좌우 흐름(산수화 운치)
  useEffect(() => {
    Animated.loop(Animated.timing(walk, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(mist, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(mist, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
  }, []);
  const tx = walk.interpolate({ inputRange: [0, 1], outputRange: [-44, W + 44] });   // 화면 밖→밖 가로 이동(루프)
  const ty = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] });         // 걸음 bob(위아래)
  const mistX = mist.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });     // 운무 좌우 흐름
  const DARK = '#0C0A22'; const GOLD = 'rgba(212,175,110,0.45)';
  return (
    <View style={styles.seonbiLayer} pointerEvents="none">
      <Svg width={W} height={140} style={{ position: 'absolute', bottom: 0 }}>
        <Defs>
          {/* 근경(가까운 산) 수묵 — 능선(위) 진하고 아래로 더 어두워지는 먹빛 */}
          <LinearGradient id="ink-near" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0E0B26" stopOpacity="0.99" /><Stop offset="1" stopColor="#070512" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* 달(옅은 보름) + 은은한 무리 — 산 너머 */}
        <Circle cx={W * 0.78} cy={30} r={17} fill="rgba(231,222,196,0.05)" />
        <Circle cx={W * 0.78} cy={30} r={10.5} fill="rgba(231,222,196,0.15)" />
        {/* 원경(먼 산) — 옅은 라벤더 안개(수묵 농담 '담') */}
        <Path d={`M0,140 L0,50 Q${W * 0.16},30 ${W * 0.34},46 Q${W * 0.5},60 ${W * 0.66},34 Q${W * 0.82},22 ${W},40 L${W},140 Z`} fill="rgba(120,112,165,0.20)" />
        <Path d={`M0,50 Q${W * 0.16},30 ${W * 0.34},46 Q${W * 0.5},60 ${W * 0.66},34 Q${W * 0.82},22 ${W},40`} stroke="rgba(150,142,195,0.22)" strokeWidth={1} fill="none" />
        {/* 중경(중간 산) — '중' 농담 */}
        <Path d={`M0,140 L0,64 Q${W * 0.2},46 ${W * 0.4},62 Q${W * 0.58},74 ${W * 0.76},50 Q${W * 0.88},40 ${W},56 L${W},140 Z`} fill="rgba(40,36,82,0.78)" />
        <Path d={`M0,64 Q${W * 0.2},46 ${W * 0.4},62 Q${W * 0.58},74 ${W * 0.76},50 Q${W * 0.88},40 ${W},56`} stroke="rgba(120,110,170,0.16)" strokeWidth={1} fill="none" />
        {/* 근경(가까운 산) — 가장 진한 '농' + 금장 윤곽. 완만·높게 = 선비(bottom 58) 발이 능선에 닿음 */}
        <Path d={`M0,140 L0,76 Q${W * 0.18},64 ${W * 0.36},74 Q${W * 0.52},80 ${W * 0.66},62 Q${W * 0.82},72 ${W},66 L${W},140 Z`} fill="url(#ink-near)" />
        <Path d={`M0,76 Q${W * 0.18},64 ${W * 0.36},74 Q${W * 0.52},80 ${W * 0.66},62 Q${W * 0.82},72 ${W},66`} stroke={GOLD} strokeWidth={1} fill="none" />
      </Svg>
      {/* 운무 띠 — 중경·근경 사이 옅은 가로 안개(살짝 좌우로 흐름) */}
      <Animated.View style={{ position: 'absolute', bottom: 62, left: 0, right: 0, transform: [{ translateX: mistX }] }} pointerEvents="none">
        <Svg width={W} height={28}>
          <Ellipse cx={W * 0.3} cy={16} rx={W * 0.36} ry={6.5} fill="rgba(173,164,200,0.06)" />
          <Ellipse cx={W * 0.74} cy={11} rx={W * 0.3} ry={5} fill="rgba(173,164,200,0.05)" />
        </Svg>
      </Animated.View>
      {/* 걷는 선비(갓 + 도포 + 지팡이) — 근경 능선 위 */}
      <Animated.View style={{ position: 'absolute', bottom: 58, transform: [{ translateX: tx }, { translateY: ty }] }}>
        <Svg width={42} height={64} viewBox="0 0 42 64">
          <Ellipse cx={21} cy={14} rx={15} ry={3.4} fill={DARK} stroke={GOLD} strokeWidth={0.6} />{/* 갓 챙 */}
          <Path d="M15,14 Q15,6.5 21,6.5 Q27,6.5 27,14 Z" fill={DARK} stroke={GOLD} strokeWidth={0.6} />{/* 갓 대우 */}
          <Circle cx={21} cy={18.5} r={3.3} fill={DARK} />{/* 머리 */}
          <Path d="M16,21.5 L26,21.5 L29,53 L13,53 Z" fill={DARK} stroke={GOLD} strokeWidth={0.6} />{/* 두루마기 */}
          <Path d="M26,23.5 L29,24.5 L28,33 L25,30.5 Z" fill={DARK} />{/* 소맷자락 */}
          <Line x1={29} y1={25} x2={34} y2={55} stroke={GOLD} strokeWidth={1.3} />{/* 지팡이 */}
        </Svg>
      </Animated.View>
    </View>
  );
}

// 홈 배경 합성 — 테마에 맞춰 별(다크)/태양(라이트) + 공통 선비 오버레이를 한 번에 렌더.
export function HomeBackdrop() {
  return (<>{activeScheme === 'light' ? <SunGlow /> : <TwinklingStars />}<SeonbiWalk /></>);
}

// 위 세 함수가 참조하는 스타일 — index.tsx에서 이동(전용 키). colors.ju/radius.pill 의존.
const styles = StyleSheet.create({
  seonbiLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 }, // 산길 걷는 선비 + 능선(배경 하단·daniel)
  star: { position: 'absolute', color: colors.ju, fontSize: 16 },
  // 라이트 태양(우측 상단) — 본체·글로우·회전 광선(daniel)
  sunWrap: { position: 'absolute', top: '7%', right: '11%', width: 130, height: 130, alignItems: 'center', justifyContent: 'center' },
  sunRays: { position: 'absolute', width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  sunRay: { position: 'absolute', width: 2, height: 150, backgroundColor: 'rgba(200,161,74,0.16)', borderRadius: 1 },
  sunGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(224,178,74,0.5)' },
  sunCore: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E0B24A' },
  shootingStar: {
    position: 'absolute', width: 100, height: 2,
    backgroundColor: colors.ju, borderRadius: radius.pill,
    shadowColor: colors.ju, shadowOpacity: 0.8, shadowRadius: 4, elevation: 5,
  },
});
