// app/src/components/kit/TrioCards.tsx — 시안 '무료로 체험해보세요!' 3열 카드
// ═══════════════════════════════════════════════════════════════════════════
// 시안 `니운내운.pdf` p04 실측 사양:
//   · 카드 3장이 가로로 균등 · 배경 = 배경보다 밝은 옅은 면 · 큰 라운드 · 테두리 없음
//   · 각 카드 = 제목(강조색·굵게, 위) → 일러스트(가운데) → 「보러가기 ›」 알약 버튼(아래)
//   ⇒ 제목이 **위**에 오는 게 특징이다(보통 이미지가 위에 온다). 무엇인지 먼저 읽히게 한 배치다.
//
// ★폰에서 3열이면 카드가 좁다 — 제목이 두 줄로 넘어가지 않게 짧은 말만 넣는다(자미두수·타로·점성술).
// ⚠️일러스트가 없으면 그 자리를 **비운다**(회색 네모를 그리지 않는다). 그림이 준비되는 대로 채워진다.
//
// ■ 크기·간격은 **재서 정했다**(2026-08-19 · 시안 폭 616 → 402pt 폰 축척 0.652)
//   · 카드 높이 270pt → **176pt**. 종전엔 그림 자리를 `aspectRatio:1` 로 뒀는데
//     3열이라 카드 폭이 116pt → 그림칸만 116pt 가 되어 카드가 **224pt** 로 부풀었다.
//     ⇒ 그림칸은 **고정 높이 72pt**. 카드가 시안 비율로 돌아온다.
//   · ⚠️`row` 에 **아래 여백이 없었다** — 다음 블록이 카드에 붙어 있었다(daniel 실기기 지적).
//     다른 홈 블록은 저마다 `marginBottom` 을 갖는데 여기만 빠져 있었다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';
import { useHeroCap, HERO_CAP } from '../../lib/ui/heroSize';

export type TrioItem = {
  /** 카드 제목 — 짧게(3~5자) */
  title: string;
  /** 일러스트. 없으면 그 자리는 빈다 */
  image?: ImageSourcePropType;
  /** 버튼 문구(기본 `보러가기`) */
  cta?: string;
  onPress: () => void;
};

/**
 * 3열 체험 카드.
 * @param items 카드들. 3개를 기준으로 디자인됐지만 2·4개도 균등 분할된다
 */
export function TrioCards({ items }: { items: TrioItem[] }) {
  // 넓은 웹에서 정사각 그림이 카드 폭만큼(수백 px) 자라는 것을 막는다 — 폰에서는 null(제한 없음).
  const artCap = useHeroCap(HERO_CAP.trio);
  return (
    <View style={styles.row}>
      {items.map((it, i) => (
        <PressableScale key={`${it.title}-${i}`} style={styles.card} onPress={it.onPress}>
          <Text style={styles.title} numberOfLines={1}>{it.title}</Text>
          <View style={artCap ? [styles.artBox, artCap] : styles.artBox}>
            {it.image ? <ExpoImage source={it.image} style={styles.art} contentFit="contain" transition={140} /> : null}
          </View>
          <View style={styles.cta}><Text style={styles.ctaTx}>{it.cta ?? '보러가기'} ›</Text></View>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space(2.5), marginBottom: space(5) },
  card: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    paddingVertical: space(4), paddingHorizontal: space(2.5), alignItems: 'center',
  },
  title: { ...font.heading, color: colors.ju, fontWeight: '900', textAlign: 'center' },
  // 그림 자리는 비어 있어도 높이를 유지한다 — 카드 3장의 버튼 줄이 어긋나지 않게.
  // ★고정 높이(비율 아님) — 위 ■ 참조. 폭에 매면 3열에서 카드가 세로로 부푼다.
  artBox: { width: '100%', height: 72, marginVertical: space(2.5), alignItems: 'center', justifyContent: 'center' },
  art: { width: '100%', height: '100%' },
  cta: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(2) },
  ctaTx: { ...font.caption, color: colors.onJu, fontWeight: '900' },
});
