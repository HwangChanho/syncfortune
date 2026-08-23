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
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '../PressableScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { NOTE_LABEL, hideNote, pinNote, type TalkNote } from '../../lib/talk/talkNotes';

/**
 * @param notes      이 대화의 정리(비면 아무것도 그리지 않는다)
 * @param open       펼침 상태
 * @param onToggle   접기/펴기
 * @param onJump     출처 말풍선으로 데려가기(없는 항목은 누를 수 없다)
 * @param onChanged  지우기·고정 뒤 목록을 다시 읽으라는 신호
 */
export function TalkNotes({
  notes, open, onToggle, onJump, onChanged,
}: {
  notes: TalkNote[];
  open: boolean;
  onToggle: () => void;
  onJump: (messageId: number) => void;
  onChanged: () => void;
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

      {open && (
        <View style={styles.sheet}>
          {notes.map((n) => (
            <View key={n.id} style={styles.row}>
              <PressableScale
                style={styles.rowMain}
                // 출처가 없으면 누를 수 없다 — 아무 데도 못 데려가면서 눌리는 척하지 않는다
                onPress={n.fromMessage != null ? () => onJump(n.fromMessage!) : undefined}
              >
                <Text style={[styles.lbl, { fontSize: fs(10.5), lineHeight: Math.round(fs(10.5) * 1.5) }]}>
                  {NOTE_LABEL[n.kind]}{n.author === 'user' ? ' · 내가 담음' : ''}
                </Text>
                <Text style={[styles.body, { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.55) }]}>
                  {n.body}
                </Text>
              </PressableScale>
              <PressableScale style={styles.act} hitSlop={10} onPress={() => togglePin(n)} disabled={busy === n.id}>
                <Text style={[styles.actTx, n.pinned && styles.actOn]}>{n.pinned ? '★' : '☆'}</Text>
              </PressableScale>
              <PressableScale style={styles.act} hitSlop={10} onPress={() => remove(n.id)} disabled={busy === n.id}>
                <Text style={styles.actTx}>✕</Text>
              </PressableScale>
            </View>
          ))}
          {/* ★이 정리가 어디서 왔는지 밝힌다 — 확정된 판정처럼 보이면 안 된다(CLAUDE.md §3.2) */}
          <Text style={[styles.foot, { fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.5) }]}>
            대화에서 나온 말을 모은 것이에요. 눌러서 원래 대화를 볼 수 있어요.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(3), paddingTop: space(2), paddingBottom: space(1) },
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
