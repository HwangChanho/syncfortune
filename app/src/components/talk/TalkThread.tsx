// app/src/components/talk/TalkThread.tsx — 대화창 (말풍선 + 콘텐츠 카드)
// ═══════════════════════════════════════════════════════════════════════════
// 가상 상담사와 실제 상담사가 **같은 화면**을 쓴다. 다른 건 답을 누가 만드느냐뿐이라,
// 화면을 둘로 만들면 언젠가 두 결로 갈린다([[duplicate-ui-single-source]]).
//
// ■ 색은 시안 팔레트만 쓴다
//   상대 말풍선 = `colors.card` · 내 말풍선 = `colors.ju` + `colors.onJu`.
//   ⚠️강조색 위 글자는 반드시 `onJu` — 옛 하드코딩(`#15132E`)은 대비 2.2~2.9 로 안 읽힌다
//   (`check:onaccent` 가 지킨다).
//
// ■ 콘텐츠 카드가 대화 안에 들어간다
//   가상 상담사의 존재 이유가 '기존 콘텐츠로 데려다주는 것'이라, 링크는 덧붙임이 아니라 **본문**이다.
// ═══════════════════════════════════════════════════════════════════════════
import { useRef, useEffect, useState, type ReactNode , Fragment } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';   // ★날짜 구분선 문구(Boss 2026-09-01)
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font, shadow } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';
import { emph } from '../../lib/ui/richText';   // `**강조**` → 굵게 (단일 출처 — 풀이 화면과 같은 파서)

/** 화면에 그리는 한 덩이. 서버 `talk_messages` 한 행 + 링크(가상 답에만 붙는다). */
export type TalkItem = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  /**
   * 보낸 시각(ISO). 있으면 **말풍선 옆에 시간**이 붙고, **날짜가 바뀌는 자리에 가운데 줄**이 선다
   * (Boss 2026-09-01 *"날짜가 바뀌면 카카오톡처럼 가운데 줄생기고 … 칸뒤에 보낸 시간이"*).
   * ⚠️없으면 **아무것도 안 그린다** — 화면에서 만든 안내 말풍선까지 시간이 붙으면 어색하다.
   */
  sentAt?: string;
  links?: { key: string; label: string; route: string }[];
  /**
   * 서버 `talk_messages.id`. **정리에서 원문으로 데려갈 때** 쓴다(Boss 2026-08-23).
   * 없으면 그 줄로는 못 뛴다(화면에서만 만든 인사·안내 말풍선 등).
   */
  msgId?: number;
  /**
   * 말풍선 대신 **화면 한 덩이**를 넣는다(홈 블록 친구).
   * ★말풍선으로 감싸지 않는다 — 카드가 말풍선 안에 들어가면 폭이 좁아져 원래 레이아웃이 깨진다.
   *   카톡도 지도·송금 같은 건 말풍선 밖으로 낸다.
   */
  node?: ReactNode;
  /**
   * 말풍선에 붙는 그림(Boss 2026-08-20 *"대화 할때 다양한 이미지들도"*).
   * ★말풍선 **안**이 아니라 아래에 따로 얹는다 — 카톡도 사진은 말풍선과 별개 덩이다.
   */
  image?: { uri: string } | number;
  /**
   * 누가 한 말인가 — **여럿이 있는 자리에서만** 쓴다(오픈채팅방).
   *
   * ★1:1 에서는 넣지 않는다. 상대가 한 명뿐인데 말풍선마다 이름을 붙이면 잡음이다
   *   (카톡도 1:1 에는 이름을 안 붙이고 단톡에만 붙인다).
   * ⚠️`avatar` 가 없으면 이름 첫 글자로 대신한다 — 사진이 아직 없는 상담가가 있다.
   */
  who?: {
    name: string;
    avatar?: string | null;
    element?: string;
    /** ★상담가 id — 사진을 누르면 이 값으로 프로필을 연다(Boss 2026-08-26). 없으면 안 눌린다. */
    id?: string | null;
  };
  /**
   * 말풍선이 아닌 **가운데 안내 한 줄**(Boss 2026-08-26
   *   *"운이 차감될때마다 말풍선없이 가운데 정렬로 작은 글씨로 얼마의 운이 차감됐는지"*).
   *
   * ★말풍선을 쓰지 않는 이유: 이건 **대화가 아니라 영수증**이다.
   *   말풍선에 넣으면 상담가가 «2운 썼어요» 라고 말한 것처럼 읽힌다 — 사람과 시스템은 결이 달라야 한다.
   *   카톡도 «메시지를 삭제했습니다»·«초대했습니다» 를 가운데 작은 글씨로 낸다.
   * ⚠️이 줄이 있으면 **다른 것은 안 그린다**(말풍선·카드·그림 전부). 한 줄이 전부다.
   */
  system?: string;
  /**
   * ★내 말을 **아직 안 읽은 사람 수**(카톡의 「1」 · Boss 2026-08-27).
   *   0 이거나 없으면 **안 그린다** — 0 은 정보가 아니라 잡음이다(안읽은 배지와 같은 규칙).
   *   ⚠️여러 명 방에서는 **나를 뺀** 인원수까지 올라간다.
   */
  unread?: number;
};

