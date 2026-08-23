// app/src/app/(app)/analyzed.tsx — 「분석이 완료되었어요!」 (시안 `니운내운.pdf` p12·p20…)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 시안 실측
//   · 화면 전체가 **오행 배경색**. 아래쪽에 겹겹의 언덕(파형) 실루엣 — 오행마다 색이 바뀐다
//     (土=모래 p12 / 木=초록 p20 …). 5색 세트가 이 화면에서 가장 크게 드러난다.
//   · 「분석이 완료되었어요!」(작게) → 「당신은」 → **일주 이름(아주 크게)** → 「입니다.」
//   · 아래 두 줄 안내. 버튼은 없다 — 탭하면 넘어간다.
//
// ■ 어디에 끼나
//   명식 등록 → **여기** → 만세력. 종전엔 등록하자마자 만세력 표가 나와서,
//   방금 넣은 생년월일이 무엇이 되었는지 알기 전에 8글자부터 마주쳤다.
//   한 박자 쉬며 "당신은 ○○ 일주" 를 먼저 말해 주는 자리다.
//
// ■ 문구는 **지어내지 않는다**
//   시안의 「깊은 통찰과 유연한 지혜를 가진」은 일주 60종마다 필요한 카피고 daniel 검수 슬롯이다.
//   지금은 있는 데이터로 정확히 쓴다 — `DAY_PILLAR[일주].keywords` 를 칩으로 보여 준다.
//
// ⚠️자동으로 넘기지 않는다. 읽는 속도는 사람마다 다르고, 특히 이 화면은 **자기 일주를 처음 보는 순간**이다.
//   탭하면 넘어가고, 아래에 다음 버튼도 둔다(탭 영역만 있으면 무엇을 해야 할지 모른다).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   // ★헤더 없는 전면 화면 — 상태바를 직접 피한다
import { computeChart } from '../../lib/engine/engine';
import { DAY_PILLAR, dayPillarKey } from '../../lib/engine/dayPillar';
import { stemReading, branchReading, elementColor, stemElement } from '../../lib/engine/ohaeng';
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, space, font } from '../../lib/theme';
import { logEvent } from '../../lib/backend/logger';
import { loadMyChart } from '../../lib/engine/myChart'; // ★params 유실 시 대표 명식으로 폴백(2026-08-24)

/** 언덕 파형 — 겹칠수록 멀어 보이게 위쪽 것을 옅게 그린다(시안 p12 하단). */
const HILLS = [
  { d: 'M0 120 C 60 84, 130 96, 200 74 S 330 42, 400 58 L400 200 L0 200 Z', o: 0.16 },
  { d: 'M0 146 C 70 112, 140 132, 210 108 S 340 82, 400 100 L400 200 L0 200 Z', o: 0.24 },
  { d: 'M0 172 C 80 146, 150 164, 220 146 S 350 126, 400 142 L400 200 L0 200 Z', o: 0.34 },
];

