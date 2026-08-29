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
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Keyboard, Platform, useWindowDimensions } from 'react-native';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';

/** 목록 한 줄 — 부모가 저장된 명식에서 뽑아 넘긴다. */
export type MentionRow = {
  id: string;
  /** `@` 뒤에 붙는 이름(= 명식 라벨) */
  name: string;
  /** 본인·배우자·친구 … */
  relation: string;
  /** 화면 표시용 생년월일(YYYY-MM-DD). ⚠️서버로 보내지 않는다.
   *  ★친구 명식에는 **없다** — 생일이 암호화돼 앱으로 오지 않는다. 그 자리에 출처를 적는다. */
  born?: string;
  /**
   * 어디서 온 이름인가 (Boss 2026-08-26 *"다른식으로 표기 돼서 구분 가능하면 좋겠어"*).
   * ★색만으로 가르지 않는다 — 이 파일이 이미 «색만 쓰면 색약인 사람에게 안 보인다» 고 적어 뒀다.
   *   ⇒ **글자로** 적고, 목록도 **섹션 둘**로 나눈다.
   */
  source?: 'mine' | 'friend';
  /** 고를 수 없다(상대가 명식을 공개하지 않았다). ★숨기지 않고 **회색으로 보여 준다** —
   *  숨기면 «왜 안 보이지» 가 된다. */
  disabled?: boolean;
  /** 못 고르는 이유 한 줄 */
  note?: string;
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
  /**
   * 키보드 높이 — 이 시트는 `@` 를 **치는 도중에** 뜬다 = 키보드가 **항상 올라와 있다**.
   * ⚠️훅은 조기 return 위에 둔다(`check:hooks` · [[hook-order-crash-white-screen]]).
   */
  const [kbH, setKbH] = useState(0);
  const { height: winH } = useWindowDimensions();
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e: any) => setKbH(e?.endCoordinates?.height ?? 0));
    const b = Keyboard.addListener(hideEvt, () => setKbH(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  const full = already.length >= max;
  return (
    <View style={s.wrap}>
      <PressableScale style={s.dim} onPress={onClose}><View /></PressableScale>
      {/* ★★키보드 위로 올린다(Boss 2026-08-30 *"키보드에 가려서 아래쪽 명식이 안보여"*).
          높이를 **화면 기준 68%** 로만 잡고 있어 아래 3분의 1이 키보드 밑에 깔렸다 —
          목록은 있는데 **닿을 수가 없었다.**
          ⇒ ①바닥을 키보드만큼 띄우고 ②**남은 높이** 기준으로 상한을 다시 잡는다.
            하나만 하면 시트가 위로 올라가되 **위쪽이 화면 밖으로** 나간다. */}
      <View style={[s.card, { marginBottom: kbH, maxHeight: Math.max(220, (winH - kbH) * 0.68) }]}>
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
          ) : (['mine', 'friend'] as const).map((sec) => {
            // ★**섹션 둘로 나눈다** — 내 명식과 친구 명식은 성격이 다르다.
            //   내 것은 매번 새로 계산하고, 친구 것은 **그가 등록하던 날의 원국**이다.
            //   출처가 없는 옛 행은 «내 명식» 으로 본다(기존 호출부를 안 깬다).
            const list = rows.filter((r) => (r.source ?? 'mine') === sec);
            if (!list.length) return null;
            return (
              <View key={sec}>
                <Text style={s.secTx}>{sec === 'mine' ? '내 명식' : '친구가 공개한 명식'}</Text>
                {list.map((r) => {
                  const on = already.includes(r.name);
                  const off = full && !on;    // 상한에 걸려 더는 못 고른다
                  const no = r.disabled === true;   // 상대가 공개하지 않았다
                  return (
                    <PressableScale key={r.id} disabled={no} onPress={() => { if (!on && !off && !no) onPick(r); }}>
                      <View style={[s.row, on && s.rowOn, (off || no) && s.rowOff]}>
                        <View style={s.mid}>
                          <Text style={[s.name, on && s.nameOn]} numberOfLines={1}>@{r.name}</Text>
                          <Text style={s.meta} numberOfLines={1}>
                            {/* 친구는 생일이 없다 — 그 자리에 «등록 당시 명식» 이라고 적어 무엇인지 알린다 */}
                            {[r.relation, r.born, r.note ?? (sec === 'friend' && !no ? '등록 당시 명식' : '')]
                              .filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        {/* ★상태는 **색만이 아니라 글자로도** 준다 — 색만 쓰면 색약인 사람에게 안 보인다 */}
                        <Text style={[s.mark, on && s.markOn]}>{no ? '비공개' : on ? '부름' : '＋'}</Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
        <PressableScale style={s.btn} onPress={onClose}><Text style={s.btnTx}>닫기</Text></PressableScale>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // 섹션 제목 — 내 명식 / 친구가 공개한 명식
  secTx: { ...font.caption, color: colors.inkSoft, fontWeight: '800', marginTop: space(3), marginBottom: space(1.5) },
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
