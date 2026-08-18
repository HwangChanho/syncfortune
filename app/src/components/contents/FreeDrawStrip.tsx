// app/src/components/contents/FreeDrawStrip.tsx — 운세 탭 「무료 타로 한 장 뽑기」 (시안 p05)
// ═══════════════════════════════════════════════════════════════════════════
// 시안 p05·p14·p22·p30·p38 실측: 카테고리 줄 아래, 콘텐츠 카드 위에 놓인 **색면 띠**.
//   제목 「무료 타로 한 장 뽑기」 · 부제 「오늘의 운을 카드 한장으로 확인해보세요.」 · 「시작하기」 알약.
//
// ■ 왜 이 자리에 두나 (daniel 2026-08-06 비유를 그대로 따른다)
//   *"홈 배너 = 백화점 밖 사람을 금액 없이 들어오게 / 풀이탭 = 매장 안.
//     매장에 들어온 사람에게 처음 내미는 것도 **무료**여야 한다"*
//   이달의 운세·다음 단계에 이어 **결제가 필요 없는 손잡이**를 하나 더 놓는 자리다.
//   타로는 무제한 무료(온디바이스)라 여기에 정확히 맞는다.
//
// ■ 시안과 다르게 간 곳
//   시안은 이 띠가 히어로만큼 크다. 우리 운세 탭엔 이미 히어로가 둘(이달의운세·다음단계) 있어서
//   그 크기로 넣으면 **셋이 서로 밀어낸다**. ⇒ 높이를 줄인 **띠**로 넣는다(같은 색면·같은 알약).
//
// ⚠️`juSoft` 위에 `ju` 글자다 — 이 조합은 `check:elementtheme` 가 다섯 오행 전부 대비를 계산한다.
//   임의 hex 를 만들지 않는 이유가 그것이다(만드는 순간 검증 밖으로 나간다).
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';

/**
 * 무료 타로 한 장 띠.
 *
 * ★상태를 갖지 않는다 — 누르면 `/taro` 로 보낼 뿐이다. 뽑기 로직은 타로 화면에 있고
 *   여기서 다시 만들면 규칙이 두 벌이 된다([[duplicate-ui-single-source]]).
 */
export function FreeDrawStrip() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('freeDraw.title', '무료 타로 한 장 뽑기')}</Text>
      <Text style={styles.sub}>{t('freeDraw.sub', '오늘의 운을 카드 한장으로 확인해보세요.')}</Text>
      <PressableScale style={styles.cta} onPress={() => router.push('/taro')}>
        <Text style={styles.ctaTx}>{t('freeDraw.cta', '시작하기')}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.juSoft, borderRadius: radius.lg,
    paddingHorizontal: space(5), paddingVertical: space(5), marginBottom: space(4),
  },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '900', color: colors.ju, letterSpacing: -0.4 },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5) },
  cta: {
    alignSelf: 'flex-start', marginTop: space(3.5), backgroundColor: colors.ju,
    borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5),
  },
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
});
