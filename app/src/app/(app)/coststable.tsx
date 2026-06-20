// src/app/(app)/coststable.tsx — 컨텐츠 비용·수익 분석 (daniel 내부 검토용)
// ─────────────────────────────────────────────────────────────────────────
// ★ 원가(API)는 *추측 금지·실측*: Edge가 Anthropic 응답 usage(실제 토큰)를 api_usage에 적재 →
//   usage_cost_by_kind() RPC가 요청당 실측 ₩ 평균을 반환. 데이터 없으면 "측정 필요"로 정직 표시.
//   가격=확정(앱 판매가). 광고=추정(보상형 eCPM·배너, 명시적 '추정' 라벨). 무료 온디바이스=API 0원.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors, space, radius, font } from '../../lib/theme';

type Row = {
  name: string;
  kind: string;   // api_usage kind (실측 조회 키). 온디바이스는 ''
  mult: number;   // 1회 통변 = 영역수 (사주 16·자미 12·그 외 1). 실측(영역당)×mult = 통변 1회 원가
  type: '무료' | '광고무료' | '유료';
  api: boolean;
  price: number;  // 확정 판매가(₩)
  adEst: number;  // 광고 수익 *추정*(₩/회) — 보상형≈20·배너≈3
};

// 가격·분류·영역수는 확정 사실. 원가는 실측 RPC로 채움(아래 costMap).
const ROWS: Row[] = [
  { name: '만세력', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '신살·공망', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '타로', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '나의 특징', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '일주론', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '반려동물', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '성격유형', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '에겐·테토', kind: 'egen', mult: 1, type: '무료', api: true, price: 0, adEst: 3 },
  { name: '조선시대 직업', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '연애 스타일', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '타고난 복', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '전생 이야기', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '나만의 힐링', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '택일', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '오늘의 행운', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '띠·별자리', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '이름풀이', kind: '', mult: 1, type: '무료', api: false, price: 0, adEst: 3 },
  { name: '오늘의 운세', kind: 'daily', mult: 1, type: '광고무료', api: true, price: 0, adEst: 20 },
  { name: '이달의 운세', kind: 'monthly', mult: 1, type: '광고무료', api: true, price: 0, adEst: 20 },
  { name: '사주 풀이(16영역)', kind: 'saju', mult: 16, type: '유료', api: true, price: 9900, adEst: 0 },
  { name: '자미두수(12궁)', kind: 'ziwei', mult: 12, type: '유료', api: true, price: 8900, adEst: 0 },
  { name: '궁합', kind: 'compat', mult: 1, type: '유료', api: true, price: 3900, adEst: 0 },
  { name: '나의 애정흐름', kind: 'love', mult: 1, type: '유료', api: true, price: 4900, adEst: 0 },
  { name: '인생 타임라인', kind: 'timeline', mult: 1, type: '유료', api: true, price: 990, adEst: 0 },
  { name: '추가 질문', kind: 'followup', mult: 1, type: '유료', api: true, price: 990, adEst: 0 },
  { name: '신년운세', kind: 'newyear', mult: 1, type: '유료', api: true, price: 6900, adEst: 0 },
  { name: '인생 그래프', kind: 'lifegraph', mult: 1, type: '유료', api: true, price: 3900, adEst: 0 },
  { name: '명식의 뿌리', kind: 'roots', mult: 1, type: '유료', api: true, price: 4900, adEst: 0 },
  { name: '비치는 나', kind: 'image', mult: 1, type: '유료', api: true, price: 4900, adEst: 0 },
  { name: '나의 사명', kind: 'mission', mult: 1, type: '유료', api: true, price: 6900, adEst: 0 },
  { name: '사업가의 나', kind: 'career', mult: 1, type: '유료', api: true, price: 4900, adEst: 0 },
  { name: 'AI 꿈해몽', kind: 'dream', mult: 1, type: '유료', api: true, price: 240, adEst: 0 },
];

const SCALES = [1, 10, 100, 1000];
const won = (n: number) => '₩' + Math.round(n).toLocaleString();

