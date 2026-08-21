// app/src/app/(app)/room.tsx — 오픈채팅방 대화
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-21: *"ai 선생들끼리 모아놓고 오픈채팅방 파서 같이 대화하거나
//                    실제 유저들 여러명 오픈채팅방 파서 대화하거나 AI도 낄수있고"*
//
// ■ 1:1 과 **같은 대화창**(`TalkThread`)을 쓴다
//   다른 건 '누가 말하나'뿐이라 화면을 새로 만들면 두 결로 갈린다([[duplicate-ui-single-source]]).
//   ⇒ `TalkItem.who` 만 채워 넣는다. 말풍선·타이핑·스크롤은 이미 있는 것을 그대로 쓴다.
//
// ■ ★AI 는 **한 명씩 차례로** 뜬다
//   서버는 2~3명분을 한 번에 돌려주지만, 화면에 동시에 꽂으면 사람이 대화로 안 읽는다.
//   `sayInOrder` 와 같은 방식으로 앞 말의 길이만큼 뒤를 밀어 준다.
//
// ■ ⚠️@ 로 부르면 반드시 답한다 — 그래서 **부르기 쉬워야** 한다
//   이름을 손으로 치게 두면 오타 한 글자에 호출이 죽는다. ⇒ 참여 AI 를 칩으로 띄우고 눌러서 넣는다.
// ═══════════════════════════════════════════════════════════════════════════
// keyboard-safe: 입력바가 있어 `KeyboardAvoidingView` 로 키보드를 피한다(아래 참조).
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { TalkThread, type TalkItem } from '../../components/talk/TalkThread';
import { loadRoom, sayInRoom, type Room } from '../../lib/talk/rooms';
import { consultantsSnapshot, listConsultants, type Consultant } from '../../lib/talk/consultants';
import { useAuth } from '../../lib/useAuth';
import { colors, space, radius, font } from '../../lib/theme';

