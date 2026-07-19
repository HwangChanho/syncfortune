// src/app/(app)/lookback.tsx — 되돌아보기(내 기록 × 그날 운세)
// ─────────────────────────────────────────────────────────────────────────
// 리텐션 Phase 1(daniel 2026-07-19 승인) ① 의 회수 지점 — 기록만 받고 안 돌려주면 쌓을 이유가 없다.
//   "○월○일 이렇게 나왔고, 당신은 이렇게 적었어요"를 나란히 보여 준다.
//
// ★사용자 가치: 운세앱을 쓰는 진짜 동기는 '맞나 확인'인데 지금까진 확인할 방법이 없었다.
// ★★앱 가치: 여기서 사용자가 스스로 매긴 적중/miss 가 골든셋이 된다(CLAUDE.md §3 축적 워크플로).
//
// ⚠️§3.2 검증 정직성: 적중률을 **성과처럼 과시하지 않는다**. "N일 중 M일"이라는 사실만 보여주고
//   해석은 사용자에게 맡긴다(자기평가라 base-rate·확증편향이 섞인 값 — 앱이 '정확도 M%'로 못 박으면 기만).
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
import { listDailyLogs, summarizeHits, type DailyLog } from '../../lib/backend/dailyLog';
import { colors, radius, space, shadow, font, bgSource } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ImageBackground } from 'react-native';

/** 적중 평가 라벨·색 — DailyLogCard 와 같은 값(1/0/-1). */
const HIT_LABEL: Record<string, { tx: string; tone: string }> = {
  '1': { tx: '맞았어요', tone: colors.ju },
  '0': { tx: '그저 그랬어요', tone: colors.inkSoft },
  '-1': { tx: '아니었어요', tone: colors.inkFaint },
};

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

  const sum = summarizeHits(logs);
  const written = logs.filter((l) => l.note || l.hit !== null || l.mission_done);

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ChartPicker onChange={load} />
        <Text style={[styles.title, { fontSize: fs(22) }]}>{t('lookback.title', '되돌아보기')}</Text>
        <Text style={styles.sub}>{t('lookback.sub', '그날 운세와 내가 남긴 기록을 나란히 봐요.')}</Text>

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
            <Text style={[styles.empty, { fontSize: fs(14) }]}>{t('lookback.empty', '아직 남긴 기록이 없어요. 오늘의 운세 아래에서 "오늘 어땠어요?"에 한 줄 남겨 보세요.')}</Text>
            <PressableScale style={styles.cta} onPress={() => router.push('/today')}>
              <Text style={styles.ctaTx}>{t('lookback.goToday', '오늘의 운세 보기')}</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {/* 요약 — ★'정확도 N%'로 단정하지 않는다(자기평가라 base-rate 가 섞인다·§3.2 검증 정직성). */}
            {sum.rated > 0 && (
              <View style={styles.summary}>
                <Text style={[styles.summaryBig, { fontSize: fs(15) }]}>
                  {t('lookback.summary', '평가한 {{rated}}일 중 {{hit}}일을 "맞았다"고 하셨어요', { rated: sum.rated, hit: sum.hit })}
                </Text>
                <Text style={styles.summaryNote}>{t('lookback.summaryNote', '※ 스스로 매긴 기록이라 참고용이에요. 빗나간 날이 있으면 그게 더 값진 단서예요.')}</Text>
              </View>
            )}

            {written.map((l) => (
              <View key={l.log_date} style={styles.card}>
                <View style={styles.rowTop}>
                  <Text style={styles.date}>{l.log_date}</Text>
                  {l.score != null && <Text style={styles.score}>{l.score}점</Text>}
                  {l.hit !== null && l.hit !== undefined && (
                    <View style={[styles.hitPill, { borderColor: HIT_LABEL[String(l.hit)]?.tone }]}>
                      <Text style={[styles.hitTx, { color: HIT_LABEL[String(l.hit)]?.tone }]}>{HIT_LABEL[String(l.hit)]?.tx}</Text>
                    </View>
                  )}
                </View>
                {/* 그날 운세(박제) */}
                {l.headline && <Text style={[styles.headline, { fontSize: fs(14) }]}>{l.headline}</Text>}
                {/* 내가 남긴 것 */}
                {l.note ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>{t('lookback.myNote', '내 기록')}</Text>
                    <Text style={[styles.noteTx, { fontSize: fs(13.5), lineHeight: fs(20) }]}>{l.note}</Text>
                  </View>
                ) : null}
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
  summaryNote: { ...font.caption, color: colors.inkFaint, marginTop: space(1.5), lineHeight: 17 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(2.5), ...shadow.card },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  date: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  score: { ...font.caption, color: colors.ju, fontWeight: '800' },
  hitPill: { marginLeft: 'auto', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.5) },
  hitTx: { fontSize: 11, fontWeight: '800' },
  headline: { ...font.body, color: colors.ink, fontWeight: '700', marginTop: space(2) },
  noteBox: { marginTop: space(2.5), backgroundColor: colors.overlay, borderRadius: radius.sm, padding: space(3) },
  noteLabel: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: 2 },
  noteTx: { color: colors.inkSoft },
  mission: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  empty: { ...font.body, color: colors.inkSoft, lineHeight: 22 },
  cta: { alignSelf: 'flex-start', marginTop: space(3), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(5) },
  ctaTx: { color: '#15132E', fontWeight: '800', fontSize: 14 },
});
