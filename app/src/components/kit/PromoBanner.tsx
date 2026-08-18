// app/src/components/kit/PromoBanner.tsx — 시안 '오늘의 추천' 큰 배너
// ═══════════════════════════════════════════════════════════════════════════
// 시안 `니운내운.pdf` p04(홈) 실측 사양:
//   · 배경 = **중간 톤 오행색**(배경보다 진하고 강조색보다 옅다) · 큰 라운드
//   · 좌상단 : 반투명 밝은 칩(「오늘의 추천」)
//   · 본문   : 아주 굵은 흰 제목 3줄 → 옅은 흰 부제 2줄 → **흰 알약 버튼**
//   · 우측   : 일러스트(투명 배경 PNG) — 없으면 그 자리는 그냥 비운다
//   · 아래   : 캐러셀 점(여러 장일 때만)
//
// ★왜 '중간 톤'인가 — 흰 카드(ScoreCard) 바로 아래 오는 자리라, 같은 흰색이면 두 카드가 붙어 보인다.
//   시안은 이 배너만 색면으로 눌러 **화면의 무게중심**을 만든다.
// ⚠️흰 글자가 올라가므로 배경은 반드시 어두워야 한다 — `colors.ju` 를 쓰되 살짝 밝힌 값을 쓴다.
//   (오행마다 ju 밝기가 다르므로 여기서 임의 hex 를 만들지 않고 ju 위에 흰 막을 얹어 균일하게 맞춘다)
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';
import { useHeroCap, HERO_CAP } from '../../lib/ui/heroSize';

export type PromoSlide = {
  /** 좌상단 칩(예: `오늘의 추천`) */
  kicker: string;
  /** 굵은 제목 — 줄바꿈은 `\n` 으로 직접 넣는다(시안이 3줄로 끊어 읽힌다) */
  title: string;
  /** 부제 2줄 */
  sub?: string;
  /** 흰 알약 버튼 문구 */
  cta: string;
  /** 우측 일러스트(없으면 비운다) */
  image?: ImageSourcePropType;
  onPress: () => void;
};

/**
 * 추천 배너.
 *
 * @param slide 지금 보여줄 한 장
 * @param count 전체 장수(2 이상일 때만 점을 그린다)
 * @param index 현재 장 번호(0부터)
 */
export function PromoBanner({ slide, count = 1, index = 0 }: { slide: PromoSlide; count?: number; index?: number }) {
  const cap = useHeroCap(HERO_CAP.banner);   // 넓은 웹에서 배너가 화면을 다 먹지 않게
  return (
    <View>
      <PressableScale style={cap ? [styles.card, cap] : styles.card} onPress={slide.onPress}>
        {/* 색면 위에 흰 글자 — 배경은 강조색을 옅게 덮어 어느 오행에서도 대비가 유지되게 */}
        <View style={styles.tint} />
        {slide.image ? (
          <ExpoImage source={slide.image} style={styles.art} contentFit="contain" contentPosition="right" transition={140} />
        ) : null}
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
    backgroundColor: colors.ju, borderRadius: radius.lg, overflow: 'hidden',
    minHeight: 220, justifyContent: 'center', marginBottom: space(2),
  },
  // ★흰 막 한 겹 — 오행마다 ju 밝기가 달라도 '중간 톤'으로 수렴시킨다(임의 hex 를 만들지 않는 방법).
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.22)' },
  art: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '46%' },
  body: { paddingVertical: space(6), paddingHorizontal: space(5), paddingRight: '48%' },
  kicker: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(1.25), marginBottom: space(3),
  },
  kickerTx: { ...font.caption, color: colors.white, fontWeight: '800' },
  title: { fontSize: 26, lineHeight: 35, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  sub: { ...font.body, color: 'rgba(255,255,255,0.88)', marginTop: space(2.5), lineHeight: 21 },
  cta: {
    alignSelf: 'flex-start', marginTop: space(4), backgroundColor: colors.white,
    borderRadius: radius.pill, paddingHorizontal: space(4.5), paddingVertical: space(2.5),
  },
  ctaTx: { ...font.label, color: colors.ju, fontWeight: '900' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space(1.5), marginBottom: space(3) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.juLine },
  dotOn: { width: 16, backgroundColor: colors.ju },
});
