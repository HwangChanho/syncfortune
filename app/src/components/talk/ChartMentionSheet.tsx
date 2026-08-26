/**
 * app/src/components/talk/ChartMentionSheet.tsx: **명식 부르기 창** — `@이름` 을 골라 넣는다
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-26 *"채팅창에서 만세력이 등록된 인물이나 추가된 다른 인물을 간편하게 골라서
 *   탭해서 @누구 이런식으로 불러올수 있으면 좋겠어"*
 *
 * ■ ★한 번 탭이면 끝난다
 *   `InviteSheet` 는 여럿을 고르고 「초대」를 눌러야 하지만, 여기는 **고르는 즉시 넣고 닫는다.**
 *   Boss 가 말한 «간편하게» 가 그 뜻이다 — 글 쓰는 중에 끼어드는 창이라 단계가 하나여야 한다.
 *
 * ■ ★생년월일은 **화면에만** 뜬다
 *   고를 때 «어느 김철수인지» 를 가르는 건 생일뿐이라 목록에는 보여 준다.
 *   ⚠️하지만 서버로는 **안 나간다** — 보내는 건 원국·판정뿐이다(ADR-005 · `chartMention.ts`).
 *
 * ■ 명식이 없으면 **등록으로 보낸다**
 *   빈 목록에 "없어요" 만 띄우면 막다른 길이다. 여기서 바로 등록으로 갈 수 있어야 한다.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';

/** 목록 한 줄 — 부모가 저장된 명식에서 뽑아 넘긴다. */
export type MentionRow = {
  id: string;
  /** `@` 뒤에 붙는 이름(= 명식 라벨) */
  name: string;
  /** 본인·배우자·친구 … */
  relation: string;
  /** 화면 표시용 생년월일(YYYY-MM-DD). ⚠️서버로 보내지 않는다 */
  born: string;
};

type Props = {
  rows: MentionRow[];
  /** 이미 본문에 들어가 있는 이름들 — 두 번 넣지 않게 표시만 다르게 준다 */
  already: string[];
  /** 한 턴에 부를 수 있는 최대 인원(넘으면 더 못 고른다) */
  max: number;
  onClose: () => void;
  /** 골랐다 — 부모가 본문에 `@이름` 을 끼워 넣는다 */
  onPick: (row: MentionRow) => void;
  /** 명식 등록하러 가기 */
  onRegister: () => void;
};

export default function ChartMentionSheet({ rows, already, max, onClose, onPick, onRegister }: Props) {
  const full = already.length >= max;
  return (
    <View style={s.wrap}>
      <PressableScale style={s.dim} onPress={onClose}><View /></PressableScale>
      <View style={s.card}>
        <Text style={s.title}>명식 부르기</Text>
        <Text style={s.sub}>
          {full
            ? `한 번에 ${max}명까지 부를 수 있어요. 지금 부른 사람을 지우면 다른 사람을 부를 수 있어요.`
            : '고른 사람의 명식을 선생님이 같이 봐요. 「@이름」으로 들어가요.'}
        </Text>
        <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: space(2) }}>
          {rows.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.empty}>등록된 명식이 없어요.</Text>
              <PressableScale style={s.regBtn} onPress={onRegister}>
                <Text style={s.regTx}>명식 등록하기</Text>
              </PressableScale>
            </View>
          ) : rows.map((r) => {
            const on = already.includes(r.name);
            const off = full && !on;    // 상한에 걸려 더는 못 고른다
            return (
              <PressableScale key={r.id} onPress={() => { if (!on && !off) onPick(r); }}>
                <View style={[s.row, on && s.rowOn, off && s.rowOff]}>
                  <View style={s.mid}>
                    <Text style={[s.name, on && s.nameOn]} numberOfLines={1}>@{r.name}</Text>
                    <Text style={s.meta} numberOfLines={1}>
                      {[r.relation, r.born].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {/* ★상태는 **색만이 아니라 글자로도** 준다 — 색만 쓰면 색약인 사람에게 안 보인다 */}
                  <Text style={[s.mark, on && s.markOn]}>{on ? '부름' : '＋'}</Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
        <PressableScale style={s.btn} onPress={onClose}><Text style={s.btnTx}>닫기</Text></PressableScale>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 40 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(5), maxHeight: '68%',
  },
  title: { ...font.heading, lineHeight: 24 },
  sub: { ...font.caption, color: colors.inkSoft, lineHeight: 18, marginTop: space(1) },
  list: { marginTop: space(3) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    paddingVertical: space(2.5), paddingHorizontal: space(2), borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.juSoft },
  rowOff: { opacity: 0.4 },
  mid: { flex: 1 },
  name: { ...font.body, fontWeight: '600' as const, lineHeight: 20 },
  nameOn: { color: colors.ju },
  meta: { ...font.caption, color: colors.inkSoft, lineHeight: 16 },
  mark: { ...font.label, lineHeight: 19 },
  markOn: { color: colors.ju },
  emptyBox: { alignItems: 'center', paddingVertical: space(5), gap: space(3) },
  empty: { ...font.label, lineHeight: 19 },
  regBtn: { paddingVertical: space(2.5), paddingHorizontal: space(6), borderRadius: radius.md, backgroundColor: colors.ju },
  regTx: { ...font.body, fontWeight: '700' as const, lineHeight: 20, color: '#FFFFFF' },
  btn: {
    marginTop: space(3), paddingVertical: space(3), borderRadius: radius.md,
    alignItems: 'center', backgroundColor: colors.sunk,
  },
  btnTx: { ...font.body, fontWeight: '700' as const, lineHeight: 20 },
});
