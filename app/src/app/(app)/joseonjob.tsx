// src/app/(app)/joseonjob.tsx — '조선시대 나의 직업은?' (가볍게 보기) 무료·온디바이스 공유 카드
// ─────────────────────────────────────────────────────────────────────────
// daniel: 가볍게 보기 신규 콘텐츠. 사주 십신 → 조선시대 직업(lib/joseonJob.ts, Claude stance·daniel 검수).
//   규칙5: 무료=온디바이스(API 0). 직업명·특징·신분 + 공유(바이럴). persona 패턴 차용.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet, ImageBackground, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine';
import { loadMyChart } from '../../lib/myChart';
import { joseonJob, type JoseonJobResult } from '../../lib/joseonJob';
import { useFontScale } from '../../lib/fontScale';
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(앱게이트)
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import type { ChartInput } from '@spec/chart';

// 직업 결과 이미지 — daniel 자산(assets/icons/joseon/). 파일 추가 후 해당 require 주석을 해제하면 자동 표시.
//   없는 직업은 이모지로 폴백(정적 require라 파일 없으면 빌드 에러 → 파일 넣은 것만 활성화).
const JOB_IMG: Record<string, any> = {
  정관: require('../../../assets/icons/joseon/mungwan.jpg'),    // 문관
  편관: require('../../../assets/icons/joseon/mugwan.jpg'),     // 무관·장수
  정인: require('../../../assets/icons/joseon/hakja.jpg'),      // 학자·선비
  편인: require('../../../assets/icons/joseon/uiwon.jpg'),      // 의원
  식신: require('../../../assets/icons/joseon/myeongjang.jpg'), // 명장(장인)
  상관: require('../../../assets/icons/joseon/yein.jpg'),       // 예인·화공
  정재: require('../../../assets/icons/joseon/jiju.jpg'),       // 지주·대농
  편재: require('../../../assets/icons/joseon/geosang.jpg'),    // 거상
  비견: require('../../../assets/icons/joseon/uibyeong.jpg'),   // 의병장·무사
  겁재: require('../../../assets/icons/joseon/bobusang.jpg'),   // 보부상
};

export default function JoseonJobScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 본문(읽는 글) 글자 크기 전역 배율
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  // 대표 명식이 바뀔 수 있으니 포커스마다 재로드(persona 패턴)
  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) { setMe(c); setLoading(false); } });
    return () => { alive = false; };
  }, []));

  const result: JoseonJobResult | null = useMemo(() => {
    if (!me) return null;
    const c = computeChart(me);
    return joseonJob(c.saju); // 온디바이스 — 가장 강한 십신 → 조선 직업
  }, [me]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!result) return (
    <View style={styles.center}>
      <Text style={styles.msg}>{t('compat.needChart', '먼저 명식을 등록해 주세요.')}</Text>
      <Pressable style={styles.btn} onPress={() => router.push('/register')}>
        <Text style={styles.btnText}>{t('compat.registerMyChart', '내 명식 등록')}</Text>
      </Pressable>
    </View>
  );

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단) */}
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />
        {/* 직업 카드 */}
        <View style={styles.hero}>
          {/* 직업 일러스트(daniel 자산) — 없으면 이모지 폴백 */}
          {JOB_IMG[result.tenGod]
            ? <Image source={JOB_IMG[result.tenGod]} style={styles.heroImg} resizeMode="cover" />
            : <Text style={styles.emoji}>{result.emoji}</Text>}
          <Text style={styles.job}>{result.job}</Text>
          <Text style={styles.rank}>{result.rank}</Text>
          <Text style={[styles.tagline, { fontSize: fs(15), lineHeight: fs(25) }]}>{result.tagline}</Text>
        </View>

        {/* 타고난 강점 */}
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('joseonjob.traits', '타고난 강점')}</Text>
          {result.traits.map((tr, i) => (
            <View key={i} style={styles.traitRow}>
              <Text style={styles.traitDot}>●</Text>
              <Text style={[styles.traitTx, { fontSize: fs(15) }]}>{tr}</Text>
            </View>
          ))}
        </View>

        {/* 풀이 음성 읽기(온디바이스 TTS·무료) — 직업·타고난 강점을 읽음 */}
        <TTSButton reading={result} />
        {/* 이슈17: 조선시대 직업 결과 공유(앱게이트) */}
        <ShareReadingButton kind="joseonjob" title="조선시대 나의 직업" content={result} />

        <Text style={styles.note}>{t('joseonjob.note', '※ 사주 십신으로 가볍게 본 조선시대 직업이에요. 재미로 즐겨 주세요.')}</Text>

        {/* 유료 상세(내 사주 깊이 보기) */}
        <Pressable style={styles.cta} onPress={() => router.push({ pathname: '/reading', params: { input: JSON.stringify(me) } })}>
          <Text style={styles.ctaText}>{t('joseonjob.detail', '내 사주 깊이 보기 (프리미엄)')}</Text>
        </Pressable>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', paddingVertical: space(6), marginBottom: space(4) },
  emoji: { fontSize: 64, marginBottom: space(2) },
  heroImg: { width: '100%', height: 190, marginBottom: space(3), borderRadius: radius.md },
  job: { fontSize: 26, fontWeight: '900', color: colors.ink, marginBottom: space(1) },
  rank: { fontSize: 13, fontWeight: '800', color: colors.ju, letterSpacing: 1, marginBottom: space(3) },
  tagline: { ...font.body, color: colors.ink, textAlign: 'center', lineHeight: 25, fontSize: 15 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(4), ...shadow.card },
  cardHead: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(3) },
  traitRow: { flexDirection: 'row', alignItems: 'center', marginVertical: space(1.5) },
  traitDot: { fontSize: 10, color: colors.ju, marginRight: space(2.5) },
  traitTx: { ...font.body, color: colors.ink, fontSize: 15, flex: 1 },
  share: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(3.25), alignItems: 'center', marginBottom: space(4), ...shadow.card },
  shareTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginBottom: space(4), lineHeight: 18 },
  cta: { backgroundColor: 'transparent', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, paddingVertical: space(3.5), alignItems: 'center' },
  ctaText: { color: colors.ju, fontSize: 15, fontWeight: '800' },
});
