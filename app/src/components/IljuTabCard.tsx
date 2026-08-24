// app/src/components/IljuTabCard.tsx — 만세력 **일주론 탭**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"만세력에서 일주론 탭도 활성화 시키자"*
//
// ■ ★화면을 베끼지 않았다
//   일주론은 이미 `/dayPillar` 에 **완성된 화면**으로 있다(60갑자 목록·일러스트·실천 4계명).
//   여기서 그걸 다시 그리면 **문구가 두 갈래**가 된다([[duplicate-ui-single-source]]).
//   ⇒ **자료(`DAY_PILLAR`)만 같은 것을 읽고**, 이 탭은 *내 일주*만 보여 준다.
//     60갑자 전체·궁합 일주·실천 계명은 **원래 화면으로 보낸다**(맨 아래 버튼).
//
// ■ 무엇을 보여 주나 (만세력 = 명식을 읽는 자리)
//   내 일주 간지 → 키워드 칩 → 개요 → 성격 → 연애 → 직업 → (성별 있으면 남/여) → 조언.
//   ⚠️성별 칸은 **명식에 성별이 있을 때만** 보여 준다 — 없는데 남/여를 고르면 그건 지어내는 것이다.
//
// ■ ⚠️중첩 <Text> 금지 — 웹에서 백지가 된다([[web-nested-text-crash]]).
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { SajuChart } from '@spec/chart';
import { DAY_PILLAR, dayPillarKey } from '../lib/engine/dayPillar';
import { PressableScale } from './PressableScale';
import { colors, radius, space, font, shadow } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';

/**
 * 만세력 일주론 탭 본문.
 *
 * @param saju 원국(일주 간지를 여기서 읽는다)
 * @param sex  명식의 성별. **없으면 남/여 칸을 그리지 않는다**
 */
export function IljuTabCard({ saju, sex }: { saju: SajuChart; sex?: '남' | '여' | null }) {
  const { fs } = useFontScale();
  const router = useRouter();
  const stem = saju?.pillars?.['일']?.stem;
  const branch = saju?.pillars?.['일']?.branch;
  const key = dayPillarKey(stem, branch);
  const t = key ? DAY_PILLAR[key] : null;
  // ★자료가 없으면 **아무것도 그리지 않는다** — 빈 카드를 남기지 않는다
  if (!t || !key) return null;

  /** 글자 크기와 줄간격은 **짝으로** 움직인다([[ui-font-scale-lineheight]]). */
  const ts = (n: number, m = 1.7) => ({ fontSize: fs(n), lineHeight: Math.round(fs(n) * m) });

  const rows: { label: string; body: string }[] = [
    { label: '개요', body: t.overview },
    { label: '성격·기질', body: t.personality },
    { label: '연애·배우자', body: t.love },
    { label: '직업·재물', body: t.career },
    // ⚠️성별이 없으면 넣지 않는다(모르는 걸 고르면 그건 지어내는 것이다)
    ...(sex === '남' ? [{ label: '남성', body: t.male }] : sex === '여' ? [{ label: '여성', body: t.female }] : []),
    { label: '조언', body: t.advice },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.gz, ts(24, 1.25)]}>{key}</Text>
        <Text style={[styles.gzSub, ts(12.5)]}>내 일주 · 태어난 날의 간지</Text>
      </View>

      <View style={styles.chips}>
        {t.keywords.map((k) => (
          <View key={k} style={styles.chip}><Text style={[styles.chipTx, ts(12, 1.4)]}>{k}</Text></View>
        ))}
      </View>

      {rows.map((r) => (
        <View key={r.label} style={styles.sec}>
          <Text style={[styles.secLbl, ts(11.5, 1.5)]}>{r.label}</Text>
          <Text style={[styles.secTx, ts(13.5)]}>{r.body}</Text>
        </View>
      ))}

      {/* ★60갑자 전체·궁합 일주·실천 계명은 **원래 화면**이 갖고 있다. 여기서 다시 그리지 않는다. */}
      <PressableScale style={styles.more} onPress={() => router.push('/dayPillar')}>
        <Text style={[styles.moreTx, ts(13, 1.5)]}>60갑자 일주 전체 보기 ›</Text>
      </PressableScale>

      <Text style={[styles.foot, ts(11.5)]}>
        일주는 명식의 한 축이에요. 전체 흐름은 원국·오행과 함께 봐야 해요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    padding: space(4), marginTop: space(3), marginBottom: space(2), ...shadow.card,
  },
  head: { alignItems: 'center', paddingBottom: space(3), borderBottomWidth: 1, borderBottomColor: colors.line },
  gz: { ...font.heading, color: colors.ju, fontWeight: '900', letterSpacing: 2 },
  gzSub: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(3) },
  chip: { backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  chipTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  sec: { marginTop: space(3.5) },
  secLbl: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.3 },
  secTx: { ...font.body, color: colors.ink, marginTop: space(1) },
  more: {
    alignSelf: 'flex-start', marginTop: space(4),
    borderWidth: 1, borderColor: colors.ju, borderRadius: radius.pill,
    paddingHorizontal: space(4), paddingVertical: space(2),
  },
  moreTx: { ...font.body, color: colors.ju, fontWeight: '700' },
  foot: { ...font.caption, color: colors.inkFaint, marginTop: space(3) },
});
