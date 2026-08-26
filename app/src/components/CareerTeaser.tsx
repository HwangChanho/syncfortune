// app/src/components/CareerTeaser.tsx — 사업가↔직장인 성향 저울(무료) 온디바이스 티저 (결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널(재회 ReunionRich / 취업 JobRich 와 같은 결):
//   유료 LLM 풀이(사업가의 나 vs 직장인의 나, kind='career') '위'에 결정론 무료 '성향 저울'을 먼저
//   보여줘 자연스러운 유료 전환을 만든다. supabase/Edge 절대 호출 안 함 — computeChart 산출 saju 만으로 계산.
//
// ▶ 담는 무료 요소(전부 결정론, 한자·십신 용어는 화면 텍스트에 노출 금지 = 일상어):
//   ① 사업가↔직장인 양팔저울(0~100·50=균형) — 중앙에서 실제 비율로 기울며 벌어지는 커스텀 애니 바.
//      ★점수·유형 산출 = lib/content/careerGauge(★daniel 검수 슬롯 = 기여 행렬) / 저울 UI = 이 파일의 BalanceBar.
//   ② 4유형 라벨(조직형/하이브리드/전문가·프리랜서형/독립사업형) + 지배 성향 하이라이트(§4 전향적·우열 아님).
//   ③ 리스크 뉘앙스(있을 때만) — 파격(그릇은 사업가형이나 구조 보완 필요) · 겁재(동업·파재 주의).
//   ④ funnel lines — 무료=성향 저울 / 유료=맞는 직종·창업 타이밍·조직 적응 전략.
//
// ▶ §4 안전(가드4 직업): 어느 쪽도 '더 낫다' 아님 — 성향 차이일 뿐(전향적). 부정 증폭·단정 금지.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { computeCareerSignals, type CareerBand, type BizSignal, type OrgSignal } from '../lib/content/careerGauge';

// 저울 양쪽 색(career.tsx CAREER_TEAL 과 통일 — 사업가=청록 / 직장인=차분한 남청). 두 색으로 스펙트럼을 가른다.
const BIZ_COLOR = '#3FA7A0'; // 사업가(독립·창의) — career 테마색
const ORG_COLOR = '#5B7BB4'; // 직장인(조직·안정) — 차분한 남청

// ⚠️★아래 네 표는 값이 아니라 **문구 키**다(모듈 상수라 `t()` 를 여기서 못 부른다 — 그릴 때 푼다).
// 4유형 → 화면 라벨(한자/십신 없이 일상어).
const BAND_LABEL: Record<CareerBand, string> = {
  org: 'ct.bandOrg', hybrid: 'ct.bandHybrid', pro: 'ct.bandPro', independent: 'ct.bandIndep',
};
// 4유형 → 지배 성향 헤드라인/서브(§4 전향적 — 어느 쪽도 우열 아님, 성향 차이).
const BAND_HEAD: Record<CareerBand, string> = {
  org: 'ct.headOrg', hybrid: 'ct.headHybrid', pro: 'ct.headPro', independent: 'ct.headIndep',
};
const BAND_SUB: Record<CareerBand, string> = {
  org: 'ct.subOrg', hybrid: 'ct.subHybrid', pro: 'ct.subPro', independent: 'ct.subIndep',
};
// 최강 신호(neutral key) → 일상어(전부 '힘/강점'으로 전향 프레이밍).
const BIZ_WORD: Record<BizSignal, string> = {
  creative: 'ct.bizCreative', wealth: 'ct.bizWealth', independent: 'ct.bizIndep', none: 'ct.bizNone',
};
const ORG_WORD: Record<OrgSignal, string> = {
  structure: 'ct.orgStructure', stability: 'ct.orgStability', none: 'ct.orgNone',
};

/**
 * 사업가↔직장인 성향 저울 무료 티저. career.tsx(커스텀 화면)의 히어로 아래·항상 노출(freeHook 관례).
 * @param saju 대표 명식의 사주(원국 + timeUnknown 병합). computeCareerSignals 로 저울·유형 산출.
 */
