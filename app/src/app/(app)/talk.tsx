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
import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { View, Text, StyleSheet, TextInput, Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { TalkList } from '../../components/talk/TalkList';
import { ChatList } from '../../components/talk/ChatList';
import { TalkThread, type TalkItem } from '../../components/talk/TalkThread';
import { listConsultants, consultantsSnapshot, type Consultant } from '../../lib/talk/consultants';
import { greet, todayFlow, guide, type VirtualReply } from '../../lib/talk/virtualTalk';
import { askLive } from '../../lib/talk/liveTalk';
import { supabase } from '../../lib/supabase';
import { loadRepChart } from '../../lib/engine/myChart';
import { ensureServerChartIdForSaved } from '../../lib/backend/prewarmReadings';
import { useAuth } from '../../lib/useAuth';
import { computeChart } from '../../lib/engine/engine';
import { useWideWeb } from '../../components/WebShell';
import { renderTalkBlock, isFriendBlock, blockName } from '../../components/talk/blockRegistry';
import { useHomeOrder } from '../../lib/ui/homeOrder';
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

/**
 * 친구목록 + 대화 — **시작 화면의 본체**(Boss 2026-08-19 *"첫 시작화면에 로고뜨고 바로 카카오톡처럼 친구목록"*).
 *
 * @param renderTop 목록 위에 얹을 것(브랜드 헤더·풀이 진행률 배너).
 *   ★대화 상세로 들어가면 **띄우지 않는다** — 카톡도 대화에 들어가면 상단이 상대 이름으로 바뀐다.
 *     헤더가 두 겹으로 남으면 '어디에 있는지'가 흐려진다.
 * @param mode 왼쪽 칸에 무엇을 둘까 — `contacts`(친구목록) / `chats`(대화 목록).
 *   ★두 탭이 **같은 껍데기**를 쓴다(Boss 2026-08-20 *"친구목록이랑 채팅 탭이 좌우로 공간을 나눠서"*).
 *     대화창·입력바·2칸 배치를 탭마다 만들면 언젠가 다르게 동작한다.
 */
export function TalkHome({ renderTop, mode = 'contacts' }: { renderTop?: ReactNode; mode?: 'contacts' | 'chats' }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // 대화 목록(`/chats`)에서 특정 상담사를 바로 열 때 쓰는 값
  const { c: openId } = useLocalSearchParams<{ c?: string }>();
  const wide = useWideWeb();
  // 세 칸을 다 펴려면 목록 둘(264×2) + 사이드바(210) 위에 대화창이 최소 420 은 있어야 한다.
  //   ★못 미치면 채팅목록을 접는다 — 세 칸이 다 답답한 것보다 두 칸이 낫다.
  const { width: winW } = useWindowDimensions();
  const showChatPane = wide && winW >= 1160;
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const { order } = useHomeOrder();          // 홈 순서 = 친구 순서(운영자가 정한 것을 그대로 따른다)
  const [dateKey] = useState(() => new Date().toDateString());
  const [servers, setServers] = useState<Consultant[]>(consultantsSnapshot());
  /**
   * 친구목록 = **홈 블록 친구 + 상담사**.
   * ★블록이 앞이다 — 사용자가 매일 보러 오는 건 오늘의 운세지 상담이 아니다.
   *   (상담을 위에 두면 첫 화면이 '팔아야 할 것'부터 보이는 배치가 된다.)
   */
  const list = useMemo<Consultant[]>(() => {
    const blocks: Consultant[] = order.filter(isFriendBlock).map((k, i) => ({
      id: `block:${k}`, kind: 'virtual', name: blockName(k), tagline: null, avatar: null,
      specialty: [], routes: [], sortOrder: i, block: k,
    }));
    return [...blocks, ...servers];
  }, [order, servers]);
  const [cur, setCur] = useState<Consultant | null>(null);
  const [items, setItems] = useState<TalkItem[]>([]);
  const [saju, setSaju] = useState<any>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);   // 친구목록 상단 '나' — 대표 명식 label
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);        // 실제 상담사가 답을 만드는 중(점 세 개)
  // 채팅목록(오른쪽 칸)을 다시 읽게 하는 신호 — 답이 오거나 읽음 처리했을 때 올린다.
  //   ★웹은 목록과 대화창이 **동시에 보이므로**, 답이 왔는데 목록이 그대로면 화면이 자기모순이 된다.
  const [chatsTick, setChatsTick] = useState(0);
  const bumpChats = useCallback(() => setChatsTick((n) => n + 1), []);
  /**
   * 읽음 처리 — ★실패 사유를 **삼키지 않는다**(`check:rpcerror`).
   *   배지가 안 사라지는 건 눈에 보이는 증상인데, 원인(권한·네트워크)을 안 남기면
   *   "왜 안 지워지지"만 남는다. 화면은 막지 않되 로그는 남긴다.
   */
  const markRead = useCallback(async (sessionId: string) => {
    const { error } = await supabase.rpc('mark_talk_read', { p_session: sessionId });
    if (error) console.warn('[talk] mark_talk_read 실패', error.message);
    bumpChats();
  }, [bumpChats]);
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

  useEffect(() => { void listConsultants().then(setServers); }, []);
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

  // 대화 목록에서 넘어왔으면 그 사람을 연다 — ★한 번만(사용자가 뒤로 가면 목록으로 돌아가야 한다)
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current || !openId || !list.length) return;
    const c = list.find((x) => x.id === openId);
    if (c) { openedRef.current = true; open(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, list]);

  // ★웹도 **처음엔 빈 대화창**이다(Boss 2026-08-19 "최초에는 빈 대화창으로 뜨고 클릭해야 대화 노출").
  //   종전엔 첫 상담사를 자동으로 열었다 — 화면은 꽉 차 보이지만 **사용자가 고르지 않은 대화**가 시작된다.
  //   실제 상담사였다면 그것만으로 API 를 태울 수도 있었다(첫 인사는 공짜라 태우진 않았지만, 구조가 위험했다).
  const open = useCallback((c: Consultant) => {
    setCur(c);
    // ★대화를 열면 **읽음 처리**한다 — 안 그러면 배지가 영원히 남는다.
    //   시각은 서버가 `now()` 로 찍는다(앱이 값을 보내면 미래 시각으로 배지를 지울 수 있다).
    //   실패해도 대화는 열린다(배지가 한 번 더 뜰 뿐이다).
    const sid = sessRef.current[c.id];
    if (sid) void markRead(sid);
    // ── 홈 블록 친구 — 인사 한 줄 + **기존 화면 그대로** ──
    //   ★말풍선으로 내용을 옮겨 적지 않는다. 옮겨 적는 순간 홈과 갈린다.
    if (c.block) {
      setItems([
        { id: nextId(), role: 'assistant', body: t('talk.blockHi', '{{what}} 가져왔어요.').replace('{{what}}', c.name) },
        { id: nextId(), role: 'assistant', body: '', node: renderTalkBlock(c.block as never, { reloadKey: 0, dateKey, repName: myName }) },
      ]);
      return;
    }
    if (c.kind === 'virtual') {
      setItems(toItems(greet(c.name, c.tagline, c.routes, t as never)));
    } else {
      // 실제 상담사도 **첫 인사만은 공짜다** — 화면을 여는 것만으로 API 를 태우지 않는다.
      setItems([{
        id: nextId(), role: 'assistant',
        body: t('talk.liveGreet', '안녕하세요. {{name}}이에요. 무엇이 궁금하세요?').replace('{{name}}', c.name),
      }]);
    }
  }, [t, dateKey, myName, bumpChats]);

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
          // 방금 내가 읽은 답이므로 읽음 처리 + 목록 갱신(미리보기·시각이 바로 반영된다)
          void markRead(r.sessionId);
          // ★★말풍선을 **나눠서 순차로** 띄운다(Boss 2026-08-20 *"채팅하듯이 짧게 짧게"*).
          //   모델이 빈 줄로 구분해 보내면 그대로 쪼갠다(한 덩이로 뱉으면 풍선 하나).
          //   ⚠️전부 한꺼번에 붙이면 '사람이 길게 쓴 글'이지 대화가 아니다 —
          //     사람은 하나 보내고 다음을 친다. 그 **사이 간격**이 사람처럼 느끼게 하는 전부다.
          //   ★뜸은 **앞 풍선 길이**에 비례한다(긴 말 뒤에 더 오래 걸린다). 상한 1.4초 —
          //     그 이상은 '사람 같다'가 아니라 '느리다'가 된다.
          const parts = r.answer.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
          let at = 0;
          parts.forEach((body, i) => {
            if (i > 0) at += Math.min(1400, 320 + parts[i - 1].length * 12);
            const ms = at;
            setTimeout(() => setItems((prev) => [...prev, { id: nextId(), role: 'assistant', body }]), ms);
          });
          // 마지막 풍선이 뜰 때까지 '입력 중'을 유지한다 — 중간에 꺼지면 끝난 줄 안다
          if (parts.length > 1) { setBusy(true); setTimeout(() => setBusy(false), at); }
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
  }, [draft, cur, saju, busy, chartId, t, i18n.language, bumpChats]);

  // ★블록 친구에겐 입력창을 띄우지 않는다 — 물어봐도 답할 수 없는 입력창은 없느니만 못하다
  /**
   * 폰의 목록 칸 — 탭에 따라 친구목록/대화목록. **여기 한 곳에서만 갈린다.**
   * ★웹은 셋을 동시에 펴므로 이 분기를 쓰지 않는다(폰만 좁아서 갈린다).
   */
  const leftPane = mode === 'chats'
    ? <ChatList selectedId={cur?.id} onOpen={(id) => { const c = list.find((x) => x.id === id); if (c) open(c); }} />
    : <TalkList items={list} onOpen={open} selected={cur?.id} myName={myName} onMe={() => router.push('/charts')} />;

  const composer = !cur?.block && (cur?.kind === 'virtual' || cur?.kind === 'live') ? (
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

  // ── 넓은 웹 = **세 칸** ───────────────────────────────────────────
  //   Boss 2026-08-20 *"웹은 화면 분할해서 채팅목록 리스트 띄워두라니깐"*.
  //   [친구목록 | 채팅목록 | 대화창] — 카톡 PC 와 같은 배치다.
  //   ★내가 앞서 두 칸([친구목록 | 대화창])으로 만든 게 틀렸다.
  //     그러면 **채팅목록을 볼 자리가 아예 없어서**, 나눈 대화가 어디 있는지 알 수 없다.
  //     (Boss 가 세 번 말한 뒤에야 맞췄다 — '탭'이 아니라 '칸'이라는 말을 내가 계속 탭으로 읽었다.)
  //   ⚠️아주 좁은 웹(900~1200)에서는 세 칸이 각각 답답하므로 채팅목록을 접는다.
  if (wide) {
    return (
      <View style={styles.two}>
        <View style={[styles.pane, { paddingTop: renderTop ? 0 : insets.top }]}>
          {renderTop}
          <TalkList items={list} onOpen={open} selected={cur?.id} myName={myName} onMe={() => router.push('/charts')} />
        </View>
        {showChatPane && (
          <View style={[styles.pane, { paddingTop: insets.top }]}>
            <ChatList reloadKey={chatsTick} selectedId={cur?.id}
                      onOpen={(id) => { const c = list.find((x) => x.id === id); if (c) open(c); }} />
          </View>
        )}
        <View style={styles.main}>
          {cur ? (
            <>
              <View style={styles.head}><Text style={styles.headTx}>{cur.name}</Text></View>
              <TalkThread items={items} busy={busy} onLink={(r) => router.push(r as never)} />
              {composer}
            </>
          ) : (
            <View style={styles.empty}>
              {/* ★탭마다 다른 말 — 대화 탭에서 "상담사를 골라 주세요"는 틀린 안내다(고를 목록이 대화다) */}
              <Text style={styles.emptyTx}>
                {mode === 'chats'
                  ? t('talk.pickChat', '왼쪽에서 대화를 골라 주세요')
                  : t('talk.pickOne', '왼쪽에서 상담사를 골라 주세요')}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── 폰 = 목록 → 대화 ─────────────────────────────────────────────
  if (!cur) return (
    // ★상단 인셋 — Stack 헤더를 껐으므로(4탭 전환) 화면이 직접 준다.
    //   `renderTop`(브랜드 헤더)이 있으면 그쪽이 이미 인셋을 갖고 있어 0으로 둔다 — 두 번 주면 헤더가 뜬다.
    <View style={[styles.one, { paddingTop: renderTop ? 0 : insets.top }]}>
      {renderTop}
      {leftPane}
    </View>
  );
  return (
    <View style={styles.one}>
      <View style={[styles.head, { paddingTop: insets.top + space(3) }]}>
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
  // 왼쪽 목록 — 폭 고정(내용에 따라 흔들리면 눈이 피곤하다).
  //   300 → 264 (Boss *"가로 길이가 너무 길어"*) → **282**.
  //   ⚠️264 는 '아바타+이름'만 있을 때의 최소폭이었다. 그 뒤 **즐겨찾기 별이 들어오면서**
  //     이름 자리가 24px 줄어 「나는 어떤 사람인가」가 잘렸다(실물에서 확인).
  //   ⇒ 별 폭만큼 되돌린 282 다. 300 보다는 짧고, 가장 긴 이름이 한 줄에 들어간다.
  //     ★잘린 이름은 목록으로서 쓸모가 없다 — 폭을 줄이는 것보다 이름이 보이는 게 먼저다.
  pane: { width: 282, borderRightWidth: 1, borderRightColor: colors.line },
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

/** `/talk` 라우트 — 시작 화면과 **같은 화면**이다(딥링크 호환용으로 남겨 둔다). */
export default function TalkScreen() {
  return <TalkHome />;
}
