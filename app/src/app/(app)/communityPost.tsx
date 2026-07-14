// src/app/(app)/communityPost.tsx — 커뮤니티 글 상세(댓글·좋아요·신고·차단·삭제). Apple 1.2 핵심.
// ─────────────────────────────────────────────────────────────────────────
// 글 + 댓글 목록 + 댓글 작성 + 액션(좋아요 토글·신고[사유]·유저 차단·본인 삭제).
//   신고 → 서버가 report_count 증가, 임계 5 자동 숨김. 차단 → 이후 그 유저 콘텐츠 RLS 제외.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, ActivityIndicator, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { Alert } from '../../lib/ui/alert';
import { useAuth } from '../../lib/useAuth';
import { getPost, listComments, addComment, toggleLike, likedPostIds, reportContent, blockUser, deletePost, deleteComment,
  type CommunityPost, type CommunityComment } from '../../lib/backend/community';
import { colors, radius, space, shadow, font } from '../../lib/theme';

export default function CommunityPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, cs, lk] = await Promise.all([getPost(id), listComments(id), likedPostIds([id])]);
      setPost(p); setComments(cs); setLiked(lk.has(id)); setLikeCount(p?.like_count ?? 0);
    } catch { /* 로드 실패 */ } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function onLike() {
    if (!post) return;
    setLiked((v) => !v); setLikeCount((n) => n + (liked ? -1 : 1)); // 낙관적
    try { setLikeCount(await toggleLike(post.id)); } catch { load(); }
  }

  async function onComment() {
    const body = input.trim();
    if (!body || !id || busy) return;
    setBusy(true); Keyboard.dismiss();
    try { await addComment(id, body); setInput(''); await load(); }
    catch (e) {
      Alert.alert('!', (e as Error).message === 'PROFANITY' ? t('community.profanity', '부적절한 표현이 포함돼 있어요.') : (e as Error).message);
    } finally { setBusy(false); }
  }

  // 신고(사유 선택) — post|comment 공용.
  function onReport(type: 'post' | 'comment', targetId: string) {
    const reasons: { key: string; label: string }[] = [
      { key: 'abuse', label: t('community.rAbuse', '욕설·혐오·괴롭힘') },
      { key: 'sexual', label: t('community.rSexual', '성적/불법 콘텐츠') },
      { key: 'spam', label: t('community.rSpam', '스팸·광고') },
    ];
    Alert.alert(t('community.reportTitle', '신고하기'), t('community.reportDesc', '사유를 선택하세요. 신고된 콘텐츠는 24시간 내 검토됩니다.'), [
      ...reasons.map((r) => ({ text: r.label, onPress: async () => {
        try { await reportContent(type, targetId, r.key); Alert.alert(t('community.reported', '신고 접수됨'), t('community.reportedDesc', '검토 후 조치할게요. 감사합니다.')); load(); }
        catch { Alert.alert('!', t('community.reportFail', '신고에 실패했어요.')); }
      } })),
      { text: t('common.cancel', '취소'), style: 'cancel' as const },
    ]);
  }

  // 유저 차단.
  function onBlock(blockedId: string) {
    if (blockedId === myId) return;
    Alert.alert(t('community.blockTitle', '이 사용자 차단'), t('community.blockDesc', '차단하면 이 사용자의 글·댓글이 더 이상 보이지 않아요.'), [
      { text: t('community.block', '차단'), style: 'destructive' as const, onPress: async () => {
        try { await blockUser(blockedId); Alert.alert(t('community.blocked', '차단했어요'), ''); router.back(); }
        catch { Alert.alert('!', t('community.blockFail', '차단에 실패했어요.')); }
      } },
      { text: t('common.cancel', '취소'), style: 'cancel' as const },
    ]);
  }

  // 본인 삭제.
  function onDeletePost() {
    if (!post) return;
    Alert.alert(t('community.delTitle', '삭제할까요?'), '', [
      { text: t('common.delete', '삭제'), style: 'destructive' as const, onPress: async () => { try { await deletePost(post.id); router.back(); } catch { Alert.alert('!', '삭제 실패'); } } },
      { text: t('common.cancel', '취소'), style: 'cancel' as const },
    ]);
  }
  function onDeleteComment(cid: string) {
    Alert.alert(t('community.delTitle', '삭제할까요?'), '', [
      { text: t('common.delete', '삭제'), style: 'destructive' as const, onPress: async () => { try { await deleteComment(cid); await load(); } catch { Alert.alert('!', '삭제 실패'); } } },
      { text: t('common.cancel', '취소'), style: 'cancel' as const },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!post) return <View style={styles.center}><Text style={styles.gone}>{t('community.gone', '삭제되었거나 볼 수 없는 글이에요.')}</Text></View>;

  const mine = post.author_id === myId;
  return (
    <View style={styles.bg}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {/* 글 */}
        <Text style={styles.cat}>{t(`community.cat.${post.category}`, post.category)}</Text>
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.meta}>{post.author_name} · {String(post.created_at).slice(0, 10)}</Text>
        <Text style={styles.body}>{post.body}</Text>

        {/* 액션 */}
        <View style={styles.actions}>
          <PressableScale style={styles.actBtn} onPress={onLike}><Text style={[styles.actTx, liked && styles.actOn]}>♥ {likeCount}</Text></PressableScale>
          {!mine && <PressableScale style={styles.actBtn} onPress={() => onReport('post', post.id)}><Text style={styles.actTx}>🚩 {t('community.report', '신고')}</Text></PressableScale>}
          {!mine && <PressableScale style={styles.actBtn} onPress={() => onBlock(post.author_id)}><Text style={styles.actTx}>🚫 {t('community.block', '차단')}</Text></PressableScale>}
          {mine && <PressableScale style={styles.actBtn} onPress={onDeletePost}><Text style={styles.actTx}>🗑 {t('common.delete', '삭제')}</Text></PressableScale>}
        </View>

        {/* 댓글 */}
        <Text style={styles.cHead}>{t('community.comments', '댓글')} {comments.length}</Text>
        {comments.map((c) => {
          const cMine = c.author_id === myId;
          return (
            <View key={c.id} style={styles.comment}>
              <View style={styles.cTop}>
                <Text style={styles.cAuthor}>{c.author_name}</Text>
                <Text style={styles.cTime}>{String(c.created_at).slice(5, 16).replace('T', ' ')}</Text>
              </View>
              <Text style={styles.cBody}>{c.body}</Text>
              <View style={styles.cActions}>
                {!cMine && <PressableScale onPress={() => onReport('comment', c.id)}><Text style={styles.cAct}>{t('community.report', '신고')}</Text></PressableScale>}
                {!cMine && <PressableScale onPress={() => onBlock(c.author_id)}><Text style={styles.cAct}>{t('community.block', '차단')}</Text></PressableScale>}
                {cMine && <PressableScale onPress={() => onDeleteComment(c.id)}><Text style={styles.cAct}>{t('common.delete', '삭제')}</Text></PressableScale>}
              </View>
            </View>
          );
        })}
        {comments.length === 0 && <Text style={styles.cEmpty}>{t('community.noComments', '첫 댓글을 남겨보세요.')}</Text>}
      </ScrollView>

      {/* 댓글 입력 */}
      <View style={styles.inputBar}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder={t('community.commentPh', '댓글 입력 (예의를 지켜주세요)')} placeholderTextColor={colors.inkFaint} maxLength={1000} multiline />
        <PressableScale style={[styles.send, (!input.trim() || busy) && styles.sendOff]} onPress={onComment} disabled={!input.trim() || busy}>
          <Text style={styles.sendTx}>{t('community.send', '등록')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7) },
  gone: { ...font.body, color: colors.inkFaint, textAlign: 'center' },
  wrap: { padding: space(6), paddingTop: space(12), paddingBottom: space(24) },
  cat: { ...font.caption, color: colors.ju, fontWeight: '800', fontSize: 12 },
  title: { ...font.title, color: colors.ink, marginTop: space(1) },
  meta: { ...font.caption, color: colors.inkFaint, marginTop: space(1.5), marginBottom: space(4) },
  body: { ...font.body, color: colors.ink, lineHeight: 25 },
  actions: { flexDirection: 'row', gap: space(2), marginTop: space(5), marginBottom: space(4), flexWrap: 'wrap' },
  actBtn: { backgroundColor: colors.sunk, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2), borderWidth: 1, borderColor: colors.line },
  actTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  actOn: { color: colors.ju },
  cHead: { ...font.label, color: colors.ink, marginTop: space(4), marginBottom: space(3), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.line },
  comment: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(2.5) },
  cTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(1.5) },
  cAuthor: { ...font.caption, color: colors.ink, fontWeight: '800' },
  cTime: { ...font.caption, color: colors.inkFaint, fontSize: 11 },
  cBody: { ...font.body, color: colors.ink, lineHeight: 22 },
  cActions: { flexDirection: 'row', gap: space(4), marginTop: space(2.5) },
  cAct: { ...font.caption, color: colors.inkFaint, fontSize: 12, fontWeight: '700' },
  cEmpty: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4) },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2.5), paddingHorizontal: space(5), paddingTop: space(3), paddingBottom: space(8), backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.juLine },
  input: { flex: 1, maxHeight: 100, backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.5), paddingVertical: space(2.5), color: colors.ink },
  send: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3) },
  sendOff: { opacity: 0.4 },
  sendTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
});
