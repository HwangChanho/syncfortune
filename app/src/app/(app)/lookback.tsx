// src/app/(app)/lookback.tsx — 되돌아보기(오늘의 한 가지 실천 기록)
// ─────────────────────────────────────────────────────────────────────────
// 미션(오늘의 한 가지)을 며칠이나 해냈는지 돌아보는 화면. 체크만 받고 안 돌려주면 쌓을 이유가 없다.
//
// ★2026-07-20 설계 변경(daniel 판단으로 축소): 원래는 '적중 회고'(맞음/아님·메모)를 모아
//   골든셋으로 쓰려 했으나 **폐기**했다. 사용자의 체감 평가는 명리 적중과 다른 것을 재기 때문이다 —
//   ①기분≠사건 ②개인 baseline ③확증편향 ④'아무 일 없던 날'은 기록 안 됨(생존편향).
//   ⚠️여기에 **적중률을 절대 표시하지 말 것.** 지난 데이터의 hit/note 컬럼도 화면에 쓰지 않는다.
//
// ★2026-07-20 보강(daniel QA '기획 부실'): 내용이 streak 숫자뿐이라 빈약 → ①요약에 격려 문구(연속일수별)
//   ②그날의 미션 문장을 mission_key 로 복원해 표시 ③배경을 옛 bgSource(베이지) → 투명(전역 오행색 비침)으로 통일.
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
import { missionTextFromKey } from '../../lib/content/dailyMission';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';

/** 연속(누적) 실천일수별 격려 문구 — 사용자 입력에 기대지 않는 결정론 문구(daniel 07-20). */
function encourage(n: number): string {
  if (n >= 14) return '2주 넘게 이어가고 있어요. 이 꾸준함이 곧 힘이 돼요.';
  if (n >= 7) return '일주일을 넘겼어요. 작은 실천이 쌓이고 있어요.';
  if (n >= 3) return '며칠째 이어가는 중이에요. 좋은 흐름이에요.';
  return '시작이 반이에요. 오늘의 한 가지도 가볍게 이어가 보세요.';
}

export default function LookbackScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const rep = await loadRepChart();
      const id = rep?.serverChartId ?? null;
      if (!alive) return;
      const rows = await listDailyLogs(id, 60); // 최근 60일
      if (alive) { setLogs(rows); setLoading(false); }
    })().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useFocusEffect(load); // 오늘 기록하고 돌아오면 바로 반영

  // ★2026-07-20: 미션 실천 기록만 남긴다(적중 회고 hit/note 는 화면에 쓰지 않음 — 위 주석).
  const written = logs.filter((l) => l.mission_done);
  const streak = written.length; // 실천한 날 수(누적)

  return (
    <View style={styles.bg}>
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
            {/* 요약 — 실천한 날 수 + 격려(연속일수별). ★'적중률'은 보여주지 않는다(위 주석 참고). */}
            <View style={styles.summary}>
              <Text style={[styles.summaryBig, { fontSize: fs(16) }]}>
                {t('lookback.streak', '지금까지 {{n}}일, 오늘의 한 가지를 해내셨어요', { n: streak })}
              </Text>
              <Text style={[styles.summaryEnc, { fontSize: fs(13), lineHeight: fs(19) }]}>{encourage(streak)}</Text>
            </View>

            {written.map((l) => {
              const mission = missionTextFromKey(l.mission_key); // 그날의 한 가지(복원)
              return (
                <View key={l.log_date} style={styles.card}>
                  <View style={styles.rowTop}>
                    <Text style={styles.date}>{l.log_date}</Text>
                    {l.score != null && <Text style={styles.score}>{l.score}점</Text>}
                  </View>
                  {/* 그날 운세(박제) */}
                  {l.headline && <Text style={[styles.headline, { fontSize: fs(14) }]}>{l.headline}</Text>}
                  {/* 그날의 한 가지 — 무엇을 했는지 구체 문구(daniel 07-20 내용 보강) */}
                  {mission && (
                    <View style={styles.missionBox}>
                      <Text style={styles.missionCap}>{t('lookback.missionCap', '그날의 한 가지')}</Text>
                      <Text style={[styles.missionTx, { fontSize: fs(13), lineHeight: fs(19) }]}>{mission}</Text>
                    </View>
                  )}
                  <Text style={styles.done}>{t('lookback.missionDone', '✓ 해냈어요')}</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop(오행 배경색)이 비치게(daniel 07-20 배경 통일)
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  title: { ...font.heading, color: colors.ink, fontWeight: '900', marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(1), marginBottom: space(4) },
  summary: { backgroundColor: colors.juSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(3) },
  summaryBig: { ...font.body, color: colors.ink, fontWeight: '800' },
  summaryEnc: { ...font.body, color: colors.inkSoft, marginTop: space(1.5) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(2.5), ...shadow.card },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  date: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  score: { ...font.caption, color: colors.ju, fontWeight: '800' },
  headline: { ...font.body, color: colors.ink, fontWeight: '700', marginTop: space(2) },
  missionBox: { marginTop: space(2.5), padding: space(3), backgroundColor: colors.sunk, borderRadius: radius.sm, borderLeftWidth: 3, borderLeftColor: colors.ju },
  missionCap: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(1) },
  missionTx: { ...font.body, color: colors.ink },
  done: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  empty: { ...font.body, color: colors.inkSoft, lineHeight: 22 },
  cta: { alignSelf: 'flex-start', marginTop: space(3), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(5) },
  ctaTx: { color: '#15132E', fontWeight: '800', fontSize: 14 },
});
