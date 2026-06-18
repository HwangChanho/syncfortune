// src/app/(app)/zodiac.tsx — 띠·별자리 오늘운세 (가볍게·무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 띠(일진 지지 관계)·별자리(양력 12궁, 날짜 시드) 오늘 한 줄. 명식 있으면 내 띠/별자리 강조.
//   규칙5: 무료=온디바이스(API 0). §4: 가벼운 재미.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { chineseZodiacToday, westernZodiacToday, signOf } from '../../lib/zodiac';
import { loadMyChart } from '../../lib/myChart';
import { computeChart } from '../../lib/engine';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import type { ChartInput } from '@spec/chart';

export default function ZodiacScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [tab, setTab] = useState<'animal' | 'sign'>('animal');
  const [me, setMe] = useState<ChartInput | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) setMe(c); });
    return () => { alive = false; };
  }, []));

  const animal = useMemo(() => chineseZodiacToday(), []);
  const western = useMemo(() => westernZodiacToday(), []);

  // 내 띠(년지) · 내 별자리(양력 생월일 — 양력 명식만)
  const myBranch = useMemo(() => (me ? computeChart(me).saju.pillars['년']?.branch : undefined), [me]);
  const mySign = useMemo(() => {
    if (!me || me.calendar !== '양') return undefined;
    const d = new Date(me.birthDateTime);
    return Number.isNaN(d.getTime()) ? undefined : signOf(d.getMonth() + 1, d.getDate());
  }, [me]);

  const list = tab === 'animal' ? animal.items : western.items;
  const mineKey = tab === 'animal' ? myBranch : mySign;

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ContentHero image={require('../../../assets/icons/zodiac.png')} title={t('zodiac.title', '띠·별자리 오늘운세')} sub={animal.date} />

        {/* 토글 */}
        <View style={styles.toggle}>
          {([['animal', t('zodiac.animal', '띠')], ['sign', t('zodiac.sign', '별자리')]] as const).map(([k, l]) => (
            <Pressable key={k} style={[styles.togBtn, tab === k && styles.togBtnOn]} onPress={() => setTab(k)}>
              <Text style={[styles.togTx, tab === k && styles.togTxOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {list.map((it) => {
          const mine = it.key === mineKey;
          return (
            <View key={it.key} style={[styles.card, mine && styles.cardMine]}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardLabel, mine && styles.cardLabelMine]}>{it.label}</Text>
                {mine && <Text style={styles.mineBadge}>{t('zodiac.mine', '내 운세')}</Text>}
              </View>
              <Text style={[styles.cardText, { fontSize: fs(14), lineHeight: fs(22) }]}>{it.text}</Text>
            </View>
          );
        })}

        <Text style={styles.note}>{t('zodiac.note', '※ 가볍게 즐기는 오늘의 운세예요. 자세한 풀이는 내 사주에서 보세요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)' },
  wrap: { padding: space(6), paddingBottom: space(12) },
  h: { ...font.title, color: colors.ink, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(4) },
  toggle: { flexDirection: 'row', gap: space(2), marginBottom: space(4) },
  togBtn: { flex: 1, paddingVertical: space(2.5), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  togBtnOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  togTx: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  togTxOn: { color: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(2.5), ...shadow.card },
  cardMine: { borderColor: colors.ju, borderWidth: 1.5 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(1.5) },
  cardLabel: { fontSize: 16, fontWeight: '800', color: colors.ink },
  cardLabelMine: { color: colors.ju },
  mineBadge: { fontSize: 11, fontWeight: '900', color: colors.bg, backgroundColor: colors.ju, paddingHorizontal: space(2), paddingVertical: space(0.75), borderRadius: radius.pill, overflow: 'hidden' },
  cardText: { ...font.body, color: colors.ink },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
