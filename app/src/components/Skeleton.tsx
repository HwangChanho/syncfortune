// app/src/components/Skeleton.tsx — 로딩 스켈레톤(펄스 애니) — 무거운 화면 첫 페인트용(daniel 2026-06-28)
// ─────────────────────────────────────────────────────────────────────────
// 스피너(빙글빙글)보다 *콘텐츠 형태를 닮은* 스켈레톤이 체감 속도가 빠르다(레이아웃이 이미 자리잡은 인상).
//   [[useDeferredReady]] 와 짝 — ready=false 동안 이걸 그리고, 전환 끝나면 실제 콘텐츠로 교체.
//   · ChartSkeleton: 명식(4기둥 그리드 + 카드) 형태 / · ListSkeleton: 콘텐츠(히어로 + 카드 줄) 형태.
//   한 화면의 모든 블록은 *하나의* Animated.Value(usePulse)로 깜빡 → 네이티브 드라이버 루프 1개(가벼움).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ScrollView, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../lib/theme';

// 공유 펄스 — 밝기 0.45↔1.0 반복(opacity, useNativeDriver). 한 화면이 하나만 만들어 모든 블록에 전달.
function usePulse(): Animated.Value {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return pulse;
}

// 단일 스켈레톤 블록 — 회색 막대(펄스 opacity). pulse 주면 공유 깜빡, 없으면 정적 0.6(독립 사용).
export function SkeletonBlock({ pulse, style }: { pulse?: Animated.Value; style?: ViewStyle | ViewStyle[] }) {
  return <Animated.View style={[styles.block, style as any, pulse ? { opacity: pulse } : { opacity: 0.6 }]} />;
}

/** 명식 스켈레톤 — 제목 + 4기둥(천간/지지 칸) + 하단 카드 2개. 명식·만세력 진입 시 첫 페인트. */
export function ChartSkeleton() {
  const p = usePulse();
  return (
    <View style={styles.screen}>
      <View style={styles.wrap}>
        <SkeletonBlock pulse={p} style={{ width: '52%', height: 22, marginBottom: space(6) }} />
        {/* 4기둥 행(시·일·월·년) — 천간 칸 + 지지 칸 */}
        <View style={styles.pillars}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.pillarCol}>
              <SkeletonBlock pulse={p} style={{ width: 38, height: 12, marginBottom: space(2) }} />
              <SkeletonBlock pulse={p} style={{ width: 46, height: 50, borderRadius: radius.sm, marginBottom: space(1.5) }} />
              <SkeletonBlock pulse={p} style={{ width: 46, height: 50, borderRadius: radius.sm, marginBottom: space(2) }} />
              <SkeletonBlock pulse={p} style={{ width: 38, height: 12 }} />
            </View>
          ))}
        </View>
        {[0, 1].map((i) => <SkeletonBlock key={i} pulse={p} style={styles.card} />)}
      </View>
    </View>
  );
}

/** 리스트/콘텐츠 스켈레톤 — 히어로 배너 + 제목 + 카드 줄들. 일주론·심층 콘텐츠 진입 시 첫 페인트. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  const p = usePulse();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} scrollEnabled={false}>
      <SkeletonBlock pulse={p} style={styles.hero} />
      <SkeletonBlock pulse={p} style={{ width: '68%', height: 18, marginBottom: space(5) }} />
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.listCard}>
          <SkeletonBlock pulse={p} style={{ width: '42%', height: 15, marginBottom: space(3) }} />
          <SkeletonBlock pulse={p} style={{ width: '100%', height: 11, marginBottom: space(1.5) }} />
          <SkeletonBlock pulse={p} style={{ width: '88%', height: 11 }} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: space(6) },
  block: { backgroundColor: colors.card, borderRadius: radius.sm },
  pillars: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: space(6) },
  pillarCol: { alignItems: 'center' },
  card: { width: '100%', height: 92, borderRadius: radius.md, marginBottom: space(3) },
  hero: { width: '100%', height: 168, borderRadius: radius.lg, marginBottom: space(5) },
  listCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(3) },
});
