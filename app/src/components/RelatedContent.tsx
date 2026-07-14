// app/src/components/RelatedContent.tsx — 연관 콘텐츠 자동 추천(온디바이스 큐레이션·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 기획서(2026-07-14): "성향·결과에 맞춰 좋아할 만한 연관 콘텐츠를 자동 추천하는 버튼" + 피드백(오늘운세 하단→코디/개운 동선).
//   v1 = kind 기반 큐레이션 맵(결정론·API 0). 각 콘텐츠 하단에 '이런 것도 좋아하실 거예요' → 관련 유료 콘텐츠로 크로스셀.
//   (v2 = 결과/성향 기반 개인화 — 추후.) 경로는 market ROUTE 단일 소스 재사용, 라벨은 CREDIT_KINDS.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { ROUTE } from '../app/(app)/market';
import { CREDIT_KINDS, type CreditKind } from '../lib/billing/coupons';
import { colors, radius, space, font } from '../lib/theme';

// kind → 연관 콘텐츠(큐레이션 2~3). 자기 자신·미구현(속궁합/퍼스널오행 등)은 제외. daniel 조정 슬롯.
const RELATED: Record<string, CreditKind[]> = {
  reading: ['love', 'career', 'talent'],
  ziwei: ['mission', 'reading', 'astrology'],
  compat: ['love', 'crush', 'reunion'],
  love: ['compat', 'crush', 'reunion'],
  career: ['jobfit', 'talent', 'job'],
  jobfit: ['career', 'talent', 'mission'],
  talent: ['jobfit', 'mission', 'career'],
  mission: ['talent', 'roots', 'image'],
  roots: ['mission', 'image', 'talent'],
  image: ['mission', 'talent', 'roots'],
  newyear: ['lifegraph', 'gaeun', 'love'],
  lifegraph: ['newyear', 'roots', 'career'],
  gaeun: ['newyear', 'love', 'talent'],
  astrology: ['reading', 'love', 'compat'],
  future10: ['career', 'timeline', 'gaeun'],
  child: ['love', 'compat', 'reading'],
  crush: ['love', 'compat', 'reunion'],
  reunion: ['love', 'crush', 'compat'],
  job: ['jobfit', 'career', 'talent'],
  timeline: ['lifegraph', 'newyear', 'roots'],
  daily: ['gaeun', 'love', 'career'], // 오늘의 운세 하단 → 개운·애정·직업(퍼스널오행은 Phase2 추가 예정)
};

const LABEL: Record<string, string> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.ko]));

/**
 * 연관 콘텐츠 추천 — 콘텐츠 하단에 '이런 것도 좋아하실 거예요' 크로스셀.
 * @param kind 현재 콘텐츠 kind(또는 'daily'). 매핑 없으면 아무것도 렌더 안 함.
 */
export function RelatedContent({ kind }: { kind: string }) {
  const router = useRouter();
  const items = (RELATED[kind] ?? []).filter((k) => ROUTE[k] && LABEL[k]);
  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>이런 콘텐츠도 좋아하실 거예요</Text>
      {items.map((k) => (
        <PressableScale
          key={k}
          style={styles.row}
          onPress={() => {
            const r = ROUTE[k];
            router.navigate(r.kind ? ({ pathname: r.pathname, params: { kind: r.kind } } as any) : (r.pathname as any));
          }}
        >
          <Text style={styles.label}>{LABEL[k]}</Text>
          <Text style={styles.arrow}>›</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space(5), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.line },
  title: { ...font.caption, color: colors.inkSoft, marginBottom: space(2) },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingVertical: space(3), paddingHorizontal: space(4), marginBottom: space(2),
  },
  label: { ...font.body, color: colors.ink, fontWeight: '700' },
  arrow: { ...font.heading, color: colors.ju },
});
