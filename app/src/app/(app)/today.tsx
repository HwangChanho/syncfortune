// src/app/(app)/today.tsx — 오늘의 운세 (무료, 광고 진입, 한지·먹 테마). 오늘 일진(온디바이스).
import { useMemo } from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getDailyFortune } from '../../lib/dailyFortune';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading } from '../../lib/ohaeng';

function CornerPattern({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position.startsWith('t');
  const isLeft = position.endsWith('l');
  return (
    <View style={[
      styles.corner,
      isTop ? { top: 10 } : { bottom: 10 },
      isLeft ? { left: 10 } : { right: 10 },
      { transform: [{ rotate: isTop ? (isLeft ? '0deg' : '90deg') : (isLeft ? '270deg' : '180deg') }] }
    ]}>
      <Text style={styles.cornerText}>﹃</Text>
    </View>
  );
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const f = useMemo(() => getDailyFortune(), []);
  
  const stem = f.dayGanZhi[0];
  const branch = f.dayGanZhi[1];
  const el = stemElement(stem);
  const bgColor = elementColor[el];
  const txtColor = elementText[el];

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bgImage} resizeMode="cover">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <CornerPattern position="tl" />
          <CornerPattern position="tr" />
          <CornerPattern position="bl" />
          <CornerPattern position="br" />
          
          <Text style={styles.date}>{f.date}</Text>
          <Text style={styles.title}>{t('today.dayPillar')}</Text>
          
          <View style={styles.pillarContainer}>
            <View style={[styles.gzBox, { backgroundColor: bgColor }]}>
              <Text style={[styles.gzChar, { color: txtColor }]}>{stem}</Text>
              <Text style={[styles.gzKo, { color: txtColor }]}>{stemReading(stem)}</Text>
            </View>
            <View style={[styles.gzBox, { backgroundColor: elementColor[branchElement(branch)] }]}>
              <Text style={[styles.gzChar, { color: elementText[branchElement(branch)] }]}>{branch}</Text>
              <Text style={[styles.gzKo, { color: elementText[branchElement(branch)] }]}>{branchReading(branch)}</Text>
            </View>
          </View>

          <View style={styles.divider} />
          
          <Text style={styles.ganzhiText}>{f.dayGanZhi} ({t('myeongsik.dayPillar')})</Text>
          <Text style={styles.sub}>{t('today.note')}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>{f.yearGanZhi}년 {f.monthGanZhi}월</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)', justifyContent: 'center', alignItems: 'center', padding: space(6) },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space(8),
    alignItems: 'center',
    ...shadow.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  corner: { position: 'absolute' },
  cornerText: { color: colors.ju, fontSize: 24, fontWeight: '300', opacity: 0.6 },
  date: { ...font.caption, color: colors.ju, marginBottom: space(1), fontWeight: '700' },
  title: { ...font.title, marginBottom: space(8) },
  pillarContainer: { flexDirection: 'row', gap: space(4), marginBottom: space(8) },
  gzBox: {
    width: 80,
    height: 110,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.soft,
  },
  gzChar: { fontSize: 42, fontWeight: '800' },
  gzKo: { fontSize: 14, fontWeight: '600', marginTop: space(1) },
  divider: { width: 40, height: 2, backgroundColor: colors.line, marginBottom: space(6) },
  ganzhiText: { ...font.heading, color: colors.ink, marginBottom: space(4) },
  sub: { ...font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 22 },
  infoRow: { marginTop: space(6) },
  infoText: { ...font.caption, color: colors.inkFaint },
});
