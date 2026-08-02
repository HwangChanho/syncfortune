// app/src/app/(app)/moment.tsx — 모먼트 상세(오늘의 행운과 동일 패턴)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-26: "오늘의 결정도 오늘의 행운처럼 타고 한번 더 들어가서 명식 변경해서 볼 수 있어야 해."
//   홈 카드(DecisionTodayCard)는 요약, 여기서 전체 + **상단 ChartPicker 로 명식 전환**.
//   `/luck`(오늘의 행운) 구조를 그대로 따른다: useLogContentVisit → ChartPicker → 포커스마다 재계산.
//
// ★새 명리 판정 0 — 홈 카드와 **같은 함수**(dailyEnergy → decisionFromEnergy / momentFromEnergy)를 쓴다.
//   화면이 둘이어도 판정은 한 곳에서만 나오므로 값이 어긋날 수 없다.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChartPicker } from '../../components/ChartPicker';        // 상단 명식 헤더 — 표시·전환
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';            // canonical 빌더(drift 방지)
import { getDailyFortune, dailyEnergy } from '../../lib/content/dailyFortune';
import { decisionFromEnergy, momentFromEnergy, VERDICT_STYLE, type DecisionToday, type MomentPick } from '../../lib/content/decisionToday';
import { luckyToday, type LuckyToday } from '../../lib/content/luckyItem';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 진입 1회 방문 기록
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import type { Stem, Branch } from '@spec/chart';

