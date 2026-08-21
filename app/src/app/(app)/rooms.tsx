// app/src/app/(app)/rooms.tsx — 오픈채팅방 목록·만들기
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-21: 두 종류를 **다** 만든다.
//   ①`solo` 회의실 — 나 + AI 여럿. 한 주제를 여러 관점으로 듣는 자리
//   ②`open` 오픈채팅 — 여러 사람 + AI. 공개 목록에 뜬다
//
// ■ ★두 종류를 **한 화면**에 둔다
//   만드는 흐름이 같고(이름·주제·AI 고르기), 다른 건 '누가 들어오나'뿐이다.
//   화면을 둘로 쪼개면 같은 폼을 두 번 만들게 된다.
//
// ■ ⚠️AI 를 많이 고를수록 **원가가 배로** 뛴다
//   턴당 1명 ₩4 · 3명 ₩13 · 7명 ₩31. 그래서 고를 때 **몇 명이 답하는지 숫자로 보여 준다** —
//   화면이 조용하면 사용자는 열두 명을 고르고 그게 얼마인지 모른다.
//   ★실제 상한은 서버(`ai_per_turn`)가 건다. 여기 숫자는 안내지 방어가 아니다.
//   ⚠️⚠️**방은 유저가 운을 쓰지 않는다**(무료). ⇒ 원가는 전부 우리가 진다 —
//     한 방 하루 상한 60턴 × 3명 = **₩780/방/일**. 방이 늘면 그만큼 곱해진다.
//     지금 브레이크는 ①방별 `daily_turn_cap` ②전체 킬스위치 `app_flags.llm_paused` 둘뿐이고,
//     **전역 일일 상한은 없다**. 사용자가 붙기 시작하면 그때 잠가야 한다.
// ═══════════════════════════════════════════════════════════════════════════
// safe-area-safe: 상단 인셋을 직접 준다(탭 밖 화면이라 헤더가 없다).
// ⚠️★키보드: 만들기 폼의 입력창이 **화면 가운데**에 있어, 키보드가 올라오면
//   아래 입력창과 「방 만들기」 버튼이 덮인다(`check:keyboard` 가 잡아 줬다 — 면제하지 않고 고쳤다).
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { myRooms, publicRooms, createRoom, joinRoom, type Room } from '../../lib/talk/rooms';
import { listConsultants, consultantsSnapshot, type Consultant } from '../../lib/talk/consultants';
import { useAuth } from '../../lib/useAuth';
import { colors, space, radius, font, shadow } from '../../lib/theme';

/** 한 턴에 답하는 AI 수에 따른 대략 원가(₩) — 실측 기반(`check:roomcost` 주석과 같은 표). */
/** i18n `t` 를 좁혀 쓴다 — 화면 밖(하네스·테스트)에서도 간단한 함수 하나면 넣을 수 있게. */
type TFn = (k: string, d?: string) => string;

