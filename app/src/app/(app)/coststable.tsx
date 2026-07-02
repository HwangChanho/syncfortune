// src/app/(app)/coststable.tsx — 컨텐츠 비용·수익 분석 (daniel 내부 검토용)
// ─────────────────────────────────────────────────────────────────────────
// ★ 원가(API)는 *추측 금지·실측*: Edge가 Anthropic 응답 usage(실제 토큰)를 api_usage에 적재 →
//   usage_cost_by_kind() RPC가 요청당 실측 ₩ 평균을 반환. 데이터 없으면 "측정 필요"로 정직 표시.
//   가격=확정(앱 판매가). 광고=추정(보상형 eCPM·배너, 명시적 '추정' 라벨). 무료 온디바이스=API 0원.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
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
  { name: '사주 풀이(16영역)', kind: 'saju', mult: 16, type: '유료', api: true, price: 19900, adEst: 0 },
  { name: '자미두수(12궁)', kind: 'ziwei', mult: 12, type: '유료', api: true, price: 14900, adEst: 0 },
  { name: '궁합', kind: 'compat', mult: 1, type: '유료', api: true, price: 4900, adEst: 0 },
  { name: '나의 애정흐름', kind: 'love', mult: 1, type: '유료', api: true, price: 9900, adEst: 0 },
  { name: '인생 타임라인', kind: 'timeline', mult: 1, type: '유료', api: true, price: 1990, adEst: 0 },
  { name: '추가 질문', kind: 'followup', mult: 1, type: '유료', api: true, price: 990, adEst: 0 },
  { name: '신년운세', kind: 'newyear', mult: 1, type: '유료', api: true, price: 9900, adEst: 0 },
  { name: '인생 그래프', kind: 'lifegraph', mult: 1, type: '유료', api: true, price: 3900, adEst: 0 },
  { name: '명식의 뿌리', kind: 'roots', mult: 1, type: '유료', api: true, price: 4900, adEst: 0 },
  { name: '비치는 나', kind: 'image', mult: 1, type: '유료', api: true, price: 4900, adEst: 0 },
  { name: '나의 사명', kind: 'mission', mult: 1, type: '유료', api: true, price: 6900, adEst: 0 },
  { name: '사업가의 나', kind: 'career', mult: 1, type: '유료', api: true, price: 4900, adEst: 0 },
  { name: 'AI 꿈해몽(개당)', kind: 'dream', mult: 1, type: '유료', api: true, price: 500, adEst: 0 },
];

const SCALES = [1, 10, 100, 1000];
const won = (n: number) => '₩' + Math.round(n).toLocaleString();
// ⑥ 가격 실수령(daniel) — 애플 인앱 수수료 + 세금 차감 후 실제 손에 들어오는 돈
const APPLE_CUT = 0.30; // 애플 인앱 수수료(연 100만달러 미만 소규모 15% 가능하나 보수적 30%)
const TAX_RATE = 0.10;  // 세금(사업소득세 등 — ★daniel 실제 세율로 조정). 부가세는 애플이 별도 처리
const netPrice = (price: number) => price * (1 - APPLE_CUT) * (1 - TAX_RATE); // 실수령 = 판매가×(1−수수료)×(1−세금)

