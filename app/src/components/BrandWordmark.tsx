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
import { View, Text, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import { colors, space } from '../lib/theme';

// 심볼 — 파비콘과 **같은 원본**에서 뽑은 투명 「운」(배경 네모가 없다).
//   ⚠️여기서만 가져다 쓴다. 다른 화면이 각자 이미지를 불러오기 시작하면 다시 세 갈래가 된다.
const SYMBOL = require('../../assets/brand-symbol.png');

/**
 * 브랜드 워드마크.
 *
 * @param size   글자 크기(기본 21 — 콘티 헤더 기준). 큰 자리에서는 키워 쓴다.
 * @param style  자리잡기용 덧붙임(`flex:1` 등). ★색·굵기를 여기서 덮지 말 것 —
 *               덮는 순간 다시 세 갈래가 된다(그래서 이 컴포넌트가 생겼다).
 * @param symbol 글자 **왼쪽에 심볼**을 붙인다 (Boss 2026-08-26
 *               *"웹 제일 왼쪽에 니운내운 왼쪽에 로고가 들어가면 좋겠어"*).
 *               ★기본은 false — 콘티 네 면은 글자만이고, 좁은 헤더에 심볼을 넣으면 이름이 잘린다.
 *                 넓은 자리(웹 사이드바)에서만 켠다.
 *               ⚠️심볼 크기는 글자에 **비례**시킨다. 고정 px 로 두면 글자 배율을 키웠을 때
 *                 심볼만 작게 남아 «따로 노는» 모양이 된다([[ui-font-scale-lineheight]] 와 같은 종류).
 */
export function BrandWordmark({ size = 21, style, symbol = false }: { size?: number; style?: TextStyle & ViewStyle; symbol?: boolean }) {
  // ★앱 이름도 **언어를 탄다**(Boss 2026-08-27 *"앱 이름 니운내운도 번역이 돼야해"*).
  //   종전엔 워드마크에 한글이 박혀 있어, 영어로 골라도 여기만 한국어였다.
  const { t } = useTranslation();
  const word = (
    <Text
      style={[styles.tx, { fontSize: size, lineHeight: Math.round(size * 1.33) }, symbol ? undefined : style]}
      // 낭독기에는 브랜드 이름 하나로 읽힌다(글자를 쪼개 읽지 않게)
      accessibilityRole="header"
    >
      {t('appName')}
    </Text>
  );
  if (!symbol) return word;
  const px = Math.round(size * 1.25);   // 글자보다 살짝 크게 — 대문자 없는 한글 옆에서 눈높이가 맞는다
  return (
    <View style={[styles.row, style as ViewStyle]}>
      {/* 낭독기에는 글자만 읽히면 된다 — 심볼은 같은 이름을 한 번 더 말할 뿐이다 */}
      <ExpoImage source={SYMBOL} style={{ width: px, height: px }} contentFit="contain" accessibilityElementsHidden importantForAccessibility="no" />
      {word}
    </View>
  );
}

const styles = StyleSheet.create({
  // 콘티: 보라 · 아주 굵게 · 자간 살짝 좁게
  tx: { color: colors.ju, fontWeight: '900', letterSpacing: -0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
