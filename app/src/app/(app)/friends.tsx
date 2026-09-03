// app/src/app/(app)/friends.tsx — 친구 추가·관리
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"친구추가도 카톡처럼"* · 추가 방식 = **친구 코드 6자리**.
//
// ■ ★공개 동의를 **이 화면 맨 위**에 둔다
//   코드를 주고받기 전에 "무엇이 열리는가"를 먼저 알아야 한다. 설정 깊숙이 숨기면
//   사용자는 친구를 다 맺은 뒤에야 알게 되는데, 그때는 이미 명식이 열린 뒤다.
//   ⚠️원국 여덟 글자로 **생년월일이 역산된다** — 그 사실을 그대로 적는다(에둘러 쓰지 않는다).
//
// ■ 신청 결과를 **사유별로 다른 말**로
//   '보냈어요' / '바로 친구가 됐어요'(서로 신청) / '이미 친구' / '내 코드예요' / '없는 코드'.
//   하나로 뭉뚱그리면 사용자는 자기가 뭘 잘못했는지 모른다.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../../components/PressableScale';
import {
  myFriendCode, requestFriend, listFriends, acceptFriend, removeFriend,
  getShareConsent, setShareConsent, type Friend, type RequestResult,
} from '../../lib/talk/friends';
import { useAuth } from '../../lib/useAuth';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';

const EL = ['木', '火', '土', '金', '水'] as const;

