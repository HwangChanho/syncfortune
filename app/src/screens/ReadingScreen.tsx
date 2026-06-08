// app/src/screens/ReadingScreen.tsx — 영역별 풀이 (전부 유료 LLM 통변, 다국어, 한지·먹 테마, ADR-042/043)
// ─────────────────────────────────────────────────────────────────────────
// 무료 풀이 없음 — 풀이(통변)는 전부 딥·정밀 유료. 접근 모드(useEntitlement):
//   premium=무제한 / trial=첫 1회 무료 / gated=광고 보고 1회 or 구독.
// 영역 선택 → 모드 분기 → 차트 저장(self·saju) → Edge interpret(paid·Claude opus) → 통변.
//   ⚠️ Edge invoke=프로덕션(개발 중 미배포라 실패=비용0·절대0).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import { useAuth } from '../lib/useAuth';
import { supabase } from '../lib/supabase';
import { useEntitlement } from '../lib/entitlement';
import { colors, radius, space, shadow, font } from '../lib/theme';
import type { ChartInput, CategoryKey } from '@spec/chart';

const CATEGORIES: CategoryKey[] = [
  '성격내면', '취업운', '직장운', '사업운', '금전소득운', '투자편재운', '재물손재', '연애운',
  '결혼배우자운', '대인사회성', '부모운', '형제운', '자식운', '건강', '학업자기계발', '이동환경',
];

export function ReadingScreen({ input }: { input: ChartInput | null }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { mode, consumeTrial, watchAdForReading, purchaseReading } = useEntitlement();
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [reading, setReading] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);

  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  async function runReading(cat: CategoryKey, isTrial: boolean) {
    if (!c) return;
    setLoading(true);
    try {
      const { data: chartRow, error: e1 } = await supabase
        .from('charts')
        // 출생 시각 미상(timeAccuracy '미상')이면 saju 에 timeUnknown 플래그 → Edge 통변이 시주(時柱) 제외(마이그레이션 불요).
        .insert({ owner_id: session!.user.id, relation: 'self', saju: { ...c.saju, timeUnknown: input?.timeAccuracy === '미상' }, ziwei: c.ziwei, consent: true })
        .select('id').single();
      if (e1) throw e1;
      const { data, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: chartRow.id, category: cat, tier: 'paid' },
      });
      setReading(error ? { error: error.message } : data?.reading);
      if (isTrial && !error) await consumeTrial();
    } catch (err) {
      setReading({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function onRead(cat: CategoryKey) {
    setCategory(cat);
    setReading(null);
    if (!session) { router.push('/login'); return; }
    if (mode === 'perUse') {
      Alert.alert(t('reading.premiumAlert'), t('reading.premiumAlertMsg'), [
        {
          text: t('reading.watchAd'),
          onPress: async () => {
            try { await watchAdForReading(); await runReading(cat, false); }
            catch (e) { Alert.alert('!', (e as Error).message); }
          },
        },
        {
          text: t('reading.payPerUse'),
          onPress: async () => {
            try { await purchaseReading(); await runReading(cat, false); }
            catch (e) { Alert.alert('!', (e as Error).message); }
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }
    await runReading(cat, mode === 'trial');
  }

  const banner = mode === 'trial' ? t('reading.bannerTrial') : t('reading.bannerPerUse');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{t('reading.title')}</Text>
      <Text style={styles.sub}>{banner}</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((cat) => (
          <Pressable key={cat} style={[styles.chip, category === cat && styles.chipOn]} onPress={() => onRead(cat)}>
            <Text style={category === cat ? styles.chipOnText : styles.chipText}>{t(`category.${cat}`)}</Text>
          </Pressable>
        ))}
      </View>

      {loading && <ActivityIndicator style={{ marginTop: space(6) }} color={colors.ju} />}

      {reading && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{category ? t(`category.${category}`) : ''}</Text>
          {reading.error ? (
            <Text style={styles.err}>{reading.error}</Text>
          ) : (
            <>
              {reading.base && <Text style={styles.rk}>{t('reading.base')}: {reading.base}</Text>}
              {reading.overlay && <Text style={styles.rk}>{t('reading.overlay')}: {reading.overlay}</Text>}
              {reading.remedy && <Text style={styles.rk}>{t('reading.remedy')}: {reading.remedy}</Text>}
              {!reading.base && <Text style={styles.rk}>{JSON.stringify(reading, null, 2)}</Text>}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  h: { ...font.heading, fontSize: 18 },
  sub: { ...font.caption, marginTop: space(1.5), marginBottom: space(4) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill,
    paddingVertical: space(1.75), paddingHorizontal: space(3.25),
  },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipText: { color: colors.inkSoft, fontSize: 13 },
  chipOnText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  card: {
    marginTop: space(5), padding: space(4), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.card,
  },
  cardTitle: { ...font.heading, color: colors.ju, marginBottom: space(2) },
  rk: { ...font.body, marginTop: space(2), lineHeight: 21 },
  err: { fontSize: 13, color: colors.ju },
});
