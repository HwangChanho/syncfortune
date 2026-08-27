// app/src/app/(app)/notifications.tsx — 「알림함」 (시안 헤더의 종 아이콘)
// ═══════════════════════════════════════════════════════════════════════════
// 서버가 보낸 알림을 시간순으로 보여준다. 데이터·설계 판단은 `notifyInbox.ts` 머리말 참조.
//
// ★화면을 열면 곧바로 '봤다'고 기록한다 — 목록을 보고 나갔는데 배지가 남아 있으면
//   사용자는 놓친 알림이 더 있다고 읽는다(배지의 뜻이 흐려진다).
// ⚠️조회 실패를 '알림 없음'으로 그리지 않는다.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadInbox, markInboxSeen, hideInboxItem, type InboxItem } from '../../lib/backend/notifyInbox';
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, space, font, shadow } from '../../lib/theme';

type State = { items: InboxItem[] } | { error: true } | null;

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState<State>(null);

  const load = useCallback(async () => {
    setSt(null);
    const res = await loadInbox();
    setSt(res);
    // 가장 새 알림 시각을 '본 시각'으로 남긴다(목록이 비면 지금 시각을 남길 이유가 없다)
    if (!('error' in res) && res.items.length) await markInboxSeen(res.items[0].createdAt);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  /**
   * ★알림 한 줄 지우기 (Boss 2026-08-27 *"알림은 지울수도 있게해줘"*).
   *
   * ★**화면에서 먼저 뺀다**(낙관적) — 서버를 기다리면 «눌렀는데 안 없어지는» 느낌이 난다.
   *   ⚠️실패하면 **되돌린다.** 사라진 줄 알았는데 다시 나타나는 편이, 안 지워졌는데
   *     지워진 줄 아는 것보다 낫다.
   * ⚠️행을 지우는 게 아니라 **내 화면에서만 감춘다**(발송 기록은 남는다 · `hideInboxItem` 주석).
   */
  const remove = useCallback(async (key: string) => {
    setSt((prev) => (prev && !('error' in prev) ? { items: prev.items.filter((x) => x.key !== key) } : prev));
    const ok = await hideInboxItem(key);
    if (!ok) void load();     // 실패 — 서버 상태를 다시 읽어 되돌린다
  }, [load]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(4) }]}>
      <Text style={styles.title}>{t('notify.title', '알림')}</Text>

      {st === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>
      ) : 'error' in st ? (
        <View style={styles.center}>
          <Text style={styles.emptyTx}>{t('notify.failed', '알림을 불러오지 못했어요.')}</Text>
          <PressableScale style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryTx}>{t('common.retry', '다시 시도')}</Text>
          </PressableScale>
        </View>
      ) : st.items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTx}>{t('notify.empty', '받은 알림이 없어요.')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {st.items.map((it, i, arr) => {
            const inner = (
              <>
                <View style={styles.rowL}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{it.title}</Text>
                  <Text style={styles.rowBody} numberOfLines={2}>{it.body}</Text>
                  <Text style={styles.rowDate}>{it.createdAt.slice(0, 10)}</Text>
                </View>
                {it.route ? <Text style={styles.rowArrow}>›</Text> : null}
                {/* ★지우기 — 오른쪽 끝. 누르면 이 줄만 사라진다(다른 알림은 그대로) */}
                <PressableScale
                  hitSlop={10}
                  style={styles.rowX}
                  onPress={() => void remove(it.key)}
                  accessibilityLabel={t('notify.remove', '이 알림 지우기')}
                >
                  <Text style={styles.rowXTx}>✕</Text>
                </PressableScale>
              </>
            );
            // 열 곳이 없는 알림은 눌리지 않게 둔다(빈 화면으로 보내지 않는다)
            return it.route ? (
              <PressableScale key={it.key} style={[styles.row, i < arr.length - 1 && styles.rowLine]}
                onPress={() => router.push(it.route as never)}>{inner}</PressableScale>
            ) : (
              <View key={it.key} style={[styles.row, i < arr.length - 1 && styles.rowLine]}>{inner}</View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // 하단 여백 170 = 광고 배너 50 + 하단 내비 86 + 홈 인디케이터 34(check:bottominset 기준)
  body: { paddingHorizontal: space(4), paddingBottom: 170 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '900', color: colors.ink, letterSpacing: -0.3, marginBottom: space(3) },
  center: { alignItems: 'center', paddingVertical: space(12), gap: space(3) },
  emptyTx: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  retry: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5) },
  retryTx: { ...font.label, color: colors.onJu, fontWeight: '800' },

  list: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: space(4), ...shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3.5) },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowL: { flex: 1, gap: 3 },
  rowTitle: { ...font.body, color: colors.ink, fontWeight: '700' },
  rowBody: { ...font.caption, color: colors.inkSoft, lineHeight: 18 },
  rowDate: { ...font.caption, color: colors.inkFaint },
  // ★지우기 — 눌리는 면적은 넓게, 글자는 작고 옅게(«지우기» 가 주인공이 되면 안 된다)
  rowX: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: space(1) },
  rowXTx: { fontSize: 14, color: colors.inkFaint, fontWeight: '800' },
  rowArrow: { ...font.heading, color: colors.inkFaint },
});
