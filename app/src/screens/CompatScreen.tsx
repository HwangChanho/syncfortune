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

  function analyze() {
    if (!me) return;
    const other: ChartInput = { birthDateTime: `${oDate} ${oTime || '0:0'}`, calendar: '양', timeAccuracy: oTime ? '정확' : '미상', sex: oSex, birthPlace: oPlace };
    const meChart = computeChart(me).saju;
    const otherChart = computeChart(other).saju;
    setDx(analyzeCompatibility(meChart, otherChart));
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
});
