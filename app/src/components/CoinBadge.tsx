// app/src/components/CoinBadge.tsx — 상단 코인 잔액 배지(탭 → 충전)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28 코인 전환(docs/PLAN_coin_system.md).
//   유료 풀이를 열기 전에 잔액을 **미리** 알 수 있어야 '코인 부족' 알림이 놀람이 되지 않는다.
//   ★조회 실패는 0으로 표시하지 않는다 — 실패를 '없음'으로 보이면 불필요한 충전을 유도하게 된다
//     (2026-07-28 재결제 사고와 같은 유형). 실패면 아무것도 그리지 않는다(조용히).
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { coinBalanceOrNull } from '../lib/billing/coins';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';

export function CoinBadge() {
  const { fs } = useFontScale();
  const router = useRouter();
  const [bal, setBal] = useState<number | null>(null);
  useFocusEffect(useCallback(() => { let alive = true; void (async () => { const b = await coinBalanceOrNull(); if (alive) setBal(b); })(); return () => { alive = false; }; }, []));
  if (bal === null) return null;   // 로딩·조회 실패 = 조용히 미표시
  return (
    <PressableScale style={styles.badge} onPress={() => router.push('/coins')} hitSlop={8}>
      <Text style={[styles.tx, { fontSize: fs(12) }]} numberOfLines={1}>{bal.toLocaleString('ko-KR')} woon</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3) },
  tx: { ...font.caption, color: colors.ju, fontWeight: '800' },
});
