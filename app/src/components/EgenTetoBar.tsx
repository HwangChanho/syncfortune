// app/src/components/EgenTetoBar.tsx — 에겐↔테토 게이지(단일 출처)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-04: "여긴 에겐테토 색상이 왜 홈이랑 달라?
//                     내가 말하는 부분 겹치는 거 전부 다 찾아서 동일하게 수정하라고"
//
// ■ 왜 같은 게이지가 달라 보였나 (실측)
//   같은 막대를 **세 곳이 각자 구현**하고 있었다:
//     · SelfUnderstandingHero.tsx (홈)  — 빨강→파랑 그라디언트 + 점
//     · egenteto.tsx              — 빨강→파랑 그라디언트 + 점
//     · selfanalysis.tsx          — **파란 단색 채움**(주석엔 "egenteto.tsx EgenBar 동일 톤"이라 적혀 있었다)
//   주석이 '같다'고 말하는 것은 같음을 **보장하지 않는다.** 한 곳을 고쳐도 나머지는 안 따라온다.
//
// ⇒ 막대를 여기 하나로 모은다. 앞으로 색·애니메이션을 바꾸면 세 화면이 자동으로 함께 바뀐다.
//
// ■ 색의 의미(daniel 2026-08-01 지시 — 홈 구현이 정본)
//   바 자체를 **왼쪽 에겐(빨강) → 오른쪽 테토(파랑)** 그라디언트로 둔다.
//   채움만 색을 주면 '내 위치'는 보여도 **축의 양 끝이 무엇인지**가 안 읽힌다.
//   점(dot)은 내 점수 위치에 서고, 우세한 쪽 색을 띤다.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

export const EGEN_C = '#D14343';   // 에겐 = 붉은색
export const TETO_C = '#2F6BD8';   // 테토 = 푸른색

/**
 * 에겐↔테토 성향 막대.
 * @param score 0(에겐 극) ~ 100(테토 극). 50 이상이면 점이 테토색.
 * @param height 막대 두께(기본 10). 화면마다 밀도가 달라 이것만 조절한다.
 * ⚠️색·그라디언트 방향은 인자로 열지 않는다 — 열면 다시 화면마다 달라진다(이 파일이 생긴 이유).
 */
export function EgenTetoBar({ score, height = 10 }: { score: number; height?: number }) {
  const side = score >= 50 ? TETO_C : EGEN_C;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: score, duration: 950, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, score]);
  const w = a.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const dot = Math.round(height * 1.8);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      {/* 축 전체를 빨강→파랑으로. 내 점수와 무관하게 항상 같은 그라디언트(축의 의미를 색으로 고정) */}
      <LinearGradient colors={[EGEN_C, TETO_C]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          styles.dot,
          { left: w, backgroundColor: side, width: dot, height: dot, borderRadius: dot / 2, marginTop: -(dot - height) / 2, marginLeft: -dot / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // ★flex:1 이어야 한다(daniel 2026-08-05 IMG_8381 "선이 왜이래" — 홈에서 막대가 '테토' 라벨을
  //   화면 밖으로 밀어냈다). 세 사용처 모두 [에겐|막대|테토] 가로 행인데, width:'100%' 는 row 에서
  //   **줄어들지 않아** 부모 폭 전체를 먹는다. 통일 전 히어로 구현이 flex:1 이었던 이유.
  track: { flex: 1, minWidth: 0, marginHorizontal: 10, backgroundColor: colors.sunk, overflow: 'visible', justifyContent: 'center' },
  dot: { position: 'absolute', borderWidth: 2, borderColor: colors.card },
});

export default EgenTetoBar;
