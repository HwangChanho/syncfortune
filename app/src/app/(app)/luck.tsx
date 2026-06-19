// src/app/(app)/luck.tsx — 오늘의 행운 아이템 (가볍게·무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 오늘 일진 오행 = 오늘의 기운 → 행운 색·방향·숫자·아이템(lib/luckyItem). 명식 있으면 부족 오행 보완색 추가.
//   규칙5: 무료=온디바이스(API 0). §4: 가벼운 재미 — 단정 없이 '곁에 두면 좋은 결'.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ImageBackground, Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { luckyToday, weakElementColor } from '../../lib/luckyItem';
import { loadMyChart } from '../../lib/myChart';
import { computeChart } from '../../lib/engine';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import type { ChartInput } from '@spec/chart';

export default function LuckScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const lucky = useMemo(() => luckyToday(), []);
  const [me, setMe] = useState<ChartInput | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) setMe(c); });
    return () => { alive = false; };
  }, []));

  const weak = useMemo(() => (me ? weakElementColor(computeChart(me).saju) : null), [me]);

  // 행운 색 스와치 — 은은한 글로우 펄스(보는 맛)
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ])).start();
  }, [glow]);
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const glowOp = glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { fontSize: fs(15) }]}>{value}</Text>
    </View>
  );

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단) */}
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />
        <Text style={styles.h}>{t('luck.title', '오늘의 행운')}</Text>
        <Text style={styles.sub}>{lucky.date} · {t('luck.todayEnergy', '오늘의 기운')} {lucky.elemLabel}</Text>

        {/* 대표 행운 색 — 큰 스와치 */}
        <View style={styles.swatchCard}>
          <View style={styles.swatchWrap}>
            <Animated.View style={[styles.swatchGlow, { backgroundColor: lucky.hex, opacity: glowOp, transform: [{ scale: glowScale }] }]} />
            <View style={[styles.swatch, { backgroundColor: lucky.hex }]} />
          </View>
          <View style={styles.swatchText}>
            <Text style={styles.swatchLabel}>{t('luck.color', '행운의 색')}</Text>
            <Text style={[styles.swatchValue, { fontSize: fs(20) }]}>{lucky.color}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label={t('luck.direction', '행운의 방향')} value={lucky.dir} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('luck.numbers', '행운의 숫자')}</Text>
            <View style={styles.numWrap}>
              {lucky.nums.map((n) => (
                <View key={n} style={[styles.numBadge, { borderColor: lucky.hex }]}><Text style={[styles.numTx, { color: lucky.hex }]}>{n}</Text></View>
              ))}
            </View>
          </View>
          <Row label={t('luck.item', '행운의 아이템')} value={lucky.item} />
        </View>

        {/* 명식 있으면 — 내게 부족한 기운 보완색(상시) */}
        {weak && (
          <View style={styles.card}>
            <Text style={styles.weakHead}>{t('luck.weakHead', '내게 보탬이 되는 색')}</Text>
            <View style={styles.weakRow}>
              <View style={[styles.weakDot, { backgroundColor: weak.hex }]} />
              <Text style={[styles.weakTx, { fontSize: fs(15) }]}>{weak.color}{t('luck.weakTail', ' — 내 사주에 부족하기 쉬운 기운이라, 곁에 두면 균형이 살아나요.')}</Text>
            </View>
          </View>
        )}

        <Text style={styles.note}>{t('luck.note', '※ 가볍게 즐기는 오늘의 길잡이예요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)' },
  wrap: { padding: space(6), paddingBottom: space(12) },
  h: { ...font.title, color: colors.ink, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5) },
  swatchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(3), ...shadow.card },
  swatchWrap: { width: 64, height: 64, marginRight: space(4), alignItems: 'center', justifyContent: 'center' },
  swatchGlow: { position: 'absolute', width: 64, height: 64, borderRadius: radius.md }, // 펄스 글로우(뒤에서 번짐)
  swatch: { width: 64, height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  numWrap: { flexDirection: 'row', gap: space(2) },
  numBadge: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, // 행운 숫자 원형 배지
  numTx: { fontSize: 16, fontWeight: '900' },
  swatchText: { flex: 1 },
  swatchLabel: { ...font.caption, color: colors.inkSoft, marginBottom: space(1) },
  swatchValue: { fontSize: 20, fontWeight: '900', color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(2) },
  rowLabel: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  rowValue: { ...font.body, color: colors.ink, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: space(3) },
  weakHead: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(2.5) },
  weakRow: { flexDirection: 'row', alignItems: 'flex-start' },
  weakDot: { width: 20, height: 20, borderRadius: 10, marginRight: space(3), marginTop: 2 },
  weakTx: { ...font.body, color: colors.ink, flex: 1, lineHeight: 23 },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4) },
});
