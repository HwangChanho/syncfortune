// src/components/HourFlowCard.tsx — 「오늘의 시간대」 12시진 카드 (무료 · 온디바이스 · API 0)
// ─────────────────────────────────────────────────────────────────────────
// 기획: 신규콘텐츠 기획 §4(C안) — 시간축 콘텐츠가 아홉인데 전부 하루 이상 단위라 **하루 안**이 비어 있다.
//   ★리텐션이 목적이라 별도 라우트를 만들지 않고 **`/today` 안에** 넣는다 —
//     이미 매일 여는 화면이고, 새 카드로 빼면 목록에서 또 하나가 잘려 나간다([[list-truncation-hides-content]]).
//
// ■ 이 컴포넌트가 하지 않는 것
//   · **판정하지 않는다.** 점수·우호도는 전부 `hourFlow`(결정론)가 낸다. 여기선 배치와 말투만.
//   · **"나쁜 시간"이라 부르지 않는다**(§4 흉 단정 금지) — 최저 시진도 '조심'까지만 쓴다.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hourFlow, hourPeaks, type HourSlot } from '../lib/content/hourFlow';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { SajuChart } from '@spec/chart';

export function HourFlowCard({ saju, dateISO, isToday }: {
  saju: SajuChart;
  /** 'YYYY-MM-DD' — 오늘/내일 토글을 그대로 받는다. */
  dateISO: string;
  /** 오늘일 때만 '지금' 배지를 붙인다(내일 화면에 '지금'은 뜻이 없다). */
  isToday: boolean;
}) {
  const { t } = useTranslation();
  const { fs } = useFontScale();

  let slots: HourSlot[];
  try { slots = hourFlow(saju, dateISO, isToday ? new Date().getHours() : undefined); }
  catch { return null; }   // 계산 실패 시 카드만 빠진다 — 화면 전체를 죽이지 않는다
  if (!slots.length) return null;
  const { best, care } = hourPeaks(slots);

  return (
    <View style={styles.card}>
      <Text style={[styles.title, { fontSize: fs(15), lineHeight: fs(21) }]}>
        {t('today.hourTitle', '시간대별 흐름')}
      </Text>
      <Text style={[styles.sub, { fontSize: fs(12), lineHeight: fs(18) }]}>
        {t('today.hourSub', '같은 하루도 시간마다 결이 다릅니다')}
      </Text>

      {/* 요약 두 줄 — 표를 다 읽지 않아도 쓸 수 있게 */}
      <View style={styles.peaks}>
        <Text style={[styles.peakLine, { fontSize: fs(13), lineHeight: fs(20) }]}>
          {t('today.hourBest', '가장 잘 풀리는 때 · {{ko}} {{range}}', { ko: best.ko, range: best.range })}
        </Text>
        <Text style={[styles.peakLine, { fontSize: fs(13), lineHeight: fs(20) }]}>
          {t('today.hourCare', '한 박자 늦추면 좋은 때 · {{ko}} {{range}}', { ko: care.ko, range: care.range })}
        </Text>
      </View>

      {slots.map((s) => (
        <View key={s.gz} style={[styles.row, s.now && styles.rowNow]}>
          <Text style={[styles.hour, { fontSize: fs(12), lineHeight: fs(18) }]} numberOfLines={1}>
            {s.ko}
            <Text style={styles.range}>{`  ${s.range}`}</Text>
          </Text>
          <View style={styles.track}>
            {/* 막대 길이 = 점수. 색은 우호/비우호로만 갈린다(등급을 새로 만들지 않는다) */}
            <View style={[styles.fill, { width: `${s.score}%` }, !s.favorGood && styles.fillCare]} />
          </View>
          {s.now ? (
            <Text style={[styles.nowTag, { fontSize: fs(10), lineHeight: fs(15) }]}>{t('today.hourNow', '지금')}</Text>
          ) : (
            <Text style={[styles.score, { fontSize: fs(11), lineHeight: fs(16) }]}>{s.score}</Text>
          )}
        </View>
      ))}

      <Text style={[styles.foot, { fontSize: fs(11), lineHeight: fs(17) }]}>
        {t('today.hourFoot', '오늘 일진과 내 명식으로 계산한 결이고, 좋고 나쁨의 판정이 아닙니다. 낮게 나온 때는 서두르지 않는 편이 낫다는 뜻으로 봐 주세요.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), marginTop: space(4), ...shadow.card },
  title: { ...font.heading, color: colors.ink },
  sub: { color: colors.inkSoft, marginTop: space(1), marginBottom: space(3) },
  peaks: { marginBottom: space(3) },
  peakLine: { color: colors.ink, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5), paddingVertical: space(0.5), paddingHorizontal: space(1), borderRadius: radius.sm },
  // '지금'만 배경으로 구분 — 색 하나에 의존하지 않게 오른쪽에 글자 배지도 함께 둔다(색각 접근성)
  rowNow: { backgroundColor: colors.juLine },
  hour: { color: colors.ink, fontWeight: '700', width: 96 },
  range: { color: colors.inkFaint, fontWeight: '400' },
  track: { flex: 1, height: 8, backgroundColor: colors.juLine, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.ju, borderRadius: 4 },
  fillCare: { backgroundColor: colors.inkFaint },
  score: { color: colors.inkFaint, width: 30, textAlign: 'right' },
  nowTag: { color: colors.ju, fontWeight: '900', width: 30, textAlign: 'right' },
  foot: { color: colors.inkFaint, marginTop: space(2) },
});
