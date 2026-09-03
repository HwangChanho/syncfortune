// app/src/components/talk/UserRoomView.tsx — **사람끼리의 대화 화면**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"기본적으로 친구추가하면 서로 채팅도 가능하게 하자"* ·
//   *"따로 거하게 만들필요없이 그냥 일반 채팅방에 여러사람이 들어와있을수 있게"*
//
// ■ ★말풍선을 **다시 만들지 않는다**
//   `TalkThread` 가 이미 ①내 말/남의 말 ②화자 얼굴(`who`) ③가운데 안내(`system`) 를 그린다.
//   새로 그리면 «상담가 방과 사람 방의 말풍선이 다른» 앱이 된다([[duplicate-ui-single-source]]).
//   ⇒ 여기서는 **데이터를 그 모양으로 옮기기만** 한다:
//     내 말 → `role:'user'` · 남의 말 → `role:'assistant'` + `who` · 안내 → `system`
//
// ■ ★운이 안 든다 — 그래서 **운에 관한 것이 하나도 없다**
//   이 화면에는 잔액 띠도, 「운이 모자라요」도, 묶음 안내도 없다.
//   LLM 을 안 부르니 원가가 0이고, 없는 비용을 화면에 적을 이유가 없다.
//
// ■ ⚠️실시간 구독은 **이 화면이 살아 있는 동안만**
//   나가면서 안 끊으면 방을 옮겨도 옛 방의 말이 흘러 들어온다.
// ═══════════════════════════════════════════════════════════════════════════
import { sizedImage } from '../../lib/media/imageUrl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   // ★헤더가 상태바에 먹히던 것(Boss 2026-08-31)
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { Icon } from '../kit/Icon';
import { TalkThread, type TalkItem } from './TalkThread';
import { Alert } from '../../lib/ui/alert';   // ★RN Alert 아님 — 웹에서도 뜨고 큐를 탄다
import { pickImageUri, bytesOfUri, canPickImage } from '../../lib/media/pickImage';   // 폰 사진 고르기(이미 있던 모듈)
import {
  loadUserMessages, sendUserMessage, subscribeUserRoom, roomPeople,
  markRoomRead, subscribeRoomRead, unreadBy, uploadRoomPhoto, sendTyping, subscribeTyping,
  type UserMsg, type RoomPerson,
} from '../../lib/talk/userRoom';
import { supabase } from '../../lib/supabase';
import { listConsultants, type Consultant } from '../../lib/talk/consultants';   // @ 로 부를 선생님(Boss 08-27)
import { askLive } from '../../lib/talk/liveTalk';
import { colors, space, radius, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';

/** 프로필 사진 경로 → 공개 URL. ⚠️버킷 이름은 상담가 아바타와 같은 곳을 쓴다. */
function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  // ★목록 얼굴은 작게 그린다 — 원본(폰 사진 1~3MB)을 받으면 방 하나 여는 데 수 MB 다(2026-08-29)
  try { return sizedImage(supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl, 240); } catch { return null; }
}

/**
 * 사람끼리의 대화방.
 *
 * @param sessionId 방
 * @param myId      나(내 말인지 가르는 유일한 근거)
 * @param onBack    폰에서 뒤로
 * @param onInvite  ＋ — 친구를 이 방에 부른다
 * @param onLeave   나가기(확인은 호출부가 한다 — 되돌릴 수 없는 동작이므로)
 */
