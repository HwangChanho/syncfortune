// app/src/components/ZiweiTeaser.tsx — 자미두수 유료 풀이 무료 티저(구조 사실·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널: 유료 12궁 통합 풀이(/reading?kind=ziwei) '앞'에 결정론 무료 티저를 얹어 전환 유도.
// ★CLAUDE.md §3.3 준수: 자미두수는 Claude·유저 모두 비마스터 → *깊은 판정 만들지 말 것*.
//   iztro 결정론이 낸 **구조 사실(명궁 위치·주성 이름)만** 보여주고, "이 별들을 종합 해석"이라는 *중립 프레이밍*으로만 유도.
//   별 의미 해석·길흉 판정 없음(그건 유료 풀이의 몫). 온디바이스 iztro 산출값(c.ziwei)만 사용 — Edge/Supabase 호출 0.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, space, font } from '../lib/theme';

/**
 * 자미두수 무료 티저 — 명궁 主星(구조 사실) + 중립 프레이밍. ziwei.tsx 유료 카드에 얹음.
 * @param ziwei computeChart(me).ziwei (iztro 결정론 성반). palaces[].{branch,name,majorStars} + lifePalaceBranch.
 */
export function ZiweiTeaser({ ziwei }: { ziwei: any }) {
  const palaces: any[] = ziwei?.palaces ?? [];
  // 명궁 = lifePalaceBranch 와 branch 일치하는 궁(신뢰 키). 그 궁의 主星 이름만 추출(해석 없음).
  const life = palaces.find((p) => p?.branch === ziwei?.lifePalaceBranch);
  const stars: string[] = (life?.majorStars ?? []).map((s: any) => s?.name).filter(Boolean);

  if (!ziwei || !ziwei.lifePalaceBranch) return null; // 방어 — 성반 없으면 티저 생략

  return (
    <View style={styles.wrap}>
      <Text style={styles.cap}>내 명궁(나·기질의 자리)</Text>
      {stars.length > 0 ? (
        <View style={styles.chips}>
          {stars.map((nm, i) => (
            <View key={i} style={styles.chip}><Text style={styles.chipTx}>{nm}</Text></View>
          ))}
        </View>
      ) : (
        // 무주성(주성 없는 명궁) — 흔한 구조. 판정 없이 사실만.
        <Text style={styles.empty}>명궁에 주성이 없는 구조예요(자미두수에선 대궁의 별을 함께 봅니다).</Text>
      )}
      <Text style={styles.note}>
        자미두수는 이 별들의 <Text style={styles.em}>위치·밝기·사화(四化)·대한(운) 흐름</Text>을 종합해 당신을 읽어요. 12궁 통합 해석은 아래 풀이에서 열려요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space(2), marginBottom: space(3), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.line },
  cap: { ...font.caption, color: colors.inkSoft, marginBottom: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { backgroundColor: colors.juSoft, borderColor: colors.ju, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(1.5) },
  chipTx: { ...font.body, color: colors.ju, fontWeight: '800' },
  empty: { ...font.body, color: colors.ink },
  note: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginTop: space(3) },
  em: { color: colors.ink, fontWeight: '700' },
});
