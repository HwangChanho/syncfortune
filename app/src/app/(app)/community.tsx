// src/app/(app)/community.tsx — 커뮤니티 게시판(목록·카테고리·글쓰기·이용약관 동의). Apple 1.2 UGC.
// ─────────────────────────────────────────────────────────────────────────
// 목록(최신순·카테고리 필터) + 글쓰기(FAB→모달, 비속어 1차 차단) + 첫 작성 시 이용약관 동의(1회·zero-tolerance).
//   노출 여부는 원격 플래그(features.community)로 제어 — 관리자만(재제출 안전판) → 심사 통과 후 공개.
//   글 탭 → /communityPost?id=... (상세=댓글·좋아요·신고·차단).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, FlatList, StyleSheet, Modal, TextInput, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 전체화면 Modal 헤더 상단 안전영역(다이나믹아일랜드) — reunion.tsx 패턴
import { PressableScale } from '../../components/PressableScale';
import { BrandWordmark } from '../../components/BrandWordmark';
import { Alert } from '../../lib/ui/alert';
import { useAuth } from '../../lib/useAuth';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { listCharts, subscribeRepChange, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { listPosts, createPost, toSharedSaju, toSharedZiwei, COMMUNITY_CATEGORIES, type CommunityPost, type CommunityCategory, type CommunitySort } from '../../lib/backend/community';
import { colors, pastel, radius, space, shadow, font } from '../../lib/theme';
import { SECTIONS, baseKey } from '../../lib/content/contentSections'; // P2 후기 태그 — 콘텐츠 목록 단일 출처(라벨·라우트 여기서만)
import { Icon } from '../../components/kit/Icon';   // 상단 아이콘 단일 원본(Boss 2026-08-24)

/**
 * 카테고리 썸네일 — 콘티의 목록은 **오른쪽에 큰 네모 그림**이 붙는다.
 *
 * ★사진을 만들지 않는다. 글에는 이미지가 없고(업로드 기능 자체가 없다), 없는 걸 채우려
 *   아무 그림이나 얹으면 그건 글의 내용이 아니라 장식이라 오히려 목록을 읽기 어렵게 한다.
 *   ⇒ **카테고리 색 + 글자 한 자**로 그린다. 색만 봐도 무슨 얘기인지 구분된다.
 *   ⏳콘티의 실사 이미지는 **이미지 자산이 오면** 여기만 갈아 끼우면 된다(자리는 같다).
 * ⚠️색은 시안 팔레트(`pastel`)에서만 고른다 — 새 색을 만들지 않는다.
 */
const CAT_THUMB: Record<string, { bg: string; ink: string; ch: string }> = {
  love:   { bg: pastel.pink.bg,  ink: pastel.pink.ink,  ch: '연' },
  career: { bg: pastel.blue.bg,  ink: pastel.blue.ink,  ch: '직' },
  wealth: { bg: pastel.green.bg, ink: pastel.green.ink, ch: '재' },
  daily:  { bg: pastel.amber.bg, ink: pastel.amber.ink, ch: '일' },
  free:   { bg: pastel.blue.bg,  ink: pastel.blue.ink,  ch: '자' },
  tarot:  { bg: pastel.deep.bg,  ink: pastel.deep.ink,  ch: '타' },
  ziwei:  { bg: pastel.deep.bg,  ink: pastel.deep.ink,  ch: '자' },
};

/**
 * 상대 시각 — 「2시간 전」(콘티). ★날짜를 그대로 적으면 목록이 표처럼 읽힌다.
 * ⚠️`ChatList.ago` 와 **같은 규칙**을 쓴다 — 같은 앱에서 시간이 두 결로 보이면 안 된다.
 */
function ago(iso: string, t: (k: string, d?: string) => string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return t('chats.now', '방금');
  if (m < 60) return t('chats.minAgo', '{{n}}분 전').replace('{{n}}', String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t('chats.hourAgo', '{{n}}시간 전').replace('{{n}}', String(h));
  const d = Math.floor(h / 24);
  if (d === 1) return t('chats.yesterday', '어제');
  if (d < 7) return t('chats.dayAgo', '{{n}}일 전').replace('{{n}}', String(d));
  return String(iso).slice(0, 10);
}

/** 큰 수 축약 — 콘티의 「1.2k」. ★1000 미만은 그대로(축약이 오히려 부정확해 보인다). */
function compact(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

/** 작성자 동그라미 색 — 이름 해시로 **고정**한다(같은 사람이 목록마다 다른 색이면 못 알아본다). */
function authorHue(name: string): { bg: string; ink: string } {
  const P = [pastel.pink, pastel.blue, pastel.green, pastel.amber, pastel.deep];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return P[h % P.length];
}

/** i18n `t` 를 좁혀 쓴다(하네스·테스트에서도 간단한 함수 하나면 넣을 수 있게). */
type TFn = (k: string, d?: string) => string;

const EULA_KEY = 'pref.communityEula'; // 이용약관 동의 1회 플래그(Apple 1.2)

export default function CommunityScreen() {
  useLogContentVisit('community');
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets(); // 글쓰기 모달 헤더가 상단 안전영역(노치·다이나믹아일랜드)에 가려 버튼이 안 눌리던 것 방지
  const { isRegistered } = useAuth(); // 익명 세션이 상시 존재하므로 session 이 아닌 isRegistered 로 판정
  const [cat, setCat] = useState<CommunityCategory | undefined>(undefined); // undefined=전체
  // ★콘티의 맨 앞 두 칩은 **정렬**이다(카테고리가 아니다). 추천=최신 · 인기=좋아요 순
  const [sort, setSort] = useState<CommunitySort>('recommend');
  const [menu, setMenu] = useState(false);          // ☰ (콘티 3면)
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');                   // 제목 필터 — 온디바이스
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [compose, setCompose] = useState(false);
  // 이용약관 동의 여부(Apple 1.2) — null=프리로드 전. 마운트 effect 에서 비동기로 채운다(동기 SecureStore 블록 회피).
  const [eulaAgreed, setEulaAgreed] = useState<boolean | null>(null);
  const [eula, setEula] = useState(false);       // 이용약관 모달
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [wcat, setWcat] = useState<CommunityCategory>('daily'); // 작성 카테고리(기본=일상)
  const [wcatOpen, setWcatOpen] = useState(false);   // ★카테고리 드롭다운 열림(daniel 07-28)
  const [posting, setPosting] = useState(false);
  // 첨부 가능한 명식 = **본인(relation='self')만**. attachId=null 이면 첨부 없이 글만 올린다(기본).
  const [selfCharts, setSelfCharts] = useState<SavedChart[]>([]);
  const [attachId, setAttachId] = useState<string | null>(null);
  const [showLuck, setShowLuck] = useState(false); // 대운·세운까지 공개할지(기본 꺼짐 = 원국만)
  const [composeErr, setComposeErr] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null); // P2 후기 태그 — 어떤 콘텐츠의 후기인지(contentSections key) // 등록 에러를 모달 안에 인라인 표시(Alert 가 글쓰기 Modal 위에 안 떠 '무반응'처럼 보이던 것 해결)

  /**
   * 목록 — ★일진(데일리 스레드)도 **같은 카드로 흐른다**(2026-08-22).
   *
   * 종전엔 일진만 빼내 상단 고정 카드로 그렸는데, 콘티 3면에는 특별 카드가 없다.
   * ⚠️그 카드에 **체감 투표**가 붙어 있었다 — 그냥 지우면 기능이 죽는다.
   *   ⇒ 투표는 **글 상세로 옮겼다**(`communityPost.tsx`). 옮길 곳을 먼저 만들고 뺐다.
   */
  const load = useCallback(async () => {
    try {
      const rows = await listPosts(cat, 30, undefined, sort);
      // ⚠️★일진은 **오늘 것만** 남긴다.
      //   일진은 cron 이 매일 하나씩 만든다 — 전부 흘리면 목록이 「오늘의 일진」으로 뒤덮인다
      //   (실측으로 바로 드러났다: 첫 화면이 같은 제목 세 개였다).
      //   콘티가 원하는 건 '특별 카드가 없는 것'이지 '지난 자동 글이 쌓이는 것'이 아니다.
      const today = new Date().toISOString().slice(0, 10);
      setPosts(rows.filter((r) => r.kind !== 'daily' || r.daily_date === today));
    } catch { /* 목록 로드 실패=빈 목록 */ } finally { setLoading(false); setRefreshing(false); }
  }, [cat, sort]);
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
      await createPost(wcat, title, body, chart, topic);
      setCompose(false); setTitle(''); setBody(''); setWcat('daily'); setAttachId(null); setShowLuck(false);
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

  const catLabel = (c?: CommunityCategory) => c ? t(`community.cat.${c}`) : t('community.all', '전체');

  return (
    <View style={styles.bg}>
      {/* 카테고리 탭 — ★헤더를 껐으므로(_layout) 상태바 안전영역은 여기서 확보한다.
          contents 탭의 topBar 와 **같은 식**(insets.top + space(2))으로 두 탭의 상단선이 맞는다. */}
      {/* ★콘티 3면 헤더 — 워드마크 · 돋보기 · ☰. 종전엔 헤더가 아예 없고 칩 줄만 있었다. */}
      <View style={[styles.headBar, { paddingTop: insets.top + space(2) }]}>
        <BrandWordmark style={{ flex: 1 }} />
        <PressableScale hitSlop={12} style={styles.headIconBtn} onPress={() => setSearchOpen((v) => !v)}>
          <Icon name={searchOpen ? 'close' : 'search'} size={25} color={colors.ju} />
        </PressableScale>
        {/* ☰ — 콘티의 메뉴. 내 활동으로 간다(콘티 4면에 있는 그 화면들이다) */}
        <PressableScale hitSlop={12} style={styles.headIconBtn} onPress={() => setMenu((v) => !v)}>
          <Icon name="menu" size={25} color={colors.ju} />
        </PressableScale>
      </View>
      {menu ? (
        <View style={styles.menuBox}>
          <PressableScale style={styles.menuRow} onPress={() => { setMenu(false); router.push('/myposts'); }}>
            <Text style={styles.menuTx}>{t('my.posts', '작성한 글')}</Text>
          </PressableScale>
          <PressableScale style={styles.menuRow} onPress={() => { setMenu(false); router.push('/mycomments'); }}>
            <Text style={styles.menuTx}>{t('my.comments', '댓글과 답글')}</Text>
          </PressableScale>
        </View>
      ) : null}
      {searchOpen ? (
        <View style={styles.searchBox}>
          <TextInput value={q} onChangeText={setQ} autoFocus style={styles.searchTx}
            placeholder={t('community.searchPh', '글 제목으로 찾기')} placeholderTextColor={colors.inkFaint}
            returnKeyType="search"
            // keyboard-safe: 목록 상단 검색창이라 키보드가 올라와도 가려지지 않는다
          />
        </View>
      ) : null}
      <View style={[styles.catBar, { paddingTop: 0 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {/* ①정렬 — ★고르면 카테고리는 '전체'로 돌린다. 콘티에서 이 둘은 목록 전체를 보는 자리다 */}
          {(['recommend', 'popular'] as const).map((sk) => {
            const on = sort === sk && !cat;
            return (
              <PressableScale key={sk} style={[styles.catChip, on && styles.catChipOn]}
                              onPress={() => { setSort(sk); setCat(undefined); }}>
                <Text style={[styles.catChipTx, on && styles.catChipTxOn]}>
                  {sk === 'recommend' ? t('community.sortRecommend', '추천') : t('community.sortPopular', '인기')}
                </Text>
              </PressableScale>
            );
          })}
          {/* ②카테고리 일곱 */}
          {COMMUNITY_CATEGORIES.map((c) => (
            <PressableScale key={c} style={[styles.catChip, cat === c && styles.catChipOn]}
                            onPress={() => setCat(cat === c ? undefined : c)}>
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
          ListHeaderComponent={(
            <>
            {/* ★상단 글쓰기 박스(콘티) — 목록 맨 위에서 "여기에 쓰면 된다"를 먼저 말한다.
                ⚠️FAB 는 **남겨 둔다**: 이 박스는 목록과 함께 스크롤돼 위로 사라지고,
                  그러면 긴 목록에서는 글쓰기로 가는 길이 없어진다.
                ★두 곳 다 `onCompose` 하나를 부른다 — 로그인·약관 게이트가 갈리면 안 된다. */}
            <PressableScale style={styles.writeBox} onPress={onCompose}>
              <View style={styles.writeAv}><Text style={styles.writeAvTx}>✎</Text></View>
              <Text style={styles.writePh}>{t('community.writeBox', '오늘의 고민이나 질문을 남겨보세요 ✨')}</Text>
            </PressableScale>
            {/* ⚠️일진 특별 카드를 뺐다 — 콘티 3면은 모든 글이 같은 카드다(위 주석) */}
            </>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.ju} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('community.empty', '첫 글을 남겨보세요.')}</Text>}
          renderItem={({ item }) => {
            const th = CAT_THUMB[item.category] ?? CAT_THUMB.daily;
            const au = authorHue(item.author_name || '?');
            return (
            <PressableScale style={styles.postRow} onPress={() => router.push({ pathname: '/communityPost', params: { id: item.id } })}>
              <View style={styles.postMain}>
                {/* ①작성자 줄 — 동그라미 + 닉네임 + 시각(콘티) */}
                <View style={styles.postHead}>
                  <View style={[styles.au, { backgroundColor: au.bg }]}>
                    <Text style={[styles.auTx, { color: au.ink }]}>{(item.author_name || '?').slice(0, 1)}</Text>
                  </View>
                  <Text style={styles.auName} numberOfLines={1}>{item.author_name}</Text>
                  {item.ilju ? <Text style={styles.iljuBadge}>{item.ilju}</Text> : null}
                  <Text style={styles.postMeta}>{ago(item.created_at, t as TFn)}</Text>
                </View>

                <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.postBody} numberOfLines={2}>{item.body}</Text>

                {/* ②지표 — 콘티는 좋아요·댓글·조회 셋이다 */}
                <View style={styles.statRow}>
                  <Text style={styles.postStats}>♥ {item.like_count}</Text>
                  <Text style={styles.postStats}>💬 {item.comment_count}</Text>
                  <Text style={styles.postStats}>{t('community.views', '조회')} {compact(item.view_count ?? 0)}</Text>
                </View>

                {/* 후기 태그 — 콘텐츠 단일 출처(SECTIONS)에서 라벨을 가져온다 */}
                {item.topic ? (() => {
                  const t2 = SECTIONS.flatMap((sec) => sec.items).find((it) => it.key === item.topic);
                  return t2 ? (
                    <PressableScale style={styles.topicLink} onPress={() => router.push(t2.route as never)}>
                      <Text style={styles.topicLinkTx}>{t(t2.labelKey)} ›</Text>
                    </PressableScale>
                  ) : null;
                })() : null}
              </View>

              {/* ③오른쪽 그림 + 그 아래 카테고리 배지(콘티) */}
              <View style={styles.thumbCol}>
                <View style={[styles.thumb, { backgroundColor: th.bg }]} accessible={false} pointerEvents="none">
                  <Text style={[styles.thumbTx, { color: th.ink }]}>{th.ch}</Text>
                </View>
                <View style={[styles.catBadge, { backgroundColor: th.bg }]}>
                  <Text style={[styles.catBadgeTx, { color: th.ink }]}>{t(`community.cat.${item.category}`, item.category)}</Text>
                </View>
              </View>
            </PressableScale>
          );}}
        />
      )}

      {/* ⚠️글쓰기 FAB 를 **뺐다** — 콘티 3면에 없다(상단 글쓰기 박스가 그 일을 한다).
          ★박스는 목록과 함께 스크롤돼 사라지지만, 콘티가 그 배치다. 길게 읽다 쓰고 싶으면
            위로 올리면 된다 — 아이콘 하나를 늘 띄우는 것보다 화면이 조용하다. */}

      {/* 이용약관 동의(Apple 1.2 — zero tolerance) */}
      <Modal statusBarTranslucent visible={eula} transparent animationType="fade" onRequestClose={() => setEula(false)}>
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
            <PressableScale onPress={() => { setCompose(false); setComposeErr(null); }} hitSlop={14}><Icon name="close" size={22} color={colors.inkSoft} /></PressableScale>
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
            {/* ★카테고리 = 버튼 탭 → 드롭다운(daniel 2026-07-28). 칩을 5개 나열하면 제목·내용보다
                먼저 눈에 들어와 정작 쓸 것을 밀어낸다. 고른 값만 보이고 누를 때만 펼친다.
                ⚠️드롭다운은 '닫힘 지점'이 있어야 한다 — 배경 탭으로 닫는다(토글뷰 규칙). */}
            <View style={styles.wcatWrap}>
              <PressableScale style={styles.wcatBtn} onPress={() => setWcatOpen((v) => !v)}>
                <Text style={styles.wcatBtnTx}>{t(`community.cat.${wcat}`)}</Text>
                <Text style={styles.wcatCaret}>{wcatOpen ? '▲' : '▼'}</Text>
              </PressableScale>
              {wcatOpen && (
                <>
                  {/* 바깥 탭 = 닫기(리스트 안에 absolute 로 띄우지 않고 형제로 둔다) */}
                  <Pressable style={styles.wcatBackdrop} onPress={() => setWcatOpen(false)} />
                  <View style={styles.wcatMenu}>
                    {COMMUNITY_CATEGORIES.map((c) => (
                      <PressableScale key={c} style={[styles.wcatItem, wcat === c && styles.wcatItemOn]}
                        onPress={() => { setWcat(c); setWcatOpen(false); }}>
                        <Text style={[styles.wcatItemTx, wcat === c && styles.wcatItemTxOn]}>{t(`community.cat.${c}`)}</Text>
                      </PressableScale>
                    ))}
                  </View>
                </>
              )}
            </View>
            {/* P2 후기 태그(daniel 2026-08-05) — 목록은 콘텐츠 단일 출처(SECTIONS)라
                새 콘텐츠가 생기면 자동으로 따라온다. 라벨은 각 콘텐츠의 i18n 라벨 그대로.
                ★2026-08-21: **카테고리 제한을 풀었다.** 콘티에 「후기」 카테고리가 없어서인데,
                  없앤 게 아니라 축을 나눈 것이다 — 연애 글에도 "이 콘텐츠 보고 썼다"가 붙을 수 있다. */}
            {true && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicBar} contentContainerStyle={styles.topicRow}>
                {/* ★'인기' 섹션 사본(hot*)은 뺀다 — 같은 콘텐츠 태그가 두 번 뜨던 것을 정리(2026-08-06). */}
                {SECTIONS.flatMap((sec) => sec.items).filter((it) => it.ready !== false && it.key === baseKey(it.key)).map((it) => (
                  <PressableScale key={it.key} style={[styles.topicChip, topic === it.key && styles.topicChipOn]}
                    onPress={() => setTopic((cur) => (cur === it.key ? null : it.key))}>
                    <Text style={[styles.topicChipTx, topic === it.key && styles.topicChipTxOn]} numberOfLines={1}>{t(it.labelKey)}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            )}
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
  // paddingTop 은 렌더에서 insets.top + space(2) 로 준다(헤더를 껐으므로 — 위 주석). 여기 고정값을 두면 이중이 된다.
  headBar: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingBottom: space(2) },
  // ★글리프 대신 SVG(`kit/Icon`) — `⌕` 는 em 박스를 다 안 써서 20 을 줘도 콩알이었다
  headIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  menuBox: { marginHorizontal: space(4), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, marginBottom: space(2) },
  menuRow: { paddingHorizontal: space(4), paddingVertical: space(3) },
  menuTx: { ...font.body, color: colors.ink },
  searchBox: { marginHorizontal: space(4), backgroundColor: colors.sunk, borderRadius: radius.md, paddingHorizontal: space(3.5), marginBottom: space(2) },
  searchTx: { paddingVertical: space(2.5), ...font.body, color: colors.ink },
  catBar: { borderBottomWidth: 1, borderBottomColor: colors.line },
  catRow: { paddingHorizontal: space(4), paddingBottom: space(3), gap: space(2) }, // ★space(24)→3(daniel 2026-08-05 IMG_8382 '카테고리 아래 공간이 너무 커' — 96pt 유령 패딩)
  catChip: { backgroundColor: colors.sunk, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2), borderWidth: 1, borderColor: colors.line },
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  catChipTx: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  catChipTxOn: { color: colors.onJu },
  listWrap: { padding: space(5), paddingBottom: space(24), gap: space(3) },
  empty: { ...font.body, color: colors.inkFaint, textAlign: 'center', marginTop: space(16) },
  // 일진 데일리 카드(P1) — 목록 위 고정. 참여 문턱 최저(투표 탭 1회).
  // P2 후기 토픽 칩(작성)·딥링크(목록)
  topicBar: { marginBottom: space(2) },
  topicRow: { gap: space(1.5), paddingRight: space(4) },
  topicChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3), backgroundColor: colors.sunk },
  topicChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  topicChipTx: { fontSize: 12, lineHeight: 16, color: colors.inkSoft, fontWeight: '600' },
  topicChipTxOn: { color: colors.onJu, fontWeight: '800' },
  topicLink: { alignSelf: 'flex-start', backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingVertical: space(0.5), paddingHorizontal: space(2.5), marginBottom: space(1) },
  topicLinkTx: { fontSize: 11.5, lineHeight: 16, color: colors.ju, fontWeight: '800' },
  dailyCard: { backgroundColor: colors.juSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.ju + '55', padding: space(4), marginBottom: space(4) },
  dailyTag: { ...font.caption, color: colors.ju, fontWeight: '800' },
  dailyGz: { fontSize: 21, lineHeight: 28, fontWeight: '900', color: colors.ink, marginTop: space(1), marginBottom: space(1) },
  pollRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2.5) },
  pollChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3), backgroundColor: colors.card },
  pollChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  pollChipTx: { fontSize: 12.5, lineHeight: 17, color: colors.inkSoft, fontWeight: '600' },
  pollChipTxOn: { color: colors.onJu, fontWeight: '800' },
  pollStat: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  dailyTalk: { marginTop: space(3), alignSelf: 'flex-start' },
  dailyTalkTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  iljuBadge: { color: colors.ju, fontWeight: '800' },
  // ★가로 배치로 바뀌었다(썸네일 | 내용). `alignItems:'flex-start'` 라야 썸네일이 첫 줄에 맞는다 —
  //   기본값(stretch)이면 썸네일이 카드 높이만큼 늘어나 네모가 아니게 된다.
  postRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space(3.5),
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    padding: space(4.5), ...shadow.card,
  },
  // 상단 글쓰기 박스 — 입력창처럼 보이되 **누르면 모달**이다(여기서 바로 치게 하면 약관 게이트를 지나칠 수 있다)
  writeBox: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    paddingHorizontal: space(4), paddingVertical: space(3.5), marginBottom: space(3),
  },
  writeAv: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ju, alignItems: 'center', justifyContent: 'center' },
  writeAvTx: { fontSize: 15, color: colors.onJu, fontWeight: '900' },
  writePh: { ...font.body, color: colors.inkFaint, flex: 1 },

  postMain: { flex: 1, minWidth: 0, gap: space(1.5) },
  // 작성자 줄 — 동그라미 22 + 닉네임 + 시각(우측). ★시각은 `marginLeft:'auto'` 로 밀어 오른쪽 끝에
  au: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  auTx: { fontSize: 11, fontWeight: '900' },
  auName: { ...font.caption, color: colors.ink, fontWeight: '700', maxWidth: 110 },
  statRow: { flexDirection: 'row', gap: space(3), marginTop: space(0.5) },
  // 오른쪽 그림 칸 — 그림 + 그 아래 배지
  thumbCol: { alignItems: 'flex-end', gap: space(1.5) },
  catBadge: { paddingHorizontal: space(2), paddingVertical: 3, borderRadius: radius.sm },
  catBadgeTx: { fontSize: 11, lineHeight: 15, fontWeight: '800' },   // ⚠️`minWidth:0` 없으면 긴 제목이 썸네일을 밀어낸다
  thumb: { width: 84, height: 84, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  thumbTx: { fontSize: 30, fontWeight: '900' },
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
  // 타이틀 = 화면 정중앙(좌우 0·textAlign center). top 은 인라인(insets.top)으로 버튼과 같은 라인. pointerEvents none 이라 뒤 버튼 탭 통과.
  composeTitle: { ...font.heading, color: colors.ink, position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' },
  composeSubmit: { color: colors.ju, fontWeight: '800', fontSize: 16 },
  composeSubmitOff: { color: colors.inkFaint },
  composeForm: { padding: space(5), gap: space(3) },
  wcatWrap: { marginBottom: space(2), zIndex: 10 },
  wcatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(4) },
  wcatBtnTx: { ...font.body, color: colors.ink, fontWeight: '800' },
  wcatCaret: { ...font.caption, color: colors.inkSoft },
  wcatBackdrop: { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000 },
  wcatMenu: { marginTop: space(1.5), backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.md, overflow: 'hidden' },
  wcatItem: { paddingVertical: space(3), paddingHorizontal: space(4) },
  wcatItemOn: { backgroundColor: colors.juSoft },
  wcatItemTx: { ...font.body, color: colors.inkSoft },
  wcatItemTxOn: { color: colors.ju, fontWeight: '800' },
  wcatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  wcatChip: { backgroundColor: colors.sunk, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.75), borderWidth: 1, borderColor: colors.line },
  titleInput: { ...font.heading, color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: space(3) },
  bodyInput: { ...font.body, color: colors.ink, minHeight: 220, lineHeight: 24 },
  // 등록 에러 인라인
  // ⚠️★어두운 붉은 상자(#3a1a1a)는 **미드나잇 테마 잔재**였다 — 대비는 맞았지만
  //   흰 라벤더 화면에 검붉은 상자가 얹혀 혼자 다른 앱처럼 보였다. 라이트 톤으로 바꿨다.
  //   글자 #CD3035 on #FDECEC = 4.52 (계산값).
  composeErrBox: { backgroundColor: '#FDECEC', borderRadius: radius.md, borderWidth: 1, borderColor: '#F3C4C6', padding: space(3) },
  composeErrTx: { ...font.caption, color: '#CD3035', lineHeight: 18 },
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
