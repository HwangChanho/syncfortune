// app/src/components/kit/ScoreCard.tsx — 시안 '오늘의 운세' 점수 카드
// ═══════════════════════════════════════════════════════════════════════════
// 시안 `니운내운.pdf` p04(홈) 실측 사양:
//   · 카드 = 배경보다 **밝은 면**(colors.card) · 큰 라운드 · 그림자는 거의 없다
//   · 좌측 열 : 「오늘의 운세」(작게·강조색) → **큰 점수**(48px급·강조색·900) + '점'(작게) → 상태 칩
//   · 우측 열 : 제목(굵게) → 본문 2줄(보조색) → 우하단 「자세히 보기 ›」
//   ⇒ 숫자가 화면에서 가장 큰 요소다. "오늘 몇 점"이 한 눈에 박히는 것이 이 카드의 일이다.
//
// ★상태 칩(「좋은 흐름」)은 **점수를 말로 바꿔 주는 자리**다 — 숫자만 있으면 84가 좋은 건지 모른다.
// ⚠️여기서 색을 새로 만들지 않는다. 전부 `colors` 토큰이라 대표명식 오행이 바뀌면 이 카드도 따라 바뀐다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font, shadow } from '../../lib/theme';

/**
 * 점수 카드.
 *
 * @param label   좌상단 라벨(예: `오늘의 운세`)
 * @param score   점수(숫자만 — 단위는 이 컴포넌트가 붙인다)
 * @param tone    상태 칩 문구(예: `좋은 흐름`). 없으면 칩을 그리지 않는다
 * @param title   우측 제목 한 줄
 * @param body    우측 본문(2줄까지)
 * @param onPress 카드를 누르면 갈 곳. 없으면 눌리지 않는 카드가 된다
 * @param moreLabel 우하단 링크 문구(기본 `자세히 보기`)
 */
export function ScoreCard({
  label, score, tone, title, body, onPress, moreLabel = '자세히 보기',
}: {
  label: string; score: number | string; tone?: string;
  title: string; body?: string; onPress?: () => void; moreLabel?: string;
}) {
  const inner = (
    <View style={styles.row}>
      {/* 좌 — 숫자가 주인공 */}
      <View style={styles.left}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.unit}>점</Text>
        </View>
        {tone ? <View style={styles.tonePill}><Text style={styles.toneTx}>{tone}</Text></View> : null}
      </View>

      {/* 우 — 무슨 날인지 */}
      <View style={styles.right}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
        {onPress ? <Text style={styles.more}>{moreLabel} ›</Text> : null}
      </View>
    </View>
  );

  // ★누를 수 있을 때만 PressableScale — 안 그러면 눌리는 것처럼 보이는데 아무 일도 안 난다
  return onPress
    ? <PressableScale style={styles.card} onPress={onPress}>{inner}</PressableScale>
    : <View style={styles.card}>{inner}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    paddingVertical: space(4.5), paddingHorizontal: space(4.5),
    marginBottom: space(3), ...shadow.soft,
  },
  row: { flexDirection: 'row', gap: space(4), alignItems: 'flex-start' },
  left: { alignItems: 'flex-start', minWidth: 96 },
  label: { ...font.label, color: colors.ju, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space(1) },
  // 시안에서 가장 큰 글자 — 여기만 40을 넘긴다.
  score: { fontSize: 44, lineHeight: 50, fontWeight: '900', color: colors.ju, letterSpacing: -1.5 },
  unit: { fontSize: 16, lineHeight: 26, fontWeight: '800', color: colors.ju, marginLeft: 2 },
  tonePill: {
    marginTop: space(2), backgroundColor: colors.bg, borderRadius: radius.pill,
    paddingHorizontal: space(3), paddingVertical: space(1.25),
  },
  toneTx: { ...font.caption, color: colors.inkSoft, fontWeight: '800' },
  right: { flex: 1, paddingTop: space(1) },
  title: { ...font.heading, color: colors.ink, fontWeight: '800', lineHeight: 24 },
  body: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 19 },
  more: { ...font.label, color: colors.ju, fontWeight: '800', textAlign: 'right', marginTop: space(2.5) },
});
