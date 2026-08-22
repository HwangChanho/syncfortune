// app/src/components/BrandWordmark.tsx — 「니운내운」 워드마크 (단일 출처)
// ═══════════════════════════════════════════════════════════════════════════
// ■ ⚠️★왜 컴포넌트가 됐나 (2026-08-22 · Boss *"상단 로고 왜저래"*)
//   워드마크가 **세 곳에서 제각각**이었다:
//     · 웹 사이드바 = 글자(먹색 21px/800)
//     · 마이페이지 = 글자(보라 21px/900)
//     · 홈 헤더    = **이미지** `brand/v3/wordmark.png`
//   그리고 홈의 그 이미지가 깨져 보였다 — 자산은 **340×470 세로형**(심볼 위·글자 아래)인데
//   스타일 박스가 `108×34` 가로형이라, `contentFit="contain"` 이 34px 높이에 맞추면서
//   **폭 25px** 짜리 콩알로 줄어들었다(계산: 34 × 340/470 ≈ 24.6).
//   ★비율이 안 맞는 그림은 **깨져 보이지 않고 작아 보인다** — 그래서 눈에 잘 안 띈다.
//
// ■ 무엇으로 통일했나
//   콘티(2026-08-21) 네 면의 헤더는 전부 **좌측 보라 글자 워드마크**다. 심볼이 없다.
//   ⇒ 글자로 통일한다. 심볼은 앱 아이콘이 이미 지고 있다.
//   ⚠️세로형 이미지 자산(`brandWordmark()`)은 지우지 않았다 — 스플래시 등 **세로 자리**가 따로 있다.
//     다만 **헤더에는 쓰지 않는다**.
// ═══════════════════════════════════════════════════════════════════════════
import { Text, StyleSheet, type TextStyle } from 'react-native';
import { colors } from '../lib/theme';

/**
 * 브랜드 워드마크.
 *
 * @param size  글자 크기(기본 21 — 콘티 헤더 기준). 큰 자리에서는 키워 쓴다.
 * @param style 자리잡기용 덧붙임(`flex:1` 등). ★색·굵기를 여기서 덮지 말 것 —
 *              덮는 순간 다시 세 갈래가 된다(그래서 이 컴포넌트가 생겼다).
 */
export function BrandWordmark({ size = 21, style }: { size?: number; style?: TextStyle }) {
  return (
    <Text
      style={[styles.tx, { fontSize: size, lineHeight: Math.round(size * 1.33) }, style]}
      // 낭독기에는 브랜드 이름 하나로 읽힌다(글자를 쪼개 읽지 않게)
      accessibilityRole="header"
    >
      니운내운
    </Text>
  );
}

const styles = StyleSheet.create({
  // 콘티: 보라 · 아주 굵게 · 자간 살짝 좁게
  tx: { color: colors.ju, fontWeight: '900', letterSpacing: -0.5 },
});