/**
 * 타이핑 표시 — **말풍선 안 점 세 개**(Boss 2026-08-20 *"말풍선에 ... 이렇게 나오다가"*).
 *
 * ★상대 말풍선과 **같은 모양**을 쓴다. 다른 모양으로 만들면 '시스템 안내'처럼 보이고,
 *   카톡에서 점이 뜨는 자리는 어디까지나 **그 사람이 말하려는 자리**다.
 * ⚠️`Animated` 로 점마다 시차를 준다 — 세 점이 함께 깜빡이면 '로딩'이지 '타이핑'이 아니다.
 *   `useNativeDriver` 라 JS 스레드가 바빠도 부드럽게 돈다.
 */
function TypingBubble() {
  const dots = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),                                           // 점마다 시차
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View style={styles.themRow}>
      <View style={[styles.them, styles.typing]}>
        {dots.map((v, i) => <Animated.View key={i} style={[styles.dot, { opacity: v }]} />)}
      </View>
    </View>
  );
}

/**
 * 대화창.
 *
 * @param items    말풍선들(오래된 것부터)
 * @param busy     답을 기다리는 중(점 세 개)
 * @param onLink   콘텐츠 카드를 눌렀을 때
 */
/**
 * 바로 앞 말풍선이 **같은 사람**인가 — 그러면 얼굴을 다시 붙이지 않는다(카톡과 같다).
 *
 * @param items 전체 목록
 * @param i     지금 그리는 자리
 * ★«같은 사람» 판정은 `id` 가 있으면 id 로, 없으면 이름으로 한다 —
 *   곁다리처럼 id 없이 이름만 오는 줄이 있어서다.
 * ⚠️`system` 줄(운 차감 안내 등)은 **사이에 끼어도 대화를 끊지 않는다** — 건너뛰고 그 앞을 본다.
 */
function sameSpeakerAsPrev(items: TalkItem[], i: number): boolean {
  const cur = items[i];
  if (!cur?.who) return false;
  for (let k = i - 1; k >= 0; k--) {
    const p = items[k];
    if (p.system) continue;                       // 안내 줄은 화자를 바꾸지 않는다
    if (p.role !== cur.role) return false;        // 내가 끼어들었으면 다시 붙인다
    if (!p.who) return false;
    return (cur.who.id && p.who.id) ? cur.who.id === p.who.id : cur.who.name === p.who.name;
  }
  return false;
}