export default function MomentScreen() {
  useLogContentVisit('moment');
  const { fs } = useFontScale();
  const today = useMemo(() => getDailyFortune(0), []);
  const lucky = useMemo<LuckyToday | null>(() => { try { return luckyToday(); } catch { return null; } }, [today]);
  const [data, setData] = useState<DecisionToday | null>(null);
  const [moment, setMoment] = useState<MomentPick | null>(null);
  const [hasChart, setHasChart] = useState<boolean | null>(null); // null=로딩

  // 대표 명식 기준 재계산 — 포커스 복귀·명식 전환 때마다(ChartPicker onChange 가 이 함수를 다시 부른다)
  const recompute = useCallback(async () => {
    const rep = await loadRepChart();
    if (!rep) { setHasChart(false); setData(null); setMoment(null); return; }
    setHasChart(true);
    const gz = String(today?.dayGanZhi ?? '');
    if (gz.length < 2) { setData(null); setMoment(null); return; }
    const saju = computeChart(rep.input).saju;
    // 홈 카드와 동일한 산출 경로 — 같은 energy 로 결정·모먼트 둘 다(값 어긋남 0)
    const energy = dailyEnergy(saju, gz[0] as Stem, gz[1] as Branch);
    setData(decisionFromEnergy(energy));
    setMoment(momentFromEnergy(energy));
  }, [today]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    recompute().catch(() => { if (alive) { setData(null); setMoment(null); } });
    return () => { alive = false; };
  }, [recompute]));

  const vs = data ? VERDICT_STYLE[data.verdict] : null;

  return (
    <View style={styles.bg}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 여기서 명식을 바꾸면 아래 전체가 그 명식 기준으로 다시 계산된다(daniel 요청) */}
        <ChartPicker onChange={() => { void recompute(); }} />

        <Text style={styles.h}>모먼트</Text>
        <Text style={styles.sub}>{today?.date} · 오늘 들어온 기운 {data ? data.score : '—'}점</Text>

        {hasChart === false ? (
          <View style={styles.card}><Text style={[styles.body, { fontSize: fs(14) }]}>명식을 등록하면 오늘의 모먼트를 볼 수 있어요.</Text></View>
        ) : !data ? (
          <View style={styles.card}><Text style={[styles.body, { fontSize: fs(14) }]}>오늘의 기운을 계산하는 중…</Text></View>
        ) : (
          <>
            {/* 모먼트 — 이 화면의 주인공 */}
            {moment ? (
              <View style={styles.momentCard}>
                <Text style={[styles.momentKicker, { fontSize: fs(11) }]}>오늘의 모먼트</Text>
                <Text style={[styles.momentTitle, { fontSize: fs(19), lineHeight: 27 }]}>{moment.title}</Text>
                <Text style={[styles.momentBody, { fontSize: fs(14), lineHeight: 22 }]}>{moment.body}</Text>
              </View>
            ) : null}

            {/* 오늘 전반 판정 */}
            <View style={styles.card}>
              <View style={styles.headRow}>
                <Text style={[styles.cardH, { fontSize: fs(15) }]}>오늘의 결정</Text>
                {vs ? (
                  <View style={[styles.badge, { backgroundColor: vs.hex + '1F', borderColor: vs.hex + '66' }]}>
                    <Text style={[styles.badgeTx, { color: vs.hex, fontSize: fs(12) }]}>{vs.label}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.title, { fontSize: fs(17), lineHeight: 24 }]}>{data.title}</Text>
              <Text style={[styles.reason, { fontSize: fs(13.5), lineHeight: 21 }]}>{data.reason}</Text>

              {/* 유형별 — 상세 화면이라 처음부터 전부 펼침(홈 카드는 접힘) */}
              <View style={styles.list}>
                {data.items.map((it) => {
                  const s = VERDICT_STYLE[it.verdict];
                  return (
                    <View key={it.kind} style={styles.row}>
                      <View style={[styles.rowBadge, { backgroundColor: s.hex + '1F', borderColor: s.hex + '55' }]}>
                        <Text style={[styles.rowBadgeTx, { color: s.hex, fontSize: fs(10) }]}>{s.label}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowLabel, { fontSize: fs(14) }]}>{it.label}</Text>
                        <Text style={[styles.rowTip, { fontSize: fs(12.5), lineHeight: 19 }]}>{it.tip}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 근거 칩 — 어떤 신호에서 나온 판정인지(홈 카드엔 없는 상세 정보) */}
            {data.signals.length > 0 ? (
              <View style={styles.card}>
                <Text style={[styles.cardH, { fontSize: fs(15), marginBottom: space(2) }]}>오늘 걸린 신호</Text>
                {data.signals.map((sg) => (
                  <Text key={sg.key} style={[styles.signal, { fontSize: fs(13), lineHeight: 20 }, sg.kind === 'care' && styles.signalCare]}>· {sg.label}</Text>
                ))}
              </View>
            ) : null}

            {/* 오늘 어울리는 것 — 홈 카드와 같은 luckyToday 출처(값 어긋남 0) */}
            {lucky ? (
              <View style={styles.card}>
                <Text style={[styles.cardH, { fontSize: fs(15), marginBottom: space(2) }]}>오늘 어울리는 것</Text>
                {([['코디', lucky.wear, lucky.hex], ['음식', lucky.food, null], ['소품', lucky.item, null]] as const).map(([label, val, hex]) => (
                  <View key={label} style={styles.recRow}>
                    <View style={[styles.swatch, hex ? { backgroundColor: hex } : styles.swatchGhost]} />
                    <Text style={[styles.recLabel, { fontSize: fs(13) }]}>{label}</Text>
                    <Text style={[styles.recTx, { fontSize: fs(13), lineHeight: 20 }]}>{val}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },   // 전역 ContentBackdrop 투과
  screen: { backgroundColor: 'transparent' },
  wrap: { padding: space(5), paddingBottom: space(10) },
  h: { ...font.display, fontSize: 26, marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), marginBottom: space(4) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(4), ...shadow.card },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  cardH: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.4 },
  badge: { borderWidth: 1, borderRadius: 999, paddingVertical: space(1), paddingHorizontal: space(2.5) },
  badgeTx: { fontWeight: '800' },
  title: { ...font.heading, color: colors.ink, fontWeight: '900', marginBottom: space(1.5) },
  reason: { ...font.body, color: colors.inkSoft, marginBottom: space(4) },
  body: { ...font.body, color: colors.inkSoft },
  // 모먼트 — 주인공 카드(연한 골드 틴트 + 좌측 강조바)
  momentCard: { backgroundColor: colors.juSoft, borderRadius: radius.lg, borderLeftWidth: 4, borderLeftColor: colors.ju, paddingVertical: space(5), paddingHorizontal: space(5), marginBottom: space(4) },
  momentKicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 1, marginBottom: space(1.5) },
  momentTitle: { ...font.title, color: colors.ink, fontWeight: '900' },
  momentBody: { ...font.body, color: colors.inkSoft, marginTop: space(2) },
  list: { gap: space(3.5) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  rowBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: space(0.5), paddingHorizontal: space(1.5), minWidth: 46, alignItems: 'center', marginTop: 2 },
  rowBadgeTx: { fontWeight: '800' },
  rowLabel: { ...font.body, color: colors.ink, fontWeight: '800' },
  rowTip: { ...font.caption, color: colors.inkSoft, marginTop: 2 },
  signal: { ...font.body, color: colors.ink },
  signalCare: { color: colors.inkSoft },               // '조심' 신호는 톤을 낮춘다(§4 부정 증폭 금지)
  recRow: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), paddingVertical: space(1) },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  swatchGhost: { backgroundColor: colors.line },
  recLabel: { ...font.caption, color: colors.inkSoft, fontWeight: '800', width: 34 },
  recTx: { ...font.body, color: colors.ink, flex: 1 },
});
