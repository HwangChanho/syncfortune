// app/src/components/HomeCollapsedRow.tsx — 홈 블록 접힘 행(제목만 보이고 타고 들어가 본다)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-27: "홈에 글씨들은 다 숨기고 타고 들어가야 볼 수 있게" → "홈은 모든 컨텐츠 다, 오늘의 운세 빼고"
//   즉 홈은 **오늘의 운세만 펼쳐 두고**, 나머지 블록은 제목 한 줄로 접는다.
//   목적 = 홈이 글로 도배되지 않게 하고, 각 콘텐츠는 제 화면에서 온전히 보게 하는 것.
//
// ★설계 판단(6개 카드를 각각 뜯지 않은 이유):
//   카드마다 '무엇을 남기고 무엇을 감출지'를 따로 정하면 6가지 다른 모양이 생기고, 나중에 하나만
//   고쳐지며 어긋난다(오늘 실제로 겪은 문제 — 화면마다 콘텐츠 추천이 달랐다).
//   → **접힘 표현을 한 곳**에 두고 블록은 이걸 쓰기만 한다. 원래 카드는 손대지 않아 상세 화면에서 그대로 재사용된다.
//
// ⚠️접기 전 반드시 확인할 것: **그 콘텐츠에 상세 화면이 있는가.**
//   바이오리듬은 홈 카드가 유일한 노출처여서, 접기 전에 `/biorhythm` 화면을 먼저 만들었다.
//   상세가 없는 블록을 접으면 콘텐츠가 도달 불가가 된다.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font, shadow } from '../lib/theme';

/**
 * @param title 블록 이름(예: '오늘의 행운')
 * @param hint  한 줄 힌트 — **내용이 아니라 '무엇을 볼 수 있는지'**만(글을 숨기는 게 목적이라 내용은 넣지 않는다)
 * @param route 탭 시 이동할 상세 화면(필수 — 없는 곳으로 접으면 콘텐츠가 사라진다)
 * @param badge 우측 작은 배지(선택 — 예: 점수·개수처럼 한눈 정보가 실제로 유용할 때만)
 */
export function HomeCollapsedRow({ title, hint, route, badge }: {
  title: string;
  hint?: string;
  route: string;
  badge?: string;
}) {
  const { fs } = useFontScale();
  const router = useRouter();
  return (
    <PressableScale style={styles.row} onPress={() => router.push(route as any)}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { fontSize: fs(15) }]} numberOfLines={1}>{title}</Text>
        {hint ? <Text style={[styles.hint, { fontSize: fs(12) }]} numberOfLines={1}>{hint}</Text> : null}
      </View>
      {badge ? <Text style={[styles.badge, { fontSize: fs(13) }]} numberOfLines={1}>{badge}</Text> : null}
      <Text style={[styles.chev, { fontSize: fs(17) }]}>›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // 카드 한 장이 아니라 '줄' — 접힘 상태를 시각적으로도 분명히(펼쳐진 오늘의 운세 카드와 구분된다).
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.juLine,
    paddingVertical: space(4), paddingHorizontal: space(4.5),
    marginBottom: space(3), ...shadow.card,
  },
  title: { ...font.body, color: colors.ink, fontWeight: '800' },
  hint: { ...font.caption, color: colors.inkSoft, marginTop: 2 },
  badge: { ...font.body, color: colors.ju, fontWeight: '800' },
  chev: { color: colors.ju, fontWeight: '900' },
});
