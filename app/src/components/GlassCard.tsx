import React, { type ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../lib/theme';

// GlassCard — 글래스모피즘 카드.
// ⚠️ expo-blur(BlurView)·expo-linear-gradient 는 *네이티브 모듈*이라, 현재 dev 빌드에 네이티브가
//    포함돼 있지 않으면 'Unimplemented component: ExpoLinearGradient' 로 화면이 깨진다(2026-06 발생).
//    → 네이티브 의존 없는 View 폴백(반투명 + 미세 테두리로 글래스 근사). 안정적.
//    ※ 블러/그라데이션 질감을 살리려면: package.json 에 이미 있는 expo-blur·expo-linear-gradient 를
//       네이티브에 포함해 dev client 재빌드(`cd app && npx expo run:ios`) 후 BlurView/LinearGradient 복원.
interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
  intensity?: number; // (폴백에서는 미사용 — 재빌드 후 BlurView 복원 시 사용)
  hasBorder?: boolean;
}

export function GlassCard({ children, style, hasBorder = true }: GlassCardProps) {
  return (
    <View style={[styles.card, hasBorder && styles.border, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,   // 반투명 인디고 — 글래스 근사
    borderRadius: radius.md,
    padding: 16,
    overflow: 'hidden',
  },
  border: {
    borderWidth: 1,
    borderColor: 'rgba(237, 231, 214, 0.15)', // ink 기반 미세 반사 테두리
  },
});
