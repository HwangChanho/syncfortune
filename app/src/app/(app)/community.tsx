// src/app/(app)/community.tsx — 커뮤니티 게시판(목록·카테고리·글쓰기·이용약관 동의). Apple 1.2 UGC.
// ─────────────────────────────────────────────────────────────────────────
// 목록(최신순·카테고리 필터) + 글쓰기(FAB→모달, 비속어 1차 차단) + 첫 작성 시 이용약관 동의(1회·zero-tolerance).
//   노출 여부는 원격 플래그(features.community)로 제어 — 관리자만(재제출 안전판) → 심사 통과 후 공개.
//   글 탭 → /communityPost?id=... (상세=댓글·좋아요·신고·차단).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, Modal, TextInput, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 전체화면 Modal 헤더 상단 안전영역(다이나믹아일랜드) — reunion.tsx 패턴
import { PressableScale } from '../../components/PressableScale';
import { Alert } from '../../lib/ui/alert';
import { useAuth } from '../../lib/useAuth';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { listCharts, subscribeRepChange, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { listPosts, createPost, toSharedSaju, toSharedZiwei, COMMUNITY_CATEGORIES, type CommunityPost, type CommunityCategory } from '../../lib/backend/community';
import { colors, radius, space, shadow, font } from '../../lib/theme';

const EULA_KEY = 'pref.communityEula'; // 이용약관 동의 1회 플래그(Apple 1.2)

export default function CommunityScreen() {
  useLogContentVisit('community');
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets(); // 글쓰기 모달 헤더가 상단 안전영역(노치·다이나믹아일랜드)에 가려 버튼이 안 눌리던 것 방지
  const { isRegistered } = useAuth(); // 익명 세션이 상시 존재하므로 session 이 아닌 isRegistered 로 판정
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
  // 첨부 가능한 명식 = **본인(relation='self')만**. attachId=null 이면 첨부 없이 글만 올린다(기본).
  const [selfCharts, setSelfCharts] = useState<SavedChart[]>([]);
  const [attachId, setAttachId] = useState<string | null>(null);
  const [showLuck, setShowLuck] = useState(false); // 대운·세운까지 공개할지(기본 꺼짐 = 원국만)
  const [composeErr, setComposeErr] = useState<string | null>(null); // 등록 에러를 모달 안에 인라인 표시(Alert 가 글쓰기 Modal 위에 안 떠 '무반응'처럼 보이던 것 해결)

  const load = useCallback(async () => {
    try { setPosts(await listPosts(cat)); } catch { /* 목록 로드 실패=빈 목록 */ } finally { setLoading(false); setRefreshing(false); }
  }, [cat]);
  useEffect(() => { setLoading(true); load(); }, [load]);
  // 약관 동의 플래그 프리로드 — 탭 시점의 동기 SecureStore 호출(JS 스레드 블록)을 없애기 위해 미리 읽어 둔다.
  useEffect(() => { SecureStore.getItemAsync(EULA_KEY).then((v) => setEulaAgreed(v === '1')).catch(() => setEulaAgreed(false)); }, []);
  // 첨부용 본인 명식 프리로드 — 명식도 SecureStore(PII 암호화 저장)라 글쓰기 탭 시점에 읽으면 또 창이 늦게 뜬다.
  //   ★relation='self' 필터: 가족·연인·지인 명식을 올리면 **당사자 동의 없이 남의 생년월일**(여덟 글자로 역산 가능)을
  //     공개하게 된다(CLAUDE.md 규칙8). 관계 필드가 이미 있으니 필드 하나로 원천 차단한다.
  //   명식 추가·삭제·수정 시 전역 알림(subscribeRepChange)으로 목록을 동기화한다.
  useEffect(() => {
    const reload = () => {
      listCharts().then((cs) => {
        const selves = cs.filter((c) => c.relation === 'self');
        setSelfCharts(selves);
        // 고른 명식이 사라졌으면(삭제되거나 관계가 '본인'에서 바뀜) 선택을 해제한다. 안 그러면 attachId 가
        //   없는 명식을 가리킨 채 남아 — 어느 칩도 켜지지 않은 화면에서 제출하면 **조용히 첨부 없이** 올라간다.
        setAttachId((cur) => (cur && selves.some((c) => c.id === cur) ? cur : null));
      }).catch(() => setSelfCharts([]));
    };
    reload();
    return subscribeRepChange(reload);
  }, []);

  // 글쓰기 진입 — ①로그인 ②이용약관 순으로 게이트.
  //   ★약관 동의 여부는 마운트 시 1회 **비동기 프리로드**(아래 effect)해 두고, 탭 시엔 메모리 값만 본다.
  //     구 코드는 탭 시점에 `SecureStore.getItem`(**동기 네이티브 브리지 = JS 스레드 블록**·라이브러리 문서 명시)을
  //     호출해 글쓰기 창이 늦게 떴다(daniel 07-16 "글쓰기 창 뜨는 게 너무 오래 걸려").
  function onCompose() {
    // ★로그인 게이트(읽기는 익명 허용·쓰기만 요구). 근거는 법이 아니라 **어뷰징 대응**: 익명 세션은 앱을
    //   지웠다 깔면 새로 발급돼 차단이 무력화된다(Apple 1.2의 '차단' 요건이 형해화). 게다가 명식은 생일이
    //   역산되는 개인정보라 게시 책임 소재가 필요하다. 5.1.1 과는 무충돌 — 그 조항은 *비계정형 IAP* 대상이고
    //   커뮤니티는 계정형 기능이라 Apple 도 로그인 요구를 허용한다.
    if (!isRegistered) {
      Alert.alert(
        t('community.loginTitle', '로그인이 필요해요'),
        t('community.loginDesc', '글쓰기는 로그인 후 이용할 수 있어요. 읽기는 로그인 없이 그대로 가능합니다.'),
        [
          { text: t('community.goLogin', '로그인'), onPress: () => router.push('/login') },
          { text: t('common.cancel', '취소'), style: 'cancel' as const },
        ],
      );
      return;
    }
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
    if (posting) return;
    // ★제목·내용 미입력 = 조용히 먹통(구 disabled) 대신 '무엇이 없는지' 명확히 안내(daniel 07-17).
    if (!title.trim()) { setComposeErr(t('community.needTitle', '제목을 입력해 주세요.')); return; }
    if (!body.trim()) { setComposeErr(t('community.needBody', '내용을 입력해 주세요.')); return; }
    setPosting(true);
    setComposeErr(null); // 재시도 시 이전 에러 지움
    try {
      // 첨부 명식 → 공유 스냅샷. ★계산을 여기(제출 시)서 하는 이유: 모달을 열 때 계산하면 자미두수(iztro)가
      //   무거워 글쓰기 창이 다시 느려진다(07-16에 고친 바로 그 증상). 제출은 이미 진행 표시가 있는 지점이다.
      //   computeChart 는 세션 캐시라 이 명식을 이미 본 적 있으면 재계산하지 않는다.
      //   ★toSharedSaju/toSharedZiwei 를 반드시 거친다 — 원본 SajuChart 에는 전 생애 대운(luckCycles)이
      //     들어 있어 그대로 올리면 시기 미공개를 골라도 API 로 읽힌다.
      let chart: Parameters<typeof createPost>[3];
      const sc = attachId ? selfCharts.find((c) => c.id === attachId) : undefined;
      if (sc) {
        const computed = computeChart(sc.input);
        chart = {
          saju: toSharedSaju(computed.saju, showLuck),
          ziwei: toSharedZiwei(computed.ziwei), // 명반(12궁·주성) 요약 — daniel: "자미두수 명반도 동일"
          showLuck,
        };
      }
      await createPost(wcat, title, body, chart);
      setCompose(false); setTitle(''); setBody(''); setWcat('free'); setAttachId(null); setShowLuck(false);
      await load();
    } catch (e) {
      const em = (e as Error).message || '';
      // ★에러 상황별 사용자 친화 메시지 + 원본 병기(원인 진단·daniel 07-17: 에러 알럿 정비).
      const msg = em === 'PROFANITY'
        ? t('community.profanity', '부적절한 표현이 포함돼 있어요. 수정 후 다시 올려 주세요.')
        : /세션|session|jwt|auth|rls|row-level/i.test(em)
        ? t('community.errSession', '로그인이 필요해요. 다시 로그인 후 시도해 주세요.') + `\n(${em})`
        : /network|fetch|timeout|failed to|offline/i.test(em)
        ? t('community.errNet', '네트워크 연결을 확인하고 다시 시도해 주세요.')
        : t('community.errPost', '올리지 못했어요. 잠시 후 다시 시도해 주세요.') + (em ? `\n(${em})` : '');
      setComposeErr(msg);   // 모달 안 인라인(항상 보임)
      Alert.alert('!', msg); // 보조(모달 위에 뜨면)
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
        {/* ★KeyboardAvoidingView: 키보드가 올라오면 하단(명식 첨부·본문)이 가리던 것 방지(daniel 07-17). */}
        <KeyboardAvoidingView style={styles.composeBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* ✕(닫기)·올리기는 양끝(space-between), 타이틀은 화면 정중앙(absolute·pointerEvents none으로 버튼 탭 통과).
              ★paddingTop = insets.top: 다이나믹아일랜드/노치에 헤더 버튼이 가려 안 눌리던 버그 수정(reunion.tsx 패턴). hitSlop 으로 탭 영역 확대. */}
          <View style={[styles.composeHead, { paddingTop: insets.top + space(3) }]}>
            <PressableScale onPress={() => { setCompose(false); setComposeErr(null); }} hitSlop={14}><Text style={styles.composeX}>✕</Text></PressableScale>
            {/* ★버튼은 posting 때만 비활성 — 제목·내용 없어도 눌러서 안내를 받도록(구: disabled 라 조용히 먹통). */}
            <PressableScale onPress={submit} disabled={posting} hitSlop={14}>
              <Text style={[styles.composeSubmit, posting && styles.composeSubmitOff]}>{posting ? '…' : t('community.post', '올리기')}</Text>
            </PressableScale>
            <Text style={[styles.composeTitle, { top: insets.top + space(3) }]}>{t('community.write', '글쓰기')}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.composeForm} keyboardShouldPersistTaps="handled">
            {/* 등록 에러 인라인(모달 위 Alert 이 안 뜨는 경우 대비 — 항상 보인다) */}
            {!!composeErr && (
              <View style={styles.composeErrBox}>
                <Text style={styles.composeErrTx}>⚠️ {composeErr}</Text>
              </View>
            )}
            <View style={styles.wcatRow}>
              {COMMUNITY_CATEGORIES.map((c) => (
                <PressableScale key={c} style={[styles.wcatChip, wcat === c && styles.catChipOn]} onPress={() => setWcat(c)}>
                  <Text style={[styles.catChipTx, wcat === c && styles.catChipTxOn]}>{t(`community.cat.${c}`)}</Text>
                </PressableScale>
              ))}
            </View>
            <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} placeholder={t('community.titlePh', '제목')} placeholderTextColor={colors.inkFaint} maxLength={100} />
            <TextInput style={styles.bodyInput} value={body} onChangeText={setBody} placeholder={t('community.bodyPh', '내용을 입력하세요 (욕설·혐오·성적 콘텐츠 금지)')} placeholderTextColor={colors.inkFaint} maxLength={4000} multiline textAlignVertical="top" />

            {/* 명식 첨부(daniel: "글 쓸 때 명식 지정해서 쓰게") — 본인 명식만 고를 수 있다.
                on/off 는 이 화면의 기존 칩 패턴(catChipOn)을 그대로 쓴다. */}
            <View style={styles.attachBox}>
              <Text style={styles.attachHead}>{t('community.attach', '내 명식 첨부')}</Text>
              {selfCharts.length === 0 ? (
                // 본인 명식이 없으면 첨부만 불가 — 글쓰기 자체는 막지 않는다(첨부는 어디까지나 선택).
                <Text style={styles.attachNone}>{t('community.attachNone', '‘본인’으로 등록된 명식이 없어요. 첨부 없이 글을 올릴 수 있어요.')}</Text>
              ) : (
                <View style={styles.attachRow}>
                  <PressableScale style={[styles.wcatChip, !attachId && styles.catChipOn]} onPress={() => { setAttachId(null); setShowLuck(false); }}>
                    <Text style={[styles.catChipTx, !attachId && styles.catChipTxOn]}>{t('community.attachOff', '첨부 안 함')}</Text>
                  </PressableScale>
                  {selfCharts.map((c) => (
                    <PressableScale key={c.id} style={[styles.wcatChip, attachId === c.id && styles.catChipOn]} onPress={() => setAttachId(c.id)}>
                      <Text style={[styles.catChipTx, attachId === c.id && styles.catChipTxOn]} numberOfLines={1}>{c.label}</Text>
                    </PressableScale>
                  ))}
                </View>
              )}
              {/* 시기 공개 + 고지 — 실제로 명식을 붙일 때만 노출 */}
              {!!attachId && (
                <>
                  <PressableScale style={[styles.wcatChip, styles.luckChip, showLuck && styles.catChipOn]} onPress={() => setShowLuck((v) => !v)}>
                    <Text style={[styles.catChipTx, showLuck && styles.catChipTxOn]}>
                      {showLuck ? '✓ ' : ''}{t('community.attachLuck', '대운·세운도 함께 공개')}
                    </Text>
                  </PressableScale>
                  <Text style={styles.attachWarn}>
                    {t('community.attachWarn', '원국 여덟 글자가 이 글을 보는 모두에게 공개돼요. 여덟 글자로 생년월일을 역산할 수 있으니 확인 후 올려 주세요.')}
                  </Text>
                </>
              )}
            </View>
          </ScrollView>
          {/* ★등록 중 = 전체 차단 오버레이(daniel 07-17: 로딩 인디케이터로 다른 작업 막기). pointerEvents 기본=터치 흡수. */}
          {posting && (
            <View style={styles.postingOverlay}>
              <ActivityIndicator size="large" color={colors.ju} />
              <Text style={styles.postingTx}>{t('community.posting', '올리는 중…')}</Text>
            </View>
          )}
        </KeyboardAvoidingView>
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
  // paddingTop 은 인라인(insets.top) — 고정값이면 다이나믹아일랜드에 버튼이 가림. position relative = 타이틀 absolute 기준.
  composeHead: { position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(5), paddingBottom: space(3), borderBottomWidth: 1, borderBottomColor: colors.line },
  composeX: { fontSize: 20, color: colors.inkSoft },
  // 타이틀 = 화면 정중앙(좌우 0·textAlign center). top 은 인라인(insets.top)으로 버튼과 같은 라인. pointerEvents none 이라 뒤 버튼 탭 통과.
  composeTitle: { ...font.heading, color: colors.ink, position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' },
  composeSubmit: { color: colors.ju, fontWeight: '800', fontSize: 16 },
  composeSubmitOff: { color: colors.inkFaint },
  composeForm: { padding: space(5), gap: space(3) },
  wcatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  wcatChip: { backgroundColor: colors.sunk, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.75), borderWidth: 1, borderColor: colors.line },
  titleInput: { ...font.heading, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: space(3) },
  bodyInput: { ...font.body, color: colors.ink, minHeight: 220, lineHeight: 24 },
  // 등록 에러 인라인
  composeErrBox: { backgroundColor: '#3a1a1a', borderRadius: radius.md, borderWidth: 1, borderColor: '#E5484D', padding: space(3) },
  composeErrTx: { ...font.caption, color: '#ff9a9a', lineHeight: 18 },
  // 등록 중 차단 오버레이(로딩)
  postingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', gap: space(3) },
  postingTx: { ...font.body, color: colors.white, fontWeight: '700' },
  // 명식 첨부
  attachBox: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(4), gap: space(2.5) },
  attachHead: { ...font.label, color: colors.ink },
  attachNone: { ...font.caption, color: colors.inkFaint, lineHeight: 19 },
  attachRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  luckChip: { alignSelf: 'flex-start' },
  attachWarn: { ...font.caption, color: colors.inkFaint, lineHeight: 18, fontSize: 12 },
});
