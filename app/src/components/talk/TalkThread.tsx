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
import { useRef, useEffect, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font, shadow } from '../../lib/theme';

/** 화면에 그리는 한 덩이. 서버 `talk_messages` 한 행 + 링크(가상 답에만 붙는다). */
export type TalkItem = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  links?: { key: string; label: string; route: string }[];
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
};

/**
 * 대화창.
 *
 * @param items    말풍선들(오래된 것부터)
 * @param busy     답을 기다리는 중(점 세 개)
 * @param onLink   콘텐츠 카드를 눌렀을 때
 */
export function TalkThread({ items, busy, onLink }: {
  items: TalkItem[];
  busy?: boolean;
  onLink: (route: string) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<ScrollView>(null);
  // 새 말풍선이 붙으면 아래로 — 대화는 마지막 줄이 중요하다
  useEffect(() => { ref.current?.scrollToEnd({ animated: true }); }, [items.length, busy]);

  return (
    <ScrollView ref={ref} style={styles.wrap} contentContainerStyle={styles.body}>
      {items.map((m) => (
        <View key={m.id} style={m.role === 'user' ? styles.mineRow : styles.themRow}>
          {m.body ? (
            <View style={m.role === 'user' ? styles.mine : styles.them}>
              <Text style={m.role === 'user' ? styles.mineTx : styles.themTx}>{m.body}</Text>
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
      {busy ? (
        <View style={styles.themRow}>
          <View style={[styles.them, styles.typing]}>
            <ActivityIndicator size="small" color={colors.inkFaint} />
            <Text style={styles.typingTx}>{t('talk.typing', '입력 중')}</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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

  typing: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  typingTx: { ...font.caption, color: colors.inkFaint },

  node: { alignSelf: 'stretch', marginTop: space(1) },
  // 그림 — 말풍선보다 살짝 좁게(84%) 두어 '얹힌 것'으로 보이게. 높이는 비율 고정.
  photo: { width: '68%', aspectRatio: 16 / 10, borderRadius: radius.lg, marginTop: space(2) },
  links: { marginTop: space(2), gap: space(1.5), alignSelf: 'stretch' },
  link: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.juLine,
    paddingHorizontal: space(3.5), paddingVertical: space(2.5),
  },
  linkTx: { ...font.body, color: colors.ju, fontWeight: '800', flex: 1, minWidth: 0 },
  linkArrow: { ...font.body, color: colors.ju, fontWeight: '900' },
});
