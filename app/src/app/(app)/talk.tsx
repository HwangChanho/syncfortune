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
import { View, Text, StyleSheet, TextInput, Keyboard, Platform, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { TalkList } from '../../components/talk/TalkList';
import { ChatList } from '../../components/talk/ChatList';
import { TalkThread, type TalkItem } from '../../components/talk/TalkThread';
import { TalkNotes } from '../../components/talk/TalkNotes';                 // 대화 정리 줄(Boss 2026-08-23)
import { listNotes, type TalkNote } from '../../lib/talk/talkNotes';
import { listConsultants, consultantsSnapshot, type Consultant, toProfileTarget } from '../../lib/talk/consultants';
import { greet, todayFlow, guide, type VirtualReply } from '../../lib/talk/virtualTalk';
import { askLive, loadThread, deleteThread } from '../../lib/talk/liveTalk';
import { Alert } from '../../lib/ui/alert';   // 커스텀 알림 — 운 부족 시 충전 유도
import { wantsCards, drawThree } from '../../lib/talk/tarotDraw';   // ★카드는 **우리가** 뽑는다(모델이 아니라)
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
import { PersonSheet, type PersonTarget } from '../../components/talk/PersonSheet';   // 사람 상세 — 내 명식·친구가 **같은 패널**
// ★반말/존댓말 판정은 **한 곳에서만**(Boss 2026-08-26) — 인사와 서버가 갈리면 안 된다
import { ageFromBirth } from '../../lib/talk/speechLevel';
import { getSpeechCasual, speechCasualSnapshot } from '../../lib/talk/speechSetting';   // ★말투 = **설정값**(Boss 2026-08-31)
// ★대화 안에서 명식 만들기(Boss 2026-08-26) — 등록 화면에 안 가고도 만들 수 있어야 한다
import { parseBirth, looksLikeBirthInfo, type BirthDraft } from '../../lib/talk/birthParse';
import { BirthDraftCard, type BirthCardResult } from '../../components/talk/BirthDraftCard';
import { addChart, setRepresentative } from '../../lib/engine/myChart';
import { loadMyProfile, subscribeProfile, profileSnapshot } from '../../lib/talk/myProfile';
import { listFriends, type Friend, loadFriendChart } from '../../lib/talk/friends';
import { useHomeOrder } from '../../lib/ui/homeOrder';
import { ensureServerChartIdForSaved } from '../../lib/backend/prewarmReadings';
// ★답장 알림 — «보고 있는 방» 알리기 + 앱 아이콘 배지(Boss 2026-08-28)
import { setOpenTalk, refreshTalkBadge } from '../../lib/backend/notifications';
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
import { Resizer } from '../../components/kit/Resizer';        // 웹에서 칸 폭을 손으로(Boss 08-27)
import { greetingFor, ieyo } from '../../lib/talk/greetingFor';   // ★조사(이에요/예요)는 **한 곳**에서 정한다   // 상담가별 첫 인사(Boss 08-26)
import { CoinNotice } from '../../components/talk/CoinNotice';
import InviteSheet from '../../components/talk/InviteSheet';   // 다인방 초대(Boss 2026-08-25)
import { leaveRoom } from '../../lib/talk/roomActions';        // 방 나가기(목록 스와이프·우클릭)
import { UserRoomView } from '../../components/talk/UserRoomView';   // 사람끼리의 대화(운 0)
import { openUserRoom, leaveUserRoom, inviteToRoom } from '../../lib/talk/userRoom';
import { openGroupRoom, roomTitle, roomMembers } from '../../lib/talk/groupTalk';   // 운 안내 = 상단 띠(Boss 08-25)
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
      {/* ★★글을 `flex: 1` 로 감싸 **버튼을 오른쪽 끝에 붙인다**(Boss 2026-08-30
          *"지우기랑 취소를 오른쪽 끝으로 붙여줘"*).
          ⚠️종전엔 글이 제 폭만 차지해 버튼이 글 바로 뒤에 붙고 **오른쪽이 텅 비었다.**
          ★바로 아래 「나가기」 줄은 이미 이 모양이다 — 두 줄이 같은 생김새가 되게 맞춘다
            (한쪽만 고치면 나중에 «왜 여기만 다르지» 가 된다). */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.delTx}>{t('talk.delAsk', '이 대화를 지울까요? 되돌릴 수 없어요.')}</Text>
      </View>
      <PressableScale style={styles.delNo} onPress={onCancel}>
        <Text style={styles.delNoTx}>{t('common.cancel', '취소')}</Text>
      </PressableScale>
      <PressableScale style={styles.delYes} onPress={onOk}>
        <Text style={styles.delYesTx}>{t('talk.delOk', '지우기')}</Text>
      </PressableScale>
    </View>
  );
}

/**
 * 나가기 확인 줄.
 *
 * ★`DeleteBar` 와 **따로 둔다** — 말이 다르기 때문이다.
 *   「지우기」는 *지금 보고 있는 대화*를 비우는 것이고,
 *   「나가기」는 *목록의 어느 방*을 통째로 없애는 것이다(그 방이 지금 열려 있지 않을 수도 있다).
 *   ⇒ **어느 방을 나가는지 이름을 적는다.** 안 적으면 «무엇을 지우는지 모르고 누르는» 확인이 된다.
 */