export function CareerTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  const { t } = useTranslation();
  // 결정론 값은 saju 변경 시에만 1회 산출(성능·단일 소스). 저울 애니 리렌더와 분리.
  const d = useMemo(() => {
    const sig = computeCareerSignals(saju);
    // 양쪽 힘을 '둘 다 강점'으로 묶는 한 줄(전향적) — 어느 쪽도 우열 아님을 시각·문구로 못박음.
    // ⚠️조사가 붙는 문장이라 **틀째로** 문구에 둔다(조각만 옮기면 어순이 어긋난다).
    const bothLine = t('ct.bothLine', '사업가 쪽으로는 {{biz}}, 조직 쪽으로는 {{org}}이 함께 있어요.',
      { biz: t(BIZ_WORD[sig.topBizSignal]), org: t(ORG_WORD[sig.topOrgSignal]) });
    return { ...sig, bothLine };
  }, [saju, t]);

  if (!saju?.pillars) return null; // 방어 — 명식 없으면 티저 생략

  // 헤드라인 색 = 기울기별(사업가=청록 / 직장인=남청 / 유연형=골드).
  const headColor = d.tilt === 'biz' ? BIZ_COLOR : d.tilt === 'org' ? ORG_COLOR : colors.ju;

  return (
    <View style={styles.wrap}>
      {/* 리드(일상어) */}
      <Text style={styles.lead}>{t('ct.lead', "타고난 기운이 '내 사업'에 가까운지 '조직'에 가까운지")}</Text>
      <Text style={styles.leadSub}>{t('ct.leadSub', '양팔저울로 미리 그려 봤어요. 자세한 이야기는 아래에서 열 수 있어요.')}</Text>

      {/* ① 사업가↔직장인 저울(커스텀 애니 바) + 4유형 라벨 */}
      <View style={styles.barCard}>
        <BalanceBar bizPct={d.bizPct} orgPct={d.orgPct} />
        <View style={styles.bandRow}>
          <Text style={styles.bandCap}>{t('ms.mine', '내 유형')}</Text>
          <Text style={[styles.bandLabel, { color: headColor }]}>{t(BAND_LABEL[d.band])}</Text>
        </View>
      </View>

      {/* ② 지배 성향 하이라이트(§4 전향적 — 우열 아님) */}
      <View style={styles.card}>
        <Text style={[styles.head, { color: headColor }]}>{BAND_HEAD[d.band]}</Text>
        <Text style={styles.cardBody}>{BAND_SUB[d.band]}</Text>
        <View style={styles.divider} />
        <Text style={styles.bothLine}>{d.bothLine}</Text>
      </View>

      {/* ③ 리스크 뉘앙스(해당할 때만) — 파격(그릇은 사업가형이나 구조 보완) · 겁재(동업·파재) */}
      {(d.riskFlag || d.partnerRisk) && (
        <View style={styles.card}>
          {d.riskFlag ? (
            <Text style={styles.noteLine}>
              <Text style={styles.noteDot}>· </Text>
              <Text>{t('ct.riskA', "타고난 그릇은 '내 사업'에 어울리지만, 지금 짜임새로는 실행 단계에서 ")}</Text><Text style={styles.noteAccent}>{t('ct.riskB', '구조를 다지는 준비')}</Text><Text>{t('ct.riskC', '가 필요한 결이에요. 그래서 저울이 중앙 쪽에 가까워요.')}</Text>
            </Text>
          ) : null}
          {d.partnerRisk ? (
            <Text style={[styles.noteLine, d.riskFlag && { marginTop: space(2) }]}>
              <Text style={styles.noteDot}>· </Text>
              <Text>{t('ct.partnerA', '혼자보다 ')}</Text><Text style={styles.noteAccent}>{t('ct.partnerB', '동업·공동투자')}</Text><Text>{t('ct.partnerC', '에서는 지분·역할을 또렷이 해두면 탈이 적어요.')}</Text>
            </Text>
          ) : null}
        </View>
      )}

      {/* ── 무료 vs 유료 가치 명시(퍼널 훅) — 바로 아래 게이트(₩4,900 CTA)로 이어진다 ── */}
      <View style={styles.funnelCard}>
        <Text style={styles.funnelLine}><Text>{t('rr.freeA', '무료로는 ')}</Text><Text style={styles.accent}>{t('ct.freeB', '내 성향의 무게추(사업가↔직장인)')}</Text><Text>{t('ct.freeC', '를 볼 수 있어요.')}</Text></Text>
        <Text style={styles.funnelLine}><Text>{t('rr.paidA', '깊은 풀이에선 ')}</Text><Text style={styles.accent}>{t('ct.paidB', '나에게 맞는 직종·창업하기 좋은 시기·조직에서 잘 적응하는 법')}</Text><Text>{t('rr.paidC', '까지 짚어 드려요.')}</Text></Text>
      </View>
    </View>
  );
}

