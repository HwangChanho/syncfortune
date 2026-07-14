// src/app/(app)/personal.tsx — 퍼스널 오행(컬러·코디·메이크업·자동차) 무료 결정론 콘텐츠(온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 기획서 Phase 2(2026-07-14): 팔자 오행 밸런스로 나를 살리는 색(강조)+채우면 좋은 색(보완) → 코디·메이크업·자동차 색 제안.
//   전부 온디바이스 룰(personalOhaeng)·API 0·무료. BM(뷰티/패션 제휴 링크)의 토대. 매핑=daniel ★검수(personalOhaeng.ts).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { ContentHero } from '../../components/SpecialContentScreen';
import { ChartPicker } from '../../components/ChartPicker';
import { RelatedContent } from '../../components/RelatedContent';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { personalOhaeng, personalTone, EL_KO, EL_VIBE, type OhaengProfile } from '../../lib/content/personalOhaeng';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { appLang } from '../../lib/i18n';
import { colors, space, radius, font } from '../../lib/theme';

// 색 스와치 3개 + 색 이름
function Swatches({ p }: { p: OhaengProfile }) {
  return (
    <View style={styles.swatchRow}>
      {p.hex.map((h, i) => (
        <View key={i} style={styles.swatchItem}>
          <View style={[styles.swatch, { backgroundColor: h }]} />
          <Text style={styles.swatchName}>{p.colors[i]}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PersonalRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  useLogContentVisit('personal'); // 진입 1회 방문 기록
  const [input, setInput] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0); // 명식 전환 시 재로드

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setInput(ch?.input ?? null); setLoading(false);
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const data = useMemo(() => {
    if (!input) return null;
    try { return personalOhaeng(computeChart(input).saju); } catch { return null; }
  }, [input]);
  // ★퍼스널 컬러 웜/쿨 톤(daniel 2026-07-15) — 원국 조후 한난 기반(computeChart 메모됨).
  const tone = useMemo(() => {
    if (!input) return null;
    try { return personalTone(computeChart(input).saju); } catch { return null; }
  }, [input]);
  const lang = appLang() as 'ko' | 'en' | 'ja';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      <ContentHero image={require('../../../assets/icons/personal.jpg')} title={t('personal.title', '퍼스널 오행')} sub={t('personal.sub', '내 오행에 맞는 컬러·코디·메이크업·자동차 색')} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={styles.emptyMsg}>{t('personal.empty', '명식을 등록하면 내 오행에 맞는 컬러를 찾아드려요')}</Text>
          <PressableScale style={styles.emptyBtn} onPress={() => router.push('/register')}><Text style={styles.emptyBtnTx}>{t('personal.emptyCta', '+ 명식 등록')}</Text></PressableScale>
        </View>
      ) : (
        <>
          {/* ⓪ 퍼스널 컬러 웜톤/쿨톤 — 헤드라인(원국 조후 한난) */}
          {tone && (
            <View style={[styles.card, styles.toneCard]}>
              <Text style={styles.cardCap}>{t('personal.toneCap', '나의 퍼스널 컬러')}</Text>
              <Text style={styles.toneLabel}>{tone.profile.emoji} {(tone.profile as any)[lang] ?? tone.profile.ko}</Text>
              <View style={styles.toneSwRow}>
                {tone.profile.hex.map((h, i) => (<View key={i} style={[styles.toneSw, { backgroundColor: h }]} />))}
              </View>
              <Text style={styles.toneDesc}>{lang === 'en' ? tone.profile.descEn : lang === 'ja' ? tone.profile.descJa : tone.profile.descKo}</Text>
            </View>
          )}

          {/* ① 나를 살리는 색(강조 = 강한 오행) */}
          <View style={styles.card}>
            <Text style={styles.cardCap}>{t('personal.activate', '나를 살리는 색')}</Text>
            <Text style={styles.elLine}><Text style={[styles.elGlyph, { color: data.activate.hex[0] }]}>{data.dominant}({EL_KO[data.dominant]})</Text> · {EL_VIBE[data.dominant]}</Text>
            <Swatches p={data.activate} />
          </View>

          {/* ② 채우면 좋은 색(보완 = 용신/부족 오행) */}
          <View style={styles.card}>
            <Text style={styles.cardCap}>{t('personal.balance', '채우면 좋은 색')}</Text>
            <Text style={styles.elLine}><Text style={[styles.elGlyph, { color: data.balance.hex[0] }]}>{data.needed}({EL_KO[data.needed]})</Text> · {EL_VIBE[data.needed]}{data.neededIsYongsin ? t('personal.yongsin', ' (내게 필요한 기운)') : ''}</Text>
            <Swatches p={data.balance} />
          </View>

          {/* ③ 코디 · ④ 메이크업 · ⑤ 자동차 */}
          <View style={styles.card}>
            <Text style={styles.secTitle}>{t('personal.cody', '코디')}</Text>
            <Text style={styles.secBody}>{data.activate.cody} · 보완으로 {data.balance.cody}도 잘 어울려요.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.secTitle}>{t('personal.makeup', '메이크업')}</Text>
            <Text style={styles.secBody}>{data.activate.makeup}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.secTitle}>{t('personal.car', '자동차 색')}</Text>
            <Text style={styles.secBody}>{data.activate.car}{data.balance.car !== data.activate.car ? ` · 보완 ${data.balance.car}` : ''}</Text>
          </View>

          <Text style={styles.note}>{t('personal.note', '※ 오행 기운에 맞춘 컬러 제안이에요. 취향과 함께 재미로 참고하세요.')}</Text>
          <RelatedContent kind="personal" />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: space(4), paddingBottom: space(16) },
  center: { alignItems: 'center', paddingVertical: space(10), gap: space(3) },
  emptyMsg: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  emptyBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6) },
  emptyBtnTx: { color: colors.bg, fontWeight: '800' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginTop: space(3) },
  cardCap: { ...font.caption, color: colors.inkSoft, marginBottom: space(2) },
  // ★퍼스널 컬러 웜/쿨 톤
  toneCard: { borderColor: colors.ju, borderWidth: 1.5 },
  toneLabel: { ...font.title, color: colors.ink, marginBottom: space(3) },
  toneSwRow: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  toneSw: { flex: 1, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  toneDesc: { ...font.body, color: colors.ink, lineHeight: 23 },
  elLine: { ...font.body, color: colors.ink, marginBottom: space(3) },
  elGlyph: { fontWeight: '900' },
  swatchRow: { flexDirection: 'row', justifyContent: 'space-around' },
  swatchItem: { alignItems: 'center', gap: space(1.5) },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.line },
  swatchName: { ...font.caption, color: colors.inkSoft },
  secTitle: { ...font.heading, color: colors.ju, marginBottom: space(1.5) },
  secBody: { ...font.body, color: colors.ink, lineHeight: 23 },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