export default function RoomsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [mine, setMine] = useState<Room[]>([]);
  const [open, setOpen] = useState<Room[]>([]);
  const [people, setPeople] = useState<Consultant[]>(consultantsSnapshot());
  const [loading, setLoading] = useState(true);

  // 만들기 폼
  const [making, setMaking] = useState(false);
  const [kind, setKind] = useState<'solo' | 'open'>('solo');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const [m, o] = await Promise.all([session ? myRooms() : Promise.resolve([]), publicRooms()]);
    setMine(m); setOpen(o); setLoading(false);
  }, [session]);

  useEffect(() => { listConsultants().then(() => setPeople(consultantsSnapshot())); reload(); }, [reload]);

  /** AI 를 고르거나 뺀다. ★상한은 서버가 걸지만, 여기서도 다섯을 넘기지 않게 막는다(고르다 지친다) */
  const toggle = useCallback((id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : (p.length >= 5 ? p : [...p, id])));
  }, []);

  const make = useCallback(async () => {
    if (!session) { router.push('/login'); return; }
    if (!picked.length || saving) return;
    setSaving(true);
    const r = await createRoom(kind, title, topic, picked, isPublic);
    setSaving(false);
    if (!r) return;
    setMaking(false); setTitle(''); setTopic(''); setPicked([]);
    router.push(`/room?id=${r.id}` as never);
  }, [session, picked, saving, kind, title, topic, isPublic, router]);

  /** 공개 방에 들어간다 — ★들어가야 말할 수 있다(쓰기 정책이 참여를 요구한다) */
  const enter = useCallback(async (r: Room) => {
    if (!session) { router.push('/login'); return; }
    await joinRoom(r.id);
    router.push(`/room?id=${r.id}` as never);
  }, [session, router]);

  // ⚠️★거르는 척하는 조건을 두지 않는다
  //   처음엔 `kind === 'live' || group === 'teacher'` 로 썼는데, 실측해 보니 **열둘이 전부 `live`** 라
  //   뒤 조건이 죽어 있었다 — 화면은 '선생님만 부른다'처럼 읽히는데 실제로는 전원이 나왔다.
  //   ⇒ 조건은 **답할 수 있는가(`live`)** 하나로 두고, 선생/친구 구분은 **묶어서 보여** 준다
  //     (Boss 2026-08-21 *"생활 전반 AI 친구로 넓히는거야"* — 열둘 다 부를 수 있는 게 맞다).
  const callable = people.filter((p) => p.kind === 'live');
  const GROUPS = [
    { key: 'teacher' as const, label: t('talk.groupTeacher', '✦ 선생님 AI') },
    { key: 'friend' as const, label: t('talk.groupFriend', '✦ 함께하면 좋은 친구들') },
  ];

  return (
    // ★`KeyboardAvoidingView` 로 감싼다 — 입력창이 절대배치가 아니라 흐름 안에 있어 KAV 로 충분하다
    //   (절대배치 하단바였다면 리스너로 직접 올려야 한다 — `check:keyboard` R2).
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(3) }]}
                keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <PressableScale style={styles.headBtn} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headBtnTx}>‹</Text>
        </PressableScale>
        <Text style={styles.h1}>{t('rooms.title', '오픈채팅')}</Text>
        <PressableScale style={styles.plus} onPress={() => setMaking((v) => !v)}>
          <Text style={styles.plusTx}>{making ? '×' : '＋'}</Text>
        </PressableScale>
      </View>

      {/* ── 만들기 폼 ─────────────────────────────────────────────────────── */}
      {making ? (
        <View style={styles.form}>
          <View style={styles.kinds}>
            {(['solo', 'open'] as const).map((k) => (
              <PressableScale key={k} style={[styles.kind, kind === k && styles.kindOn]} onPress={() => setKind(k)}>
                <Text style={[styles.kindTx, kind === k && styles.kindTxOn]}>
                  {k === 'solo' ? t('rooms.solo', '내 회의실') : t('rooms.open', '오픈채팅')}
                </Text>
                <Text style={[styles.kindSub, kind === k && styles.kindSubOn]}>
                  {k === 'solo' ? t('rooms.soloSub', '나 + AI 여럿') : t('rooms.openSub', '여러 사람 + AI')}
                </Text>
              </PressableScale>
            ))}
          </View>

          <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={40}
                     placeholder={t('rooms.phTitle', '방 이름 (예: 이직 고민방)')} placeholderTextColor={colors.inkFaint} />
          <TextInput style={styles.input} value={topic} onChangeText={setTopic} maxLength={120}
                     placeholder={t('rooms.phTopic', '무슨 이야기를 하나요? (선택)')} placeholderTextColor={colors.inkFaint} />

          <Text style={styles.label}>
            {t('rooms.pick', '누구를 부를까요')} · {picked.length}/5
          </Text>
          {GROUPS.map((g) => {
            const mem = callable.filter((p) => p.group === g.key);
            if (!mem.length) return null;                 // 빈 묶음 제목은 그리지 않는다
            return (
              <View key={g.key} style={styles.grp}>
                <Text style={styles.grpTx}>{g.label}</Text>
                <View style={styles.chips}>
                  {mem.map((p) => (
                    <PressableScale key={p.id} style={[styles.chip, picked.includes(p.id) && styles.chipOn]}
                                    onPress={() => toggle(p.id)}>
                      <Text style={[styles.chipTx, picked.includes(p.id) && styles.chipTxOn]}>{p.name}</Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            );
          })}
          {/* ★고른 수 = 원가. 조용히 두면 열둘을 고르고 그게 얼마인지 모른다 */}
          {picked.length ? (
            <Text style={styles.cost}>
              {/* ⚠️★원가(₩)를 여기 쓰지 않는다 — 방은 유저가 **운을 쓰지 않는** 자리라
                     그 숫자는 우리 마진이지 사용자가 낼 값이 아니다. 원가는 파일 머리 주석에만 둔다. */}
              {t('rooms.cost', '한 번 말할 때마다 최대 {{n}}명이 답해요.')
                 .replace('{{n}}', String(Math.min(picked.length, 3)))}
            </Text>
          ) : null}

          {kind === 'open' ? (
            <View style={styles.row}>
              <Text style={styles.rowTx}>{t('rooms.public', '공개 목록에 띄우기')}</Text>
              <Switch value={isPublic} onValueChange={setIsPublic}
                      trackColor={{ true: colors.ju, false: colors.line }} />
            </View>
          ) : null}

          <PressableScale style={[styles.cta, (!picked.length || saving) && styles.ctaOff]}
                          onPress={make} disabled={!picked.length || saving}>
            <Text style={styles.ctaTx}>{saving ? t('rooms.making', '만드는 중…') : t('rooms.make', '방 만들기')}</Text>
          </PressableScale>
        </View>
      ) : null}

      {loading ? <ActivityIndicator color={colors.ju} style={{ marginTop: space(8) }} /> : (
        <>
          {mine.length ? (
            <>
              <Text style={styles.group}>{t('rooms.mine', '내 방')}</Text>
              {mine.map((r) => <RoomRow key={r.id} room={r} t={t as TFn}
                                        onPress={() => router.push(`/room?id=${r.id}` as never)} />)}
            </>
          ) : null}

          <Text style={styles.group}>{t('rooms.publicList', '들어갈 수 있는 방')}</Text>
          {open.length
            ? open.map((r) => <RoomRow key={r.id} room={r} t={t as TFn} onPress={() => enter(r)} />)
            : <Text style={styles.empty}>{t('rooms.noPublic', '아직 열린 방이 없어요. 첫 방을 만들어 보세요.')}</Text>}
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 목록 한 줄 — 이름 · 주제 · AI 수. ★AI 수를 보여 주는 건 '얼마나 시끄러운 방인가'가 곧 성격이라서다. */
function RoomRow({ room, onPress, t }: { room: Room; onPress: () => void; t: TFn }) {
  return (
    <PressableScale style={styles.item} onPress={onPress}>
      <View style={styles.itemMid}>
        <Text style={styles.itemName} numberOfLines={1}>{room.title}</Text>
        <Text style={styles.itemSub} numberOfLines={1}>
          {room.kind === 'solo' ? t('rooms.solo', '내 회의실') : t('rooms.open', '오픈채팅')}
          {' · '}{t('rooms.aiN', 'AI {{n}}명').replace('{{n}}', String(room.aiIds.length))}
          {room.topic ? ` · ${room.topic}` : ''}
        </Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingBottom: space(10) },

  head: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(3) },
  headBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  headBtnTx: { fontSize: 28, lineHeight: 30, color: colors.ink },
  h1: { ...font.title, flex: 1 },
  plus: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  plusTx: { fontSize: 20, color: colors.ju, fontWeight: '800' },

  form: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4),
    gap: space(3), marginBottom: space(4), ...shadow.soft,
  },
  kinds: { flexDirection: 'row', gap: space(2) },
  kind: {
    flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingVertical: space(2.5), paddingHorizontal: space(3), gap: 2,
  },
  kindOn: { borderColor: colors.ju, backgroundColor: colors.juSoft },
  kindTx: { ...font.body, color: colors.ink, fontWeight: '800' },
  kindTxOn: { color: colors.ju },
  kindSub: { ...font.caption, color: colors.inkFaint },
  kindSubOn: { color: colors.ju },

  input: {
    ...font.body, color: colors.ink, backgroundColor: colors.bg,
    borderRadius: radius.md, paddingHorizontal: space(3.5), paddingVertical: space(2.5),
  },
  label: { ...font.label, marginTop: space(1) },
  grp: { gap: space(1.5) },
  grpTx: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: {
    paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg,
  },
  chipOn: { borderColor: colors.ju, backgroundColor: colors.ju },
  chipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  // ★고른 칩 글자는 `onJu` — 강조색 위 대비(`check:onaccent`)
  chipTxOn: { color: colors.onJu },
  cost: { ...font.caption, color: colors.inkSoft },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTx: { ...font.body, color: colors.ink },

  cta: { borderRadius: radius.md, backgroundColor: colors.ju, paddingVertical: space(3), alignItems: 'center' },
  ctaOff: { opacity: 0.4 },
  ctaTx: { ...font.body, color: colors.onJu, fontWeight: '800' },

  group: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: space(4), marginBottom: space(1.5) },
  empty: { ...font.body, color: colors.inkFaint, paddingVertical: space(4) },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.md,
    paddingHorizontal: space(3.5), paddingVertical: space(3), marginBottom: space(2),
  },
  itemMid: { flex: 1, minWidth: 0, gap: 2 },
  itemName: { ...font.body, color: colors.ink, fontWeight: '800' },
  itemSub: { ...font.caption, color: colors.inkFaint },
  arrow: { ...font.body, color: colors.inkFaint, fontWeight: '900' },
});
