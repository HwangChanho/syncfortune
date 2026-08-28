// src/app/(app)/bok.tsx — '타고난 복(福) 유형' (가볍게 보기) 무료·온디바이스 공유 카드
// ─────────────────────────────────────────────────────────────────────────
// 사주 십신 → 타고난 복(lib/bokType.ts, Claude stance·daniel 검수). 규칙5: 무료=온디바이스(API 0). 처방(살리는 법) 동반.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { Image as ExpoImage } from 'expo-image'; // ★뷰 크기 다운샘플 + 디스크 캐시(RN Image 는 원본 풀 디코딩 — 갤럭시 랙 원인)
import { A } from '../../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { DeepDiveCta } from '../../components/DeepDiveCta';   // 유도 CTA = 이미지 카드(daniel 07-29)
import { RelatedContent } from '../../components/RelatedContent';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine/engine';
import { loadMyChart } from '../../lib/engine/myChart';
import { bokType, type BokResult } from '../../lib/content/bokType';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(앱게이트)
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

// 복 유형별 이미지(daniel: 종류별 이미지) — assets/icons/bok/{slug}.jpg. 들어온 것만 require, 없으면 이모지 폴백.
// slug: 재물복=jaeseong·귀인복=inseong·식복=siksang·관복=gwanseong·인복=bigeop (loveStyle과 동일 G5)
const BOK_IMG: Record<string, any> = {
  재성: A('icons/bok/jaeseong.jpg'),
  인성: A('icons/bok/inseong.jpg'),
  식상: A('icons/bok/siksang.jpg'),
  관성: A('icons/bok/gwanseong.jpg'),
  비겁: A('icons/bok/bigeop.jpg'),
};

export default function BokScreen() {
  useLogContentVisit('bok'); // 진입 1회 방문 기록(daniel 2026-07-06)
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

  const result: BokResult | null = useMemo(() => (me ? bokType(computeChart(me).saju) : null), [me]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!result) return (
    <View style={styles.center}>
      <Text style={styles.msg}>{t('common.needChart', '내 명식을 먼저 등록해 주세요.')}</Text>
      <PressableScale style={styles.btn} onPress={() => router.push('/register')}><Text style={styles.btnText}>{t('compat.registerMyChart', '명식 등록')}</Text></PressableScale>
    </View>
  );

  return (
    <View style={styles.bg}>
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />
        <View style={styles.hero}>
          {BOK_IMG[result.group]
            ? <ExpoImage source={BOK_IMG[result.group]} style={styles.heroImg} contentFit="cover" />
            : <Text style={styles.emoji}>{result.emoji}</Text>}
          <Text style={styles.title}>{result.bok}</Text>
        </View>
        <View style={styles.card}><Text style={[styles.body, { fontSize: fs(15), lineHeight: 25 }]}>{result.desc}</Text></View>
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('bok.how', '복을 키우는 법')}</Text>
          <Text style={[styles.body, { fontSize: fs(15), lineHeight: 25 }]}>{result.how}</Text>
        </View>
        {/* 이슈17: 타고난 복 결과 공유(앱게이트) */}
        <ShareReadingButton kind="bok" title="내 타고난 복" content={result} />
<DeepDiveCta kind="reading" label={t('bok.detail', '내 사주 깊이 보기')} onPress={() => router.push({ pathname: '/reading', params: { input: JSON.stringify(me), kind: 'saju' } })} />
              {/* ★이어서 보면 좋은 콘텐츠(daniel 2026-07-27 "전부 붙여") — 화면마다 하단이 달라 보이던 것 통일.
            큐레이션 출처는 RELATED 단일(중복 하드코딩 0). 매핑이 없으면 스스로 아무것도 안 그린다. */}
        <RelatedContent kind="bok" />
</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 배경(ContentBackdrop) 투과
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' }, // 전역 배경 투과
  msg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', paddingVertical: space(6), marginBottom: space(3) },
  heroImg: { width: '100%', height: 190, borderRadius: radius.md, marginBottom: space(3) },
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
