// src/components/TodayRelationCard.tsx — 홈 블록: 오늘의 관계
// ─────────────────────────────────────────────────────────────────────────
// 리텐션 재기획(daniel 2026-07-20 채택) — "궁합은 한 번 보면 끝"을 **매일 바뀌는 것**으로.
//   등록해 둔 다른 명식(연인·가족·친구) 중 하나와 오늘 어떤 날인지 결정론으로 보여준다(API 0).
//
// ★2026-07-20 확장(daniel QA): ①**카테고리 필터**(연애/직장/가족…) — 등록 명식의 relation(자유 문자열)에서
//   실제 존재하는 카테고리만 동적 추출해 칩으로. ②**콘텐츠 확장** — 오늘의 결(body) + '오늘 이렇게'(tip) 처방.
//
// ★상대가 없으면 렌더하지 않는다 — 명식이 하나뿐인 사용자에게 빈 카드나 등록 재촉을 띄우지 않는다.
// ★상대는 탭으로 넘겨 본다: 여러 명이면 칩으로 전환(궁합 화면을 매번 열지 않아도 되게).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { listCharts, loadRepChart, type SavedChart } from '../lib/engine/myChart';
import { buildSajuChart } from '@engine/saju';
import { getDailyFortune } from '../lib/content/dailyFortune';
import { todayRelation, todayGyeol, type TodayRelation } from '../lib/content/todayRelation';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { Stem, Branch } from '@spec/chart';

const TONE: Record<TodayRelation['tone'], string> = {
  good: colors.ju,
  mixed: colors.inkSoft,
  care: colors.inkSoft, // ★'care'에 빨강을 쓰지 않는다(§4 부정 증폭 금지) — 관계를 흉하게 못 박지 않기 위해
};

const ALL = '전체';

