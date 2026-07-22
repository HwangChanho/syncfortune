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

// kind → 연관 콘텐츠(큐레이션 2~3). 자기 자신·미구현(속궁합 등)은 제외. daniel 조정 슬롯.
//   값은 유료 CreditKind 또는 무료 콘텐츠 키(personal 등) 혼합 가능 — 아래 FREE_ROUTE/FREE_LABEL 로 해석.
const RELATED: Record<string, string[]> = {
  reading: ['love', 'career', 'talent'],
  ziwei: ['mission', 'reading', 'astrology'],
  compat: ['love', 'crush', 'reunion'],
  love: ['compat', 'crush', 'reunion'],
  career: ['jobfit', 'talent', 'job'],
  jobfit: ['career', 'talent', 'mission'],
  wealth: ['career', 'jobfit', 'future10'], // 재물 딥리포트 → 사업가·직업적성·10년뒤(재물 동선)
  talent: ['jobfit', 'mission', 'personal'],
  mission: ['talent', 'roots', 'image'],
  roots: ['mission', 'image', 'talent'],
  image: ['personal', 'mission', 'talent'], // 비치는 나 → 퍼스널 오행(첫인상·컬러 동선)
  newyear: ['lifegraph', 'gaeun', 'love'],
  lifegraph: ['newyear', 'roots', 'career'],
  gaeun: ['personal', 'newyear', 'love'],   // 개운법 → 퍼스널 오행(컬러 보완 동선)
  astrology: ['reading', 'love', 'compat'],
  future10: ['career', 'timeline', 'gaeun'],
  child: ['love', 'compat', 'reading'],
  crush: ['love', 'compat', 'reunion'],
  reunion: ['love', 'crush', 'compat'],
  job: ['jobfit', 'career', 'talent'],
  timeline: ['lifegraph', 'newyear', 'roots'],
  daily: ['personal', 'gaeun', 'love'],     // 오늘의 운세 하단 → 퍼스널 오행(코디)·개운·애정 동선(daniel 기획서②-피드백)
  personal: ['gaeun', 'lovestyle', 'love'], // 퍼스널 오행 → 개운·연애스타일·애정
};

// 유료 콘텐츠 라벨(CreditKind) + 무료 콘텐츠(비-CreditKind) 라우트·라벨.
const LABEL: Record<string, string> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.ko]));
const FREE_ROUTE: Record<string, string> = { personal: '/personal', lovestyle: '/lovestyle' };
const FREE_LABEL: Record<string, string> = { personal: '퍼스널 오행', lovestyle: '나의 연애 스타일' };

/**
 * 연관 콘텐츠 추천 — 콘텐츠 하단에 '이런 것도 좋아하실 거예요' 크로스셀.
 * @param kind 현재 콘텐츠 kind(또는 'daily'). 매핑 없으면 아무것도 렌더 안 함.
 */
export function RelatedContent({ kind }: { kind: string }) {
  const router = useRouter();
  // 유료(ROUTE/LABEL) 또는 무료(FREE_ROUTE/FREE_LABEL) 어느 쪽으로든 해석 가능한 항목만.
  const items = (RELATED[kind] ?? []).filter((k) => (ROUTE[k as CreditKind] && LABEL[k]) || (FREE_ROUTE[k] && FREE_LABEL[k]));
  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>이런 콘텐츠도 좋아하실 거예요</Text>
      {items.map((k) => (
        <PressableScale
          key={k}
          style={styles.row}
          onPress={() => {
            const r = ROUTE[k as CreditKind];
            if (r) router.navigate(r.kind ? ({ pathname: r.pathname, params: { kind: r.kind } } as any) : (r.pathname as any));
            else if (FREE_ROUTE[k]) router.navigate(FREE_ROUTE[k] as any);
          }}
        >
          <Text style={styles.label}>{LABEL[k] ?? FREE_LABEL[k]}</Text>
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