/** 사진 없는 상담가의 색 — 친구목록과 **같은 다섯 가지**를 쓴다(앱 안에서 색이 갈리면 안 된다). */
const EL = ['木', '火', '土', '金', '水'] as const;

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<TalkItem[]>([]);
  const [people, setPeople] = useState<Consultant[]>(consultantsSnapshot());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<TextInput>(null);

  // ★언마운트 시 타이머를 반드시 끈다 — 화면이 사라진 뒤 setState 하면 경고가 뜨고 누수가 된다
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  /**
   * 상담가 한 명 → 말풍선 화자. 사진이 없으면 이름 첫 글자로 그린다.
   *
   * ⚠️★상담가에는 **오행이 없다**(`Consultant` 에 그런 칸이 없다 — 실측).
   *   친구목록도 그래서 슬롯으로 색을 돌린다. 여기서도 **id 로 고정 슬롯**을 뽑는다 —
   *   목록 순서로 뽑으면 방마다 같은 사람이 다른 색이 되어 못 알아본다.
   */
  const whoOf = useCallback((aiId: string) => {
    const c = people.find((p) => p.id === aiId);
    let h = 0; for (let i = 0; i < aiId.length; i++) h = (h * 31 + aiId.charCodeAt(i)) >>> 0;
    return { name: c?.name ?? aiId, avatar: c?.avatar ?? null, element: EL[h % EL.length] };
  }, [people]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [r] = await Promise.all([id ? loadRoom(String(id)) : Promise.resolve(null), listConsultants()]);
      if (!alive) return;
      setPeople(consultantsSnapshot());
      if (!r) { setLoading(false); return; }
      setRoom(r.room);
      // ★사람 메시지에도 화자를 붙인다(내 말만 빼고) — 여럿이라 누가 한 말인지 안 보이면 대화가 안 읽힌다
      const mine = session?.user?.id;
      setItems(r.messages.map((m): TalkItem => ({
        id: `m${m.id}`,
        role: m.userId && m.userId === mine ? 'user' : 'assistant',
        body: m.body,
        who: m.aiId ? whoOf(m.aiId)
           : (m.userId === mine ? undefined : { name: t('room.someone', '누군가') }),
      })));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, session?.user?.id, whoOf, t]);

  /**
   * AI 답들을 **차례로** 띄운다.
   * ★앞 말이 길수록 뒤를 더 민다 — 사람이 읽는 속도에 맞춘다(최대 1.6초).
   */
  const showReplies = useCallback((replies: { aiId: string; name: string; body: string }[]) => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (!replies.length) { setBusy(false); return; }
    let at = 420;
    replies.forEach((rep, i) => {
      if (i > 0) at += Math.min(1600, 420 + (replies[i - 1].body?.length ?? 0) * 11);
      timers.current.push(setTimeout(() => {
        setItems((prev) => [...prev, {
          id: `ai${Date.now()}_${i}`, role: 'assistant', body: rep.body,
          who: { ...whoOf(rep.aiId), name: rep.name },
        }]);
        if (i === replies.length - 1) setBusy(false);   // ★마지막 말풍선이 타이핑을 끈다
      }, at));
    });
  }, [whoOf]);

  const send = useCallback(async () => {
    const q = text.trim();
    if (!q || busy || !room) return;
    if (!session) { router.push('/login'); return; }
    setText('');
    setItems((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', body: q }]);
    setBusy(true); setNote(null);
    const r = await sayInRoom(room.id, q);
    if (!r.ok) { setBusy(false); setNote(t('room.failSend', '보내지 못했어요. 잠시 뒤 다시 시도해 주세요.')); return; }
    if (r.error) { setBusy(false); setNote(r.error === 'timeout' ? t('room.slow', '답이 늦어요. 잠시 뒤 새로고침해 주세요.') : r.error); return; }
    showReplies(r.replies);
  }, [text, busy, room, session, router, showReplies, t]);

  /** 칩을 누르면 `@이름 ` 을 입력창에 넣는다. ★이미 부른 사람은 또 넣지 않는다 */
  const mention = useCallback((name: string) => {
    setText((prev) => (prev.includes(`@${name}`) ? prev : `@${name} ${prev}`.trimStart()));
    inputRef.current?.focus();
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }
  if (!room) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.empty}>{t('room.gone', '없는 방이거나 들어갈 수 없는 방이에요.')}</Text>
        <PressableScale style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backTx}>{t('common.back', '← 뒤로')}</Text>
        </PressableScale>
      </View>
    );
  }

  const joined = room.aiIds; // 이 방에 있는 AI
  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <View style={[styles.head, { paddingTop: insets.top + space(2) }]}>
        <PressableScale style={styles.headBtn} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headBtnTx}>‹</Text>
        </PressableScale>
        <View style={styles.headMid}>
          <Text style={styles.title} numberOfLines={1}>{room.title}</Text>
          {/* ★몇 명이 있는지 = 이 방이 얼마나 시끄러운지. 원가와도 직결이라 보여 준다 */}
          <Text style={styles.sub} numberOfLines={1}>
            {t('room.aiCount', 'AI {{n}}명').replace('{{n}}', String(joined.length))}
            {room.topic ? ` · ${room.topic}` : ''}
          </Text>
        </View>
      </View>

      <TalkThread items={items} busy={busy} onLink={(r) => router.push(r as never)} />

      {note ? <Text style={styles.note}>{note}</Text> : null}

      {/* 부르기 칩 — @ 를 손으로 치지 않게 한다 */}
      {joined.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}
                    contentContainerStyle={styles.chipsBody}>
          {joined.map((aid) => {
            const w = whoOf(aid);
            return (
              <PressableScale key={aid} style={styles.chip} onPress={() => mention(w.name)}>
                <Text style={styles.chipTx}>@{w.name}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space(2)) }]}>
        <TextInput
          ref={inputRef} style={styles.input} value={text} onChangeText={setText}
          placeholder={t('room.ph', '메시지를 입력하세요')} placeholderTextColor={colors.inkFaint}
          multiline maxLength={300} onSubmitEditing={send} returnKeyType="send" blurOnSubmit={false}
        />
        <PressableScale style={[styles.send, (!text.trim() || busy) && styles.sendOff]}
                        onPress={send} disabled={!text.trim() || busy}>
          <Text style={styles.sendTx}>{t('common.send', '보내기')}</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: space(3) },
  empty: { ...font.body, color: colors.inkSoft },
  back: { paddingHorizontal: space(5), paddingVertical: space(2.5), borderRadius: radius.md, backgroundColor: colors.card },
  backTx: { ...font.body, color: colors.ju, fontWeight: '800' },

  head: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    paddingHorizontal: space(4), paddingBottom: space(2.5),
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  headBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headBtnTx: { fontSize: 28, lineHeight: 30, color: colors.ink, fontWeight: '400' },
  headMid: { flex: 1, minWidth: 0 },
  title: { ...font.heading, color: colors.ink },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: 1 },

  note: { ...font.caption, color: colors.inkSoft, textAlign: 'center', paddingBottom: space(1.5) },

  chips: { maxHeight: 44, flexGrow: 0 },
  chipsBody: { paddingHorizontal: space(4), paddingBottom: space(2), gap: space(2) },
  chip: {
    paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine,
  },
  chipTx: { ...font.caption, color: colors.ju, fontWeight: '800' },

  bar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space(2),
    paddingHorizontal: space(4), paddingTop: space(2),
    borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg,
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 110, ...font.body, color: colors.ink,
    backgroundColor: colors.card, borderRadius: radius.lg,
    paddingHorizontal: space(3.5), paddingVertical: space(2.5),
  },
  send: {
    paddingHorizontal: space(4), paddingVertical: space(2.5),
    borderRadius: radius.lg, backgroundColor: colors.ju,
  },
  sendOff: { opacity: 0.4 },
  sendTx: { ...font.body, color: colors.onJu, fontWeight: '800' },
});
