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
import { Image as ExpoImage } from 'expo-image';
import { contentIcon } from '../lib/ui/brandAsset';   // 섹션 아이콘 폴백 // 자동 다운샘플·디스크캐시(추천 카드와 동일)
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
      // ★그림이 없으면 **섹션 아이콘**으로 채운다(2026-08-19).
      //   도우미는 한 번에 한 장만 보여 줘서 카테고리 그림이 반복으로 보이지 않는다.
      //   그림이 아예 없으면 아래에서 **글자 버튼으로 떨어져** daniel IMG_8311 지적으로 되돌아간다.
      const img = it.image ?? (s.icon ? contentIcon(s.icon) : null);
      if (!img) continue;
      const entry = { image: img, descKey: it.descKey };
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
 * @param compact 한 급 낮춘 보조 안내용(daniel 2026-07-30 IMG_8311 — AI 코치 답변 안에 들어간다).
 *   ★왜 프롭 하나로 처리하나: 코치용 카드를 따로 만들면 **같은 카드가 두 벌**이 되고,
 *   콘텐츠가 늘 때 한쪽만 갱신되는 게 이 프로젝트의 반복 사고 유형이다(이미지 하드코딩 분기).
 *   코치 답변 안에서는 주 CTA 만큼 강조하면 광고로 읽히므로(원 설계 의도) 테두리·썸네일만 낮춘다.
 */
export function DeepDiveCta({ kind, label, sub, onPress, compact = false }: {
  kind: string; label: string; sub?: string; onPress: () => void; compact?: boolean;
}) {
  const { t } = useTranslation();
  const { fs, ls } = useFontScale();
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

  // 썸네일은 **치수**라서 ls()(글자 배율 연동) — 고정 64 로 두면 큰 글자 옆에서 그림만 작아 보인다.
  const side = ls(compact ? 48 : 64);
  return (
    <PressableScale style={[styles.card, compact && styles.cardCompact]} onPress={onPress}>
      <ExpoImage source={meta.image} style={[styles.thumb, { width: side, height: side }]} contentFit="cover" cachePolicy="memory-disk" transition={120} />
      <View style={styles.body}>
        <Text style={[styles.label, { fontSize: fs(compact ? 14 : 15), lineHeight: Math.round((compact ? 14 : 15) * 1.4) }]} numberOfLines={2}>{label}</Text>
        {subTx ? <Text style={[styles.sub, { fontSize: fs(12), lineHeight: Math.round(12 * 1.4) }]} numberOfLines={2}>{subTx}</Text> : null}
      </View>
      <Text style={[styles.arrow, { fontSize: fs(compact ? 16 : 20) }]}>›</Text>
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
  // ★한 급 낮춤(compact) — 코치 답변 안의 보조 안내. 강조 테두리·그림자를 빼 광고처럼 읽히지 않게 한다.
  cardCompact: {
    borderWidth: 1, borderColor: colors.juLine, marginTop: space(3.5),
    shadowOpacity: 0, elevation: 0,   // 주 CTA 의 그림자를 끈다(theme 에 none 프리셋은 없다)
  },
  thumb: { borderRadius: radius.sm, backgroundColor: colors.sunk },   // 치수는 인라인(ls 배율)
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
