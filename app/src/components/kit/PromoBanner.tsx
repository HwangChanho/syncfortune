// app/src/components/kit/PromoBanner.tsx — 시안 '오늘의 추천' 큰 배너
// ═══════════════════════════════════════════════════════════════════════════
// 시안 실측(p04 水 · p13 土 · p21 木 · p29 火 · p37 金 — 다섯 장 대조):
//   · 배경 = 색면 한 장, 그 위 **오른쪽**에 일러스트. 왼쪽은 비어 글자가 앉는다
//   · 좌상단 = 반투명 칩(「오늘의 추천」) · 본문 = 굵은 제목 3줄 → 부제 2줄 → 알약 버튼
//
// ■ 색면과 그림을 **같은 색**으로 이어 붙인다
//   그림은 알파가 없는 JPEG 다. 배너 배경이 다르면 그림 자리에 밝은 사각형이 뜬다.
//   ⇒ 배경을 그 그림의 **바탕색**(`BANNER_FIELD`)으로 칠하면 이음매가 사라져 한 장으로 보인다.
//     시안 p13(土)이 정확히 그 모양이다 — 밝은 피치 면에 문 그림이 얹혀 있다.
//   ⇒ 그림은 `contain` 이다. `cover` 로 하면 **확대돼 잘려** 무슨 그림인지 알 수 없다
//     (2026-08-18 시뮬 실측: 달·호수 그림이 산봉우리 한 조각만 보였다).
//
// ■ 글자색 — 시안과 다르게 갔다(재 보고)
//   시안은 水·木·火·金 배너에 흰 글자를 얹는다. 대비를 계산하니 **2.04~2.32** 로
//   큰 글자 기준(3.0)에도 못 미친다. 다섯 중 통과한 건 **먹 글자를 쓴 土(9.54)** 뿐이라
//   그쪽(시안 안에 이미 있던 변형)으로 통일했다.
//   글자가 앉는 왼쪽 면은 그림의 바탕색 그대로라 대비가 **7.5~13.6** 으로 나온다
//   (`check:bannerart` 가 그림 파일을 다시 읽어 계산한다).
//
// ■ 제목은 짧게 끊는다
//   `\n` 으로 끊어도 폭이 모자라면 **또 접힌다**. 실제로 「내 재물 그릇은 / 얼마나 클까요?」가
//   「내 재물 그릇 / 은 / 얼마나 클까 / 요?」 넉 줄로 깨졌다(시뮬 실측).
//   ⇒ 한 줄 8자 이내로 쓰고, 글자 크기·글자 자리 폭을 그 기준으로 맞췄다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';
import { useHeroCap, HERO_CAP } from '../../lib/ui/heroSize';

// 글자 자리 폭. ★눈대중이 아니라 계산이다 —
//   402pt 폰에서 카드폭 370pt(좌우 페이지 여백 16씩) × 58% − 좌우 패딩 32 = **183pt**.
//   제목 한 줄 최대 8자 × 21pt = 168pt 가 그 안에 들어간다(여유 15pt).
//   ⚠️이 셋(폭·글자크기·한 줄 글자수) 중 하나만 바꾸면 줄이 또 깨진다 — 같이 본다.
const TEXT_ZONE = '58%';
const ART_ZONE = '42%';

/** 오행 막의 세기. ★`check:bannerart` 가 이 값으로 대비를 다시 계산한다 — 올리면 하네스가 막는다. */
export const BANNER_TINT = 0.22;

export type PromoSlide = {
  /** 좌상단 칩(예: `오늘의 추천`) */
  kicker: string;
  /** 굵은 제목 — 줄바꿈은 `\n` 으로 직접 넣는다(시안이 3줄로 끊어 읽힌다) */
  title: string;
  /** 부제 2줄 */
  sub?: string;
  /** 알약 버튼 문구 */
  cta: string;
  /** 배경 일러스트(`bannerArtFor().image`). 없으면 색면만 남는다 */
  image?: ImageSourcePropType;
  /** 그 그림의 바탕색(`bannerArtFor().field`) — 배너 색면을 이 색으로 칠해 이음매를 없앤다 */
  field?: string;
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
      <PressableScale
        style={cap ? [styles.card, cap, { backgroundColor: slide.field ?? colors.juSoft }]
                   : [styles.card, { backgroundColor: slide.field ?? colors.juSoft }]}
        onPress={slide.onPress}
      >
        {slide.image ? (
          // 오른쪽 46% 에 **통째로** 보이게(contain). 위아래 남는 자리는 색면과 같은 색이라 안 보인다
          <ExpoImage
            source={slide.image}
            style={styles.art}
            contentFit="contain"
            contentPosition="right center"
            cachePolicy="memory-disk"
            transition={160}
          />
        ) : null}

        {/* 오행 막 — 색면과 그림을 **함께** 덮어 배너를 그 테마 쪽으로 당긴다.
            ⚠️둘 다 덮어야 한다. 색면만 덮으면 이음매가 다시 생긴다.
            ★세기 0.22 는 고른 게 아니라 **계산한 값**이다 — 열 장 × 다섯 오행에서
              글자영역 최암부의 먹 대비 최저가 4.77(본문 기준 4.5) 이 되는 지점.
              0.30 까지 올리면 4.40 으로 떨어진다(水·金 moonlake 가 먼저 걸린다). */}
        <View style={styles.tint} pointerEvents="none" />

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
  // 시안 배너 비율 = 폭의 약 68%(실측 418/616). 폰에서 약 270pt.
  card: { borderRadius: radius.lg, overflow: 'hidden', minHeight: 250, justifyContent: 'center', marginBottom: space(2) },
  // 그림은 오른쪽 42%. 글자 자리(58%)와 겹치지 않는다
  art: { position: 'absolute', right: 0, top: 0, bottom: 0, width: ART_ZONE },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ju, opacity: BANNER_TINT },
  body: { paddingVertical: space(5), paddingHorizontal: space(4), width: TEXT_ZONE },
  kicker: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(1.25), marginBottom: space(3),
  },
  kickerTx: { ...font.caption, color: colors.ink, fontWeight: '800' },
  // ★21pt — 한 줄 8자가 글자 자리에 들어가는 크기(위 TEXT_ZONE 계산). 더 키우면 줄이 또 접힌다
  title: { fontSize: 21, lineHeight: 29, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(2), lineHeight: 19 },
  // 화면에서 가장 진한 한 점 — 밝은 색면에 무게를 준다
  cta: {
    alignSelf: 'flex-start', marginTop: space(3.5), backgroundColor: colors.ju,
    borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2.25),
  },
  ctaTx: { ...font.caption, color: colors.onJu, fontWeight: '900' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space(1.5), marginBottom: space(3) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.juLine },
  dotOn: { width: 16, backgroundColor: colors.ju },
});
