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
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { Icon } from '../kit/Icon';
import { TalkThread, type TalkItem } from './TalkThread';
import {
  loadUserMessages, sendUserMessage, subscribeUserRoom, roomPeople,
  markRoomRead, subscribeRoomRead, unreadBy,
  type UserMsg, type RoomPerson,
} from '../../lib/talk/userRoom';
import { supabase } from '../../lib/supabase';
import { colors, space, radius, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';

/** 프로필 사진 경로 → 공개 URL. ⚠️버킷 이름은 상담가 아바타와 같은 곳을 쓴다. */
function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  try { return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl; } catch { return null; }
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
export function UserRoomView({ sessionId, myId, onBack, onInvite, onLeave }: {
  sessionId: string;
  myId: string;
  onBack?: () => void;
  onInvite?: () => void;
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
   * 입력칸 높이 — Boss 2026-08-27
   *   *"텍스트필드가 두줄로 잡히는데 한줄로 · 길어지면 올라오게 · 5줄 이상부턴 스크롤"*
   *
   * ⚠️`multiline` 만 주면 웹에서 `<textarea rows=2>` 가 되어 **처음부터 두 줄**이다.
   *   ⇒ 높이를 **내용에 맞춰 우리가 정한다**(`onContentSizeChange`).
   * ★상한(5줄)에 닿으면 더 안 커지고 안에서 스크롤된다 — 입력칸이 화면을 먹지 않게.
   */
  const [inputH, setInputH] = useState(0);
  const inputRef = useRef<TextInput>(null);

  // 방이 바뀌면 **처음부터** 다시 읽는다(앞 방의 말이 남으면 안 된다)
  useEffect(() => {
    let alive = true;
    setMsgs([]); setPeople([]);
    void loadUserMessages(sessionId).then((m) => { if (alive) setMsgs(m); });
    void roomPeople(sessionId).then((p) => { if (alive) setPeople(p); });
    // ★실시간 — 상대가 말하면 바로 뜬다. 없으면 «다시 열어야 보이는» 게시판이 된다.
    const off = subscribeUserRoom(sessionId, (m) => {
      if (!alive) return;
      // ⚠️내가 보낸 것은 이미 화면에 있다 — id 로 중복을 막는다(낙관적 추가 + 실시간 = 두 번)
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
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
    const mine = m.senderId === myId;
    const p = nameOf(m.senderId);
    return {
      id: `m${m.id}`,
      role: mine ? ('user' as const) : ('assistant' as const),
      body: m.body,
      // ★내 말에만 「1」 — 아직 안 읽은 사람 수(나 제외). 0 이면 컴포넌트가 안 그린다
      ...(mine ? { unread: unreadBy(people, myId, m.sentAt) } : {}),
      // 남의 말에만 얼굴을 붙인다(내 말 옆에 내 얼굴은 카톡도 안 그린다)
      ...(mine ? {} : { who: { name: p?.name ?? '', avatar: avatarUrl(p?.avatarPath ?? null), id: m.senderId } }),
    };
  }), [msgs, myId, nameOf, people]);

  const others = people.filter((p) => p.id !== myId);
  const title = others.length
    ? others.map((p) => p.name).join(', ')
    : t('room.alone', '나 혼자 있는 방');

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    const ok = await sendUserMessage(sessionId, text, myId);
    setSending(false);
    // ★실패하면 **쓴 글을 돌려준다** — 사라지면 다시 써야 한다(가장 나쁜 실패다)
    if (!ok) setDraft(text);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
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

      <TalkThread items={items} onLink={() => {}} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.bar}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { fontSize: fs(15), height: Math.min(Math.max(inputH || LINE, LINE), LINE * 5) + PAD }]}
            value={draft}
            onChangeText={setDraft}
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
    backgroundColor: colors.sunk, borderRadius: radius.md,
    paddingHorizontal: space(3.5), paddingVertical: space(2), color: colors.ink,
    // 웹 textarea 의 기본 리사이즈 손잡이를 없앤다(우리가 높이를 정하므로)
    ...(Platform.OS === 'web' ? ({ resize: 'none', outlineStyle: 'none' } as object) : null),
  },
  send: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2.5) },
  sendOff: { opacity: 0.4 },
  sendTx: { ...font.caption, color: colors.onJu, fontWeight: '800' },
});
