// app/src/components/DeepDiveCta.tsx — '더 깊이 보기' 유도 CTA(이미지 카드)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29 (IMG_8295): "유도 컨텐츠는 저렇게 이미지까지 나와야해 아래에 추천컨텐츠 처럼"
//
// 문제: 재미 콘텐츠(연애스타일·복·전생·조선직업…) 하단의 **주 전환 버튼**이 글자만 있는 테두리 버튼이었다.
//   바로 그 아래 '이어서 보면 좋은 콘텐츠'(RelatedContent)는 이미지 카드라, **덜 중요한 쪽이 더 잘 보이는**
//   역전이 났다. 사용자가 다음으로 갈 주 동선인데 눈에 덜 띈다.
//
// 설계: RelatedContent 와 **같은 이미지 카드 언어**를 쓰되, 주 CTA 답게 한 급 강조한다
//   (큰 썸네일 · 강조 테두리 · 액션 문구). 이미지·설명은 **같은 단일 출처(SECTIONS)** 에서 온다 —
//   여기서 이미지를 새로 하드코딩하면 콘텐츠가 늘 때마다 또 갈라진다(이 프로젝트 반복 사고 유형).
//
// ★사용: <DeepDiveCta kind="love" label="내 애정 흐름 깊이 보기" onPress={...} />
//   kind 로 이미지를 찾고, 못 찾으면 **기존처럼 글자 버튼으로 폴백**한다(빈 카드로 깨지지 않게).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image'; // 자동 다운샘플·디스크캐시(추천 카드와 동일)
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { SECTIONS } from '../lib/content/contentSections';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font, shadow } from '../lib/theme';

/** kind → 타일 이미지·설명(RelatedContent 와 동일한 조립 규칙·단일 출처 SECTIONS). */
const META_BY_KIND: Record<string, { image: any; descKey?: string }> = (() => {
  const m: Record<string, { image: any; descKey?: string }> = {};
  for (const s of SECTIONS) {
    for (const it of s.items) {
      if (!it.image) continue;
      const entry = { image: it.image, descKey: it.descKey };
      if (it.creditKey && !m[it.creditKey]) m[it.creditKey] = entry;
      if (!m[it.key]) m[it.key] = entry;
    }
  }
  return m;
})();

/**
 * 주 전환 CTA — 이미지 카드.
 * @param kind   목적지 콘텐츠 kind(유료 creditKey 또는 무료 item.key). 이미지 조회용.
 * @param label  버튼 문구(예: '내 애정 흐름 깊이 보기'). 카드 제목으로 쓴다.
 * @param sub    보조 설명. 없으면 SECTIONS 의 descKey 를 쓴다.
 * @param onPress 이동 동작(호출측이 라우팅을 소유 — 기존 CTA 의 목적지를 그대로 유지하려고).
 */
export function DeepDiveCta({ kind, label, sub, onPress }: {
  kind: string; label: string; sub?: string; onPress: () => void;
}) {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const meta = META_BY_KIND[kind];
  const subTx = sub ?? (meta?.descKey ? (t(meta.descKey) as string) : undefined);

  // 이미지가 없으면 기존 글자 버튼으로 폴백 — 카드가 빈 네모로 뜨는 것보다 낫다.
  if (!meta?.image) {
    return (
      <PressableScale style={styles.plain} onPress={onPress}>
        <Text style={[styles.plainTx, { fontSize: fs(15) }]}>{label}</Text>
      </PressableScale>
    );
  }

  return (
    <PressableScale style={styles.card} onPress={onPress}>
      <ExpoImage source={meta.image} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" transition={120} />
      <View style={styles.body}>
        <Text style={[styles.label, { fontSize: fs(15), lineHeight: Math.round(fs(15) * 1.4) }]} numberOfLines={2}>{label}</Text>
        {subTx ? <Text style={[styles.sub, { fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.4) }]} numberOfLines={2}>{subTx}</Text> : null}
      </View>
      <Text style={[styles.arrow, { fontSize: fs(20) }]}>›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // 추천 카드와 같은 결이되 **한 급 강조**(주 CTA) — 강조 테두리 + 큰 썸네일 + 틴트 배경.
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.juSoft, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju,
    padding: space(3), gap: space(3), marginTop: space(2), ...shadow.card,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.sunk },
  body: { flex: 1, gap: 3 },
  label: { ...font.body, color: colors.ju, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkSoft },
  arrow: { ...font.heading, color: colors.ju, marginRight: space(1), fontWeight: '900' },
  // 폴백(이미지 없음) = 종전 테두리 버튼과 동일한 모양
  plain: {
    borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.md,
    paddingVertical: space(3.5), alignItems: 'center', marginTop: space(2),
  },
  plainTx: { ...font.body, color: colors.ju, fontWeight: '800' },
});
