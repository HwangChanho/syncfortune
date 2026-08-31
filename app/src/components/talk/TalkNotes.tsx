// app/src/components/talk/TalkNotes.tsx — 대화방 맨 위 **정리 줄**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-23 *"대화가 쌓이면 사람들이 보기 불편하니깐 중요내용은 따로 정리해주는 기능"*.
//
// ■ 화면 규칙 (기획서 그대로)
//   · 정리가 **하나라도 있을 때만** 줄이 뜬다. 없으면 아무것도 그리지 않는다(군더더기 금지).
//   · 기본은 **접힘**. 펴 본 사람에게는 다음부터 펴진 채로 뜬다.
//   · 항목을 누르면 **그 말이 나온 말풍선으로 데려간다.** 정리가 원문과 끊기면 믿을 수 없다.
//   · 항목마다 **고정 / 지우기.** 틀린 정리를 못 지우면 그 화면을 안 보게 된다.
//   · ★정리 카드에는 **콘텐츠 링크를 넣지 않는다** — 카드마다 '자세히 보기'가 붙으면
//     정리가 아니라 판매대가 된다. 콘텐츠 안내는 대화 흐름에서만 한다.
//
// ■ ⚠️중첩 <Text> 금지
//   웹에서 <Text> 안에 <Text> 를 넣으면 백지가 된다([[web-nested-text-crash]]).
//   라벨·본문은 형제로 둔다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '../PressableScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { NOTE_LABEL, hideNote, pinNote, type TalkNote } from '../../lib/talk/talkNotes';
import { useTranslation } from 'react-i18next';
import ViewShot, { captureRef } from 'react-native-view-shot';   // 캡쳐 — `ShareReadingButton` 과 같은 방식
import { saveImageToDevice } from '../../lib/media/saveImage';   // 웹=파일 · 앱=사진첩
import { Alert } from '../../lib/ui/alert';

/**
 * @param notes      이 대화의 정리(비면 아무것도 그리지 않는다)
 * @param open       펼침 상태
 * @param onToggle   접기/펴기
 * @param onJump     출처 말풍선으로 데려가기(없는 항목은 누를 수 없다)
 * @param onChanged  지우기·고정 뒤 목록을 다시 읽으라는 신호
 */
