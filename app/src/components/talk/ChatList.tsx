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
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Platform } from 'react-native';
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
import { consultantsSnapshot, listConsultants, toProfileTarget } from '../../lib/talk/consultants';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';
import { fallbackElement } from '../../lib/ui/avatarColor';   // ★사진 없을 때 색 — **사람에게** 붙는다(단일 원본)
import { Icon } from '../kit/Icon';   // 상단 아이콘 단일 원본(Boss 2026-08-24)
import { Swipeable } from 'react-native-gesture-handler';   // 앱 = 왼쪽 스와이프(친구목록과 같은 틀)
import { pinRoom } from '../../lib/talk/roomActions';       // 상단고정 — 나가기는 호출부가 확인 후 부른다
import { roomTitle, memberCount } from '../../lib/talk/groupTalk';   // ★대화방 머리와 **같은 함수**(두 곳이 갈리면 안 된다)
import { NotifyBell } from './NotifyBell';   // 알림 벨+배지(단일 원본 — 친구목록과 같은 것)


/** 목록 한 줄 — 세션 + 상담사 이름. */
type Row = {
  id: string; consultantId: string | null; name: string;
  /** ★다인방 참여자(상담가 id). 비면 1:1 — 이게 없으면 두 방을 구분할 수 없다(0048) */
  guestIds: string[];
  /** 상단고정 시각. null = 안 함. **시각**인 이유: 「가장 최신 고정한 순」(Boss 2026-08-27) */
  pinnedAt: string | null;
  /**
   * ★사람 방인가 — `consultant_id` 가 **없는** 방(0050).
   * 상담가 방과 목록을 **같이 쓴다**(Boss: *"따로 거하게 만들필요없이"*). 다른 건 이름·사진뿐이다.
   */
  isUserRoom: boolean;
  /** 사람 방의 상대 얼굴(완성된 URL). 없으면 첫 글자를 그린다 */
  peerAvatar: string | null;
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
 * @param onOpen     한 대화를 열었을 때. ★**세션까지** 올려 보낸다 — 아래 참고
 * @param selectedId 지금 열려 있는 **세션 id**(웹 2칸에서 줄을 강조)
 *
 * ⚠️★2026-08-27 — 종전엔 `onOpen(consultantId)` 로 **세션 id 를 버렸다.**
 *   그러면 «같은 상담가와의 1:1 방» 과 «그 상담가를 포함한 다인방» 을 화면이 **구분할 수 없다.**
 *   실제로 그래서 초대해 새 방을 만들면 1:1 방의 내용이 남고 두 방이 같이 움직였다(Boss 제보).
 *   ⇒ 목록이 아는 것(세션 id · 참여자)을 **버리지 않고** 그대로 넘긴다.
 */
export function ChatList({ onOpen, selectedId, reloadKey = 0, wide, onSettings, onOpenProfile, onLeave }: {
  /** ⚠️`consultantId` 가 **null 이면 사람 방**이다 — 호출부가 그걸로 갈라야 한다(0050) */
  onOpen: (room: { sessionId: string; consultantId: string | null; guestIds: string[] }) => void;
  selectedId?: string;
  /** 답이 오거나 읽음 처리됐을 때 올려서 다시 읽게 한다(웹은 목록과 대화가 동시에 보인다) */
  reloadKey?: number;
  /** 목록 칸이 넓은가 — 좁으면 배너를 숨긴다(`TalkList` 와 같은 뜻) */
  wide?: boolean;
  /** 우측 톱니 */
  onSettings?: () => void;
  /** ★프로필 창을 **화면 루트**에서 열어 달라고 올려 보낸다(위 setProfile 주석 참고) */
  onOpenProfile?: (t: ProfileTarget) => void;
  /**
   * 「나가기」를 골랐을 때 — ⚠️**여기서 지우지 않는다.**
   * 대화가 함께 사라지는 되돌릴 수 없는 동작이라 **확인은 호출부**가 한다
   * (목록이 파괴적 동작의 판단자가 되면, 확인 없는 경로가 언젠가 생긴다).
   */
  onLeave?: (room: { sessionId: string; consultantId: string | null; guestIds: string[]; name: string; pinned?: boolean }) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  // 콘티 2면의 필터 칩 상태(전체 · 선생님 AI · 무료 친구)
  const [filter, setFilter] = useState<'all' | 'teacher' | 'friend'>('all');
  /** 스와이프 손잡이 — 동작을 누른 뒤 **스스로 닫으려고** 줄마다 하나씩 들고 있는다 */
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});
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
        .select('id, consultant_id, guest_ids, pinned_at, preview, last_at, turn_count, unread')
        // ★고정한 것이 위 · 그중 **최근에 고정한 것**이 더 위(Boss 2026-08-27 지시 그대로).
        //   해제하면 `pinned_at` 이 null 이 되어 자동으로 `last_at` 자리로 돌아간다 —
        //   «원래 자리» 를 따로 기억할 필요가 없다.
        .order('pinned_at', { ascending: false, nullsFirst: false })
        .order('last_at', { ascending: false }).limit(50),
      8000,
    );
    if (!r || r.error || !Array.isArray(r.data)) { setRows([]); return; }
    // ★★사람 방(consultant_id 가 없는 방)은 **상대 사람**을 보여야 한다.
    //   ⚠️방마다 물으면 방 수만큼 왕복이 생긴다(N+1) ⇒ **한 번에** 읽는다.
    //   ⚠️`talk_members` 는 RLS 로 «내가 있는 방» 만 준다 — 목록에 안 보일 방은 애초에 안 온다.
    const userRoomIds = (r.data as any[]).filter((x) => !x.consultant_id).map((x) => String(x.id));
    const peerOf: Record<string, { name: string; avatar: string | null }> = {};
    if (userRoomIds.length) {
      const [mem, me] = await Promise.all([
        withTimeout(supabase.from('talk_members').select('session_id, user_id').in('session_id', userRoomIds), 8000),
        supabase.auth.getUser(),
      ]);
      const myId = me?.data?.user?.id ?? '';
      const rowsM = (mem && !mem.error && Array.isArray(mem.data) ? mem.data : []) as any[];
      const others = [...new Set(rowsM.map((x) => String(x.user_id)).filter((u) => u !== myId))];
      const prof = others.length
        ? await withTimeout(supabase.from('profiles').select('id, nickname, display_name, avatar_path').in('id', others), 8000)
        : null;
      const pRows = (prof && !prof.error && Array.isArray(prof.data) ? prof.data : []) as any[];
      for (const sid of userRoomIds) {
        const mates = rowsM.filter((x) => String(x.session_id) === sid && String(x.user_id) !== myId);
        const names = mates.map((x) => {
          const pr = pRows.find((y) => String(y.id) === String(x.user_id));
          return String(pr?.nickname || pr?.display_name || t('friends.noName', '이름 없음'));
        });
        const first = mates[0] ? pRows.find((y) => String(y.id) === String(mates[0].user_id)) : null;
        const path = first?.avatar_path ?? null;
        peerOf[sid] = {
          // ★혼자 남은 방도 있다(상대가 나갔다) — 그때는 «대화 상대 없음» 이라고 적는다
          name: names.length ? roomTitle(names) : t('room.alone', '나 혼자 있는 방'),
          avatar: path ? (supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl ?? null) : null,
        };
      }
    }
    setRows(r.data.map((s: any) => ({
      id: s.id,
      consultantId: s.consultant_id ?? null,
      // ★다인방 판별 — 비면 1:1. 뷰가 이걸 안 주던 탓에 화면이 «틀린 열쇠» 를 골랐다(0048)
      guestIds: Array.isArray(s.guest_ids) ? (s.guest_ids as string[]) : [],
      pinnedAt: s.pinned_at ?? null,
      // ⚠️상담사가 사라졌어도 대화는 남는다 — 이름을 못 찾으면 빈 줄을 내지 말고 id 라도 보여 준다
      // ★★다인방이면 **참여자를 적는다**(2026-08-27 실측: 다인방 둘이 있는데 목록엔 둘 다
      //   「노쌤의 사주상담소」로만 떠서 **어느 방인지 구분이 안 됐다**).
      //   ⇒ 대화방 머리가 쓰는 `roomTitle` 을 **그대로** 쓴다 — 두 곳이 갈리면 같은 방이 다른 이름이 된다.
      isUserRoom: !s.consultant_id,
      peerAvatar: peerOf[String(s.id)]?.avatar ?? null,
      name: (() => {
        // ★사람 방은 **상대 이름**이다(상담가가 없다)
        if (!s.consultant_id) return peerOf[String(s.id)]?.name ?? t('room.alone', '나 혼자 있는 방');
        const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
        const guests = Array.isArray(s.guest_ids) ? (s.guest_ids as string[]) : [];
        return guests.length
          ? roomTitle([nameOf(s.consultant_id), ...guests.map(nameOf)])
          : nameOf(s.consultant_id);
      })(),
      preview: s.preview ?? null,
      lastAt: s.last_at,
      turns: s.turn_count ?? 0,
      unread: Number(s.unread ?? 0),
    })));
  }, [session]);

  /**
   * 상단고정 켜기/끄기.
   * ★화면을 **먼저 바꾼다**(낙관적) — 서버 왕복을 기다리면 «눌렀는데 아무 일도 안 나는» 것처럼 보인다.
   *   실패하면 목록을 다시 읽어 **진짜 상태로 되돌린다**(거짓말을 남기지 않는다).
   */
  const togglePin = useCallback(async (r: Row) => {
    const on = !r.pinnedAt;
    setRows((prev) => prev && prev.map((x) => (x.id === r.id ? { ...x, pinnedAt: on ? new Date().toISOString() : null } : x))
      // 정렬도 서버와 **같은 규칙**으로 다시 매긴다(안 하면 눌러도 자리가 안 바뀐다)
      .slice().sort((a, b) => {
        if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
        if (a.pinnedAt && b.pinnedAt) return a.pinnedAt < b.pinnedAt ? 1 : -1;
        return a.lastAt < b.lastAt ? 1 : -1;
      }));
    const ok = await pinRoom(r.id, on);
    if (!ok) void load();   // ★실패하면 되돌린다
  }, [load]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  // ★★다른 창에서 바뀐 것도 **지금** 반영한다(Boss 2026-08-27
  //   *"a 브라우저에서 대화방을 나갔는데 b브라우저에서는 안나가져있어 새로고침 하기 전까지"*).
  //   ⚠️`talk_sessions` 를 통째로 구독한다 — RLS 가 «내가 볼 수 있는 방» 만 보내 준다(0056).
  //   ⚠️이벤트마다 목록을 다시 읽는다(부분 갱신 안 함) — 정렬·미리보기·인원이 한 번에 맞아야 하고,
  //     방 목록은 크지 않아 다시 읽는 비용이 «틀린 상태로 보이는 비용» 보다 싸다.
  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel('sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'talk_sessions' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [session, load]);
  // 대화하고 돌아오면 갱신 — 방금 나눈 이야기가 목록에 없으면 사라진 것처럼 보인다
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (rows === null) {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }

  // ★묶음 판정은 **친구목록과 같은 출처**(`consultantsSnapshot`)를 쓴다 — 두 탭이 갈리면 안 된다
  const groupOf = (cid: string | null) => (cid ? consultantsSnapshot().find((c) => c.id === cid)?.group : undefined);
  /** 줄이 어느 칩에 속하나 — ★사람 방은 언제나 «친구» 다(상담가 묶음이 없다) */
  const bucketOf = (r: Row) => (r.isUserRoom ? 'friend' : groupOf(r.consultantId));
  /**
   * 상담가 사진 — ★친구목록과 **같은 출처**(`consultantsSnapshot`)에서 가져온다.
   * ⚠️Boss 2026-08-23 *"친구리스트에서 변경된 사진이 대화리스트에서는 반영이 안되어있어"* —
   *   이 목록은 `talk_session_list` 뷰만 읽어서 **사진 칸이 아예 없었다**(오행 색 + 첫 글자만 그렸다).
   *   질의를 새로 만들지 않는다 — 친구목록이 이미 받아 둔 것을 그대로 쓴다.
   */
  const avatarOf = (cid: string | null) => (cid ? consultantsSnapshot().find((c) => c.id === cid)?.avatar ?? null : null);
  const openPhoto = (cid: string, element: string) => {
    const c = consultantsSnapshot().find((x) => x.id === cid);
    if (!c) return;
    // ★변환은 `toProfileTarget` **한 곳**에서 한다 — 대화 말풍선의 얼굴도 같은 함수를 쓴다.
    //   각자 만들면 «같은 사람인데 창 내용이 다른» 일이 생긴다.
    // ★사진에서 열 때도 **그 줄의 세션**을 연다 — 상담가만 넘기면 어느 방인지 모른다
    const row = (rows ?? []).find((x) => x.consultantId === cid);
    setProfile(toProfileTarget(c, element, () => {
      setProfile(null);
      if (row) onOpen({ sessionId: row.id, consultantId: cid, guestIds: row.guestIds });
    }));
  };
  const byFilter = filter === 'all' ? rows : rows.filter((r) => bucketOf(r) === filter);
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
        {/* ★알림 — 돋보기 **왼쪽**(Boss 2026-08-26 *"돋보기 옆에 놔"*).
            이모지가 아니라 선 아이콘이라 옆 아이콘들과 **무게가 같다**. */}
        {/* ⚠️★둘 다 `topBtn` 으로 감싼다 — 감싸는 상자가 없으면 좌우 여백이 빠져
            `gap` 이 같아도 **눈에는 간격이 달라 보인다**(Boss 2026-08-27 지적, 친구목록과 같은 원인). */}
        <View style={styles.topBtn}><NotifyBell size={26} /></View>
        <PressableScale hitSlop={10} style={styles.topBtn} onPress={() => setSearchOpen((v) => !v)}>
          <Icon name={searchOpen ? 'close' : 'search'} size={26} color={searchOpen ? colors.ju : colors.inkSoft} />
        </PressableScale>
        {/* ⚠️★⋮ 더보기를 **뺐다**(Boss 2026-08-27
              *"점 3개로 오픈채팅 만들고 설정으로 진입하는데 이건 빼고"*).
            오픈채팅은 **따로 만드는 것이 아니라** 일반 방에 사람을 초대하면 되는 것이 됐고
            (*"따로 거하게 만들필요없이 그냥 일반 채팅방에 여러사람이 들어와있을수 있게 초대하면"*),
            설정은 친구목록 헤더에 이미 있다 ⇒ **여기 두 줄은 갈 곳이 사라졌다.**
            ★쓰지 않는 진입점을 남겨 두면 «있는데 아무 일도 안 하는 것» 이 된다. */}
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
        // ⚠️★색을 **목록 위치로 정하지 않는다**(Boss 2026-08-27 «친구목록과 대화리스트 이미지가 다르다»).
        //   정렬이 다르면 같은 사람이 목록마다 다른 색이 되고, 사진 없는 사람은 그 원이 곧 얼굴이라
        //   **다른 사람처럼 보인다.** ⇒ 그 사람의 id 로 고정한다.
        const el = fallbackElement(r.isUserRoom ? r.id : r.consultantId);
        const pinned = !!r.pinnedAt;
        /**
         * 밀면 나오는 두 동작 — **상단고정 · 나가기**(Boss 2026-08-27).
         * ⚠️누른 뒤 **스스로 닫는다** — 열어 두면 다음 줄을 누르려다 이걸 또 누른다
         *   (친구목록 스와이프가 같은 이유로 그렇게 한다).
         */
        const renderRight = () => (
          <View style={styles.swipeWrap}>
            <PressableScale style={styles.swipeAct}
              onPress={() => { swipeRefs.current[r.id]?.close(); void togglePin(r); }}
              accessibilityLabel={t(pinned ? 'chats.unpin' : 'chats.pin', '상단고정')}>
              {/* ★보이는 것은 **지금 상태**다 — 고정돼 있으면 채운 압정, 아니면 빈 압정.
                  '누르면 무엇이 되는가' 가 아니라 '지금 어떤가'(친구목록 별과 같은 규칙). */}
              <Text style={[styles.swipeIcon, pinned && styles.swipeIconOn]}>{pinned ? '📌' : '📌'}</Text>
              <Text style={styles.swipeTx} numberOfLines={1}>{t(pinned ? 'chats.unpin' : 'chats.pin', '상단고정')}</Text>
            </PressableScale>
            <PressableScale style={[styles.swipeAct, styles.swipeDanger]}
              onPress={() => { swipeRefs.current[r.id]?.close(); onLeave?.({ sessionId: r.id, consultantId: r.consultantId, guestIds: r.guestIds, name: r.name, pinned }); }}
              accessibilityLabel={t('chats.leave', '나가기')}>
              <Text style={styles.swipeIconOut}>↪</Text>
              <Text style={[styles.swipeTx, styles.swipeTxOut]} numberOfLines={1}>{t('chats.leave', '나가기')}</Text>
            </PressableScale>
          </View>
        );
        const row = (
          <PressableScale style={[styles.row, selectedId === r.id && styles.rowOn]}
            onPress={() => onOpen({ sessionId: r.id, consultantId: r.consultantId, guestIds: r.guestIds })}
            {...(Platform.OS === 'web' ? { onContextMenu: (e: any) => {
              // ★웹 = **우클릭**(Boss 2026-08-27). 스와이프는 손가락 동작이라 마우스에는 없다.
              // ⚠️기본 메뉴를 막지 않으면 브라우저 메뉴가 우리 메뉴 위에 겹쳐 뜬다.
              e?.preventDefault?.();
              onLeave?.({ sessionId: r.id, consultantId: r.consultantId, guestIds: r.guestIds, name: r.name, pinned });
            } } : null)}>
            {/* ★사진만 따로 — 줄을 누르면 대화, 사진을 누르면 프로필(Boss 2026-08-26) */}
            {/* ⚠️★사람 방은 **상담가 프로필을 열면 안 된다** — 그런 상담가가 없다.
                (`openPhoto` 는 `consultantsSnapshot()` 에서 찾는데 사람 방은 id 가 null 이다.) */}
            {/* ★★단체방은 **앞 3명 사진을 겹쳐** 그린다(Boss 2026-08-27 «벤다이어그램처럼»).
                한 명만 보여 주면 «누구 방인지» 가 안 보이고, 넷을 다 그리면 줄이 무너진다.
                ⚠️뒤에 오는 얼굴이 위로 올라오게 `zIndex` 를 준다 — 안 주면 겹침이 뒤집혀 어색하다. */}
            {!r.isUserRoom && r.guestIds.length ? (
              <View style={styles.stack}>
                {[r.consultantId, ...r.guestIds].filter(Boolean).slice(0, 3).map((cid, k) => {
                  const uri = avatarOf(cid as string);
                  const e = fallbackElement(cid);
                  return (
                    <View key={String(cid)} style={[styles.stackItem, { left: k * 15, zIndex: 3 - k }]}>
                      {uri
                        ? <ExpoImage source={{ uri }} style={styles.avSm} contentFit="cover" transition={140} />
                        : (
                          <View style={[styles.avSm, { backgroundColor: elementColor[e], alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ color: elementText[e], fontWeight: '900', fontSize: 13 }}>
                              {String(cid).slice(0, 1)}
                            </Text>
                          </View>
                        )}
                    </View>
                  );
                })}
              </View>
            ) : (
            <PressableScale hitSlop={6} disabled={r.isUserRoom} onPress={() => { if (!r.isUserRoom && r.consultantId) openPhoto(r.consultantId, el); }}>
              {(r.isUserRoom ? r.peerAvatar : avatarOf(r.consultantId))
                ? <ExpoImage source={{ uri: (r.isUserRoom ? r.peerAvatar : avatarOf(r.consultantId)) as string }} style={styles.av} contentFit="cover" transition={140} />
                : (
                  <View style={[styles.av, { backgroundColor: elementColor[el] }]}>
                    <Text style={{ color: elementText[el], fontWeight: '900', fontSize: 19 }}>{r.name.slice(0, 1)}</Text>
                  </View>
                )}
            </PressableScale>
            )}
            <View style={styles.col}>
              {/* ★★이름과 인원수를 **한 줄에** 둔다(Boss 2026-08-27
                  *"방 인원 숫자는 이름 옆에 떠야하고 만약 길이가 넘어가면 노쎔,한서윤,최... 3 이런식으로"*).
                  ⚠️이름에 `flexShrink` 를 줘야 **이름만 줄고 숫자는 안 밀린다** —
                    안 주면 긴 이름이 숫자를 화면 밖으로 밀어낸다.
                  ★숫자는 **다른 폰트 + 볼드**(Boss 지정) — 미리보기 글씨와 섞이면 이름의 일부로 읽힌다. */}
              <View style={styles.nameRow}>
                <Text style={[styles.name, { flexShrink: 1 }]} numberOfLines={1}>{r.name}</Text>
                {r.guestIds.length
                  ? <Text style={styles.num}>{memberCount(r.guestIds.length)}</Text> : null}
              </View>
              {/* 마지막에 물어본 것 — 무슨 얘기였는지가 이름보다 기억을 되살린다 */}
              {/* ★미리보기는 **한 줄**로 자른다 — 목록에서 본문을 읽게 하면 그건 목록이 아니다 */}
              <Text style={[styles.sub, r.unread > 0 && styles.subUnread]} numberOfLines={1}>
                {r.preview ?? t('chats.noTitle', '대화를 이어가 보세요')}
              </Text>
            </View>
            {/* ★시각은 **위**, 배지는 **아래**(Boss 지정 카톡 배치).
                시간부터 읽고 안 읽은 게 있는지 보는 순서가 자연스럽다. */}
            <View style={styles.meta}>
              {/* ★고정 표시 — 조작(스와이프·우클릭)을 감춘 마당에 상태까지 안 보이면
                  사용자는 자기가 켰는지 알 수 없다. 그건 «없는 기능» 이 된다. */}
              {pinned ? <Text style={styles.pinDot}>📌</Text> : null}
              <Text style={styles.time}>{ago(r.lastAt, t as never)}</Text>
              {/* 안 읽은 수 — ★0 이면 아예 그리지 않는다(0 배지는 정보가 아니라 잡음이다).
                  99 를 넘으면 '99+' — 정확한 수보다 '많다'가 더 쓸모 있다. */}
              {r.unread > 0
                ? <View style={styles.badge}><Text style={styles.badgeTx}>{r.unread > 99 ? '99+' : r.unread}</Text></View>
                : null}
            </View>
          </PressableScale>
        );
        // ★웹에는 스와이프를 안 씌운다 — 마우스로는 못 밀고, 씌우면 드래그가 스크롤을 방해한다.
        //   웹의 진입은 위의 `onContextMenu`(우클릭)다.
        return Platform.OS === 'web' ? <View key={r.id}>{row}</View> : (
          <Swipeable key={r.id} ref={(x) => { swipeRefs.current[r.id] = x; }}
                     renderRightActions={renderRight} overshootRight={false} friction={2}>
            {row}
          </Swipeable>
        );
      })}
      {/* ★프로필 창은 목록 **밖**이 아니라 안에 둔다 — ScrollView 형제로 두면 스크롤과 같이 밀린다 */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // 밀면 나오는 자리 — 옅은 면 위에 아이콘+글자(색면 덩어리는 «어색하다» 는 지적을 받았다)
  swipeWrap: { flexDirection: 'row', alignItems: 'stretch' },
  swipeAct: {
    width: 76, justifyContent: 'center', alignItems: 'center', gap: 2,
    backgroundColor: colors.juSoft, borderRadius: radius.md, marginVertical: 2, marginLeft: 4,
  },
  swipeDanger: { backgroundColor: colors.sunk },
  swipeIcon: { fontSize: 18, opacity: 0.45 },
  swipeIconOn: { opacity: 1 },
  swipeIconOut: { fontSize: 18, color: colors.inkSoft },
  swipeTx: { ...font.caption, fontSize: 11, color: colors.inkSoft },
  swipeTxOut: { color: colors.inkSoft },
  pinDot: { fontSize: 11, marginBottom: 2 },
  // 단체방 겹친 얼굴 — 48 자리에 34짜리 셋을 15씩 밀어 넣는다(34 + 15*2 = 64 → 48 안에서 살짝 넘침 없이)
  stack: { width: 48, height: 48, justifyContent: 'center' },
  stackItem: { position: 'absolute' },
  avSm: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, borderColor: colors.bg },
  // 이름 + 인원수 한 줄. ★`minWidth: 0` 이 있어야 자식의 `numberOfLines` 가 실제로 자른다
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), minWidth: 0 },
  // 인원수 — 카톡처럼 이름 **바로 옆**. ★미리보기와 **다른 폰트 + 볼드**(Boss 2026-08-27 지정):
  //   같은 글꼴이면 「노쌤, 한서윤, 최… 3」 의 3이 이름의 일부로 읽힌다.
  num: {
    ...font.caption, fontSize: 12, fontWeight: '800',
    color: colors.ju, flexShrink: 0,
    ...(Platform.OS === 'web' ? ({ fontVariantNumeric: 'tabular-nums' } as object) : null),
  },
  body: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(20) },
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
