// app/src/app/(app)/myposts.tsx — 「내 활동 › 작성한 글」 (콘티 4면)
// ═══════════════════════════════════════════════════════════════════════════
// ★운광장 목록과 **같은 모양**의 카드를 쓴다. 내 글만 모아 보는 자리지 다른 글이 아니다 —
//   여기서 카드를 새로 그리면 같은 글이 두 화면에서 다르게 보인다([[duplicate-ui-single-source]]).
// ⚠️'로그인 안 됨'과 '쓴 글 없음'을 다른 말로 적는다 — 사용자가 할 일이 다르다.
// ═══════════════════════════════════════════════════════════════════════════
// safe-area-safe: 상단 인셋을 직접 준다(탭 밖 화면).
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { myPosts, type CommunityPost } from '../../lib/backend/community';
import { useAuth } from '../../lib/useAuth';
import { colors, space, radius, font, shadow } from '../../lib/theme';

export default function MyPostsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [rows, setRows] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setRows(await myPosts()); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(3) }]}>
      <View style={styles.head}>
        <PressableScale style={styles.back} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.backTx}>‹</Text>
        </PressableScale>
        <Text style={styles.h1}>{t('my.posts', '작성한 글')}</Text>
      </View>

      {loading ? <ActivityIndicator color={colors.ju} style={{ marginTop: space(8) }} />
        : !session ? <Text style={styles.empty}>{t('my.needLogin', '로그인하면 내 활동을 볼 수 있어요.')}</Text>
        : !rows.length ? <Text style={styles.empty}>{t('my.noPosts', '아직 쓴 글이 없어요.')}</Text>
        : rows.map((p) => (
          <PressableScale key={p.id} style={styles.card}
                          onPress={() => router.push({ pathname: '/communityPost', params: { id: p.id } })}>
            <Text style={styles.cardMeta}>{String(p.created_at).slice(0, 10)}</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
            <Text style={styles.cardBody} numberOfLines={2}>{p.body}</Text>
            <Text style={styles.cardStat}>♥ {p.like_count}   💬 {p.comment_count}</Text>
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
  cardMeta: { ...font.caption, color: colors.inkFaint },
  cardTitle: { ...font.body, color: colors.ink, fontWeight: '800' },
  cardBody: { ...font.caption, color: colors.inkSoft, lineHeight: 19 },
  cardStat: { ...font.caption, color: colors.inkFaint, marginTop: space(1) },
});
