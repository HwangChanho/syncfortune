/**
 * app/src/components/talk/InviteSheet.tsx: **초대 창** — 이 방에 다른 상담가를 부른다
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-25 *"노쎔이랑 대화중에 다른 사람을 초대할수 있어야해 그러면 채팅방이
 *   새로 만들어지고 카카오톡처럼 노쎔, 한서윤 이런식으로 보이고 나 포함 총 인원수도 떠야해"*.
 *
 * ■ ★고르는 창일 뿐, 만드는 건 부모가 한다
 *   여기서 방까지 만들면 «누구를 골랐나» 와 «방이 생겼나» 가 한 덩어리가 되어
 *   실패했을 때 어디서 끊겼는지 알 수 없다. 이 창은 **고른 id 목록만** 돌려준다.
 *
 * ■ 이미 방에 있는 사람은 **목록에서 뺀다** — 두 번 부를 수 있으면 «3명» 이 되지 않는다.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';
import type { Consultant } from '../../lib/talk/consultants';

type Props = {
  /** 고를 수 있는 상담가(이미 방에 있는 사람은 부모가 빼서 넘긴다) */
  candidates: Consultant[];
  /** 닫기 */
  onClose: () => void;
  /** 고른 사람들로 방 만들기 */
  onInvite: (ids: string[]) => void;
};

export default function InviteSheet({ candidates, onClose, onInvite }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  return (
    <View style={s.wrap}>
      <PressableScale style={s.dim} onPress={onClose}><View /></PressableScale>
      <View style={s.card}>
        <Text style={s.title}>대화에 초대하기</Text>
        <Text style={s.sub}>고른 사람들과 새 대화방이 만들어져요. 지금 방은 그대로 남아요.</Text>
        <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: space(2) }}>
          {candidates.length === 0
            ? <Text style={s.empty}>초대할 수 있는 사람이 없어요.</Text>
            : candidates.map((c) => {
              const on = picked.includes(c.id);
              return (
                <PressableScale key={c.id} onPress={() => toggle(c.id)}>
                  <View style={[s.row, on && s.rowOn]}>
                    {c.avatar
                      ? <Image source={{ uri: c.avatar }} style={s.av} contentFit="cover" />
                      : <View style={[s.av, s.avNone]} />}
                    <View style={s.mid}>
                      <Text style={[s.name, on && s.nameOn]}>{c.name}</Text>
                      {c.tagline ? <Text style={s.tag} numberOfLines={1}>{c.tagline}</Text> : null}
                    </View>
                    {/* ★고른 표시는 **색만이 아니라 글자로도** 준다 — 색만 쓰면 색약인 사람에게 안 보인다 */}
                    <Text style={[s.mark, on && s.markOn]}>{on ? '초대' : '＋'}</Text>
                  </View>
                </PressableScale>
              );
            })}
        </ScrollView>
        <View style={s.btns}>
          <PressableScale style={s.btn} onPress={onClose}><Text style={s.btnTx}>취소</Text></PressableScale>
          <PressableScale
            style={[s.btn, s.btnGo, !picked.length && s.btnOff]}
            onPress={() => picked.length && onInvite(picked)}
          >
            <Text style={[s.btnTx, s.btnGoTx]}>
              {picked.length ? `${picked.length}명 초대` : '초대'}
            </Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 40 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(5), maxHeight: '72%',
  },
  title: { ...font.heading, lineHeight: 24 },
  sub: { ...font.caption, color: colors.inkSoft, lineHeight: 18, marginTop: space(1) },
  list: { marginTop: space(3) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    paddingVertical: space(2), paddingHorizontal: space(2), borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.juSoft },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.line },
  avNone: { opacity: 0.5 },
  mid: { flex: 1 },
  name: { ...font.body, fontWeight: '600' as const, lineHeight: 20 },
  nameOn: { color: colors.ju },
  tag: { ...font.caption, color: colors.inkSoft, lineHeight: 16 },
  mark: { ...font.label, lineHeight: 19 },
  markOn: { color: colors.ju },
  empty: { ...font.label, lineHeight: 19, paddingVertical: space(4), textAlign: 'center' as const },
  btns: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  btn: {
    flex: 1, paddingVertical: space(3), borderRadius: radius.md,
    alignItems: 'center', backgroundColor: colors.sunk,
  },
  btnGo: { backgroundColor: colors.ju },
  btnOff: { opacity: 0.45 },
  btnTx: { ...font.body, fontWeight: '700' as const, lineHeight: 20 },
  btnGoTx: { color: '#FFFFFF' },
});