export default function FriendsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<Friend[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => { setRows(await listFriends()); }, []);

  useEffect(() => {
    if (!session) { setRows([]); return; }
    void myFriendCode().then(setCode);
    void getShareConsent().then(setConsent);
    void reload();
  }, [session, reload]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2800); };

  /**
   * ★낙관적 반영 — **화면을 먼저 바꾸고** 서버에 보낸다(Boss 2026-09-03:
   *   *"UI는 유저가 봤을때 바로 적용되고 그게 서버에 반영이 안돼서 리턴이 실패로 오면 롤백하는 구조"*).
   *   서버 왕복(최대 8초)을 기다리면 «눌렀는데 아무 일도 안 나는» 구간이 생겨 두 번 누르게 된다.
   *
   * @param apply 지금 목록을 어떻게 바꿔 보일지(null 이면 그대로)
   * @param send  서버에 보내는 일. `false` 를 주면 **되돌린다**
   * @param failMsg 되돌릴 때 사용자에게 할 말
   */
  const optimistic = useCallback(async (
    apply: (prev: Friend[]) => Friend[],
    send: () => Promise<boolean>,
    failMsg: string,
  ) => {
    const before = rows;                          // ★되돌릴 자리를 **보내기 전에** 잡는다
    setRows((prev) => (prev ? apply(prev) : prev));
    const ok = await send();
    if (!ok) {
      setRows(before);                            // ★거짓말을 남기지 않는다
      flash(failMsg);
      void reload();                              // 서버의 진짜 상태로 한 번 더 맞춘다
    }
  }, [rows, reload]);

  /** 신청 — ★결과를 사유별로 다르게 말한다. */
  const onAdd = async () => {
    setBusy(true);
    const r: RequestResult = await requestFriend(input);
    setBusy(false);
    const say: Record<RequestResult, string> = {
      sent: t('friends.sent', '신청을 보냈어요. 상대가 수락하면 친구가 돼요.'),
      accepted: t('friends.bothSent', '서로 신청했네요. 바로 친구가 됐어요!'),
      already: t('friends.already', '이미 신청했거나 친구예요.'),
      self: t('friends.self', '내 코드예요.'),
      notfound: t('friends.notfound', '그런 코드를 찾지 못했어요.'),
      unauthorized: t('friends.needLogin', '로그인이 필요해요.'),
      failed: t('friends.failed', '지금은 처리하지 못했어요.'),
    };
    flash(say[r]);
    if (r === 'sent' || r === 'accepted') { setInput(''); void reload(); }
  };

  /**
   * 공개 동의 토글.
   * ★끄는 것은 바로 되고, **켜는 것만** 무엇이 열리는지 확인시킨다 — 위험한 방향에만 문턱을 둔다.
   */
  const onConsent = async (on: boolean) => {
    setConsent(on);                               // ★스위치는 **손가락을 떼는 순간** 움직인다
    const ok = await setShareConsent(on);
    if (!ok) {
      setConsent(!on);                            // ★실패하면 되돌린다 — 안 켜졌는데 켜져 보이면 위험하다
      flash(t('friends.consentFail', '저장하지 못했어요. 다시 시도해 주세요.'));
      return;
    }
    flash(on ? t('friends.consentOn', '친구에게 명식이 보여요.') : t('friends.consentOff', '이제 아무에게도 안 보여요.'));
  };

  if (!session) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTx}>{t('friends.needLoginBody', '로그인하면 친구를 추가할 수 있어요.')}</Text>
        <PressableScale style={styles.cta} onPress={() => router.push('/login')}>
          <Text style={styles.ctaTx}>{t('common.login', '로그인')}</Text>
        </PressableScale>
      </View>
    );
  }

  const pending = (rows ?? []).filter((f) => f.status === 'pending');
  const mates = (rows ?? []).filter((f) => f.status === 'accepted');

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(4) }]}>
      <Text style={styles.head}>{t('friends.title', '친구')}</Text>

      {/* ── 공개 동의 ── ★코드를 주고받기 **전에** 무엇이 열리는지 알린다 */}
      <View style={styles.consentBox}>
        <View style={styles.consentRow}>
          <Text style={styles.consentTitle}>{t('friends.consentTitle', '친구에게 내 명식 보여주기')}</Text>
          <Switch value={consent} onValueChange={onConsent}
                  trackColor={{ true: colors.ju, false: colors.line }} />
        </View>
        {/* ⚠️에둘러 쓰지 않는다 — 실제로 무엇이 유추되는지 그대로 적는다 */}
        <Text style={styles.consentBody}>
          {t('friends.consentBody',
             '켜면 친구가 내 사주 원국(여덟 글자)과 궁합을 볼 수 있어요.\n여덟 글자로 생년월일을 되짚을 수 있으니, 믿는 사람에게만 열어 주세요.\n언제든 끌 수 있고, 끄면 바로 안 보여요.')}
        </Text>
      </View>

      {/* ── 내 코드 ── */}
      <Text style={styles.section}>{t('friends.myCode', '내 친구 코드')}</Text>
      <View style={styles.codeBox}>
        <Text style={styles.codeTx}>{code ?? '······'}</Text>
      </View>
      <Text style={styles.hint}>{t('friends.codeHint', '이 코드를 알려주면 상대가 나를 추가할 수 있어요.')}</Text>

      {/* ── 코드로 추가 ── */}
      <Text style={styles.section}>{t('friends.addByCode', '코드로 추가')}</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(v) => setInput(v.toUpperCase())}
          placeholder={t('friends.codePh', '친구 코드 6자리')}
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="characters"
          maxLength={8}
          returnKeyType="done"
          onSubmitEditing={onAdd}
          // keyboard-safe: 화면 상단 입력이라 키보드가 올라와도 가려지지 않는다
        />
        <PressableScale style={styles.addBtn} onPress={onAdd} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color={colors.onJu} />
                : <Text style={styles.addTx}>{t('friends.add', '신청')}</Text>}
        </PressableScale>
      </View>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      {/* ── 받은/보낸 신청 ── */}
      {pending.length > 0 ? (
        <>
          <Text style={styles.section}>{t('friends.pending', '대기 중')} {pending.length}</Text>
          {pending.map((f, i) => (
            <Row key={f.otherId} f={f} slot={i} t={t as never}
                 onAccept={() => void optimistic(
                   (prev) => prev.map((x) => (x.otherId === f.otherId ? { ...x, status: 'accepted' } : x)),
                   () => acceptFriend(f.otherId),
                   t('friends.acceptFail', '수락하지 못했어요. 다시 눌러 주세요.'))}
                 onRemove={() => void optimistic(
                   (prev) => prev.filter((x) => x.otherId !== f.otherId),
                   () => removeFriend(f.otherId),
                   t('friends.removeFail', '지우지 못했어요. 다시 눌러 주세요.'))} />
          ))}
        </>
      ) : null}

      {/* ── 친구 ── */}
      <Text style={styles.section}>{t('friends.mates', '내 친구')} {mates.length}</Text>
      {mates.length === 0 ? (
        <Text style={styles.emptyTx}>{t('friends.empty', '아직 친구가 없어요.\n위에서 코드로 추가해 보세요.')}</Text>
      ) : mates.map((f, i) => (
        <Row key={f.otherId} f={f} slot={i} t={t as never}
             onOpen={() => router.push(`/friendcompat?friend=${f.otherId}`)}
             onRemove={() => void optimistic(
               (prev) => prev.filter((x) => x.otherId !== f.otherId),
               () => removeFriend(f.otherId),
               t('friends.removeFail', '지우지 못했어요. 다시 눌러 주세요.'))} />
      ))}
    </ScrollView>
  );
}

