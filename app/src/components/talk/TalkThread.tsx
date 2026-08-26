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
import { useRef, useEffect, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
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

export function TalkThread({ items, busy, onLink, jumpTo, onWho }: {
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
}) {
  const ref = useRef<ScrollView>(null);
  // 말풍선마다 세로 위치를 적어 둔다 — 정리에서 뛸 때 이 값으로 스크롤한다.
  const yRef = useRef<Record<number, number>>({});
  const [lit, setLit] = useState<number | null>(null);   // 잠깐 밝힐 대상
  // 새 말풍선이 붙으면 아래로 — 대화는 마지막 줄이 중요하다
  useEffect(() => { ref.current?.scrollToEnd({ animated: true }); }, [items.length, busy]);

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
    <ScrollView ref={ref} style={styles.wrap} contentContainerStyle={styles.body}>
      {items.map((m, i) => (m.system ? (
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
            <View style={m.role === 'user' ? styles.mine : styles.them}>
              {/* ★`**강조**` 를 굵게 — 종전엔 파서를 안 거쳐 **별표가 그대로** 보였다(Boss 2026-08-26).
                  ⚠️새로 만들지 않고 **이미 있던** `emph()` 를 쓴다(풀이 화면이 쓰던 것) —
                    화면마다 각자 파서를 두면 «같은 글이 화면마다 다르게» 보인다. */}
              {emph(m.body, m.role === 'user' ? styles.mineTx : styles.themTx)}
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
      )))}
      {busy ? <TypingBubble /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ★시스템 한 줄(운 차감 영수증) — 말풍선과 **같은 것이 하나도 없어야** 한다:
  //   가운데 정렬 · 작은 글씨 · 흐린 색 · 배경 없음. 그래야 «사람 말» 과 안 헷갈린다.
  sysRow: { alignSelf: 'center', paddingVertical: space(1.5), paddingHorizontal: space(3) },
  sysTx: { ...font.caption, fontSize: 11, lineHeight: 15, color: colors.inkFaint, textAlign: 'center' },
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space(4), paddingBottom: space(8) },

  themRow: { alignItems: 'flex-start', marginBottom: space(2.5) },
  mineRow: { alignItems: 'flex-end', marginBottom: space(2.5) },

  them: {
    maxWidth: '84%', backgroundColor: colors.card,
    borderRadius: radius.lg, borderTopLeftRadius: radius.sm,
    paddingHorizontal: space(3.5), paddingVertical: space(2.5), ...shadow.soft,
  },
  mine: {
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
