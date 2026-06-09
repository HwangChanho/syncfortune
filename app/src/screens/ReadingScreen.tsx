// app/src/screens/ReadingScreen.tsx — 전 영역 일괄 풀이 (유료 LLM 통변, 다국어, 미드나잇 테마, ADR-042/043)
// ─────────────────────────────────────────────────────────────────────────
// '프리미엄 풀이' = 16개 전 영역(성격·취업·재물…)을 한 번에 통변해 카드로 쭉 보여준다.
//   (과거: 영역 칩을 하나씩 골라 단건 통변 → daniel 요청으로 '전 영역 일괄'로 전환)
// 흐름: [전체 풀이 보기] → 접근 게이트(useEntitlement) → 차트 1회 저장 → 영역별 Edge interpret 순차 → 카드 누적.
//   차트는 1회만 insert 하고 16회 호출이 chartId 공유 + Edge 캐싱(chart_id×category) → 재방문 비용 0.
// 접근 모드: trial(첫 1회 무료) / perUse(광고 1회 or 건당 ₩2,500). 무제한 구독은 폐기(entitlement.ts).
//   ⚠️ '1회 트리거 = 전 영역 1세트'로 게이트. 전체 세트의 과금 단가 정책은 daniel 검수 필요.
//   ⚠️ Edge invoke=프로덕션(개발 중 미배포라 호출=실패=비용0·절대0). 실패 영역은 그 영역만 에러 카드.
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
  // 영역별 통변 결과(생성된 영역만 키 존재) + 진행률 + 차트 저장 단계의 전역 에러
  const [readings, setReadings] = useState<Partial<Record<CategoryKey, any>>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);

  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  // 전 영역(16)을 순차 통변. 차트는 1회만 저장하고 chartId 를 16회 호출이 공유한다.
  async function runAll(isTrial: boolean) {
    if (!c) return;
    setReadings({});
    setGlobalError(null);
    setProgress({ done: 0, total: CATEGORIES.length });
    let chartId: string;
    try {
      const { data: chartRow, error: e1 } = await supabase
        .from('charts')
        // 출생 시각 미상이면 saju.timeUnknown → Edge 통변이 시주(時柱) 제외
        .insert({ owner_id: session!.user.id, relation: 'self', saju: { ...c.saju, timeUnknown: input?.timeAccuracy === '미상' }, ziwei: c.ziwei, consent: true })
        .select('id').single();
      if (e1) throw e1;
      chartId = chartRow.id;
    } catch (err) {
      setGlobalError((err as Error).message); // 차트 저장 실패 → 전체 중단
      setProgress(null);
      return;
    }
    // 영역별 순차 호출(진행률 갱신). 한 영역이 실패해도 나머지는 계속 — 그 영역만 에러 카드.
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      try {
        const { data, error } = await supabase.functions.invoke('interpret', {
          body: { chartId, category: cat, tier: 'paid' },
        });
        setReadings((prev) => ({ ...prev, [cat]: error ? { error: error.message } : data?.reading }));
      } catch (err) {
        setReadings((prev) => ({ ...prev, [cat]: { error: (err as Error).message } }));
      }
      setProgress({ done: i + 1, total: CATEGORIES.length });
    }
    setProgress(null);
    if (isTrial) await consumeTrial(); // 무료 체험 소진(전 영역 1세트 = 1회)
  }

  // [전체 풀이 보기] → 로그인·접근 게이트 → runAll
  async function onStart() {
    if (!session) { router.push('/login'); return; }
    if (mode === 'perUse') {
      Alert.alert(t('reading.premiumAlert'), t('reading.premiumAlertMsg'), [
        { text: t('reading.watchAd'), onPress: async () => { try { await watchAdForReading(); await runAll(false); } catch (e) { Alert.alert('!', (e as Error).message); } } },
        { text: t('reading.payPerUse'), onPress: async () => { try { await purchaseReading(); await runAll(false); } catch (e) { Alert.alert('!', (e as Error).message); } } },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }
    await runAll(mode === 'trial');
  }

  const banner = mode === 'trial' ? t('reading.bannerTrial') : t('reading.bannerPerUse');
  // 시작(진행/결과/에러 중 하나라도 있으면) → 버튼 숨김
  const started = progress !== null || Object.keys(readings).length > 0 || !!globalError;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{t('reading.title')}</Text>
      <Text style={styles.sub}>{t('reading.sub')}</Text>

      {/* 시작 전: 전체 풀이 버튼 + 과금 안내 */}
      {!started && (
        <>
          <Pressable style={styles.startBtn} onPress={onStart}>
            <Text style={styles.startBtnText}>{t('reading.runAll')}</Text>
          </Pressable>
          <Text style={styles.bannerText}>{banner}</Text>
        </>
      )}

      {/* 생성 중 진행률 (N/16) */}
      {progress && (
        <View style={styles.progressRow}>
          <ActivityIndicator color={colors.ju} />
          <Text style={styles.progressText}>{t('reading.progress', { done: progress.done, total: progress.total })}</Text>
        </View>
      )}

      {/* 차트 저장 실패(전역 중단) */}
      {globalError && <View style={styles.card}><Text style={styles.err}>{globalError}</Text></View>}

      {/* 영역별 결과 카드 — 전 영역, 생성된 순서대로 누적 */}
      {CATEGORIES.map((cat) => {
        const r = readings[cat];
        if (!r) return null;
        return (
          <View key={cat} style={styles.card}>
            <Text style={styles.cardTitle}>{t(`category.${cat}`)}</Text>
            {r.error ? (
              <Text style={styles.err}>{r.error}</Text>
            ) : (
              <>
                {r.base && <Text style={styles.rk}>{t('reading.base')}: {r.base}</Text>}
                {r.overlay && <Text style={styles.rk}>{t('reading.overlay')}: {r.overlay}</Text>}
                {r.remedy && <Text style={styles.rk}>{t('reading.remedy')}: {r.remedy}</Text>}
                {!r.base && !r.overlay && !r.remedy && <Text style={styles.rk}>{JSON.stringify(r, null, 2)}</Text>}
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  h: { ...font.heading, fontSize: 18 },
  sub: { ...font.caption, marginTop: space(1.5), marginBottom: space(4) },
  startBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', marginTop: space(2), ...shadow.card },
  startBtnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  bannerText: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(3) },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(5), marginBottom: space(2) },
  progressText: { ...font.body, color: colors.inkSoft },
  card: {
    marginTop: space(4), padding: space(4), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.card,
  },
  cardTitle: { ...font.heading, color: colors.ju, marginBottom: space(2) },
  rk: { ...font.body, marginTop: space(2), lineHeight: 21 },
  err: { fontSize: 13, color: colors.ju },
});