/**
 * 친구 한 줄.
 * ★`chartId` 가 null 이면 **"아직 명식을 안 열었어요"** 라고 적는다 —
 *   빈 화면으로 두면 우리 잘못인지 상대 설정인지 알 수 없다.
 */
function Row({ f, slot, t, onOpen, onAccept, onRemove }: {
  f: Friend; slot: number; t: (k: string, d?: string) => string;
  onOpen?: () => void; onAccept?: () => void; onRemove?: () => void;
}) {
  const el = EL[(slot + 1) % EL.length];
  const name = f.name ?? t('friends.noName', '이름 없음');
  return (
    <PressableScale style={styles.row} onPress={onOpen} disabled={!onOpen}>
      {f.avatarUrl
        ? <ExpoImage source={{ uri: f.avatarUrl }} style={styles.av} contentFit="cover" transition={140} />
        : <View style={[styles.av, { backgroundColor: elementColor[el], alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: elementText[el], fontWeight: '900', fontSize: 18 }}>{name.slice(0, 1)}</Text>
          </View>}
      <View style={styles.col}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {f.status === 'pending'
            ? (f.requestedByMe ? t('friends.waiting', '수락을 기다리는 중') : t('friends.gotRequest', '친구 신청이 왔어요'))
            : f.chartId ? t('friends.canSee', '명식·궁합 보기 ›') : t('friends.notShared', '아직 명식을 열지 않았어요')}
        </Text>
      </View>
      {/* 수락 버튼은 **받은 쪽에만** */}
      {f.status === 'pending' && !f.requestedByMe && onAccept ? (
        <PressableScale style={styles.okBtn} onPress={onAccept}>
          <Text style={styles.okTx}>{t('friends.accept', '수락')}</Text>
        </PressableScale>
      ) : null}
      {onRemove ? (
        <PressableScale hitSlop={8} onPress={onRemove}>
          <Text style={styles.xTx}>✕</Text>
        </PressableScale>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingBottom: space(20) },
  head: { fontSize: 22, lineHeight: 30, fontWeight: '900', color: colors.ink, letterSpacing: -0.4, marginBottom: space(4) },
  section: { ...font.caption, color: colors.inkFaint, fontWeight: '700', marginTop: space(5), marginBottom: space(2) },

  consentBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), gap: space(2) },
  consentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consentTitle: { ...font.body, color: colors.ink, fontWeight: '800' },
  consentBody: { ...font.caption, color: colors.inkSoft, lineHeight: 19 },

  codeBox: { backgroundColor: colors.sunk, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  codeTx: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: colors.ju, letterSpacing: 6 },
  hint: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },

  addRow: { flexDirection: 'row', gap: space(2) },
  input: { flex: 1, backgroundColor: colors.sunk, borderRadius: radius.md, paddingHorizontal: space(3.5), paddingVertical: space(3), ...font.body, color: colors.ink, letterSpacing: 3 },
  addBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(5), justifyContent: 'center', minWidth: 76, alignItems: 'center' },
  // ★강조색 위 글자는 `onJu`(`check:onaccent`)
  addTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
  msg: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },

  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), borderRadius: radius.md },
  av: { width: 46, height: 46, borderRadius: radius.md },
  col: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...font.body, color: colors.ink, fontWeight: '700' },
  sub: { ...font.caption, color: colors.inkFaint },
  okBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.5) },
  okTx: { ...font.caption, color: colors.onJu, fontWeight: '900' },
  xTx: { fontSize: 16, color: colors.inkFaint, paddingHorizontal: space(1) },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(4), backgroundColor: colors.bg },
  emptyTx: { ...font.body, color: colors.inkFaint, textAlign: 'center', lineHeight: 22, paddingVertical: space(6) },
  cta: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3) },
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
});
