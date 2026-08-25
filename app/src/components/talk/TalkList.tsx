// app/src/components/talk/TalkList.tsx — 카톡형 친구목록
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-19: *"친구목록은 친구 프로필사진 이름 이렇게 되어있고 상단에는 내가 설정한 이름이"*
//
// ■ 한 줄에 **사진과 이름만** 둔다
//   종전엔 한 줄 소개와 역할(안내/상담)까지 적었다. 카톡 친구목록은 그러지 않는다 —
//   ★설명이 붙는 순간 '목록'이 아니라 '메뉴'가 된다. 무엇을 하는 사람인지는 들어가서 알면 된다.
//   ⚠️역할 표시를 뺀 대신, **가상인지 사람인지**는 대화 안에서 분명히 드러나야 한다(아래 TalkThread).
//
// ■ 상단 = 내 프로필
//   대표 명식의 이름(`label`)이다. 카톡에서 맨 위가 '나'인 것과 같은 자리.
//   ★없으면(명식 미등록·비로그인) 이름 대신 등록으로 데려간다 — 빈 자리를 두지 않는다.
//
// ■ 프로필 사진
//   ⚠️Boss 2026-08-19: *"이미지는 실사로 뽑을꺼야 추후에"* — 지금은 자리를 비워 두고
//   오행 색 + 이름 첫 글자로 버틴다. `avatar` 컬럼에 경로가 들어오면 그때부터 사진이 뜬다.
//   ★색은 id 로 **고정 배정**한다. 매번 달라지면 사람이 얼굴로 못 외운다.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { ProfileSheet, type ProfileTarget } from './ProfileSheet';   // 카카오톡식 프로필 창(Boss 08-26)
import { Swipeable } from 'react-native-gesture-handler';
import type { HomeBlockKey } from '../../lib/ui/homeOrder';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';
import type { Consultant } from '../../lib/talk/consultants';
import { loadFavorites, subscribeFavorites, toggleFavorite, isFavorite, isPinned } from '../../lib/talk/favorites';
import { Icon } from '../kit/Icon';   // 상단 아이콘 단일 원본(Boss 2026-08-24)

const FALLBACK_EL = ['木', '火', '土', '金', '水'] as const;

/**
 * 목록 전체를 보고 **서로 겹치지 않는 한 글자**를 뽑는다.
 *
 * ★★왜 첫 글자를 그냥 쓰면 안 되나 (2026-08-19 실물에서 잡힘)
 *   「오늘의 운세」와 「오늘의 관계」가 둘 다 '오', 「나는 어떤 사람인가」와 「나의 성격유형」이
 *   둘 다 '나' 였다. **얼굴이 겹치면 카톡 친구목록에서 사람을 못 찾는다.**
 *   이 저장소는 같은 실패를 이미 겪었다 — 리스트 아이콘 폴백이 여섯 줄 중 다섯 줄에 같은 하트를 냈다.
 *   같은 폴백, 같은 결과다: **한 줄만 보면 멀쩡한데 여러 줄을 함께 보면 무너진다.**
 *
 * 어떻게 고르나: 어절의 첫 글자들을 후보로 두고, 아직 안 쓰인 것을 앞에서부터 집는다.
 *   「오늘의 관계」 → 후보 [오, 관] → '오'는 위에서 썼으니 '관'.
 *
 * @param names 목록에 보이는 이름들(순서대로)
 * @returns 같은 순서의 한 글자 배열
 */
export function initialsFor(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((n) => {
    const cands = n.split(/\s+/).filter(Boolean).map((w) => w[0]);
    // 어절 후보가 다 겹치면 이름의 남은 글자들까지 훑는다(그래도 없으면 첫 글자로 돌아간다)
    const all = [...cands, ...n.replace(/\s/g, '').split('')];
    const pick = all.find((ch) => ch && !used.has(ch)) ?? (n[0] ?? '·');
    used.add(pick);
    return pick;
  });
}

/**
 * 아바타 — 사진이 있으면 사진, 없으면 오행 색 + 한 글자.
 *
 * @param slot 목록 안 순번. ★해시가 아니라 **순번**으로 색을 돌린다 —
 *   해시는 우연히 몰린다(실물에서 열다섯 중 대부분이 청록·청흑 둘로 갔다).
 *   순번이면 다섯 색이 고르게 돈다. 사진이 들어오면 어차피 사라지는 임시 얼굴이다.
 */
