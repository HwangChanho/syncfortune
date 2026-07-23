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
import { PersonaImage } from './PersonaImage'; // 성격유형 카드 이미지(서버 fetch·실패 시 오행색 폴백)
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
  const [sex, setSex] = useState<'남' | '여' | undefined>(undefined); // 성별 → PersonaImage 가 URL 조립

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setPersona(ch ? personaFromRepChart(ch.input) : null);
      setSex((ch?.input as any)?.sex); // 성별 → 성별맞춤 카드 이미지(없으면 폴백)
    })().catch(() => { if (alive) { setPersona(null); setSex(undefined); } });
    return () => { alive = false; };
  }, [reloadKey]);

  // 명식이 없으면 아예 렌더하지 않는다 — 바로 아래 자기이해 히어로가 이미 '명식 등록' CTA 를 띄우므로
  //   같은 유도를 두 번 쌓지 않기 위함(daniel: 홈이 안내문으로 도배되지 않게).
  if (!persona) return null;

  return (
    <PressableScale style={styles.card} onPress={() => router.push('/personatype')}>
      {/* 머리말 + 희소성(120종 중 하나) — '나에 대한 분석'이라는 프레이밍(App Store 4.3 결) */}
      <View style={styles.head}>
        <Text style={styles.kicker} numberOfLines={1}>{t('persona120.kicker', '120가지 유형 중 나는 어떤 유형일까')}</Text>
      </View>

      <View style={styles.row}>
        {/* 성별맞춤 카드 이미지(서버 fetch) — URL 없음/로드 실패 시 오행색 네모 폴백(PersonaImage 내부 처리) */}
        <PersonaImage dayStem={persona.dayStem} monthBranch={persona.monthBranch} sex={sex} width={60} height={77} />
        <View style={styles.titleCol}>
          <Text style={[styles.name, { fontSize: fs(19) }]} numberOfLines={2}>{persona.name}</Text>
          <View style={styles.chips}>
            {persona.keywords.map((k) => (
              <View key={k} style={styles.chip}><Text style={styles.chipTx}>{k}</Text></View>
            ))}
          </View>
        </View>
      </View>

      <Text style={[styles.summary, { fontSize: fs(13.5), lineHeight: fs(22) }]} numberOfLines={3}>{persona.summary}</Text>
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
  titleCol: { flex: 1 },
  name: { ...font.heading, color: colors.ink, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2) },
  chip: { backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(0.5) },
  chipTx: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  summary: { ...font.body, color: colors.inkSoft, marginTop: space(3), letterSpacing: 0.2 },
  more: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: space(2.5), textAlign: 'right' },
});
