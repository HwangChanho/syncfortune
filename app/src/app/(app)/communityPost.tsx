// src/app/(app)/communityPost.tsx — 커뮤니티 글 상세(댓글·좋아요·신고·차단·삭제). Apple 1.2 핵심.
// ─────────────────────────────────────────────────────────────────────────
// 글 + 댓글 목록 + 댓글 작성 + 액션(좋아요 토글·신고[사유]·유저 차단·본인 삭제).
//   신고 → 서버가 report_count 증가, 임계 5 자동 숨김. 차단 → 이후 그 유저 콘텐츠 RLS 제외.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { getNavBarHeight } from '../../components/BottomNav'; // 전역 네비바 높이 — 키보드 위 입력바 정확 위치용(coach.tsx 와 동일 패턴)
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { Image as ExpoImage } from 'expo-image';
import { SharedChart } from '../../components/SharedChart';
import { PhotoViewer } from '../../components/talk/PhotoViewer';   // 전체 보기(뒤로가기 처리 포함) — 단일 원본
import { Alert } from '../../lib/ui/alert';
import { useAuth } from '../../lib/useAuth';
import { getPost, listComments, addComment, toggleLike, likedPostIds, reportContent, blockUser, deletePost, deleteComment,
  type CommunityPost, type CommunityComment, bumpView, pollVote, pollStats , postImageUrl} from '../../lib/backend/community';
import { withTimeout } from '../../lib/core/withTimeout'; // ★잠금 구간 네트워크 상한(멈춤 방지)
import { colors, radius, space, font } from '../../lib/theme';
import { SECTIONS } from '../../lib/content/contentSections'; // P2 후기 태그 딥링크

