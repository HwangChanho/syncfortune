// src/app/(app)/pastlife.tsx — '전생 이야기' (가볍게 보기) 무료·온디바이스 공유 카드
// ─────────────────────────────────────────────────────────────────────────
// 사주 = 일간 오행(시대) × 십신군(신분) → 전생 이야기(lib/pastLife.ts, Claude stance·daniel 검수). 재미 판타지.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet, Share, ImageBackground } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine';
import { loadMyChart } from '../../lib/myChart';
import { pastLife, type PastLifeResult } from '../../lib/pastLife';
import { useFontScale } from '../../lib/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

export default function PastLifeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) { setMe(c); setLoading(false); } });
    return () => { alive = false; };
  }, []));

  const result: PastLifeResult | null = useMemo(() => (me ? pastLife(computeChart(me).saju) : null), [me]);

  const onShare = useCallback(() => {
    if (!result) return;
    Share.share({ message: `${t('pastlife.shareLead', '나의 전생')}: ${result.emoji} ${result.era} · ${result.role}\n${result.story}\n— SyncFortune` }).catch(() => {});
  }, [result, t]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!result) return (
    <View style={styles.center}>
      <Text style={styles.msg}>{t('compat.needChart', '먼저 명식을 등록해 주세요.')}</Text>
      <Pressable style={styles.btn} onPress={() => router.push('/register')}><Text style={styles.btnText}>{t('compat.registerMyChart', '내 명식 등록')}</Text></Pressable>
    </View>
  );

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <View style={styles.hero}>
          <Text style={styles.emoji}>{result.emoji}</Text>
          <Text style={styles.title}>{result.role}</Text>
          <Text style={styles.sub}>{result.era}</Text>
        </View>
        <View style={styles.card}><Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{result.story}</Text></View>
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('pastlife.hint', '지금의 당신에게')}</Text>
          <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(25) }]}>{result.hint}</Text>
        </View>
        <Pressable style={styles.share} onPress={onShare}><Text style={styles.shareTx}>{t('pastlife.share', '내 전생 공유하기')}</Text></Pressable>
        <Text style={styles.note}>{t('pastlife.note', '※ 사주로 가볍게 그려 본 전생 이야기예요. 재미로 즐겨 주세요.')}</Text>
        <Pressable style={styles.cta} onPress={() => router.push({ pathname: '/reading', params: { input: JSON.stringify(me) } })}><Text style={styles.ctaText}>{t('pastlife.detail', '내 사주 깊이 보기 (프리미엄)')}</Text></Pressable>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)' },
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', paddingVertical: space(6), marginBottom: space(3) },
  emoji: { fontSize: 64, marginBottom: space(2) },
  title: { fontSize: 25, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 14, fontWeight: '700', color: colors.ju, marginTop: space(1.5) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  cardHead: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink, fontSize: 15, lineHeight: 26 },
  share: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(3.25), alignItems: 'center', marginTop: space(1), marginBottom: space(4), ...shadow.card },
  shareTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginBottom: space(4), lineHeight: 18 },
  cta: { backgroundColor: 'transparent', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, paddingVertical: space(3.5), alignItems: 'center' },
  ctaText: { color: colors.ju, fontSize: 15, fontWeight: '800' },
});