function Avatar({ name, initial, slot, uri, size = 48, element }: {
  name: string; initial?: string; slot: number; uri?: string | null; size?: number;
  /** 이 얼굴의 오행을 **직접** 지정(내 프로필 = 대표 명식 오행). 없으면 순번으로 돈다 */
  element?: string;
}) {
  const st = { width: size, height: size, borderRadius: size * 0.32 };
  // ⚠️`A()` 를 쓰지 않는다 — `consultants.fromRow` 가 **이미 공개 URL** 로 바꿔 놨다.
  //   여기서 또 감싸면 `assets/img/` 버킷을 가리켜 404 가 나고 조용히 안 뜬다.
  if (uri) return <ExpoImage source={{ uri }} style={st} contentFit="cover" transition={140} />;
  const el = element ?? FALLBACK_EL[slot % FALLBACK_EL.length];
  return (
    <View style={[st, { backgroundColor: elementColor[el], alignItems: 'center', justifyContent: 'center' }]}>
      {/* ★글자색은 `elementText` — **이미 있는 표**다. 흰 글자로 통일하면 金(#D2CCBA)에서 안 읽힌다. */}
      <Text style={{ color: elementText[el], fontWeight: '900', fontSize: size * 0.4 }}>{initial ?? name.slice(0, 1)}</Text>
    </View>
  );
}

/**
 * 친구 한 줄 — 즐겨찾기 칸과 일반 칸이 **같은 컴포넌트**를 쓴다.
 * ★두 벌로 만들면 한쪽만 고쳐져 같은 친구가 위아래에서 다르게 보인다.
 *
 * @param slot 얼굴색 자리(전체 목록 기준 — 즐겨찾기로 올라가도 얼굴이 안 바뀐다)
 */

