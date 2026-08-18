// app/src/components/kit/ScoreCard.tsx — 시안 '오늘의 운세' 점수 카드
// ═══════════════════════════════════════════════════════════════════════════
// 시안 `니운내운.pdf` p04(홈) 실측 사양:
//   · 카드 = 배경보다 **밝은 면**(colors.card) · 큰 라운드 · 그림자는 거의 없다
//   · 좌측 열 : 「오늘의 운세」(작게·강조색) → **큰 점수**(48px급·강조색·900) + '점'(작게) → 상태 칩
//   · 우측 열 : 제목(굵게) → 본문 2줄(보조색) → 우하단 「자세히 보기 ›」
//   ⇒ 숫자가 화면에서 가장 큰 요소다. "오늘 몇 점"이 한 눈에 박히는 것이 이 카드의 일이다.
//
// ■ 크기는 **재서 정했다**(2026-08-19)
//   시안 페이지는 뷰포트가 아니라 **긴 스크롤 목업**이라(비율 1:2.79) 세로로 비교하면 안 되고
//   **폭으로만** 환산해야 한다. 시안 논리폭 616pt → 402pt 폰이면 축척 0.652.
//   교차 검증: 시안 좌우 여백 24pt × 0.652 = **15.6pt** ≈ iOS 관례 16pt ✅
//     · 카드 높이 197pt → **128pt**
//     · 「84」 글자 높이 70pt → 45.6pt → **fontSize 62**(굵은 숫자는 글자높이 ≈ 0.72×크기)
//   ⚠️종전 44 는 시안의 **70% 크기**였다 — 눈으로 맞춰 놓고 "비슷하다"고 넘어간 자리다.
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
 * @param unitLabel 점수 단위(기본 `점`) — 문구는 i18n 에서 온다
 * @param moreLabel 우하단 링크 문구(기본 `자세히 보기`)
 */
export function ScoreCard({
  label, score, tone, title, body, onPress, unitLabel = '점', moreLabel = '자세히 보기',
}: {
  label: string; score: number | string; tone?: string;
  title: string; body?: string; onPress?: () => void; unitLabel?: string; moreLabel?: string;
}) {
  const inner = (
    <View style={styles.row}>
      {/* 좌 — 숫자가 주인공 */}
      <View style={styles.left}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.unit}>{unitLabel}</Text>
        </View>
        {tone ? <View style={styles.tonePill}><Text style={styles.toneTx}>{tone}</Text></View> : null}
      </View>

      {/* 우 — 무슨 날인지 */}
      <View style={styles.right}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
        {/* ★화살표는 이 컴포넌트가 붙인다. 다만 문구가 **이미 화살표를 갖고 있으면** 떼고 붙인다 —
            `today.more` 가 '분야별로 자세히 보기 →' 라 그대로 두면 「→ ›」 로 둘이 나왔다(시뮬 실측). */}
        {onPress ? <Text style={styles.more}>{moreLabel.replace(/[›»→>\s]+$/, '')} ›</Text> : null}
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
    paddingVertical: space(4), paddingHorizontal: space(4.5),
    marginBottom: space(3), ...shadow.soft,
  },
  row: { flexDirection: 'row', gap: space(4), alignItems: 'flex-start' },
  // 시안 좌열 = 카드폭의 약 48%. 숫자가 커서 자리를 먼저 잡아야 우열이 밀리지 않는다
  left: { alignItems: 'flex-start', minWidth: 104 },
  label: { ...font.label, color: colors.ju, fontWeight: '800' },
  // ★baseline — flex-end 로 하면 두 글자 **박스**의 아래가 맞아 '점'이 숫자보다 내려앉는다(시뮬 실측)
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space(0.5) },
  // 시안에서 **가장 큰 글자**. 62 는 재서 나온 값이다(위 ■ 참조) — 눈대중으로 줄이지 말 것.
  score: { fontSize: 62, lineHeight: 68, fontWeight: '900', color: colors.ju, letterSpacing: -2.5 },
  unit: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: colors.ju, marginLeft: 2 },
  tonePill: {
    marginTop: space(1.5), backgroundColor: colors.bg, borderRadius: radius.pill,
    paddingHorizontal: space(3), paddingVertical: space(1.25),
  },
  toneTx: { ...font.caption, color: colors.inkSoft, fontWeight: '800' },
  right: { flex: 1, paddingTop: space(2) },
  title: { ...font.heading, color: colors.ink, fontWeight: '800', lineHeight: 24 },
  body: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 19 },
  more: { ...font.label, color: colors.ju, fontWeight: '800', textAlign: 'right', marginTop: space(2.5) },
});
