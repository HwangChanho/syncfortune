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
import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { View, Text, StyleSheet, TextInput, Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { TalkList } from '../../components/talk/TalkList';
import { ChatList } from '../../components/talk/ChatList';
import { TalkThread, type TalkItem } from '../../components/talk/TalkThread';
import { TalkNotes } from '../../components/talk/TalkNotes';                 // 대화 정리 줄(Boss 2026-08-23)
import { listNotes, type TalkNote } from '../../lib/talk/talkNotes';
import { listConsultants, consultantsSnapshot, type Consultant } from '../../lib/talk/consultants';
import { greet, todayFlow, guide, type VirtualReply } from '../../lib/talk/virtualTalk';
import { askLive, loadThread, deleteThread } from '../../lib/talk/liveTalk';
import { Alert } from '../../lib/ui/alert';   // 커스텀 알림 — 운 부족 시 충전 유도
import { SECTIONS } from '../../lib/content/contentSections'; // 대화 중 콘텐츠 안내 — 키 → 라벨·라우트(목록의 단일 출처)
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/core/withTimeout';
import { loadRepChart, listCharts, type SavedChart } from '../../lib/engine/myChart';
// ★@명식 부르기(Boss 2026-08-26) — 부른 사람의 **원국·판정**을 같이 보낸다
import { parseMentions, buildMentionBlocks, MAX_MENTIONS, type MentionTarget } from '../../lib/talk/chartMention';
import ChartMentionSheet from '../../components/talk/ChartMentionSheet';
// ★프로필 창은 **화면 루트**에서 그린다 — 칸(pane) 안에서 그리면 창이 갇히고,
//   RN Modal 로 그리면 iOS 에서 배경 영상이 안 뜬다([[overlay-absolutefill-parent]])
import { ProfileSheet, type ProfileTarget } from '../../components/talk/ProfileSheet';
// ★반말/존댓말 판정은 **한 곳에서만**(Boss 2026-08-26) — 인사와 서버가 갈리면 안 된다
import { ageFromBirth, isCasual } from '../../lib/talk/speechLevel';
// ★대화 안에서 명식 만들기(Boss 2026-08-26) — 등록 화면에 안 가고도 만들 수 있어야 한다
import { parseBirth, looksLikeBirthInfo, type BirthDraft } from '../../lib/talk/birthParse';
import { BirthDraftCard, type BirthCardResult } from '../../components/talk/BirthDraftCard';
import { addChart, setRepresentative } from '../../lib/engine/myChart';
import { loadMyProfile, subscribeProfile, profileSnapshot } from '../../lib/talk/myProfile';
import { listFriends, type Friend } from '../../lib/talk/friends';
import { useHomeOrder } from '../../lib/ui/homeOrder';
import { ensureServerChartIdForSaved } from '../../lib/backend/prewarmReadings';
import { useAuth } from '../../lib/useAuth';
import { computeChart } from '../../lib/engine/engine';
import { useWideWeb } from '../../components/WebShell';
import { renderTalkBlock } from '../../components/talk/blockRegistry';
import { getNavBarHeight } from '../../components/BottomNav';
import { colors, space, radius, font } from '../../lib/theme';
import { Icon } from '../../components/kit/Icon';   // 상단 아이콘 단일 원본(Boss 2026-08-24)
import { ConsultantLinkCard } from '../../components/talk/ConsultantLinkCard';   // 상담가 본인 채널(Boss 2026-08-25)
import { buildChartVerdict } from '../../lib/talk/chartVerdict';   // 우리 엔진 판정을 대화에 싣는다(Boss 2026-08-25)
import { splitBubbles, typingDelay } from '../../lib/talk/splitBubbles';   // 말풍선 쪼개기·뜸(Boss 08-25)
import { greetingFor } from '../../lib/talk/greetingFor';   // 상담가별 첫 인사(Boss 08-26)
import { CoinNotice } from '../../components/talk/CoinNotice';
import InviteSheet from '../../components/talk/InviteSheet';   // 다인방 초대(Boss 2026-08-25)
import { openGroupRoom, roomTitle, memberCount } from '../../lib/talk/groupTalk';   // 운 안내 = 상단 띠(Boss 08-25)
import { pendingMonthlyBrief, markBriefSeen } from '../../lib/talk/monthlyBrief';   // 노쌤 월간 공지(Boss 2026-08-25)
import { FortuneVideoCard } from '../../components/FortuneVideoCard';

/**
 * 삭제 확인 줄.
 * ★모달·Alert 대신 **화면 안 한 줄**이다 — 웹에서 `Alert` 가 안 뜨거나 이중 발화한 이력이 있고,
 *   되돌릴 수 없는 일은 눌린 자리 바로 아래에서 확인받는 편이 오해가 적다.
 */
function DeleteBar({ onOk, onCancel, t }: { onOk: () => void; onCancel: () => void; t: (k: string, d?: string) => string }) {
  return (
    <View style={styles.delBar}>
      <Text style={styles.delTx}>{t('talk.delAsk', '이 대화를 지울까요? 되돌릴 수 없어요.')}</Text>
      <PressableScale style={styles.delNo} onPress={onCancel}>
        <Text style={styles.delNoTx}>{t('common.cancel', '취소')}</Text>
      </PressableScale>
      <PressableScale style={styles.delYes} onPress={onOk}>
        <Text style={styles.delYesTx}>{t('talk.delOk', '지우기')}</Text>
      </PressableScale>
    </View>
  );
}

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
 * @param renderTop    목록 **위**에 얹을 것(브랜드 헤더·풀이 진행률 배너).
 *   ⚠️여기 큰 것을 넣으면 목록이 화면 밖으로 밀린다 — 웹 랜딩을 여기 뒀다가 친구목록이
 *     안 보였다(Boss 2026-08-24). 큰 설명은 `renderBottom` 으로.
 * @param renderBottom 목록 **맨 아래**에 붙일 것. 목록과 같이 스크롤된다.
 *   ★대화 상세로 들어가면 **띄우지 않는다** — 카톡도 대화에 들어가면 상단이 상대 이름으로 바뀐다.
 *     헤더가 두 겹으로 남으면 '어디에 있는지'가 흐려진다.
 * @param mode 왼쪽 칸에 무엇을 둘까 — `contacts`(친구목록) / `chats`(대화 목록).
 *   ★두 탭이 **같은 껍데기**를 쓴다(Boss 2026-08-20 *"친구목록이랑 채팅 탭이 좌우로 공간을 나눠서"*).
 *     대화창·입력바·2칸 배치를 탭마다 만들면 언젠가 다르게 동작한다.
 */
export function TalkHome({ renderTop, renderBottom, mode = 'contacts' }: { renderTop?: ReactNode; renderBottom?: ReactNode; mode?: 'contacts' | 'chats' }) {
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

  const [dateKey] = useState(() => new Date().toDateString());
  const [servers, setServers] = useState<Consultant[]>(consultantsSnapshot());   // 서버 목록(= 그대로 친구목록)
  // ★다인방(Boss 2026-08-25 *"다른 사람을 초대할수 있어야해"*).
  //   `mates` = 지금 방에 **같이 있는 상담가들**. 비면 1:1 방이다.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [mates, setMates] = useState<Consultant[]>([]);
  // ── @명식 부르기(Boss 2026-08-26 *"@누구 이런식으로 불러올수 있으면"*) ─────────────
  //   ★저장된 명식은 **온디바이스**다(ADR-005). 서버에 없는 사람도 부를 수 있어야 한다.
  const [myCharts, setMyCharts] = useState<SavedChart[]>([]);
  // ★회원 만 나이 — 상담가 나이보다 어리면 **기본 반말**(Boss 2026-08-26).
  //   ⚠️명식이 없으면 null → 존댓말. 모르면 안전한 쪽이다.
  const [myAge, setMyAge] = useState<number | null>(null);
  // ★명식이 **아예 없는가** — 없을 때만 «명식 만들기» 카드를 띄운다(있는데 띄우면 잔소리다)
  const [hasChart, setHasChart] = useState<boolean | null>(null);
  /**
   * 대화에서 모아 온 생년월일 조각.
   * ★여러 턴에 걸쳐 **합친다** — "1994 03 16" 하고 다음 턴에 "양력 남자 서울" 이라고 해도 모여야 한다.
   * ⚠️여기서 여덟 글자를 세지 않는다. 세는 건 엔진이다(절대규칙 1).
   */
  const [birthDraft, setBirthDraft] = useState<BirthDraft | null>(null);
  const [makingChart, setMakingChart] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  // ★프로필 창 — 목록 컴포넌트가 아니라 **여기**가 갖는다(위 import 주석)
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  /**
   * 친구목록 = **사람 다섯**(Boss 2026-08-20 압축).
   * ★종전엔 홈 블록 아홉이 그대로 '친구'로 올라가 열다섯이었다 —
   *   카톡 목록에 「오늘의 운세」가 사람처럼 앉아 있어 사람과 기능이 섞여 보였다.
   * ★블록은 **없앤 게 아니라 사람 아래로 묶었다**(`c.blocks`) —
   *   그냥 뺐으면 오늘의 운세·관계 지도가 도달 불가가 된다.
   */
  const [cur, setCur] = useState<Consultant | null>(null);
  const [items, setItems] = useState<TalkItem[]>([]);
  const [saju, setSaju] = useState<any>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);   // 친구목록 상단 '나'
  const [myAvatar, setMyAvatar] = useState<string | null>(profileSnapshot().avatarUrl);
  // ── 대화 정리(Boss 2026-08-23) ───────────────────────────────────────────
  const [notes, setNotes] = useState<TalkNote[]>([]);
  // ★기본은 접힘. 한 번 펴 본 사람에게는 그대로 펴진 채로 둔다(앱을 켜 둔 동안).
  const [notesOpen, setNotesOpen] = useState(false);
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  /** 이 방의 정리를 다시 읽는다. 세션이 없으면 비운다(정리 줄이 안 뜬다). */
  const refreshNotes = useCallback((sessionId: string | null | undefined) => {
    if (!sessionId) { setNotes([]); return; }
    void listNotes(sessionId).then(setNotes);
  }, []);
  const [friends, setFriends] = useState<Friend[]>([]);   // 실제 사람 친구(상담가와 다른 섹션)
  const { order } = useHomeOrder();     // 콘텐츠 레일 = **홈 순서 그대로**(운영자가 정한 것을 따른다)
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);        // 실제 상담사가 답을 만드는 중(점 세 개)
  // ★운 안내는 **말풍선이 아니라 상단 띠**로 뜬다(Boss 2026-08-25).
  //   상담가가 한 말과 앱이 한 말이 섞이면 과금 안내가 상담 내용처럼 읽힌다.
  const [notice, setNotice] = useState<{ kind: 'info' | 'need'; text: string; action?: string } | null>(null);
  // ⚠️방을 옮기면 지운다 — 다른 상담가 화면에 앞 방의 «운이 모자라요» 가 남아 있으면 안 된다
  // 채팅목록(오른쪽 칸)을 다시 읽게 하는 신호 — 답이 오거나 읽음 처리했을 때 올린다.
  //   ★웹은 목록과 대화창이 **동시에 보이므로**, 답이 왔는데 목록이 그대로면 화면이 자기모순이 된다.
  const [chatsTick, setChatsTick] = useState(0);

  /**
   * ★마지막 대화 시각 — 콘티 1면은 친구 줄 오른쪽에 시각을 적는다(「오후 8:21」·「방금 전」).
   *   `talk_session_list` 는 **운대화 탭이 이미 쓰는 뷰**라 새 질의를 만들지 않았다.
   *   ⚠️비로그인이면 빈 표다 — 그때는 시각이 안 뜨는 게 맞다(지어내지 않는다).
   */
  const [lastAts, setLastAts] = useState<Record<string, string>>({});
  const [unreads, setUnreads] = useState<Record<string, number>>({});   // 콘티 1면의 보라 배지
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!session) { setLastAts({}); setUnreads({}); return; }
      const r = await withTimeout(
        supabase.from('talk_session_list').select('consultant_id, last_at, unread').limit(50), 8000);
      if (!alive || !r || r.error || !Array.isArray(r.data)) return;
      const m: Record<string, string> = {};
      const u: Record<string, number> = {};
      for (const row of r.data as any[]) {
        // ★같은 상담가 세션이 여럿이면 **가장 최근**을 남긴다. 안 읽은 수는 **합친다**.
        const id = String(row.consultant_id), at = String(row.last_at);
        if (!m[id] || at > m[id]) m[id] = at;
        u[id] = (u[id] ?? 0) + (Number(row.unread) || 0);
      }
      setLastAts(m); setUnreads(u);
    })();
    return () => { alive = false; };
  }, [session, chatsTick]);

  const list = useMemo(
    () => servers.map((c) => ({ ...c, lastAt: lastAts[c.id] ?? null, unread: unreads[c.id] ?? 0 })),
    [servers, lastAts, unreads],
  );



  // 대화 삭제 확인 — ★`Alert` 를 쓰지 않는다(웹에서 안 뜨거나 이중 발화한 이력이 있다).
  //   화면 안에 확인 줄을 띄우는 편이 웹·폰 어디서나 확실하다.
  const [askDelete, setAskDelete] = useState(false);
  const bumpChats = useCallback(() => setChatsTick((n) => n + 1), []);

  // 순차 표시 타이머 — ★상담가를 바꾸면 **이전 대기를 취소**한다.
  //   안 그러면 A 의 인사가 B 의 대화창에 뒤늦게 떨어진다.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /**
   * ★**방 세대(generation)** — 방이 갈아엎어질 때마다 1 올린다(지우기 · 다른 상담가로 이동).
   *
   * 왜 필요한가: `askLive` 는 몇 초씩 걸린다. 그 사이에 대화를 지우거나 다른 방으로 옮기면
   * **응답은 그대로 도착해** 새 화면에 말풍선을 붙인다 — 지운 대화의 답이 인사말 밑에 뜬다.
   * 보내기 직전 값을 붙들어 두었다가, 돌아왔을 때 값이 달라졌으면 **그 답을 버린다.**
   * (타이머는 `clearTimers` 로 끊을 수 있지만, 이미 날아간 `fetch` 의 `.then` 은 못 끊는다.)
   */
  const genRef = useRef(0);
  /**
   * 입력칸 — **웹에서만** 자동으로 포커스를 준다(Boss 2026-08-25
   *   *"웹은 대화창이 열려있으면 기본적으로 포커스가 텍스트필드로 가있어야해"*).
   *
   * ⚠️★네이티브에서는 하지 않는다 — 방을 열자마자 **키보드가 화면 절반을 덮는다.**
   *   웹은 키보드가 없어 커서만 깜빡이므로 이득만 있고, 폰은 손해가 크다. 그래서 갈랐다.
   */
  const inputRef = useRef<TextInput>(null);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  /**
   * 말풍선들을 **타이핑을 거쳐 하나씩** 띄운다(Boss 2026-08-20).
   *
   * ★인사말도 여기를 지난다 — 열자마자 다 떠 있으면 '미리 써 둔 안내문'이지 대화가 아니다.
   * ★뜸은 **지금 치고 있는 말**의 길이에 비례한다(`typingDelay`) — 0.26~2.2초.
   *   ⚠️종전엔 «직전에 뜬 말» 길이를 썼다. 짧은 말 뒤에 긴 말이 와도 뜸이 짧았다
   *   (Boss 2026-08-25 *"긴 문장은 …이 오래 표시 돼야하고 짧은건 좀 짧게"*).
   *
   * @param parts  띄울 말풍선들(순서대로)
   * @param extra  마지막 말풍선에 얹을 것(그림·링크·블록 카드)
   */
  const sayInOrder = useCallback((parts: TalkItem[], startDelay = 240) => {
    clearTimers();
    if (!parts.length) return;
    let at = startDelay;
    parts.forEach((item, i) => {
      if (i > 0) at += typingDelay(item.body ?? '');   // ★«지금 치는 말» 길이(종전엔 직전에 뜬 말이었다)
      const ms = at;
      const last = i === parts.length - 1;
      timersRef.current.push(setTimeout(() => {
        setItems((prev) => [...prev, item]);
        if (last) setBusy(false);          // 마지막이 뜨면 점 세 개를 끈다
      }, ms));
    });
    setBusy(true);                          // 첫 말풍선이 뜨기 전부터 점이 보인다
  }, [clearTimers]);

  // 화면을 떠나면 대기 중인 타이머를 정리한다(끝난 화면에 말풍선이 떨어지지 않게)
  useEffect(() => clearTimers, [clearTimers]);
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
  // 이 대화에서 이미 쓴 그림 — ★같은 그림을 반복하면 '자동으로 붙는 장식'처럼 보인다
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
  // ★설정에서 정한 이름·사진이 **명식 이름을 이긴다**(사용자가 직접 고른 값이 우선).
  useEffect(() => {
    const sync = () => {
      const p = profileSnapshot();
      if (p.name) setMyName(p.name);
      setMyAvatar(p.avatarUrl);
    };
    void loadMyProfile().then(sync);
    return subscribeProfile(sync);
  }, []);
  // 사람 친구 — ★화면에 들어올 때마다 다시 읽는다(신청을 수락하고 돌아오면 바로 보여야 한다)
  useFocusEffect(useCallback(() => { void listFriends().then(setFriends); }, []));
  // 명식 목록 — ★화면에 들어올 때마다 다시 읽는다(방금 등록하고 돌아오면 **바로** 부를 수 있어야 한다)
  useFocusEffect(useCallback(() => { void listCharts().then(setMyCharts); }, []));
  // 명식은 한 번만 계산해 둔다 — 가상 답이 매번 엔진을 다시 돌릴 이유가 없다
  useEffect(() => {
    let alive = true;
    void loadRepChart().then(async (c) => {
      if (!alive) return;
      setHasChart(!!c?.input);
      if (!c?.input) return;
      setMyName(c.label ?? null);
      // ★생년월일은 **여기 밖으로 안 나간다** — 나이(정수)만 뽑아 서버로 보낸다(ADR-005)
      setMyAge(ageFromBirth(c.input?.birthDateTime));
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
    // ⚠️먼저 비운다 — 안 비우면 **직전 방의 정리**가 잠깐 보인다
    //   ★운 안내 띠도 같이 지운다 — 앞 방의 「운이 모자라요」가 다른 상담가 화면에 남으면 안 된다
    setNotes([]); setJumpTo(null); setNotice(null);
    genRef.current++;   // ★직전 방에 보낸 답이 도착해도 이 방에 붙지 않게(위 `genRef` 주석)
    refreshNotes(sessRef.current[c.id]);
    // ★대화를 열면 **읽음 처리**한다 — 안 그러면 배지가 영원히 남는다.
    //   시각은 서버가 `now()` 로 찍는다(앱이 값을 보내면 미래 시각으로 배지를 지울 수 있다).
    //   실패해도 대화는 열린다(배지가 한 번 더 뜰 뿐이다).
    const sid = sessRef.current[c.id];
    if (sid) void markRead(sid);
    // 이 상담가가 담당하는 홈 블록 카드 — ★말풍선으로 옮겨 적지 않고 **원래 컴포넌트**를 띄운다
    //   (옮겨 적는 순간 홈과 갈린다). 없으면 빈 배열이라 아무 일도 안 일어난다.
    const blockCards = (c.blocks ?? []).map((k) => ({
      id: nextId(), role: 'assistant' as const, body: '',
      node: renderTalkBlock(k as never, { reloadKey: 0, dateKey, repName: myName }),
    })).filter((b) => !!b.node);

    const gen = genRef.current;   // 이 방의 세대 — 비동기 공지가 늦게 와도 **엉뚱한 방에 안 붙게**
    // ★이달의 총 흐름 — 노쌤이 **한 달에 한 번** 보내는 공지(Boss 2026-08-25
    //   *"일간별운세 전에 총 운흐름내용 정리해서 «여러분의 운은 어떻게 될까요» 이런식으로"*).
    //   ⇒ 총평은 **공통**, 그다음이 **개인 운세**. 방송을 보고 내 것을 확인하는 결이다.
    //   ⚠️보낸 사람이 있는 상담가(`link_url` = 실존 상담가)에게만 붙인다 — 아무나 공지를 보내면
    //     «누가 말한 것인지»가 흐려진다. 지금은 노쌤뿐이다.
    void (async () => {
      if (!c.linkUrl) return;
      const brief = await pendingMonthlyBrief();
      if (!brief || gen !== genRef.current) return;       // 그 사이 방을 옮겼으면 버린다
      await markBriefSeen(brief.periodKey);               // ★한 달에 한 번 — 봤으면 다시 안 띄운다
      sayInOrder([
        { id: nextId(), role: 'assistant', body: brief.body },
        // ★영상은 **있으면 붙고 없으면 안 그린다** — 카드가 스스로 그 달을 찾는다(표가 정본).
        { id: nextId(), role: 'assistant' as const, body: '',
          node: <FortuneVideoCard periodKey={brief.periodKey} title="이달의 운세 영상" /> },
        { id: nextId(), role: 'assistant', body: t('talk.briefTail', '여러분의 운은 어떻게 될까요? 회원님 명식으로 보면 이번 달이 어떤 달인지 알 수 있어요.') },
      ], 700);
    })();

    // ★상담가 본인 채널 — **첫 인사 뒤에 한 번만**(Boss 2026-08-25).
    //   목적은 광고가 아니라 *"실제 상담가가 만드는 서비스"* 라는 **신뢰 신호**다.
    //   ⚠️매 턴 띄우면 그 순간 광고가 되고 신뢰는 반대로 깎인다 — 인사 경로에만 붙인다
    //     (인사는 **이력이 없을 때만** 나오므로 자연히 드물다).
    const linkCard = c.linkUrl
      ? [{ id: nextId(), role: 'assistant' as const, body: '',
           node: <ConsultantLinkCard name={c.name} url={c.linkUrl} label={c.linkLabel} /> }]
      : [];

    if (c.kind === 'virtual') {
      // ★인사도 **타이핑을 거쳐** 나온다. 블록 카드는 말이 끝난 뒤에 건넨다.
      setItems([]);
      sayInOrder([...toItems(greet(c.name, c.tagline, c.routes, t as never)), ...blockCards, ...linkCard]);
    } else {
      // 실제 상담사도 **첫 인사만은 공짜다** — 화면을 여는 것만으로 API 를 태우지 않는다.
      const greet = {
        id: nextId(), role: 'assistant' as const,
        // ★상담가마다 다른 인사(Boss 2026-08-26 *"각 테마에 맞게 가벼운 멘트"*).
        //   종전엔 열두 명이 **똑같은 한 줄**이었다. 말투 예시의 결을 그대로 옮겼다.
        // ★반말이면 인사도 반말이어야 한다 — 인사만 존댓말이면 다음 말과 어긋난다
        body: greetingFor(c.id, c.name, c.tagline, isCasual(c.age, myAge)),
      };
      setItems([]);
      // ★인사도 **쪼개서** 띄운다 — 한 덩어리로 뜨면 «미리 써 둔 안내문»이지 대화가 아니다
      const greetParts = splitBubbles(greet.body).map((b) => ({ ...greet, id: nextId(), body: b }));
      sayInOrder([...greetParts, ...blockCards, ...linkCard]);   // ★채널 카드는 인사에만(위 주석)
      // ★지난 대화를 **이어 붙인다**(2026-08-20) — 세션 id 를 메모리에만 두면
      //   새로고침·앱 재시작마다 새 방이 생긴다(실제로 노쎔 대화가 셋으로 쪼개졌다).
      //   카톡은 껐다 켜도 같은 방이다. 인사는 **이력이 없을 때만** 남긴다.
      void loadThread(c.id).then((th) => {
        if (!th) return;
        sessRef.current[c.id] = th.sessionId;
        refreshNotes(th.sessionId);        // 방을 열면 정리도 같이 읽는다
        if (th.messages.length) {
          clearTimers();          // ★지난 대화를 복원할 때는 인사 타이핑을 멈춘다(이력이 먼저다)
          setBusy(false);
          // ★복원된 이력에도 같은 규칙으로 그림을 붙인다 — 결정론이라 **처음과 같은 그림**이 나온다
          //   (모델에게 고르게 했다면 다시 열 때마다 달라졌을 것이다).
          setItems(th.messages.map((m) => {
            // ★대화 중 그림을 넣지 않는다(Boss 2026-08-25 *"대화 끝날때마다 나오는 이미지는 필요없어"*).
            //   말끝마다 그림이 붙으면 대화가 아니라 «카드 묶음» 으로 읽힌다.
            //   ⚠️`talkImagery` 는 지우지 않았다 — 다시 켤 일이 있으면 여기 한 줄이다.
            // ★msgId 를 싣는다 — 정리에서 원문으로 데려갈 때 이 값으로 찾는다
            return { id: nextId(), msgId: m.id, role: m.role, body: m.body };
          }));
          void markRead(th.sessionId);
        }
      });
    }
    // ⚠️`myAge` 를 빼면 **인사만 존댓말로 굳는다** — 나이는 대표 명식을 읽은 뒤에 들어오는데,
    //   그 전에 만들어진 `open` 이 계속 쓰이면 반말 판정이 영원히 null(=존댓말)이다.
  }, [t, dateKey, myName, bumpChats, myAge]);

  /** `@` 뒤에 올 수 있는 이름들 — 저장된 명식이 곧 후보다. */
  const mentionTargets = useMemo<MentionTarget[]>(
    () => myCharts.map((c) => ({ id: c.id, name: c.label, relation: c.relation })),
    [myCharts],
  );

  /**
   * 본문에서 부른 사람들 → **모델이 읽을 재료**(원국·판정).
   *
   * ⚠️생년월일·출생지는 **안 나간다** — 구조만 보낸다(ADR-005 · `chartMention.ts` 머리말).
   * ★계산이 안 되는 명식 하나 때문에 대화를 막지 않는다 — 그 사람만 빼고 나머지는 간다.
   * @param q 사용자가 쓴 문장
   */
  const buildMentions = useCallback((q: string): string[] => {
    const people: { name: string; relation: string; saju: any }[] = [];
    for (const m of parseMentions(q, mentionTargets)) {
      const c = myCharts.find((x) => x.id === m.id);
      if (!c?.input) continue;
      try { people.push({ name: m.name, relation: m.relation, saju: computeChart(c.input).saju }); }
      catch { /* 이 한 명이 안 되어도 나머지는 보낸다 */ }
    }
    return buildMentionBlocks(people);
  }, [myCharts, mentionTargets]);

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

    // ★생년월일을 말했는데 **명식이 없다** — 조각을 모아 카드를 띄운다(Boss 2026-08-26).
    //   ⚠️모델에게 계산시키지 않는다. 카드가 받은 값을 **엔진**에 넘긴다.
    if (hasChart === false && (looksLikeBirthInfo(q) || birthDraft)) {
      const got = parseBirth(q);
      // 이미 모은 것 위에 **채워진 칸만** 덮는다 — 다음 턴에 말한 것도 합쳐진다
      const merged: BirthDraft = {
        date: got.date ?? birthDraft?.date ?? null,
        time: got.time ?? birthDraft?.time ?? null,
        timeAccuracy: got.timeAccuracy ?? birthDraft?.timeAccuracy ?? null,
        calendar: got.calendar ?? birthDraft?.calendar ?? null,
        sex: got.sex ?? birthDraft?.sex ?? null,
        place: got.place ?? birthDraft?.place ?? null,
      };
      if (merged.date) setBirthDraft(merged);
    }

    if (cur.kind === 'virtual') {
      // 아주 단순한 갈래 — '오늘/흐름'을 물으면 결정론 문구, 아니면 콘텐츠 안내.
      //   ⚠️여기서 의도를 정교하게 알아내려 들지 않는다. 그건 LLM 이 할 일이고,
      //     가상의 몫은 **빠르고 공짜로 데려다주는 것**이다.
      const wantsFlow = /오늘|흐름|운세|이달|today/i.test(q) && !!saju;
      const r = wantsFlow ? todayFlow(saju, t as never) : guide(cur.routes, t as never);
      sayInOrder(toItems(r));     // ★가상 상담가도 사람처럼 하나씩 친다
      return;
    }

    // ── 실제 상담사 ────────────────────────────────────────────────────
    setBusy(true);
    const gen = genRef.current;   // ★이 답이 어느 방 것인지 붙들어 둔다(위 `genRef` 주석)
    fireRef.current(q, 0, gen);
    // ⚠️`hasChart`·`birthDraft` 를 빼면 조각이 안 쌓인다(첫 턴 것만 남는다)
  }, [draft, cur, saju, busy, t, hasChart, birthDraft]);

  /**
   * 실제 상담사에게 한 번 보낸다. **자동 재시도가 같은 경로를 타도록** 따로 뺐다.
   *
   * @param q       질문 / @param attempt 회차(0=첫 시도) / @param gen 보낼 때의 방 세대
   */
  const fire = useCallback((q: string, attempt: number, gen: number) => {
    if (!cur) return;
    // ★판정은 **보낼 때 만든다** — 명식이 바뀌면 다음 턴부터 바로 반영된다
    void askLive(cur.id, q, sessRef.current[cur.id] ?? null, chartId, i18n.language, attempt,
                 saju ? buildChartVerdict(saju) : null,
                 // ★@이름으로 부른 사람들 — **이 턴에만** 실린다(캐시 접두사를 건드리지 않는다)
                 buildMentions(q),
                 // ★반말 판정은 **서버가** 한다(상담가 나이는 서버 값이 정본이다)
                 myAge)
      .then((r) => {
        // 답을 기다리는 동안 대화를 지웠거나 다른 방으로 옮겼다 — **버린다.**
        //   ⚠️`setBusy(false)` 도 하지 않는다. 지금 점이 돌고 있다면 그건 **새 방의 것**이다.
        if (gen !== genRef.current) return;
        if (r.ok) {
          sessRef.current[cur.id] = r.sessionId;   // 다음 턴부터 이력이 이어진다
          // ★이번 턴에 남긴 게 있을 때만 다시 읽는다 — 매 턴 조회하면 헛돈다
          if (r.notes?.length) refreshNotes(r.sessionId);
          // 방금 내가 읽은 답이므로 읽음 처리 + 목록 갱신(미리보기·시각이 바로 반영된다)
          void markRead(r.sessionId);
          // ★★말풍선을 **나눠서 순차로** 띄운다(Boss 2026-08-20 *"채팅하듯이 짧게 짧게"*).
          //   ★쪼개는 규칙은 `splitBubbles` 단일 원본이다(Boss 2026-08-25 «대화하듯이 짧게 끊어야해»).
          //   종전엔 여기서 «빈 줄 + 마침표» 만 봤는데, 한국어 대화체는 마침표 없이 «~죠» 로
          //   끝나는 일이 잦아 문장 열 개가 한 풍선이 되곤 했다.
          const parts = splitBubbles(r.answer);
          // ★대화 중 콘텐츠 안내(Boss 2026-08-23) — 서버가 답에서 마커를 떼어 `recommend` 로 준다.
          //   키 → 라벨·라우트는 **`contentSections`(목록의 단일 출처)** 에서 찾는다.
          //   ⚠️목록에 없는 키면 카드를 만들지 않는다(빈 화면으로 보내지 않는다).
          const reco = r.recommend
            ? SECTIONS.flatMap((sec) => sec.items).find((it) => it.key === r.recommend && it.ready)
            : undefined;
          const recoLinks = reco ? [{ key: reco.key, label: t(reco.labelKey), route: reco.route }] : undefined;
          // ★다인방이면 답 앞에 **누가 말했는지**를 단다 — 여럿이면 이름 없이는 누가 한 말인지 모른다.
          //   ⚠️새 필드를 만들지 않는다 — `who` 가 이미 이름·사진을 그린다(사본을 만들면 갈라진다).
          const whoOf = (nm?: string | null) => {
            if (!nm || !mates.length) return undefined;
            const f = [cur, ...mates].find((x) => x.name === nm);
            return f ? { name: f.name, avatar: f.avatar, element: undefined } : { name: nm };
          };
          sayInOrder(parts.map((body, i) => ({
            id: nextId(), role: 'assistant' as const, body, who: whoOf(r.speakerName),
            // 안내 카드도 마지막 풍선에 — 말이 끝난 뒤 건네는 순서다(가상 상담사와 같은 관용)
            links: i === parts.length - 1 ? recoLinks : undefined,
          })), 0);                 // 서버 응답을 기다린 뒤라 추가 뜸은 필요 없다
          // ★곁다리 한 마디(Boss 2026-08-26) — 옆 사람이 툭 던진다.
          //   ⚠️답이 **다 뜬 뒤**에 붙인다. 같이 넣으면 순차 표시를 앞질러 답보다 먼저 뜬다.
          //   ★운은 더 안 나간다 — 같은 호출에 얹혀 온 것이라 이미 계상됐다(서버 주석 참조).
          if (r.banter) {
            const after = parts.reduce((a, b) => a + typingDelay(b), 0) + 300;
            timersRef.current.push(setTimeout(() => {
              sayInOrder([{ id: nextId(), role: 'assistant' as const,
                body: r.banter!.line, who: whoOf(r.banter!.name) }], 0);
            }, after));
          }
          // ★★운 차감 «영수증» 한 줄 (Boss 2026-08-26
          //   *"운이 차감될때마다 말풍선없이 가운데 정렬로 작은 글씨로 얼마의 운이 차감됐는지"*).
          //
          //   ■ ★서버가 준 `spent` 만 쓴다 — 앱이 계산하지 않는다
          //     단가는 `consultants.coin_cost` 가 정한다. 앱이 «2운이겠지» 하고 적으면
          //     운영자가 단가를 바꾼 순간 **화면과 실제 차감이 갈린다**. 그건 돈 문제다.
          //     [[pay-alert-must-show-numbers]] — 가격을 문구에 박지 말 것.
          //   ■ 0이면 안 띄운다 — 무료 구간에서는 **아무것도 안 빠졌다**(«0운 사용» 은 거짓말이다).
          //   ■ ⚠️답이 **다 뜬 뒤**에 붙인다(곁다리와 같은 이유) — 같이 넣으면 순차 표시를
          //     앞질러 영수증이 답보다 먼저 뜬다.
          //   ⚠️옛 서버는 `spent` 를 안 줄 수 있다 — 없으면 0(=안 띄움)으로 떨어진다
          const spent = Number(r.spent ?? 0);
          if (spent > 0) {
            const wait = parts.reduce((a, b) => a + typingDelay(b), 0) + (r.banter ? 900 : 0) + 420;
            timersRef.current.push(setTimeout(() => {
              setItems((prev) => [...prev, {
                id: nextId(), role: 'assistant' as const, body: '',
                system: t('talk.spent', '{{n}}운 사용').replace('{{n}}', String(spent)),
              }]);
            }, wait));
          }
          // ⚠️무료 소진 안내는 **답이 다 뜬 뒤**에 붙인다 — 바로 넣으면 순차 표시를 앞질러
          //   답보다 먼저 뜬다. 마지막 풍선의 예상 시각 뒤로 미룬다.
          // ★무료 소진 — 상단 띠로 알린다(종전엔 상담가 말풍선이었다).
          //   띠는 자리가 고정이라 답을 앞지르지 않는다 ⇒ 종전의 «마지막 풍선 뒤로 미루는» 계산이 필요 없다.
          if (r.overFree && r.used === r.freeDaily + 1) {
            setNotice({ kind: 'info', text: t('talk.overFree', '오늘 무료로 나눌 이야기는 여기까지예요. 이어서 하시면 운이 쓰여요.') });
          } else if (!r.overFree && typeof r.used === 'number' && typeof r.freeDaily === 'number') {
            // 남은 무료 횟수도 **미리** 알려 준다 — 다 쓰고 나서야 아는 건 늦다
            const left = Math.max(0, r.freeDaily - r.used);
            if (left <= 2) setNotice({ kind: 'info', text: t('talk.freeLeft', '오늘 무료 대화 {{n}}번 남았어요.').replace('{{n}}', String(left)) });
          }
        } else if (r.reason === 'stalled') {
          // ★생성이 막혔다 — **실패로 뭉개지 않는다**(Boss 2026-08-24
          //   *"api 가 멈췄을때 대화는 계속 이어질수있게 … 기다려달라는식"*).
          //   상담가가 사람처럼 한마디 하고, 다시 해 볼 만하면 **실제로 다시 보낸다.**
          //   ⚠️기다리라고 해 놓고 안 보내면 그건 거짓말이라, 문구와 재시도를 **짝으로** 묶는다.
          if (r.retryable) {
            // 점 세 개는 **끄지 않는다** — 아직 진행 중인 게 맞다.
            sayInOrder([{ id: nextId(), role: 'assistant', body: r.message }], 0);
            timersRef.current.push(setTimeout(() => {
              if (gen !== genRef.current) return;   // 그 사이 방이 바뀌었으면 조용히 끝낸다
              fireRef.current(q, attempt + 1, gen);
            }, r.retryAfterMs ?? 2600));
          } else {
            setBusy(false);
            sayInOrder([{ id: nextId(), role: 'assistant', body: r.message }], 0);
          }
        } else if (r.reason === 'unauthorized') {
          // ★비로그인 — **상담가가 사람처럼 권한다**(Boss 2026-08-24
          //   *"비 로그인 회원은 대화해도 인물들이 로그인 유도하게해"*).
          //   종전엔 일반 실패로 뭉개져 회색 안내 한 줄로 끝났다 — 무엇을 하면 되는지 알 수 없었다.
          //   ⚠️말풍선으로만 알리지 않는다. 대화창 안 글씨는 스크롤에 묻힌다(운 부족 안내와 같은 관용).
          setBusy(false);
          sayInOrder([{
            id: nextId(), role: 'assistant',
            body: t('talk.needLoginBubble', '{{name}}이에요. 이야기를 이어가려면 로그인이 필요해요. 회원님 명식을 봐야 제대로 답해 드릴 수 있거든요.')
              .replace('{{name}}', cur.name),
          }], 0);
          Alert.alert(
            t('talk.needLoginTitle', '로그인이 필요해요'),
            t('talk.needLoginMsg', '로그인하면 명식을 저장하고 상담가와 이어서 이야기할 수 있어요.'),
            [
              { text: t('common.later', '나중에'), style: 'cancel' },
              { text: t('auth.login', '로그인'), onPress: () => router.push('/login') },
            ],
          );
        } else if (r.reason === 'needCoins') {
          // ★운 부족 — **충전 유도**(Boss 2026-08-24 *"운 다 떨어지면 충전 유도 해야하고"*).
          //   ⚠️말풍선으로만 알리지 않는다 — 대화창 안의 회색 글씨는 스크롤에 묻힌다.
          //     알림으로 물어보고, 원하면 충전 화면으로 데려간다(다른 유료 콘텐츠와 같은 관용).
          //   ★얼마가 필요하고 얼마가 있는지 **숫자를 말한다** — "부족합니다"만으로는
          //     얼마를 채워야 하는지 알 수 없다([[pay-alert-must-show-numbers]]).
          setBusy(false);
          const have = r.balance == null ? null : r.balance;
          // ★상단 띠로 먼저 알린다 — 말풍선으로 넣으면 상담가가 «돈 얘기» 를 한 것처럼 읽힌다
          setNotice({
            kind: 'need',
            text: have == null
              ? t('talk.needCoinsMsgNoBal', '조금 더 이야기 나누려면 {{cost}}운이 들어요.').replace('{{cost}}', String(r.cost ?? 0))
              : t('talk.needCoinsMsg', '조금 더 이야기 나누려면 {{cost}}운이 들어요. 지금 {{have}}운 있어요.')
                  .replace('{{cost}}', String(r.cost ?? 0)).replace('{{have}}', String(have)),
            action: t('coins.charge', '운 충전하기'),
          });
          Alert.alert(
            t('talk.needCoinsTitle', '운이 조금 모자라요'),
            have == null
              ? t('talk.needCoinsMsgNoBal', '조금 더 이야기 나누려면 {{cost}}운이 들어요.').replace('{{cost}}', String(r.cost ?? 0))
              : t('talk.needCoinsMsg', '조금 더 이야기 나누려면 {{cost}}운이 들어요. 지금 {{have}}운 있어요.')
                  .replace('{{cost}}', String(r.cost ?? 0)).replace('{{have}}', String(have)),
            [
              { text: t('common.later', '나중에'), style: 'cancel' },
              { text: t('coins.charge', '운 충전하기'), onPress: () => router.push('/coins') },
            ],
          );
        } else {
          // ★실패 사유를 그대로 보여 준다(멈춤·한도·오류가 서로 다른 말이어야 한다)
          setBusy(false);
          setItems((prev) => [...prev, { id: nextId(), role: 'assistant', body: r.message }]);
        }
      })
      // ⚠️★여기서 `setBusy(false)` 를 하면 안 된다 — `sayInOrder` 가 방금 켠 타이핑을 즉시 꺼서
      //   말풍선이 하나씩 뜨는 동안 점이 사라진다. **끄는 책임은 `sayInOrder` 의 마지막 풍선**에 있다.
      //   (성공 경로는 거기서, 실패 경로는 위 else 에서 끈다.)
      .catch((e) => {
        if (gen !== genRef.current) return;   // 버린 방의 실패는 새 방에 알리지 않는다
        setBusy(false); console.warn('[talk] send 실패', e);
      });
    // ⚠️`saju`·`buildMentions` 를 빼면 명식을 바꾸고도 **옛 것으로** 보낸다(그리고 조용하다)
  }, [cur, chartId, t, i18n.language, bumpChats, refreshNotes, sayInOrder, saju, buildMentions, myAge]);
  // ★ref 로 붙들어 둔다 — `send` 와 재시도 타이머가 **항상 최신 `fire`** 를 부르게.
  //   (`send` 의 의존성에 `fire` 를 넣으면 매 입력마다 콜백이 새로 만들어진다.)
  const fireRef = useRef(fire);
  useEffect(() => { fireRef.current = fire; }, [fire]);

  // ★블록 친구에겐 입력창을 띄우지 않는다 — 물어봐도 답할 수 없는 입력창은 없느니만 못하다
  /**
   * 폰의 목록 칸 — 탭에 따라 친구목록/대화목록. **여기 한 곳에서만 갈린다.**
   * ★웹은 셋을 동시에 펴므로 이 분기를 쓰지 않는다(폰만 좁아서 갈린다).
   */
  const leftPane = mode === 'chats'
    ? <ChatList selectedId={cur?.id} wide onOpenProfile={setProfile} onSettings={() => router.push('/settings')}
                onOpen={(id) => { const c = list.find((x) => x.id === id); if (c) open(c); }} />
    : <TalkList items={list} onOpen={open} selected={cur?.id} myName={myName} myAvatar={myAvatar} onOpenProfile={setProfile}
                      railKeys={order} onMe={() => router.push('/charts')}
                      onSettings={() => router.push('/settings')}
                      onAddFriend={() => router.push('/friends')}
                      session={session} onLogin={() => router.push('/login')}
                      pendingCount={friends.filter((f) => f.status === 'pending' && !f.requestedByMe).length}
                      people={friends.filter((f) => f.status === 'accepted').map((f) => ({
                        id: f.otherId, name: f.name ?? '이름 없음', avatarUrl: f.avatarUrl, canSee: !!f.chartId,
                      }))}
                      onOpenPerson={(id) => router.push(`/friendcompat?friend=${id}`)}
                      // ★`wide` = **목록 칸이 넓은가**(화면이 넓은가가 아니다).
                      //   폰은 목록이 전체 폭이라 넓고, 웹 3칸의 왼쪽 칸은 264px 이라 좁다.
                      //   ⇒ `useWideWeb()` 의 정확히 반대다 — 헷갈리기 쉬워 적어 둔다.
                      wide={!wide} />;

  /**
   * 이 대화 지우기.
   * ★화면을 **먼저 비우지 않는다** — 서버가 실패하면 "지운 것처럼 보이는데 남아 있는" 상태가 된다.
   *   성공한 뒤에 비운다.
   */
  const onDeleteThread = useCallback(async () => {
    if (!cur) return;
    const r = await deleteThread(cur.id);
    setAskDelete(false);
    if (!r.ok) { console.warn('[talk] 대화 삭제 실패', r.error); return; }
    delete sessRef.current[cur.id];
    // ★정리도 함께 비운다 — DB 행은 세션과 함께 cascade 로 사라지지만(0040), **화면 state 는 남는다.**
    //   안 비우면 지운 대화의 "이 대화 정리 · N" 줄이 상단에 그대로 떠 있다(Boss 2026-08-24 제보).
    //   `notesOpen` 은 건드리지 않는다 — 펴 둔 것은 **사람의 선택**이지 이 방의 상태가 아니다(위 §123).
    //   ★운 안내 띠도 같이 비운다 — 지운 대화의 「운이 모자라요」가 남으면 같은 종류의 흔적이다
    //     (`check:talknotes` ⑦ 이 이 규칙을 **불변식**으로 지킨다 — 새 state 를 넣으면 바로 문다.
    //      실제로 이 띠를 만들자마자 잡혔다.)
    setNotes([]); setJumpTo(null); setNotice(null);
    // ★진행 중이던 것도 멈춘다 — 안 그러면 지운 대화의 흔적이 새 화면에서 계속 움직인다:
    //   `clearTimers` 순차 표시·무료소진 안내 타이머 / `setBusy(false)` 점 세 개 / `genRef` 날아간 응답.
    //   (`open` 이 방을 바꿀 때 하는 것과 같다 — 여기만 빠져 있었다.)
    genRef.current++; clearTimers(); setBusy(false);
    // 인사말만 남긴다 — 빈 화면보다 "다시 시작할 수 있다"가 낫다
    setItems([{ id: nextId(), role: 'assistant',
      body: t('talk.liveGreet', '안녕하세요. {{name}}이에요. 무엇이 궁금하세요?').replace('{{name}}', cur.name) }]);
    bumpChats();
  }, [cur, t, bumpChats, clearTimers]);

  /**
   * 웹에서 대화창이 열려 있으면 커서를 입력칸에 둔다.
   *
   * · 방을 **열거나 바꿀 때** — 바로 칠 수 있게
   * · 답이 **끝났을 때**(`busy` 해제) — 보내고 나면 커서가 풀려 다음 말을 못 이어 친다
   * ⚠️입력칸이 없는 상태(블록 친구·차단)에서는 아무 일도 안 한다.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || !cur || cur.block) return;
    if (busy) return;                       // 답 만드는 중에는 건드리지 않는다(editable=false 다)
    // ⚠️한 틱 미뤄야 한다 — 방을 막 그린 프레임에서는 입력칸이 아직 붙기 전이다
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [cur?.id, cur?.block, busy]);

  const composer = !cur?.block && (cur?.kind === 'virtual' || cur?.kind === 'live') ? (
    <View style={[styles.composer, { paddingBottom: Math.max(space(3), insets.bottom), marginBottom: lift }]}>
      {/* ★명식 부르기 — **실제 상담가에게만** 붙인다.
          가상(오늘의 운세 등)은 LLM 을 안 부르므로 눌러도 아무 일이 없다 = 죽은 버튼이 된다. */}
      {cur?.kind === 'live' ? (
        <PressableScale style={styles.atBtn} hitSlop={6} onPress={() => setMentionOpen(true)}>
          <Text style={styles.atTx}>@</Text>
        </PressableScale>
      ) : null}
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={draft}
        onChangeText={(v) => {
          setDraft(v);
          // ★'@' 를 치면 **바로** 목록을 연다 — 이름을 외워 칠 필요가 없다(Boss «간편하게»).
          //   ⚠️이미 열려 있으면 다시 열지 않는다(웹에서 창이 깜빡인다).
          if (cur?.kind === 'live' && v.endsWith('@') && !mentionOpen) setMentionOpen(true);
        }}
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

  /**
   * 카드가 준 값을 **엔진에** 넘겨 명식을 만든다.
   *
   * ★여기가 «세는» 자리다 — `addChart` 안에서 `computeChart` 가 돈다. 모델은 관여하지 않는다.
   * ★만들고 나면 **대표로 잡고 다시 읽는다** — 그래야 이번 대화부터 바로 그 사주로 답한다.
   */
  const makeChartFromDraft = useCallback(async (r: BirthCardResult) => {
    if (makingChart) return;
    setMakingChart(true);
    try {
      const id = await addChart({ ...r, label: '내 명식', relation: 'self' });
      await setRepresentative(id);
      setBirthDraft(null);
      setHasChart(true);
      const c = await loadRepChart();
      if (c?.input) {
        setMyName(c.label ?? null);
        setMyAge(ageFromBirth(c.input.birthDateTime));
        try { setSaju(computeChart(c.input).saju); } catch { /* 계산이 안 되면 흐름 안내만 빠진다 */ }
        if (session) setChartId(await ensureServerChartIdForSaved(c, session));
      }
      sayInOrder([{ id: nextId(), role: 'assistant' as const,
        body: t('talk.chartMade', '명식을 만들었어요. 이제 이 사주로 봐 드릴게요.') }], 0);
    } catch {
      Alert.alert(t('talk.chartMakeFail', '명식 만들기'),
        t('talk.chartMakeFailBody', '지금은 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
    } finally { setMakingChart(false); }
  }, [makingChart, session, t, sayInOrder]);

  /**
   * 대화에서 모은 생년월일로 만드는 카드. **명식이 없을 때만** 뜬다.
   * ★말풍선이 아니라 카드인 이유: 자유 문장 파싱은 반드시 틀린다 —
   *   읽은 값을 **보여 주고 고칠 수 있게** 해야 엉뚱한 사주로 만들어지지 않는다.
   */
  const birthCard = (hasChart === false && birthDraft?.date) ? (
    <View style={styles.birthCardWrap}>
      <BirthDraftCard draft={birthDraft} onMake={makeChartFromDraft} busy={makingChart} />
    </View>
  ) : null;

  /**
   * 명식 부르기 창.
   * ★`composer` 와 **같이** 만들어 둔다 — 렌더 경로가 둘(넓은 웹 3칸 / 폰)이라
   *   한쪽에만 넣으면 «폰에서는 되는데 웹에서는 안 된다» 가 된다. [[duplicate-ui-single-source]]
   */
  const mentionSheet = mentionOpen ? (
    <ChartMentionSheet
      rows={myCharts.map((c) => ({
        id: c.id, name: c.label, relation: c.relation,
        // ⚠️생일은 **고를 때 구분하려고** 화면에만 쓴다 — 서버로는 안 나간다(ADR-005)
        born: String(c.input?.birthDateTime ?? '').slice(0, 10),
      }))}
      already={parseMentions(draft, mentionTargets).map((m) => m.name)}
      max={MAX_MENTIONS}
      onClose={() => setMentionOpen(false)}
      onRegister={() => { setMentionOpen(false); router.push('/register'); }}
      onPick={(row) => {
        setMentionOpen(false);
        // ★방금 친 '@' 는 지우고 넣는다 — 안 그러면 "@@민수" 가 되고 그러면 못 맞춘다
        setDraft((d) => `${d.replace(/@$/, '')}@${row.name} `);
        // 고르고 나면 계속 쓸 수 있게 입력창으로 돌려준다
        setTimeout(() => inputRef.current?.focus(), 0);
      }}
    />
  ) : null;

  // ── 넓은 웹 = **세 칸** ───────────────────────────────────────────
  //   Boss 2026-08-20 *"웹은 화면 분할해서 채팅목록 리스트 띄워두라니깐"*.
  //   [친구목록 | 채팅목록 | 대화창] — 카톡 PC 와 같은 배치다.
  //   ★내가 앞서 두 칸([친구목록 | 대화창])으로 만든 게 틀렸다.
  //     그러면 **채팅목록을 볼 자리가 아예 없어서**, 나눈 대화가 어디 있는지 알 수 없다.
  //     (Boss 가 세 번 말한 뒤에야 맞췄다 — '탭'이 아니라 '칸'이라는 말을 내가 계속 탭으로 읽었다.)
  //   ⚠️아주 좁은 웹(900~1200)에서는 세 칸이 각각 답답하므로 채팅목록을 접는다.
  // ── ★화면 위에 뜨는 것들은 **여기 한 곳**에서 만든다 ─────────────────────────
  //   ⚠️2026-08-26 Boss *"채팅창 상단에 ＋ 버튼눌러도 아무 반응이 없어 웹기준이야"*
  //     원인: 이 화면은 **두 갈래로 return** 한다(넓은 웹 3칸 / 폰 1칸). 그런데 `InviteSheet` 가
  //     **폰 갈래에만** 있었다 → 넓은 웹에서 ＋ 를 누르면 `inviteOpen` 은 true 가 되는데
  //     **그릴 곳이 없어** 아무 일도 안 일어난다. 오류도 안 난다(그래서 «무반응» 으로만 보인다).
  //   ★`ProfileSheet` 도 같은 실수를 한 적이 있는데, 그때는 **두 곳에 각각 넣어** 고쳤다 —
  //     그 방식이 이 재발을 불렀다. 이제 묶음 하나를 양쪽이 함께 쓴다.
  //   ⇒ 오버레이를 새로 만들면 **여기에만** 더하면 된다. `check:talkoverlay` 가 지킨다.
  //   ⚠️`absoluteFill` 은 부모를 채우므로, 양쪽 모두 **가장 바깥 View 안**에 놓아야 한다
  //     (칸 안에서 그리면 창이 그 칸에 갇힌다 · [[overlay-absolutefill-parent]]).
  //     RN `Modal` 을 안 쓰는 이유: iOS 에서 그 안의 `VideoView` 가 소리만 남고 안 보인다.
  const overlays = (
    <>
      <ProfileSheet target={profile} onClose={() => setProfile(null)} />
      {/* ★`cur` 가드 — 이 묶음은 «대화를 고르기 전» 보다 앞에 있다. 상대가 없으면 초대할 것도 없다. */}
      {inviteOpen && cur ? (
        <InviteSheet
          // ★이미 방에 있는 사람은 뺀다 — 두 번 부르면 «3명» 이 되지 않는다
          candidates={servers.filter((x) => x.id !== cur.id && !mates.some((m) => m.id === x.id))}
          onClose={() => setInviteOpen(false)}
          onInvite={async (ids) => {
            setInviteOpen(false);
            const sid = await openGroupRoom(cur.id, ids, chartId);
            if (!sid) return;                       // 실패해도 지금 방은 그대로다(막지 않는다)
            sessRef.current[cur.id] = sid;          // 이 방으로 이어서 말한다
            setMates(servers.filter((x) => ids.includes(x.id)));
          }}
        />
      ) : null}
    </>
  );

  if (wide) {
    return (
      <View style={styles.two}>
        <View style={[styles.pane, { paddingTop: renderTop ? 0 : insets.top }]}>
          {renderTop}
          <TalkList items={list} onOpen={open} selected={cur?.id} myName={myName} myAvatar={myAvatar} onOpenProfile={setProfile}
                      railKeys={order} onMe={() => router.push('/charts')}
                      onSettings={() => router.push('/settings')}
                      onAddFriend={() => router.push('/friends')}
                      session={session} onLogin={() => router.push('/login')}
                      pendingCount={friends.filter((f) => f.status === 'pending' && !f.requestedByMe).length}
                      people={friends.filter((f) => f.status === 'accepted').map((f) => ({
                        id: f.otherId, name: f.name ?? '이름 없음', avatarUrl: f.avatarUrl, canSee: !!f.chartId,
                      }))}
                      onOpenPerson={(id) => router.push(`/friendcompat?friend=${id}`)} wide={!wide} footer={renderBottom} />   {/* 웹 3칸 = 좁은 칸 */}
        </View>
        {showChatPane && (
          <View style={[styles.pane, { paddingTop: insets.top }]}>
            <ChatList reloadKey={chatsTick} selectedId={cur?.id} wide={false} onOpenProfile={setProfile}
                      onSettings={() => router.push('/settings')}
                      onOpen={(id) => { const c = list.find((x) => x.id === id); if (c) open(c); }} />
          </View>
        )}
        <View style={styles.main}>
          {cur ? (
            <>
              <View style={styles.head}>
                <View style={styles.headMid}>
                  <Text style={styles.headTx} numberOfLines={1}>
                    {mates.length ? roomTitle([cur.name, ...mates.map((m) => m.name)]) : cur.name}
                  </Text>
                  {mates.length ? <Text style={styles.headNum}>{memberCount(mates.length + 1)}</Text> : null}
                </View>
                {/* 초대 — ★좁은 화면 헤더와 **같은 것**을 둔다(하나만 두면 넓은 창에서 기능이 없다) */}
                <PressableScale hitSlop={8} onPress={() => setInviteOpen(true)}>
                  <Text style={styles.headAdd}>＋</Text>
                </PressableScale>
                {/* 대화 지우기 — ★상담가가 아니라 **이 대화**를 지운다(친구는 목록에 남는다) */}
                <PressableScale hitSlop={8} onPress={() => setAskDelete(true)}>
                  <Icon name="trash" size={25} />
                </PressableScale>
              </View>
              {askDelete ? <DeleteBar onCancel={() => setAskDelete(false)} onOk={onDeleteThread} t={t as never} /> : null}
              <TalkNotes
                notes={notes} open={notesOpen} onToggle={() => setNotesOpen((v) => !v)}
                onJump={(mid) => {
                  // ★뛰기 전에 정리 패널을 **접는다** — 펼쳐진 채로 스크롤하면 목적지가 그 밑에 가려
                  //   «아무 일도 안 일어난 것»으로 보인다(Boss 2026-08-25 제보 자리).
                  setNotesOpen(false);
                  setJumpTo(null); requestAnimationFrame(() => setJumpTo(mid));
                }}
                onChanged={() => refreshNotes(cur ? sessRef.current[cur.id] : null)}
              />
              {/* ★운 안내 — 목록 **위**에 고정. 말풍선과 자리·색이 둘 다 다르다(Boss 2026-08-25) */}
              {notice ? (
                <CoinNotice
                  kind={notice.kind} text={notice.text} action={notice.action}
                  onAction={notice.action ? () => { setNotice(null); router.push('/coins'); } : undefined}
                  onClose={() => setNotice(null)}
                />
              ) : null}
              <TalkThread items={items} busy={busy} onLink={(r) => router.push(r as never)} jumpTo={jumpTo} />
              {birthCard}
              {composer}
              {mentionSheet}
            </>
          ) : (
            <View style={styles.empty}>
              {/* ★탭마다 다른 말 — 고를 목록이 다르다.
                  ★2026-08-23 Boss: 친구 탭 쪽 문구를 「대화가 없습니다」로(고르라는 지시보다
                    지금 상태를 말하는 편이 낫다). 대화 탭 문구는 그대로 둔다. */}
              <Text style={styles.emptyTx}>
                {mode === 'chats'
                  ? t('talk.pickChat', '왼쪽에서 대화를 골라 주세요')
                  : t('talk.pickOne', '대화가 없습니다')}
              </Text>
            </View>
          )}
        </View>
        {/* ★프로필 창은 **세 칸 바깥**에서 그린다 — 칸 안에서 그리면 창이 그 칸에 갇힌다
            (`absoluteFill` 은 부모를 채운다 · [[overlay-absolutefill-parent]]).
            ⚠️RN `Modal` 을 안 쓰는 이유: iOS 에서 그 안의 `VideoView` 가 소리만 남고 안 보인다 —
              배경을 영상으로 두려면 Modal 밖이어야 한다. */}
        {overlays}
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
        {/* ★다인방이면 이름을 쉼표로 잇고 **인원수**를 붙인다(Boss 2026-08-25).
            인원수는 «나 포함» — Boss 가 그렇게 말했고, 카톡도 그렇다. */}
        <View style={styles.headMid}>
          <Text style={styles.headTx} numberOfLines={1}>
            {mates.length ? roomTitle([cur.name, ...mates.map((m) => m.name)]) : cur.name}
          </Text>
          {mates.length
            ? <Text style={styles.headNum}>{memberCount(mates.length + 1)}</Text>
            : null}
        </View>
        <PressableScale hitSlop={8} onPress={() => setInviteOpen(true)}>
          <Text style={styles.headAdd}>＋</Text>
        </PressableScale>
        <PressableScale hitSlop={8} onPress={() => setAskDelete(true)}>
          <Icon name="trash" size={25} />
        </PressableScale>
      </View>
      {askDelete ? <DeleteBar onCancel={() => setAskDelete(false)} onOk={onDeleteThread} t={t as never} /> : null}
      <TalkNotes
        notes={notes} open={notesOpen} onToggle={() => setNotesOpen((v) => !v)}
        onJump={(mid) => { setJumpTo(null); requestAnimationFrame(() => setJumpTo(mid)); }}
        onChanged={() => refreshNotes(cur ? sessRef.current[cur.id] : null)}
      />
      <TalkThread items={items} busy={busy} onLink={(r) => router.push(r as never)} jumpTo={jumpTo} />
      {birthCard}
      {composer}
      {mentionSheet}
      {overlays}
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
  headMid: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space(2) },
  headTx: { flexShrink: 1, minWidth: 0, ...font.heading, color: colors.ink, fontWeight: '800' },
  // ★인원수 — 카톡처럼 이름 옆에 **작게**. 배지로 크게 그리면 이름을 밀어낸다.
  headNum: { ...font.label, color: colors.inkSoft, fontWeight: '700' },
  headAdd: { ...font.heading, color: colors.ink, fontWeight: '700', paddingHorizontal: space(1) },
  headIcon: { paddingHorizontal: space(1) },   // ★그림은 `kit/Icon` 이 그린다(크기는 거기서)
  // 삭제 확인 — 눌린 자리 바로 아래
  delBar: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), paddingVertical: space(3), backgroundColor: colors.sunk, borderBottomWidth: 1, borderBottomColor: colors.line },
  delTx: { flex: 1, minWidth: 0, ...font.caption, color: colors.inkSoft },
  delNo: { paddingHorizontal: space(3), paddingVertical: space(1.5) },
  delNoTx: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  delYes: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.5) },
  // ★강조색 위 글자는 `onJu`(`check:onaccent`)
  delYesTx: { ...font.caption, color: colors.onJu, fontWeight: '900' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTx: { ...font.body, color: colors.inkFaint },

  // ★명식 만들기 카드 — 입력창 **바로 위**. 대화 흐름을 끊지 않으면서 늘 손에 닿는 자리다
  birthCardWrap: { paddingHorizontal: space(4), paddingBottom: space(2) },
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
  // ★명식 부르기 — 보내기와 **다른 무게**로(주 동작은 보내기다).
  //   ⚠️글리프는 fontSize 만큼 안 커진다([[glyph-icons-dont-scale]]) — 잉크로 보고 22 로 잡았다
  atBtn: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.sunk,
    alignItems: 'center', justifyContent: 'center',
  },
  atTx: { ...font.body, fontSize: 22, lineHeight: 26, color: colors.ju, fontWeight: '900' },
  sendBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2.5) },
  // ★강조색 위 글자는 `onJu`(check:onaccent)
  sendTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
});

/** `/talk` 라우트 — 시작 화면과 **같은 화면**이다(딥링크 호환용으로 남겨 둔다). */
export default function TalkScreen() {
  return <TalkHome />;
}
