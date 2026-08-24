// app/src/components/home/MonthFortuneBlock.tsx — **이달의 운세** 블록
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"이달의 운세 블록 만들고 성태현한테 붙여"*
//
// ■ ★새로 판정하지 않는다 — `/month` 상세와 **같은 소스**를 읽는다
//   `getDailyFortune().monthGanZhi`(월건) → `dailyEnergy`(점수) · `dailyHeadline(…, 'month')`(제목)
//   · `getDailyReading(…, 'month')`(본문). 셋 다 `/month` 가 쓰는 그것이다.
//   ⚠️여기서 따로 계산하면 **블록과 상세가 다른 달 운세**를 말하게 된다
//     ([[duplicate-ui-single-source]] — 지도 65점 ↔ 궁합 76점으로 갈린 적이 있다).
//
// ■ 오늘의 운세 블록과 **같은 모양**으로 둔다
//   `ScoreCard` 를 쓰고, 명식이 없으면 같은 안내를 낸다. 나란히 놓였을 때 형제로 보여야 한다.
//   ⚠️다만 **오늘/내일 같은 페이저는 안 넣었다** — 다음 달은 절기 경계 때문에 월건이 헷갈리기 쉽고,
//     Boss 요청도 *"이달"* 하나였다. 필요해지면 그때 붙인다.
//
// ■ 원가 0 — 판정·문구 모두 온디바이스 결정론. 서버는 **이미 있는 캐시만** 읽는다(새로 안 만든다).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { ScoreCard } from '../kit/ScoreCard';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { getDailyFortune, dailyHeadline, getDailyReading, dailyEnergy, type DailyEnergy } from '../../lib/content/dailyFortune';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, space, radius } from '../../lib/theme';
import type { Stem, Branch } from '@spec/chart';

/** 주의 등급 라벨 — ★'조심'에 빨강을 쓰지 않는다(§4 부정 증폭 금지). 오늘 블록과 같은 표. */
const CAUTION: Record<DailyEnergy['caution'], string> = { low: '순조', mid: '보통', high: '조심' };

/**
 * 이달의 운세 블록 — 홈·대화창이 **같이 쓴다**.
 *
 * @param reloadKey 명식이 바뀌면 올려서 재계산
 * @param dateKey   날짜가 바뀌면 올려서 재계산(달이 넘어가는 경우)
 */
export function MonthFortuneBlock({ reloadKey = 0, dateKey }: { reloadKey?: number; dateKey?: string }) {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const [hasChart, setHasChart] = useState(true);
  const [data, setData] = useState<{ headline: string | null; prose: string | null; energy: DailyEnergy | null }>(
    { headline: null, prose: null, energy: null });

  const f = useMemo(() => getDailyFortune(), [dateKey]);   // monthGanZhi = 이번 달 월건
  const stem = f.monthGanZhi[0] as Stem;
  const branch = f.monthGanZhi[1] as Branch;

  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      setHasChart(!!rep);
      if (!rep) { setData({ headline: null, prose: null, energy: null }); return; }
      try {
        const saju = computeChart(rep.input).saju;   // ★상세(/month)와 동일 빌더
        // 첫 문장만 — 블록은 훑는 자리다(상세로 가면 다섯 분야가 다 있다)
        const firstSentence = (s: string) => { const tx = (s || '').trim(); const m = tx.match(/^[\s\S]*?[.!?。]\s/); return (m ? m[0] : tx).trim(); };
        if (alive) setData({
          headline: dailyHeadline(saju, stem, branch, 'month'),
          prose: firstSentence(getDailyReading(saju, stem, branch, 'month').general),
          energy: dailyEnergy(saju, stem, branch),
        });
      } catch { if (alive) setData({ headline: null, prose: null, energy: null }); }
    })();
    return () => { alive = false; };
  }, [stem, branch, reloadKey]);

  // 명식이 없으면 — ★오늘의 운세 블록과 **같은 안내**(둘이 다른 말을 하면 안 된다)
  if (!hasChart) {
    return (
      <View style={styles.wrap}>
        <View style={{ alignItems: 'center', paddingVertical: space(3.5), gap: space(1.5) }}>
          <Text style={{ color: colors.ju, fontWeight: '900', fontSize: fs(16), textAlign: 'center' }}>
            {t('home.monthNoChart', '이번 달 흐름도 명식이 있어야 볼 수 있어요')}
          </Text>
          <PressableScale onPress={() => router.push('/light')} style={{ backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(2) }}>
            <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(14) }}>{t('home.lightCta', '가볍게 보기')}</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { fontSize: fs(14), lineHeight: Math.round(fs(14) * 1.5) }]}>
          {t('home.monthTitle', '이달의 운세')}
        </Text>
        {/* 어느 달인지 밝힌다 — 절기 기준이라 양력 달과 어긋날 수 있다 */}
        <Text style={[styles.sub, { fontSize: fs(11.5), lineHeight: Math.round(fs(11.5) * 1.5) }]}>
          {f.yearGanZhi}년 {f.monthGanZhi}월
        </Text>
      </View>
      <ScoreCard
        label={data.energy ? CAUTION[data.energy.caution] : '—'}
        score={data.energy ? data.energy.score : '—'}
        title={data.headline ?? t('home.monthLoading', '이번 달 흐름을 보고 있어요')}
        body={data.prose ?? undefined}
        onPress={() => router.push('/month')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(3) },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space(2), marginBottom: space(2), paddingHorizontal: space(1) },
  title: { color: colors.ink, fontWeight: '900' },
  sub: { color: colors.inkFaint, fontWeight: '700' },
});