export default function CostTableScreen() {
  const [n, setN] = useState(1000);
  // kind → 요청당 실측 ₩ 평균(영역 단위). null = 아직 측정값 없음
  const [costMap, setCostMap] = useState<Record<string, number> | null>(null);
  // daniel #14: 풀이(kind×category) 단위 실측 원가 — 타임라인 대운/연도·궁합 관계별·사주 영역별 각각
  const [catRows, setCatRows] = useState<{ kind: string; category: string; reqs: number; avg: number }[] | null>(null);

  useEffect(() => {
    // 실측 비용 RPC — Edge가 적재한 api_usage 집계(요청당 평균 ₩)
    (async () => {
      try {
        const { data } = await supabase.rpc('usage_cost_by_kind');
        const m: Record<string, number> = {};
        (data ?? []).forEach((r: any) => { m[r.kind] = Number(r.avg_won_per_req) || 0; });
        setCostMap(m);
      } catch { setCostMap({}); }
      // 풀이별(시기·관계·영역) 세분 원가(daniel #14)
      try {
        const { data } = await supabase.rpc('usage_cost_by_category');
        setCatRows((data ?? []).map((r: any) => ({ kind: r.kind, category: r.category, reqs: Number(r.reqs) || 0, avg: Number(r.avg_won_per_req) || 0 })));
      } catch { setCatRows([]); }
    })();
  }, []);

  // 컨텐츠 1회 원가(실측). 온디바이스=0(실측 불필요), api인데 측정값 없으면 null(측정 필요)
  const genCost = (r: Row): number | null => {
    if (!r.api) return 0;
    if (!costMap) return null;
    const per = costMap[r.kind];
    return per == null ? null : per * r.mult;
  };

  // 합계(측정값 있는 행만). ★광고 제외 원가산출(daniel): 순익=판매가−원가만, 광고 수익은 별도(충당 불확실).
  let totCost = 0, totRev = 0, totAd = 0, totNet = 0, unknown = 0;
  ROWS.forEach((r) => {
    const c = genCost(r);
    if (c == null) { unknown++; return; }
    totCost += c * n; totRev += r.price * n; totAd += r.adEst * n; totNet += netPrice(r.price) * n;
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
          <PressableScale key={s} style={[styles.scaleBtn, n === s && styles.scaleOn]} onPress={() => setN(s)}>
            <Text style={[styles.scaleTx, n === s && styles.scaleTxOn]}>{s.toLocaleString()}인</Text>
          </PressableScale>
        ))}
      </View>

      <View style={styles.sumCard}>
        <View style={styles.sumItem}><Text style={styles.sumLabel}>총 원가(실측)</Text><Text style={[styles.sumVal, { color: '#E5484D' }]}>{won(totCost)}</Text></View>
        <View style={styles.sumItem}><Text style={styles.sumLabel}>실수령(수수료·세금 후)</Text><Text style={[styles.sumVal, { color: '#3FA7A0' }]}>{won(totNet)}</Text></View>
        <View style={styles.sumItem}><Text style={styles.sumLabel}>순마진(실수령−원가)</Text><Text style={[styles.sumVal, { color: colors.ju }]}>{won(totNet - totCost)}</Text></View>
      </View>
      <Text style={styles.adNote}>판매가 합계 {won(totRev)} → 애플 {Math.round(APPLE_CUT * 100)}%·세금 {Math.round(TAX_RATE * 100)}% 차감 = 실수령 {won(totNet)}(원가 차감 전). 광고(추정·별도) {won(totAd)}는 순익에서 제외(daniel).</Text>
      {!!unknown && <Text style={styles.warn}>⚠ {unknown}개 컨텐츠는 아직 실측값 없음(측정 필요) — 합계에서 제외. 해당 통변을 1회 생성하면 실측 채워짐.</Text>}

      <View style={[styles.row, styles.head]}>
        <Text style={[styles.cName, styles.hTx]}>컨텐츠</Text>
        <Text style={[styles.cType, styles.hTx]}>유형</Text>
        <Text style={[styles.cNum, styles.hTx]}>원가/회</Text>
        <Text style={[styles.cNum, styles.hTx]}>가격/광고</Text>
        <Text style={[styles.cNum, styles.hTx]}>순마진·수수료세금후({n.toLocaleString()}인)</Text>
      </View>

      {ROWS.map((r) => {
        const c = genCost(r);
        const net = c == null ? null : (netPrice(r.price) - c) * n; // ⑥ 실수령(수수료·세금 후)−원가 = 순마진. 광고무료(price 0)는 −원가
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

      {/* daniel #14: 풀이별(시기·관계·영역) 실측 원가 — 타임라인 대운/연도·궁합 관계별·사주 영역별 각각 얼마인지 */}
      <Text style={[styles.title, { marginTop: space(8) }]}>풀이별 실측 원가</Text>
      <Text style={styles.note}>각 풀이(타임라인 시기·궁합 관계·사주 영역 등) 1회 실측 원가(요청당 평균 ₩). 차트별 간지는 묶어 풀이 유형으로 집계 — 데이터 쌓일수록 정확.</Text>
      {catRows == null ? (
        <Text style={styles.foot}>측정 중…</Text>
      ) : catRows.length === 0 ? (
        <Text style={styles.foot}>아직 생성 데이터가 없어요(풀이 생성 후 채워짐).</Text>
      ) : (
        catRows.map((r) => (
          <View key={r.kind + '|' + r.category} style={styles.row}>
            <Text style={styles.cName} numberOfLines={1}>{r.kind}</Text>
            <Text style={[styles.cType, { color: colors.inkSoft, flex: 1.6 }]} numberOfLines={1}>{r.category}</Text>
            <Text style={[styles.cNum, { color: '#E5484D' }]}>{won(r.avg)}</Text>
            <Text style={styles.cNum}>{r.reqs}회</Text>
          </View>
        ))
      )}
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
  adNote: { fontSize: 11, color: '#E5A93F', marginBottom: space(3), lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(2.25), borderBottomWidth: 1, borderBottomColor: colors.line },
  head: { borderBottomWidth: 1.5, borderBottomColor: colors.ju, paddingBottom: space(2) },
  hTx: { fontWeight: '800', color: colors.ju, fontSize: 11 },
  cName: { flex: 2.2, fontSize: 12.5, color: colors.ink, fontWeight: '600' },
  cType: { flex: 1.3, fontSize: 10.5, fontWeight: '700' },
  cNum: { flex: 1.4, fontSize: 11.5, color: colors.ink, textAlign: 'right' },
  foot: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 16 },
});