export default function CommunityPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const myId = session?.user?.id ?? null;
  // ★전체 보기로 띄울 사진(Boss 2026-08-28). null 이면 닫힌 상태다.
  const [photo, setPhoto] = useState<string | null>(null);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<{ my: number | null; total: number; counts: Record<string, number> } | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [kbH, setKbH] = useState(0); // 키보드 높이(px) — 댓글 입력바를 키보드 바로 위로 올림(전역 네비바 보정)

  // 키보드 높이 추적(daniel 07-18 "댓글 입력할때 키보드가 입력창을 가려").
  //   원인: 입력바가 flex 하단에 있을 뿐이라 키보드가 올라오면 그대로 덮인다. 전역 BottomNav 가 이 화면 밖(_layout)에
  //   있어 표준 KeyboardAvoidingView 로는 네비바 높이만큼 어긋나므로, coach.tsx 와 동일하게 리스너로 직접 올린다.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKbH(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKbH(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, cs, lk] = await Promise.all([getPost(id), listComments(id), likedPostIds([id])]);
      setPost(p); setComments(cs); setLiked(lk.has(id)); setLikeCount(p?.like_count ?? 0);
    } catch { /* 로드 실패 */ } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // 일진 글이면 체감 투표 집계를 읽어 온다(다른 글에는 없다)
  useEffect(() => {
    if (post?.kind === 'daily') pollStats(post.id).then(setPoll).catch(() => {});
  }, [post?.kind, post?.id]);

  // ★조회수는 **본문을 연 이 자리**에서만 올린다(목록에 뜬 것은 조회가 아니다).
  //   ⚠️`load` 에 넣지 않는다 — 댓글 등록·좋아요마다 `load()` 가 다시 도는데 그때마다 오르면
  //     조회수가 아니라 '새로고침 수'가 된다.
  useEffect(() => { if (id) bumpView(String(id)); }, [id]);

  async function onLike() {
    if (!post) return;
    setLiked((v) => !v); setLikeCount((n) => n + (liked ? -1 : 1)); // 낙관적
    try { setLikeCount(await toggleLike(post.id)); } catch { load(); }
  }

  async function onComment() {
    const body = input.trim();
    if (!body || !id || busy) return;
    setBusy(true); Keyboard.dismiss();
    // ⚠️★상한 필수 — 잠금 구간(멈춤 방지). 초과해도 잠금이 풀려 다시 시도할 수 있다.
    try { await withTimeout(addComment(id, body)); setInput(''); await withTimeout(load()); }
    catch (e) {
      Alert.alert('!', (e as Error).message === 'PROFANITY' ? t('community.profanity', '부적절한 표현이 포함돼 있어요. 수정 후 다시 올려 주세요.') : (e as Error).message);
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
  // 입력바 lift = 키보드 높이 − 전역 네비바 높이(네비바가 입력바 아래에 있으니 그만큼만 올리면 키보드 바로 위·틈 없음).
  const lift = kbH > 0 ? Math.max(0, kbH - getNavBarHeight()) : 0;
  return (
    <View style={styles.bg}>
      {/* 입력바가 absolute 라 스크롤 본문이 그 아래로 숨지 않도록 바 높이(≈84)+lift 만큼 하단 여백(coach.tsx 와 동일). */}
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: 84 + lift }]} keyboardShouldPersistTaps="handled">
        {/* 글 */}
        <Text style={styles.cat}>{t(`community.cat.${post.category}`, post.category)}</Text>
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.meta}>{post.author_name}{post.ilju ? ` · ${post.ilju}` : ''} · {String(post.created_at).slice(0, 10)}</Text>
          {post.topic ? (() => {
            const it = SECTIONS.flatMap((sec) => sec.items).find((x) => x.key === post.topic);
            return it ? (
              <PressableScale style={styles.topicLink} onPress={() => router.push(it.route as never)}>
                <Text style={styles.topicLinkTx}>{t(it.labelKey)} ›</Text>
              </PressableScale>
            ) : null;
          })() : null}

        {/* 첨부 명식 — 작성자가 자기 명식을 함께 올린 글에만(daniel: "글 볼 때 상단에 사주 원국 노출").
            본문보다 위에 두는 이유: 사주 Q&A·고민 글은 '이 명식을 두고 하는 이야기'라 명식이 전제다.
            대운·세운은 작성자가 공개를 선택한 경우에만 실려 온다(show_luck·toSharedSaju). */}
        {/* ★★첨부 사진 — 탭하면 전체 보기(Boss 2026-08-28 *"사진 탭하면 전체화면으로"*).
            ⚠️전체 보기는 `PhotoViewer` **한 곳**만 쓴다 — 뒤로가기 처리가 거기 들어 있다. */}
        {postImageUrl(post.image_path) ? (
          <PressableScale onPress={() => setPhoto(postImageUrl(post.image_path))}>
            <ExpoImage source={{ uri: postImageUrl(post.image_path)! }} style={styles.postImage} contentFit="cover" transition={140} />
          </PressableScale>
        ) : null}

        {post.chart_saju && (
          <View style={styles.chartWrap}>
            <SharedChart saju={post.chart_saju} ziwei={post.chart_ziwei} showLuck={post.show_luck} />
          </View>
        )}

        <Text style={styles.body}>{post.body}</Text>

        {/* ── 체감 투표 — ★일진 글에서만 (2026-08-22 목록에서 여기로 **옮겨 왔다**) ──
            콘티 3면에 특별 카드가 없어 목록의 일진 카드를 뺐는데, 투표가 거기 있었다.
            ⇒ 지우지 않고 이리로 옮겼다("옮길 곳을 먼저 만들고 뺀다").
            ★집계는 10명부터 — 3명 중 2명 같은 표본은 사회적 증거가 아니라 소음이다. */}
        {post.kind === 'daily' ? (
          <View style={styles.pollWrap}>
            <View style={styles.pollRow}>
              {([1, 2, 3, 4, 5] as const).map((c) => {
                const on = poll?.my === c;
                const label = [t('community.p1', '아주 좋음'), t('community.p2', '좋음'), t('community.p3', '보통'),
                               t('community.p4', '아쉬움'), t('community.p5', '힘듦')][c - 1];
                return (
                  <PressableScale key={c} style={[styles.pollChip, on && styles.pollChipOn]}
                    onPress={() => { pollVote(post.id, c).then(() => pollStats(post.id).then(setPoll)).catch(() => {}); }}>
                    <Text style={[styles.pollChipTx, on && styles.pollChipTxOn]}>{label}</Text>
                  </PressableScale>
                );
              })}
            </View>
            {poll && poll.total >= 10 ? (
              <Text style={styles.pollStat}>{t('community.pollStat', { total: poll.total, top: Math.round(100 * Math.max(...Object.values(poll.counts)) / poll.total), defaultValue: '{{total}}명 참여 · 가장 많은 선택 {{top}}%' })}</Text>
            ) : poll?.my != null ? (
              <Text style={styles.pollStat}>{t('community.pollMine', '참여 완료! 참여자가 모이면 통계가 보여요.')}</Text>
            ) : null}
          </View>
        ) : null}

        {/* 액션 */}
        <View style={styles.actions}>
          <PressableScale style={styles.actBtn} onPress={onLike}><Text style={[styles.actTx, liked && styles.actOn]}>♥ {likeCount}</Text></PressableScale>
          {!mine && <PressableScale style={styles.actBtn} onPress={() => onReport('post', post.id)}><Text style={styles.actTx}>🚩 {t('community.report', '신고')}</Text></PressableScale>}
          {!mine && post.author_id != null && <PressableScale style={styles.actBtn} onPress={() => onBlock(post.author_id!)}><Text style={styles.actTx}>🚫 {t('community.block', '차단')}</Text></PressableScale>}
          {mine && <PressableScale style={styles.actBtn} onPress={onDeletePost}><Text style={styles.actTx}>🗑 {t('common.delete', '삭제')}</Text></PressableScale>}
        </View>

        {/* 댓글 */}
        <Text style={styles.cHead}>{t('community.comments', '댓글')} {comments.length}</Text>
        {comments.map((c) => {
          const cMine = c.author_id === myId;
          return (
            <View key={c.id} style={styles.comment}>
              <View style={styles.cTop}>
                <Text style={styles.cAuthor}>{c.author_name}{c.ilju ? ` · ${c.ilju}` : ''}</Text>
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

      {/* 댓글 입력 — 키보드가 뜨면 그 높이만큼 위로(bottom: lift). 키보드 없으면 lift=0 = 화면 하단 고정. */}
      <View style={[styles.inputBar, { bottom: lift }]}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder={t('community.commentPh', '댓글 입력')} placeholderTextColor={colors.inkFaint} maxLength={1000} multiline />
        <PressableScale style={[styles.send, (!input.trim() || busy) && styles.sendOff]} onPress={onComment} disabled={!input.trim() || busy}>
          <Text style={styles.sendTx}>{t('community.send', '등록')}</Text>
        </PressableScale>
      </View>
      <PhotoViewer uri={photo} onClose={() => setPhoto(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // ★첨부 사진 — 본문 폭을 다 쓰되 높이를 묶는다(세로로 긴 사진이 화면을 통째로 먹지 않게)
  postImage: { width: '100%', height: 260, borderRadius: radius.md, marginTop: space(4) },

  topicLink: { alignSelf: 'flex-start', backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingVertical: space(0.5), paddingHorizontal: space(2.5), marginTop: space(1) },
  topicLinkTx: { fontSize: 11.5, lineHeight: 16, color: colors.ju, fontWeight: '800' },
  bg: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7) },
  gone: { ...font.body, color: colors.inkFaint, textAlign: 'center' },
  // ★하단 여백 = 하단 크롬(≈170pt) 이상 — 마지막 댓글의 수정/삭제 버튼이 배너·네비 뒤로 들어가지 않게.
  //   ⚠️이 화면은 ScrollView **밖에 고정 입력바(inputBar, absolute bottom:0 · 약 84pt)** 가 더 있다.
  //     입력바와 크롬이 겹치는지는 **실측하지 않았다**(등록 화면만 실측함) — 실기기에서 마지막 댓글의
  //     버튼이 여전히 가리면 이 값을 입력바 높이만큼 더 올려야 한다.
  wrap: { padding: space(6), paddingTop: space(12), paddingBottom: space(44) },
  cat: { ...font.caption, color: colors.ju, fontWeight: '800', fontSize: 12 },
  title: { ...font.title, color: colors.ink, marginTop: space(1) },
  meta: { ...font.caption, color: colors.inkFaint, marginTop: space(1.5), marginBottom: space(4) },
  // ★위(연애 스타일 칩)와도 떨어뜨린다 — 칩에 딱 붙어 있어 «칩의 일부» 로 보였다
  //   (Boss 2026-08-28 *"연애 스타일이랑 명식 사이 여백주고"*)
  chartWrap: { marginTop: space(4), marginBottom: space(5) }, // 첨부 명식 카드 ↔ 본문 간격
  pollWrap: { marginTop: space(4), gap: space(2) },
  pollRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  pollChip: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.bg },
  pollChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  pollChipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  pollChipTxOn: { color: colors.onJu },
  pollStat: { ...font.caption, color: colors.inkFaint },
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
  // ★absolute 고정(daniel 07-18 키보드 가림 수정) — flex 하단이면 키보드가 그대로 덮는다.
  //   bottom 은 렌더에서 lift(키보드 높이−네비바)로 덮어써 키보드 바로 위에 붙인다.
  inputBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: space(2.5), paddingHorizontal: space(5), paddingTop: space(3), paddingBottom: space(8), backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.juLine },
  input: { flex: 1, maxHeight: 100, backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.5), paddingVertical: space(2.5), color: colors.ink },
  send: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3) },
  sendOff: { opacity: 0.4 },
  sendTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
});
