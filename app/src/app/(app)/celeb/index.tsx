// src/app/(app)/celeb/index.tsx — '세계를 움직이는 사람들' 그리드(daniel 기획 B, 2026-06-24)
// 유명인(공개 생년월일) 목록 → 탭하면 /celeb/[id] 상세(나와의 사주 매칭). 유료(celeb 1회 결제로 전 인물 열람·인물별 캐시).
// ⚠️ 재미·추정 콘텐츠 — 투자/정치 단정 금지·명예 존중(셀럽 DB·시스템 프롬프트에서 가드).
import { View, Text, ScrollView, StyleSheet, Pressable, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CELEBRITIES } from '../../../lib/celebrities';
import { bgSource, colors, radius, space, shadow, font } from '../../../lib/theme';

export default function CelebIndex() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('celeb.title', '세계를 움직이는 사람들')}</Text>
        <Text style={styles.sub}>{t('celeb.sub', '유명인의 사주와 내 사주를 견주어 보는 재미 — 닮은꼴·배울 점·지금 운의 결')}</Text>
        <View style={styles.grid}>
          {CELEBRITIES.map((c) => (
            <Pressable key={c.id} style={styles.card} onPress={() => router.push(`/celeb/${c.id}`)}>
              <Text style={styles.flag}>{c.flag}</Text>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.role}>{c.role}</Text>
              <Text style={styles.blurb}>{c.blurb}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.disclaimer}>* 공개된 생년월일 기반의 재미·추정 콘텐츠예요(출생 시각 미상이라 시주 제외). 실제 투자·정치 판단의 근거가 아닙니다.</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), marginBottom: space(5), lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space(3) },
  card: { width: '47%', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(3), ...shadow.card },
  flag: { fontSize: 40, marginBottom: space(1) },
  name: { ...font.heading, color: colors.ink },
  role: { ...font.label, color: colors.ju, marginTop: 2 },
  blurb: { ...font.caption, color: colors.inkSoft, marginTop: space(1), lineHeight: 17 },
  disclaimer: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 17 },
});
