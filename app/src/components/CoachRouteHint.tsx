// app/src/components/CoachRouteHint.tsx — 코치 답변 아래 '이어서 볼 콘텐츠' 한 줄 안내
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-27: "코치가 컨텐츠로 안내하고 이런 건?"
//   ①(선행) 코치가 **구매한 풀이를 근거로** 답하게 해 이미 산 사람의 카니발라이제이션을 풀었고,
//   ②(이것) 아직 안 산 사람의 동선을 푼다 — 코치를 대체재가 아니라 **콘텐츠로 들어가는 관문**으로.
//
// ★안내 선택은 온디바이스 결정론(`pickCoachRoute`) — LLM 이 고르면 **없는 콘텐츠를 지어낼 수 있고**
//   토큰 비용도 는다. 여기 키는 전부 실재하며 `check:coachroute` 가 매 preflight 마다 대조한다.
// ★질문에 그 말이 실제로 나왔을 때만 뜬다(선제 제안 금지 · §4). 안 걸리면 아무것도 안 그린다 —
//   매 답변마다 뜨면 광고로 읽혀 코치 신뢰를 깎는다.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { useTranslation } from 'react-i18next';
import { pickCoachRoute, type CoachRoute } from '../lib/content/coachRoute';
import { ownedKeysFrom } from '../lib/content/nextStep';
import { SECTIONS } from '../lib/content/contentSections';
import { loadRepChart } from '../lib/engine/myChart';
import { supabase } from '../lib/supabase';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';

/** 키 → SECTIONS 메타(라우트·라벨키). NextStepCard 와 같은 해석 방식(단일 출처). */
const META: Record<string, { route: string; labelKey: string }> = (() => {
  const m: Record<string, { route: string; labelKey: string }> = {};
  for (const s of SECTIONS) {
    for (const it of s.items) {
      const entry = { route: it.route, labelKey: it.labelKey };
      m[it.key] = entry;
      if (it.creditKey) m[it.creditKey] = entry;   // 유료는 creditKey 로도 찾을 수 있게
    }
  }
  return m;
})();

/**
 * @param question 이 턴의 사용자 질문 — 여기 나온 말로만 판단한다.
 * @param reloadKey 보유 목록 재조회 트리거(선택)
 */
export function CoachRouteHint({ question, reloadKey }: { question: string; reloadKey?: number }) {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const [route, setRoute] = useState<CoachRoute | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 보유 목록 — 실패하면 '미보유'로 간주(안내 자체는 계속 뜬다). 코치는 서버 의존을 최소로.
        let owned = new Set<string>();
        const rep = await loadRepChart();
        if (rep?.serverChartId) {
          const { data } = await supabase.from('readings').select('category').eq('chart_id', rep.serverChartId).neq('tier', 'mock');
          owned = ownedKeysFrom(((data ?? []) as any[]).map((r) => String(r.category)));
        }
        const r = pickCoachRoute(question, owned);
        if (alive) setRoute(r && META[r.key] ? r : null);   // ★메타가 없는 키는 그리지 않는다(죽은 링크 방지)
      } catch {
        if (alive) {
          const r = pickCoachRoute(question, new Set());
          setRoute(r && META[r.key] ? r : null);
        }
      }
    })();
    return () => { alive = false; };
  }, [question, reloadKey]);

  if (!route) return null;
  const meta = META[route.key];
  const label = t(meta.labelKey);

  return (
    <PressableScale style={styles.wrap} onPress={() => router.push(meta.route as any)}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.reason, { fontSize: fs(11.5) }]}>{route.reason}</Text>
        <Text style={[styles.title, { fontSize: fs(14), lineHeight: fs(20) }]}>
          {route.owned
            ? `${label} 이어서 보기`
            : `${label} 에서 더 깊이 볼 수 있어요`}
        </Text>
      </View>
      <Text style={[styles.chev, { fontSize: fs(16) }]}>›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // 답변 카드 안의 보조 줄 — 버튼처럼 크게 만들지 않는다(광고 인상 방지)
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    marginTop: space(3.5), paddingVertical: space(3), paddingHorizontal: space(3.5),
    backgroundColor: colors.juSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
  },
  reason: { ...font.caption, color: colors.inkSoft, marginBottom: 2 },
  title: { ...font.body, color: colors.ju, fontWeight: '800' },
  chev: { color: colors.ju, fontWeight: '900' },
});
