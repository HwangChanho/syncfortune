// app/src/app/(app)/timeResolve.tsx — 시주 역추론(TPR) UX: 시 모르는 사용자가 인생 사건으로 시(時)를 좁힘
// ─────────────────────────────────────────────────────────────────────────
// 기획 time_pillar_reconstruction_spec.md §5~6: 생년월일 + 객관식 사건 입력 → 후보 12개 스코어링
//   → "확정 / 유력 2~3 / 후보 더 필요(inconclusive)"를 정직하게 노출. 사건 많을수록 정확.
//   ⚠️ 스코어링 가중치는 잠정(daniel n=1 캘리브레이션·과적합 가능 — 블라인드 검증 전). 그래서 정직 노출이 기본.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import type { ChartInput } from '@spec/chart';
import { scoreTimePillars, type LifeEvent, type BigEventType } from '../../lib/timePillarScore';
import { stemReading, branchReading } from '../../lib/ohaeng';
import { colors, radius, space, font } from '../../lib/theme';

const EVENT_TYPES: BigEventType[] = ['이사', '이직', '창업', '결혼', '이혼', '투자손실', '질병', '사고'];

export default function TimeResolveScreen() {
  const [date, setDate] = useState('');                       // 생년월일 'YYYY-MM-DD'
  const [sex, setSex] = useState<'남' | '여'>('남');
  const [place, setPlace] = useState('서울');
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [yr, setYr] = useState('');
  const [ty, setTy] = useState<BigEventType>('이사');
  const [result, setResult] = useState<ReturnType<typeof scoreTimePillars> | null>(null);

  const addEvent = () => {
    const y = parseInt(yr, 10);
    if (y > 1900 && y < 2100) { setEvents((p) => [...p, { year: y, type: ty }]); setYr(''); }
  };
  const removeEvent = (i: number) => setEvents((p) => p.filter((_, idx) => idx !== i));

  const run = () => {
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) { setResult(null); return; }
    // 시각은 스코어러가 12후보로 덮어쓰므로 임시값. timeAccuracy 는 무관(시 모름).
    const input: ChartInput = { birthDateTime: `${date} 12:00`, calendar: '양', timeAccuracy: '미상', sex, birthPlace: place };
    setResult(scoreTimePillars(input, { events }));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: '태어난 시 찾기' }} />
      <Text style={styles.lead}>태어난 시간을 몰라도, 인생 사건으로 시(時)를 좁혀 드려요. 사건을 더 넣을수록 정확해져요.</Text>

      <Text style={styles.label}>생년월일 (양력)</Text>
      <TextInput value={date} onChangeText={setDate} placeholder="예: 1994-03-16" placeholderTextColor={colors.inkFaint} style={styles.input} />

      <Text style={styles.label}>성별</Text>
      <View style={styles.chipRow}>
        {(['남', '여'] as const).map((g) => (
          <Pressable key={g} onPress={() => setSex(g)} style={[styles.chip, sex === g && styles.chipOn]}>
            <Text style={sex === g ? styles.chipTxOn : styles.chipTx}>{g}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>출생지</Text>
      <TextInput value={place} onChangeText={setPlace} placeholder="예: 전라남도 여수" placeholderTextColor={colors.inkFaint} style={styles.input} />

      <Text style={styles.label}>인생 사건 (연도 + 유형)</Text>
      <TextInput value={yr} onChangeText={setYr} placeholder="연도 (예: 2023)" placeholderTextColor={colors.inkFaint} keyboardType="number-pad" style={styles.input} />
      {/* 연도 입력과 카테고리 선택 사이 — 다른 label→input 간격(space(2))과 균일하게 */}
      <View style={[styles.chipRow, { marginTop: space(2) }]}>
        {EVENT_TYPES.map((t) => (
          <Pressable key={t} onPress={() => setTy(t)} style={[styles.chip, ty === t && styles.chipOn]}>
            <Text style={ty === t ? styles.chipTxOn : styles.chipTx}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={addEvent} style={styles.addBtn}><Text style={styles.addTx}>+ 사건 추가</Text></Pressable>
      {events.map((e, i) => (
        <Pressable key={`${e.year}-${e.type}-${i}`} onPress={() => removeEvent(i)} style={styles.evItem}>
          <Text style={styles.evTx}>· {e.year}년 · {e.type}</Text><Text style={styles.evDel}>✕</Text>
        </Pressable>
      ))}

      <Pressable onPress={run} style={styles.runBtn}><Text style={styles.runTx}>후보 좁히기</Text></Pressable>

      {result && <ResultView result={result} />}
    </ScrollView>
  );
}

function ResultView({ result }: { result: ReturnType<typeof scoreTimePillars> }) {
  const { ranked, verdict } = result;
  const head = verdict.kind === 'confirmed' ? '1순위로 좁혀졌어요'
    : verdict.kind === 'shortlist' ? '유력 후보 2~3개로 좁혔어요'
      : '아직 확정이 어려워요 — 사건을 더 넣어 주세요';
  const show = verdict.kind === 'confirmed' ? 1 : verdict.kind === 'shortlist' ? 3 : 5;
  return (
    <View style={styles.result}>
      <Text style={styles.resultH}>{head}</Text>
      {ranked.slice(0, show).map((c, i) => (
        <View key={c.candidate.branch} style={styles.cand}>
          <Text style={styles.candKey}>{i + 1}. {branchReading(c.candidate.branch)}시 ({stemReading(c.candidate.stem)}{branchReading(c.candidate.branch)})</Text>
          <View style={styles.barBg}><View style={[styles.bar, { width: `${Math.max(4, Math.round(c.prob * 100))}%` }]} /></View>
          <Text style={styles.candPct}>{Math.round(c.prob * 100)}%</Text>
        </View>
      ))}
      <Text style={styles.disc}>※ 사건이 많을수록 정확해져요. 추정 결과이며, 정확한 풀이는 시를 확정한 뒤 원국 전체로 봅니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(6), paddingBottom: space(12) },
  lead: { ...font.caption, color: colors.inkSoft, lineHeight: 20, marginBottom: space(5) },
  label: { fontSize: 13, fontWeight: '800', color: colors.ju, marginTop: space(4), marginBottom: space(2) },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.5), paddingVertical: space(3), color: colors.ink, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 14, color: colors.inkSoft, fontWeight: '700' },
  chipTxOn: { fontSize: 14, color: colors.bg, fontWeight: '800' },
  addBtn: { marginTop: space(3), alignSelf: 'flex-start', paddingHorizontal: space(4), paddingVertical: space(2.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ju },
  addTx: { color: colors.ju, fontWeight: '800', fontSize: 14 },
  evItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(2) },
  evTx: { color: colors.inkSoft, fontSize: 14 },
  evDel: { color: colors.inkFaint, fontSize: 14, paddingHorizontal: space(2) },
  runBtn: { marginTop: space(6), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  runTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  result: { marginTop: space(7), padding: space(5), borderRadius: radius.md, backgroundColor: 'rgba(34,31,68,0.5)', borderWidth: 1, borderColor: colors.ju },
  resultH: { fontSize: 17, fontWeight: '800', color: colors.ju, marginBottom: space(4) },
  cand: { flexDirection: 'row', alignItems: 'center', marginBottom: space(3), gap: space(2) },
  candKey: { fontSize: 14, fontWeight: '700', color: colors.ink, width: 130 },
  barBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.sunk, overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.ju },
  candPct: { fontSize: 13, fontWeight: '800', color: colors.ju, width: 42, textAlign: 'right' },
  disc: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 18 },
});
