// app/src/app/(app)/talk.tsx — 상담사 톡 (친구목록 + 대화)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-19: 시작 화면을 카톡처럼. **웹은 옆에 채팅창도 같이 떠서 화면을 채운다.**
//
// ■ 한 화면 두 배치
//   · 폰 / 좁은 웹 — 목록 → (누르면) 대화. 뒤로 가면 목록.
//   · 넓은 웹     — 왼쪽 목록 + 오른쪽 대화 동시에.
//   ⇒ `useWideWeb()` 하나로 가른다. **새 반응형 체계를 만들지 않는다**(WebShell 이 이미 갖고 있다).
//
// ■ 두 상담사가 **한 화면**을 쓰되, 갈림길은 한 곳뿐이다
//   가상 = 고정 대사 + 결정론 문구 + 콘텐츠 링크 → LLM 호출 0회 · 원가 ₩0(`virtualTalk`).
//   실제 = Edge `talk` → LLM. 여기서만 돈이 든다(`liveTalk`).
//   ★갈림은 `send()` 안 `kind` 분기 **한 줄**이다. 여러 곳에서 갈리면 언젠가 한 곳이 새고,
//     그 사고는 **화면상 아무 차이가 없어서** 아무도 눈치채지 못한다.
//
// ■ 실패를 뭉뚱그리지 않는다
//   멈춤(`paused`)·한도(`capped`)·오류를 각각 다른 말로 띄운다 —
//   "안 되네요" 하나로 묶으면 사용자는 자기 잘못인지 우리 잘못인지 모른다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { TalkList } from '../../components/talk/TalkList';
import { TalkThread, type TalkItem } from '../../components/talk/TalkThread';
import { listConsultants, consultantsSnapshot, type Consultant } from '../../lib/talk/consultants';
import { greet, todayFlow, guide, type VirtualReply } from '../../lib/talk/virtualTalk';
import { askLive } from '../../lib/talk/liveTalk';
import { loadRepChart } from '../../lib/engine/myChart';
import { ensureServerChartIdForSaved } from '../../lib/backend/prewarmReadings';
import { useAuth } from '../../lib/useAuth';
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
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const wide = useWideWeb();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [list, setList] = useState<Consultant[]>(consultantsSnapshot());
  const [cur, setCur] = useState<Consultant | null>(null);
  const [items, setItems] = useState<TalkItem[]>([]);
  const [saju, setSaju] = useState<any>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);   // 친구목록 상단 '나' — 대표 명식 label
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);        // 실제 상담사가 답을 만드는 중(점 세 개)
  // 세션은 **상담사별로** 따로 이어진다 — 한 세션에 여러 상담사를 섞으면 이력이 뒤엉킨다
  const sessRef = useRef<Record<string, string>>({});
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
    void loadRepChart().then(async (c) => {
      if (!alive || !c?.input) return;
      setMyName(c.label ?? null);
      try { setSaju(computeChart(c.input).saju); } catch { /* 명식 없으면 흐름 안내는 건너뛴다 */ }
      // ★서버 chart_id 는 **정식 경로로만** 얻는다(`ensureServerChartIdForSaved`).
      //   온디바이스에 캐시된 `serverChartId` 를 그대로 쓰면 stale row 를 가리킬 수 있고,
      //   그러면 상담사가 **이 사람이 이미 본 풀이를 못 읽는다**(일관성이 깨진다).
      //   로그인 전이면 null — 차트 없이 일반적으로 답한다(서버가 그렇게 처리한다).
      if (!session) return;
      const sid = await ensureServerChartIdForSaved(c, session);
      if (alive) setChartId(sid);
    });
    return () => { alive = false; };
  }, [session]);

  // ★웹도 **처음엔 빈 대화창**이다(Boss 2026-08-19 "최초에는 빈 대화창으로 뜨고 클릭해야 대화 노출").
  //   종전엔 첫 상담사를 자동으로 열었다 — 화면은 꽉 차 보이지만 **사용자가 고르지 않은 대화**가 시작된다.
  //   실제 상담사였다면 그것만으로 API 를 태울 수도 있었다(첫 인사는 공짜라 태우진 않았지만, 구조가 위험했다).
  const open = useCallback((c: Consultant) => {
    setCur(c);
    if (c.kind === 'virtual') {
      setItems(toItems(greet(c.name, c.tagline, c.routes, t as never)));
    } else {
      // 실제 상담사도 **첫 인사만은 공짜다** — 화면을 여는 것만으로 API 를 태우지 않는다.
      setItems([{
        id: nextId(), role: 'assistant',
        body: t('talk.liveGreet', '안녕하세요. {{name}}이에요. 무엇이 궁금하세요?').replace('{{name}}', c.name),
      }]);
    }
  }, [t]);

  /**
   * 사용자가 한 마디.
   *
   * ★★여기가 **원가가 갈리는 유일한 지점**이다.
   *   `virtual` → 온디바이스(₩0) · `live` → Edge(턴당 실측 ₩4.2~14.5).
   *   분기를 늘리지 말 것 — 늘어나면 어느 쪽이 새는지 아무도 못 센다.
   */
  const send = useCallback(() => {
    const q = draft.trim();
    if (!q || !cur || busy) return;
    setDraft('');
    setItems((prev) => [...prev, { id: nextId(), role: 'user', body: q }]);

    if (cur.kind === 'virtual') {
      // 아주 단순한 갈래 — '오늘/흐름'을 물으면 결정론 문구, 아니면 콘텐츠 안내.
      //   ⚠️여기서 의도를 정교하게 알아내려 들지 않는다. 그건 LLM 이 할 일이고,
      //     가상의 몫은 **빠르고 공짜로 데려다주는 것**이다.
      const wantsFlow = /오늘|흐름|운세|이달|today/i.test(q) && !!saju;
      const r = wantsFlow ? todayFlow(saju, t as never) : guide(cur.routes, t as never);
      setTimeout(() => setItems((prev) => [...prev, ...toItems(r)]), 260);   // 사람이 치는 듯한 짧은 뜸
      return;
    }

    // ── 실제 상담사 ────────────────────────────────────────────────────
    setBusy(true);
    void askLive(cur.id, q, sessRef.current[cur.id] ?? null, chartId, i18n.language)
      .then((r) => {
        if (r.ok) {
          sessRef.current[cur.id] = r.sessionId;   // 다음 턴부터 이력이 이어진다
          setItems((prev) => [...prev, { id: nextId(), role: 'assistant', body: r.answer }]);
          // 무료를 다 쓴 순간에만 한 번 알린다 — 매 턴 알리면 잔소리가 된다
          if (r.overFree && r.used === r.freeDaily + 1) {
            setItems((prev) => [...prev, {
              id: nextId(), role: 'assistant',
              body: t('talk.overFree', '오늘 무료 대화를 다 쓰셨어요. 그래도 조금 더 이야기해 볼게요.'),
            }]);
          }
        } else {
          // ★실패 사유를 그대로 보여 준다(멈춤·한도·오류가 서로 다른 말이어야 한다)
          setItems((prev) => [...prev, { id: nextId(), role: 'assistant', body: r.message }]);
        }
      })
      .finally(() => setBusy(false));
  }, [draft, cur, saju, busy, chartId, t, i18n.language]);

  const composer = cur?.kind === 'virtual' || cur?.kind === 'live' ? (
    <View style={[styles.composer, { paddingBottom: Math.max(space(3), insets.bottom), marginBottom: lift }]}>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder={t('talk.inputHint', '무엇이든 물어보세요')}
        placeholderTextColor={colors.inkFaint}
        onSubmitEditing={send}
        editable={!busy}
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
        <View style={styles.pane}><TalkList items={list} onOpen={open} selected={cur?.id} myName={myName} onMe={() => router.push('/charts')} /></View>
        <View style={styles.main}>
          {cur ? (
            <>
              <View style={styles.head}><Text style={styles.headTx}>{cur.name}</Text></View>
              <TalkThread items={items} busy={busy} onLink={(r) => router.push(r as never)} />
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
  if (!cur) return <TalkList items={list} onOpen={open} myName={myName} onMe={() => router.push('/charts')} />;
  return (
    <View style={styles.one}>
      <View style={styles.head}>
        <PressableScale hitSlop={10} onPress={() => setCur(null)}><Text style={styles.back}>‹</Text></PressableScale>
        <Text style={styles.headTx}>{cur.name}</Text>
      </View>
      <TalkThread items={items} busy={busy} onLink={(r) => router.push(r as never)} />
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
