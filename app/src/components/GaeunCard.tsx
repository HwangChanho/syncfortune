// app/src/components/GaeunCard.tsx — **개운 방향**(만세력 · 오행·강약 탭)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-24 *"약한 기운을 보완하는 개운법을 간략하게 · 십성별로 세분화 ·
//   어떤 부분을 보완하면 가장 좋을지도 알맞게 판단해야"*
//
// ■ ★이 카드가 말하지 **않는** 것
//   "제일 적은 오행을 채우세요" 라고 하지 않는다. 그건 명리 오류다(`gaeun.ts` 머리말).
//   대신 **용신부터** 말하고, 최소 오행은 맨 아래 *참고 한 줄*로 내린다.
//   그리고 **채우면 안 되는 기운(기신)**을 반드시 같이 적는다 — 이걸 빼면
//   사용자는 "약한 건 다 채우면 좋은 것"으로 읽는다.
//
// ■ 무료/유료 경계 (전문가 2026-07-14: *"무료=결과 · 유료=방향성(개운법)"*)
//   여기는 **방향만** 짧게 준다(무엇을·왜). 시기·정도·개인 처방은 유료 풀이의 몫이다.
//   Boss 요청도 *"간략하게"* 였다.
//
// ■ ⚠️중첩 <Text> 금지 — 웹에서 백지가 된다([[web-nested-text-crash]]).
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { gaeunGuide } from '../lib/content/gaeun';
import { elementColor } from '../lib/engine/ohaeng';
import { colors, radius, space, font, shadow } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';

/**
 * 개운 방향 카드.
 * @param saju 원국. 계산이 안 되면 아무것도 그리지 않는다(빈 카드를 남기지 않는다)
 */
export function GaeunCard({ saju }: { saju: SajuChart }) {
  const { fs } = useFontScale();
  const g = gaeunGuide(saju);
  if (!g) return null;

  const top = g.targets[0];
  const sub = g.targets[1];
  /** 글자 크기와 줄간격은 **짝으로** 움직인다([[ui-font-scale-lineheight]]). */
  const ts = (n: number, m = 1.5) => ({ fontSize: fs(n), lineHeight: Math.round(fs(n) * m) });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={[styles.title, ts(15, 1.4)]}>개운 방향</Text>
        {/* 무엇을 근거로 골랐는지 밝힌다 — 근거 없는 처방으로 보이지 않게 */}
        <View style={styles.pill}><Text style={styles.pillTx}>{g.method}용신 기준</Text></View>
      </View>
      <Text style={[styles.lead, ts(12.5)]}>
        적은 기운을 다 채우는 게 아니라, 나에게 실제로 필요한 기운부터 채워요.
      </Text>

      {/* ── 1순위 ─────────────────────────────────────────────────────── */}
      <View style={styles.block}>
        <View style={styles.rowTop}>
          <View style={styles.rankPill}><Text style={styles.rankTx}>먼저</Text></View>
          <Text style={[styles.el, ts(14, 1.4), { color: elementColor[top.element] ?? colors.ink }]}>
            {top.element}({top.elementLabel})
          </Text>
          <Text style={[styles.sip, ts(13, 1.4)]}>{top.sipsin}</Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.share, ts(11.5)]}>원국 {top.share}%</Text>
        </View>
        <Text style={[styles.headline, ts(13.5)]}>{top.head}</Text>
        {top.todo.map((x) => (
          <View key={x} style={styles.todoRow}>
            <Text style={[styles.dot, ts(13.5)]}>·</Text>
            <Text style={[styles.todo, ts(13)]}>{x}</Text>
          </View>
        ))}
      </View>

      {/* ── 보조 — ★한 줄만. Boss *"간략하게"* ─────────────────────────── */}
      {sub && (
        <View style={styles.blockSub}>
          <View style={styles.rowTop}>
            <View style={[styles.rankPill, styles.rankPillSub]}><Text style={[styles.rankTx, styles.rankTxSub]}>그다음</Text></View>
            <Text style={[styles.el, ts(13.5, 1.4), { color: elementColor[sub.element] ?? colors.ink }]}>
              {sub.element}({sub.elementLabel})
            </Text>
            <Text style={[styles.sip, ts(12.5, 1.4)]}>{sub.sipsin}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.share, ts(11.5)]}>원국 {sub.share}%</Text>
          </View>
          <Text style={[styles.headline, ts(12.5)]}>{sub.head}</Text>
        </View>
      )}

      {/* ── 타고나지 못한 기운이면 밝힌다 ──────────────────────────────── */}
      {!!(g.caution) && (
        <Text style={[styles.caution, ts(12)]}>{g.caution.replace(/\*\*/g, '')}</Text>
      )}

      {/* ── ★채우면 안 되는 것 — 이 줄을 빼면 카드 전체가 오해가 된다 ─── */}
      <View style={styles.avoidRow}>
        <Text style={[styles.avoidLbl, ts(11.5)]}>채우지 않기</Text>
        <Text style={[styles.avoidTx, ts(12.5)]}>
          {g.avoid.element}({g.avoid.elementLabel}) · {g.avoid.sipsin} — 나를 눌러 힘을 빼는 기운이에요
        </Text>
      </View>

      {/* 최소 오행은 **참고**로만(주 처방 아님 — daniel B7 2026-07-06 판정과 같은 결) */}
      <Text style={[styles.foot, ts(11.5)]}>
        원국에서 제일 적은 건 {g.scarcest.element}({g.scarcest.elementLabel})·{g.scarcest.sipsin} {g.scarcest.share}% 예요.
        적다고 꼭 채워야 하는 건 아니라 참고만 하세요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    padding: space(4), marginTop: space(3), marginBottom: space(2), ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  title: { ...font.heading, color: colors.ink, fontWeight: '900' },
  pill: { backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(0.5) },
  pillTx: { fontSize: 11.5, fontWeight: '800', color: colors.ju },
  lead: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5) },

  block: { marginTop: space(3), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.line },
  blockSub: { marginTop: space(2.5), paddingTop: space(2.5), borderTopWidth: 1, borderTopColor: colors.line },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  rankPill: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.5) },
  rankPillSub: { backgroundColor: colors.juSoft },
  rankTx: { fontSize: 11, fontWeight: '900', color: colors.onJu },
  rankTxSub: { color: colors.ju },
  el: { ...font.body, fontWeight: '900' },
  sip: { ...font.body, color: colors.inkSoft, fontWeight: '800' },
  share: { ...font.caption, color: colors.inkFaint },
  headline: { ...font.body, color: colors.ink, fontWeight: '700', marginTop: space(2) },
  todoRow: { flexDirection: 'row', gap: space(1.5), marginTop: space(1.5) },
  dot: { color: colors.ju, fontWeight: '900' },
  todo: { ...font.body, color: colors.inkSoft, flex: 1 },

  caution: { ...font.caption, color: colors.inkSoft, marginTop: space(2.5) },
  avoidRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space(2),
    marginTop: space(3), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.line,
  },
  avoidLbl: { ...font.caption, color: colors.inkFaint, fontWeight: '800', paddingTop: 1 },
  avoidTx: { ...font.body, color: colors.inkSoft, flex: 1 },
  foot: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },
});