export function TalkThread({ items, busy, onLink, jumpTo, onWho, keyboardH }: {
  items: TalkItem[];
  busy?: boolean;
  onLink: (route: string) => void;
  /**
   * 프로필 사진·이름을 눌렀을 때 (Boss 2026-08-26 *"해당 사진을 클릭하면 프로필 상세화면을 볼수있게해"*).
   * ★`who.id` 가 있을 때만 눌린다 — 누를 수 없는 걸 눌리게 보이면 그게 더 나쁘다.
   */
  onWho?: (id: string) => void;
  /**
   * 이 `talk_messages.id` 로 **스크롤해서 잠깐 밝힌다**(정리 → 원문).
   * ★같은 값을 또 넣어도 다시 뛰게 하려면 호출부가 값을 비웠다 넣는다.
   */
  jumpTo?: number | null;
  /**
   * ★★키보드가 열린 높이 (Boss 2026-09-02 *"키보드 때문에 내 채팅이 안보여"*).
   *   **값 자체는 안 쓴다 — 바뀌었다는 사실만 쓴다.** 바뀌면 맨 아래로 다시 붙인다.
   *
   * ■ 무엇이 있었나 — 키보드가 열리면 입력바가 그만큼 올라가고(`marginBottom: lift`)
   *   목록은 `flex:1` 이라 **높이가 줄어든다**. 그런데 **스크롤 위치는 그대로**다
   *   ⇒ 아래에 있던 말풍선이 보이는 영역 **밖으로 밀려난다**. 방금 내가 쓴 그 한 줄이.
   * ■ ⚠️★여백(`paddingBottom`)을 더 주는 것은 **틀린 고침**이다 — 자리는 이미 줄어들어
   *   확보돼 있다. 여백까지 주면 목록 아래에 **빈 칸이 생긴다**. 첫 판에 그렇게 짰다가
   *   배치를 읽고 되돌렸다(짐작하지 말고 배치를 볼 것).
   * ■ ⇒ 필요한 것은 **스크롤 하나**다.
   */
  keyboardH?: number;
}) {
  const { t } = useTranslation();
  const ref = useRef<ScrollView>(null);
  // 말풍선마다 세로 위치를 적어 둔다 — 정리에서 뛸 때 이 값으로 스크롤한다.
  const yRef = useRef<Record<number, number>>({});
  const [lit, setLit] = useState<number | null>(null);   // 잠깐 밝힐 대상
  // 새 말풍선이 붙으면 아래로 — 대화는 마지막 줄이 중요하다
  useEffect(() => { ref.current?.scrollToEnd({ animated: true }); }, [items.length, busy]);
  // ★키보드가 열리고 닫힐 때 **맨 아래로 다시 붙인다** — 높이만 줄고 스크롤이 안 따라오면
  //   방금 쓴 말이 화면 밖으로 밀린다. 애니메이션 없이(`false`) 붙여야 «툭» 하고 바로 보인다.
  useEffect(() => { ref.current?.scrollToEnd({ animated: false }); }, [keyboardH]);
  /**
   * ★★그런데 위 한 줄로는 **모자란다**(Boss 2026-08-30
   *   *"택스트 입력중표시나 신구 텍스트가오면 채팅장 스크롤을 제일 아래로 만들어줘야해"*).
   *
   * ■ 왜 — `items.length` 가 바뀌는 **그 순간에는 아직 높이가 없다.** 말풍선은 다음 레이아웃에서
   *   그려지므로, 그때 부른 `scrollToEnd` 는 **옛 높이 기준**으로 멈춘다. 긴 답일수록 많이 남는다.
   *   점 세 개(`busy`)도 같은 이유로 반쯤 걸친다.
   * ■ ⇒ **내용 높이가 바뀔 때** 다시 내린다. 이건 «다 그려진 뒤» 에 불리는 신호라 어긋나지 않는다.
   * ■ ⚠️사용자가 위를 읽고 있을 때 끌어내리지 않는다 — 바닥 근처(120px)일 때만 따라간다.
   *   (`onScroll` 로 마지막 위치를 적어 둔다.)
   */
  const nearBottomRef = useRef(true);
  const onScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    nearBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
  };
  const onContentSizeChange = () => { if (nearBottomRef.current) ref.current?.scrollToEnd({ animated: true }); };

  // ★정리에서 뛰어오면: 그 자리로 스크롤 + 1.6초간 밝힌다.
  //   ⚠️밝히지 않으면 어디로 왔는지 모른다 — 스크롤만 하면 '아무 일도 안 일어난 것'처럼 보인다.
  useEffect(() => {
    if (jumpTo == null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // ⚠️★종전엔 «아직 안 그려진 줄이면 **조용히** 넘어간다» 였다 — 그래서 눌렀는데
    //   **아무 일도 안 일어나는** 일이 생겼다(Boss 2026-08-25 «클릭하면 그 대화로 이동가능하면 좋겠어»
    //   = 지금은 안 된다는 뜻이다). onLayout 이 아직 안 끝났을 뿐인데 포기한 것이다.
    //   ⇒ 몇 번 **다시 시도**한다. 그래도 못 찾으면 그건 이력 밖이라 어차피 갈 곳이 없다.
    const tryJump = (left: number) => {
      const y = yRef.current[jumpTo];
      if (y != null) {
        ref.current?.scrollTo({ y: Math.max(0, y - 40), animated: true });
        setLit(jumpTo);
        timers.push(setTimeout(() => setLit(null), 1600));
        return;
      }
      if (left > 0) timers.push(setTimeout(() => tryJump(left - 1), 120));
    };
    tryJump(8);                                              // 최대 약 1초 동안 기다린다
    return () => timers.forEach(clearTimeout);
  }, [jumpTo]);

  return (
    <ScrollView ref={ref} style={styles.wrap} contentContainerStyle={styles.body}
      onScroll={onScroll} scrollEventThrottle={64}
      onContentSizeChange={onContentSizeChange}>
      {items.map((m, i) => {
        /**
         * ★날짜가 바뀌는 자리 — 앞 말풍선과 **날짜가 다르면** 가운데 줄을 세운다.
         * ⚠️시각이 없는 줄(화면에서 만든 안내)은 **날짜를 안 가진 것으로** 본다 —
         *   그 줄 때문에 구분선이 두 번 서면 안 된다.
         */
        const dayOf = (x?: string) => (x ? new Date(x).toDateString() : '');
        const prevDay = dayOf(items.slice(0, i).reverse().find((p) => p.sentAt)?.sentAt);
        const thisDay = dayOf(m.sentAt);
        const showDay = !!thisDay && thisDay !== prevDay;
        return (
        <Fragment key={`w${m.id}`}>
        {showDay ? (
          <View style={styles.dayRow}>
            <View style={styles.dayLine} />
            <Text style={styles.dayTx}>{dayLabel(m.sentAt!, t as never)}</Text>
            <View style={styles.dayLine} />
          </View>
        ) : null}
        {(m.system ? (
        // ★시스템 한 줄 — 가운데·작게·말풍선 없음. 누르는 것도 아니다(정보만)
        <View key={m.id} style={styles.sysRow}>
          <Text style={styles.sysTx}>{m.system}</Text>
        </View>
      ) : (
        <View
          key={m.id}
          style={[m.role === 'user' ? styles.mineRow : styles.themRow, lit != null && m.msgId === lit && styles.litRow]}
          onLayout={(e) => { if (m.msgId != null) yRef.current[m.msgId] = e.nativeEvent.layout.y; }}
        >
          {/* 누가 한 말인지. ★말풍선 위가 아니라 **왼쪽**에 두면 줄이 흔들린다
              ★★2026-08-26 — 1:1 에서도 띄운다(Boss *"대화할때 상대 프로필 사진이 뜨게"*).
                종전엔 다인방에서만 나왔다(`whoOf` 가 `!mates.length` 면 undefined 였다).
              ★연속으로 같은 사람이 말하면 **첫 풍선에만** 붙인다 — 카톡과 같다.
                매 풍선마다 얼굴이 붙으면 쪼갠 말이 «여러 사람이 말한 것» 처럼 읽힌다.
              ★누르면 프로필이 열린다. 단 `who.id` 가 있을 때만 — 누를 수 없는 걸 눌리게 보이면 더 나쁘다. */}
          {m.who && m.role !== 'user' && !sameSpeakerAsPrev(items, i) ? (
            <PressableScale
              style={styles.whoRow}
              disabled={!m.who.id || !onWho}
              onPress={() => { if (m.who?.id && onWho) onWho(m.who.id); }}
              accessibilityLabel={`${m.who.name} 프로필 보기`}
            >
              {m.who.avatar
                ? <ExpoImage source={{ uri: m.who.avatar }} style={styles.whoPic} contentFit="cover" />
                : (
                  // ⚠️`elementColor` 는 **표**다(함수가 아니다) — 친구목록과 같은 것을 쓴다
                  <View style={[styles.whoPic, { backgroundColor: elementColor[m.who.element ?? '木'] }]}>
                    <Text style={[styles.whoInit, { color: elementText[m.who.element ?? '木'] }]}>
                      {m.who.name.slice(0, 1)}
                    </Text>
                  </View>
                )}
              <Text style={styles.whoTx} numberOfLines={1}>{m.who.name}</Text>
            </PressableScale>
          ) : null}
          {m.body ? (
            <View style={[styles.bubbleRow, m.role === 'user' && styles.bubbleRowMine]}>
              {/* ★「1」은 **말풍선 왼쪽**에 붙인다 — 카톡이 그렇고, 오른쪽에 두면 화면 끝에 물린다.
                  내 말에만 뜬다(남의 말에 «몇 명이 안 읽었나» 는 내가 알 바가 아니다). */}
              {m.role === 'user' && (m.unread ?? 0) > 0
                ? <Text style={styles.unreadMark}>{m.unread}</Text> : null}
              {/* ★시간은 **말풍선 바깥쪽**에 — 내 말은 왼쪽, 남의 말은 오른쪽(Boss 2026-09-01).
                  ⚠️`alignItems: 'flex-end'` 라 시간이 말풍선 **아랫줄**에 맞는다(카톡과 같은 결).
                  시각이 없는 줄(화면에서 만든 안내)에는 안 붙인다. */}
              {m.sentAt && m.role === 'user'
                ? <Text style={styles.timeTx}>{timeLabel(m.sentAt)}</Text> : null}
            <View style={m.role === 'user' ? styles.mine : styles.them}>
              {/* ★`**강조**` 를 굵게 — 종전엔 파서를 안 거쳐 **별표가 그대로** 보였다(Boss 2026-08-26).
                  ⚠️새로 만들지 않고 **이미 있던** `emph()` 를 쓴다(풀이 화면이 쓰던 것) —
                    화면마다 각자 파서를 두면 «같은 글이 화면마다 다르게» 보인다. */}
              {emph(m.body, m.role === 'user' ? styles.mineTx : styles.themTx)}
            </View>
              {m.sentAt && m.role !== 'user'
                ? <Text style={styles.timeTx}>{timeLabel(m.sentAt)}</Text> : null}
            </View>
          ) : null}
          {/* 홈 블록은 말풍선 밖으로 — 폭을 온전히 써야 원래 카드 그대로 보인다 */}
          {m.node ? <View style={styles.node}>{m.node}</View> : null}
          {/* 그림 — ★비율을 고정한다(16:10). 안 하면 로드 전후로 화면이 튀어 대화가 흔들린다 */}
          {m.image ? (
            <ExpoImage source={m.image} style={styles.photo} contentFit="cover" transition={200} />
          ) : null}
          {m.links?.length ? (
            <View style={styles.links}>
              {m.links.map((l) => (
                <PressableScale key={l.key} style={styles.link} onPress={() => onLink(l.route)}>
                  <Text style={styles.linkTx} numberOfLines={1}>{l.label}</Text>
                  <Text style={styles.linkArrow}>›</Text>
                </PressableScale>
              ))}
            </View>
          ) : null}
        </View>
        ))}
        </Fragment>
        );
      })}
      {busy ? <TypingBubble /> : null}
    </ScrollView>
  );
}

