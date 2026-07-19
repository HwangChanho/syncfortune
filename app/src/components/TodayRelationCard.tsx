// src/components/TodayRelationCard.tsx — 홈 블록: 오늘의 관계
// ─────────────────────────────────────────────────────────────────────────
// 리텐션 재기획(daniel 2026-07-20 채택) — "궁합은 한 번 보면 끝"을 **매일 바뀌는 것**으로.
//   등록해 둔 다른 명식(연인·가족·친구) 중 하나와 오늘 어떤 날인지 결정론으로 보여준다(API 0).
//
// ★상대가 없으면 렌더하지 않는다 — 명식이 하나뿐인 사용자에게 빈 카드나 등록 재촉을 띄우지 않는다
//   (홈이 안내문으로 도배되지 않게 · 다른 히어로들과 같은 정책).
// ★상대는 탭으로 넘겨 본다: 여러 명 등록했으면 칩으로 전환(궁합 화면을 매번 열지 않아도 되게).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { listCharts, loadRepChart, type SavedChart } from '../lib/engine/myChart';
import { buildSajuChart } from '@engine/saju';
import { getDailyFortune } from '../lib/content/dailyFortune';
import { todayRelation, type TodayRelation } from '../lib/content/todayRelation';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { Stem, Branch } from '@spec/chart';

const TONE: Record<TodayRelation['tone'], string> = {
  good: colors.ju,
  mixed: colors.inkSoft,
  care: colors.inkSoft, // ★'care'에 빨강을 쓰지 않는다(§4 부정 증폭 금지) — 관계를 흉하게 못 박지 않기 위해
};

/** 홈 블록. reloadKey = 대표 명식 전환/포커스 시 재산출, dateKey = 자정 넘어가면 갱신. */
export function TodayRelationCard({ reloadKey, dateKey }: { reloadKey?: number; dateKey?: string }) {
  const router = useRouter();
  const { fs } = useFontScale();
  const [others, setOthers] = useState<SavedChart[]>([]);
  const [idx, setIdx] = useState(0);
  const [rel, setRel] = useState<TodayRelation | null>(null);

  // 대표 명식 외 나머지 = 상대 후보
  useEffect(() => {
    let alive = true;
    (async () => {
      const [all, rep] = await Promise.all([listCharts(), loadRepChart()]);
      if (!alive || !rep) { setOthers([]); return; }
      const rest = all.filter((c) => c.id !== rep.id);
      setOthers(rest);
      setIdx((i) => (i < rest.length ? i : 0));  // 명식이 지워졌을 때 인덱스 보정
    })().catch(() => { if (alive) setOthers([]); });
    return () => { alive = false; };
  }, [reloadKey]);

  // 선택된 상대 × 오늘 → 관계 판정(결정론)
  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      const other = others[idx];
      if (!alive || !rep || !other) { setRel(null); return; }
      try {
        const f = getDailyFortune(0);
        setRel(todayRelation(
          buildSajuChart(rep.input), buildSajuChart(other.input),
          f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch,
        ));
      } catch { if (alive) setRel(null); }
    })().catch(() => { if (alive) setRel(null); });
    return () => { alive = false; };
  }, [others, idx, reloadKey, dateKey]);

  if (others.length === 0 || !rel) return null; // 상대 없음 = 렌더 안 함

  const other = others[idx];
  const tone = TONE[rel.tone];
  return (
    <PressableScale style={styles.card} onPress={() => router.push('/compat')}>
      <View style={styles.head}>
        <Text style={styles.kicker}>오늘의 관계</Text>
        <Text style={styles.more}>궁합 자세히 ›</Text>
      </View>

      {/* 상대 선택 — 2명 이상일 때만 칩 노출(한 명이면 이름만) */}
      {others.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {others.map((c, i) => (
            <PressableScale key={c.id} style={[styles.chip, i === idx && styles.chipOn]} onPress={() => setIdx(i)}>
              <Text style={[styles.chipTx, i === idx && styles.chipTxOn]} numberOfLines={1}>{c.label || '상대'}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.who}>{other.label || '상대'}</Text>
      )}

      <Text style={[styles.title, { fontSize: fs(16) }]}>{rel.title}</Text>
      <Text style={[styles.body, { fontSize: fs(13.5), lineHeight: fs(20) }]}>{rel.body}</Text>
      {rel.signals.length > 0 && (
        <View style={styles.sigRow}>
          {rel.signals.map((s) => (
            <View key={s} style={[styles.sig, { borderColor: tone }]}><Text style={[styles.sigTx, { color: tone }]}>{s}</Text></View>
          ))}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(4), ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.4 },
  more: { ...font.caption, color: colors.ju, fontWeight: '800' },
  chips: { gap: space(1.5), paddingVertical: space(2) },
  chip: { paddingVertical: space(1.5), paddingHorizontal: space(3), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.overlay, maxWidth: 120 },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  chipTxOn: { color: '#15132E', fontWeight: '800' },
  who: { ...font.caption, color: colors.inkSoft, fontWeight: '700', marginTop: space(2) },
  title: { ...font.heading, color: colors.ink, fontWeight: '900', marginTop: space(2) },
  body: { ...font.body, color: colors.inkSoft, marginTop: space(1.5) },
  sigRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2.5) },
  sig: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  sigTx: { fontSize: 11.5, fontWeight: '700' },
});
