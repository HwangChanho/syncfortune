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
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   // ★헤더가 상태바에 먹히던 것(Boss 2026-08-31)
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { Icon } from '../kit/Icon';
import { TalkThread, type TalkItem } from './TalkThread';
import {
  loadUserMessages, sendUserMessage, subscribeUserRoom, roomPeople,
  markRoomRead, subscribeRoomRead, unreadBy, uploadRoomPhoto,
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
    // ★AI 가 말한 줄 — 사람과 **다른 갈래**로 그린다(이름을 상담가 목록에서 찾는다)
    if (m.role === 'assistant') {
      const tc = teachers.find((x) => x.id === m.speakerId);
      return {
        id: `a${m.id}`, role: 'assistant' as const, body: m.body,
        who: { name: tc?.name ?? 'AI', avatar: tc?.avatar ?? null, id: m.speakerId ?? undefined },
      };
    }
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
      // ★사진 (Boss 2026-08-27) — `TalkThread` 가 이미 그릴 줄 안다(새 그리기 규칙을 안 만든다)
      ...(m.imagePath ? { image: { uri: avatarUrl(m.imagePath) ?? '' } } : {}),
    };
  }), [msgs, myId, nameOf, people, teachers]);

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
    if (!ok) { setDraft(text); return; }
    // ★★`@이름` 이 있으면 그 선생님을 부른다 (Boss 2026-08-27)
    if (ok) void callTeacher(text);
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
  const pickPhoto = () => {
    if (Platform.OS !== 'web' || sending) return;
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

      <TalkThread items={items} onLink={() => {}} />

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
          {/* ★사진 — 웹에서만(위 `pickPhoto` 주석). 모바일에는 **아예 안 그린다** */}
          {Platform.OS === 'web' ? (
            <PressableScale style={styles.photoBtn} onPress={pickPhoto} disabled={sending} hitSlop={8}>
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
    textAlignVertical: 'center',
    backgroundColor: colors.sunk, borderRadius: radius.md,
    paddingHorizontal: space(3.5), paddingVertical: space(2), color: colors.ink,
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
