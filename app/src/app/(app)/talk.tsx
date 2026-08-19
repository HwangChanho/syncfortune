// app/src/app/(app)/talk.tsx — 상담사 톡 (친구목록 + 대화)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-19: 시작 화면을 카톡처럼. **웹은 옆에 채팅창도 같이 떠서 화면을 채운다.**
//
// ■ 한 화면 두 배치
//   · 폰 / 좁은 웹 — 목록 → (누르면) 대화. 뒤로 가면 목록.
//   · 넓은 웹     — 왼쪽 목록 + 오른쪽 대화 동시에.
//   ⇒ `useWideWeb()` 하나로 가른다. **새 반응형 체계를 만들지 않는다**(WebShell 이 이미 갖고 있다).
//
// ■ 지금 단계에서 도는 것은 **가상 상담사뿐**이다
//   가상 = 고정 대사 + 결정론 문구 + 콘텐츠 링크 → LLM 호출 0회 · 원가 ₩0.
//   실제(`live`)는 Edge `talk` 를 붙이는 다음 단계다. 그전까지는 안내 문구만 띄운다 —
//   ★없는 기능을 있는 척하지 않는다(눌렀는데 아무 일도 안 나는 게 제일 나쁘다).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { TalkList } from '../../components/talk/TalkList';
import { TalkThread, type TalkItem } from '../../components/talk/TalkThread';
import { listConsultants, consultantsSnapshot, type Consultant } from '../../lib/talk/consultants';
import { greet, todayFlow, guide, type VirtualReply } from '../../lib/talk/virtualTalk';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { useWideWeb } from '../../components/WebShell';
import { getNavBarHeight } from '../../components/BottomNav';
import { colors, space, radius, font } from '../../lib/theme';

let _seq = 0;
const nextId = () => `m${++_seq}`;

/** 가상 답 하나를 화면 말풍선들로 편다(말풍선은 여러 개, 링크는 마지막에 붙는다). */
function toItems(r: VirtualReply): TalkItem[] {
  return r.bubbles.map((b, i) => ({
    id: nextId(),
    role: 'assistant' as const,
    body: b,
    links: i === r.bubbles.length - 1 && r.links.length ? r.links : undefined,
  }));
}

