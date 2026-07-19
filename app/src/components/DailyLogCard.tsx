// src/components/DailyLogCard.tsx — 오늘의 한 가지(미션 체크)
// ─────────────────────────────────────────────────────────────────────────
// 리텐션(daniel 2026-07-19) ③ — 결정론으로 뽑은 행동 1개 + 체크.
//   운세를 '읽고 끝'이 아니라 '하고 체크'로 바꿔 매일 돌아올 이유를 만든다.
//
// ★2026-07-20 설계 변경(daniel 판단): **적중 회고(맞음/아님·메모)를 제거**했다.
//   이유 — 사용자의 체감 평가는 명리 적중과 다른 것을 재기 때문이다:
//     ①기분≠사건(재물운이 좋아 돈이 들어와도 그날 아프면 "안 좋았다") ②개인 baseline(우울/낙천 성향이
//     명리 신호를 덮음) ③확증편향(운세를 먼저 읽고 하루를 해석) ④"특별한 일 없던 날"은 애초에 기록되지 않음(생존 편향).
//   사건 기록으로 바꿔도 "무엇을 사건으로 볼지"가 주관이라 오염이 남는다 → **검증 데이터 수집 자체를 접었다.**
//   ⚠️여기서 모은 값을 '적중률'로 쓰지 말 것. CLAUDE.md §3.2 "모호한 '맞는 것 같다'를 검증으로 인정하지 말 것".
//   리텐션은 사용자 입력에 기대지 않는 쪽(오늘의 관계·시기 예고)으로 옮겼다.
//
// keyboard-safe: 입력창이 없다(체크 버튼만). TextInput 을 다시 넣게 되면 호스트 화면 스크롤에
//   automaticallyAdjustKeyboardInsets 가 있는지 확인할 것(check:keyboard R1).
// ⚠️로그인 필요(계정 귀속·RLS). 비로그인은 미션은 보여 주되 저장은 막고 로그인을 유도한다.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { dailyMission } from '../lib/content/dailyMission';
import { dailyEnergy } from '../lib/content/dailyFortune';
import { getDailyLog, saveDailyLog } from '../lib/backend/dailyLog';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { SajuChart, Stem, Branch } from '@spec/chart';

export function DailyLogCard({ saju, chartId, date, stem, branch, headline, loggedIn }: {
  saju: SajuChart;
  chartId: string | null;
  date: string;            // 'YYYY-MM-DD'
  stem: Stem;
  branch: Branch;
  headline: string | null; // 그날 캐치 타이틀(기록에 함께 남김)
  loggedIn: boolean;
}) {
  const router = useRouter();
  const { fs } = useFontScale();
  const [done, setDone] = useState(false);

  const mission = dailyMission(saju, stem, branch);

  // 같은 날 다시 들어와도 체크 상태가 이어지게
  useEffect(() => {
    let alive = true;
    if (!loggedIn) return;
    getDailyLog(chartId, date).then((log) => {
      if (alive && log) setDone(!!log.mission_done);
    }).catch(() => {});
    return () => { alive = false; };
  }, [chartId, date, loggedIn]);

  async function toggle() {
    if (!loggedIn) { router.push('/login'); return; }
    const next = !done;
    setDone(next);
    let score: number | undefined; let group: string | undefined;
    try { const e = dailyEnergy(saju, stem, branch); score = e.score; group = e.group; } catch { /* 무시 */ }
    await saveDailyLog(chartId, date, { score, headline, energy_group: group, mission_key: mission.key, mission_done: next });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>오늘의 한 가지</Text>
      <Text style={[styles.mission, { fontSize: fs(15), lineHeight: fs(23) }]}>{mission.text}</Text>
      <PressableScale style={[styles.checkBtn, done && styles.checkBtnOn]} onPress={toggle}>
        <Text style={[styles.checkTx, done && styles.checkTxOn]}>{done ? '✓ 했어요' : '해볼게요'}</Text>
      </PressableScale>
      {!loggedIn && <Text style={styles.needLogin}>로그인하면 기록이 계정에 저장돼요.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginTop: space(4), ...shadow.card },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.3 },
  mission: { ...font.body, color: colors.ink, marginTop: space(2) },
  checkBtn: { alignSelf: 'flex-start', marginTop: space(3), paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.juSoft },
  checkBtnOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  checkTx: { fontSize: 13, fontWeight: '800', color: colors.ju },
  checkTxOn: { color: '#15132E' },
  needLogin: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },
});