/**
 * 날짜 구분선에 적을 말 — 오늘·어제는 **낱말로**, 그 밖은 날짜로.
 * ★«오늘» 이 보이는 것이 Boss 가 말한 카톡의 그 줄이다.
 */
function dayLabel(iso: string, t: (k: string, d: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yest = new Date(now.getTime() - 86400000);
  if (same(d, now)) return t('chat.today', '오늘');
  if (same(d, yest)) return t('chat.yesterday', '어제');
  // ★날짜 형식은 **기기 언어**가 정한다 — 나라마다 순서가 다르다(우리가 짜 맞추지 않는다)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** 말풍선 옆 시간 — 「오후 7:18」. */
function timeLabel(iso: string): string {
  // ★오전/오후 표기도 **기기 언어**가 정한다 — 영어권은 「7:18 PM」 이 자연스럽다
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  // ★날짜 구분선 — 가운데 글자, 양옆으로 선(카톡과 같은 결)
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginVertical: space(3) },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  dayTx: { ...font.caption, fontSize: 11.5, color: colors.inkFaint, fontWeight: '700' },
  // 말풍선 옆 시간 — 작고 흐리게(읽는 것을 방해하지 않게)
  timeTx: { ...font.caption, fontSize: 10.5, color: colors.inkFaint, marginHorizontal: space(1) },
  // ★시스템 한 줄(운 차감 영수증) — 말풍선과 **같은 것이 하나도 없어야** 한다:
  //   가운데 정렬 · 작은 글씨 · 흐린 색 · 배경 없음. 그래야 «사람 말» 과 안 헷갈린다.
  sysRow: { alignSelf: 'center', paddingVertical: space(1.5), paddingHorizontal: space(3) },
  sysTx: { ...font.caption, fontSize: 11, lineHeight: 15, color: colors.inkFaint, textAlign: 'center' },
  wrap: { flex: 1, backgroundColor: colors.bg },
  // ★아래 여백을 줄였다 (Boss 2026-09-02 *"채팅 하단이랑 텍스트 필드 사이간격이 너무 넓어"*).
  //   space(8)=32 는 마지막 말풍선과 입력칸 사이를 크게 벌렸다. 입력칸에도 제 여백이 있어 겹쳤다.
  body: { padding: space(4), paddingBottom: space(2) },

  themRow: { alignItems: 'flex-start', marginBottom: space(2.5) },
  mineRow: { alignItems: 'flex-end', marginBottom: space(2.5) },
  // 말풍선 + 「1」 — 끝을 맞추고 **아래로** 정렬(카톡처럼 풍선 밑단에 숫자가 붙는다)
  //
  // ★★`width: '100%'` — Boss 2026-08-28 *"말이 계속 줄바꿈이 되잖아 심지어 보낼때도 줄바꿈 안했는데"*
  //   (「내꺼 보자」 다섯 글자가 **두 줄**로 갈렸다)
  //   ■ ⚠️원인은 줄바꿈 규칙이 아니라 **폭**이었다. 실측한 사슬:
  //       글자 42px ← 말풍선 70px(`maxWidth: '84%'`) ← 이 줄 **84px** ← 바깥 848px
  //     이 줄이 `alignItems: 'flex-end'` 인 부모 안에서 **shrink-to-fit** 이라 폭이 안 정해지는데,
  //     그 안에서 말풍선이 `84%` 를 쓰니 **퍼센트가 풀 기준을 잃고** 잘게 무너진다.
  //   ■ ★네이티브는 멀쩡하다 — Yoga 는 퍼센트를 **바깥의 확정 폭**으로 푼다. **웹에서만** 난다.
  //   ⇒ 줄을 **폭 100%** 로 못 박고 좌우 정렬은 `justifyContent` 로 한다.
  //     그러면 말풍선의 `84%` 가 **확정된 폭**을 기준으로 풀린다.
  //   ⚠️`alignItems: 'flex-end'`(세로 밑단 맞춤)는 그대로 둔다 — 그건 「1」 배지가 밑에 붙는 규칙이다.
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(1.5), width: '100%' },
  // 내 말은 오른쪽 끝으로 — 줄이 폭을 다 쓰므로 정렬은 여기서 한다
  bubbleRowMine: { justifyContent: 'flex-end' },
  // ⚠️배지는 **줄어들지 않는다** — 줄어들면 숫자가 잘린다
  unreadMark: { ...font.caption, fontSize: 11, color: colors.ju, fontWeight: '800', marginBottom: 2, flexShrink: 0 },

  them: {
    // ⚠️★★`flexShrink: 0` — Boss 2026-08-27 *"채팅이 왜 이렇게 나눠서 나와"*
    //   (보내 준 화면에서 「안녕.」이 「안 / 녕.」으로 **세로로** 갈려 있었다)
    //   말풍선은 `bubbleRow`(flexDirection: 'row')의 자식이다. RN(yoga)의 기본 `flexShrink` 는 **0**
    //   인데 **react-native-web 은 CSS 기본을 따라 1**이 되는 자리가 있다 — 그러면 옆의 「1」 배지와
    //   자리를 다투다 말풍선이 **글자 폭 아래로** 눌린다. 폰에서는 안 나고 웹에서만 난다.
    //   ⇒ 줄어들지 않게 못 박는다. 넘치는 것은 아래 `maxWidth` 가 이미 막고 있다.
    flexShrink: 0,
    maxWidth: '84%', backgroundColor: colors.card,
    borderRadius: radius.lg, borderTopLeftRadius: radius.sm,
    paddingHorizontal: space(3.5), paddingVertical: space(2.5), ...shadow.soft,
  },
  mine: {
    flexShrink: 0,                       // ★위 `them` 과 같은 이유(웹에서만 눌린다)
    maxWidth: '84%', backgroundColor: colors.ju,
    borderRadius: radius.lg, borderTopRightRadius: radius.sm,
    paddingHorizontal: space(3.5), paddingVertical: space(2.5),
  },
  themTx: { ...font.body, color: colors.ink, lineHeight: 22 },
  // ★강조색 위 글자는 `onJu` — 다섯 오행 전부 대비 6.3~8.1 (`check:onaccent`)
  mineTx: { ...font.body, color: colors.onJu, lineHeight: 22 },

  // 점 세 개 — 글자 대신 점을 쓴다(글자는 언어마다 길이가 달라 말풍선 크기가 흔들린다)
  typing: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: space(3) },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkFaint },

  // 화자 — 사진 20px + 이름. ★말풍선보다 **작게**. 이름이 크면 대화가 아니라 명단으로 읽힌다
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginBottom: space(1) },
  whoPic: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  whoInit: { fontSize: 11, fontWeight: '900' },
  whoTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },

  node: { alignSelf: 'stretch', marginTop: space(1) },
  // 그림 — 말풍선보다 살짝 좁게(84%) 두어 '얹힌 것'으로 보이게. 높이는 비율 고정.
  photo: { width: '68%', aspectRatio: 16 / 10, borderRadius: radius.lg, marginTop: space(2) },
  links: { marginTop: space(2), gap: space(1.5), alignSelf: 'stretch' },
  // 정리에서 뛰어온 줄을 잠깐 밝힌다 — 어디로 왔는지 보이게(스크롤만 하면 아무 일도 안 한 것 같다)
  litRow: { backgroundColor: colors.juSoft, borderRadius: radius.md },
  link: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.juLine,
    paddingHorizontal: space(3.5), paddingVertical: space(2.5),
  },
  linkTx: { ...font.body, color: colors.ju, fontWeight: '800', flex: 1, minWidth: 0 },
  linkArrow: { ...font.body, color: colors.ju, fontWeight: '900' },
});
