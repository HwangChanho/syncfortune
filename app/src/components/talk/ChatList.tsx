// app/src/components/talk/ChatList.tsx — 대화 목록 (카톡의 「채팅」 탭 왼쪽 칸)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"웹은 친구목록이랑 채팅 탭이 같이 좌우로 공간을 나눠서 열리면 되고"*
//   ⇒ 대화 목록도 **친구목록과 같은 자리**(왼쪽 칸)에 들어간다.
//     그래서 화면이 아니라 **컴포넌트**여야 한다 — `TalkHome` 이 둘 중 하나를 왼쪽에 끼운다.
//
// ■ 무엇이 여기 뜨나
//   `talk_sessions` — **실제로 오간 대화만**. 친구목록에 열넷이 있어도 이야기한 적 없으면 안 뜬다.
//   ★홈 블록 친구(오늘의 운세 등)는 세션을 만들지 않으므로 자연히 빠진다 —
//     걸러내는 코드가 따로 필요 없다(대화가 아니라 화면이니까).
//
// ■ '없음'을 두 가지로 구분한다
//   ⚠️'로그인 안 됨'과 '대화 없음'은 **사용자가 할 일이 다르다.** 같은 빈 화면을 띄우면 안 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import type { ProfileTarget } from './ProfileSheet';   // 카카오톡식 프로필 창(Boss 08-26)
import { PressableScale } from '../../components/PressableScale';
import { BrandWordmark } from '../BrandWordmark';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/core/withTimeout';
import { useAuth } from '../../lib/useAuth';
import { consultantsSnapshot, listConsultants } from '../../lib/talk/consultants';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';
import { Icon } from '../kit/Icon';   // 상단 아이콘 단일 원본(Boss 2026-08-24)

const EL = ['木', '火', '土', '金', '水'] as const;

/** 목록 한 줄 — 세션 + 상담사 이름. */
type Row = {
  id: string; consultantId: string; name: string;
  /** 미리보기 = 마지막 메시지 한 줄(Boss 2026-08-20 "텍스트 미리보기로 간략하게") */
  preview: string | null;
  lastAt: string; turns: number;
  /** 안 읽은 상담사 메시지 수 — 0 이면 배지를 그리지 않는다 */
  unread: number;
};

/** 상대 시각 — "방금 · 3분 전 · 어제". ★날짜를 그대로 적으면 대화 목록이 표처럼 읽힌다. */
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
  return new Date(iso).toLocaleDateString();
}

/**
 * 대화 목록.
 * @param onOpen     한 대화를 열었을 때(웹 2칸이면 오른쪽 칸에, 폰이면 대화 화면으로)
 * @param selectedId 지금 열려 있는 상담사 id(웹 2칸에서 줄을 강조)
 */
