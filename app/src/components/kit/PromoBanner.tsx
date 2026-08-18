// app/src/components/kit/PromoBanner.tsx — 시안 '오늘의 추천' 큰 배너
// ═══════════════════════════════════════════════════════════════════════════
// 시안 `니운내운.pdf` 실측 사양(p04 水 · p13 土 · p21 木 · p29 火 · p37 金 — 다섯 장 대조):
//   · 배경   = 가로형 일러스트 한 장(오행 계열 파스텔). 그림은 **오른쪽**, 왼쪽은 비어 있다
//   · 좌상단 = 반투명 칩(「오늘의 추천」)
//   · 본문   = 아주 굵은 제목 3줄 → 옅은 부제 2줄 → **알약 버튼**
//   · 아래   = 캐러셀 점(여러 장일 때만)
//
// ■ 시안과 **다르게 간 곳 하나** — 글자색
//   시안은 水·木·火·金 배너에 흰 글자를 얹는다. 그 대비를 실제로 계산해 보니 **2.04~2.32** 였다
//   (큰 글자 기준 3.0 에도 못 미친다). 다섯 중 유일하게 통과한 건 **먹 글자를 쓴 土(9.54)** 다.
//   이 프로젝트는 색을 눈으로 고르지 않는다 — `check:elementtheme` 가 대비를 계산해
//   水의 `inkFaint` 를 한 번 고치게 만든 전례가 있다. 그래서 **土 쪽(먹 글자)으로 통일**했다.
//
// ■ 그래서 스크림이 필요하다
//   그림의 왼쪽이 늘 밝지는 않다. 13장의 글자 영역 최암부를 재 보니
//   `pen` 1.1 · `compass` 1.6 · `forest` 3.0 으로 **먹 글자가 묻힌다**.
//   ⇒ 왼쪽에 카드색(거의 흰색) 스크림을 깔고 그 위에 글자를 올린다. 그러면 어떤 그림이 와도
//     대비는 `ink` vs `card` 로 **고정**된다(이미 `check:elementtheme` 가 검증하는 조합).
//   ⚠️이 스크림을 지우면 세 장이 곧바로 안 읽힌다 — `check:bannerart` 가 지운 것을 잡는다.
//
// ■ 색의 무게중심은 **알약 버튼**이 진다
//   시안은 색면으로 눌러 무게를 만들지만 우리는 밝은 그림을 그대로 살린다.
//   대신 CTA 를 `ju` 로 꽉 채워 화면에서 한 점이 확실히 진하게 남는다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';
import { useHeroCap, HERO_CAP } from '../../lib/ui/heroSize';

/** 글자가 앉는 폭 — 스크림도 본문도 이 값을 쓴다(둘이 어긋나면 글자가 스크림 밖으로 나간다). */
const TEXT_ZONE = '62%';

export type PromoSlide = {
  /** 좌상단 칩(예: `오늘의 추천`) */
  kicker: string;
  /** 굵은 제목 — 줄바꿈은 `\n` 으로 직접 넣는다(시안이 3줄로 끊어 읽힌다) */
  title: string;
  /** 부제 2줄 */
  sub?: string;
  /** 알약 버튼 문구 */
  cta: string;
  /** 배경 일러스트(`bannerArtFor()`). 없으면 색면만 남는다 */
  image?: ImageSourcePropType;
  onPress: () => void;
};

/**
 * 추천 배너 한 장.
 *
 * @param slide 지금 보여줄 한 장
 * @param count 전체 장수(2 이상일 때만 점을 그린다)
 * @param index 현재 장 번호(0부터)
 *
 * ★캐러셀(스와이프·자동회전)은 여기서 하지 않는다 — `HouseAdBanner` 가 한다.
 *   '한 장이 어떻게 생겼나'와 '여러 장을 어떻게 넘기나'를 갈라 둬야 둘 중 하나만 고칠 수 있다.
 */
export function PromoBanner({ slide, count = 1, index = 0 }: { slide: PromoSlide; count?: number; index?: number }) {
  const cap = useHeroCap(HERO_CAP.banner);   // 넓은 웹에서 배너가 화면을 다 먹지 않게
  return (
    <View>
      <PressableScale style={cap ? [styles.card, cap] : styles.card} onPress={slide.onPress}>
        {slide.image ? (
          // 그림은 오른쪽이 주인공이다 — 배너가 원본보다 납작해도 오른쪽은 잘리지 않게 고정한다
          <ExpoImage
            source={slide.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="right"
            cachePolicy="memory-disk"
            transition={160}
          />
        ) : null}

        {/* 글자 자리를 밝게 눌러 준다 — 어떤 그림이 와도 먹 글자가 읽히도록(위 주석 참조) */}
        <LinearGradient
          colors={[colors.card, colors.card, `${colors.card}00`]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, styles.scrim]}
          pointerEvents="none"
        />

        <View style={styles.body}>
          <View style={styles.kicker}><Text style={styles.kickerTx}>{slide.kicker}</Text></View>
          <Text style={styles.title}>{slide.title}</Text>
          {slide.sub ? <Text style={styles.sub}>{slide.sub}</Text> : null}
          <View style={styles.cta}><Text style={styles.ctaTx}>{slide.cta} ›</Text></View>
        </View>
      </PressableScale>

      {count > 1 ? (
        <View style={styles.dots}>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden',
    minHeight: 220, justifyContent: 'center', marginBottom: space(2),
  },
  // ★스크림은 **글자 폭보다 넓게** 끝난다(62% 에서 투명) — 글자 끝과 그림이 맞닿지 않게
  scrim: { right: undefined, width: '86%' },
  body: { paddingVertical: space(6), paddingHorizontal: space(5), maxWidth: TEXT_ZONE },
  kicker: {
    alignSelf: 'flex-start', backgroundColor: colors.juSoft,
    borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(1.25), marginBottom: space(3),
  },
  kickerTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  title: { fontSize: 26, lineHeight: 35, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(2.5), lineHeight: 21 },
  // 화면에서 가장 진한 한 점 — 밝은 배너에 무게를 준다
  cta: {
    alignSelf: 'flex-start', marginTop: space(4), backgroundColor: colors.ju,
    borderRadius: radius.pill, paddingHorizontal: space(4.5), paddingVertical: space(2.5),
  },
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space(1.5), marginBottom: space(3) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.juLine },
  dotOn: { width: 16, backgroundColor: colors.ju },
});
