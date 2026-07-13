// app/src/components/JobfitTeaser.tsx — '나에게 어울리는 직업' 무료 온디바이스 티저(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널(재회/취업/사업가 티저와 같은 결): 유료 LLM 딥리포트(kind='jobfit') '위'에
//   결정론 무료 '타고난 적성 강점'을 먼저 보여줘 자연스러운 유료 전환을 만든다. supabase/Edge 절대 호출 안 함.
//
// ▶ 신호 소스 = careerGauge.computeCareerSignals(saju) (★daniel 검수 = 기여 행렬·golden). 여기선 그 신호를
//   '사업가↔직장인 저울'(career 티저)이 아니라 *적성 강점 결*로 재프레이밍 → career 티저와 시각/문구 차별화.
// ▶ 담는 무료 요소(전부 결정론, 한자·십신 용어 화면 노출 금지 = 일상어):
//   ① 타고난 적성 강점 top(식상=아이디어/재성=성과/비겁=주도/관성=체계/인성=전문) — 최강 1~2개.
//   ② 일하는 결(4유형: 조직형/하이브리드/전문가·프리랜서형/독립형) — careerGauge band.
//   ③ funnel: 무료=적성 강점 결 / 유료=어울리는 직종·끌림vs능력 간극·직업 인생 흐름.
// ▶ §4 안전(가드4 직업): 어느 결도 '더 낫다' 아님 — 강점 프레이밍(전향적). 부정 증폭·단정 금지.
//   ※ 신호=daniel 검수본 재사용. 이 파일의 '적성 일상어 매핑'은 표현 계층 → daniel 카피 조정 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { computeCareerSignals, type CareerBand, type BizSignal, type OrgSignal } from '../lib/content/careerGauge';

// 4유형 → 화면 라벨(career 티저와 동일 개념·일관). '일하는 결'로 프레이밍.
const BAND_LABEL: Record<CareerBand, string> = {
  org: '조직형',
  hybrid: '하이브리드형',
  pro: '전문가·프리랜서형',
  independent: '독립형',
};
// 최강 신호(neutral key) → 적성 강점 일상어(전부 '강점'으로 전향 프레이밍 — §4).
const BIZ_APT: Record<BizSignal, string> = {
  creative: '아이디어를 내고 표현하는 결',
  wealth: '직접 부딪혀 성과를 만드는 결',
  independent: '스스로 주도하고 개척하는 결',
  none: '자기 주도로 움직이는 결',
};
const ORG_APT: Record<OrgSignal, string> = {
  structure: '체계를 세우고 조율하는 결',
  stability: '배우고 전문성을 쌓아가는 결',
  none: '틀 안에서 꾸준히 쌓아가는 결',
};

/**
 * '나에게 어울리는 직업' 무료 티저 — SpecialContentScreen freeHook 로 히어로 아래·항상 노출.
 * @param saju 대표 명식 사주(원국 + timeUnknown 병합). computeCareerSignals 로 적성 신호 산출.
 */
export function JobfitTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  const d = useMemo(() => {
    const sig = computeCareerSignals(saju);
    // 강점 2줄(사업가축 최강 + 조직축 최강). 둘 다 '강점'으로 병렬 — 우열 아님(§4).
    const strengths = [BIZ_APT[sig.topBizSignal], ORG_APT[sig.topOrgSignal]];
    return { band: sig.band, strengths };
  }, [saju]);

  if (!saju?.pillars) return null; // 방어 — 명식 없으면 티저 생략

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>타고난 적성으로 어떤 결이 강한지</Text>
      <Text style={styles.leadSub}>먼저 무료로 짚어 봤어요. 어울리는 직업까지는 아래에서 열 수 있어요.</Text>

      {/* ① 타고난 적성 강점 top 2 */}
      <View style={styles.card}>
        <Text style={styles.cardCap}>타고난 적성 강점</Text>
        {d.strengths.map((s, i) => (
          <View key={i} style={styles.strengthRow}>
            <Text style={styles.dot}>◆</Text>
            <Text style={styles.strengthTx}>{s}</Text>
          </View>
        ))}
        {/* ② 일하는 결(4유형) */}
        <View style={styles.bandRow}>
          <Text style={styles.bandCap}>일하는 결</Text>
          <Text style={styles.bandLabel}>{BAND_LABEL[d.band]}</Text>
        </View>
      </View>

      {/* ③ funnel — 무료/유료 경계 명시(전향적) */}
      <Text style={styles.funnel}>
        지금은 <Text style={styles.funnelFree}>적성 강점</Text> 미리보기예요 · 전체 풀이에선 이 결에 <Text style={styles.funnelPaid}>어울리는 직종</Text>, 끌림과 능력의 간극, 직업 인생 흐름까지 짚어 드려요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  lead: { ...font.heading, color: colors.ink, textAlign: 'center' },
  leadSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(3) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4) },
  cardCap: { ...font.caption, color: colors.inkSoft, marginBottom: space(2) },
  strengthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginBottom: space(1.5) },
  dot: { color: colors.ju, fontSize: 13, marginTop: 2 },
  strengthTx: { ...font.body, color: colors.ink, flex: 1 },
  bandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(2), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.line },
  bandCap: { ...font.caption, color: colors.inkSoft },
  bandLabel: { ...font.heading, color: colors.ju, fontWeight: '800' },
  funnel: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginTop: space(3), textAlign: 'center' },
  funnelFree: { color: colors.ink, fontWeight: '700' },
  funnelPaid: { color: colors.ju, fontWeight: '700' },
});
