// src/app/(app)/community.tsx — 커뮤니티 게시판(목록·카테고리·글쓰기·이용약관 동의). Apple 1.2 UGC.
// ─────────────────────────────────────────────────────────────────────────
// 목록(최신순·카테고리 필터) + 글쓰기(FAB→모달, 비속어 1차 차단) + 첫 작성 시 이용약관 동의(1회·zero-tolerance).
//   노출 여부는 원격 플래그(features.community)로 제어 — 관리자만(재제출 안전판) → 심사 통과 후 공개.
//   글 탭 → /communityPost?id=... (상세=댓글·좋아요·신고·차단).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, Modal, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { Alert } from '../../lib/ui/alert';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { listPosts, createPost, COMMUNITY_CATEGORIES, type CommunityPost, type CommunityCategory } from '../../lib/backend/community';
import { colors, radius, space, shadow, font } from '../../lib/theme';

const EULA_KEY = 'pref.communityEula'; // 이용약관 동의 1회 플래그(Apple 1.2)

export default function CommunityScreen() {
  useLogContentVisit('community');
  const { t } = useTranslation();
  const router = useRouter();
  const [cat, setCat] = useState<CommunityCategory | undefined>(undefined); // undefined=전체
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [compose, setCompose] = useState(false);
  // 이용약관 동의 여부(Apple 1.2) — null=프리로드 전. 마운트 effect 에서 비동기로 채운다(동기 SecureStore 블록 회피).
  const [eulaAgreed, setEulaAgreed] = useState<boolean | null>(null);
  const [eula, setEula] = useState(false);       // 이용약관 모달
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [wcat, setWcat] = useState<CommunityCategory>('free'); // 작성 카테고리
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try { setPosts(await listPosts(cat)); } catch { /* 목록 로드 실패=빈 목록 */ } finally { setLoading(false); setRefreshing(false); }
  }, [cat]);
  useEffect(() => { setLoading(true); load(); }, [load]);
  // 약관 동의 플래그 프리로드 — 탭 시점의 동기 SecureStore 호출(JS 스레드 블록)을 없애기 위해 미리 읽어 둔다.
  useEffect(() => { SecureStore.getItemAsync(EULA_KEY).then((v) => setEulaAgreed(v === '1')).catch(() => setEulaAgreed(false)); }, []);

  // 글쓰기 진입 — 이용약관 미동의면 약관부터.
  //   ★약관 동의 여부는 마운트 시 1회 **비동기 프리로드**(아래 effect)해 두고, 탭 시엔 메모리 값만 본다.
  //     구 코드는 탭 시점에 `SecureStore.getItem`(**동기 네이티브 브리지 = JS 스레드 블록**·라이브러리 문서 명시)을
  //     호출해 글쓰기 창이 늦게 떴다(daniel 07-16 "글쓰기 창 뜨는 게 너무 오래 걸려").
  function onCompose() {
    // 프리로드 전(null)이면 동기 폴백 — 마운트 직후 극히 짧은 창에서만 발생.
    const agreed = eulaAgreed ?? (() => { try { return (SecureStore as any).getItem?.(EULA_KEY) === '1'; } catch { return false; } })();
    if (!agreed) { setEula(true); return; }
    setCompose(true);
  }
  function agreeEula() {
    SecureStore.setItemAsync(EULA_KEY, '1').catch(() => {}); // 구 코드의 동기 setItem 중복 호출 제거(블록 요인)
    setEulaAgreed(true);
    setEula(false);
    // ★EULA 모달이 닫히는 애니메이션과 글쓰기 모달 슬라이드-인이 **겹치면** iOS 에서 버벅이거나 아예 안 뜬다.
    //   같은 함정 선례: confirmReadingChart → UnlockOverlay(380ms 지연으로 해결). 닫힘이 끝난 뒤 띄운다.
    setTimeout(() => setCompose(true), 380);
  }

  async function submit() {
    if (!title.trim() || !body.trim() || posting) return;
    setPosting(true);
    try {
      await createPost(wcat, title, body);
      setCompose(false); setTitle(''); setBody(''); setWcat('free');
      await load();
    } catch (e) {
      const msg = (e as Error).message === 'PROFANITY'
        ? t('community.profanity', '부적절한 표현이 포함돼 있어요. 수정 후 다시 올려 주세요.')
        : (e as Error).message;
      Alert.alert('!', msg);
    } finally { setPosting(false); }
  }

  const CATS: (CommunityCategory | undefined)[] = [undefined, ...COMMUNITY_CATEGORIES];
  const catLabel = (c?: CommunityCategory) => c ? t(`community.cat.${c}`) : t('community.all', '전체');

  return (
    <View style={styles.bg}>
      {/* 카테고리 탭 */}
      <View style={styles.catBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATS.map((c) => (
            <PressableScale key={c ?? 'all'} style={[styles.catChip, cat === c && styles.catChipOn]} onPress={() => setCat(c)}>
              <Text style={[styles.catChipTx, cat === c && styles.catChipTxOn]}>{catLabel(c)}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.ju} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('community.empty', '첫 글을 남겨보세요.')}</Text>}
          renderItem={({ item }) => (
            <PressableScale style={styles.postRow} onPress={() => router.push({ pathname: '/communityPost', params: { id: item.id } })}>
              <View style={styles.postHead}>
                <Text style={styles.postCat}>{t(`community.cat.${item.category}`, item.category)}</Text>
                <Text style={styles.postMeta}>{item.author_name} · {String(item.created_at).slice(5, 10)}</Text>
              </View>
              <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.postBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.postStats}>♥ {item.like_count}   💬 {item.comment_count}</Text>
            </PressableScale>
          )}
        />
      )}

      {/* 글쓰기 FAB */}
      <PressableScale style={styles.fab} onPress={onCompose}><Text style={styles.fabTx}>✎</Text></PressableScale>

      {/* 이용약관 동의(Apple 1.2 — zero tolerance) */}
      <Modal visible={eula} transparent animationType="fade" onRequestClose={() => setEula(false)}>
        <View style={styles.modalDim}>
          <View style={styles.eulaCard}>
            <Text style={styles.eulaTitle}>{t('community.eulaTitle', '커뮤니티 이용약관')}</Text>
            <Text style={styles.eulaBody}>{t('community.eulaBody', '욕설·혐오·괴롭힘·불법·성적/음란 콘텐츠는 금지됩니다. 위반 시 게시물 삭제·이용 제한될 수 있어요. 신고된 콘텐츠는 24시간 내 검토·조치됩니다. 부적절한 사용자는 차단할 수 있습니다.')}</Text>
            <PressableScale style={styles.eulaAgree} onPress={agreeEula}><Text style={styles.eulaAgreeTx}>{t('community.eulaAgree', '동의하고 글쓰기')}</Text></PressableScale>
            <PressableScale style={styles.eulaCancel} onPress={() => setEula(false)}><Text style={styles.eulaCancelTx}>{t('common.cancel', '취소')}</Text></PressableScale>
          </View>
        </View>
      </Modal>

      {/* 글쓰기 모달 */}
      <Modal visible={compose} animationType="slide" onRequestClose={() => setCompose(false)}>
        <View style={styles.composeBg}>
          <View style={styles.composeHead}>
            <PressableScale onPress={() => setCompose(false)}><Text style={styles.composeX}>✕</Text></PressableScale>
            <Text style={styles.composeTitle}>{t('community.write', '글쓰기')}</Text>
            <PressableScale onPress={submit} disabled={!title.trim() || !body.trim() || posting}>
              <Text style={[styles.composeSubmit, (!title.trim() || !body.trim() || posting) && styles.composeSubmitOff]}>{posting ? '…' : t('community.post', '올리기')}</Text>
            </PressableScale>
          </View>
          <ScrollView contentContainerStyle={styles.composeForm} keyboardShouldPersistTaps="handled">
            <View style={styles.wcatRow}>
              {COMMUNITY_CATEGORIES.map((c) => (
                <PressableScale key={c} style={[styles.wcatChip, wcat === c && styles.catChipOn]} onPress={() => setWcat(c)}>
                  <Text style={[styles.catChipTx, wcat === c && styles.catChipTxOn]}>{t(`community.cat.${c}`)}</Text>
                </PressableScale>
              ))}
            </View>
            <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} placeholder={t('community.titlePh', '제목')} placeholderTextColor={colors.inkFaint} maxLength={100} />
            <TextInput style={styles.bodyInput} value={body} onChangeText={setBody} placeholder={t('community.bodyPh', '내용을 입력하세요 (욕설·혐오·성적 콘텐츠 금지)')} placeholderTextColor={colors.inkFaint} maxLength={4000} multiline textAlignVertical="top" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  catBar: { paddingTop: space(11), borderBottomWidth: 1, borderBottomColor: colors.line },
  catRow: { paddingHorizontal: space(4), paddingBottom: space(3), gap: space(2) },
  catChip: { backgroundColor: colors.sunk, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2), borderWidth: 1, borderColor: colors.line },
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  catChipTx: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  catChipTxOn: { color: colors.bg },
  listWrap: { padding: space(5), paddingBottom: space(24), gap: space(3) },
  empty: { ...font.body, color: colors.inkFaint, textAlign: 'center', marginTop: space(16) },
  postRow: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4.5), ...shadow.card },
  postHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(1.5) },
  postCat: { ...font.caption, color: colors.ju, fontWeight: '800', fontSize: 11 },
  postMeta: { ...font.caption, color: colors.inkFaint, fontSize: 11 },
  postTitle: { ...font.heading, color: colors.ink, marginBottom: space(1) },
  postBody: { ...font.body, color: colors.inkSoft, lineHeight: 21 },
  postStats: { ...font.caption, color: colors.inkFaint, marginTop: space(2.5), fontSize: 12 },
  fab: { position: 'absolute', right: space(6), bottom: space(10), width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ju, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  fabTx: { color: colors.bg, fontSize: 24, fontWeight: '800' },
  // 이용약관
  modalDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space(7) },
  eulaCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(6), ...shadow.card },
  eulaTitle: { ...font.heading, color: colors.ink, marginBottom: space(3) },
  eulaBody: { ...font.body, color: colors.inkSoft, lineHeight: 23, marginBottom: space(5) },
  eulaAgree: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(3.25), alignItems: 'center' },
  eulaAgreeTx: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  eulaCancel: { paddingVertical: space(3), alignItems: 'center' },
  eulaCancelTx: { color: colors.inkSoft, fontWeight: '600' },
  // 글쓰기
  composeBg: { flex: 1, backgroundColor: colors.bg },
  composeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(5), paddingTop: space(12), paddingBottom: space(3), borderBottomWidth: 1, borderBottomColor: colors.line },
  composeX: { fontSize: 20, color: colors.inkSoft },
  composeTitle: { ...font.heading, color: colors.ink },
  composeSubmit: { color: colors.ju, fontWeight: '800', fontSize: 16 },
  composeSubmitOff: { color: colors.inkFaint },
  composeForm: { padding: space(5), gap: space(3) },
  wcatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  wcatChip: { backgroundColor: colors.sunk, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.75), borderWidth: 1, borderColor: colors.line },
  titleInput: { ...font.heading, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: space(3) },
  bodyInput: { ...font.body, color: colors.ink, minHeight: 220, lineHeight: 24 },
});