/** 홈 블록. reloadKey = 대표 명식 전환/포커스 시 재산출, dateKey = 자정 넘어가면 갱신. */
export function TodayRelationCard({ reloadKey, dateKey }: { reloadKey?: number; dateKey?: string }) {
  const router = useRouter();
  const { fs } = useFontScale();
  const [others, setOthers] = useState<SavedChart[]>([]);
  const [cat, setCat] = useState<string>(ALL);   // 카테고리 필터(daniel 07-20) — ALL=전체
  const [idx, setIdx] = useState(0);              // 필터된 목록 안의 선택 인덱스
  const [rel, setRel] = useState<TodayRelation | null>(null);
  const [detail, setDetail] = useState<{ mine: string; other: string } | null>(null); // 오늘 일진이 각자에게 준 결(십신·디테일)

  // 대표 명식 외 나머지 = 상대 후보
  useEffect(() => {
    let alive = true;
    (async () => {
      const [all, rep] = await Promise.all([listCharts(), loadRepChart()]);
      if (!alive || !rep) { setOthers([]); return; }
      setOthers(all.filter((c) => c.id !== rep.id));
    })().catch(() => { if (alive) setOthers([]); });
    return () => { alive = false; };
  }, [reloadKey]);

  // 등록 상대에 실제로 존재하는 카테고리만 칩으로(빈 카테고리는 안 보임). self 제외.
  const categories = useMemo(() => {
    const set = new Set(others.map((c) => (c.relation && c.relation !== 'self' ? c.relation : '기타')));
    return [ALL, ...[...set]];
  }, [others]);

  // 선택 카테고리로 필터된 상대 목록
  const filtered = useMemo(
    () => (cat === ALL ? others : others.filter((c) => (c.relation && c.relation !== 'self' ? c.relation : '기타') === cat)),
    [others, cat],
  );
  // 필터가 바뀌면 인덱스 보정(범위 밖이면 0으로)
  useEffect(() => { setIdx((i) => (i < filtered.length ? i : 0)); }, [filtered.length]);

  const other = filtered[idx];

  // 선택된 상대 × 오늘 → 관계 판정(결정론)
  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive || !rep || !other) { setRel(null); setDetail(null); return; }
      try {
        const f = getDailyFortune(0);
        const meC = buildSajuChart(rep.input), otC = buildSajuChart(other.input);
        const day = f.dayGanZhi[0] as Stem;
        setRel(todayRelation(meC, otC, day, f.dayGanZhi[1] as Branch));
        // 오늘 일진이 각자에게 어떤 결인가(십신·디테일 확장) — 기존 엔진(tenGod) 재사용
        setDetail({ mine: todayGyeol(meC.dayMaster.stem as Stem, day), other: todayGyeol(otC.dayMaster.stem as Stem, day) });
      } catch { if (alive) { setRel(null); setDetail(null); } }
    })().catch(() => { if (alive) setRel(null); });
    return () => { alive = false; };
  }, [other?.id, reloadKey, dateKey]);

  if (others.length === 0 || !other || !rel) return null; // 상대 없음 = 렌더 안 함

  const tone = TONE[rel.tone];
  return (
    <PressableScale style={styles.card} onPress={() => router.push('/compat')}>
      <View style={styles.head}>
        <Text style={styles.kicker}>오늘의 관계</Text>
        <Text style={styles.more}>궁합 자세히 ›</Text>
      </View>

      {/* 카테고리 필터 — 2개 이상 카테고리가 있을 때만(연애/직장/가족…) */}
      {categories.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {categories.map((c) => (
            <PressableScale key={c} style={[styles.catChip, c === cat && styles.catChipOn]} onPress={() => setCat(c)}>
              <Text style={[styles.catTx, c === cat && styles.catTxOn]}>{c}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      )}

      {/* 상대 선택 — 2명 이상일 때만 칩 노출(한 명이면 이름만) */}
      {filtered.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filtered.map((c, i) => (
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

      {/* 오늘 각자의 결 — 오늘 일진이 각자에게 준 십신 결(디테일 확장 daniel 07-22) */}
      {detail && (detail.mine || detail.other) && (
        <View style={styles.detailBox}>
          {detail.mine ? <Text style={[styles.detailLine, { fontSize: fs(12.5), lineHeight: fs(18) }]}><Text style={styles.detailWho}>오늘 나</Text>  {detail.mine}</Text> : null}
          {detail.other ? <Text style={[styles.detailLine, { fontSize: fs(12.5), lineHeight: fs(18) }]}><Text style={styles.detailWho}>오늘 {other.label || '상대'}</Text>  {detail.other}</Text> : null}
        </View>
      )}

      {/* 오늘 이렇게(처방) — daniel 07-20 콘텐츠 확장 */}
      <View style={styles.tipRow}>
        <Text style={styles.tipCap}>오늘 이렇게</Text>
        <Text style={[styles.tipTx, { fontSize: fs(13), lineHeight: fs(19) }]}>{rel.tip}</Text>
      </View>

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
  // 카테고리 필터 칩(연애/직장/가족…)
  catRow: { gap: space(1.5), paddingTop: space(2.5) },
  catChip: { paddingVertical: space(1), paddingHorizontal: space(2.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.juSoft },
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  catTx: { fontSize: 11.5, fontWeight: '800', color: colors.ju },
  catTxOn: { color: '#15132E' },
  chips: { gap: space(1.5), paddingVertical: space(2) },
  chip: { paddingVertical: space(1.5), paddingHorizontal: space(3), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.overlay, maxWidth: 120 },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  chipTxOn: { color: '#15132E', fontWeight: '800' },
  who: { ...font.caption, color: colors.inkSoft, fontWeight: '700', marginTop: space(2) },
  title: { ...font.heading, color: colors.ink, fontWeight: '900', marginTop: space(2) },
  body: { ...font.body, color: colors.inkSoft, marginTop: space(1.5) },
  // 오늘 각자의 결(십신 디테일)
  detailBox: { marginTop: space(2.5), gap: space(1), paddingLeft: space(2), borderLeftWidth: 2, borderLeftColor: colors.juLine },
  detailLine: { ...font.caption, color: colors.inkSoft },
  detailWho: { fontWeight: '800', color: colors.ju },
  // 오늘 이렇게(처방)
  tipRow: { marginTop: space(3), padding: space(3), backgroundColor: colors.sunk, borderRadius: radius.sm, borderLeftWidth: 3, borderLeftColor: colors.ju },
  tipCap: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(1) },
  tipTx: { ...font.body, color: colors.ink },
  sigRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2.5) },
  sig: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  sigTx: { fontSize: 11.5, fontWeight: '700' },
});