function LeaveBar({ name, onOk, onCancel, t }: {
  name: string; onOk: () => void; onCancel: () => void; t: (k: string, d?: string) => string;
}) {
  // ★★웹은 **가운데**에 띄운다(Boss 2026-08-27 *"방 나가는건 가운데 떠야할꺼 같아 웹기준"*).
  //   폰은 아래에 붙인다 — 손가락이 닿는 자리가 아래고, 웹은 마우스라 시선이 가는 가운데가 맞다.
  //   ⚠️`delBar` 를 그대로 쓰면 안 된다: 그건 **대화창 안**의 한 줄이라 흐름에 얹히는 스타일이다.
  //     루트에 띄우면 자기 자리를 스스로 잡아야 한다(처음엔 오른쪽 빈 칸에 떠 있었다 — 실측으로 잡음).
  const web = Platform.OS === 'web';
  if (web) {
    return (
      <View style={styles.leaveScrim}>
        {/* 바깥을 누르면 취소 — 되돌릴 수 없는 일이라 «실수로 확인» 보다 «실수로 취소» 가 낫다 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.leaveCard}>
          <Text style={styles.leaveTitle} numberOfLines={3}>
            {t('chats.leaveAsk', '「{{name}}」 방을 나갈까요?').replace('{{name}}', name)}
          </Text>
          {/* ★★경고는 **따로 한 줄**로 (Boss 2026-08-28 *"방 나갈땐 무조건 전체 대화내역
              삭제된다고 공지 해줘야하고"*).
              ⚠️종전엔 질문 뒤에 «대화 내용도 함께 사라져요» 가 붙어 있었다 — 한 문장 안에 있으면
                눈이 앞의 물음만 읽고 넘긴다. **되돌릴 수 없다**는 말이 빠져 있기도 했다.
              ★색을 준다 — 되돌릴 수 없는 일은 눈에 다르게 보여야 한다. */}
          <Text style={styles.leaveWarn}>
            {t('chats.leaveWarn', '나눈 이야기 전체가 지워지고, 되돌릴 수 없어요.')}
          </Text>
          <View style={styles.leaveBtns}>
            <PressableScale style={styles.delNo} onPress={onCancel}>
              <Text style={styles.delNoTx}>{t('common.cancel', '취소')}</Text>
            </PressableScale>
            <PressableScale style={styles.delYes} onPress={onOk}>
              <Text style={styles.delYesTx}>{t('chats.leave', '나가기')}</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.delBar, styles.leaveBar]}>
      {/* ★웹 카드와 **같은 두 줄**을 쓴다 — 한쪽만 고치면 «폰에서는 경고가 없는» 일이 생긴다 */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.delTx} numberOfLines={2}>
          {t('chats.leaveAsk', '「{{name}}」 방을 나갈까요?').replace('{{name}}', name)}
        </Text>
        <Text style={styles.leaveWarn} numberOfLines={2}>
          {t('chats.leaveWarn', '나눈 이야기 전체가 지워지고, 되돌릴 수 없어요.')}
        </Text>
      </View>
      <PressableScale style={styles.delNo} onPress={onCancel}>
        <Text style={styles.delNoTx}>{t('common.cancel', '취소')}</Text>
      </PressableScale>
      <PressableScale style={styles.delYes} onPress={onOk}>
        <Text style={styles.delYesTx}>{t('chats.leave', '나가기')}</Text>
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
/**
 * **명식을 보는** 분야 — 이 분야를 맡은 상담가에게만 «어떤 명식을 볼까» 를 묻는다.
 * ★타로·뷰티·차·여행에게 명식을 고르라고 하면 그건 잡음이다.
 * ⚠️운영자가 `routes`·`specialty` 를 늘릴 수 있으므로 **여기 한 곳**에서만 판정한다.
 */

/**
 * 웹 목록 칸의 폭 — 기본·하한·상한.
 * ★하한(180)은 «아바타 + 이름 두 글자» 가 살아남는 값이다. 그보다 좁으면 목록이 아니라 띠가 된다.
 * ★상한(520)은 대화 칸을 지키는 값 — 목록이 화면을 다 먹으면 정작 대화를 못 읽는다.
 */
const PANE_DEFAULT = 282;
const PANE_MIN = 180;
const PANE_MAX = 520;

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
  /**
   * ★상담가가 «이건 제 자리가 아니에요» 하며 **부르자고 제안한 동료**(Boss 2026-08-28).
   * 서버가 답에서 「[[초대::이름]]」 을 떼어 `invite` 로 준다(id 까지 붙여서).
   * ⚠️자동으로 부르지 않는다 — **회원이 눌러야** 부른다. 말없이 사람이 늘면 그건 남의 방이 된다.
   */
  const [inviteSug, setInviteSug] = useState<{ id: string; name: string } | null>(null);
  const [mates, setMates] = useState<Consultant[]>([]);
  // ── @명식 부르기(Boss 2026-08-26 *"@누구 이런식으로 불러올수 있으면"*) ─────────────
  //   ★저장된 명식은 **온디바이스**다(ADR-005). 서버에 없는 사람도 부를 수 있어야 한다.
  const [myCharts, setMyCharts] = useState<SavedChart[]>([]);
  // ★회원 만 나이 — 상담가 나이보다 어리면 **기본 반말**(Boss 2026-08-26).
  //   ⚠️명식이 없으면 null → 존댓말. 모르면 안전한 쪽이다.
  const [myAge, setMyAge] = useState<number | null>(null);
  /**
   * 상담가가 반말로 말하는가 — **회원이 설정에서 정한 값**(Boss 2026-08-31
   *   *"그냥 설정에서 반말모드 존댓말모드 설정할수 있게하고 저건 묻지 않는걸로 하자"*).
   * ⚠️종전엔 나이로 판정했는데(`isCasual`), 그러면 첫 인사와 서버 답이 **다른 근거**로 갈렸다.
   *   이제 근거가 하나다 — 화면도 서버도 `profiles.speech_casual` 을 본다.
   */
  const [casualMode, setCasualMode] = useState<boolean>(() => speechCasualSnapshot());
  useEffect(() => { void getSpeechCasual().then(setCasualMode); }, []);
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
  // ★★사람 상세 패널 (Boss 2026-08-26 *"사람 상세 패널로 가자"*)
  //   종전엔 같은 «사람» 인데 목적지가 **두 갈래**였다 —
  //     내 이름 → `/charts`(만세력) · 친구 이름 → `/friendcompat`(궁합)
  //   ⇒ 대화하러 왔는데 화면이 통째로 바뀌고, 돌아오면 어디였는지 잃었다.
  //   이제 **옆에서 열린다.** 닫으면 그 자리다.
  const [person, setPerson] = useState<PersonTarget | null>(null);
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
  /**
   * ★★이 방에서 **명식을 골랐는가** (Boss 2026-08-27 *"명식 체크칸이 떠서 어떤 명식을 봐줄까로 시작"*).
   *
   * ■ 왜 필요했나 — **대표 명식이 실행마다 바뀌고 있었다**
   *   `loadRepChart()` 는 저장된 대표 id 가 없으면 **`charts[0]`** 로 떨어진다.
   *   Boss 계정은 명식이 **50개**라 목록 순서가 조금만 달라져도 매번 다른 사람을 본다.
   *   실측: 최근 세션들의 `chart_id` 가 `2321d92d`·`b68aef72`·`f3deddf5` 로 **제각각**이었다.
   * ⇒ 자동으로 고르지 말고 **묻는다.** 한 번 고르면 그 방에서는 다시 안 묻는다.
   */
  const [pickedLocal, setPickedLocal] = useState<string | null>(null);
  /**
   * ★★웹 칸 폭 — **쓰는 사람이 정한다** (Boss 2026-08-27
   *   *"웹은 각 구간별로 좌우 클릭해서 크기 조절할수 있게하고 다 닫으면 한줄로 되면서
   *   닫았다가 다시 마우스로 드레그하면 열려서 크기 조절할수 있게"*).
   *
   * ■ 왜 필요했나 — **고정 폭이 글자를 잘랐다**
   *   목록 칸이 `282` 고정이라 아이콘 넷(208px)을 빼면 이름에 41px 만 남아
   *   「황찬호」가 **「황…」** 으로 잘렸다(실측). 화면 크기는 사람마다 다르다.
   * ■ ★기억한다 — 매번 다시 끌게 하면 그건 조절이 아니라 **일**이다.
   *   ⚠️`localStorage` 는 웹에만 있고 접근만으로 던지는 환경이 있다 ⇒ 읽기·쓰기 모두 try 로 감싼다.
   */
  const [paneW, setPaneW] = useState<number>(() => {
    try {
      const v = Number(globalThis.localStorage?.getItem('ui.talkPaneW'));
      return Number.isFinite(v) && v >= PANE_MIN && v <= PANE_MAX ? v : PANE_DEFAULT;
    } catch { return PANE_DEFAULT; }
  });
  /** 접혔는가 — 폭 0 이 아니라 **손잡이만 남는** 상태(그래야 다시 열 수 있다). */
  const [paneOpen, setPaneOpen] = useState(true);
  const setPaneWSaved = useCallback((w: number) => {
    setPaneW(w);
    try { globalThis.localStorage?.setItem('ui.talkPaneW', String(w)); } catch { /* 저장 못 해도 이번 세션은 산다 */ }
  }, []);
  const [myName, setMyName] = useState<string | null>(null);   // 친구목록 상단 '나'
  const [myAvatar, setMyAvatar] = useState<string | null>(profileSnapshot().avatarUrl);
  // ── 대화 정리(Boss 2026-08-23) ───────────────────────────────────────────
  const [notes, setNotes] = useState<TalkNote[]>([]);
  // ★기본은 접힘. 한 번 펴 본 사람에게는 그대로 펴진 채로 둔다(앱을 켜 둔 동안).
  const [notesOpen, setNotesOpen] = useState(false);
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  /**
   * ★명식을 골랐다 — **로컬 id 를 서버 chart_id 로 바꿔** 대화에 싣는다.
   *
   * ⚠️`myCharts` 는 온디바이스 id 이고, 서버가 아는 것은 `charts.id` 다. 둘을 헷갈리면
   *   «고르긴 했는데 답은 딴 명식» 이 된다. 변환은 정식 경로(`ensureServerChartIdForSaved`)로만 한다
   *   — 캐시된 `serverChartId` 를 그대로 쓰면 stale row 를 가리킬 수 있다(그 함수 주석 참조).
   * ★고른 뒤 카드는 **지우지 않는다** — 어떤 걸 골랐는지 남아 있어야 나중에 바꿀 수 있다.
   *   대신 체크가 그 줄로 옮겨 간다.
   */
  /**
   * ★`send` 를 뒤에서 정의하므로 **ref 로 잇는다**(선언 순서 때문에 직접 못 부른다).
   *   ⚠️`useCallback` 의 deps 에 `send` 를 넣으면 매 렌더마다 `pickChart` 가 새로 만들어져
   *     카드가 다시 그려진다 — ref 는 그 파장이 없다.
   */
  const sendRef = useRef<((override?: string) => void) | null>(null);

  const pickChart = useCallback((localId: string) => {
    setPickedLocal(localId);
    void (async () => {
      const c = (await listCharts()).find((x) => x.id === localId);
      if (!c || !session) return;
      const sid = await ensureServerChartIdForSaved(c, session);
      if (sid) setChartId(sid);
      setMyName(c.label ?? null);
      try { setSaju(computeChart(c.input).saju); } catch { /* 계산이 안 되면 흐름 안내만 건너뛴다 */ }
      setMyAge(ageFromBirth(c.input?.birthDateTime));
      /**
       * ★★고른 그 자리에서 **말을 건다**(Boss 2026-08-31
       *   *"체크하고 대화했는데 처음말하는거 같잖아 체크하면 바로 대화카운트 차감하면서
       *     해당명식 연애운 어떤거 봐줄까 물어봐야지"*).
       *
       * ■ 종전엔 체크가 **상태만** 바꿨다. 그래서 다음 말에 상담가가 «안녕하세요, 뭘 봐드릴까요?»
       *   로 시작해 **방금 고른 것을 못 본 사람처럼** 보였다.
       * ■ ⇒ 고르는 것을 **한 턴으로 만든다.** 기존 `send` 를 그대로 타므로
       *   과금·줄세우기·이력 저장이 전부 이미 있는 경로로 간다(새 길을 내지 않는다 = 과금이 갈리지 않는다).
       * ★사용자 말풍선으로 이름을 남긴다 — 나중에 이력을 봐도 «누구 걸 봤는지» 가 남는다.
       */
      sendRef.current?.(t('talk.pickedChart', '{{name}} 명식으로 볼게', { name: c.label ?? '' }));
    })();
  }, [session, t]);

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
  /**
   * 목록에서 「나가기」를 고른 방 — ⚠️**지금 열린 방과 다를 수 있다.**
   * (스와이프·우클릭은 아무 줄에서나 되므로, `cur` 를 지우면 엉뚱한 방이 사라진다.)
   * Boss 2026-08-27: *"채팅 목록에서 방을 나갈수있고 그러면 대화내용이랑 다 삭제 돼야하고"*
   */
  const [askLeave, setAskLeave] = useState<{ sessionId: string; name: string } | null>(null);
  /**
   * 답을 만드는 중에 **더 친 말**(Boss 2026-08-27
   *   *"상대가 대화중에 채팅이 막혀있는데 중간에 계속 보낼수 있어야해"*).
   *
   * ★모아서 **한 턴**으로 보낸다(Boss *"중간에 내가 텍스트를 계속 보낼경우의 과금도 계산 해야해"*):
   *   ⚠️보낼 때마다 호출하면 세 줄을 치면 **세 번 과금**된다 — 그건 사용자도 우리도 손해다.
   *   그리고 세 줄을 **한꺼번에 읽은 답**이 세 번 따로 답하는 것보다 낫다(사람도 그렇게 한다).
   *   ⇒ 화면에는 **바로** 내 말풍선으로 뜨고(막힌 느낌이 없다), 서버에는 답이 끝난 뒤 **한 번** 간다.
   */
  const pendingRef = useRef<string[]>([]);
  /**
   * 지금 열려 있는 **사람 방**(Boss 2026-08-27 *"친구추가하면 서로 채팅도 가능하게"*).
   * ★상담가 방(`cur`)과 **동시에 열리지 않는다** — 하나를 열면 다른 하나를 비운다.
   *   둘 다 살아 있으면 «어느 화면이 위인가» 가 애매해지고, 전송이 어디로 갈지도 갈린다.
   */
  const [userRoom, setUserRoom] = useState<string | null>(null);
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
    // ★앱 아이콘 배지도 **같이** 줄인다(Boss *"확인하면 카운트는 해당 만큼 줄어들고"*).
    //   ⚠️읽음 처리가 실패했어도 부른다 — 서버가 정본이라 실패했으면 숫자가 그대로 나온다(거짓말이 안 된다).
    void refreshTalkBadge();
  }, [bumpChats]);
  // 세션은 **상담사별로** 따로 이어진다 — 한 세션에 여러 상담사를 섞으면 이력이 뒤엉킨다
  // ★★2026-08-27 — 방의 정체는 **세션**이다(종전엔 «상담가» 였다).
  //   Boss 제보: *"인원을 초대하면 방은 새로 만들어지는데 기존 내용이 남아있고 모든 채팅방이 동기화된다"*
  //   ⚠️원인: `sessRef.current[cur.id]` — 열쇠가 **상담가 id** 였다.
  //     초대해 새 세션을 만들어도 **같은 열쇠에 덮어써서**, 1:1 방으로 돌아가면 그룹 세션을 읽었다.
  //     「기존 내용이 남는다」와 「모든 방이 동기화된다」는 **같은 원인의 두 얼굴**이다.
  //   ⇒ 지금 열려 있는 **세션 하나**만 들고 있는다. 방을 바꾸면 그때 다시 정한다.
  //     (`sessRef` 는 재조회를 아끼려던 것인데, `open()` 이 어차피 `loadThread` 로 물어본다 —
  //      아끼는 것보다 **틀린 방을 여는 것**이 비싸다.)
  const [curSid, setCurSid] = useState<string | null>(null);
  //   ★콜백(전송) 안에서 **동기로** 읽어야 해서 ref 를 함께 둔다 — state 는 다음 렌더에야 보인다
  const curSidRef = useRef<string | null>(null);
  const setSid = useCallback((v: string | null) => { curSidRef.current = v; setCurSid(v); }, []);
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
  /**
   * ★★«지금 보고 있는 방» 을 알림 쪽에 알려 준다 (Boss 2026-08-28
   *   *"내가 해당 화면에 있는 상태가 아니면 알림이 와야하고"*).
   *
   * ■ 서버는 **항상** 답장 푸시를 보낸다(무슨 화면인지 서버는 모른다).
   *   띄울지 말지는 `setNotificationHandler` 가 이 값으로 정한다.
   * ■ ⚠️**화면을 떠나면 반드시 지운다.** `cur` 은 다른 탭으로 옮겨도 그대로 남아 있어서,
   *   안 지우면 홈 탭에 있는데도 그 방의 답장 알림이 조용히 사라진다.
   * ■ 배지도 여기서 맞춘다 — 들어와서 읽었으면 숫자가 **바로** 줄어야 한다.
   */
  useFocusEffect(useCallback(() => {
    setOpenTalk(cur?.id ?? null);
    void refreshTalkBadge();
    return () => setOpenTalk(null);
  }, [cur?.id]));
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
  /**
   * 방을 연다.
   *
   * @param c    이 방의 **대표 상담가**(머리말·페르소나가 이 사람 것이다)
   * @param room 목록에서 고른 방. **주면 그 세션을 그대로 연다** — 안 주면 이 상담가와의 1:1 방을 찾는다.
   *   ⚠️이 인자가 없던 것이 다인방 고장의 뿌리였다(위 `curSid` 주석).
   */
  const open = useCallback((c: Consultant, room?: { sessionId: string; guestIds: string[] }) => {
    /**
     * ⚠️★★**친구 방을 안 닫고 있었다**(Boss 2026-08-31 *"친구랑 대화한 뒤로 다른 채팅창이 안들어가져"*).
     *   화면은 `userRoom` 이 있으면 **그것을 먼저** 그린다(1623행). 그런데 상담가 방을 열 때
     *   `cur`·`sid` 만 바꾸고 `userRoom` 은 **그대로 뒀다** ⇒ 친구 방을 한 번 열면
     *   그 뒤로 무엇을 눌러도 **친구 방이 계속 보인다.**
     * ★반대 방향(친구 방을 열 때 `setCur(null)`)은 **이미 있었다**(1192·1613행) —
     *   같은 필요의 두 길 중 **한쪽만** 지워져 있었다. 이 저장소가 반복해서 겪는 모양이다.
     */
    setUserRoom(null);
    setCur(c);
    // ★방을 바꾸면 **세션도 참여자도 먼저 지운다** — 안 지우면 직전 방의 것이 잠깐 붙어 보인다
    setSid(room?.sessionId ?? null);
    setMates(room?.guestIds?.length
      ? consultantsSnapshot().filter((x) => room.guestIds.includes(x.id))
      : []);
    // ⚠️먼저 비운다 — 안 비우면 **직전 방의 정리**가 잠깐 보인다
    //   ★운 안내 띠도 같이 지운다 — 앞 방의 「운이 모자라요」가 다른 상담가 화면에 남으면 안 된다
    setNotes([]); setJumpTo(null); setNotice(null);
    genRef.current++;   // ★직전 방에 보낸 답이 도착해도 이 방에 붙지 않게(위 `genRef` 주석)
    pendingRef.current = [];   // ★앞 방에 하려던 말을 **새 방으로 들고 가지 않는다**
    refreshNotes(room?.sessionId ?? null);   // 세션을 알면 바로, 모르면 아래 loadThread 뒤에
    // ★대화를 열면 **읽음 처리**한다 — 안 그러면 배지가 영원히 남는다.
    //   시각은 서버가 `now()` 로 찍는다(앱이 값을 보내면 미래 시각으로 배지를 지울 수 있다).
    //   실패해도 대화는 열린다(배지가 한 번 더 뜰 뿐이다).
    if (room?.sessionId) void markRead(room.sessionId);
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
        body: greetingFor(c.id, c.name, c.tagline, casualMode),
      };
      setItems([]);
      // ★인사도 **쪼개서** 띄운다 — 한 덩어리로 뜨면 «미리 써 둔 안내문»이지 대화가 아니다
      const greetParts = splitBubbles(greet.body).map((b) => ({ ...greet, id: nextId(), body: b }));
      /**
       * ★★«어떤 명식을 볼까» — 인사 **바로 뒤**에 한 번 (Boss 2026-08-27).
       *
       * ■ 언제 뜨나 — 셋이 다 맞을 때만
       *   ①명식이 **둘 이상**이고(하나뿐이면 물을 것이 없다)
       *   ②이 상담가가 **명식을 보는 사람**이고(타로·뷰티에게 물으면 잡음이다)
       *   ③이 방에서 **아직 안 골랐다**
       * ■ ⚠️답을 막지 않는다 — 카드를 무시하고 바로 물어도 대화는 그대로 간다.
       *   고르지 않으면 종전처럼 대표 명식으로 답한다(다만 그게 매번 달랐던 게 이 카드가 생긴 이유다).
       */
      // ⚠️★**안내자(`guide`)는 제외**한다 (2026-08-28 실측).
      //   안내 목록을 만들려고 `routes` 에 compat·love·wealth 가 들어 있어 카드가 떴는데,
      //   정작 서버는 그 사람에게 명식을 **안 준다** ⇒ «물어 놓고 안 보는» 모순이 된다.
      //   ★판정 기준을 서버(`talk/index.ts` 의 `isGuide`)와 **같은 값**으로 맞춘다.
      // ★`seesChart` 판정은 **명식 고르기 카드와 함께** 없어졌다(2026-08-31) —
      //   그 값을 쓰던 곳이 그 카드 하나뿐이었다. 되살릴 땐 서버의 `isGuide` 와 같은 기준으로 다시 만든다.
      /**
       * ★★2026-08-31 — 방을 열자마자 「어떤 명식을 볼까요?」를 **묻지 않는다**(Boss 지시).
       *
       * ■ 왜 뺐나 — 인사도 하기 전에 **목록부터 들이미는** 화면이었다.
       *   게다가 같은 날 «고르면 그 자리에서 한 턴이 나간다» 로 바꾸면서,
       *   시작하자마자 뜨는 카드는 **묻지도 않고 과금되는 길**이 됐다.
       * ■ 명식을 고르는 길은 그대로 있다 — `@이름` 으로 부르거나 만세력에서 대표를 바꾼다.
       *   대화는 **대표 명식**으로 이어간다(만세력이 그리는 것과 같은 명식이다).
       * ⚠️`ChartPickCard` 자체는 남겨 뒀다 — 다른 자리에서 필요해지면 그대로 쓴다.
       *   ★다만 지금은 **아무도 안 그린다**. 되살릴 땐 «언제 뜨는가» 를 먼저 정해야 한다.
       */
      const pickCard: typeof items = [];
      /**
       * ★★**이력이 있는지 먼저 확인한 뒤에** 인사할지 정한다 (Boss 2026-08-30
       *   *"기존 대화이력이 있는데 친구를 누르면 다시 인사를 하다가 갑자기 기존 대화창으로 가.
       *     기본적으로 친구를 누르면 1:1 대화창이 있는지 확인부터 해야지"*).
       *
       * ■ 종전엔 **인사를 먼저 띄우고**(`sayInOrder`) 그 다음에 이력을 읽었다.
       *   그래서 이력이 있는 방을 열면 «인사 애니메이션 → 갑자기 지난 대화로 교체» 가 보였다.
       *   ★기능은 맞았는데 **순서가 틀렸다** — 사용자에게는 «처음 만난 척하다 들킨» 것처럼 보인다.
       * ■ ⇒ 읽기를 **먼저** 하고, 이력이 있으면 **인사를 아예 하지 않는다.**
       *   ⚠️읽는 동안 화면을 비워 두지 않는다 — 점 세 개(`busy`)로 «가져오는 중» 을 보여 준다.
       *     (카톡도 방을 열면 잠깐 빈 채로 있지 첫 인사를 새로 하지는 않는다.)
       * ■ ⚠️`clearTimers()` 로 지우던 «이미 튼 인사» 가 이제 없다 — 그래서 깜빡임도 없다.
       */
      setBusy(true);
      const greetIfEmpty = () => sayInOrder([...greetParts, ...pickCard, ...blockCards, ...linkCard]);
      void loadThread(c.id, room?.sessionId ?? null).then((th) => {
        if (!th) { setBusy(false); greetIfEmpty(); return; }
        if (!th.messages.length) { setBusy(false); greetIfEmpty(); }
        setSid(th.sessionId);
        refreshNotes(th.sessionId);        // 방을 열면 정리도 같이 읽는다
        if (th.messages.length) {
          // ★이제 인사는 **애초에 안 튼다**(위 주석) — 그래도 **앞 방**의 타이머가 남아 있을 수 있어 지운다.
          clearTimers();
          setBusy(false);
          // ★복원된 이력에도 같은 규칙으로 그림을 붙인다 — 결정론이라 **처음과 같은 그림**이 나온다
          //   (모델에게 고르게 했다면 다시 열 때마다 달라졌을 것이다).
          setItems(th.messages.flatMap((m) => {
            // ★대화 중 그림을 넣지 않는다(Boss 2026-08-25 *"대화 끝날때마다 나오는 이미지는 필요없어"*).
            //   말끝마다 그림이 붙으면 대화가 아니라 «카드 묶음» 으로 읽힌다.
            //   ⚠️`talkImagery` 는 지우지 않았다 — 다시 켤 일이 있으면 여기 한 줄이다.
            //
            // ★★2026-08-26 Boss *"대화가 분할돼서 오다가 다른 곳 나갔다오면 하나로 묶여있어"*
            //   원인: 쪼개기(`splitBubbles`)가 **받을 때만** 도는 표시용 로직이었다.
            //   DB 에는 답이 **한 덩어리(1행)** 로 저장되고, 복원은 그 행을 그대로 그렸다
            //   ⇒ **같은 대화가 처음과 다시 볼 때 다르게** 보였다.
            //   ⇒ 저장 형식은 그대로 둔다(원문 1행이 정본 — 이력·정리·재분석이 그걸 쓴다).
            //     대신 **그리는 규칙을 한쪽으로 맞춘다.** 쪼개기는 결정론이라 늘 같은 모양이 나온다.
            //   ⚠️사용자 말은 쪼개지 않는다 — 사람이 쓴 그대로가 원문이다.
            //   ★`msgId` 는 조각들이 **함께 물려받는다** — 정리가 원문으로 데려갈 때 쓰는 값이라
            //     쪼갠다고 갈라지면 안 된다(화면 `id` 만 조각마다 새로 준다).
            const parts = m.role === 'assistant' ? splitBubbles(m.body) : [m.body];
            const safe = parts.length ? parts : [m.body];   // 방어: 쪼개기가 빈손이면 원문 한 덩어리
            // ★다시 열었을 때도 얼굴이 붙게 — `speaker_id` 가 있으면 그 사람, 없으면 방 주인(1:1)
            const sp = m.speakerId ? servers.find((x) => x.id === m.speakerId) : cur;
            const who = m.role === 'assistant' && sp ? { id: sp.id, name: sp.name, avatar: sp.avatar } : undefined;
            return safe.map((b) => ({ id: nextId(), msgId: m.id, role: m.role, body: b, who }));
          }));
          void markRead(th.sessionId);
        }
      });
    }
    // ⚠️`casualMode` 를 빼면 **인사만 존댓말로 굳는다** — 설정은 서버에서 나중에 들어온다.
    //   (`myAge` 도 같은 이유로 남긴다 — 다른 문구가 나이를 쓴다.)
    // ⚠️`myAge` 를 빼면 **인사만 존댓말로 굳는다** — 나이는 대표 명식을 읽은 뒤에 들어오는데,
    //   그 전에 만들어진 `open` 이 계속 쓰이면 반말 판정이 영원히 null(=존댓말)이다.
    // ⚠️★`myCharts`·`pickedLocal`·`pickChart` 도 빼면 안 된다 — 명식 목록이 나중에 들어오는데
    //   그 전에 만들어진 `open` 이 계속 쓰이면 **카드가 영영 안 뜬다**(목록이 0으로 굳는다).
    //   ⚠️이 파일에는 react-hooks eslint 가 없다 — deps 는 **손으로** 맞춰야 한다.
  }, [t, dateKey, myName, bumpChats, myAge, casualMode, myCharts, pickedLocal, pickChart, router]);

  // ── 친구가 공개한 명식 (Boss 2026-08-26 *"@ 누르면 내가 여기서 친구추가한 인물의 명식도"*) ──
  //   ★친구 명식을 읽는 길은 **이미 있었다** — 「친구 궁합」이 쓰던 `loadFriendChart` 그대로 쓴다.
  //     («권한이 없어서 못 한다» 가 아니라 **배선이 안 돼 있었다.**)
  //   ⚠️`chartId` 는 상대가 **공개에 동의했을 때만** 온다(기본값은 비공개다).
  const [friendSaju, setFriendSaju] = useState<Record<string, any>>({});
  // ★@ 시트를 **처음 열 때** 받아 온다 — 포커스마다 받으면 @ 를 한 번도 안 눌러도 N번 나간다.
  useEffect(() => {
    if (!mentionOpen) return;
    let alive = true;
    const need = friends.filter((f) => f.chartId && !friendSaju[f.otherId]);
    if (!need.length) return;
    void Promise.all(need.map(async (f) => {
      const c = await loadFriendChart(f.chartId!);
      return c?.saju ? [f.otherId, c.saju] as const : null;
    })).then((rs) => {
      if (!alive) return;
      const add = Object.fromEntries(rs.filter(Boolean) as Array<readonly [string, any]>);
      if (Object.keys(add).length) setFriendSaju((p) => ({ ...p, ...add }));
    });
    return () => { alive = false; };
  }, [mentionOpen, friends, friendSaju]);

  /**
   * `@` 뒤에 올 수 있는 이름들 — 내 명식 **+ 친구가 공개한 명식**.
   *
   * ★친구는 `chartId` 만 있으면 **바로** 후보에 넣는다(원국 로드를 기다리지 않는다).
   *   기다리게 하면 «시트에 보였다 안 보였다» 하고, 그 사이 `@민수` 를 보내면
   *   블록 없이 이름만 나가 **상담가가 방금 부른 사람을 모른 척한다.**
   * ⚠️이름이 겹치면 `parseMentions` 가 하나만 맞춘다 → 친구 쪽에 «(친구)» 를 붙여 **살린다**.
   *   버리면 사용자는 왜 안 보이는지 모른다.
   */
  const mentionTargets = useMemo<MentionTarget[]>(() => {
    const mine = myCharts.map((c) => ({ id: c.id, name: c.label, relation: c.relation, source: 'mine' as const }));
    const taken = new Set(mine.map((m) => m.name));
    const fr = friends
      .filter((f) => f.chartId)
      .map((f) => {
        const base = f.name?.trim() || '이름 없음';
        // 겹치면 «(친구)» 를 붙이고, 그래도 겹치면 뒤에 짧은 식별자를 더한다(«이름 없음» 둘도 산다)
        let nm = taken.has(base) ? `${base}(친구)` : base;
        if (taken.has(nm)) nm = `${base}(친구·${f.otherId.slice(0, 4)})`;
        taken.add(nm);
        return { id: f.otherId, name: nm, relation: '친구', source: 'friend' as const };
      });
    return [...mine, ...fr];
  }, [myCharts, friends]);

  /**
   * 본문에서 부른 사람들 → **모델이 읽을 재료**(원국·판정).
   *
   * ⚠️생년월일·출생지는 **안 나간다** — 구조만 보낸다(ADR-005 · `chartMention.ts` 머리말).
   * ★계산이 안 되는 명식 하나 때문에 대화를 막지 않는다 — 그 사람만 빼고 나머지는 간다.
   * @param q 사용자가 쓴 문장
   */
  const buildMentions = useCallback((q: string): string[] => {
    const people: { name: string; relation: string; saju: any; snapshot?: boolean }[] = [];
    for (const m of parseMentions(q, mentionTargets)) {
      if (m.source === 'friend') {
        // ★친구 것은 **서버에 저장된 원국**을 그대로 쓴다(앱이 다시 계산하지 않는다 — 생일을 모른다).
        //   `snapshot: true` 를 달아 «등록 당시» 임을 블록이 스스로 말하게 한다.
        //   ⚠️그 원국에는 `timeUnknown` 이 아예 없을 수 있다(필드가 나중에 생겼다) →
        //     그때는 시주를 **뺀다**. 남의 명식에 유령 子시를 실어 보내는 게 최악이다.
        const sj = friendSaju[m.id];
        if (sj) people.push({ name: m.name, relation: m.relation, saju: sj, snapshot: true });
        continue;
      }
      const c = myCharts.find((x) => x.id === m.id);
      if (!c?.input) continue;
      try { people.push({ name: m.name, relation: m.relation, saju: computeChart(c.input).saju }); }
      catch { /* 이 한 명이 안 되어도 나머지는 보낸다 */ }
    }
    return buildMentionBlocks(people);
  }, [myCharts, mentionTargets, friendSaju]);

  /**
   * 사용자가 한 마디.
   *
   * ★★여기가 **원가가 갈리는 유일한 지점**이다.
   *   `virtual` → 온디바이스(₩0) · `live` → Edge(턴당 실측 ₩4.2~14.5).
   *   분기를 늘리지 말 것 — 늘어나면 어느 쪽이 새는지 아무도 못 센다.
   */
  /**
   * 한 턴 보낸다.
   * @param override 대기 줄을 흘려보낼 때 쓰는 본문. 없으면 입력칸의 글을 쓴다.
   *   ★인자를 받는 이유: 대기 줄은 **state 가 아니라 ref** 에 있어서 `draft` 를 거치면
   *     한 프레임 늦고, 그 사이 사용자가 새로 친 글과 섞인다.
   */
  /**
   * @param override 직접 보낼 말(없으면 입력창의 것)
   * @param opts.echo 화면에 말풍선을 그릴지. **기본 true**.
   *   ⚠️★대기 줄을 흘려보낼 때는 `false` 다 — 줄에 넣을 때 **이미 그렸기 때문**이다.
   *     (Boss 2026-08-31 *"한번 쳤는데 대화도중에 쳤다고 두번뜨고"* — 정확히 이 이중 그리기였다.)
   */
  const send: (override?: string, opts?: { echo?: boolean }) => void = useCallback((override?: string, opts?: { echo?: boolean }) => {
    const q = (override ?? draft).trim();
    if (!q || !cur) return;
    if (override === undefined) setDraft('');
    // ★★답을 만드는 중이면 **줄을 세운다** — 막지 않는다(Boss 2026-08-27).
    //   화면에는 바로 뜨고, 서버에는 지금 턴이 끝난 뒤 **모아서 한 번** 간다 ⇒ 과금도 한 번.
    if (busy && override === undefined) {
      pendingRef.current.push(q);
      setItems((prev) => [...prev, { id: nextId(), role: 'user', body: q }]);
      return;
    }
    if (opts?.echo !== false) setItems((prev) => [...prev, { id: nextId(), role: 'user', body: q }]);

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

  // ★`pickChart` 가 부를 수 있게 **최신 `send`** 를 ref 에 담는다(선언 순서 때문에 직접 못 부른다).
  useEffect(() => { sendRef.current = send; }, [send]);

  /**
   * 답이 끝나면 **쌓아 둔 말을 한 번에** 보낸다(Boss 2026-08-27).
   *
   * ★줄바꿈으로 잇는다 — 세 줄을 한 덩어리로 읽은 답이 세 번 따로 답하는 것보다 낫다.
   * ⚠️**과금은 한 번**이다(호출이 한 번이므로). 이게 «중간에 계속 보낼 때의 과금» 에 대한 답이다.
   * ⚠️방을 옮기면 대기 줄을 **버린다** — 앞 방에 하려던 말이 새 방으로 가면 안 된다.
   */
  useEffect(() => {
    if (busy || !cur) return;
    const q = pendingRef.current.join('\n').trim();
    if (!q) return;
    pendingRef.current = [];
    // ★말풍선은 **줄에 넣을 때 이미 그렸다** — 여기서 또 그리면 한 번 친 말이 두 번 뜬다
    send(q, { echo: false });
  }, [busy, cur, send]);

  /**
   * 실제 상담사에게 한 번 보낸다. **자동 재시도가 같은 경로를 타도록** 따로 뺐다.
   *
   * @param q       질문 / @param attempt 회차(0=첫 시도) / @param gen 보낼 때의 방 세대
   */
  const fire = useCallback((q: string, attempt: number, gen: number) => {
    if (!cur) return;
    // ★판정은 **보낼 때 만든다** — 명식이 바뀌면 다음 턴부터 바로 반영된다
    void askLive(cur.id, q, curSidRef.current, chartId, i18n.language, attempt,
                 saju ? buildChartVerdict(saju) : null,
                 // ★@이름으로 부른 사람들 — **이 턴에만** 실린다(캐시 접두사를 건드리지 않는다)
                 buildMentions(q),
                 // ★반말 판정은 **서버가** 한다(상담가 나이는 서버 값이 정본이다)
                 myAge,
                 /**
                  * ★★카드는 **여기서 뽑는다**(Boss 2026-09-01 기획 1단계).
                  *   ⚠️모델에게 맡기면 «매번 좋은 카드» 를 뽑는다 — 그럴듯한 이야기를 만들려 하기 때문이다.
                  *   ★타로 담당(`specialty` 에 `tarot`)에게, **카드를 물었을 때만** 뽑는다 —
                  *     아무 때나 뽑으면 그게 «뜬금없음» 이다(이미지에서 이미 겪은 판단).
                  *   ★값은 **무료**(Boss) — 카드는 우리가 뽑으므로 추가 원가가 없다.
                  */
                 (cur.specialty?.includes('tarot') && wantsCards(q)) ? drawThree() : null)
      .then((r) => {
        // 답을 기다리는 동안 대화를 지웠거나 다른 방으로 옮겼다 — **버린다.**
        //   ⚠️`setBusy(false)` 도 하지 않는다. 지금 점이 돌고 있다면 그건 **새 방의 것**이다.
        if (gen !== genRef.current) return;
        if (r.ok) {
          setSid(r.sessionId);   // 다음 턴부터 이력이 이어진다
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
          // ★초대 제안(Boss 2026-08-28) — 있으면 입력창 위에 «부를까요?» 띠가 뜬다.
          //   ⚠️덮어쓴다(누적 아님) — 마지막 제안 하나만 유효하다.
          setInviteSug(r.invite ?? null);
          // ★다인방이면 답 앞에 **누가 말했는지**를 단다 — 여럿이면 이름 없이는 누가 한 말인지 모른다.
          //   ⚠️새 필드를 만들지 않는다 — `who` 가 이미 이름·사진을 그린다(사본을 만들면 갈라진다).
          // ★★2026-08-26 — **1:1 에서도** 얼굴을 붙인다(Boss *"대화할때 상대 프로필 사진이 뜨게"*).
          //   종전엔 `!mates.length` 면 undefined 라 혼자 있는 방에서는 아무 얼굴도 안 나왔다.
          //   ★`id` 를 함께 싣는다 — 얼굴을 누르면 이 값으로 프로필을 연다.
          //   ⚠️연속으로 같은 사람이 말하면 `TalkThread` 가 알아서 **첫 풍선에만** 붙인다(카톡과 같다).
          const whoOf = (nm?: string | null) => {
            const f = [cur, ...mates].find((x) => x.name === nm) ?? (nm ? null : cur);
            return f ? { id: f.id, name: f.name, avatar: f.avatar, element: undefined } : (nm ? { name: nm } : undefined);
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
          // ★★AI 끼리 티키타카 (Boss 2026-08-27 *"AI끼리 붙이면 티키타카 5턴 이상"*)
          //   ★곁다리와 **같은 방식**으로 그린다 — 새 그리기 규칙을 만들지 않는다.
          //     다른 건 «여러 마디가 순서대로» 라는 것뿐이다.
          //   ★뜸(`typingDelay`)을 대사마다 쌓는다 — 한꺼번에 쏟으면 대화가 아니라 목록이 된다.
          //   ⚠️본문(`parts`)이 **비어 있을 수 있다**(서버가 대사만 낸다) — 그러면 바로 시작된다.
          if (r.crosstalk?.length) {
            let at = parts.reduce((a, b) => a + typingDelay(b), 0) + (parts.length ? 300 : 0);
            for (const cl of r.crosstalk) {
              const fire = at;
              timersRef.current.push(setTimeout(() => {
                sayInOrder([{ id: nextId(), role: 'assistant' as const,
                  body: cl.line, who: whoOf(cl.name) }], 0);
              }, fire));
              at += typingDelay(cl.line);
            }
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
          // ★★2026-08-26 Boss *"대화시에 운 차감이 되는게 안보여"* — **원인은 묶음 과금**이었다.
          //   `PACK_TURNS = 2` 라 **2턴에 한 번만** 빠진다 ⇒ 나머지 1턴은 `spent === 0`,
          //   그래서 화면에 아무것도 안 뜬다. 동작은 맞는데 **회원은 그걸 알 길이 없다.**
          //   ⇒ 차감된 턴에 **무엇을 샀는지**(몇 턴치인지) 함께 적는다.
          //     그러면 다음 네 턴에 아무것도 안 떠도 «아까 산 것» 으로 읽힌다.
          const spent = Number(r.spent ?? 0);
          const packN = Number(r.packTurns ?? 0);
          if (spent > 0) {
            // ⚠️★티키타카 대사가 **다 뜬 뒤**에 영수증을 놓는다 — 안 그러면 대화 도중에 끼어든다
            const wait = parts.reduce((a, b) => a + typingDelay(b), 0)
              + (r.crosstalk ?? []).reduce((a, cl) => a + typingDelay(cl.line), 0)
              + (r.banter ? 900 : 0) + 420;
            timersRef.current.push(setTimeout(() => {
              setItems((prev) => [...prev, {
                id: nextId(), role: 'assistant' as const, body: '',
                // ★★「몇 턴치」를 **뺐다**(Boss 2026-08-28 *"운사용에 몇턴치 인지는 뺴
                //   얼마사용됐는지만 노출하자"*). 영수증이 말할 것은 **얼마 나갔는가** 하나다.
                //   ⚠️묶음이라는 사실 자체는 사라지지 않는다 — 묶음의 **마지막 턴**에
                //     「다음 턴부터 다시 든다」를 따로 알린다(바로 아래 `packLast`).
                system: t('talk.spent', '{{n}}운 사용').replace('{{n}}', String(spent)),
              }]);
            }, wait));
          } else if (Number(r.packLeft ?? 0) === 1 && packN > 1) {
            // ★묶음의 **마지막 턴** — 다음 턴부터 다시 든다고 **미리** 알린다.
            //   말없이 빠지면 «언제 나갔는지 모르겠다» 가 된다(이 요청의 본질).
            // ⚠️★티키타카 대사가 **다 뜬 뒤**에 영수증을 놓는다 — 안 그러면 대화 도중에 끼어든다
            const wait2 = parts.reduce((a, b) => a + typingDelay(b), 0)
              + (r.crosstalk ?? []).reduce((a, cl) => a + typingDelay(cl.line), 0)
              + (r.banter ? 900 : 0) + 420;
            timersRef.current.push(setTimeout(() => {
              setItems((prev) => [...prev, {
                id: nextId(), role: 'assistant' as const, body: '',
                system: t('talk.packLast', '이 묶음은 여기까지예요. 다음 이야기부터 운이 들어요.'),
              }]);
            }, wait2));
          }
          // ⚠️무료 소진 안내는 **답이 다 뜬 뒤**에 붙인다 — 바로 넣으면 순차 표시를 앞질러
          //   답보다 먼저 뜬다. 마지막 풍선의 예상 시각 뒤로 미룬다.
          // ★무료 소진 — 상단 띠로 알린다(종전엔 상담가 말풍선이었다).
          //   띠는 자리가 고정이라 답을 앞지르지 않는다 ⇒ 종전의 «마지막 풍선 뒤로 미루는» 계산이 필요 없다.
          /**
           * ★★**다음 턴에 막힌다는 걸 미리 알린다**(Boss 2026-08-31
           *   *"그이하의 운일경우면서 무료횟수 다 차감하면 운 충전해야한다고 말해"*).
           *   서버가 «묶음 한 턴 남았는데 잔액이 모자라다»(`lowBalance`)를 보낼 때만 뜬다.
           *   ⚠️무료 안내보다 **먼저** 본다 — 둘 다 해당되면 «막힌다» 가 더 급한 소식이다.
           */
          if (r.lowBalance) {
            setNotice({
              kind: 'need',
              text: t('talk.lowBalance', '운이 {{have}}개 남았어요. 다음 이야기부터는 {{cost}}운이 필요해요.')
                .replace('{{have}}', String(r.lowBalance.balance))
                .replace('{{cost}}', String(r.lowBalance.nextCost)),
              action: t('coins.charge', '운 충전하기'),
            });
          } else if (r.overFree && r.used === r.freeDaily + 1) {
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
            body: t('talk.needLoginBubble', '{{name}}{{josa}}. 이야기를 이어가려면 로그인이 필요해요. 회원님 명식을 봐야 제대로 답해 드릴 수 있거든요.')
              .replace('{{name}}', cur.name).replace('{{josa}}', ieyo(cur.name)),
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
        } else if (r.reason === 'failed') {
          /**
           * ★★**사과하기 전에 되찾아온다** (Boss 2026-08-30
           *   *"답은 나왔는데 텍스트는 저렇게떠. 그러고 다시 들어가면 답이 생성 되어있어"*).
           *
           * ■ 계측이 말한 것: `talk_fail` 의 `status`·`code` 가 **둘 다 null** 이다
           *   = HTTP 응답이 **아예 안 왔다**(연결이 끊겼다). 서버는 그동안 답을 다 만들어 **저장**한다.
           *   즉 «실패» 가 아니라 **«우리가 못 받은 것»** 이다 — 방을 다시 열면 답이 있다.
           * ■ ⇒ 잠시 뒤 이력을 다시 읽어 **마지막이 상담가 말이면 방을 그대로 복원**한다.
           *   ★복원은 `open()` 을 다시 부른다 — 이력을 그리는 규칙이 **한 벌**이라야
           *     처음 볼 때와 다시 볼 때가 달라지지 않는다(쪼개기·얼굴 붙이기가 그 안에 있다).
           * ■ ⚠️점 세 개를 **끄지 않는다** — 되찾는 동안에도 «아직 오는 중» 이 맞다.
           */
          const sidNow = curSidRef.current;
          const failMsg = r.message;
          const giveUp = () => {
            setBusy(false);
            setItems((prev) => [...prev, { id: nextId(), role: 'assistant', body: failMsg }]);
          };
          timersRef.current.push(setTimeout(() => {
            void withTimeout(loadThread(cur.id, sidNow), 8000).then((th) => {
              const msgs = th?.messages ?? [];
              const last = msgs[msgs.length - 1];
              if (last && last.role === 'assistant') open(cur);   // 답이 와 있다 — 그대로 복원
              else giveUp();
            }).catch(giveUp);
          }, 1500));
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
        setBusy(false);
        /**
         * ⚠️★★여기서 **화면에 아무것도 안 띄우고 있었다**(Boss 2026-08-31
         *   *"네트워크 관련에러는 채팅에 네트워크 에러라고 띄워야해"*).
         *   `console.warn` 만 하고 끝나서, 망이 끊기면 **점 세 개만 사라지고** 아무 말이 없었다.
         *   ⇒ 사용자는 «내가 뭘 잘못 눌렀나» 를 의심한다. 실패는 **실패라고 말해야** 한다.
         * ★사유를 **가르쳐 준다** — 망 문제와 서버 문제는 사용자가 할 일이 다르다
         *   (망이면 «잠깐 뒤 다시», 그 외면 «우리 쪽 문제»).
         * ⚠️로그는 그대로 남긴다 — 화면에 띄운다고 기록을 버리지 않는다.
         */
        console.warn('[talk] send 실패', e);
        const msg = String((e as any)?.message ?? e);
        const offline = /network|fetch|failed to fetch|timeout|시간|연결|abort/i.test(msg);
        setItems((prev) => [...prev, { id: nextId(), role: 'assistant',
          body: offline
            ? t('talk.netErr', '네트워크 오류예요. 연결을 확인하고 다시 보내 주세요.')
            : t('talk.sendErr', '보내지 못했어요. 잠시 뒤 다시 시도해 주세요.') }]);
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
    ? <ChatList selectedId={curSid ?? undefined} wide onOpenProfile={setProfile} onSettings={() => router.push('/settings')}
                onOpen={(r) => {
                  // ⚠️★사람 방은 `consultantId` 가 **null** 이다 — 상담가를 찾으면 못 찾고
                  //   **조용히 아무 일도 안 난다**(＋ 버튼이 웹에서 죽어 있던 것과 같은 유형).
                  if (!r.consultantId) { setUserRoom(r.sessionId); setCur(null); setSid(null); setMates([]); setItems([]); return; }
                  setUserRoom(null);
                  const c = list.find((x) => x.id === r.consultantId); if (c) open(c, r);
                }}
                onLeave={(r) => setAskLeave({ sessionId: r.sessionId, name: r.name })} />
    : <TalkList items={list} onOpen={open} selected={cur?.id} myName={myName} myAvatar={myAvatar} onOpenProfile={setProfile}
                      railKeys={order} onMe={() => setPerson({ kind: 'me', name: myName })}
                      /* ★내 사진 → **남들과 같은 프로필 창**(Boss 2026-08-29) */
                      onMyProfile={() => { const p = profileSnapshot(); setProfile({
                        name: p.name || myName || t('my.helloGuest', '안녕하세요'),
                        avatar: p.avatarUrl, cover: p.coverUrl,
                        onEdit: () => { setProfile(null); router.push('/settings'); },
                      }); }}
                      onSettings={() => router.push('/settings')}
                      onAddFriend={() => router.push('/friends')}
                      onManse={() => router.push('/charts')}
                      session={session} onLogin={() => router.push('/login')}
                      pendingCount={friends.filter((f) => f.status === 'pending' && !f.requestedByMe).length}
                      people={friends.filter((f) => f.status === 'accepted').map((f) => ({
                        id: f.otherId, name: f.name ?? '이름 없음', avatarUrl: f.avatarUrl, canSee: !!f.chartId,
                      }))}
                      onOpenPerson={(id) => { const f = friends.find((x) => x.otherId === id); setPerson({ kind: 'friend', id, name: f?.name, avatarUrl: f?.avatarUrl }); }}
                      // ★`wide` = **목록 칸이 넓은가**(화면이 넓은가가 아니다).
                      //   폰은 목록이 전체 폭이라 넓고, 웹 3칸의 왼쪽 칸은 264px 이라 좁다.
                      //   ⇒ `useWideWeb()` 의 정확히 반대다 — 헷갈리기 쉬워 적어 둔다.
                      wide={!wide} />;

  /**
   * 이 대화 지우기.
   * ★화면을 **먼저 비우지 않는다** — 서버가 실패하면 "지운 것처럼 보이는데 남아 있는" 상태가 된다.
   *   성공한 뒤에 비운다.
   */
  /**
   * 목록에서 고른 방을 **나간다** — 대화가 함께 사라진다(FK CASCADE).
   * ★지금 열린 방을 나갔으면 화면도 닫는다. 다른 방이면 **목록만** 갱신한다.
   */
  /**
   * 친구와의 사람 방을 연다(없으면 만든다).
   * ⚠️**운을 안 쓴다** — Edge 를 안 타므로 차감 코드가 아예 안 지나간다.
   */
  const openPersonRoom = useCallback(async (otherId: string) => {
    const sid = await openUserRoom(otherId);
    if (!sid) return;
    // ★상담가 방을 **비운다** — 두 화면이 동시에 살아 있으면 전송이 어디로 갈지 갈린다
    genRef.current++; clearTimers(); setBusy(false);
    setCur(null); setSid(null); setMates([]); setItems([]); setNotes([]); setJumpTo(null); setNotice(null);
    setUserRoom(sid);
    bumpChats();
  }, [bumpChats, clearTimers, setSid]);

  const onLeaveRoom = useCallback(async () => {
    const target = askLeave;
    if (!target) return;
    setAskLeave(null);
    // ★사람 방이면 **RPC 로** 나간다 — 남은 사람에게 「누가 나갔습니다」가 남아야 한다(Boss 지시).
    //   상담가 방은 그냥 지운다(*"ai일경우 그냥 바로 방을 폭파시키면 되고"*).
    //   ⚠️어느 쪽인지 화면이 판단하지 않는다 — **서버가** 인원을 세어 정하고 결과를 돌려준다.
    const viaRpc = await leaveUserRoom(target.sessionId);
    const r = viaRpc ? { ok: true } : await leaveRoom(target.sessionId);
    if (!r.ok) return;                       // ★실패하면 화면을 안 바꾼다(지운 척하지 않는다)
    if (userRoom === target.sessionId) setUserRoom(null);
    if (curSidRef.current === target.sessionId) {
      // 열려 있던 방을 나갔다 — 대화창을 닫는다(빈 화면이 «지워졌다» 는 가장 정직한 표시다)
      genRef.current++; clearTimers(); setBusy(false);
      setSid(null); setCur(null); setMates([]); setItems([]); setNotes([]); setJumpTo(null); setNotice(null);
    }
    bumpChats();
  }, [askLeave, bumpChats, clearTimers, setSid, userRoom]);

  const onDeleteThread = useCallback(async () => {
    if (!cur) return;
    const r = await deleteThread(cur.id, curSidRef.current);   // ★**이 방만** 지운다
    setAskDelete(false);
    if (!r.ok) { console.warn('[talk] 대화 삭제 실패', r.error); return; }
    setSid(null);
    // ★정리도 함께 비운다 — DB 행은 세션과 함께 cascade 로 사라지지만(0040), **화면 state 는 남는다.**
    //   안 비우면 지운 대화의 "이 대화 정리 · N" 줄이 상단에 그대로 떠 있다(Boss 2026-08-24 제보).
    //   `notesOpen` 은 건드리지 않는다 — 펴 둔 것은 **사람의 선택**이지 이 방의 상태가 아니다(위 §123).
    //   ★운 안내 띠도 같이 비운다 — 지운 대화의 「운이 모자라요」가 남으면 같은 종류의 흔적이다
    //     (`check:talknotes` ⑦ 이 이 규칙을 **불변식**으로 지킨다 — 새 state 를 넣으면 바로 문다.
    //      실제로 이 띠를 만들자마자 잡혔다.)
    // ★참여자도 비운다 — 다인방을 지웠는데 `mates` 가 남으면 머리말이 «3명» 이라고 말한다
    //   (`check:talknotes` 가 이 규칙을 **불변식**으로 지킨다 — 새 state 를 넣으면 바로 문다).
    // ★친구 방도 닫는다 — 상담가 방을 지우고 남아 있으면 «지웠는데 친구 방이 뜬다» 가 된다
    //   (2026-08-31 `check:talknotes` ⑦ 이 새 state 를 넣자마자 잡았다 — 불변식이 일한 자리다).
    setNotes([]); setJumpTo(null); setNotice(null); setMates([]); setUserRoom(null);
    // ★진행 중이던 것도 멈춘다 — 안 그러면 지운 대화의 흔적이 새 화면에서 계속 움직인다:
    //   `clearTimers` 순차 표시·무료소진 안내 타이머 / `setBusy(false)` 점 세 개 / `genRef` 날아간 응답.
    //   (`open` 이 방을 바꿀 때 하는 것과 같다 — 여기만 빠져 있었다.)
    genRef.current++; clearTimers(); setBusy(false);
    // 인사말만 남긴다 — 빈 화면보다 "다시 시작할 수 있다"가 낫다
    setItems([{ id: nextId(), role: 'assistant',
      // ⚠️★**두 번째 인사 구현**이었다(2026-08-28 실측). `greetingFor` 를 고쳤는데
      //   화면에는 「나비이에요」가 그대로 떴다 — 여기가 따로 조립하고 있었기 때문이다
      //   ([[duplicate-ui-single-source]]). 조사는 `ieyo()` **한 곳**에서만 정한다.
      body: t('talk.liveGreet', '안녕하세요. {{name}}{{josa}}. 무엇이 궁금하세요?')
        .replace('{{name}}', cur.name).replace('{{josa}}', ieyo(cur.name)) }]);
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
    // ★답하는 중에도 포커스를 유지한다 — 이제 입력칸이 안 막히므로(위 `editable`) 커서를 뺏지 않는다
    // ⚠️한 틱 미뤄야 한다 — 방을 막 그린 프레임에서는 입력칸이 아직 붙기 전이다
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [cur?.id, cur?.block, busy]);

  /**
   * ★★«최자미 님을 불러올까요?» 띠 (Boss 2026-08-28)
   *   *"노쎔한테 자미두수를 물어보면 최자미를 초대해서 물어볼까? 이런식으로 해서 초대해서 하게"*
   *
   * ■ ★**말이 아니라 버튼**이어야 한다 — 답 안에 「최자미 님이 잘 보세요」라고 글로만 두면
   *   회원이 할 수 있는 일이 없다. 한 번 눌러서 그 사람이 이 자리에 오게 한다.
   * ■ ⚠️**자동으로 부르지 않는다.** 말없이 사람이 늘면 그건 내 방이 아니게 된다.
   * ■ ⚠️초대는 `openGroupRoom` **한 곳**에서만 한다 — 초대 시트와 같은 함수다
   *   (각자 구현하면 «시트로 부른 방» 과 «버튼으로 부른 방» 이 달라진다 · [[duplicate-ui-single-source]]).
   */
  /**
   * ★★**안내자는 넘기고 빠진다** (Boss 2026-08-30
   *   *"나비가 동의를 구하고 해당 관련 선생님을 초대하고 본인은 방을 나가서
   *     사실상 1:1 대화가 만들어지는 상황이 돼야해"*).
   *
   * ■ 종전엔 누구든 초대 = **그 사람을 이 방에 추가**(다인방)였다. 안내자한테는 그게 어색하다 —
   *   길만 알려 주는 사람이 상담 내내 옆에 앉아 있는 꼴이고, 화자 지목·티키타카까지 얽힌다.
   * ■ ⇒ 안내자(`guide`)가 넘길 때는 **담당자와 1:1** 을 연다. 안내자는 그 방에 없다.
   *   ★`open()` 을 그대로 쓴다 — 그 안에 «기존 1:1 이력이 있으면 그걸 연다» 가 이미 들어 있어
   *     (2026-08-30 수정) 넘어간 방이 **처음이 아니면 지난 대화가 그대로 이어진다.**
   * ■ 문구도 갈라야 한다 — 「불러올까요?」 는 **같이 있게 된다**는 뜻이라 넘기기와 다르다.
   */
  const curIsGuide = ((Array.isArray((cur as any)?.specialty) ? (cur as any).specialty : []) as unknown[])
    .map(String).includes('guide');
  const inviteBar = inviteSug && cur ? (
    <View style={styles.inviteBar}>
      <Text style={styles.inviteTx} numberOfLines={1}>
        {(curIsGuide
          ? t('talk.handoffAsk', '{{name}} 님에게 연결해 드릴까요?')
          : t('talk.inviteAsk', '{{name}} 님을 불러올까요?')).replace('{{name}}', inviteSug.name)}
      </Text>
      <PressableScale style={styles.inviteYes} onPress={async () => {
        const who = inviteSug; setInviteSug(null);
        if (!who) return;
        if (curIsGuide) {
          // ★넘기기 — 안내자는 빠지고 담당자와 **1:1**. 방을 새로 만들지 않는다.
          const target = servers.find((x) => x.id === who.id);
          if (target) { open(target); bumpChats(); }
          return;
        }
        const sid2 = await openGroupRoom(cur.id, [who.id], chartId);
        if (!sid2) return;                       // 실패해도 지금 방은 그대로다(막지 않는다)
        open(cur, { sessionId: sid2, guestIds: [who.id] });
        bumpChats();
      }}>
        <Text style={styles.inviteYesTx}>
          {curIsGuide ? t('talk.handoffYes', '연결하기') : t('talk.inviteYes', '초대하기')}
        </Text>
      </PressableScale>
      <PressableScale hitSlop={8} style={styles.inviteNo} onPress={() => setInviteSug(null)}>
        <Text style={styles.inviteNoTx}>✕</Text>
      </PressableScale>
    </View>
  ) : null;

  const composer = !cur?.block && (cur?.kind === 'virtual' || cur?.kind === 'live') ? (
    <View>
    {inviteBar}
    {/* ★2026-08-28 — 입력칸 **아래 여백을 걷어냈다**(Boss *"택스트필드 아래 여백이 너무 많아"*).
        ⚠️여기서 `insets.bottom`(홈 인디케이터 34pt)을 **또** 넣고 있었다. 그런데 이 화면 아래에는
          `_layout` 이 깔아 둔 **네비바가 이미** 있고, 안전영역은 그 네비바가 진다.
          ⇒ 같은 여백을 두 번 넣은 것이다 — 08-28 오전 「태어난 시 찾기」가 잘린 것과 **같은 종류**의 실수다.
        ★키보드가 올라온 동안에도 필요 없다 — 그때는 키보드가 그 자리를 덮는다.
        ⚠️★이 주석을 중괄호 없이 적었다가 `check:rawtext` 에 잡혔다 — JSX 자식 자리의 맨 블록주석은
          **날 글자**라 네이티브에서 화면이 통째로 죽는다. 주석도 반드시 중괄호 안에. */}
    <View style={[styles.composer, { paddingBottom: space(3), marginBottom: lift }]}>
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
        // ⚠️★`onSubmitEditing={send}` 로 두면 **이벤트 객체가 `override` 로 들어간다**(그러면
        //   `[object Object]` 를 보낸다). 인자 없이 부른다.
        onSubmitEditing={() => send()}
        // ⚠️★`editable={!busy}` 를 **뺐다** — 답하는 중에도 칠 수 있어야 한다(Boss 2026-08-27).
        //   보낸 것은 `pendingRef` 에 쌓였다가 지금 턴이 끝나면 **한 번에** 나간다.
        editable
        returnKeyType="send"
      />
      <PressableScale style={styles.sendBtn} onPress={() => send()}>
        <Text style={styles.sendTx}>{t('talk.send', '보내기')}</Text>
      </PressableScale>
    </View>
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
      rows={[
        ...myCharts.map((c) => ({
          id: c.id, name: c.label, relation: c.relation, source: 'mine' as const,
          // ⚠️생일은 **고를 때 구분하려고** 화면에만 쓴다 — 서버로는 안 나간다(ADR-005)
          born: String(c.input?.birthDateTime ?? '').slice(0, 10),
        })),
        // ★친구 — **생일이 없다**(암호화돼 앱에 안 온다). 그래서 그 자리에 출처를 적는다.
        //   ⚠️공개 안 한 친구도 **보여 주되 못 고르게** 한다. 숨기면 «왜 안 보이지» 가 된다.
        ...mentionTargets.filter((m) => m.source === 'friend').map((m) => ({
          id: m.id, name: m.name, relation: '친구', source: 'friend' as const, born: undefined,
        })),
        ...friends.filter((f) => f.status === 'accepted' && !f.chartId).map((f) => ({
          id: f.otherId, name: f.name?.trim() || '이름 없음', relation: '친구',
          source: 'friend' as const, born: undefined, disabled: true,
          note: '아직 명식을 공개하지 않았어요',
        })),
      ]}
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
      {/* ⚠️★나가기 확인은 **여기**(화면 루트)에 있어야 한다.
          처음엔 대화창 안에 뒀는데, 방이 안 열려 있으면 그 칸 자체가 안 그려져
          **목록에서 우클릭해도 아무 일이 안 났다**(실측으로 잡았다 — 핸들러는 붙어 있었다).
          ＋ 버튼이 웹에서 죽어 있던 것과 **같은 유형**이다(`check:talkoverlay`). */}
      {askLeave ? <LeaveBar name={askLeave.name} onCancel={() => setAskLeave(null)} onOk={onLeaveRoom} t={t as never} /> : null}
      <ProfileSheet target={profile} onClose={() => setProfile(null)} />
      {/* ★사람 상세 — 내 명식·친구가 **같은 패널**이다(종전엔 두 갈래였다).
          「대화에서 부르기」는 입력창에 `@이름` 을 넣어 준다 — 화면을 안 떠나고 이어서 물을 수 있다. */}
      <PersonSheet
        target={person}
        onClose={() => setPerson(null)}
        onMention={(nm) => {
          setDraft((d) => `${d.replace(/@$/, '')}@${nm} `);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        // ★「메시지 보내기」 — 친구일 때만 의미가 있다(내 명식에는 상대가 없다)
        onMessage={person?.kind === 'friend' ? () => void openPersonRoom(person.id) : undefined}
        onMore={(route) => router.push(route as never)}
      />
      {/* ★`cur` 가드 — 이 묶음은 «대화를 고르기 전» 보다 앞에 있다. 상대가 없으면 초대할 것도 없다. */}
      {/* ★★사람 방의 ＋ 는 **친구**를 부른다(상담가가 아니라).
          Boss: *"그냥 일반 채팅방에 여러사람이 들어와있을수 있게 초대하면"*
          ⚠️서버가 «내 친구인가» 를 다시 확인한다(`invite_to_room`) — 화면 목록만 믿지 않는다. */}
      {inviteOpen && userRoom ? (
        <InviteSheet
          candidates={friends.filter((f) => f.status === 'accepted').map((f) => ({
            id: f.otherId, name: f.name ?? '이름 없음', tagline: null, avatar: f.avatarUrl,
          })) as never}
          onClose={() => setInviteOpen(false)}
          onInvite={async (ids) => {
            setInviteOpen(false);
            for (const id of ids) await inviteToRoom(userRoom, id);
            bumpChats();
          }}
        />
      ) : inviteOpen && cur ? (
        <InviteSheet
          // ★이미 방에 있는 사람은 뺀다 — 두 번 부르면 «3명» 이 되지 않는다
          candidates={servers.filter((x) => x.id !== cur.id && !mates.some((m) => m.id === x.id))}
          onClose={() => setInviteOpen(false)}
          onInvite={async (ids) => {
            setInviteOpen(false);
            const sid = await openGroupRoom(cur.id, ids, chartId);
            if (!sid) return;                       // 실패해도 지금 방은 그대로다(막지 않는다)
            // ★★**새 방으로 갈아탄다** — 종전엔 세션만 바꾸고 화면은 그대로 둬서
            //   «새 방인데 1:1 대화가 그대로 남아 있는» 상태가 됐다(Boss 2026-08-27 제보).
            //   방이 바뀌면 화면도 바뀌어야 한다. `open()` 이 그 일을 이미 한 곳에서 한다.
            open(cur, { sessionId: sid, guestIds: ids });
          }}
        />
      ) : null}
    </>
  );

  if (wide) {
    return (
      <View style={styles.two}>
        {/* ★★칸 폭을 **쓰는 사람이 정한다** (Boss 2026-08-27 · 위 `paneW` 주석)
            접히면 폭 0 — 그래도 옆의 손잡이는 남아 다시 열 수 있다. */}
        <View style={[styles.pane, {
          paddingTop: renderTop ? 0 : insets.top,
          width: paneOpen ? paneW : 0,
          // ⚠️접었을 때 테두리까지 남으면 «빈 줄» 이 하나 더 보인다
          borderRightWidth: paneOpen ? 1 : 0,
        }]}>
          {/* 접힌 동안에는 **안을 그리지 않는다** — 폭 0 에 밀어 넣으면 글자가 세로로 눌린다 */}
          {paneOpen ? renderTop : null}
          {/* 웹 3칸 = 좁은 칸(`wide={!wide}`) */}
          {paneOpen ? (
          <TalkList items={list} onOpen={open} selected={cur?.id} myName={myName} myAvatar={myAvatar} onOpenProfile={setProfile}
                      railKeys={order} onMe={() => setPerson({ kind: 'me', name: myName })}
                      /* ★내 사진 → **남들과 같은 프로필 창**(Boss 2026-08-29) */
                      onMyProfile={() => { const p = profileSnapshot(); setProfile({
                        name: p.name || myName || t('my.helloGuest', '안녕하세요'),
                        avatar: p.avatarUrl, cover: p.coverUrl,
                        onEdit: () => { setProfile(null); router.push('/settings'); },
                      }); }}
                      onSettings={() => router.push('/settings')}
                      onAddFriend={() => router.push('/friends')}
                      onManse={() => router.push('/charts')}
                      session={session} onLogin={() => router.push('/login')}
                      pendingCount={friends.filter((f) => f.status === 'pending' && !f.requestedByMe).length}
                      people={friends.filter((f) => f.status === 'accepted').map((f) => ({
                        id: f.otherId, name: f.name ?? '이름 없음', avatarUrl: f.avatarUrl, canSee: !!f.chartId,
                      }))}
                      onOpenPerson={(id) => { const f = friends.find((x) => x.otherId === id); setPerson({ kind: 'friend', id, name: f?.name, avatarUrl: f?.avatarUrl }); }} wide={!wide} footer={renderBottom} />
          ) : null}
        </View>
        {/* ★★손잡이 — 끌면 폭이 바뀌고, 누르면 접혔다 펴진다.
            ⚠️접혀도 **이 막대는 남는다** — 0 으로 만들면 다시 열 길이 사라진다(Boss 지시의 핵심). */}
        <Resizer
          width={paneOpen ? paneW : 0}
          min={PANE_MIN}
          max={PANE_MAX}
          collapsed={!paneOpen}
          onResize={(w) => { if (!paneOpen && w > 0) setPaneOpen(true); setPaneWSaved(Math.max(0, Math.min(w, PANE_MAX))); }}
          onToggle={() => {
            // ★펼 때 폭이 하한보다 좁게 남아 있으면 **기본값으로 되돌린다** — 폈는데 여전히
            //   글자가 눌려 있으면 «안 열린» 것으로 보인다.
            if (!paneOpen && paneW < PANE_MIN) setPaneWSaved(PANE_DEFAULT);
            setPaneOpen((v) => !v);
          }}
        />
        {showChatPane && (
          <View style={[styles.pane, { paddingTop: insets.top }]}>
            <ChatList reloadKey={chatsTick} selectedId={curSid ?? undefined} wide={false} onOpenProfile={setProfile}
                      onSettings={() => router.push('/settings')}
                      onOpen={(r) => {
                  // ⚠️★사람 방은 `consultantId` 가 **null** 이다 — 상담가를 찾으면 못 찾고
                  //   **조용히 아무 일도 안 난다**(＋ 버튼이 웹에서 죽어 있던 것과 같은 유형).
                  if (!r.consultantId) { setUserRoom(r.sessionId); setCur(null); setSid(null); setMates([]); setItems([]); return; }
                  setUserRoom(null);
                  const c = list.find((x) => x.id === r.consultantId); if (c) open(c, r);
                }}
                      onLeave={(r) => setAskLeave({ sessionId: r.sessionId, name: r.name })} />
          </View>
        )}
        <View style={styles.main}>
          {/* ★★사람 방이 열려 있으면 **그것만** 그린다(Boss 2026-08-27).
              상담가 방과 동시에 뜨지 않는다 — 전송이 어디로 갈지 갈리기 때문이다. */}
          {userRoom ? (
            <UserRoomView
              sessionId={userRoom}
              myId={session?.user?.id ?? ''}
              onInvite={() => setInviteOpen(true)}
              onLeave={() => setAskLeave({ sessionId: userRoom, name: t('room.this', '이 대화') })}
            />
          ) : cur ? (
            <>
              <View style={styles.head}>
                <View style={styles.headMid}>
                  <Text style={styles.headTx} numberOfLines={1}>
                    {mates.length ? roomTitle(roomMembers(t('cp.me', '나'), [cur.name, ...mates.map((m) => m.name)])) : cur.name}
                  </Text>
                  {mates.length ? <Text style={styles.headNum}>{roomMembers(t('cp.me', '나'), [cur.name, ...mates.map((m) => m.name)]).length}</Text> : null}
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
                title={cur?.name}
                onJump={(mid) => {
                  // ★뛰기 전에 정리 패널을 **접는다** — 펼쳐진 채로 스크롤하면 목적지가 그 밑에 가려
                  //   «아무 일도 안 일어난 것»으로 보인다(Boss 2026-08-25 제보 자리).
                  setNotesOpen(false);
                  setJumpTo(null); requestAnimationFrame(() => setJumpTo(mid));
                }}
                onChanged={() => refreshNotes(curSid)}
              />
              {/* ★운 안내 — 목록 **위**에 고정. 말풍선과 자리·색이 둘 다 다르다(Boss 2026-08-25) */}
              {notice ? (
                <CoinNotice
                  kind={notice.kind} text={notice.text} action={notice.action}
                  onAction={notice.action ? () => { setNotice(null); router.push('/coins'); } : undefined}
                  onClose={() => setNotice(null)}
                />
              ) : null}
              <TalkThread
        items={items} busy={busy} onLink={(r) => router.push(r as never)} jumpTo={jumpTo}
        /* ★얼굴을 누르면 프로필 — 목록에서 여는 것과 **같은 창**이다(두 갈래면 내용이 갈린다) */
        onWho={(id) => { const f = servers.find((x) => x.id === id); if (f) setProfile(toProfileTarget(f)); }}
      />
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

  // ★사람 방은 **폰에서도 같은 컴포넌트**로 그린다 — 두 벌을 만들면 문구·동작이 갈린다
  if (userRoom) {
    return (
      <View style={styles.one}>
        <UserRoomView
          sessionId={userRoom}
          myId={session?.user?.id ?? ''}
          onBack={() => setUserRoom(null)}
          onInvite={() => setInviteOpen(true)}
          onLeave={() => setAskLeave({ sessionId: userRoom, name: t('room.this', '이 대화') })}
        />
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
      {/* ⚠️★★여기 `{overlays}` 가 **없었다**(Boss 2026-08-31 *"앱에서 프로필 눌러도 반응이 없어"* ·
            *"둘 다"*). 얼굴을 누르면 `profile` 상태는 바뀌는데 **띄울 것이 이 화면에 없어**
            아무 일도 안 났다 — 손가락도, 핸들러도, 상태도 멀쩡했다.
          ■ 왜 웹은 멀쩡했나 — 넓은 웹은 위쪽 `wide` 분기(1668행)를 타고, 그쪽엔 `overlays` 가 있다.
            ⇒ **내가 잴 수 있는 면에서만 멀쩡한** 종류였다(Boss 지적 *"웹이랑 앱이 대응이 한번
              수정으로 제대로 안되고 있는거 같아"* 의 실례).
          ■ ★같은 조각을 쓰는 return 이 **넷**이다(wide · userRoom · 목록 · 대화방).
            하나만 빠져도 그 화면에서만 조용히 죽는다 — `check:talkoverlay` 가 이제 넷을 다 센다. */}
      {overlays}
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
            {mates.length ? roomTitle(roomMembers(t('cp.me', '나'), [cur.name, ...mates.map((m) => m.name)])) : cur.name}
          </Text>
          {mates.length
            ? <Text style={styles.headNum}>{roomMembers(t('cp.me', '나'), [cur.name, ...mates.map((m) => m.name)]).length}</Text>
            : null}
        </View>
        {/* ★★＋ 를 **글자에서 SVG 아이콘으로** 바꿨다(Boss 2026-08-30 *"크기 키워"*).
            ⚠️글리프(`＋`)는 fontSize 를 올려도 **그만큼 안 커진다** — `⌕` 가 fontSize 26 인데
              실제 12px 로 그려진 이력이 있다([[glyph-icons-dont-scale]]). 옆 휴지통은 이미 `Icon` 이라
              둘의 크기 기준도 서로 달랐다. ⇒ 같은 원본·같은 size 로 맞춘다.
            ★`marginRight` = 휴지통에서 **더 떼어 놓는 것**(Boss *"왼쪽으로 좀더 옮기고"*). */}
        <PressableScale hitSlop={10} style={styles.headAddBtn} onPress={() => setInviteOpen(true)}>
          <Icon name="plus" size={30} />
        </PressableScale>
        <PressableScale hitSlop={8} onPress={() => setAskDelete(true)}>
          <Icon name="trash" size={25} />
        </PressableScale>
      </View>
      {askDelete ? <DeleteBar onCancel={() => setAskDelete(false)} onOk={onDeleteThread} t={t as never} /> : null}
      <TalkNotes
        notes={notes} open={notesOpen} onToggle={() => setNotesOpen((v) => !v)}
        title={cur?.name}
        onJump={(mid) => { setJumpTo(null); requestAnimationFrame(() => setJumpTo(mid)); }}
        onChanged={() => refreshNotes(curSid)}
      />
      <TalkThread
        items={items} busy={busy} onLink={(r) => router.push(r as never)} jumpTo={jumpTo}
        /* ★얼굴을 누르면 프로필 — 목록에서 여는 것과 **같은 창**이다(두 갈래면 내용이 갈린다) */
        onWho={(id) => { const f = servers.find((x) => x.id === id); if (f) setProfile(toProfileTarget(f)); }}
      />
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
  headAdd: { ...font.heading, color: colors.ink, fontWeight: '700', paddingHorizontal: space(1) },   // (넓은 웹 갈래가 아직 쓴다)
  // ★휴지통과 벌리는 간격 — 헤더 `gap: space(2)` 에 더해진다(Boss 2026-08-30)
  headAddBtn: { marginRight: space(2) },
  headIcon: { paddingHorizontal: space(1) },   // ★그림은 `kit/Icon` 이 그린다(크기는 거기서)
  // 삭제 확인 — 눌린 자리 바로 아래
  delBar: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), paddingVertical: space(3), backgroundColor: colors.sunk, borderBottomWidth: 1, borderBottomColor: colors.line },
  // ★웹 — 가운데. 어둠막 + 카드(Boss 2026-08-27)
  leaveScrim: {
    ...StyleSheet.absoluteFillObject, zIndex: 80,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  leaveCard: {
    maxWidth: 420, width: '86%', backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: space(6), paddingVertical: space(5), gap: space(4),
  },
  leaveTitle: { ...font.body, color: colors.ink, lineHeight: 22 },
  // ★버튼은 **오른쪽**에 모은다 — «취소 · 나가기» 순서(파괴적인 쪽이 마지막)
  // ★되돌릴 수 없는 일 — 색으로 구분한다(본문과 같은 회색이면 안 읽힌다)
  leaveWarn: { ...font.caption, color: colors.ju, marginTop: space(1.5), fontWeight: '700' },
  leaveBtns: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space(2) },
  // 폰 — 화면 **아래에 붙는다**(손가락이 닿는 자리)
  leaveBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 70,
    borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  delTx: { ...font.caption, color: colors.inkSoft },
  delNo: { paddingHorizontal: space(3), paddingVertical: space(1.5) },
  delNoTx: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  delYes: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.5) },
  // ★강조색 위 글자는 `onJu`(`check:onaccent`)
  delYesTx: { ...font.caption, color: colors.onJu, fontWeight: '900' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTx: { ...font.body, color: colors.inkFaint },

  // ★명식 만들기 카드 — 입력창 **바로 위**. 대화 흐름을 끊지 않으면서 늘 손에 닿는 자리다
  birthCardWrap: { paddingHorizontal: space(4), paddingBottom: space(2) },
  // ★초대 제안 띠 — 입력창 **바로 위**. 답을 다 읽은 눈이 그대로 내려오는 자리다.
  inviteBar: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    paddingHorizontal: space(4), paddingVertical: space(2),
    backgroundColor: colors.juSoft, borderTopWidth: 1, borderTopColor: colors.juLine,
  },
  inviteTx: { ...font.caption, color: colors.ink, flex: 1, minWidth: 0 },
  inviteYes: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3.5) },
  inviteYesTx: { ...font.caption, color: colors.onJu, fontWeight: '800' },
  inviteNo: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  inviteNoTx: { fontSize: 13, color: colors.inkFaint, fontWeight: '800' },
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
