// app/src/app/(app)/impression.tsx — '사람들이 보는 나의 인상' (온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 천간 흐름(년간→월간→일간→시간)=겉으로 비치는 이미지(4단계). 월지 글자·십성=막상 알고 보면 진짜 나.
//   겉(천간)과 속(월지 십성)의 차이가 크면 "겉과 속이 다른 반전". 천간이 더 중요(메인) + 지지=외형(보조).
//   lib/impression.ts 사전 조회 → API 0. 시각 미상이면 시주(깊은 사이) 생략.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { computeChart } from '../../lib/engine/engine';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { STEM_TRAIT, BRANCH_LOOK, TENGOD_ESSENCE, TENGOD_GROUP, IMPRESSION_STAGES } from '../../lib/content/impression';
import { useFontScale } from '../../lib/ui/fontScale';
import { elementColor, elementText } from '../../lib/engine/ohaeng';
import { ContentHero } from '../../components/SpecialContentScreen';
import { ChartPicker } from '../../components/ChartPicker';
import { colors, radius, space, shadow, font } from '../../lib/theme';

export default function ImpressionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { fs } = useFontScale();
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => { let a = true; loadRepChart().then((x) => { if (a) setSaved(x); }).catch(() => {}); return () => { a = false; }; }, [reloadKey]);
  const c = useMemo(() => (saved ? computeChart(saved.input) : null), [saved]);
  const timeUnknown = saved?.input.timeAccuracy === '미상';

  // 속(본질) = 월지 십성 + 겉(천간 흐름)과의 차이 판정
  const inner = useMemo(() => {
    if (!c) return null;
    const p: any = c.saju.pillars;
    const monthTg = p['월']?.branchMainTenGod as string | undefined;
    if (!monthTg) return null;
    const stemTgs = ['년', '일', '시'].map((k) => p[k]?.stemTenGod).filter(Boolean) as string[];
    const stemGroups = new Set(stemTgs.map((tg) => TENGOD_GROUP[tg]).filter(Boolean));
    const monthGroup = TENGOD_GROUP[monthTg];
    const gap = monthGroup ? !stemGroups.has(monthGroup) : false;
    return { essence: TENGOD_ESSENCE[monthTg], gap };
  }, [c]);


  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      <ContentHero image={require('../../../assets/icons/impression.jpg')}
        title={t('impression.title', '사람들이 보는 나의 인상')}
        sub={t('impression.sub', '겉으로 비치는 모습과 알고 보면 다른 진짜 나')} />
      {!saved || !c ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{t('manse.empty', '먼저 명식을 등록해 주세요.')}</Text>
          <Pressable style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart', '내 명식 등록')}</Text></Pressable>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { fontSize: fs(16) }]}>{t('impression.outer', '겉으로 비치는 나')}</Text>
          {IMPRESSION_STAGES.map((stage) => {
            if (stage.pos === '시' && timeUnknown) return null;
            const pil: any = (c.saju.pillars as any)[stage.pos];
            const stem = pil?.stem as string | undefined;
            const branch = pil?.branch as string | undefined;
            const st = stem ? STEM_TRAIT[stem] : undefined;
            const bl = branch ? BRANCH_LOOK[branch] : undefined;
            if (!st) return null;
            const col = elementColor[st.element] ?? colors.ju;
            return (
              <View key={stage.pos} style={[styles.card, { borderLeftColor: col, borderLeftWidth: 3 }]}>
                <View style={styles.head}>
                  <Text style={[styles.stageLabel, { fontSize: fs(18) }]}>{stage.label}</Text>
                  {bl ? <View style={[styles.badge, { backgroundColor: col }]}><Text style={[styles.badgeTx, { color: elementText[st.element] ?? '#fff' }]}>{bl.animal}</Text></View> : null}
                </View>
                <Text style={[styles.stageSub, { fontSize: fs(12) }]}>{stage.sub}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(25) }]}>{st.trait}</Text>
                {bl ? <Text style={[styles.look, { fontSize: fs(13), lineHeight: fs(20) }]}>{bl.look}</Text> : null}
              </View>
            );
          })}
          {inner && inner.essence ? (
            <>
              <Text style={[styles.sectionTitle, { fontSize: fs(16), marginTop: space(5) }]}>{t('impression.inner', '막상 알고 보면 — 진짜 내 모습')}</Text>
              <View style={[styles.card, styles.innerCard]}>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(25) }]}>알고 보면 {inner.essence}이에요.</Text>
                <View style={styles.gapBox}>
                  <Text style={[styles.gapTx, { fontSize: fs(14), lineHeight: fs(22) }]}>
                    {inner.gap
                      ? t('impression.gapBig', '겉으로 비치는 모습과 알고 난 뒤의 모습이 꽤 달라요. 처음엔 몰랐던 반전 매력이 있는 사람이에요.')
                      : t('impression.gapSmall', '겉으로 비치는 모습과 속이 비교적 한결같아요. 보이는 그대로 믿음이 가는 사람이에요.')}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </>
      )}
      <Text style={styles.note}>{t('impression.note', '※ 천간(밖으로 드러나는 기운)의 흐름이 남에게 비치는 이미지, 월지(타고난 자리)의 기운이 알고 보면 진짜 모습이에요.')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(6), paddingBottom: space(12) },
  emptyBox: { alignItems: 'center', paddingVertical: space(8) },
  empty: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginBottom: space(4) },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6) },
  ctaTx: { color: colors.bg, fontWeight: '800' },
  sectionTitle: { ...font.heading, color: colors.ju, fontWeight: '800', marginBottom: space(3) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  innerCard: { borderColor: colors.ju, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(1) },
  stageLabel: { ...font.heading, color: colors.ink, fontWeight: '800' },
  badge: { minWidth: 30, paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.pill, alignItems: 'center' },
  badgeTx: { fontSize: 13, fontWeight: '800' },
  stageSub: { ...font.caption, color: colors.inkFaint, marginBottom: space(3) },
  body: { ...font.body, color: colors.ink },
  look: { ...font.caption, color: colors.inkSoft, marginTop: space(2), fontStyle: 'italic' },
  gapBox: { marginTop: space(4), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  gapTx: { color: colors.ju, fontWeight: '600' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