export default function TalkScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const wide = useWideWeb();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<Consultant[]>(consultantsSnapshot());
  const [cur, setCur] = useState<Consultant | null>(null);
  const [items, setItems] = useState<TalkItem[]>([]);
  const [saju, setSaju] = useState<any>(null);
  const [draft, setDraft] = useState('');
  // ★키보드 회피 — `coach.tsx` 와 **같은 패턴**을 쓴다(`check:keyboard` R1/R2).
  //   입력바가 하단 고정이라 KeyboardAvoidingView 로는 안 올라간다 — 리스너로 직접 올린다.
  //   하단 내비 높이를 빼는 이유: 키보드가 그만큼을 이미 덮고 있어서, 안 빼면 두 번 올라간다.
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt as never, (e: any) => setKbH(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt as never, () => setKbH(0));
    return () => { s.remove(); h.remove(); };
  }, []);
  const lift = kbH > 0 ? Math.max(0, kbH - getNavBarHeight()) : 0;

  useEffect(() => { void listConsultants().then(setList); }, []);
  // 명식은 한 번만 계산해 둔다 — 가상 답이 매번 엔진을 다시 돌릴 이유가 없다
  useEffect(() => {
    let alive = true;
    void loadRepChart().then((c) => {
      if (!alive || !c?.input) return;
      try { setSaju(computeChart(c.input).saju); } catch { /* 명식 없으면 흐름 안내는 건너뛴다 */ }
    });
    return () => { alive = false; };
  }, []);

  // 넓은 웹은 처음부터 한 명을 열어 둔다 — 오른쪽 칸이 비어 있으면 화면이 반만 쓰인다
  useEffect(() => {
    if (wide && !cur && list.length) open(list[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide, list]);

  const open = useCallback((c: Consultant) => {
    setCur(c);
    if (c.kind === 'virtual') {
      setItems(toItems(greet(c.name, c.tagline, c.routes, t as never)));
    } else {
      // ★실제 상담사는 아직 안 붙었다. 있는 척하지 않고 그렇다고 말한다.
      setItems([{ id: nextId(), role: 'assistant', body: t('talk.liveSoon', '곧 이야기 나눌 수 있어요. 준비 중이에요.') }]);
    }
  }, [t]);

  /** 사용자가 한 마디 — 지금은 가상만 답한다(전부 원가 0). */
  const send = useCallback(() => {
    const q = draft.trim();
    if (!q || !cur) return;
    setDraft('');
    setItems((prev) => [...prev, { id: nextId(), role: 'user', body: q }]);
    if (cur.kind !== 'virtual') return;   // live 는 다음 단계
    // 아주 단순한 갈래 — '오늘/흐름'을 물으면 결정론 문구, 아니면 콘텐츠 안내.
    //   ⚠️여기서 의도를 정교하게 알아내려 들지 않는다. 그건 LLM 이 할 일이고,
    //     가상의 몫은 **빠르고 공짜로 데려다주는 것**이다.
    const wantsFlow = /오늘|흐름|운세|이달|today/i.test(q) && !!saju;
    const r = wantsFlow ? todayFlow(saju, t as never) : guide(cur.routes, t as never);
    setTimeout(() => setItems((prev) => [...prev, ...toItems(r)]), 260);   // 사람이 치는 듯한 짧은 뜸
  }, [draft, cur, saju, t]);

  const composer = cur?.kind === 'virtual' || cur?.kind === 'live' ? (
    <View style={[styles.composer, { paddingBottom: Math.max(space(3), insets.bottom), marginBottom: lift }]}>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder={t('talk.inputHint', '무엇이든 물어보세요')}
        placeholderTextColor={colors.inkFaint}
        onSubmitEditing={send}
        returnKeyType="send"
      />
      <PressableScale style={styles.sendBtn} onPress={send}>
        <Text style={styles.sendTx}>{t('talk.send', '보내기')}</Text>
      </PressableScale>
    </View>
  ) : null;

  // ── 넓은 웹 = 두 칸 ──────────────────────────────────────────────
  if (wide) {
    return (
      <View style={styles.two}>
        <View style={styles.pane}><TalkList items={list} onOpen={open} selected={cur?.id} /></View>
        <View style={styles.main}>
          {cur ? (
            <>
              <View style={styles.head}><Text style={styles.headTx}>{cur.name}</Text></View>
              <TalkThread items={items} onLink={(r) => router.push(r as never)} />
              {composer}
            </>
          ) : (
            <View style={styles.empty}><Text style={styles.emptyTx}>{t('talk.pickOne', '왼쪽에서 상담사를 골라 주세요')}</Text></View>
          )}
        </View>
      </View>
    );
  }

  // ── 폰 = 목록 → 대화 ─────────────────────────────────────────────
  if (!cur) return <TalkList items={list} onOpen={open} />;
  return (
    <View style={styles.one}>
      <View style={styles.head}>
        <PressableScale hitSlop={10} onPress={() => setCur(null)}><Text style={styles.back}>‹</Text></PressableScale>
        <Text style={styles.headTx}>{cur.name}</Text>
      </View>
      <TalkThread items={items} onLink={(r) => router.push(r as never)} />
      {composer}
    </View>
  );
}

const styles = StyleSheet.create({
  one: { flex: 1, backgroundColor: colors.bg },
  two: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  // 왼쪽 목록 — 폭을 고정한다(내용에 따라 흔들리면 눈이 피곤하다)
  pane: { width: 300, borderRightWidth: 1, borderRightColor: colors.line },
  main: { flex: 1, minWidth: 0 },

  head: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    paddingHorizontal: space(4), paddingVertical: space(3),
    borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.card,
  },
  back: { fontSize: 26, lineHeight: 30, color: colors.ju, fontWeight: '900', paddingRight: space(1) },
  headTx: { ...font.heading, color: colors.ink, fontWeight: '800' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTx: { ...font.body, color: colors.inkFaint },

  composer: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    paddingHorizontal: space(4), paddingTop: space(3),
    borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card,
  },
  input: {
    flex: 1, backgroundColor: colors.sunk, borderRadius: radius.pill,
    paddingHorizontal: space(4), paddingVertical: space(2.5),
    ...font.body, color: colors.ink,
  },
  sendBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2.5) },
  // ★강조색 위 글자는 `onJu`(check:onaccent)
  sendTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
});
