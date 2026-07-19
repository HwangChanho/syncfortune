// src/components/PersonaTypeHero.tsx — 홈 주인공 ①: 나의 성격유형(120종)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-18 IA 개편: 콘텐츠 카드 그리드를 '풀이' 탭으로 보내고, 홈의 주인공을
//   **성격유형 히어로 + 오늘 기운 카드**로 바꾼다. 이 파일이 그 ①.
//
// 산출 = engine/personaType.ts(일간10 × 월지12 = 120종, 커밋 f863a37) — 온디바이스·결정론·API 0.
//   축 근거: 전문가 검수 "전체 기운은 월지만 봐도 된다 · 기준점은 월지의 계절"(2026-07-14) + 일간=나 자신.
//
// ⚠️이미지 120장은 아직 없다(Draw Things 로컬 생성 예정 — personaType.imagePrompt 가 씨앗).
//   그때까지 폴백 = **오행색 간지 네모 2글자**(홈 오늘의 기운 배너·만세력에서 이미 쓰는 앱의 시각 언어라
//   이질감이 없고, 이미지가 생기면 이 자리를 그대로 교체하면 된다).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { loadRepChart } from '../lib/engine/myChart';
import { computeChart } from '../lib/engine/engine';
import { personaOf, type PersonaType } from '../lib/engine/personaType';
import { stemElement, branchElement, elementColor, elementText } from '../lib/engine/ohaeng';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { Stem, Branch } from '@spec/chart';

/**
 * 대표 명식 → 성격유형 1종을 산출한다(실패 시 null).
 * 격(格)은 R55 = 월지 본기 십신 — detectPattern().name('편재격')에서 '격'을 뗀 값을 엔진에 넘긴다.
 */
export function personaFromRepChart(input: any): PersonaType | null {
  try {
    const c = computeChart(input);
    const dayStem = c.saju.pillars['일'].stem as Stem;
    const monthBranch = c.saju.pillars['월'].branch as Branch;
    const gyeok = c.pattern?.name?.replace('격', '') || undefined; // '편재격' → '편재'
    return personaOf(dayStem, monthBranch, gyeok);
  } catch { return null; } // 구버전 차트 등 — 홈이 깨지지 않게 조용히 미노출
}

/** 홈 주인공 카드. reloadKey = 대표 명식 전환/포커스 시 홈이 올려 재산출. */
export function PersonaTypeHero({ reloadKey }: { reloadKey?: number }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [persona, setPersona] = useState<PersonaType | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setPersona(ch ? personaFromRepChart(ch.input) : null);
    })().catch(() => { if (alive) setPersona(null); });
    return () => { alive = false; };
  }, [reloadKey]);

  // 명식이 없으면 아예 렌더하지 않는다 — 바로 아래 자기이해 히어로가 이미 '명식 등록' CTA 를 띄우므로
  //   같은 유도를 두 번 쌓지 않기 위함(daniel: 홈이 안내문으로 도배되지 않게).
  if (!persona) return null;

  // ★글자마다 자기 오행색(daniel 2026-07-19 "글자별로 색이 안맞아") — 앞 글자 색을 뒤 글자에도 쓰고
  //   투명도만 달리하던 버그. 일간은 천간 오행, 월지는 **지지 오행**으로 각각 칠한다(만세력·오늘의 기운과 동일 규칙).
  const stemEl = stemElement(persona.dayStem);
  const branchEl = branchElement(persona.monthBranch);
  return (
    <PressableScale style={styles.card} onPress={() => router.push('/personatype')}>
      {/* 머리말 + 희소성(120종 중 하나) — '나에 대한 분석'이라는 프레이밍(App Store 4.3 결) */}
      <View style={styles.head}>
        <Text style={styles.kicker}>{t('persona120.kicker', '나의 성격유형')}</Text>
        <View style={styles.countPill}><Text style={styles.countTx}>{t('persona120.count', '120종 중')}</Text></View>
      </View>

      <View style={styles.row}>
        {/* 폴백 시각 = 일간·월지 오행색 네모(만세력·오늘의 기운과 같은 언어). 이미지 120장 생기면 이 View 를 교체. */}
        <View style={styles.gzRow}>
          <View style={[styles.gzBox, { backgroundColor: elementColor[stemEl] }]}><Text style={[styles.gzTx, { color: elementText[stemEl] }]}>{persona.dayStem}</Text></View>
          <View style={[styles.gzBox, { backgroundColor: elementColor[branchEl] }]}><Text style={[styles.gzTx, { color: elementText[branchEl] }]}>{persona.monthBranch}</Text></View>
        </View>
        <View style={styles.titleCol}>
          <Text style={[styles.name, { fontSize: fs(19) }]} numberOfLines={2}>{persona.name}</Text>
          <View style={styles.chips}>
            {persona.keywords.map((k) => (
              <View key={k} style={styles.chip}><Text style={styles.chipTx}>{k}</Text></View>
            ))}
          </View>
        </View>
      </View>

      <Text style={[styles.summary, { fontSize: fs(13.5), lineHeight: fs(20) }]} numberOfLines={3}>{persona.summary}</Text>
      <Text style={styles.more}>{t('persona120.more', '자세히 보기')} ›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(4), marginBottom: space(4), ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(3) },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.4 },
  countPill: { backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(0.5) },
  countTx: { fontSize: 10.5, fontWeight: '800', color: colors.ju, letterSpacing: 0.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3.5) },
  gzRow: { flexDirection: 'row', gap: space(1) },
  gzBox: { width: 38, height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  gzTx: { fontSize: 24, fontWeight: '800', lineHeight: 30 },
  titleCol: { flex: 1 },
  name: { ...font.heading, color: colors.ink, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2) },
  chip: { backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(0.5) },
  chipTx: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  summary: { ...font.body, color: colors.inkSoft, marginTop: space(3) },
  more: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: space(2.5), textAlign: 'right' },
});
