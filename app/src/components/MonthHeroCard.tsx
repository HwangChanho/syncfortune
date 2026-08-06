// src/components/MonthHeroCard.tsx — 풀이탭 상단 '이달의 운세' 펼침 카드
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-08-06: "이달의 운세는 **풀어서 밖에서** 보이게 하고 리스트에선 빼고,
//   홈에선 오늘의 운세 / 풀이에선 이달의 운세로 진입하게."
//
// 왜 진입 카드가 아니라 펼침인가(IMG_8409 실물 지적):
//   앞서 DeepDiveCta 로 '이달의 운세 ›' 한 줄을 뒀더니 **목록의 한 행처럼** 보였다.
//   백화점 비유(daniel)에서 매장에 들어온 사람에게 처음 내미는 것은 **이미 펼쳐진 무료 시식**이어야 한다 —
//   눌러야 뭔가 나오는 링크는 시식이 아니라 또 하나의 문이다.
//
// ★계산은 전부 온디바이스 결정론(dailyFortune) — API 0. month 화면과 **같은 함수**를 쓴다(값이 갈리지 않게).
// ★명식이 없으면 스스로 렌더하지 않는다(홈 블록들과 같은 관례).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { MonthFlowGraph } from './MonthFlowGraph';
import { loadRepChart, subscribeRepChange } from '../lib/engine/myChart';
import { computeChart } from '../lib/engine/engine';
import { getMonthGanZhi, dailyHeadline, getDailyReading, scoreFlow } from '../lib/content/dailyFortune';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, space, radius, font, shadow } from '../lib/theme';

/** @param reloadKey 명식 전환·수정 시 재계산 트리거(호출측이 올린다) */
export function MonthHeroCard({ reloadKey }: { reloadKey?: number }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [saju, setSaju] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      setSaju(rep ? computeChart(rep.input).saju : null);
    })().catch(() => { if (alive) setSaju(null); });
    return () => { alive = false; };
  }, [reloadKey]);
  useEffect(() => subscribeRepChange(() => setSaju((v: any) => v)), []); // 명식 전역 변경 구독(재조회는 reloadKey 가 담당)

  // 이번 달 월건(간지) → 헤드라인·룰 풀이·흐름. month 화면과 동일 경로.
  const gz = useMemo(() => getMonthGanZhi(0), []);
  const view = useMemo(() => {
    if (!saju) return null;
    try {
      const stem = gz[0] as any;
      const branch = gz[1] as any;
      return {
        headline: dailyHeadline(saju, stem, branch, 'month'),
        reading: getDailyReading(saju, stem, branch, 'month'),
        flow: scoreFlow(saju, 'month'),
      };
    } catch { return null; }
  }, [saju, gz]);

  if (!view) return null; // 명식 없음/산출 실패 → 자리 차지하지 않는다

  // 룰 풀이 — ★`getDailyReading` 은 **문자열이 아니라 `Record<영역키, string>`** 이다(general/work/money/love/health).
  //   처음에 문자열로 다뤄 본문이 통째로 비어 있었다(daniel "이달의 운세 지금 제대로 안 나오고 있어").
  //   전체 흐름을 대표하는 'general' 한 문단만 보여주고 나머지는 상세로 남긴다.
  const firstLine = (view.reading?.general ?? '').split(/\n+/).find((x) => x.trim().length > 0) ?? '';

  return (
    <PressableScale style={styles.card} onPress={() => router.push('/month')}>
      <View style={styles.head}>
        <Text style={[styles.kicker, { fontSize: fs(12) }]}>{t('menu.month', '이달의 운세')}</Text>
        <Text style={[styles.go, { fontSize: fs(12.5) }]}>{t('common.more', '자세히')} ›</Text>
      </View>
      {view.headline ? (
        <Text style={[styles.headline, { fontSize: fs(17), lineHeight: fs(24) }]} numberOfLines={2}>{view.headline}</Text>
      ) : null}
      {firstLine ? (
        <Text style={[styles.body, { fontSize: fs(13), lineHeight: fs(19) }]} numberOfLines={2}>{firstLine}</Text>
      ) : null}
      {/* 다섯 달 흐름(전전달~다다음달) — 그래프가 '풀어 보인다'는 인상을 만든다. month 화면과 같은 컴포넌트. */}
      {view.flow?.scores?.length ? <MonthFlowGraph scores={view.flow.scores} height={88} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    padding: space(4), marginBottom: space(4), gap: space(2), ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '900', letterSpacing: 0.3 },
  go: { color: colors.inkSoft, fontWeight: '800' },
  headline: { color: colors.ink, fontWeight: '900' },
  body: { color: colors.inkSoft },
});
