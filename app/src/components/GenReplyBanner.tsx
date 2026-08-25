// app/src/components/GenReplyBanner.tsx — 풀이 진행 알림을 **담당자의 답장**으로 보여 준다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"각 카테고리별로 대표 인물이 카톡으로 답장해주는 식으로 하자"*.
// 종전엔 홈 상단에 「…풀이 중… 45%」 진행률 막대였다.
//
// ■ 왜 이렇게 생겼나
//   말풍선·화자 줄(사진 20px + 이름)은 **대화창(`TalkThread`)과 같은 모양**을 쓴다.
//   여기서 새 모양을 만들면 같은 사람이 화면마다 다르게 보인다([[duplicate-ui-single-source]]).
//
// ■ 진행률은 어디 갔나
//   ★문장 안에 넣지 않는다 — "37% 보는 중" 은 사람의 말이 아니다.
//   숫자는 **말풍선 밖에 작게** 둔다. 정보는 남기되 대화를 깨지 않는다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from './PressableScale';
import { colors, space, radius, font, shadow } from '../lib/theme';
import { elementColor, elementText } from '../lib/engine/ohaeng';
import { replierFor, replyLine, type GenState } from '../lib/content/genReplier';

/** 사진이 없는 상담가의 자리 색 — 친구목록과 같은 순서를 쓴다. */
const FALLBACK_EL = ['木', '火', '土', '金', '水'];

/**
 * 담당자 답장 한 줄.
 *
 * @param route    풀이 경로(`/wealth`) — 담당자를 정하고 탭했을 때 갈 곳
 * @param label    콘텐츠 이름(`재물운`)
 * @param state    working(만드는 중) · restored(멈춘 것) · done(완성)
 * @param pct      진행률 0~100. done 이면 안 쓴다
 * @param chartLabel 어느 명식인지(여러 명식을 쓸 때만 의미가 있다)
 * @param slot     사진 없는 사람의 자리 색을 고르는 번호
 * @param onPress  탭 — 그 화면으로 이동
 */
export function GenReplyBanner({ route, label, state, pct, chartLabel, slot = 0, onPress }: {
  route: string; label: string; state: GenState; pct?: number;
  chartLabel?: string | null; slot?: number; onPress: () => void;
}) {
  const who = replierFor(route);
  const el = FALLBACK_EL[slot % FALLBACK_EL.length];
  const done = state === 'done';
  // ★명식 이름은 **말풍선이 아니라 화자 줄 옆**에 둔다. 문장에 섞으면 말이 길어진다
  const sub = chartLabel?.trim() ? chartLabel.trim() : null;

  return (
    <PressableScale onPress={onPress} style={styles.wrap}>
      <View style={styles.whoRow}>
        {who?.avatar
          ? <ExpoImage source={{ uri: who.avatar }} style={styles.pic} contentFit="cover" cachePolicy="memory-disk" />
          : (
            <View style={[styles.pic, { backgroundColor: elementColor[el] }]}>
              <Text style={[styles.init, { color: elementText[el] }]}>{(who?.name ?? '?').slice(0, 1)}</Text>
            </View>
          )}
        <Text style={styles.whoTx} numberOfLines={1}>{who?.name ?? '상담가'}</Text>
        {sub ? <Text style={styles.sub} numberOfLines={1}>· {sub}</Text> : null}
      </View>

      <View style={[styles.bubble, done && styles.bubbleDone]}>
        <Text style={[styles.body, done && styles.bodyDone]}>{replyLine(state, label)}</Text>
      </View>

      <View style={styles.footRow}>
        {/* 진행률 — 만드는 중일 때만. ★말풍선 밖·작게 */}
        {!done && typeof pct === 'number' ? <Text style={styles.pct}>{Math.max(0, Math.min(100, Math.round(pct)))}%</Text> : null}
        <Text style={styles.cta}>{done ? '풀이 보기 ›' : '이어보기 ›'}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(3) },
  // 화자 — 대화창과 **같은 크기**(사진 20 · 이름 작게). 여기서 키우면 명단처럼 읽힌다
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginBottom: space(1) },
  pic: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  init: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  whoTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  sub: { ...font.caption, color: colors.inkFaint, flexShrink: 1 },

  // 말풍선 — `TalkThread` 의 `them` 과 같은 모양(좌상단만 각지게)
  bubble: {
    alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: colors.card,
    borderRadius: radius.lg, borderTopLeftRadius: radius.sm,
    paddingHorizontal: space(3.5), paddingVertical: space(2.5), ...shadow.soft,
  },
  // 완성 — 강조색 말풍선. ★이때만 눈에 띄어야 한다(할 일이 생긴 것이라서)
  bubbleDone: { backgroundColor: colors.ju },
  body: { ...font.body, color: colors.ink, lineHeight: 22 },
  bodyDone: { color: colors.onJu, fontWeight: '700' },

  footRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(1), paddingLeft: space(1) },
  pct: { ...font.caption, color: colors.inkFaint, fontVariant: ['tabular-nums'] },
  cta: { ...font.caption, color: colors.ju, fontWeight: '800' },
});