export function ChatList({ onOpen, selectedId, reloadKey = 0, wide, onSettings, onOpenProfile }: {
  onOpen: (consultantId: string) => void; selectedId?: string;
  /** 답이 오거나 읽음 처리됐을 때 올려서 다시 읽게 한다(웹은 목록과 대화가 동시에 보인다) */
  reloadKey?: number;
  /** 목록 칸이 넓은가 — 좁으면 배너를 숨긴다(`TalkList` 와 같은 뜻) */
  wide?: boolean;
  /** 우측 톱니 */
  onSettings?: () => void;
  /** ★프로필 창을 **화면 루트**에서 열어 달라고 올려 보낸다(위 setProfile 주석 참고) */
  onOpenProfile?: (t: ProfileTarget) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  // 콘티 2면의 필터 칩 상태(전체 · 선생님 AI · 무료 친구)
  const [filter, setFilter] = useState<'all' | 'teacher' | 'friend'>('all');
  const [more, setMore] = useState(false);        // ⋮ 더보기(콘티 2면)
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');                 // 이름 필터 — 온디바이스(원가 0)
  const [rows, setRows] = useState<Row[] | null>(null);   // null = 아직 모름(로딩)
  // ★프로필 창 — **사진만** 따로 눌린다. 줄을 누르면 종전대로 대화가 열린다(카톡이 그렇다).
  //   ⚠️친구목록(`TalkList`)에도 같은 것이 있다. 여기만 없으면 «대화목록에서는 안 된다» 가 된다.
  // ⚠️★훅은 **조기 return(`rows === null`)보다 반드시 위**에 둔다.
  //   아래에 두면 로딩 렌더(훅 8개) → 목록 렌더(훅 9개)로 개수가 늘어
  //   React #310 «Rendered more hooks than during the previous render» 로 화면이 통째로 죽는다.
  //   2026-08-26 웹이 실제로 이걸로 백지가 됐다. [[web-nested-text-crash]] 와 같은 «백지» 계열.
  /**
   * ★프로필 창은 **부모(화면 루트)가 그린다** — 여기서 그리면 안 된다.
   *   `absoluteFill` 은 **부모를 채운다**([[overlay-absolutefill-parent]]) — 이 컴포넌트는
   *   넓은 웹에서 «칸» 안에 있어서, 창이 칸 밖으로 못 나오고 갇힌다.
   *   ⚠️영상 배경을 쓰려면 RN `Modal` 도 못 쓴다(iOS 에서 VideoView 가 소리만 남는다).
   *   ⇒ 여기는 «누구를 눌렀는지»만 올려 보낸다.
   */
  const setProfile = (t: ProfileTarget | null) => { if (t) onOpenProfile?.(t); };

  const load = useCallback(async () => {
    if (!session) { setRows([]); return; }
    // 상담사 이름표가 필요하다 — 목록은 거의 안 바뀌므로 캐시를 먼저 쓰고, 없으면 한 번 읽는다
    let people = consultantsSnapshot();
    if (!people.length) people = await listConsultants();
    // ★뷰 하나로 **세션 + 안읽은수 + 미리보기**를 한 번에 받는다.
    //   세션마다 count 를 따로 물으면 대화 수만큼 왕복이 생긴다(N+1).
    const r = await withTimeout(
      supabase.from('talk_session_list')
        .select('id, consultant_id, preview, last_at, turn_count, unread')
        .order('last_at', { ascending: false }).limit(50),
      8000,
    );
    if (!r || r.error || !Array.isArray(r.data)) { setRows([]); return; }
    setRows(r.data.map((s: any) => ({
      id: s.id,
      consultantId: s.consultant_id,
      // ⚠️상담사가 사라졌어도 대화는 남는다 — 이름을 못 찾으면 빈 줄을 내지 말고 id 라도 보여 준다
      name: people.find((p) => p.id === s.consultant_id)?.name ?? s.consultant_id,
      preview: s.preview ?? null,
      lastAt: s.last_at,
      turns: s.turn_count ?? 0,
      unread: Number(s.unread ?? 0),
    })));
  }, [session]);

  useEffect(() => { void load(); }, [load, reloadKey]);
  // 대화하고 돌아오면 갱신 — 방금 나눈 이야기가 목록에 없으면 사라진 것처럼 보인다
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (rows === null) {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }

  // ★묶음 판정은 **친구목록과 같은 출처**(`consultantsSnapshot`)를 쓴다 — 두 탭이 갈리면 안 된다
  const groupOf = (cid: string) => consultantsSnapshot().find((c) => c.id === cid)?.group;
  /**
   * 상담가 사진 — ★친구목록과 **같은 출처**(`consultantsSnapshot`)에서 가져온다.
   * ⚠️Boss 2026-08-23 *"친구리스트에서 변경된 사진이 대화리스트에서는 반영이 안되어있어"* —
   *   이 목록은 `talk_session_list` 뷰만 읽어서 **사진 칸이 아예 없었다**(오행 색 + 첫 글자만 그렸다).
   *   질의를 새로 만들지 않는다 — 친구목록이 이미 받아 둔 것을 그대로 쓴다.
   */
  const avatarOf = (cid: string) => consultantsSnapshot().find((c) => c.id === cid)?.avatar ?? null;
  const openPhoto = (cid: string, element: string) => {
    const c = consultantsSnapshot().find((x) => x.id === cid);
    if (!c) return;
    setProfile({
      name: c.name, tagline: c.tagline, avatar: c.avatar, cover: c.cover,
      linkUrl: c.linkUrl, linkLabel: c.linkLabel, element,
      // ★기본 프로필(Boss 2026-08-26) — 나이·묶음. 없는 사람은 창이 그 줄을 안 그린다
      age: c.age ?? null, group: c.group, roleLabel: c.roleLabel ?? null,
      onTalk: () => { setProfile(null); onOpen(cid); },
    });
  };
  const byFilter = filter === 'all' ? rows : rows.filter((r) => groupOf(r.consultantId) === filter);
  // ★검색은 **거르기만** 한다(묶음·정렬을 건드리지 않는다)
  const k = q.trim().toLowerCase();
  const visible = k ? byFilter.filter((r) => r.name.toLowerCase().includes(k)) : byFilter;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      {/* ── 상단: 제목 + 아이콘 (Boss 2026-08-20 카톡 채팅목록 배치) ── */}
      <View style={styles.topRow}>
        {/* ★콘티 2면 헤더 = **워드마크 · 돋보기 · ⋮**. 제목 글자("운대화")가 아니다 —
            탭바가 이미 어느 탭인지 말해 주므로 제목을 또 쓰면 같은 말이 두 번이다. */}
        <BrandWordmark symbol style={{ flex: 1 }} />   {/* ★심볼+글자 (Boss 2026-08-26) — 넓은 목록 칸이라 이름이 안 잘린다 */}
        <PressableScale hitSlop={10} onPress={() => setSearchOpen((v) => !v)}>
          <Icon name={searchOpen ? 'close' : 'search'} size={26} color={searchOpen ? colors.ju : colors.inkSoft} />
        </PressableScale>
        {/* ⋮ — 콘티의 더보기. ★오픈채팅과 설정이 여기로 들어간다(아이콘 둘을 하나로 접었다) */}
        <PressableScale hitSlop={10} onPress={() => setMore((v) => !v)}>
          <Icon name="more" size={26} />
        </PressableScale>
      </View>

      {/* ── 필터 칩 — ★콘티 2면 그대로 셋(전체 · 선생님 AI · 무료 친구) ──
          ⚠️'최근'은 여기 없다(콘티). 이 목록은 **이미 최근 순**이라 칩이 할 일이 없다. */}
      <View style={styles.chips}>
        {(['all', 'teacher', 'friend'] as const).map((k) => (
          <PressableScale key={k} style={[styles.chip, filter === k && styles.chipOn]} onPress={() => setFilter(k)}>
            <Text style={[styles.chipTx, filter === k && styles.chipTxOn]}>
              {t(`talk.filter.${k}`, k === 'all' ? '전체' : k === 'teacher' ? '선생님 AI' : '무료 친구')}
            </Text>
          </PressableScale>
        ))}
      </View>

      {/* ⚠️배너를 **뺐다** — 콘티 2면에 없다(1면에서 뺀 것과 같은 이유). */}

      {/* ⋮ 더보기 — 열렸을 때만. ★모달이 아니라 **접히는 줄**이다: 목록 위에서 바로 고르고 닫힌다 */}
      {more ? (
        <View style={styles.moreBox}>
          <PressableScale style={styles.moreRow} onPress={() => { setMore(false); router.push('/rooms'); }}>
            <Text style={styles.moreTx}>{t('rooms.title', '오픈채팅')}</Text>
          </PressableScale>
          <PressableScale style={styles.moreRow} onPress={() => { setMore(false); onSettings?.(); }}>
            <Text style={styles.moreTx}>{t('my.settings', '설정 및 개인정보')}</Text>
          </PressableScale>
        </View>
      ) : null}

      {/* 검색 — ⌕ 로 연다(콘티 헤더의 돋보기) */}
      {searchOpen ? (
        <View style={styles.searchBox}>
          <TextInput
            value={q} onChangeText={setQ} autoFocus
            style={styles.search} placeholder={t('talk.searchPh', '이름으로 찾기')}
            placeholderTextColor={colors.inkFaint} returnKeyType="search"
            // keyboard-safe: 목록 상단 검색창이라 키보드가 올라와도 가려지지 않는다
          />
        </View>
      ) : null}

      {!visible.length ? (
        <View style={styles.center}>
          {/* ★'로그인 안 됨'과 '대화 없음'을 다른 말로 — 사용자가 무엇을 해야 하는지가 다르다 */}
          <Text style={styles.emptyTx}>
            {session
              ? t('chats.empty', '아직 나눈 이야기가 없어요.\n연락처에서 친구를 눌러 보세요.')
              : t('chats.needLogin', '로그인하면 나눈 이야기가 여기 쌓여요.')}
          </Text>
          {!session && (
            <PressableScale style={styles.cta} onPress={() => router.push('/login')}>
              <Text style={styles.ctaTx}>{t('common.login', '로그인')}</Text>
            </PressableScale>
          )}
        </View>
      ) : visible.map((r, i) => {
        const el = EL[(i + 1) % EL.length];
        return (
          <PressableScale key={r.id} style={[styles.row, selectedId === r.consultantId && styles.rowOn]} onPress={() => onOpen(r.consultantId)}>
            {/* ★사진만 따로 — 줄을 누르면 대화, 사진을 누르면 프로필(Boss 2026-08-26) */}
            <PressableScale hitSlop={6} onPress={() => openPhoto(r.consultantId, el)}>
              {avatarOf(r.consultantId)
                ? <ExpoImage source={{ uri: avatarOf(r.consultantId) as string }} style={styles.av} contentFit="cover" transition={140} />
                : (
                  <View style={[styles.av, { backgroundColor: elementColor[el] }]}>
                    <Text style={{ color: elementText[el], fontWeight: '900', fontSize: 19 }}>{r.name.slice(0, 1)}</Text>
                  </View>
                )}
            </PressableScale>
            <View style={styles.col}>
              <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
              {/* 마지막에 물어본 것 — 무슨 얘기였는지가 이름보다 기억을 되살린다 */}
              {/* ★미리보기는 **한 줄**로 자른다 — 목록에서 본문을 읽게 하면 그건 목록이 아니다 */}
              <Text style={[styles.sub, r.unread > 0 && styles.subUnread]} numberOfLines={1}>
                {r.preview ?? t('chats.noTitle', '대화를 이어가 보세요')}
              </Text>
            </View>
            {/* ★시각은 **위**, 배지는 **아래**(Boss 지정 카톡 배치).
                시간부터 읽고 안 읽은 게 있는지 보는 순서가 자연스럽다. */}
            <View style={styles.meta}>
              <Text style={styles.time}>{ago(r.lastAt, t as never)}</Text>
              {/* 안 읽은 수 — ★0 이면 아예 그리지 않는다(0 배지는 정보가 아니라 잡음이다).
                  99 를 넘으면 '99+' — 정확한 수보다 '많다'가 더 쓸모 있다. */}
              {r.unread > 0
                ? <View style={styles.badge}><Text style={styles.badgeTx}>{r.unread > 99 ? '99+' : r.unread}</Text></View>
                : null}
            </View>
          </PressableScale>
        );
      })}
      {/* ★프로필 창은 목록 **밖**이 아니라 안에 둔다 — ScrollView 형제로 두면 스크롤과 같이 밀린다 */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(20) },
  // ★아이콘이 둘이라 gap 을 준다 — 붙여 두면 오픈채팅을 누르려다 설정이 눌린다
  moreBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, marginBottom: space(3) },
  moreRow: { paddingHorizontal: space(4), paddingVertical: space(3) },
  moreTx: { ...font.body, color: colors.ink },
  searchBox: { backgroundColor: colors.sunk, borderRadius: radius.md, paddingHorizontal: space(3.5), marginBottom: space(3) },
  search: { paddingVertical: space(2.5), ...font.body, color: colors.ink },
  chips: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  chip: {
    paddingHorizontal: space(3.5), paddingVertical: space(1.5), borderRadius: radius.pill,
    backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  // ★고른 칩 글자는 `onJu`(강조색 위 대비 — `check:onaccent`)
  chipTxOn: { color: colors.onJu },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(3) },
  head: { flex: 1, fontSize: 22, lineHeight: 30, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  // ★친구목록과 **같은 크기**(26). 두 탭을 오가는데 아이콘 크기가 다르면 눈에 띈다.
  // ★TalkList 와 **같은 규격**이다(`kit/Icon`). 종전엔 이 스타일이 두 파일에 복제돼 있었다.
  topBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  banner: { marginBottom: space(3) },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space(16), gap: space(4) },
  emptyTx: { ...font.body, color: colors.inkFaint, textAlign: 'center', lineHeight: 22 },
  cta: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3) },
  // ★강조색 위 글자는 `onJu`(`check:onaccent`)
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '900' },

  // ★카톡 비율 — 아바타는 화면 폭의 약 13%, 행은 위아래 여백이 넉넉하다
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3.5), paddingVertical: space(3), paddingHorizontal: space(1), borderRadius: radius.md },
  rowOn: { backgroundColor: colors.juSoft },
  av: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  col: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15.5, lineHeight: 21, fontWeight: '700', color: colors.ink },
  sub: { ...font.caption, color: colors.inkFaint },
  // 시각(위) · 배지(아래) — 사이를 벌려 두 정보가 붙어 보이지 않게
  meta: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', gap: space(1.5), minHeight: 40 },
  time: { ...font.caption, color: colors.inkFaint },
  turns: { ...font.caption, color: colors.inkFaint },
  // 안 읽음 배지 — 강조색 위 글자는 `onJu`(`check:onaccent`)
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.ju, alignItems: 'center', justifyContent: 'center' },
  badgeTx: { fontSize: 11.5, lineHeight: 15, fontWeight: '900', color: colors.onJu },
  // 안 읽은 대화는 미리보기를 진하게 — 목록을 훑을 때 눈이 먼저 간다
  subUnread: { color: colors.ink, fontWeight: '700' },
});
