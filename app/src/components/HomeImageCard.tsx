// app/src/components/HomeImageCard.tsx — 홈 블록 = 이미지 카드(글은 들어가서 본다)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-27: "홈을 **이미지 위주**로 보이게 하고 들어가야 글을 볼 수 있는데 반대로 되어 있잖아"
//   ★내가 먼저 만든 건 정확히 반대였다 — 제목 한 줄짜리 **텍스트 행**으로 접었다(이미지가 아예 없었다).
//     '글을 숨긴다'만 보고 '이미지 위주로 만든다'를 놓친 것. 이 파일이 그 수정이다.
//
// 구성: 큰 이미지 + 하단 그라데이션 위 제목 한 줄. 그 외 글자는 두지 않는다(설명·본문은 상세 화면에서).
//   탭 → 해당 상세 화면. 홈은 '무엇이 있는지'를 그림으로 보여 주는 자리이고, 읽는 건 들어가서 한다.
//
// ⚠️접기 전 상세 화면 존재 확인은 계속 유효하다 — 상세가 없는 블록을 접으면 콘텐츠가 도달 불가가 된다
//   (그래서 바이오리듬은 `/biorhythm` 을 먼저 만들었다).
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font, shadow } from '../lib/theme';

/**
 * @param title 카드에 보이는 유일한 글자(블록 이름)
 * @param route 탭 시 이동할 상세 화면(필수)
 * @param image require() 한 이미지 — 없으면 `visual` 로 대체
 * @param visual 이미지 대신 그릴 것(예: 개인화 일러스트 컴포넌트). image 보다 우선한다.
 */
export function HomeImageCard({ title, route, image, visual }: {
  title: string;
  route: string;
  image?: any;
  visual?: ReactNode;
}) {
  const { fs } = useFontScale();
  const router = useRouter();

  // 하단 라벨 — 이미지 위 가독성을 위해 어두운 그라데이션을 깔고 흰 글자(ContentGrid 카드와 같은 방식).
  const label = (
    <LinearGradient
      colors={['transparent', 'rgba(11,10,26,0.55)', 'rgba(11,10,26,0.92)']}
      locations={[0, 0.45, 1]}
      style={styles.labelBar}
    >
      <Text style={[styles.title, { fontSize: fs(17) }]} numberOfLines={1}>{title}</Text>
    </LinearGradient>
  );

  return (
    <PressableScale style={styles.card} onPress={() => router.push(route as any)}>
      {visual ? (
        <View style={StyleSheet.absoluteFill}>{visual}</View>
      ) : null}
      {!visual && image ? (
        <ImageBackground source={image} style={StyleSheet.absoluteFill} imageStyle={styles.img} resizeMode="cover">
          <View style={{ flex: 1 }} />
        </ImageBackground>
      ) : null}
      <View style={styles.labelWrap}>{label}</View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // 가로 꽉 찬 이미지 카드 — 홈이 '그림 목록'으로 읽히게. 높이는 너무 크지 않게(한 화면에 여러 장 보이도록).
  card: {
    height: 132, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.sunk, marginBottom: space(3),
    borderWidth: 1, borderColor: colors.juLine, ...shadow.card,
  },
  img: { borderRadius: radius.lg },
  labelWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  labelBar: { paddingTop: space(8), paddingBottom: space(3.5), paddingHorizontal: space(4) },
  title: { ...font.heading, color: '#FFFFFF', fontWeight: '900' },
});
