// app/src/components/ContentBackdrop.tsx — 전 콘텐츠 화면 공통 배경 레이어
// ─────────────────────────────────────────────────────────────────────────
// ★심플 배경(daniel 2026-07-15 '뒷 배경도 심플하게') — 소프트 클레이 단색 그라운드.
//   기존 한지 텍스처 이미지 + 세피아 워시 + 상·하단 비네트 + 별/유성을 전부 제거하고,
//   깨끗한 단색(colors.bg)만 깐다. 카드가 부드러운 그림자로 '떠 보이는' 클레이 미학엔 배경이 조용할수록 좋다.
//   (app)/_layout 최하단에 한 번 깔리고, 각 화면 루트는 투명이라 전 화면이 이 단색 배경을 공유.
//   pointerEvents="none" + absoluteFill — 터치·레이아웃에 개입 안 함.
// ─────────────────────────────────────────────────────────────────────────
import { View, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

/** 전역 콘텐츠 배경 — 소프트 클레이 단색. */
export function ContentBackdrop() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} pointerEvents="none" />;
}
