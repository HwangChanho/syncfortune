// src/app/(app)/today.tsx — 오늘의 운세 (무료, 광고 진입, 한지·먹 테마). 오늘 일진(온디바이스).
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getDailyFortune } from '../../lib/dailyFortune';
import { colors, space, font } from '../../lib/theme';

export default function TodayScreen() {
  const { t } = useTranslation();
  const f = useMemo(() => getDailyFortune(), []);
  return (
    <View style={styles.c}>
      <Text style={styles.icon}>📅</Text>
      <Text style={styles.title}>{t('menu.today')}</Text>
      <Text style={styles.date}>{f.date}</Text>
      <Text style={styles.pillar}>{t('today.dayPillar')}: {f.dayGanZhi}</Text>
      <Text style={styles.sub}>{t('today.note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space(2), padding: space(6), backgroundColor: colors.bg },
  icon: { fontSize: 48 },
  title: { ...font.title },
  date: { ...font.caption, marginTop: space(1) },
  pillar: { fontSize: 32, fontWeight: '700', color: colors.ju, marginTop: space(3), letterSpacing: 2 },
  sub: { ...font.caption, textAlign: 'center', marginTop: space(3), lineHeight: 19 },
});
