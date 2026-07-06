// src/app/(app)/healing.tsx — '나만의 힐링 방법'(가볍게 보기) 무료·온디바이스 자기돌봄 카드
// ─────────────────────────────────────────────────────────────────────────
// 명식 오행 균형 → 나에게 맞는 쉼(lib/healingMethod.ts, Claude stance·daniel 검수).
//   규칙5: 무료=온디바이스(API 0). §4: 의료 단정 금지·다독임 톤. 상단 명식 헤더로 전환.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet, Image } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine/engine';
import { loadMyChart } from '../../lib/engine/myChart';
import { healingMethod, HEAL_EMOJI, type HealingResult } from '../../lib/content/healingMethod';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(앱게이트)
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

// 일간 오행별 이미지(daniel O: 종류별 이미지) — assets/icons/healing/{wood|fire|earth|metal|water}.jpg.
//   들어온 것만 require, 없으면 이모지(HEAL_EMOJI)로 자동 폴백(점진 적용). 키 = 오행 한자.
const HEAL_IMG: Record<string, any> = {
  木: require('../../../assets/icons/healing/wood.jpg'),
  火: require('../../../assets/icons/healing/fire.jpg'),
  土: require('../../../assets/icons/healing/earth.jpg'),
  金: require('../../../assets/icons/healing/metal.jpg'),
  水: require('../../../assets/icons/healing/water.jpg'),
};

export default function HealingScreen() {
  useLogContentVisit('healing'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);

  // 화면 진입(포커스)마다 대표 명식 재로딩 — 다른 곳에서 명식 바꿔도 동기화(daniel N)
  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) { setMe(c); setLoading(false); } });
    return () => { alive = false; };
  }, []));

  const r: HealingResult | null = useMemo(() => (me ? healingMethod(computeChart(me).saju) : null), [me]);

  const bodyDyn = { fontSize: fs(15), lineHeight: fs(25) };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!r) return (
    <View style={styles.center}>
      <Text style={styles.msg}>{t('compat.needChart', '먼저 명식을 등록해 주세요.')}</Text>
      <PressableScale style={styles.btn} onPress={() => router.push('/register')}><Text style={styles.btnText}>{t('compat.registerMyChart', '내 명식 등록')}</Text></PressableScale>
    </View>
  );

  return (
    <View style={styles.bg}>
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단) */}
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />

        {/* 히어로 — 일간 오행 이미지(없으면 이모지) + 타이틀 */}
        <View style={styles.hero}>
          {HEAL_IMG[r.dayElem]
            ? <Image source={HEAL_IMG[r.dayElem]} style={styles.heroImg} resizeMode="cover" />
            : <Text style={styles.emoji}>{HEAL_EMOJI[r.dayElem]}</Text>}
          <Text style={styles.title}>{t('menu.healing', '나만의 힐링 방법')}</Text>
          <Text style={styles.subtitle}>{t('healing.elemLead', '내 기운')}: {r.dayLabel}</Text>
        </View>

        {/* 나의 충전 방식 — ★억부 용신 오행(daniel B7) */}
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('healing.recharge', '나의 충전 방식')} · {r.yongLabel}</Text>
          <Text style={[styles.body, bodyDyn]}>{r.recharge}</Text>
        </View>

        {/* 채우면 좋은 기운 — ★억부 희신 오행(daniel B7). 결핍 오행은 참고 표기로 강등 */}
        <View style={styles.card}>
          <Text style={styles.cardHead}>{t('healing.nourish', '채우면 좋은 기운')} · {r.huiLabel}</Text>
          <Text style={[styles.body, bodyDyn]}>{r.nourish}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.swatch, { backgroundColor: r.hex }]} />
            <Text style={styles.metaTx}>{t('healing.color', '힐링 색')}: {r.color}</Text>
          </View>
          <Text style={styles.metaTx}>{t('healing.place', '힐링 공간')}: {r.place}</Text>
          <Text style={styles.metaTx}>{t('healing.food', '곁들이면 좋은')}: {r.food}</Text>
          <Text style={styles.metaTx}>{t('healing.deficit', '가장 적은 기운(참고)')}: {r.weakLabel}</Text>
        </View>

        {/* 비우면 좋은 기운 — 가장 많은 오행(과다 해소; 뚜렷할 때만) */}
        {r.hasExcess && (
          <View style={styles.card}>
            <Text style={styles.cardHead}>{t('healing.release', '비우면 좋은 기운')} · {r.excessLabel}</Text>
            <Text style={[styles.body, bodyDyn]}>{r.release}</Text>
          </View>
        )}

        {/* 마음 한마디 — 일간 오행 */}
        <View style={[styles.card, styles.mindCard]}>
          <Text style={styles.cardHead}>{t('healing.mind', '마음 한마디')}</Text>
          <Text style={[styles.body, bodyDyn]}>{r.mind}</Text>
        </View>

        {/* 풀이 음성 읽기(온디바이스 TTS·무료) — 힐링 카드 전체를 읽음 */}
        <TTSButton reading={r} />
        {/* 이슈17: 힐링 방법 결과 공유(앱게이트) */}
        <ShareReadingButton kind="healing" title="나만의 힐링 방법" content={r} />
        <Text style={styles.note}>{t('healing.note', '※ 사주 오행으로 가볍게 본 자기돌봄 가이드예요. 마음 챙김에 참고만 하세요.')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02)
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' }, // 전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02)
  msg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', paddingVertical: space(6), marginBottom: space(3) },
  heroImg: { width: '100%', height: 190, borderRadius: radius.md, marginBottom: space(3) },
  emoji: { fontSize: 64, marginBottom: space(2) },
  title: { fontSize: 25, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  subtitle: { ...font.caption, color: colors.ju, marginTop: space(2), fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  mindCard: { borderColor: colors.ju, backgroundColor: colors.juSoft }, // 마음 한마디 강조
  cardHead: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink, fontSize: 15, lineHeight: 25 },
  // 색·공간·음식 메타
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(3) },
  swatch: { width: 18, height: 18, borderRadius: 9, marginRight: space(2), borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  metaTx: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5) },
  share: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(3.25), alignItems: 'center', marginTop: space(1), marginBottom: space(4), ...shadow.card },
  shareTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginBottom: space(4), lineHeight: 18 },
});