function Row({ c, initial, slot, on, onOpen, onPhoto, t }: {
  c: Consultant & { lastAt?: string | null; unread?: number }; initial?: string; slot: number; on: boolean;
  onOpen: (c: Consultant) => void;
  /** ★사진을 누르면 **대화가 아니라 프로필 창**이 뜬다(Boss 2026-08-26 카카오톡식) */
  onPhoto: (c: Consultant, element: string) => void;
  t: (k: string, d?: string) => string;
}) {
  const pinned = isPinned(c.id);
  const faved = isFavorite(c.id);
  const ref = useRef<Swipeable>(null);

  /**
   * 왼쪽으로 밀면 나오는 동작 — 즐겨찾기 켜기/끄기 (Boss 2026-08-22).
   *
   * ★고정된 친구(노쌤)는 **끌 수 없다**. 실수로 빼고 "없어졌다"가 되면 우리 잘못이라,
   *   미는 것 자체를 막는다(동작이 없는 버튼을 보여 주는 것보다 낫다).
   * ⚠️누르고 나면 **스스로 닫는다** — 열린 채로 두면 다음 줄을 누르려다 이걸 또 누른다.
   */
  const renderRight = () => (
    <PressableScale
      style={styles.swipeAct}
      onPress={() => { void toggleFavorite(c.id); ref.current?.close(); }}
      accessibilityLabel={t(faved ? 'talk.unfav' : 'talk.fav', '즐겨찾기')}
    >
      {/* ★★글자가 아니라 **별**이다(Boss 2026-08-23 *"즐겨찾기라 안뜨고 별모양으로"*).
          ⚠️보이는 별은 **지금 상태**다 — 이미 됐으면 꽉찬 별(★), 해야 하면 빈 별(☆).
            '누르면 무엇이 되는가'가 아니라 '지금 어떤가'를 보여 준다(Boss 지시 그대로).
          ★보라 덩어리를 걷어냈다 — 줄을 밀면 색면이 통째로 나와 "너무 어색해" 했던 그 모양이다.
            이제 옅은 면 위에 별 하나만 뜬다. */}
      <Text style={[styles.swipeStar, faved && styles.swipeStarOn]}>{faved ? '★' : '☆'}</Text>
    </PressableScale>
  );

  const row = (
    <PressableScale style={[styles.row, on && styles.rowOn]} onPress={() => onOpen(c)}>
      {/* ★사진만 따로 눌린다 — 줄을 누르면 대화, 사진을 누르면 프로필 창.
          카카오톡이 그렇고, 사람들이 그렇게 기대한다. */}
      <PressableScale onPress={() => onPhoto(c, FALLBACK_EL[slot % FALLBACK_EL.length])} hitSlop={4}>
        <Avatar name={c.name} initial={initial} slot={slot} uri={c.avatar} />
      </PressableScale>
      <View style={styles.col}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
          {/* ★즐겨찾기 **상태 표시**는 남긴다(작은 별 하나).
              콘티엔 별이 없지만, 조작을 스와이프로 감춘 마당에 상태까지 안 보이면
              사용자는 자기가 켰는지 알 수 없다 — 그건 '없는 기능'이 된다. */}
          {faved ? <Text style={styles.favDot}>★</Text> : null}
          {/* ★채널이 있는 상담가 = **실재하는 사람**이라는 표시(Boss 2026-08-25).
              *"실제 사용자도 전문 상담가가 직접 운영하는 서비스라는걸 느껴야해"*
              ⚠️링크를 여기 걸지 않는다 — 목록에서 밖으로 나가면 대화로 못 들어온다.
                여기서는 **표시만** 하고, 링크는 대화방 첫 인사 카드가 준다. */}
          {/* ★문구를 「공식」으로(Boss 2026-08-25 «실제 상담가 말고 다른 단어로»).
              채널을 가진 = **실재하는 사람**이라는 뜻은 그대로 두되, 말이 덜 어색하다.
              ⚠️한 단어라 바꾸기 쉽다 — 다른 말을 원하면 여기만 고친다. */}
          {c.linkUrl ? <Text style={styles.realBadge}>{t('talk.officialBadge', '공식')}</Text> : null}
        </View>
        {c.tagline ? <Text style={styles.tagline} numberOfLines={1}>{c.tagline}</Text> : null}
      </View>
      {/* ★**시각은 안 그린다**(Boss 2026-08-25 *"친구목록에는 시간 안 떠도 된다"*).
          웹에서 즐겨찾기 별(스와이프 자리)과 **겹쳐 보였다**. 마지막 대화 시각이 필요한 곳은
          **대화목록(`ChatList`)**이다 — 거긴 그대로 둔다. 여기는 «누구인가»를 보는 자리다.
          ⚠️안 읽음 배지는 **남긴다** — 그건 시각이 아니라 «할 일»이라 사라지면 놓친다. */}
      {(c.unread ?? 0) > 0 ? (
        <View style={styles.rightCol}>
          {(c.unread ?? 0) > 0 ? (
            <View style={styles.unread}>
              <Text style={styles.unreadTx}>{(c.unread ?? 0) > 99 ? '99+' : c.unread}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </PressableScale>
  );

  // 고정된 친구는 스와이프 자체를 막는다(위 주석)
  if (pinned) return row;
  // ⚠️★**웹에서는 스와이프로 켤 수 없다**(Boss 2026-08-23 *"웹에서는 즐겨찾기 목록이 안나오는데"*).
  //   미는 동작은 터치 관용구다 — 마우스로는 되더라도 아무도 시도하지 않는다.
  //   실측: 웹 목록에 별이 **하나**(고정된 노쌤)뿐이었다. 켤 방법이 없으니 당연히 목록이 빈다.
  //   ⇒ 웹에서는 **누르는 별**을 준다. 같은 `toggleFavorite` 을 부르므로 결과는 한 곳으로 모인다.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.rowWrap}>
        {row}
        <PressableScale style={styles.webStar} hitSlop={8} onPress={() => { void toggleFavorite(c.id); }}
                        accessibilityLabel={t(faved ? 'talk.unfav' : 'talk.fav', '즐겨찾기')}>
          <Text style={[styles.webStarTx, faved && styles.webStarOn]}>{faved ? '★' : '☆'}</Text>
        </PressableScale>
      </View>
    );
  }
  return (
    <Swipeable ref={ref} renderRightActions={renderRight} overshootRight={false} friction={2}>
      {row}
    </Swipeable>
  );
}

/**
 * 친구목록.
 *
 * @param items    상담사들(이미 정렬돼 있다)
 * @param onOpen   눌렀을 때 → 대화 상세
 * @param selected 웹 2칸에서 지금 열려 있는 대화(폰은 undefined)
 * @param myName   상단 내 프로필에 쓸 이름(대표 명식 `label`). 없으면 등록 안내
 * @param onMe     내 프로필을 눌렀을 때(명식 관리로)
 */
// ⚠️`ContentRailBlock` 을 지웠다(2026-08-22) — 콘티 1면에 콘텐츠 레일이 없다.
//   지우기 전에 **길을 먼저 냈다**: 레일이 다루던 아홉 종을 전부 상담가 `blocks` 에 붙였다
//   (특히 `biorhythm` 은 어느 상담가에도 없어 그냥 지웠으면 도달 불가가 됐다).
//   ★`ContentRail` 컴포넌트 자체는 남아 있다 — 다른 자리에서 쓸 수 있다.

export function TalkList({ items, onOpen, selected, myName, onMe, myAvatar, railKeys = [], onSettings, onLogin, session, wide, footer,
                           onAddFriend, pendingCount = 0, people = [], onOpenPerson }: {
  /**
   * 친구목록에 뜰 사람들.
   * ★`lastAt` = **마지막으로 이야기한 시각**(`talk_session_list`). 콘티 1면의 우측 시각이자
   *   「최근」 칩의 정렬 기준이다. 이야기한 적 없으면 없다(그러면 시각도 안 뜬다).
   */
  items: (Consultant & { lastAt?: string | null; unread?: number })[];
  onOpen: (c: Consultant) => void;
  selected?: string;
  myName?: string | null;
  onMe?: () => void;
  /** 내 프로필 사진 URL(설정에서 올린 것). 없으면 오행색+글자 */
  myAvatar?: string | null;
  /** 콘텐츠 레일에 올릴 홈 블록 키(홈 순서 그대로) */
  railKeys?: readonly HomeBlockKey[];
  /** 우측 톱니 — 설정으로 */
  onSettings?: () => void;
  /** 로그인 화면으로(비로그인일 때만 상단 줄이 뜬다) */
  onLogin?: () => void;
  /** 로그인 세션 — 없으면 상단에 로그인 줄을 띄운다 */
  session?: unknown;
  /** ★목록 **맨 아래**에 붙일 것(웹 첫 방문자 설명 등).
   *  ⚠️위(`renderTop`)에 두면 목록을 화면 밖으로 밀어낸다 — 실제로 그래서 친구목록이 안 보였다
   *    (Boss 2026-08-24 *"운친구 눌려있는데 왜 친구목록이 안나와"*). 이 목록은 ScrollView 라
   *    여기 넣으면 **같이 스크롤**되고, 목록이 맨 위를 지킨다. */
  footer?: React.ReactNode;
  /** 넓은 칸인가(폰 전체 폭·웹 넓은 화면). 좁으면 배너를 숨긴다 */
  wide?: boolean;
  /** 친구 추가 화면으로 */
  onAddFriend?: () => void;
  /** 받은 친구 신청 수 — 0이면 배지를 안 그린다 */
  pendingCount?: number;
  /** 실제 사람 친구들(상담가와 **다른 섹션**에 둔다) */
  people?: { id: string; name: string; avatarUrl: string | null; canSee: boolean }[];
  /** 사람 친구를 눌렀을 때 */
  onOpenPerson?: (id: string) => void;
}) {
  const { t } = useTranslation();
  // ★검색은 **온디바이스 필터**다(Boss 손그림 2026-08-20 상단 검색바).
  //   서버로 질의하지 않는다 — 목록이 열댓 개라 왕복할 이유가 없고, 원가도 0이다.
  const [q, setQ] = useState('');
  // ★검색 아이콘을 **되살렸다**(2026-08-22) — 콘티 1면 헤더에 돋보기가 있고,
  //   "친구가 다섯이라 검색할 게 없다"던 08-20 의 근거는 **열둘이 된 지금** 더는 맞지 않는다.
  const [searchOpen, setSearchOpen] = useState(false);
  // 이번 실행 동안만 숨긴다(껐다 켜면 다시 뜬다 — 저장까지 하면 영영 못 보게 된다)
  const [loginHidden, setLoginHidden] = useState(false);
  // 콘티의 칩 — 전체 / 선생님 AI / 친구
  const [filter, setFilter] = useState<'all' | 'teacher' | 'friend' | 'recent'>('all');
  // 즐겨찾기 — 온디바이스. ★별을 누르면 **즉시** 다시 그린다(새로고침을 요구하지 않는다).
  const [favTick, setFavTick] = useState(0);
  useEffect(() => {
    void loadFavorites().then(() => setFavTick((n) => n + 1));
    return subscribeFavorites(() => setFavTick((n) => n + 1));
  }, []);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (k) return items.filter((c) => c.name.toLowerCase().includes(k));   // 검색 중엔 묶음을 가르지 않는다
    if (filter === 'all') return items;
    // ★'최근'은 **거르는 칩이 아니라 정렬 칩**이다 — 이야기한 적 있는 사람만, 최근 순으로.
    //   `lastAt` 이 없는 사람(한 번도 대화 안 함)은 빠진다. 그게 '최근'의 뜻이다.
    if (filter === 'recent') {
      return items.filter((c) => c.lastAt)
        .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
    }
    return items.filter((c) => c.group === filter);
  }, [items, q, filter]);
  // ★글자는 **보이는 목록**이 아니라 전체 기준으로 뽑는다 —
  //   검색으로 걸러질 때마다 얼굴 글자가 바뀌면 같은 친구가 다른 사람처럼 보인다.
  const allInitials = useMemo(() => initialsFor(items.map((c) => c.name)), [items]);
  const initialOf = (id: string) => allInitials[items.findIndex((c) => c.id === id)];
  // ★얼굴색은 **전체 목록 위치**로 정한다 — 즐겨찾기로 올라가도 같은 얼굴이어야 한다
  const slotOf = (id: string) => items.findIndex((c) => c.id === id) + 1;
  // 즐겨찾기/나머지 — 검색 중이면 가르지 않는다(찾는 사람이 어디 있든 한 곳에 보여야 한다)
  /**
   * 묶음별 목록 — ⚠️`splitByFavorite` 는 더 이상 쓰지 않는다(콘티에 즐겨찾기 **칸**이 없다).
   * 즐겨찾기는 이제 **묶음 안 정렬**로만 작용한다: 별 켠 사람이 자기 묶음 맨 위로.
   * ★`favTick` 에 의존시킨다 — 즐겨찾기는 모듈 전역 상태라 이게 없으면 별을 눌러도 순서가 안 바뀐다.
   */
  const byGroup = useMemo(() => {
    // ★즐겨찾기는 **위 칸으로 빠진다** — 두 곳에 같은 사람이 뜨면 "왜 두 번 있지"가 된다.
    const rest = shown.filter((c) => !isFavorite(c.id));
    return { teacher: rest.filter((c) => c.group === 'teacher'), friend: rest.filter((c) => c.group === 'friend') };
  }, [shown, favTick]);
  /** 즐겨찾기 칸 — 서버 순서 그대로(별을 켠 순서가 아니라 목록 순서라야 매번 같은 자리다). */
  const favRows = useMemo(() => shown.filter((c) => isFavorite(c.id)), [shown, favTick]);

  // ★프로필 창(카카오톡식) — 사진을 누르면 뜬다. 줄 전체를 누르면 종전대로 대화가 열린다
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const openPhoto = (c: Consultant, element: string) => setProfile({
    name: c.name, tagline: c.tagline, avatar: c.avatar, cover: c.cover,
    linkUrl: c.linkUrl, linkLabel: c.linkLabel, element,
    onTalk: () => onOpen(c),
  });

  return (
    <>
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      {/* ── 상단 — ★콘티 1면 그대로: **워드마크 좌 · 돋보기 · ⊕** ─────────────
          ⚠️★내 프로필 행(얼굴 + 이름)을 **뺐다**.
            Boss 2026-08-20 손그림에는 있었지만 **콘티(08-21) 네 면 어디에도 없다**.
            Boss 2026-08-22 *"배치 레이아웃 이런거 다 다른거같아"* → 콘티가 정본이다.
            ★내 프로필은 사라지지 않았다 — 「내 운」 탭이 콘티대로 그 자리를 맡는다.
          ⚠️돋보기를 **되살렸다**(08-20 에 뺐던 것). 콘티에 있고, 이제 친구가 열둘이라
            "검색할 게 없다"던 그때 근거가 더는 맞지 않는다. */}
      <View style={styles.topRow}>
        {/* ★★워드마크가 아니라 **내 이름**이다(Boss 2026-08-23).
            워드마크는 이 화면 **바로 위**(`index.tsx` 헤더)에 이미 있어 둘이 겹쳐 보였다 —
            *"니운내운 두번뜨는거 제일상단꺼만 남겨둬"*. 위 것을 남기고 여기는 이름으로 바꿨다.
            ★누르면 **만세력**(`/charts`)으로 간다(Boss 지시). */}
        <PressableScale style={styles.meBtn} onPress={onMe}>
          <Text style={styles.meName} numberOfLines={1}>
            {myName ?? t('talk.meNoChart', '명식 등록')}
          </Text>
        </PressableScale>
        <PressableScale hitSlop={12} style={styles.topBtn} onPress={() => setSearchOpen((v) => !v)}>
          <Icon name={searchOpen ? 'close' : 'search'} size={26} color={searchOpen ? colors.ju : colors.inkSoft} />
        </PressableScale>
        {/* 친구 추가 — ★배지로 **받은 신청 수**를 알린다(신청이 와도 모르면 친구가 안 맺어진다) */}
        <PressableScale hitSlop={12} style={styles.topBtn} onPress={onAddFriend}>
          <Icon name="plus" size={26} />
          {pendingCount > 0 ? <View style={styles.topBadge}><Text style={styles.topBadgeTx}>{pendingCount}</Text></View> : null}
        </PressableScale>
      </View>

      {/* ★로그인 유도 — **앱을 열면 바로 보이는 자리**(Boss 2026-08-25 *"로그인 유도가 없네"*).
          종전엔 `SignupNudge` 가 **콘텐츠 하단 한 곳**(하루 1회)에만 있어 눈에 안 띄었다.
          ⚠️문구는 겁주기가 아니라 **사실**이다 — 익명 계정은 이 기기에만 있어 앱을 지우면 못 되찾는다.
            (§4 부정 증폭 금지 · SignupNudge 와 같은 결로 쓴다.)
          ⚠️닫을 수 있게 둔다 — 못 닫는 배너는 광고로 읽혀 신뢰를 깎는다. */}
      {!session && !loginHidden ? (
        <PressableScale style={styles.loginBar} onPress={onLogin}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loginTx}>{t('talk.loginNudge', '로그인하면 명식과 풀이가 계정에 저장돼요.')}</Text>
            <Text style={styles.loginSub}>{t('talk.loginNudgeSub', '지금은 이 기기에만 있어요 — 앱을 지우면 되찾을 수 없어요.')}</Text>
          </View>
          <Text style={styles.loginGo}>{t('talk.loginNudgeCta', '로그인')} ›</Text>
          <PressableScale hitSlop={12} style={styles.loginX} onPress={() => setLoginHidden(true)}>
            <Icon name="close" size={16} color={colors.inkFaint} />
          </PressableScale>
        </PressableScale>
      ) : null}

      {/* ── 필터 칩 — ★콘티 1면 그대로 **넷**(전체 · 선생님 AI · 무료 친구 · 최근) ──
          ⚠️전에 '최근'을 뺐었다("운대화 탭이 이미 그 순서다"). 콘티에 있으므로 되돌렸다 —
            **콘티가 정본**이고, 내 판단으로 항목을 빼면 화면이 시안과 어긋난다(Boss 2026-08-21). */}
      {!q.trim() ? (
        <View style={styles.chips}>
          {(['all', 'teacher', 'friend', 'recent'] as const).map((k) => (
            <PressableScale key={k} style={[styles.chip, filter === k && styles.chipOn]} onPress={() => setFilter(k)}>
              <Text style={[styles.chipTx, filter === k && styles.chipTxOn]}>
                {t(`talk.filter.${k}`,
                  k === 'all' ? '전체' : k === 'teacher' ? '선생님 AI' : k === 'friend' ? '무료 친구' : '최근')}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      {/* ⚠️★배너와 콘텐츠 레일을 **뺐다** — 콘티 1면에 둘 다 없다.
          레일을 지우면 콘텐츠 아홉 종이 도달 불가가 될 뻔했다(`biorhythm` 은 어느 상담가에도
          안 붙어 있었다 — 실측). ⇒ **먼저 길을 내고 지웠다**: 고아 블록 넷을
          `free3→노쌤 · biorhythm→유리 · luck→유진 · decision→태현` 으로 붙였다.
          이제 아홉 종 전부 상담가 대화 안에서 열린다(실측 확인).
          ★"옮길 곳을 먼저 만들고 뺀다" — 이 저장소가 비싸게 배운 순서다. */}

      {/* ── 검색(접힘) ── */}
      {searchOpen ? (
      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={colors.inkFaint} />
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder={t('talk.search', '친구 검색')}
          placeholderTextColor={colors.inkFaint}
          returnKeyType="search"
          autoFocus
          // keyboard-safe: 목록 상단 검색창이라 키보드가 올라와도 가려지지 않는다
        />
      </View>
      ) : null}

      {/* ── 즐겨찾기 ──────────────────────────────────────────────
          ⚠️★2026-08-21 콘티: **따로 뜬 「즐겨찾기」 칸이 없다.** 노쌤이 「✦ 선생님 AI」 첫 줄에 그냥 있다.
            ⇒ 칸을 없앴다. 대신 즐겨찾기한 사람은 **자기 묶음 안에서 맨 위**로 올린다(아래 `byGroup`).
              그래야 콘티와 같은 모양이면서 별(즐겨찾기)이 하는 일도 남는다 —
              칸만 지우고 정렬을 안 바꾸면 별이 아무 일도 안 하는 장식이 된다. */}

      {/* ── 즐겨찾기 ────────────────────────────────────────────────────
          ★2026-08-23 되살렸다(Boss *"웹에서는 즐겨찾기 목록이 안나오는데"*).
          ⚠️★**있을 때만 그린다.** 콘티에 이 칸이 없는 건 그 화면에 즐겨찾기가 없었기 때문으로 읽는다 —
            비어 있을 때는 콘티와 **똑같은 화면**이 되고, 켠 사람에게만 칸이 생긴다.
            (어제는 칸을 통째로 없앴는데, 그러면 켜도 아무 데도 안 보인다.)
          ★검색 중에는 접는다 — 찾는 중에 고정 칸이 위를 먹으면 결과가 밀린다. */}
      {!q.trim() && favRows.length > 0 ? (
        <>
          <Text style={styles.groupHead}>{t('talk.favorites', '즐겨찾기')}</Text>
          {favRows.map((c) => (
            <Row key={`fav-${c.id}`} c={c} initial={initialOf(c.id)} slot={slotOf(c.id)}
                 on={selected === c.id} onOpen={onOpen} onPhoto={openPhoto} t={t as never} />
          ))}
        </>
      ) : null}


      {/* ── 친구 ── */}
      {/* ★두 묶음을 **나눠서** 보여 준다(콘티) — 섞으면 "사주 상담"과 "생활 친구"가 뒤엉킨다.
          칩으로 하나만 고른 상태면 머리말을 또 달지 않는다(같은 말이 두 번 뜬다). */}
      {(['teacher', 'friend'] as const).map((g) => {
        const list = byGroup[g];
        if (!list.length) return null;
        return (
          <View key={g}>
            {filter === 'all' && !q.trim() ? (
              <Text style={styles.groupHead}>
                {t(g === 'teacher' ? 'talk.groupTeacher' : 'talk.groupFriend',
                   g === 'teacher' ? '✦ 선생님 AI' : '✦ 함께하면 좋은 친구들')}
              </Text>
            ) : null}
            {/* ★이 줄이 「실제 상담가가 운영한다」를 말한다 — 배지 하나로는 안 읽힌다 */}
            {filter === 'all' && !q.trim() && g === 'teacher' ? (
              <Text style={styles.groupSub}>
                {t('talk.groupTeacherSub', '실제 상담가의 관법을 따라 답해요.')}
              </Text>
            ) : null}
            {list.map((c) => (
              <Row key={c.id} c={c} initial={initialOf(c.id)} slot={slotOf(c.id)}
                   on={selected === c.id} onOpen={onOpen} onPhoto={openPhoto} t={t as never} />
            ))}
          </View>
        );
      })}
      {/* ── 내 친구(실제 사람) ──────────────────────────────────
          ★상담가와 **다른 섹션**이다. 섞으면 "이 사람이 AI 인가 사람인가"가 흐려진다. */}
      {!q.trim() && people.length > 0 ? (
        <>
          <View style={styles.rule} />
          <Text style={styles.section}>
            {t('friends.mates', '내 친구')} {people.length}
          </Text>
          {people.map((p, i) => (
            <PressableScale key={p.id} style={styles.row} onPress={() => onOpenPerson?.(p.id)}>
              <Avatar name={p.name} slot={items.length + i + 1} uri={p.avatarUrl} />
              <View style={styles.col}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                {/* ★못 보는 이유를 적는다 — 빈 줄이면 우리 잘못인지 상대 설정인지 모른다 */}
                {!p.canSee ? <Text style={styles.sub}>{t('friends.notShared', '아직 명식을 열지 않았어요')}</Text> : null}
              </View>
            </PressableScale>
          ))}
        </>
      ) : null}

      {/* ★빈 결과를 말없이 두지 않는다 — 목록이 사라진 이유를 화면이 설명해야 한다 */}
      {q.trim() && !shown.length
        ? <Text style={styles.empty}>{t('talk.searchEmpty', '찾는 친구가 없어요.')}</Text>
        : null}
      {footer}
    </ScrollView>
    <ProfileSheet target={profile} onClose={() => setProfile(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(20) },

  // 상단 행 — 아바타 + 이름 + 아이콘들(카톡 배치)
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2), marginBottom: space(3) },
  meBtn: { flex: 1, minWidth: 0 },
  meName: { fontSize: 19, lineHeight: 26, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 },
  // ★아이콘을 키웠다(20 → 26, Boss 2026-08-20 "너무 작아"). 손끝은 44pt 를 필요로 하는데
  //   글리프가 작으면 눌러도 눌린 것 같지 않다 — 여백(hitSlop)만 넓히면 '보이지 않는 버튼'이 된다.
  // ★글자 글리프를 버리고 SVG 로 갔다(`kit/Icon`). 종전 `fontSize: 26` 은 `⌕`·`×` 가
  //   em 박스를 다 안 써서 화면에선 콩알이었다(Boss 2026-08-24). 여기는 **누를 자리**만 잡는다.
  topBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topIconOn: { color: colors.ju },
  topBadge: { position: 'absolute', top: -3, right: -1, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.ju, alignItems: 'center', justifyContent: 'center' },
  topBadgeTx: { fontSize: 9.5, lineHeight: 13, fontWeight: '900', color: colors.onJu },
  sub: { ...font.caption, color: colors.inkFaint },
  banner: { marginBottom: space(3) },
  tagline: { ...font.caption, color: colors.inkFaint, marginTop: 1 },
  rightCol: { alignItems: 'flex-end', gap: 4, marginLeft: space(1) },
  when: { ...font.caption, color: colors.inkFaint },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  // 웹 전용 별 — 줄 위에 겹쳐 올린다(줄 자체 레이아웃을 건드리지 않는다)
  rowWrap: { position: 'relative' },
  webStar: { position: 'absolute', right: space(2), top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: space(1) },
  webStarTx: { fontSize: 16, color: colors.inkFaint },
  webStarOn: { color: colors.ju },
  loginBar: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.juLine,
    borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(3.5),
    marginBottom: space(2.5),
  },
  loginTx: { ...font.body, fontSize: 13, lineHeight: 19, color: colors.ink, fontWeight: '800' },
  loginSub: { ...font.caption, fontSize: 11.5, lineHeight: 17, color: colors.inkSoft, marginTop: 1 },
  loginGo: { ...font.body, fontSize: 12.5, lineHeight: 18, color: colors.ju, fontWeight: '800' },
  loginX: { paddingLeft: space(1) },
  realBadge: {
    fontSize: 9.5, lineHeight: 14, color: colors.ju, fontWeight: '800',
    backgroundColor: colors.juSoft, borderRadius: 999,
    paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
  },
  groupSub: { ...font.caption, fontSize: 11.5, lineHeight: 17, color: colors.inkFaint, marginTop: -2, marginBottom: 6, paddingHorizontal: 2 },
  favDot: { fontSize: 12, color: colors.ju },
  // 왼쪽으로 밀면 나오는 동작 — 줄 높이를 그대로 채운다(반만 차면 눌리는 곳이 좁아진다)
  // 밀면 나오는 자리 — 옅은 면 + 별 하나(색면 덩어리를 걷어냈다)
  swipeAct: {
    width: 64, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.juSoft, borderRadius: radius.md, marginVertical: 2,
  },
  swipeStar: { fontSize: 24, color: colors.inkFaint },
  swipeStarOn: { color: colors.ju },
  // 안 읽은 수 — 콘티의 보라 원. ★글자는 `onJu`(강조색 위 대비)
  unread: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: colors.ju, alignItems: 'center', justifyContent: 'center',
  },
  unreadTx: { fontSize: 11, lineHeight: 15, fontWeight: '900', color: colors.onJu },
  chips: { flexDirection: 'row', gap: space(2), marginBottom: space(3), flexWrap: 'wrap' },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  // ★강조색 위 글자는 `onJu`(`check:onaccent`)
  chipTxOn: { color: colors.onJu },
  groupHead: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: space(4), marginBottom: space(1.5) },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    backgroundColor: colors.sunk, borderRadius: radius.pill,
    paddingHorizontal: space(3.5), marginBottom: space(3),
  },
  search: { flex: 1, paddingVertical: space(2.5), ...font.body, color: colors.ink },

  rule: { height: 1, backgroundColor: colors.line, marginVertical: space(3) },
  empty: { ...font.body, color: colors.inkFaint, textAlign: 'center', paddingVertical: space(8) },
  section: { ...font.caption, color: colors.inkFaint, fontWeight: '700', marginBottom: space(2) },

  // ★카드가 아니라 **줄**이다. 카톡 친구목록은 카드로 떠 있지 않다.
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2), borderRadius: radius.md, paddingHorizontal: space(1) },
  rowOn: { backgroundColor: colors.juSoft },
  col: { flex: 1, minWidth: 0 },
  name: { fontSize: 15.5, lineHeight: 21, fontWeight: '700', color: colors.ink },
  star: { fontSize: 17, color: colors.inkFaint, paddingHorizontal: space(1) },
  starOn: { color: colors.ju },
  // 고정 = 켜져 있지만 **누를 수 없다**는 것을 흐리기로 알린다(비활성 버튼의 관례)
  starPinned: { opacity: 0.45 },
});
