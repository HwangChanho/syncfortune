// app/src/components/home/TodayFortuneBlock.tsx — 오늘/내일 운세 블록
// ═══════════════════════════════════════════════════════════════════════════
// ★왜 컴포넌트로 뺐나 (2026-08-19)
//   Boss 가 홈에 있던 것들을 **친구목록의 「친구」**로 옮기기로 했다
//   (*"기존 오늘의 운세같은건 친구목록에 오늘의 운세로 떠있게하고 그거 탭하면 대화창에서"*).
//   홈 블록 아홉은 이미 각자 독립 컴포넌트였는데 **오늘의 운세만 `index.tsx` 안에 인라인**이라
//   대화창에서 쓸 수가 없었다.
//   ⚠️여기서 화면을 새로 그렸다면 홈과 대화창이 **같은 운세를 다르게** 보여 줬을 것이다
//     ([[duplicate-ui-single-source]] — 실제로 지도 65점 ↔ 궁합 76점으로 갈린 적이 있다).
//   ⇒ 옮기기만 한다. 문구·판정·레이아웃 어느 것도 바꾸지 않았다.
//
// ■ 데이터는 스스로 로드한다
//   다른 홈 카드(`BiorhythmCard`·`LuckyTodayCard` …)와 같은 패턴이다.
//   부모가 명식을 내려 주는 구조로 만들면 대화창에서도 그 배관을 다시 깔아야 한다.
//
// ■ 원가 0
//   판정(`dailyEnergy`)·문구(`getDailyReading`) 모두 온디바이스 결정론이다.
//   서버는 **이미 만들어 둔 통변 캐시가 있을 때만** 읽는다(새로 만들지 않는다).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { ScoreCard } from '../kit/ScoreCard';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { getDailyFortune, dailyHeadline, getDailyReading, dailyEnergy, type DailyEnergy } from '../../lib/content/dailyFortune';
import { supabase } from '../../lib/supabase';
import { excludeMock } from '../../lib/core/testMode';
import { readingLang } from '../../lib/i18n';
import { useAuth } from '../../lib/useAuth';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, space, radius } from '../../lib/theme';
import type { Stem, Branch } from '@spec/chart';

// 주의 등급 라벨 — ★'조심'에 빨강을 쓰지 않는다(§4 부정 증폭 금지).
const CAUTION: Record<DailyEnergy['caution'], { label: string }> = {
  low: { label: '순조' }, mid: { label: '보통' }, high: { label: '조심' },
};

/**
 * 오늘/내일 운세 블록 — 홈과 대화창이 **같이 쓴다**.
 *
 * @param reloadKey 명식이 바뀌면 올려서 재계산시킨다(id 가 같아도 내용이 바뀔 수 있다)
 * @param dateKey   날짜가 바뀌면 올려서 재계산시킨다(앱을 켜둔 채 자정이 지나는 경우)
 */