export function UserRoomView({ sessionId, myId, onBack, onInvite, onLeave, mention }: {
  sessionId: string;
  myId: string;
  onBack?: () => void;
  onInvite?: () => void;
  /**
   * ★밖(초대 창)에서 «이 선생님을 부른다» 고 고른 이름 — 입력칸에 `@이름 ` 을 넣는다.
   * ⚠️**보내지는 않는다.** 무엇을 물을지는 사람이 쓴다 — 답 한 번이 곧 운 차감이라,
   *   고르자마자 보내면 «누른 적 없는 돈» 이 된다.
   * ⚠️같은 이름을 다시 골라도 들어가게 `{ name, n }` 처럼 **매번 새 값**으로 받는다
   *   (문자열만 받으면 두 번째부터 useEffect 가 안 돈다).
   */
  mention?: { name: string; n: number } | null;
  onLeave?: () => void;
}) {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  // ★훅은 전부 조기 return 위에(React #310)
  const [msgs, setMsgs] = useState<UserMsg[]>([]);
  const [people, setPeople] = useState<RoomPerson[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  /**
   * ★★`@이름` 으로 부를 수 있는 선생님들 (Boss 2026-08-27
   *   *"실제 사람이랑 대화할때는 사진공유 ai 선생님 지목 @ 이걸로"*).
   * ★목록은 이미 있는 `listConsultants()` 를 그대로 쓴다 — 새 표를 만들지 않는다.
   */
  const [teachers, setTeachers] = useState<Consultant[]>([]);
  useEffect(() => { void listConsultants().then((cs) => setTeachers(cs.filter((c) => c.kind === 'live'))); }, []);
  /**
   * 입력칸 높이 — Boss 2026-08-27
   *   *"텍스트필드가 두줄로 잡히는데 한줄로 · 길어지면 올라오게 · 5줄 이상부턴 스크롤"*
   *
   * ⚠️`multiline` 만 주면 웹에서 `<textarea rows=2>` 가 되어 **처음부터 두 줄**이다.
   *   ⇒ 높이를 **내용에 맞춰 우리가 정한다**(`onContentSizeChange`).
   * ★상한(5줄)에 닿으면 더 안 커지고 안에서 스크롤된다 — 입력칸이 화면을 먹지 않게.
   */
  const [inputH, setInputH] = useState(0);
  const inputRef = useRef<TextInput>(null);
  /**
   * ★키보드가 열린 높이 — **값이 아니라 «바뀌었다»** 를 `TalkThread` 에 넘겨 맨 아래로 붙인다
   *   (Boss 2026-09-02 *"키보드 때문에 내 채팅이 안보여"*).
   * ■ 이 화면은 `KeyboardAvoidingView` 로 입력바를 올린다 ⇒ 목록(`flex:1`)이 그만큼 **줄어든다**.
   *   그런데 스크롤 위치는 그대로라, 방금 쓴 말이 보이는 영역 밖으로 밀린다.
   * ■ ⚠️★AI 대화(`talk.tsx`)와 **같은 병**이다 — 한쪽만 고치면 다른 쪽이 그대로 남는다.
   *   두 화면이 **같은 `TalkThread`** 를 쓰므로, 고침도 그 한 곳에 두고 여기선 값만 넘긴다.
   */
  /**
   * ★★**상대가 입력 중** — 점 세 개 말풍선을 띄운다 (Boss 2026-09-02).
   * ■ 신호는 realtime broadcast 로만 온다(남기지 않는다 — `userRoom.ts` 주석).
   * ■ ⚠️**꺼 주는 사람이 없다.** 상대가 지우고 나가면 신호가 안 온다 ⇒ 신호를 받을 때마다
   *   **3초 타이머를 새로 건다**. 3초 동안 조용하면 저절로 꺼진다.
   *   (그게 없으면 «영영 입력 중인 사람» 이 남는다.)
   */
  const [theirTyping, setTheirTyping] = useState(false);
  const typingOffRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const off = subscribeTyping(sessionId, myId, () => {
      setTheirTyping(true);
      if (typingOffRef.current) clearTimeout(typingOffRef.current);
      typingOffRef.current = setTimeout(() => setTheirTyping(false), 3000);
    });
    return () => {
      off();
      if (typingOffRef.current) clearTimeout(typingOffRef.current);
      setTheirTyping(false);   // 방을 옮기면 남기지 않는다
    };
  }, [sessionId, myId]);
  /**
   * 내가 치고 있음을 알린다 — ★**1.5초에 한 번만** 보낸다(글자마다 보내면 회선을 채운다).
   * ⚠️빈 칸이 되면 안 보낸다 — 지우는 것은 «입력 중» 이 아니다.
   */
  const lastTypingRef = useRef(0);
  const notifyTyping = () => {
    if (!draft.trim()) return;
    const now = Date.now();
    if (now - lastTypingRef.current < 1500) return;
    lastTypingRef.current = now;
    sendTyping(sessionId, myId);
  };

  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s2 = Keyboard.addListener(showEvt as never, (e: any) => setKbH(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt as never, () => setKbH(0));
    return () => { s2.remove(); h.remove(); };
  }, []);
  /**
   * 초대 창에서 고른 선생님을 **입력칸에 얹는다** — `@이름 ` 을 넣고 커서를 준다.
   * ⚠️쓰던 글을 **지우지 않는다**(앞에 붙인다) — 반쯤 쓴 문장이 사라지면 그게 더 나쁘다.
   * ⚠️이미 그 이름이 들어 있으면 **두 번 넣지 않는다**.
   */
  useEffect(() => {
    if (!mention?.name) return;
    setDraft((d) => (d.includes(`@${mention.name}`) ? d : `@${mention.name} ${d}`.trimEnd() + (d ? '' : ' ')));
    inputRef.current?.focus();
  }, [mention?.name, mention?.n]);
  /**
   * ⚠️★이 화면에는 **안전영역이 아예 없었다**(Boss 2026-08-31 스크린샷):
   *   제목 「이름 없음」 이 시계·LTE 와 **같은 줄**에 겹치고, ☰·🗑 아이콘이 상태바에 먹혀
   *   **누를 수조차 없었다.** 상담가 방(`talk.tsx`)에는 있는데 **친구 방에만** 빠져 있었다.
   *   ★같은 필요의 두 경로 중 한쪽만 고쳐진 그 부류다([[talk-must-know-today]] 와 같은 결).
   */
  const insets = useSafeAreaInsets();
  /**
   * ⚠️★★2026-08-27 재수정 — Boss *"택스트 칸은 기본 한줄이라니깐"* (같은 요청이 **두 번째**다).
   *
   * ■ 왜 처음 수정이 부족했나 — **피드백 루프**
   *   웹에서 `onContentSizeChange` 가 주는 값은 사실상 textarea 의 `scrollHeight` 다.
   *   그런데 우리가 그 값으로 **height 를 정하면**, 다음 측정의 `scrollHeight` 는 그 height 가 된다.
   *   ⇒ 한 번 커진 높이가 **글을 지워도 안 줄어든다.** 빈 칸이 다섯 줄로 벌어져 있던 이유다.
   * ⇒ ①**글이 비면 잰 값을 버린다**(아래 effect) ②그리고 높이 계산에서도 빈 칸은 **무조건 한 줄**로 둔다.
   *   두 겹으로 막는 이유: effect 는 다음 렌더에 반영되므로, 그 한 프레임을 계산 쪽이 덮는다.
   */
  useEffect(() => { if (!draft) setInputH(0); }, [draft]);

  // 방이 바뀌면 **처음부터** 다시 읽는다(앞 방의 말이 남으면 안 된다)
  useEffect(() => {
    let alive = true;
    setMsgs([]); setPeople([]);
    void loadUserMessages(sessionId).then((m) => { if (alive) setMsgs(m); });
    void roomPeople(sessionId).then((p) => { if (alive) setPeople(p); });
    // ★실시간 — 상대가 말하면 바로 뜬다. 없으면 «다시 열어야 보이는» 게시판이 된다.
    const off = subscribeUserRoom(sessionId, (m) => {
      if (!alive) return;
      /**
       * ⚠️내가 보낸 것은 이미 화면에 있다 — 중복을 **두 겹**으로 막는다.
       * ① 같은 id 가 이미 있으면 무시(실시간이 두 번 오는 경우)
       * ② ★**임시 줄(음수 id)을 걷어낸다** — 낙관적 표시로 먼저 넣은 그 줄이다.
       *   id 로는 절대 안 맞는다(임시는 음수·진짜는 양수) ⇒ **내 발신 + 같은 본문**으로 가른다.
       *   ⚠️이 한 줄이 없으면 «보낸 말이 두 번 뜬다» — 낙관적 표시의 대표적 실패다.
       */
      setMsgs((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        const cleaned = m.senderId === myId
          ? prev.filter((x) => !(x.id < 0 && x.senderId === myId && x.body === m.body))
          : prev;
        return [...cleaned, m];
      });
      // ★남의 말이 오면 **내가 읽은 것**으로 표시한다(이 방을 보고 있으니까)
      if (m.senderId !== myId) void markRoomRead(sessionId);
    });
    // ★★상대가 읽으면 **내 「1」이 사라져야** 한다 — 이 구독이 없으면 다시 열어야 바뀐다
    const offRead = subscribeRoomRead(sessionId, () => {
      if (!alive) return;
      void roomPeople(sessionId).then((p) => { if (alive) setPeople(p); });
    });
    // 방을 열면 읽음 처리 — 서버가 `now()` 로 찍는다(앱 시각을 보내면 미래로 남의 1을 지운다)
    void markRoomRead(sessionId);
    return () => { alive = false; off(); offRead(); };
  }, [sessionId, myId]);

  const nameOf = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p]));
    return (id: string) => map.get(id) ?? null;
  }, [people]);

  /** 서버 모양 → `TalkThread` 모양. ★여기가 이 파일의 전부다. */
  const items: TalkItem[] = useMemo(() => msgs.map((m) => {
    if (m.role === 'system') return { id: `s${m.id}`, role: 'assistant' as const, body: '', system: m.body };
    // ★AI 가 말한 줄 — 사람과 **다른 갈래**로 그린다(이름을 상담가 목록에서 찾는다)
    if (m.role === 'assistant') {
      const tc = teachers.find((x) => x.id === m.speakerId);
      return {
        id: `a${m.id}`, role: 'assistant' as const, body: m.body, sentAt: m.sentAt,
        who: { name: tc?.name ?? 'AI', avatar: tc?.avatar ?? null, id: m.speakerId ?? undefined },
      };
    }
    const mine = m.senderId === myId;
    const p = nameOf(m.senderId);
    return {
      id: `m${m.id}`,
      role: mine ? ('user' as const) : ('assistant' as const),
      body: m.body,
      // ★보낸 시각 — 말풍선 옆 시간과 날짜 구분선이 이 값을 쓴다(Boss 2026-09-01)
      sentAt: m.sentAt,
      // ★내 말에만 「1」 — 아직 안 읽은 사람 수(나 제외). 0 이면 컴포넌트가 안 그린다
      ...(mine ? { unread: unreadBy(people, myId, m.sentAt) } : {}),
      // 남의 말에만 얼굴을 붙인다(내 말 옆에 내 얼굴은 카톡도 안 그린다)
      ...(mine ? {} : { who: { name: p?.name ?? '', avatar: avatarUrl(p?.avatarPath ?? null), id: m.senderId } }),
      // ★사진 (Boss 2026-08-27) — `TalkThread` 가 이미 그릴 줄 안다(새 그리기 규칙을 안 만든다)
      ...(m.imagePath ? { image: { uri: avatarUrl(m.imagePath) ?? '' } } : {}),
    };
  }), [msgs, myId, nameOf, people, teachers]);

  const others = people.filter((p) => p.id !== myId);
  const title = others.length
    ? others.map((p) => p.name).join(', ')
    : t('room.alone', '나 혼자 있는 방');

  /**
   * ★★**보내자마자 화면에 띄운다**(낙관적 표시) — 서버는 그다음이다 (Boss 2026-09-02
   *   *"채팅이 가끔 느리게 나가서 안보이는 경우가 있는데 일단 로컬에는 노출하고 서버로 보내야
   *     유저가 안 햇갈려"*).
   *
   * ■ 종전엔 **서버가 답할 때까지 아무것도 안 보였다.** 회선이 느리면 «안 갔나?» 싶어
   *   같은 말을 두 번 쓰게 된다.
   * ■ ⇒ 임시 말풍선을 먼저 넣고(`id` 는 **음수**), 서버가 받으면 realtime 이 진짜 줄을 준다.
   *   ⚠️음수 id 를 쓰는 이유: 서버 id 는 양수라 **절대 안 겹친다**. 겹치면 진짜 줄이 지워진다.
   * ■ ⚠️실패하면 임시 줄을 **걷어내고** 쓴 글을 돌려준다 — 안 간 말이 간 것처럼 남으면
   *   그게 더 나쁘다(«보냈는데 상대가 못 봤다» 가 된다).
   * ■ ⚠️진짜 줄이 도착하면 임시 줄은 **같은 본문·내 발신** 으로 맞춰 지운다
   *   (realtime 이 먼저 올 수도 있어 시각만으로는 못 가른다).
   */
  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    const tempId = -Date.now();
    setMsgs((prev) => [...prev, {
      id: tempId, role: 'user', body: text, senderId: myId,
      sentAt: new Date().toISOString(), imagePath: null, speakerId: null,
    }]);
    const ok = await sendUserMessage(sessionId, text, myId);
    setSending(false);
    if (!ok) {
      setMsgs((prev) => prev.filter((m) => m.id !== tempId));   // 안 간 말을 남기지 않는다
      setDraft(text);
      return;
    }
    void callTeacher(text);   // ★★`@이름` 이 있으면 그 선생님을 부른다 (Boss 2026-08-27)
  };

  /**
   * ★★`@이름` 으로 **AI 선생님을 이 방에 부른다** (Boss 2026-08-27
   *   *"실제 사람이랑 대화할때는 사진공유 ai 선생님 지목 @ 이걸로"*).
   *
   * ■ 어떻게 도나 — **새 경로를 만들지 않았다**
   *   이미 있는 `askLive`(talk Edge)를 **같은 `sessionId`** 로 부른다.
   *   Edge 가 답을 `talk_messages` 에 `role='assistant'` 로 넣고, 이 방의 realtime 이
   *   그걸 그대로 받아 온다 — 화면에서 따로 붙일 것이 없다.
   * ■ ⚠️★**운은 부른 사람이 낸다**
   *   Edge 는 `uid`(=호출자) 기준으로 무료 한도·차감을 판정한다. 방을 만든 사람이 아니라
   *   **@ 를 친 사람**이 내는 것이 맞다 — 안 그러면 남의 운으로 AI 를 부를 수 있다.
   * ■ ⚠️서버가 **참여자**를 허용해야 한다 — 종전엔 세션 owner 만 통과해서, 방을 만들지 않은
   *   쪽이 @ 를 부르면 403 이었다(2026-08-27 같이 고쳤다).
   * ★한 턴에 **한 명만** 부른다 — 둘을 부르면 두 번 과금되고 누구 얘기인지도 흐려진다.
   */
  const callTeacher = async (text: string) => {
    if (!teachers.length) return;
    // 이름이 긴 사람이 먼저 걸리게 — 「노쌤」과 「노쌤의 사주상담소」가 같이 있으면 긴 쪽이 정확하다
    const sorted = [...teachers].sort((a, b) => b.name.length - a.name.length);
    const hit = sorted.find((c) => text.includes(`@${c.name}`) || text.includes(`@${c.name.split(' ')[0]}`));
    if (!hit) return;
    setSending(true);
    try { await askLive(hit.id, text, sessionId, null, 'ko'); }
    catch (e) { console.warn('[room] 선생님 호출 실패', e); }
    setSending(false);
  };

  /**
   * ★사진 보내기 (Boss 2026-08-27 *"실제 사람이랑 대화할때는 사진공유"*).
   *
   * ⚠️**웹에서만** 고를 수 있다 — 모바일 사진 선택엔 `expo-image-picker` 가 필요한데 이 앱엔 아직 없고,
   *   넣으면 **네이티브 재빌드**가 걸린다(`MyProfileCard` 와 같은 사정·같은 판단).
   *   ★없는 기능을 있는 척하지 않는다: 모바일에서는 **버튼을 아예 안 그린다.**
   * ★올리는 동안 `sending` 을 잡아 둔다 — 두 번 눌러 두 장이 가는 것을 막는다.
   */
  const pickPhoto = async () => {
    if (sending) return;
    if (Platform.OS === 'web') {
      const el = document.createElement('input');
      el.type = 'file';
      el.accept = 'image/*';
      el.onchange = async () => {
        const f = el.files?.[0];
        if (!f) return;
        setSending(true);
        const path = await uploadRoomPhoto(sessionId, f);
        if (path) await sendUserMessage(sessionId, '', myId, path);
        setSending(false);
        if (!path) console.warn('[room] 사진을 올리지 못했습니다(2MB 이하만)');
      };
      el.click();
      return;
    }
    // ★★폰 — 이미 있는 `pickImageUri`/`bytesOfUri` 를 쓴다(프로필 사진이 쓰던 그 길).
    // ★실패하면 **사유를 말한다**(2026-09-03) — 취소만 조용하다
    let uri: string | null = null;
    try { uri = await pickImageUri(); }
    catch (e) {
      Alert.alert(t('room.photo', '사진'),
        e instanceof Error ? e.message : t('common.retryLater', '잠시 후 다시 시도해 주세요.'),
        [{ text: t('common.confirm', '확인') }], () => {});
      return;
    }
    if (!uri) return;                                   // 취소 = 조용히
    setSending(true);
    const img = await bytesOfUri(uri);
    // ⚠️`uploadRoomPhoto` 는 `size`·`type` 을 본다 — Blob 처럼 생긴 것을 만들어 넘긴다.
    const path = img ? await uploadRoomPhoto(sessionId, img as never) : null;
    if (path) await sendUserMessage(sessionId, '', myId, path);
    setSending(false);
    if (!path) console.warn('[room] 사진을 올리지 못했습니다(2MB 이하만)');
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.head, { paddingTop: insets.top + space(3) }]}>
        {onBack ? (
          <PressableScale hitSlop={8} onPress={onBack}><Icon name="menu" size={22} /></PressableScale>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {/* ★인원수 — 상담가 방과 **같은 규칙**(나 포함) */}
          {people.length > 2 ? <Text style={styles.num}>{people.length}</Text> : null}
        </View>
        {onInvite ? (
          <PressableScale hitSlop={8} onPress={onInvite}><Icon name="plus" size={22} /></PressableScale>
        ) : null}
        {onLeave ? (
          <PressableScale hitSlop={8} onPress={onLeave}><Icon name="trash" size={20} /></PressableScale>
        ) : null}
      </View>

      <TalkThread items={items} onLink={() => {}} keyboardH={kbH} busy={theirTyping} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.bar}>
          <TextInput
            ref={inputRef}
            style={[styles.input, {
              fontSize: fs(15),
              // ★빈 칸은 **잰 값을 아예 안 쓴다**(위 주석의 피드백 루프)
              height: (draft ? Math.min(Math.max(inputH || LINE, LINE), LINE * 5) : LINE) + PAD,
            }]}
            value={draft}
            onChangeText={(v) => { setDraft(v); notifyTyping(); }}
            placeholder={t('room.ph', '메시지를 입력하세요')}
            placeholderTextColor={colors.inkFaint}
            multiline
            // ★웹에서 «처음부터 두 줄» 을 막는다 — RN Web 은 이 값을 textarea rows 로 내려보낸다
            numberOfLines={1}
            onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height)}
            // 5줄을 넘으면 **안에서** 스크롤(밖으로 자라지 않는다)
            scrollEnabled={(inputH || 0) > LINE * 5}
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          {/* ★★사진 — **웹·폰 둘 다** (Boss 2026-09-02 *"사진도 보낼수 있게 하라니깐"*).
              ⚠️여태 웹 전용이었던 것은 «모듈이 없어서» 가 아니라 **낡은 주석 때문**이었다 —
                `expo-image-picker` 는 이미 설치·링크돼 있었다(Podfile.lock 에 4곳).
              ⚠️폰에서 모듈이 없는 옛 빌드면 `canPickImage` 가 false → 그때만 안 그린다. */}
          {(Platform.OS === 'web' || canPickImage) ? (
            <PressableScale style={styles.photoBtn} onPress={() => { void pickPhoto(); }} disabled={sending} hitSlop={8}>
              <Icon name="plus" size={20} />
            </PressableScale>
          ) : null}
          <PressableScale style={[styles.send, !draft.trim() && styles.sendOff]} onPress={send} disabled={!draft.trim()}>
            <Text style={styles.sendTx}>{t('common.send', '보내기')}</Text>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** 한 줄 높이(글자 15 + 줄간격). ★`PAD` 는 위아래 여백 — 둘을 나눠 둬야 «몇 줄» 계산이 정확하다 */
