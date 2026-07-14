// src/app/(app)/communityMod.tsx — 커뮤니티 모더레이션 대시보드(관리자 전용). Apple 1.2 신고 조치.
// ─────────────────────────────────────────────────────────────────────────
// 신고된 콘텐츠(report_count>0) 큐 → 숨김/복원. 서버 RPC가 is_admin 강제(비관리자는 빈 목록/에러).
//   자동 숨김(신고 5)과 병행해 관리자가 조기 검토·조치(24h 내). admin.tsx 에서 진입.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { Alert } from '../../lib/ui/alert';
import { moderationQueue, adminHide, type ModItem } from '../../lib/backend/community';
import { colors, radius, space, shadow, font } from '../../lib/theme';

export default function CommunityModScreen() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await moderationQueue()); }
    catch { Alert.alert('!', '관리자만 접근할 수 있어요.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleHide(it: ModItem) {
    try { await adminHide(it.kind, it.id, !it.hidden); await load(); }
    catch { Alert.alert('!', '처리 실패'); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.ju} />}>
      <Text style={styles.h1}>{t('mod.title', '신고 관리')}</Text>
      <Text style={styles.sub}>{t('mod.sub', '신고된 콘텐츠를 검토하고 숨기거나 복원하세요. (신고 5회 이상은 자동 숨김)')}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{t('mod.empty', '신고된 콘텐츠가 없어요.')}</Text>
      ) : items.map((it) => (
        <View key={`${it.kind}:${it.id}`} style={[styles.card, it.hidden && styles.cardHidden]}>
          <View style={styles.rowTop}>
            <Text style={styles.kind}>{it.kind === 'post' ? '글' : '댓글'} · 신고 {it.report_count}</Text>
            <Text style={styles.meta}>{it.author_name} · {String(it.created_at).slice(0, 10)}</Text>
          </View>
          <Text style={styles.content} numberOfLines={4}>{it.content}</Text>
          <PressableScale style={[styles.btn, it.hidden ? styles.btnRestore : styles.btnHide]} onPress={() => toggleHide(it)}>
            <Text style={[styles.btnTx, it.hidden && styles.btnTxRestore]}>{it.hidden ? t('mod.restore', '복원') : t('mod.hide', '숨기기')}</Text>
          </PressableScale>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wrap: { padding: space(6), paddingTop: space(12), paddingBottom: space(16) },
  h1: { ...font.title, color: colors.ink },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(1), marginBottom: space(5), lineHeight: 18 },
  empty: { ...font.body, color: colors.inkFaint, textAlign: 'center', marginTop: space(12) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4.5), marginBottom: space(3), ...shadow.card },
  cardHidden: { opacity: 0.6, borderColor: colors.line },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(2) },
  kind: { ...font.caption, color: colors.ju, fontWeight: '800' },
  meta: { ...font.caption, color: colors.inkFaint, fontSize: 11 },
  content: { ...font.body, color: colors.ink, lineHeight: 22, marginBottom: space(3) },
  btn: { borderRadius: radius.pill, paddingVertical: space(2.5), alignItems: 'center' },
  btnHide: { backgroundColor: colors.ju },
  btnRestore: { backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  btnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  btnTxRestore: { color: colors.inkSoft },
});
