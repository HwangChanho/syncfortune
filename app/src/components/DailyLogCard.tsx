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
// ★2026-07-27 설계 변경(daniel "오늘의 한 가지에서 '했어요'는 빼버리자"): **체크 버튼 제거.**
//   07-20 에 적중 회고를 접은 것과 같은 결의 정리다 — 사용자 입력에 기대는 리텐션 장치를 걷어낸다.
//   체크가 사라지면 `daily_logs` 쓰기 경로도 함께 죽는다(이 카드가 유일한 소비자였다).
//   그래서 상태·토글·조회·저장·로그인 유도까지 같이 걷어냈다. 남는 건 **결정론으로 뽑은 행동 한 줄**뿐.
//   ⚠️`lib/backend/dailyLog.ts` 는 남겨 둔다(테이블·RPC 는 그대로) — 다시 쓸 수 있고, 지우는 건 요청 범위 밖.
//     단 현재 소비자는 0이다: listDailyLogs·summarizeHits 는 07-20 회고 폐기 때부터 이미 미사용이었다.
//
// keyboard-safe: 입력창이 없다(이제 버튼도 없다).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { dailyMission } from '../lib/content/dailyMission';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { SajuChart, Stem, Branch } from '@spec/chart';

export function DailyLogCard({ saju, stem, branch }: {
  saju: SajuChart;
  stem: Stem;
  branch: Branch;
}) {
  const { fs } = useFontScale();
  const mission = dailyMission(saju, stem, branch);   // 결정론 — 같은 날·같은 명식이면 같은 행동

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>오늘의 한 가지</Text>
      <Text style={[styles.mission, { fontSize: fs(15), lineHeight: fs(23) }]}>{mission.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginTop: space(4), ...shadow.card },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.3 },
  mission: { ...font.body, color: colors.ink, marginTop: space(2) },
});