const LINE = 22;
const PAD = 18;

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    paddingHorizontal: space(4), paddingVertical: space(3),
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  title: { ...font.body, color: colors.ink, fontWeight: '800' },
  num: { ...font.caption, fontSize: 11.5, color: colors.inkFaint },
  bar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space(2),
    paddingHorizontal: space(4), paddingVertical: space(3),
    borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card,
  },
  input: {
    // ⚠️높이는 **위에서 계산해 넣는다**(minHeight/maxHeight 로는 «한 줄로 시작» 을 못 만든다).
    flex: 1,
    // ⚠️★글자가 **위에 붙어 있었다**(Boss 2026-08-31). 높이를 우리가 정해 주는데
    //   `TextInput` 은 기본이 위 정렬이라, 한 줄일 때 글자가 칸 위쪽에 뜬다.
    //   ⇒ iOS 는 `textAlignVertical` 을 안 보므로 **둘 다** 준다(안드로이드=속성 · iOS=아래 padding 균형).
    //   ★★2026-09-02 재발(Boss *"메세지를 입력하세요가 중간에 없어"*) — 스크린샷을 픽셀로 재니
    //     칸 120px 안에서 글자 위 여백 29 · 아래 59 = **30px(논리 10px) 위로** 치우쳐 있었다.
    //   ■ 원인은 **자기모순**이었다: 높이는 `LINE(22) + PAD(18) = 40` 으로 정해 놓고
    //     패딩은 `space(2) = 8` 을 줬다. 22 + 8 + 8 = 38 ≠ 40 이고, 게다가 실제 글자 줄상자는
    //     22 가 아니라 폰트가 정하는 값(≈18)이라 남는 공간이 **전부 아래로** 몰렸다.
    //     `textAlignVertical` 은 iOS 가 안 본다 — 그래서 안드로이드에서만 나아 보였다.
    //   ⇒ 줄상자를 **LINE 으로 못박고**(lineHeight) 패딩을 **PAD 의 절반씩** 준다.
    //     그러면 22 + 9 + 9 = 40 = 높이 → **폰트 지표와 무관하게 구조적으로 가운데**가 된다.
    //     ★높이·패딩·줄상자가 전부 같은 상수(LINE·PAD)에서 나와 다시는 서로 어긋날 수 없다.
    textAlignVertical: 'center',
    lineHeight: LINE,
    backgroundColor: colors.sunk, borderRadius: radius.md,
    paddingHorizontal: space(3.5), paddingTop: PAD / 2, paddingBottom: PAD / 2, color: colors.ink,
    // 웹 textarea 의 기본 리사이즈 손잡이를 없앤다(우리가 높이를 정하므로)
    ...(Platform.OS === 'web' ? ({ resize: 'none', outlineStyle: 'none' } as object) : null),
  },
  photoBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line,
  },
  send: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2.5) },
  sendOff: { opacity: 0.4 },
  sendTx: { ...font.caption, color: colors.onJu, fontWeight: '800' },
});
