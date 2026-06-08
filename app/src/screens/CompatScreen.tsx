// app/src/screens/CompatScreen.tsx — 1:1 궁합 (L4, 관계역학, 다국어, 한지·먹 테마)
// ─────────────────────────────────────────────────────────────────────────
// 내 차트 + 상대 차트 → analyzeCompatibility(결정론: 일간관계·교차합충·용신상보).
// 통변(관계 조언)은 유료(Edge) / 개발은 Claude 직접(절대0). 규칙2: 사주 단독.
// 상대 = 타인 PII → 동의(consent) 필수(규칙8). P0는 직접 입력, 추후 저장된 N명 선택.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import { analyzeCompatibility } from '@engine/compatibility';
import { detectInteractionsAmong } from '@engine/structure';
import { stemElement, branchElement, elementColor, elementText } from '../lib/ohaeng';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { formatBirthDate } from '../lib/sijin';
import { BirthPlacePicker } from '../components/BirthPlacePicker';
import type { ChartInput } from '@spec/chart';

export function CompatScreen({ me }: { me: ChartInput | null }) {
  const { t } = useTranslation();
  const [oDate, setODate] = useState('');
  const [oTime, setOTime] = useState('');
  const [oSex] = useState<'남' | '여'>('여');
  const [oPlace, setOPlace] = useState(''); // 상대 출생지(도시 검색 — 명식폼과 통일, 진태양시 무관해 좌표는 생략)
  const [dx, setDx] = useState<ReturnType<typeof analyzeCompatibility> | null>(null);
  const [pair, setPair] = useState<{ me: any; other: any } | null>(null); // 두 명식(원국+대운+세운) 교차 작용용

  function analyze() {
    if (!me) return;
    const other: ChartInput = { birthDateTime: `${oDate} ${oTime || '0:0'}`, calendar: '양', timeAccuracy: oTime ? '정확' : '미상', sex: oSex, birthPlace: oPlace };
    const meChart = computeChart(me).saju;
    const otherChart = computeChart(other).saju;
    setDx(analyzeCompatibility(meChart, otherChart));
    setPair({ me: meChart, other: otherChart });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{t('compat.otherInfo')}</Text>
      <TextInput style={styles.input} value={oDate} onChangeText={(v) => setODate(formatBirthDate(v))}
        placeholder={t('compat.otherDatePh')} placeholderTextColor={colors.inkFaint} keyboardType="number-pad" maxLength={10} />
      <TextInput style={styles.input} value={oTime} onChangeText={setOTime}
        placeholder={t('compat.otherTimePh')} placeholderTextColor={colors.inkFaint} />
      <View style={styles.placeField}>
        <BirthPlacePicker value={oPlace} onSelect={(p) => setOPlace(p.name)} />
      </View>
      <Pressable style={styles.btn} onPress={analyze}><Text style={styles.btnText}>{t('compat.analyze')}</Text></Pressable>

      {dx && (
        <View style={styles.card}>
          <Text style={styles.kv}>{t('compat.dayRelation')}: {dx.dayMasterRelation.detail}</Text>
          <Text style={styles.kv}>{t('compat.harmonyTension', { h: dx.harmony.length, t: dx.tension.length })}</Text>
          <Text style={styles.kv}>{t('compat.usefulGod')}: {dx.usefulGodSupply.detail}</Text>
          <Text style={styles.kv}>{t('compat.crossInter')}: {dx.crossInteractions.map((c) => c.detail).join(', ') || t('common.none')}</Text>
          <Text style={styles.note}>{t('compat.note')}</Text>
        </View>
      )}

      {pair && (() => {
        const POSK = ['시', '일', '월', '년'] as const;
        const personPillars = (saju: any, who: string) => {
          const out: any[] = POSK.map((p) => ({ pos: `${who}${p}`, who, label: p, stem: saju.pillars[p].stem, branch: saju.pillars[p].branch }));
          if (saju.currentLuck) out.push({ pos: `${who}대운`, who, label: '대운', stem: saju.currentLuck.stem, branch: saju.currentLuck.branch });
          if (saju.annual) out.push({ pos: `${who}세운`, who, label: '세운', stem: saju.annual.stem, branch: saju.annual.branch });
          return out;
        };
        const mineP = personPillars(pair.me, '나'), othersP = personPillars(pair.other, '상대');
        const all = [...mineP, ...othersP];
        const cross = detectInteractionsAmong(all.map((x) => ({ pos: x.pos as any, stem: x.stem, branch: x.branch })))
          .filter((it) => String(it.members[0]).startsWith('나') !== String(it.members[1]).startsWith('나'));
        const findP = (pos: string) => all.find((x) => x.pos === pos);
        const typeColor = (ty: string) => (ty === '합' ? colors.ju : (ty === '충' || ty === '극') ? '#C0392B' : '#9A8CC0');
        const miniChart = (pillars: any[], title: string) => (
          <View>
            <Text style={styles.cmTitle}>{title}</Text>
            <View style={styles.cmRow}>
              {pillars.map((x, i) => (
                <View key={i} style={[styles.cmCol, (x.label === '대운' || x.label === '세운') && styles.cmColLuck]}>
                  <Text style={styles.cmLabel}>{x.label}</Text>
                  <View style={[styles.cmCell, { backgroundColor: elementColor[stemElement(x.stem)] }]}><Text style={[styles.cmTx, { color: elementText[stemElement(x.stem)] }]}>{x.stem}</Text></View>
                  <View style={[styles.cmCell, { backgroundColor: elementColor[branchElement(x.branch)] }]}><Text style={[styles.cmTx, { color: elementText[branchElement(x.branch)] }]}>{x.branch}</Text></View>
                </View>
              ))}
            </View>
          </View>
        );
        return (
          <View style={styles.crossWrap}>
            <Text style={styles.h}>글자 작용 비교 (나 ↔ 상대) — 원국·대운·세운</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space(2) }}>{miniChart(mineP, '나')}</ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{miniChart(othersP, '상대')}</ScrollView>
            <View style={styles.crossList}>
              {cross.length === 0 ? <Text style={styles.note}>두 명식 간 직접 합충형해가 없습니다.</Text> :
                ['합', '충', '형', '해', '파', '극'].map((ty) => {
                  const grp = cross.filter((it) => it.type === ty);
                  if (!grp.length) return null;
                  const col = typeColor(ty);
                  return (
                    <View key={ty} style={{ marginBottom: space(2) }}>
                      <Text style={[styles.cmGroupHead, { color: col }]}>● {ty} {grp.length}</Text>
                      {grp.map((it, i) => {
                        const isGan = it.level === '천간';
                        const pa = findP(String(it.members[0])), pb = findP(String(it.members[1]));
                        if (!pa || !pb) return null;
                        const ca = isGan ? pa.stem : pa.branch, cb = isGan ? pb.stem : pb.branch;
                        return (
                          <Text key={i} style={styles.cmLink}>
                            {pa.who}·{pa.label} <Text style={{ color: elementColor[isGan ? stemElement(ca) : branchElement(ca)], fontWeight: '800' }}>{ca}</Text>
                            {'  ⟷  '}
                            {pb.who}·{pb.label} <Text style={{ color: elementColor[isGan ? stemElement(cb) : branchElement(cb)], fontWeight: '800' }}>{cb}</Text>
                            {'   '}<Text style={{ color: col, fontWeight: '800' }}>{it.type}{it.transformsTo ? ` ${it.transformsTo}` : ''}</Text>
                          </Text>
                        );
                      })}
                    </View>
                  );
                })}
            </View>
          </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
  h: { ...font.heading, marginBottom: space(2.5) },
  placeField: { marginTop: space(2) },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    padding: space(3), fontSize: 15, color: colors.ink, marginTop: space(2), ...shadow.soft,
  },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(3.5), alignItems: 'center', marginTop: space(4), ...shadow.card },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  card: {
    marginTop: space(5), padding: space(4), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.card,
  },
  kv: { ...font.body, marginTop: space(1.5), lineHeight: 20 },
  note: { ...font.caption, marginTop: space(3.5) },
  // 글자 작용 비교 (나 ↔ 상대)
  crossWrap: { marginTop: space(5) },
  cmTitle: { ...font.caption, color: colors.ju, fontWeight: '700', marginBottom: space(1) },
  cmRow: { flexDirection: 'row', gap: space(1) },
  cmCol: { alignItems: 'center', width: 36 },
  cmColLuck: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  cmLabel: { fontSize: 9, color: colors.inkFaint, marginBottom: 2 },
  cmCell: { width: 30, height: 30, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  cmTx: { fontSize: 17, fontWeight: '800' },
  crossList: { marginTop: space(3), padding: space(3), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  cmGroupHead: { ...font.caption, fontWeight: '800', marginBottom: space(1) },
  cmLink: { ...font.body, color: colors.ink, paddingVertical: space(1) },
});
