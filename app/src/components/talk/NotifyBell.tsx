// app/src/components/talk/NotifyBell.tsx — 알림 벨 + 읽지 않은 배지 **단일 원본**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"종모양 이모지도 색없는걸로 바꾸고 돋보기 옆에 놔"*
//
// ■ 왜 이모지를 버리나
//   처음엔 `🔔` 이모지를 홈 헤더에 뒀다. 그런데 이모지는 **색이 박혀 있고**(플랫폼마다 다른 그림),
//   옆에 선 것은 우리가 그린 **선 아이콘**(`Icon`)이라 **무게가 안 맞는다.**
//   ⇒ `Icon name="bell"` 은 이미 있었다 — 24×24 · 굵기 2 규격이라 돋보기와 **같은 무게**로 선다.
//
// ■ 왜 컴포넌트인가
//   벨이 들어갈 자리가 **둘**이다(친구목록 · 대화목록). 각자 그리면 배지 규칙·색·읽음 갱신이
//   갈린다 — 이 저장소가 여러 번 당한 실수다([[duplicate-ui-single-source]]).
//
// ■ ★읽음은 «포커스마다» 다시 센다
//   알림함에서 읽고 돌아왔는데 배지가 남아 있으면 그게 더 나쁘다.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { PressableScale } from '../PressableScale';
import { Icon } from '../kit/Icon';
import { unreadCount } from '../../lib/backend/notifyInbox';
import { colors, font } from '../../lib/theme';

/**
 * 알림 벨.
 *
 * @param size 아이콘 픽셀(옆에 선 아이콘과 **같은 값**을 준다 — 무게를 맞추려고)
 */
export function NotifyBell({ size = 26 }: { size?: number }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    void unreadCount().then((n) => { if (alive) setUnread(n); }).catch(() => { /* 못 세면 0 그대로 */ });
    return () => { alive = false; };
  }, []));

  return (
    <PressableScale hitSlop={10} onPress={() => router.push('/notifications')} accessibilityLabel="알림">
      <View>
        <Icon name="bell" size={size} />
        {unread > 0 ? (
          // ★숫자를 보여 준다 — 점만 찍으면 «몇 개인지» 를 알려고 또 들어가야 한다
          <View style={styles.badge}>
            <Text style={styles.badgeTx}>{unread > 99 ? '99+' : String(unread)}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -3, right: -6, minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ju,
  },
  badgeTx: { ...font.caption, color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 16 },
});