export function TalkNotes({
  notes, open, onToggle, onJump, onChanged, title,
}: {
  notes: TalkNote[];
  open: boolean;
  onToggle: () => void;
  onJump: (messageId: number) => void;
  onChanged: () => void;
  /** 캡쳐 카드 머리말에 쓸 이름(상담가·방 이름). 없으면 머리말 없이 그린다 */
  title?: string;
}) {
  const { fs } = useFontScale();
  const [busy, setBusy] = useState<number | null>(null);
  // 펼침 화살표만 돌린다 — 높이 애니는 목록 길이가 매번 달라 깜빡임이 생긴다.
  const rot = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rot, {
      toValue: open ? 1 : 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [open, rot]);

  // ⚠️★★훅은 **조기 return 위**에 둔다 — 아래에 두면 정리가 0개일 때와 아닐 때 훅 수가 달라져
  //   React #310 으로 화면이 통째로 죽는다(이 저장소가 웹·대화 탭을 그렇게 잃은 적이 있다).
  //   `check:hookorder` 가 실제로 이 실수를 잡아 줬다.
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);          // 고르는 중인가
  const [picked, setPicked] = useState<number[]>([]);     // 고른 정리 id
  const [saving, setSaving] = useState(false);
  const shotRef = useRef<ViewShot>(null);
  const pickedNotes = useMemo(() => notes.filter((n) => picked.includes(n.id)), [notes, picked]);

  if (!notes.length) return null;   // ★없으면 줄 자체가 없다

  /**
   * 지우기 — 화면에서 먼저 빼지 않고, 서버가 받은 뒤 다시 읽는다(되돌아가는 깜빡임 방지).
   * ⚠️★잠금은 반드시 `finally` 로 푼다 — 예외가 나면 그 줄의 버튼이 **영구히 비활성**으로 남는다
   *   (`check:hang` H1 이 잡아 줬다. 아래 `togglePin` 도 같다.)
   */
  const remove = async (id: number) => {
    setBusy(id);
    try {
      if (await hideNote(id)) onChanged();
    } finally {
      setBusy(null);
    }
  };
  /**
   * ★캡쳐 — 고른 정리를 **이미지 한 장**으로 만들어 기기에 남긴다
   *   (Boss 2026-08-31 *"선택 또는 다중선택해서 그부분을 캡쳐해서 이미지로"*).
   *
   * ■ 화면을 그대로 찍지 않는다 — **따로 그린 카드**를 찍는다.
   *   스크롤 위치·접힘 상태·테마에 따라 결과가 달라지면 «같은 걸 눌렀는데 다른 그림» 이 된다.
   *   화면 밖(off-screen) 카드를 그려 찍으면 언제 눌러도 같은 그림이 나온다.
   *   (`ShareReadingButton` 이 이미 쓰는 방식이라 새 길을 내지 않는다.)
   */

  const togglePick = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const endPicking = () => { setPicking(false); setPicked([]); };

  const saveShot = async () => {
    if (!pickedNotes.length || saving) return;
    setSaving(true);
    try {
      // ⚠️한 틱 기다린다 — 방금 고른 것이 off-screen 카드에 그려질 시간을 준다
      //   (안 기다리면 **직전 선택 상태**가 찍힌다).
      await new Promise((r) => setTimeout(r, 250));
      const uri = await captureRef(shotRef, { format: 'jpg', quality: 0.95, result: 'data-uri' });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const res = await saveImageToDevice(uri, `niwoon-${stamp}`);
      if (res.ok) { Alert.alert(t('capture.saved', '저장했어요'), t('capture.savedMsg', '이미지로 남겼어요.')); endPicking(); }
      else Alert.alert(t('capture.fail', '저장하지 못했어요'), res.message);
    } catch {
      Alert.alert(t('capture.fail', '저장하지 못했어요'), t('capture.failMsg', '잠시 후 다시 시도해 주세요.'));
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (n: TalkNote) => {
    setBusy(n.id);
    try {
      if (await pinNote(n.id, !n.pinned)) onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <PressableScale style={styles.bar} onPress={onToggle} hitSlop={8}>
        <Text style={[styles.barTx, { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.5) }]} numberOfLines={1}>
          이 대화 정리 · {notes.length}
        </Text>
        <Animated.Text
          style={[styles.chev, { transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }]}
        >
          ▾
        </Animated.Text>
      </PressableScale>
      {/* ★캡쳐 — 펼쳐져 있을 때만 보인다. 접힌 상태에서 «무엇을 고를지» 를 물으면 앞뒤가 안 맞는다. */}
      {open && notes.length ? (
        <PressableScale
          style={styles.capBtn}
          hitSlop={8}
          onPress={() => (picking ? endPicking() : setPicking(true))}
        >
          <Text style={styles.capBtnTx}>
            {picking ? t('common.cancel', '취소') : t('capture.start', '캡쳐')}
          </Text>
        </PressableScale>
      ) : null}

      {open && (
        <View style={styles.sheet}>
          {notes.map((n) => (
            <View key={n.id} style={styles.row}>
              <PressableScale
                style={styles.rowMain}
                // 출처가 없으면 누를 수 없다 — 아무 데도 못 데려가면서 눌리는 척하지 않는다
                onPress={picking ? () => togglePick(n.id) : (n.fromMessage != null ? () => onJump(n.fromMessage!) : undefined)}
              >
                <Text style={[styles.lbl, { fontSize: fs(10.5), lineHeight: Math.round(fs(10.5) * 1.5) }]}>
                  {NOTE_LABEL[n.kind]}{n.author === 'user' ? ' · 내가 담음' : ''}
                </Text>
                <Text style={[styles.body, { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.55) }]}>
                  {n.body}
                </Text>
              </PressableScale>
              {/* ★고르는 중에는 **고정·지우기를 감춘다** — 고르려다 지우는 사고를 구조로 막는다 */}
              {picking ? (
                <PressableScale style={styles.act} hitSlop={10} onPress={() => togglePick(n.id)}>
                  <Text style={[styles.actTx, picked.includes(n.id) && styles.actOn]}>
                    {picked.includes(n.id) ? '☑' : '☐'}
                  </Text>
                </PressableScale>
              ) : (
                <>
                  <PressableScale style={styles.act} hitSlop={10} onPress={() => togglePin(n)} disabled={busy === n.id}>
                    <Text style={[styles.actTx, n.pinned && styles.actOn]}>{n.pinned ? '★' : '☆'}</Text>
                  </PressableScale>
                  <PressableScale style={styles.act} hitSlop={10} onPress={() => remove(n.id)} disabled={busy === n.id}>
                    <Text style={styles.actTx}>✕</Text>
                  </PressableScale>
                </>
              )}
            </View>
          ))}
          {/* ★이 정리가 어디서 왔는지 밝힌다 — 확정된 판정처럼 보이면 안 된다(CLAUDE.md §3.2) */}
          <Text style={[styles.foot, { fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.5) }]}>
            대화에서 나온 말을 모은 것이에요. 눌러서 원래 대화를 볼 수 있어요.
          </Text>
          {/* ★고른 뒤 저장 — 몇 개인지 **숫자로** 보여 준다(«저장» 만 있으면 무엇이 담기는지 모른다) */}
          {picking ? (
            <View style={styles.saveBar}>
              <Text style={styles.saveTx}>{t('capture.pickHint', '담을 정리를 골라 주세요')}</Text>
              <PressableScale
                style={[styles.saveBtn, (!picked.length || saving) && styles.saveBtnOff]}
                disabled={!picked.length || saving}
                onPress={saveShot}
              >
                <Text style={styles.saveBtnTx}>
                  {saving ? t('capture.saving', '만드는 중…') : `${picked.length} ${t('capture.save', '저장')}`}
                </Text>
              </PressableScale>
            </View>
          ) : null}
        </View>
      )}

      {/* ★★화면 밖 캡쳐 카드 — 사용자에게 안 보이고 찍히기만 한다.
          고른 것이 있을 때만 그린다(빈 카드를 늘 들고 있을 이유가 없다). */}
      {pickedNotes.length ? (
        <View style={styles.shotHost} pointerEvents="none">
          <ViewShot ref={shotRef} options={{ format: 'jpg', quality: 0.95 }}>
            <View style={styles.card}>
              {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
              <Text style={styles.cardMeta}>{new Date().toLocaleDateString()}</Text>
              {pickedNotes.map((n) => (
                <View key={n.id} style={styles.cardItem}>
                  <Text style={styles.cardLbl}>{NOTE_LABEL[n.kind]}</Text>
                  <Text style={styles.cardBody}>{n.body}</Text>
                </View>
              ))}
              <Text style={styles.cardFoot}>niwoon2.pages.dev</Text>
            </View>
          </ViewShot>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(3), paddingTop: space(2), paddingBottom: space(1) },
  // 캡쳐 — 바 오른쪽 작은 글자 버튼(아이콘을 새로 만들지 않는다)
  capBtn: { position: 'absolute', right: space(4), top: space(2.5), paddingHorizontal: space(2), paddingVertical: space(1) },
  capBtnTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  // 고른 뒤 저장 줄
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3.5), paddingVertical: space(2.5) },
  saveTx: { ...font.caption, color: colors.inkFaint, flex: 1 },
  saveBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2) },
  saveBtnOff: { backgroundColor: colors.line },
  saveBtnTx: { ...font.caption, color: colors.onJu, fontWeight: '800' },
  // ★화면 밖 카드 — 사용자에게 안 보이고 **찍히기만** 한다.
  //   `display:'none'` 이면 캡쳐도 안 된다(그려져야 찍힌다) ⇒ 화면 밖으로 밀어 둔다.
  shotHost: { position: 'absolute', left: -9999, top: 0, opacity: 0 },
  card: { width: 720, backgroundColor: colors.bg, padding: 44, gap: 18 },
  cardTitle: { ...font.title, color: colors.ink, fontSize: 30 },
  cardMeta: { ...font.caption, color: colors.inkFaint, fontSize: 16 },
  cardItem: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 22, gap: 6 },
  cardLbl: { ...font.caption, color: colors.ju, fontWeight: '800', fontSize: 15 },
  cardBody: { ...font.body, color: colors.ink, fontSize: 19, lineHeight: 30 },
  cardFoot: { ...font.caption, color: colors.inkFaint, fontSize: 15, textAlign: 'right' },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, paddingHorizontal: space(3.5), paddingVertical: space(2.5),
    ...shadow.card,
  },
  barTx: { ...font.body, fontWeight: '600', color: colors.ink, flex: 1 },
  chev: { fontSize: 13, color: colors.inkFaint },
  sheet: {
    marginTop: space(1.5), backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: space(3.5), paddingVertical: space(2.5),
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  rowMain: { flex: 1, paddingRight: space(2) },
  lbl: { ...font.caption, color: colors.ju, fontWeight: '700', letterSpacing: 0.3 },
  body: { ...font.body, color: colors.ink, marginTop: 2 },
  act: { paddingHorizontal: space(1.5), paddingVertical: space(1) },
  actTx: { fontSize: 15, color: colors.inkFaint },
  actOn: { color: colors.ju },
  foot: { ...font.caption, color: colors.inkFaint, paddingHorizontal: space(3.5), paddingVertical: space(2.5) },
});