export function TodayFortuneBlock({ reloadKey = 0, dateKey }: { reloadKey?: number; dateKey?: string }) {
  const { t } = useTranslation();
  const { fs } = useFontScale();   // 글자 확대 대응 — 인라인 크기는 반드시 이걸 통과시킨다
  const router = useRouter();
  const { session } = useAuth();
  const [hasChart, setHasChart] = useState(true);
  const [dayOffset, setDayOffset] = useState(0);                 // 0=오늘 · 1=내일
  const fortunes = useMemo(() => [getDailyFortune(0), getDailyFortune(1)], [dateKey]);
  const pager = useRef<ScrollView>(null);
  const [pageW, setPageW] = useState(Dimensions.get('window').width - space(5) * 2 - space(4) * 2);
  const goDay = (off: number) => { setDayOffset(off); pager.current?.scrollTo({ x: off * pageW, animated: true }); };
  const [dayData, setDayData] = useState<{ headline: string | null; prose: string | null }[]>(
    [{ headline: null, prose: null }, { headline: null, prose: null }]);
  const [energies, setEnergies] = useState<(DailyEnergy | null)[]>([null, null]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      setHasChart(!!rep);
      if (!rep) { setDayData([{ headline: null, prose: null }, { headline: null, prose: null }]); setEnergies([null, null]); return; }
      const saju = computeChart(rep.input).saju;  // ★상세(/today)와 동일 빌더 — classifyStrength 일치(favorGood 뒤집힘 방지)
      try {
        setEnergies(fortunes.map((f) => dailyEnergy(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch)));
      } catch { setEnergies([null, null]); }
      // ★본문 = 상세(/today)와 **같은 소스**(getDailyReading 통합 첫문장) — 홈≠상세 어긋남 방지
      const firstSentence = (s: string) => { const tx = (s || '').trim(); const m = tx.match(/^[\s\S]*?[.!?。]\s/); return (m ? m[0] : tx).trim(); };
      const calc = (f: typeof fortunes[number]) => ({
        prose: firstSentence(getDailyReading(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch, 'day').general),
        headline: dailyHeadline(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch),
      });
      const base = [calc(fortunes[0]), calc(fortunes[1])];
      if (alive) setDayData(base);   // 룰 기반 즉시 표시(즉시성 — 절대규칙5)

      // 같은 날 LLM 통변 캐시가 **이미 있으면** 그 제목/본문을 우선(상세와 정합). 새로 만들지 않는다.
      if (session && rep.serverChartId) {
        try {
          const cats = fortunes.map((f) => `daily_${f.date.replace(/-/g, '')}`);
          const { data } = await excludeMock(supabase.from('readings')
            .select('category, content').eq('chart_id', rep.serverChartId).eq('lang', readingLang()).in('category', cats));
          if (!alive || !data?.length) return;
          const byCat: Record<string, Record<string, string>> = {};
          for (const r of data as { category: string; content: Record<string, string> }[]) byCat[r.category] = r.content;
          setDayData(fortunes.map((f, i) => {
            const c = byCat[`daily_${f.date.replace(/-/g, '')}`];
            if (!c?.headline) return base[i];         // 그 날 통변이 없으면 룰 유지(보통 내일은 없다)
            return { headline: c.headline, prose: firstSentence(c.general) || base[i].prose };
          }));
        } catch { /* 캐시 조회 실패 시 룰 유지 */ }
      }
    })();
    return () => { alive = false; };
  }, [fortunes, reloadKey, session]);

  // 명식이 없으면 — ★주 CTA 는 '가볍게 보기'다(등록 폼을 먼저 만나지 않게)
  if (!hasChart) {
    return (
      <View style={styles.wrap}>
        <View style={{ alignItems: 'center', paddingVertical: space(3.5), gap: space(1.5) }}>
          <Text style={{ color: colors.ju, fontWeight: '900', fontSize: fs(16), textAlign: 'center' }}>{t('home.noChartTitle', 'AI가 분석하는 나 — 여기서 시작')}</Text>
          <Text style={{ color: colors.inkSoft, fontSize: fs(13), textAlign: 'center' }}>{t('home.noChartSub2', '생년월일만 넣으면 성격유형과 일주를 바로 볼 수 있어요. 가입도, 저장도 안 해요.')}</Text>
          <PressableScale onPress={() => router.push('/light')} style={{ backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(2) }}>
            <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(14) }}>{t('home.lightCta', '가볍게 보기')}</Text>
          </PressableScale>
          <PressableScale onPress={() => router.push('/register')} style={{ paddingVertical: space(2), paddingHorizontal: space(4) }}>
            <Text style={{ color: colors.inkSoft, fontWeight: '700', fontSize: fs(13) }}>{t('home.noChartCta', '+ 명식 등록')}</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toggle}>
        {([0, 1] as const).map((off) => (
          <PressableScale key={off} style={[styles.chip, dayOffset === off && styles.chipOn]} onPress={() => goDay(off)}>
            <Text style={[styles.chipTx, dayOffset === off && styles.chipTxOn]}>{t(off === 0 ? 'today.today' : 'today.tomorrow')}</Text>
          </PressableScale>
        ))}
      </View>
      {/* 가로 페이징 — onLayout 으로 페이지 폭 확정 후 한 페이지씩 스냅 */}
      <View onLayout={(e) => setPageW(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setDayOffset(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageW)))}
        >
          {([0, 1] as const).map((off) => {
            const e = energies[off];
            return (
              <View key={off} style={{ width: pageW }}>
                {/* ★시안 p04 — 좌: 「오늘의 운세」·큰 점수·상태칩 / 우: 제목·2줄·자세히보기.
                    간지 박스·꺾은선·유형명·억부 근거·신살 칩은 지운 게 아니라 `/today` 로 옮겼다. */}
                <ScoreCard
                  label={off === 0 ? t('today.title', '오늘의 운세') : t('today.energyTomorrow', '내일의 기운')}
                  score={e?.score ?? '—'}
                  tone={e ? CAUTION[e.caution].label : undefined}
                  title={dayData[off].headline ?? ''}
                  body={dayData[off].prose ?? undefined}
                  unitLabel={t('todayEnergy.point', '점')}
                  moreLabel={t('today.more', '분야별로 자세히 보기 →')}
                  onPress={() => router.push(`/today?offset=${off}`)}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(1) },
  toggle: { flexDirection: 'row', gap: space(2), marginBottom: space(2) },
  chip: { paddingHorizontal: space(4), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 13, fontWeight: '800', color: colors.inkSoft },
  // ★강조색 위 글자는 `colors.onJu`(`check:onaccent`)
  chipTxOn: { color: colors.onJu },
});
