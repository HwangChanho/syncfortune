// src/app/(app)/persona.tsx — 사주 성격유형 16종 (스페셜) — 무료·온디바이스 공유 카드
// ─────────────────────────────────────────────────────────────────────────
// daniel "전부 다": 4축(음양·강약·한난·동정)→16유형 + 공유 카드(바이럴). 규칙5: 무료=온디바이스(API 0).
//   무료 맛보기 = 유형명·이모지·4축 막대·짧은 설명 + 공유. 유료 상세 = 기존 성격내면 프리미엄 풀이로 유도.
//   stance(4축·유형명)는 lib/personaType.ts에 표준 명리 기반 — daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet, Share, ImageBackground } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine';
import { loadMyChart } from '../../lib/myChart';
import { classifyPersona, AXIS_INFO, type PersonaResult } from '../../lib/personaType';
import { useFontScale } from '../../lib/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import type { ChartInput } from '@spec/chart';

export default function PersonaScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 본문(읽는 글) 글자 크기 전역 배율
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  // 대표 명식이 바뀔 수 있으니 포커스마다 재로드(traits 패턴)
  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) { setMe(c); setLoading(false); } });
    return () => { alive = false; };
  }, []));

  const persona: PersonaResult | null = useMemo(() => {
    if (!me) return null;
    const c = computeChart(me);
    return classifyPersona({
      dayStem: c.saju.dayMaster.stem,
      monthBranch: c.saju.pillars['월']?.branch ?? '',
      strengthVerdict: c.strength.verdict,
      strengthScore: c.strength.score,
      pillars: c.saju.pillars,
    });
  }, [me]);

  const onShare = useCallback(() => {
    if (!persona) return;
    Share.share({ message: `${t('persona.shareLead', '내 사주 성격유형')}: ${persona.emoji} ${persona.name}\n${persona.desc}\n— SyncFortune` }).catch(() => {});
  }, [persona, t]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!persona) return (
    <View style={styles.center}>
      <Text style={styles.msg}>{t('compat.needChart', '먼저 명식을 등록해 주세요.')}</Text>
      <Pressable style={styles.btn} onPress={() => router.push('/register')}>
        <Text style={styles.btnText}>{t('compat.registerMyChart', '내 명식 등록')}</Text>
      </Pressable>
    </View>
  );

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단) */}
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />
        {/* 유형 카드 */}
        <View style={styles.hero}>
          <Text style={styles.emoji}>{persona.emoji}</Text>
          <Text style={styles.name}>{persona.name}</Text>
          <Text style={styles.code}>{persona.code}</Text>
          <Text style={[styles.desc, { fontSize: fs(15), lineHeight: fs(25) }]}>{persona.desc}</Text>
        </View>

        {/* 4축 막대 */}
        <View style={styles.card}>
          {AXIS_INFO.map((ax) => {
            const val = persona.axes[ax.key];
            const isLeft = val === ax.leftVal; // 좌측 값이면 dot 왼쪽
            return (
              <View key={ax.key} style={styles.axisRow}>
                <Text style={[styles.axisLabel, isLeft && styles.axisOn]}>{ax.left}</Text>
                <View style={styles.track}>
                  <View style={[styles.dot, { left: isLeft ? '18%' : '72%' }]} />
                </View>
                <Text style={[styles.axisLabel, styles.axisRight, !isLeft && styles.axisOn]}>{ax.right}</Text>
              </View>
            );
          })}
        </View>

        {/* 공유 */}
        <Pressable style={styles.share} onPress={onShare}>
          <Text style={styles.shareTx}>{t('persona.share', '내 유형 공유하기')}</Text>
        </Pressable>

        <Text style={styles.note}>{t('persona.note', '※ 사주 4축으로 본 성격 유형 맛보기예요. 더 깊은 성격·내면 풀이는 프리미엄에서 만나보세요.')}</Text>

        {/* 유료 상세(기존 성격내면 프리미엄 풀이) */}
        <Pressable style={styles.cta} onPress={() => router.push({ pathname: '/reading', params: { input: JSON.stringify(me) } })}>
          <Text style={styles.ctaText}>{t('persona.detail', '내 성격 깊이 보기 (프리미엄)')}</Text>
        </Pressable>
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
  hero: { alignItems: 'center', paddingVertical: space(6), marginBottom: space(4) },
  emoji: { fontSize: 64, marginBottom: space(2) },
  name: { fontSize: 26, fontWeight: '900', color: colors.ink, marginBottom: space(1) },
  code: { fontSize: 14, fontWeight: '700', color: colors.ju, letterSpacing: 2, marginBottom: space(4) },
  desc: { ...font.body, color: colors.ink, textAlign: 'center', lineHeight: 25, fontSize: 15 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(4), ...shadow.card },
  axisRow: { flexDirection: 'row', alignItems: 'center', marginVertical: space(2.5) },
  axisLabel: { fontSize: 12.5, color: colors.inkSoft, width: 76 },
  axisRight: { textAlign: 'right' },
  axisOn: { color: colors.ju, fontWeight: '800' },
  track: { flex: 1, height: 4, backgroundColor: colors.line, borderRadius: 2, marginHorizontal: space(2), position: 'relative' },
  dot: { position: 'absolute', top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.ju, marginLeft: -8 },
  share: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(3.25), alignItems: 'center', marginBottom: space(4), ...shadow.card },
  shareTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginBottom: space(4), lineHeight: 18 },
  cta: { backgroundColor: 'transparent', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, paddingVertical: space(3.5), alignItems: 'center' },
  ctaText: { color: colors.ju, fontSize: 15, fontWeight: '800' },
});