export default function AnalyzedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ input?: string }>();
  const insets = useSafeAreaInsets();
  // ★★params 가 비어 올 때가 있다 — **웹에서 `router.replace({params})` 가 값을 못 넘긴다**(2026-08-24 실측:
  //   등록을 마치면 이 화면이 빈손으로 떠서 홈으로 튕겼다). 그때는 **방금 등록해 대표가 된 명식**을 읽는다.
  //   ⇒ 등록 직후 `setRepresentative` 가 불리므로, 대표 = 방금 그 명식이다.
  const [repInput, setRepInput] = useState<any>(null);
  useEffect(() => {
    if (params.input) return;                 // 파라미터가 있으면 그것이 정본이다
    loadMyChart().then((c) => setRepInput(c)).catch(() => {});
  }, [params.input, repInput]);

  const info = useMemo(() => {
    try {
      const input = params.input ? JSON.parse(String(params.input)) : repInput;
      if (!input) return null;
      const day = computeChart(input).saju?.pillars?.['일'];
      if (!day) return null;
      const key = dayPillarKey(day.stem, day.branch);
      return {
        input,
        gz: `${day.stem}${day.branch}`,
        ko: `${stemReading(day.stem)}${branchReading(day.branch)}`,
        element: stemElement(day.stem),
        keywords: key ? DAY_PILLAR[key]?.keywords ?? [] : [],
      };
    } catch (e) {
      // ⚠️조용히 삼키면 **빈 화면**이 뜬다 — 무엇이 실패했는지 남긴다([[no-fabrication-honesty]] 와 같은 결).
      logEvent('analyzed_parse_failed', { err: String((e as any)?.message ?? e) });
      return null;
    }
  }, [params.input]);

  // ★계산이 안 되면 이 화면을 **보여 주지 않고** 원래 목적지로 보낸다.
  //   "당신은 ___ 일주입니다" 에서 빈칸이 뜨는 것보다, 그냥 만세력으로 가는 편이 낫다.
  useEffect(() => {
    if (info) return;
    // ★등록 뒤에는 **만세력**으로 간다(Boss 2026-08-24 *"명식 등록하면 기본적으로 만세력으로 떠야지"*).
    //   종전 `/myeongsik` 은 넘겨받은 input 만 그리는 1회용 화면이라 **명식 전환도 탭도 없었다.**
    //   등록 직후 대표가 방금 그 명식으로 바뀌므로(`setRepresentative`), 만세력이 곧 그 명식이다.
    // ⚠️대표를 아직 읽는 중일 수 있다 — 그때는 기다린다(빈손이라고 단정해 홈으로 보내면 안 된다).
    if (!params.input && repInput === null) return;
    router.replace('/charts');
  }, [info, params.input, repInput, router]);

  /** 다음 = 만세력(종전 등록 직후 목적지 그대로). 파라미터도 그대로 넘긴다. */
  const goNext = () => {
    if (!info) { router.replace('/'); return; }
    router.replace('/charts');   // ★위와 같은 이유 — 등록 뒤 기본 도착지는 만세력이다
  };

  // 배경은 일간 오행색을 아주 옅게 깐다 — 전면을 오행색으로 칠하는 시안 구도
  const tint = info ? elementColor[info.element] : colors.ju;

  return (
    <Pressable style={[styles.wrap, { backgroundColor: colors.bg }]} onPress={goNext}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 언덕 — 화면 아래를 채운다 */}
      <Svg width="100%" height="42%" viewBox="0 0 400 200" preserveAspectRatio="none" style={styles.hills} pointerEvents="none">
        {HILLS.map((h, i) => <Path key={i} d={h.d} fill={tint} opacity={h.o} />)}
      </Svg>

      <View style={[styles.body, { paddingTop: insets.top }]}>
        <Text style={styles.done}>{t('analyzed.done', '분석이 완료되었어요!')}</Text>

        <Text style={styles.you}>{t('analyzed.you', '당신은')}</Text>
        <Text style={[styles.ilju, { color: tint }]}>
          {info ? `${info.ko}(${info.gz})` : ''}<Text style={styles.iljuSuffix}>{t('analyzed.ilju', '일주')}</Text>
        </Text>
        <Text style={styles.you}>{t('analyzed.is', '입니다.')}</Text>

        {/* 키워드 — 시안의 한 줄 카피 자리. 60종 카피가 오면 이 자리에 들어간다 */}
        {info?.keywords.length ? (
          <View style={styles.chips}>
            {info.keywords.map((k) => (
              <View key={k} style={styles.chip}><Text style={styles.chipTx}>{k}</Text></View>
            ))}
          </View>
        ) : null}
        <Text style={styles.sub}>{t('analyzed.sub', '당신의 사주를 확인해 보세요.')}</Text>

        <PressableScale style={[styles.cta, { backgroundColor: tint }]} onPress={goNext}>
          <Text style={styles.ctaTx}>{t('analyzed.next', '내 명식 보기')}</Text>
        </PressableScale>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  hills: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  body: { paddingHorizontal: space(6), alignItems: 'center' },
  done: { ...font.label, color: colors.inkSoft, fontWeight: '800', marginBottom: space(8) },
  you: { fontSize: 20, lineHeight: 30, fontWeight: '700', color: colors.ink },
  // 화면에서 가장 큰 글자 — 자기 일주를 처음 보는 순간이다
  ilju: { fontSize: 38, lineHeight: 52, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  iljuSuffix: { fontSize: 26, lineHeight: 52, fontWeight: '800', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(2), marginTop: space(7) },
  chip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.5) },
  chipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(4), textAlign: 'center' },
  cta: { marginTop: space(9), borderRadius: radius.pill, paddingHorizontal: space(8), paddingVertical: space(3.5) },
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
});
