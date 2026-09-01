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
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
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
  /**
   * ★AI 선생님 목록 (Boss 2026-09-02 *"대화상대 초대가 ai는 초대가 안돼"*).
   * ⚠️사람과 **섞지 않는다** — 부르는 방식이 다르기 때문이다:
   *   사람은 «방에 들어온다»(서버가 초대를 기록) · AI 는 «`@이름` 으로 부른다»(그때 답한다).
   *   같은 목록에 섞어 놓으면 «초대했는데 왜 아무 말도 없지» 가 된다.
   * 없으면(상담가 방 등) 이 칸을 **아예 안 그린다**.
   */
  aiCandidates?: Consultant[];
  /** AI 를 골랐을 때 — 고른 한 명을 돌려준다(창은 부모가 닫는다). */
  onPickAi?: (c: Consultant) => void;
};

export default function InviteSheet({ candidates, onClose, onInvite, aiCandidates, onPickAi }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  /**
   * ★★뜨자마자 **키보드를 내린다** (Boss 2026-09-02
   *   *"상단에 플러스 버튼누르면 키보드때문에 초대 인원을 찾을수가 없어"*).
   * ■ 왜 그랬나 — ＋ 는 **글 쓰던 중에** 누른다. 그때 키보드가 올라와 있는데
   *   이 창은 화면 **맨 아래**(`justifyContent:'flex-end'`)에 뜬다 ⇒ 목록이 키보드 밑에 깔린다.
   * ■ ★여기(창 안)에서 내리는 이유 — 부르는 곳이 **네 군데**다. 호출부에서 내리면
   *   한 곳만 고쳐지고 나머지 셋은 그대로 남는다(이 저장소에서 반복된 실패 모양).
   * ■ 이 창엔 글 쓸 칸이 없으므로 키보드를 내려서 잃는 것이 없다.
   */
  useEffect(() => { Keyboard.dismiss(); }, []);
  const toggle = (id: string) =>
    setPicked((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  return (
    <View style={s.wrap}>
      <PressableScale style={s.dim} onPress={onClose}><View /></PressableScale>
      {/* ⚠️홈 인디케이터만큼 아래를 띄운다 — 안 띄우면 «초대» 버튼이 제스처 바에 물린다 */}
      <View style={[s.card, { paddingBottom: space(5) + insets.bottom }]}>
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
          {/* ★★AI 선생님 — 사람과 **다른 칸**에, 다른 말로 (Boss 2026-09-02).
              누르면 그 자리에서 창이 닫히고 **입력칸에 `@이름` 이 들어간다**.
              ■ 왜 «초대» 가 아니라 «부르기» 인가 — AI 는 방에 상주하는 것이 아니라
                `@` 로 부를 때 답한다(이미 있는 경로 · Boss 2026-08-27). 그 길을 그대로 쓴다.
              ■ ⚠️★여기서 바로 답을 만들지 **않는다** — 답 한 번이 곧 운 차감이다.
                고르자마자 과금하면 «누른 적 없는 돈» 이 된다. 무엇을 물을지는 사람이 쓴다. */}
          {aiCandidates && aiCandidates.length && onPickAi ? (
            <>
              <Text style={s.secTitle}>{t('ms.aiCall', 'AI 선생님 부르기')}</Text>
              <Text style={s.secSub}>{t('ms.aiCallSub', '고르면 입력칸에 이름이 들어가요. 묻고 싶은 말을 이어서 쓰면 그 선생님이 답해요.')}</Text>
              {aiCandidates.map((c) => (
                <PressableScale key={c.id} onPress={() => onPickAi(c)}>
                  <View style={s.row}>
                    {c.avatar
                      ? <Image source={{ uri: c.avatar }} style={s.av} contentFit="cover" />
                      : <View style={[s.av, s.avNone]} />}
                    <View style={s.mid}>
                      <Text style={s.name}>{c.name}</Text>
                      {c.tagline ? <Text style={s.tag} numberOfLines={1}>{c.tagline}</Text> : null}
                    </View>
                    <Text style={s.mark}>＠</Text>
                  </View>
                </PressableScale>
              ))}
            </>
          ) : null}
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
  // AI 칸 머리 — 사람 목록과 눈으로 갈리게(줄 하나로 나눈다)
  secTitle: { ...font.body, fontWeight: '700' as const, lineHeight: 20, marginTop: space(4), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.line },
  secSub: { ...font.caption, color: colors.inkSoft, lineHeight: 16, marginBottom: space(1) },
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