/** 사업가↔직장인 양팔 저울 바(커스텀·애니) — 중앙 50/50 에서 실제 비율로 기울며 벌어진다(무게추=경계). */
function BalanceBar({ bizPct, orgPct }: { bizPct: number; orgPct: number }) {
  const { t } = useTranslation();
  const anim = useRef(new Animated.Value(0)).current; // 0=균형(50/50) → 1=실제 비율
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [anim, bizPct]);
  // 좌(사업가)/우(직장인) 세그먼트 폭 — 50%에서 실제 %로. 합은 항상 100%(빈틈·넘침 없음).
  const bizW = anim.interpolate({ inputRange: [0, 1], outputRange: ['50%', `${bizPct}%`] });
  const orgW = anim.interpolate({ inputRange: [0, 1], outputRange: ['50%', `${orgPct}%`] });
  return (
    <View>
      {/* 양쪽 라벨 + % */}
      <View style={styles.barLabels}>
        <Text style={[styles.sideLabel, { color: BIZ_COLOR }]}>{t('ct.biz', '사업가')} <Text style={styles.sidePct}>{bizPct}%</Text></Text>
        <Text style={[styles.sideLabel, { color: ORG_COLOR }]}><Text style={styles.sidePct}>{orgPct}%</Text> {t('ct.org', '직장인')}</Text>
      </View>
      {/* 저울 바 — 좌(사업가)·우(직장인) 두 세그먼트가 밝은 경계(무게추)에서 만난다 */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.segBiz, { width: bizW }]} />
        <Animated.View style={[styles.segOrg, { width: orgW }]} />
      </View>
      {/* 스펙트럼 힌트 */}
      <View style={styles.barEnds}>
        <Text style={styles.endHint}>← {t('ct.endBiz', '내 사업·독립')}</Text>
        <Text style={styles.endHint}>{t('ct.endOrg', '조직·안정')} →</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  // 리드(JobRich/RootsTeaser 와 동일 결)
  lead: { ...font.body, fontWeight: '800', color: BIZ_COLOR, fontSize: 16, marginBottom: space(1.5) },
  leadSub: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(3), fontSize: 12 },
  // 공통 카드(sunk 배경 — ReunionRich/JobRich 결)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(3) },
  cardBody: { ...font.caption, color: colors.inkSoft, lineHeight: 19, fontSize: 12 },
  accent: { color: BIZ_COLOR, fontWeight: '800' },

  // ── 저울 바 카드 ──
  barCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3) },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space(2) },
  sideLabel: { ...font.caption, fontWeight: '800', fontSize: 13 },
  sidePct: { fontSize: 15, fontWeight: '900' },
  barTrack: { flexDirection: 'row', height: 18, borderRadius: radius.pill, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  segBiz: { height: '100%', backgroundColor: BIZ_COLOR, borderRightWidth: 3, borderRightColor: 'rgba(255,255,255,0.85)' }, // 우측 밝은 경계 = 무게추(저울 기울기 지점)
  segOrg: { height: '100%', backgroundColor: ORG_COLOR },
  barEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(1.5) },
  endHint: { ...font.caption, color: colors.inkFaint, fontSize: 10.5 },
  // 4유형 라벨
  bandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space(4), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.line },
  bandCap: { ...font.caption, color: colors.inkFaint, fontSize: 12, marginRight: space(2) },
  bandLabel: { fontSize: 18, fontWeight: '900', letterSpacing: 0.3 }, // 색은 headColor 주입

  // ── 지배 성향 하이라이트 ──
  head: { ...font.body, fontWeight: '800', fontSize: 15, marginBottom: space(1.5), lineHeight: 21 }, // 색은 headColor 주입
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space(3), opacity: 0.6 },
  bothLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, fontSize: 12 },

  // ── 리스크 뉘앙스 ──
  noteLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, fontSize: 12 },
  noteDot: { color: colors.inkFaint, fontWeight: '900' },
  noteAccent: { color: colors.ju, fontWeight: '800' },

  // ── 퍼널 가치 명시 ──
  funnelCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4) },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
});