export default function CostTableScreen() {
  const [n, setN] = useState(1000);
  // kind → 요청당 실측 ₩ 평균(영역 단위). null = 아직 측정값 없음
  const [costMap, setCostMap] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    // 실측 비용 RPC — Edge가 적재한 api_usage 집계(요청당 평균 ₩)
    (async () => {
      try {
        const { data } = await supabase.rpc('usage_cost_by_kind');
        const m: Record<string, number> = {};
        (data ?? []).forEach((r: any) => { m[r.kind] = Number(r.avg_won_per_req) || 0; });
        setCostMap(m);
      } catch { setCostMap({}); }
    })();
  }, []);

  // 컨텐츠 1회 원가(실측). 온디바이스=0(실측 불필요), api인데 측정값 없으면 null(측정 필요)
  const genCost = (r: Row): number | null => {
    if (!r.api) return 0;
    if (!costMap) return null;
    const per = costMap[r.kind];
    return per == null ? null : per * r.mult;
  };

  // 합계(측정값 있는 행만) — 측정 안 된 행 수 표기
  let totCost = 0, totRev = 0, unknown = 0;
  ROWS.forEach((r) => {
    const c = genCost(r);
    if (c == null) { unknown++; return; }
    totCost += c * n; totRev += (r.price + r.adEst) * n;
  });

  const typeColor = (t: Row['type']) => t === '유료' ? colors.ju : t === '광고무료' ? '#3FA7A0' : colors.inkSoft;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>컨텐츠 비용·수익 분석</Text>
      <Text style={styles.note}>
        원가=<Text style={{ color: colors.ju, fontWeight: '800' }}>실측</Text>(Anthropic usage 토큰→₩, 통변 생성 시 자동 적재). 측정 전이면 "측정 필요".
        가격=확정. 광고=<Text style={{ color: '#E5A93F' }}>추정</Text>(보상형≈₩20·배너≈₩3).
      </Text>

      <View style={styles.scaleRow}>
        {SCALES.map((s) => (
          <Pressable key={s} style={[styles.scaleBtn, n === s && styles.scaleOn]} onPress={() => setN(s)}>
            <Text style={[styles.scaleTx, n === s && styles.scaleTxOn]}>{s.toLocaleString()}인</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sumCard}>
        <View style={styles.sumItem}><Text style={styles.sumLabel}>총 원가(실측)</Text><Text style={[styles.sumVal, { color: '#E5484D' }]}>{won(totCost)}</Text></View>
        <View style={styles.sumItem}><Text style={styles.sumLabel}>총 수익</Text><Text style={[styles.sumVal, { color: '#3FA7A0' }]}>{won(totRev)}</Text></View>
        <View style={styles.sumItem}><Text style={styles.sumLabel}>순익</Text><Text style={[styles.sumVal, { color: colors.ju }]}>{won(totRev - totCost)}</Text></View>
      </View>
      {!!unknown && <Text style={styles.warn}>⚠ {unknown}개 컨텐츠는 아직 실측값 없음(측정 필요) — 합계에서 제외. 해당 통변을 1회 생성하면 실측 채워짐.</Text>}

      <View style={[styles.row, styles.head]}>
        <Text style={[styles.cName, styles.hTx]}>컨텐츠</Text>
        <Text style={[styles.cType, styles.hTx]}>유형</Text>
        <Text style={[styles.cNum, styles.hTx]}>원가/회</Text>
        <Text style={[styles.cNum, styles.hTx]}>가격/광고</Text>
        <Text style={[styles.cNum, styles.hTx]}>순익({n.toLocaleString()}인)</Text>
      </View>

      {ROWS.map((r) => {
        const c = genCost(r);
        const net = c == null ? null : (r.price + r.adEst - c) * n;
        return (
          <View key={r.name} style={styles.row}>
            <Text style={styles.cName} numberOfLines={1}>{r.name}</Text>
            <Text style={[styles.cType, { color: typeColor(r.type) }]}>{r.type}{r.api ? '·API' : ''}</Text>
            <Text style={[styles.cNum, { color: c == null ? '#E5A93F' : c ? '#E5484D' : colors.inkFaint }]}>
              {c == null ? '측정필요' : c ? won(c) : '0'}
            </Text>
            <Text style={styles.cNum}>{r.price ? won(r.price) : r.adEst ? '광고~' + won(r.adEst) : '-'}</Text>
            <Text style={[styles.cNum, { color: net == null ? colors.inkFaint : net >= 0 ? '#3FA7A0' : '#E5484D', fontWeight: '800' }]}>
              {net == null ? '—' : won(net)}
            </Text>
          </View>
        );
      })}
      <Text style={styles.foot}>
        ※ 원가는 신규 생성 1회 기준 — 캐시(차트×영역 1회=영구)로 재방문은 0원이라 실제 누적 마진은 더 큼.
        사주=영역당 실측×16, 자미=×12. 광고 수익은 eCPM·충전율에 따라 변동(추정).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: space(4), paddingBottom: space(12) },
  title: { ...font.title, color: colors.ink, marginBottom: space(1) },
  note: { ...font.caption, color: colors.inkSoft, lineHeight: 17, marginBottom: space(4) },
  scaleRow: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  scaleBtn: { flex: 1, paddingVertical: space(2.5), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  scaleOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  scaleTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  scaleTxOn: { color: colors.bg },
  sumCard: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(2) },
  sumItem: { flex: 1, alignItems: 'center' },
  sumLabel: { fontSize: 11, color: colors.inkSoft, marginBottom: space(1) },
  sumVal: { fontSize: 15, fontWeight: '900' },
  warn: { fontSize: 11, color: '#E5A93F', marginBottom: space(3), lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(2.25), borderBottomWidth: 1, borderBottomColor: colors.line },
  head: { borderBottomWidth: 1.5, borderBottomColor: colors.ju, paddingBottom: space(2) },
  hTx: { fontWeight: '800', color: colors.ju, fontSize: 11 },
  cName: { flex: 2.2, fontSize: 12.5, color: colors.ink, fontWeight: '600' },
  cType: { flex: 1.3, fontSize: 10.5, fontWeight: '700' },
  cNum: { flex: 1.4, fontSize: 11.5, color: colors.ink, textAlign: 'right' },
  foot: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 16 },
});
