// app/src/app/(app)/mycomments.tsx — 「내 활동 › 댓글과 답글」 (콘티 4면)
// ═══════════════════════════════════════════════════════════════════════════
// ★댓글만 나열하지 않는다 — **어느 글에 달았는지**를 함께 적어야 뜻이 통한다.
//   (`myComments()` 가 글 제목을 조인해 온다.)
// ⚠️조인한 글이 지워졌으면 제목이 null 이다 → '삭제된 글'로 적는다. 빈칸으로 두면 고장으로 보인다.
// ═══════════════════════════════════════════════════════════════════════════
// safe-area-safe: 상단 인셋을 직접 준다(탭 밖 화면).
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { myComments, type MyComment } from '../../lib/backend/community';
import { useAuth } from '../../lib/useAuth';
import { colors, space, radius, font, shadow } from '../../lib/theme';

export default function MyCommentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [rows, setRows] = useState<MyComment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setRows(await myComments()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(3) }]}>
      <View style={styles.head}>
        <PressableScale style={styles.back} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.backTx}>‹</Text>
        </PressableScale>
        <Text style={styles.h1}>{t('my.comments', '댓글과 답글')}</Text>
      </View>

      {loading ? <ActivityIndicator color={colors.ju} style={{ marginTop: space(8) }} />
        : !session ? <Text style={styles.empty}>{t('my.needLogin', '로그인하면 내 활동을 볼 수 있어요.')}</Text>
        : !rows.length ? <Text style={styles.empty}>{t('my.noComments', '아직 단 댓글이 없어요.')}</Text>
        : rows.map((c) => (
          <PressableScale key={c.id} style={styles.card}
                          onPress={() => router.push({ pathname: '/communityPost', params: { id: c.post_id } })}>
            {/* 어느 글이었나 — 지워졌으면 그렇게 적는다 */}
            <Text style={styles.on} numberOfLines={1}>
              {c.post_title ?? t('my.deletedPost', '삭제된 글')}
            </Text>
            <Text style={styles.body2} numberOfLines={3}>{c.body}</Text>
            <Text style={styles.meta}>{String(c.created_at).slice(0, 10)}</Text>
          </PressableScale>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingBottom: 176 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(3) },
  back: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  backTx: { fontSize: 28, lineHeight: 30, color: colors.ink },
  h1: { ...font.title, flex: 1 },
  empty: { ...font.body, color: colors.inkFaint, paddingVertical: space(8), textAlign: 'center' },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    padding: space(4), marginBottom: space(2.5), gap: space(1), ...shadow.soft,
  },
  on: { ...font.caption, color: colors.ju, fontWeight: '800' },
  body2: { ...font.body, color: colors.ink, lineHeight: 21 },
  meta: { ...font.caption, color: colors.inkFaint },
});
