// src/app/(app)/lookback.tsx — 되돌아보기(오늘의 한 가지 실천 기록)
// ─────────────────────────────────────────────────────────────────────────
// 미션(오늘의 한 가지)을 며칠이나 해냈는지 돌아보는 화면. 체크만 받고 안 돌려주면 쌓을 이유가 없다.
//
// ★2026-07-20 설계 변경(daniel 판단으로 축소): 원래는 '적중 회고'(맞음/아님·메모)를 모아
//   골든셋으로 쓰려 했으나 **폐기**했다. 사용자의 체감 평가는 명리 적중과 다른 것을 재기 때문이다 —
//   ①기분≠사건 ②개인 baseline(우울/낙천이 명리 신호를 덮음) ③확증편향(운세를 먼저 읽고 해석)
//   ④'아무 일 없던 날'은 기록되지 않음(생존 편향). 사건 기록으로 바꿔도 "무엇을 사건으로 볼지"가 주관이라 남는다.
//   → CLAUDE.md §3.2 "모호한 '맞는 것 같다'를 검증으로 인정하지 말 것"에 정면으로 걸린다.
//   ⚠️여기에 **적중률을 절대 표시하지 말 것.** 지난 데이터의 hit/note 컬럼도 화면에 쓰지 않는다.
//   리텐션은 사용자 입력에 기대지 않는 축(오늘의 관계·시기 예고)으로 옮겼다.
// ⚠️로그인 필요(RLS). 비로그인은 안내만.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { ChartPicker } from '../../components/ChartPicker';
import { useAuth } from '../../lib/useAuth';
import { loadRepChart } from '../../lib/engine/myChart';
import { listDailyLogs, type DailyLog } from '../../lib/backend/dailyLog';
import { colors, radius, space, shadow, font, bgSource } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ImageBackground } from 'react-native';

export default function LookbackScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartId, setChartId] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const rep = await loadRepChart();
      const id = rep?.serverChartId ?? null;
      if (!alive) return;
      setChartId(id);
      const rows = await listDailyLogs(id, 60); // 최근 60일
      if (alive) { setLogs(rows); setLoading(false); }
    })().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useFocusEffect(load); // 오늘 기록하고 돌아오면 바로 반영

  // ★2026-07-20: 적중 회고(hit/note) 수집을 중단해 미션 실천 기록만 남긴다.
  //   이유 = 사용자의 체감 평가는 명리 적중과 다른 것을 재고(기분·개인 baseline·확증편향), 그걸 '적중률'로
  //   보여주면 §3.2 검증 정직성에 어긋난다. 지난 기록의 hit/note 는 남아 있어도 화면에 쓰지 않는다.
  const written = logs.filter((l) => l.mission_done);
  const streak = written.length; // 실천한 날 수(연속 계산은 다음 단계 — 지금은 누적)

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ChartPicker onChange={load} />
        <Text style={[styles.title, { fontSize: fs(22) }]}>{t('lookback.title', '되돌아보기')}</Text>
        <Text style={styles.sub}>{t('lookback.sub2', '오늘의 한 가지를 해낸 날들이에요.')}</Text>

        {!session ? (
          <View style={styles.card}>
            <Text style={[styles.empty, { fontSize: fs(14) }]}>{t('lookback.needLogin', '로그인하면 기록이 계정에 저장되고 여기서 다시 볼 수 있어요.')}</Text>
            <PressableScale style={styles.cta} onPress={() => router.push('/login')}>
              <Text style={styles.ctaTx}>{t('login.go', '로그인')}</Text>
            </PressableScale>
          </View>
        ) : loading ? (
          <ActivityIndicator color={colors.ju} style={{ marginTop: space(8) }} />
        ) : written.length === 0 ? (
          <View style={styles.card}>
            <Text style={[styles.empty, { fontSize: fs(14) }]}>{t('lookback.empty2', '아직 기록이 없어요. 오늘의 운세 아래 "오늘의 한 가지"를 해내고 체크해 보세요.')}</Text>
            <PressableScale style={styles.cta} onPress={() => router.push('/today')}>
              <Text style={styles.ctaTx}>{t('lookback.goToday', '오늘의 운세 보기')}</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {/* 요약 — 실천한 날 수만. ★'적중률'은 보여주지 않는다(위 주석 참고). */}
            <View style={styles.summary}>
              <Text style={[styles.summaryBig, { fontSize: fs(15) }]}>
                {t('lookback.streak', '지금까지 {{n}}일, 오늘의 한 가지를 해내셨어요', { n: streak })}
              </Text>
            </View>

            {written.map((l) => (
              <View key={l.log_date} style={styles.card}>
                <View style={styles.rowTop}>
                  <Text style={styles.date}>{l.log_date}</Text>
                  {l.score != null && <Text style={styles.score}>{l.score}점</Text>}
                </View>
                {/* 그날 운세(박제) */}
                {l.headline && <Text style={[styles.headline, { fontSize: fs(14) }]}>{l.headline}</Text>}
                {l.mission_done && <Text style={styles.mission}>{t('lookback.missionDone', '✓ 그날의 한 가지를 했어요')}</Text>}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  title: { ...font.heading, color: colors.ink, fontWeight: '900', marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(1), marginBottom: space(4) },
  summary: { backgroundColor: colors.juSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(3) },
  summaryBig: { ...font.body, color: colors.ink, fontWeight: '800' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(2.5), ...shadow.card },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  date: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  score: { ...font.caption, color: colors.ju, fontWeight: '800' },
  headline: { ...font.body, color: colors.ink, fontWeight: '700', marginTop: space(2) },
  mission: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  empty: { ...font.body, color: colors.inkSoft, lineHeight: 22 },
  cta: { alignSelf: 'flex-start', marginTop: space(3), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(5) },
  ctaTx: { color: '#15132E', fontWeight: '800', fontSize: 14 },
});
