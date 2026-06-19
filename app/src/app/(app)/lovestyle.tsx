// src/app/(app)/lovestyle.tsx — '연애 스타일(연애 세포)' (가볍게 보기) 무료·온디바이스 공유 카드
// ─────────────────────────────────────────────────────────────────────────
// 사주 십신 → 연애 유형(lib/loveStyle.ts, Claude stance·daniel 검수). 규칙5: 무료=온디바이스(API 0).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet, Share, ImageBackground, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine';
import { loadMyChart } from '../../lib/myChart';
import { loveStyle, type LoveStyleResult } from '../../lib/loveStyle';
import { useFontScale } from '../../lib/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import type { ChartInput } from '@spec/chart';

// 연애 유형별 이미지(daniel: 종류별 이미지) — assets/icons/lovestyle/{slug}.png.
// 들어온 것만 require하고, 없으면 이모지로 자동 폴백(점진 적용). 키 = loveStyle 십신군(한글).
const LOVE_IMG: Record<string, any> = {
  // slug: 비겁=bigeop·식상=siksang·재성=jaeseong·관성=gwanseong·인성=inseong (daniel 생성)
  비겁: require('../../../assets/icons/lovestyle/bigeop.png'),
  식상: require('../../../assets/icons/lovestyle/siksang.png'),
  재성: require('../../../assets/icons/lovestyle/jaeseong.png'),
  관성: require('../../../assets/icons/lovestyle/gwanseong.png'),
  인성: require('../../../assets/icons/lovestyle/inseong.png'),
};

export default function LoveStyleScreen() {
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

  const result: LoveStyleResult | null = useMemo(() => (me ? loveStyle(computeChart(me).saju) : null), [me]);

  const onShare = useCallback(() => {
    if (!result) return;
    Share.share({ message: `${t('lovestyle.shareLead', '내 연애 스타일')}: ${result.emoji} ${result.style}\n${result.desc}\n— SyncFortune` }).catch(() => {});
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
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단) */}
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />
        <View style={styles.hero}>
          {LOVE_IMG[result.group]
            ? <Image source={LOVE_IMG[result.group]} style={styles.heroImg} resizeMode="contain" />
            : <Text style={styles.emoji}>{result.emoji}</Text>}
          <Text style={styles.title}>{result.style}</Text>
        </View>
        <View style={styles.card}><Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(25) }]}>{result.desc}</Text></View>
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('lovestyle.inLove', '연애할 때')}</Text>
          <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(25) }]}>{result.inLove}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('lovestyle.tip', '이런 점만 더하면')}</Text>
          <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(25) }]}>{result.tip}</Text>
        </View>
        <Pressable style={styles.share} onPress={onShare}><Text style={styles.shareTx}>{t('lovestyle.share', '내 연애 스타일 공유')}</Text></Pressable>
        <Text style={styles.note}>{t('lovestyle.note', '※ 사주 십신으로 가볍게 본 연애 스타일이에요. 재미로 즐겨 주세요.')}</Text>
        <Pressable style={styles.cta} onPress={() => router.push('/love')}><Text style={styles.ctaText}>{t('lovestyle.detail', '내 애정 흐름 깊이 보기')}</Text></Pressable>
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
  heroImg: { width: 150, aspectRatio: 0.68, borderRadius: radius.md, marginBottom: space(3) },
  emoji: { fontSize: 64, marginBottom: space(2) },
  title: { fontSize: 25, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  cardHead: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink, fontSize: 15, lineHeight: 25 },
  share: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(3.25), alignItems: 'center', marginTop: space(1), marginBottom: space(4), ...shadow.card },
  shareTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginBottom: space(4), lineHeight: 18 },
  cta: { backgroundColor: 'transparent', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, paddingVertical: space(3.5), alignItems: 'center' },
  ctaText: { color: colors.ju, fontSize: 15, fontWeight: '800' },
});
