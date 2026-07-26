// app/src/components/RelatedContent.tsx — 연관 콘텐츠 자동 추천(온디바이스 큐레이션·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 기획서(2026-07-14): "성향·결과에 맞춰 좋아할 만한 연관 콘텐츠를 자동 추천하는 버튼" + 피드백(오늘운세 하단→코디/개운 동선).
//   v1 = kind 기반 큐레이션 맵(결정론·API 0). 각 콘텐츠 하단에 '이런 것도 좋아하실 거예요' → 관련 유료 콘텐츠로 크로스셀.
//   ★v2(daniel 2026-07-25 K '하나 보면 자연스럽게 다음 컨텐츠 유도'): 밋밋한 텍스트 링크 → **이미지 카드**(콘텐츠 타일 이미지 + 한 줄 설명).
//     하나를 다 본 사람에게 '다음'을 그림으로 보여줘 자연스러운 발견·전환(홈 하우스광고 배너와 같은 결).
//     이미지·설명은 contentSections(SECTIONS) 단일 출처에서 kind→메타로 끌어온다(중복 하드코딩 0).
//   (v3 = 결과/성향 기반 개인화 — 추후.) 경로는 market ROUTE 단일 소스 재사용, 라벨은 CREDIT_KINDS.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image'; // 자동 다운샘플·디스크캐시(콘텐츠 카드와 동일)
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { ROUTE } from '../app/(app)/market';
import { CREDIT_KINDS, type CreditKind } from '../lib/billing/coupons';
import { SECTIONS } from '../lib/content/contentSections';
import { RELATED } from '../lib/content/relatedMap'; // 연관 큐레이션 단일 출처(풀이 탭 '다음 단계'와 공유)
import { colors, radius, space, font, shadow } from '../lib/theme';

// kind → 연관 콘텐츠(큐레이션 2~3). 자기 자신·미구현(속궁합 등)은 제외. daniel 조정 슬롯.
//   값은 유료 CreditKind 또는 무료 콘텐츠 키(personal 등) 혼합 가능 — 아래 FREE_ROUTE/FREE_LABEL 로 해석.

// 유료 콘텐츠 라벨(CreditKind) + 무료 콘텐츠(비-CreditKind) 라우트·라벨.
const LABEL: Record<string, string> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.ko]));
const FREE_ROUTE: Record<string, string> = { personal: '/personal', lovestyle: '/lovestyle' };
const FREE_LABEL: Record<string, string> = { personal: '퍼스널 오행', lovestyle: '나의 연애 스타일' };

// ★kind → 타일 이미지·설명(단일 출처 SECTIONS에서 조립). creditKey 우선, 없으면 item.key 로 매핑.
//   RELATED 값(love·career·personal…)이 유료 creditKey 든 무료 item.key 든 모두 해석되게.
const META_BY_KIND: Record<string, { image: any; descKey?: string }> = (() => {
  const m: Record<string, { image: any; descKey?: string }> = {};
  for (const s of SECTIONS) {
    for (const it of s.items) {
      if (!it.image) continue;
      const entry = { image: it.image, descKey: it.descKey };
      if (it.creditKey && !m[it.creditKey]) m[it.creditKey] = entry; // 유료: creditKey 로
      if (!m[it.key]) m[it.key] = entry;                             // 무료·보조: item.key 로
    }
  }
  return m;
})();

/**
 * 연관 콘텐츠 추천 — 콘텐츠 하단에 '이어서 보면 좋은 콘텐츠' 이미지 카드 크로스셀.
 * @param kind 현재 콘텐츠 kind(또는 'daily'). 매핑 없으면 아무것도 렌더 안 함.
 */
export function RelatedContent({ kind }: { kind: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  // 유료(ROUTE/LABEL) 또는 무료(FREE_ROUTE/FREE_LABEL) 어느 쪽으로든 해석 가능한 항목만.
  const items = (RELATED[kind] ?? []).filter((k) => (ROUTE[k as CreditKind] && LABEL[k]) || (FREE_ROUTE[k] && FREE_LABEL[k]));
  if (items.length === 0) return null;

  const go = (k: string) => {
    const r = ROUTE[k as CreditKind];
    if (r) router.navigate(r.kind ? ({ pathname: r.pathname, params: { kind: r.kind } } as any) : (r.pathname as any));
    else if (FREE_ROUTE[k]) router.navigate(FREE_ROUTE[k] as any);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>이어서 보면 좋은 콘텐츠</Text>
      {items.map((k) => {
        const meta = META_BY_KIND[k];
        const label = LABEL[k] ?? FREE_LABEL[k];
        const sub = meta?.descKey ? t(meta.descKey) : undefined;
        return (
          <PressableScale key={k} style={styles.card} onPress={() => go(k)}>
            {/* 타일 이미지(있으면) — 없으면 오행톤 폴백 네모. 그림이 '다음'을 자연스레 끌어당김. */}
            {meta?.image ? (
              <ExpoImage source={meta.image} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" transition={120} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}><Text style={styles.thumbFallbackTx}>✦</Text></View>
            )}
            <View style={styles.body}>
              <Text style={styles.label} numberOfLines={1}>{label}</Text>
              {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
            </View>
            <Text style={styles.arrow}>›</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space(5), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.line },
  title: { ...font.caption, color: colors.inkSoft, marginBottom: space(2.5), fontWeight: '800' },
  // 이미지 카드 — 좌측 썸네일 + 라벨/설명 + 화살표. 콘텐츠 타일과 같은 결(카드·그림자).
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    padding: space(2.5), marginBottom: space(2.5), gap: space(3), ...shadow.card,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.sunk },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.juLine },
  thumbFallbackTx: { color: colors.ju, fontSize: 20, fontWeight: '900' },
  body: { flex: 1, gap: 2 },
  label: { ...font.body, color: colors.ink, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkSoft },
  arrow: { ...font.heading, color: colors.ju, marginRight: space(1) },
});
