// app/src/components/YongsinCard.tsx — 만세력 용신 카드(canonical 엔진 산출·API 0)
// ─────────────────────────────────────────────────────────────────────────
// Boss 2026-07-22: "만세력에 용신도 잡아주면 좋겠어(격국용신·억부용신·희신 등)".
//   용신 '결정'은 canonical `computeYongsinApprox`(daniel 승인·골든 검증·앱=canonical 위임)에 넘긴다 —
//   명리 발명 없음([[yongsin-app-engine-drift]]). 이 카드는 그 결과를 만세력에 표시만.
//
// ▶ 엔진은 우선순위(종격→조후 urgent→병약→억부→중화조후)로 *하나의 주용신*을 잡고 method 로 관점을 알려준다:
//   method ∈ 억부·병약·조후·종격·통관 → 화면엔 "{method}용신"으로 표기(= 억부용신/병약용신/조후용신…).
//   희신(용신 생조)·기신(용신 극)·용신의 십신(인성/식상 등)도 함께.
// ⚠️**격국용신(상신)은 별도 관법 = daniel 스탠스 대기·미구현**([[yongsin-app-engine-drift]] line22 "구현 불가").
//   → 여기선 flag 만(관법 확정되면 이 카드에 한 줄 추가). method 설명 문구도 daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { computeYongsinApprox } from '../lib/content/yongsinApprox';
import { elementColor } from '../lib/engine/ohaeng';
import { colors, radius, space, font, shadow } from '../lib/theme';

// 오행 생/극(표준 통설) — 용신 오행의 십신(일간 기준) 산출용.
const GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // e가 생하는
const CTRL: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // e가 극하는
const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' };

/** 일간 오행 D 기준, 대상 오행 T 의 십신 그룹(비겁/식상/재성/관살/인성). */
function sipsinGroup(D: string, T: string): string {
  if (T === D) return '비겁';
  if (GEN[D] === T) return '식상';
  if (CTRL[D] === T) return '재성';
  if (CTRL[T] === D) return '관살';
  if (GEN[T] === D) return '인성';
  return '';
}

// 관점(method) 일상어 설명 — daniel 검수 슬롯(표준 통설 기반).
const METHOD_DESC: Record<string, string> = {
  억부: '일간의 강약을 조절하는 관점 — 강하면 덜어내고, 약하면 보강해요.',
  병약: '일간을 치는 병(病)을 다스리는 관점 — 관살을 인성으로 받아 돌리는 살인상생 등.',
  조후: '계절의 한난조습을 맞추는 관점 — 추우면 따뜻하게, 더우면 시원하게.',
  종격: '거스를 수 없는 한쪽 세력을 따르는 관점.',
  통관: '대립하는 두 세력을 이어주는 관점.',
};

/** 만세력 용신 카드. saju = computeChart 결과의 .saju. */
export function YongsinCard({ saju, timeUnknown }: { saju: SajuChart; timeUnknown?: boolean }) {
  const ys = useMemo(() => { try { return computeYongsinApprox(saju, { timeUnknown }); } catch { return null; } }, [saju, timeUnknown]);
  if (!ys) return null;
  const dayEl = String(saju.dayMaster?.element ?? '');

  const rows: { label: string; el: string | null }[] = [
    { label: '용신', el: ys.yongsin },
    { label: '희신', el: ys.huisin ?? null },
    { label: '기신', el: ys.gisin },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>용신</Text>
        <View style={styles.methodPill}><Text style={styles.methodTx}>{ys.method}용신</Text></View>
      </View>
      {rows.map((r) => r.el ? (
        <View key={r.label} style={styles.row}>
          <Text style={styles.rowLabel}>{r.label}</Text>
          <View style={[styles.elDot, { backgroundColor: elementColor[r.el] ?? colors.inkFaint }]} />
          <Text style={[styles.elTx, { color: elementColor[r.el] ?? colors.ink }]}>{r.el}({EL_KO[r.el] ?? r.el})</Text>
          <Text style={styles.sipsin}>{sipsinGroup(dayEl, r.el)}</Text>
        </View>
      ) : null)}
      {METHOD_DESC[ys.method] ? <Text style={styles.desc}>{METHOD_DESC[ys.method]}</Text> : null}
      {/* daniel stance: 용신 = '실제 써야 하는 기운'([[yongsin-app-engine-drift]]) · 격국용신은 관법 대기 */}
      <Text style={styles.note}>※ 실제로 ‘써야 하는 기운’으로 잡은 용신이에요. 격국용신(상신)은 관법 확정 후 추가될 예정.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginTop: space(3), marginBottom: space(2), ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  title: { ...font.heading, color: colors.ink, fontWeight: '900' },
  methodPill: { backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(0.5) },
  methodTx: { fontSize: 12, fontWeight: '800', color: colors.ju },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginVertical: space(0.5) },
  rowLabel: { ...font.body, color: colors.inkSoft, width: 40, fontWeight: '700' },
  elDot: { width: 12, height: 12, borderRadius: 6 },
  elTx: { fontSize: 15, fontWeight: '900', width: 78 },
  sipsin: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  desc: { ...font.caption, color: colors.inkSoft, marginTop: space(2), lineHeight: 18 },
  note: { ...font.caption, color: colors.inkFaint, fontSize: 11, marginTop: space(2), lineHeight: 16 },
});
