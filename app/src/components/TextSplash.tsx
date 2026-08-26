// app/src/components/TextSplash.tsx — 앱 인트로 스플래시 (시안 `니운내운.pdf` p01)
// ═══════════════════════════════════════════════════════════════════════════
// 설정에서 로딩 영상을 끄면 인트로 영상 대신 이 화면을 1회 보여준다(daniel 07-15).
//   페이드 인 → 짧게 유지 → 페이드 아웃 → onDone. 탭하면 즉시 스킵.
//
// ■ 2026-08-18 시안 반영 — 미드나잇에서 **오행 배경**으로
//   종전엔 `#0B0A1A` 고정 + 골드 워드마크였다. 시안 p01 은 밝은 바탕에 부드러운 곡면이고,
//   무엇보다 이 앱의 색은 이제 **대표 명식 오행을 따라간다** — 첫 화면만 고정색이면 그 다음 화면에서 튄다.
//   ⇒ `colors` 토큰만 쓴다. 오행이 바뀌면 스플래시도 같이 바뀐다.
//   ⚠️영상 스플래시(VideoSplash)와 배경색을 맞추던 주석은 걷어냈다 — 두 모드는 **배타적**이라
//     동시에 뜨지 않는다(loadingMode: video / text / off). 맞출 대상이 애초에 없었다.
//
// ■ 「운」 심볼 (Boss 제공 · 2026-08-18)
//   워드마크로 자리만 지키던 것을 **실제 로고**로 교체했다. 원본은 흰 여백이 큰 캔버스라
//   심볼만 잘라 `brand/mark.png` 로 Storage 에 올렸다(그리는 쪽은 `A()` 로 받는다).
//   ★태그라인의 '다섯 기운'은 **오행 5색 점**으로 그대로 둔다 —
//     풀이 히어로의 아치와 같은 언어라 첫 화면부터 이어진다.
//
// ★버튼은 두지 않는다. 시안 p01 에는 [시작하기]가 있지만, 우리는 이 뒤에 **온보딩**(App Store 4.3 대응)이
//   바로 오고 거기 CTA 가 있다. 버튼이 둘이면 무엇을 눌러야 하는지 흐려진다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { A } from '../lib/ui/remoteAsset';
import { colors, space, font } from '../lib/theme';
import { elementColor } from '../lib/engine/ohaeng';

/** 태그라인 아래 오행 점 — 상생 순서 고정(풀이 히어로와 같은 배열). */
const EL = ['木', '火', '土', '金', '水'] as const;

export function TextSplash({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current; // 0=투명 → 페이드 인/아웃 공용
  const doneRef = useRef(false);                       // 종료 1회 보장(타임아웃·탭 중복 방지)

  // 페이드 아웃 후 종료(1회만).
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    // 페이드 인 → 약 1.6초 뒤 종료(영상보다 짧게 — 단순 텍스트 스플래시).
    Animated.timing(fade, { toValue: 1, duration: 500, easing: undefined, useNativeDriver: true }).start();
    const timer = setTimeout(finish, 1600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { opacity: fade }]}>
      {/* 곡면 장식 — 시안 p01 의 좌상·우하 부드러운 면. 탭을 막지 않는다.
          ⚠️`preserveAspectRatio="none"` 이면 넓은 화면에서 곡면이 **화면 절반**을 덮는다(웹 실측) → slice */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid slice">
        <Path d="M0 0 H62 C40 26, 26 44, 0 52 Z" fill={colors.juSoft} opacity={0.9} />
        <Path d="M100 200 H38 C60 174, 74 156, 100 148 Z" fill={colors.juSoft} opacity={0.9} />
      </Svg>

      {/* 탭하면 스킵 */}
      <Pressable style={[StyleSheet.absoluteFill, styles.center]} onPress={finish}>
        {/* ★브랜드 표식 = **앱 이름**(Boss 2026-08-15 "앱 스플래시도 니운내운으로 바꿔").
            07-15 에 고른 `八字` 는 앱 이름이 '팔자'이던 시절의 표식이다.
            ⚠️`八字` 자체는 지우지 않는다 — 브랜드이기도 하지만 **명리 용어**이기도 하다.
              바꾸는 건 '브랜드 표식으로 쓰이던 자리'뿐이다([[app-rename-wooni]] 일괄치환 금지). */}
        {/* 「운」 심볼 — 로고가 먼저 뜨고 그 아래 앱 이름이 온다(시안 p01 구도) */}
        <ExpoImage source={A('brand/mark.png')} style={styles.mark} contentFit="contain" transition={200} />

        {/* 시안 p01 — 「니**운**.내**운**」에서 '운' 두 글자만 강조색이다. 앱 이름이 곧 그 글자다. */}
        <Text style={styles.wordmark}>
          니<Text style={styles.accent}>운</Text><Text style={styles.dot}>.</Text>내<Text style={styles.accent}>운</Text>
        </Text>

        <View style={styles.dots}>
          {EL.map((e) => <View key={e} style={[styles.el, { backgroundColor: elementColor[e] }]} />)}
        </View>

        {/* ⚠️★외국인이 앱을 켜면 **가장 먼저 보는 글자**다. 여기가 한국어면 그 사람에게 앱은 한국 앱이다.
            (2026-08-27: 실제로 English 로 바꿔도 여기만 한국어로 남아 있었다 —
             태그 사이 맨 글자라 문자열 검사에 안 걸렸다.) */}
        <Text style={styles.tagline}>{t('splash.tagline', '다섯 기운이 이어\n오늘의 나를 읽다')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  // 한글 4자는 한자 2자보다 길다 — 같은 크기로 두면 좁은 화면에서 넘친다
  mark: { width: 132, height: 132, marginBottom: space(4) },
  wordmark: { fontSize: 38, fontWeight: '900', color: colors.ink, letterSpacing: 2 },
  accent: { color: colors.ju },
  dot: { color: colors.inkFaint },                    // 가운데 점은 눌러 두어 두 낱말이 갈려 읽히게
  dots: { flexDirection: 'row', gap: space(2), marginTop: space(6) },
  el: { width: 9, height: 9, borderRadius: 5 },
  tagline: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(5), lineHeight: 24 },
});
