// app/src/components/JobRich.tsx — 취업·이직(무료) 리치 콘텐츠 셸 (결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 모델: "무료를 결정론+비주얼로 풍부하게 → 유료 자연 구매". FreeFunnel 의 render 로 주입되는
//   취업·이직 전용 무료 본문(재회 ReunionRich 와 같은 구조·톤의 취업 버전). supabase/Edge 절대 호출 안 함
//   — computeChart 산출 saju 만으로 전부 계산. 기존 JobTiming(유리한 해 달력)을 그대로 품고,
//   그 위에 게이지·신호·개운 티저를 얹어 '가능성·시기·결'을 시각화 → 골드 CTA(유료 깊은 풀이)로 유도.
//
// ▶ 담는 무료 요소(전부 결정론, 한자·십신 용어는 화면 텍스트에 노출 금지 = 일상어):
//   ① 취업 가능성 게이지(0~100) — 지금 운(대운·세운)의 관/인 발동 + 유리한 해 + 원국 바탕 합산.
//      ★점수 산출 = lib/content/jobGauge / 미터 UI = PossibilityGauge(재회와 공용 컴포넌트).
//   ② 취업 운 신호 카드 — 지금 관성(직장·자리)·인성(자격·서류)·식상(면접·실력)·재성(결실)이 어떻게 받쳐 주는지(전향적).
//   ③ 취업·합격 유리한 해 — 기존 JobTiming(연 단위 달력, 그대로 품음).
//   ④ 취업 개운 티저 — 지원·면접에 힘을 주는 색·요일 중 딱 하나만 무료, 나머지·방위·실천법은 🔒(유료).
//   ⑤ funnel lines — 무료=가능성·시기 / 유료=합격 전략·맞는 직종·개운·이직 타이밍.
//
// ▶ §4 안전(가드4 직업): 부정 증폭·불안 조장 금지 · 단정 금지 · 진단엔 처방 동반 · 막힌 국면도 전향적(다지는 구간).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart, Element, Stem } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { JobTiming } from './JobTiming';                        // 기존 '취업·합격 유리한 해' 연 단위 달력(그대로 품음)
import { PossibilityGauge } from './PossibilityGauge';          // 공용 가능성 게이지(재회·애정·취업 공유)
import { computeJobSignals } from '../lib/content/jobGauge';    // 취업 게이지 결정론 신호(온디바이스 엔진)

// 개운 티저 짝/홀 선택용 일간 순서(재회 ReunionRich 와 동일 결정론 방식 — random 아님).
const ALL_STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
// 인성 오행(나를 생하는 오행 = 자격·문서·합격의 기운). 개운 색/요일 매핑 기준(취업 도메인 = 인성 = 자격·합격).
//   ★daniel 검수 슬롯: 개운 기준을 '인성 오행'으로 둔 것(자격·서류·합격이 취업의 문을 여는 결) = sensible default.
const INSEONG_EL: Record<Element, Element> = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
// 오행 → 취업 개운(방위·색·요일, 일상어). ReunionRich 표와 같은 결(색만 취업답게 단정한 톤).
const ELEM_GAEUN: Record<Element, { dir: string; color: string; day: string }> = {
  木: { dir: '동쪽', color: '맑은 청록빛', day: '목요일' },
  火: { dir: '남쪽', color: '따뜻한 붉은빛', day: '화요일' },
  土: { dir: '가까운 곳', color: '포근한 노란·베이지빛', day: '토요일' },
  金: { dir: '서쪽', color: '단정한 흰·은빛', day: '금요일' },
  水: { dir: '북쪽', color: '깊은 남색빛', day: '수요일' },
};

/**
 * 취업·이직 무료 리치 본문. FreeFunnel 의 render 로 주입(대표 명식 saju).
 * @param saju 대표 명식의 사주(결정론 산출 + timeUnknown 병합됨 — FreeFunnel 참고). sex 는 취업에 무관(무시).
 */
export function JobRich({ saju }: { saju: SajuChart }) {
  // 모든 결정론 값은 saju 변경 시에만 1회 산출(성능·단일 소스). 게이지 카운트업 리렌더와 분리.
  const d = useMemo(() => {
    // ① 취업 게이지 신호(온디바이스 엔진) — timeUnknown 은 saju 병합값을 읽음(opts 미전달 = 기존 동작).
    const sig = computeJobSignals(saju);
    const { score, tone, gwanActive, inActive, siksangActive, jaeActive, natalGwanIn, primary } = sig;

    // 경향 라벨/문구(§4 경향·단정 금지 + 처방 동반 + 전향적). tone 경계 = 재회 게이지와 동일(66/34).
    const tendency = tone === 'open' ? '열려 있어요' : tone === 'warming' ? '서서히 열려요' : '지금은 조용해요';
    const gaugeCaption = tone === 'open'
      ? '지금 직장·합격의 문이 활짝 열리는 흐름이에요. 원서·면접·이직을 준비하면 흐름을 타기 좋아요.'
      : tone === 'warming'
        ? '직장·합격의 문이 서서히 열리는 중이에요. 자격·서류를 미리 갖춰 두면 열리는 때를 놓치지 않아요.'
        : '지금은 문이 잠잠한 편이에요. 조급해하기보다 실력·자격을 다지며 다음 흐름을 준비하기 좋은 때예요.';

    // ② 취업 운 신호 — 지금 도드라진 기운(헤드라인) + 받쳐 주는 기운들을 일상어로(전향적)
    const signalLabel = primary === 'gwan' ? '직장·자리의 기운이 들어와요'
      : primary === 'in' ? '자격·합격의 기운이 받쳐 줘요'
        : primary === 'siksang' ? '실력을 보여줄 기운이 도와요'
          : primary === 'jae' ? '결실·보상의 기운이 함께해요'
            : '지금은 기운이 조용한 편이에요';
    // 받쳐 주는 기운 조각(활성만 모아 한 문장으로 — 각 조각이 '기운'으로 끝나 뒤 조사 '이' 가 자연스럽게 붙음)
    const parts: string[] = [];
    if (gwanActive) parts.push('직장·자리가 열리는 기운');
    if (inActive) parts.push('자격·시험·서류를 뒷받침하는 기운');
    if (siksangActive) parts.push('면접·실무에서 실력을 보여줄 기운');
    if (jaeActive) parts.push('노력이 결실·보상으로 이어질 기운');
    const signalBody = parts.length
      ? `지금 흐름에는 ${parts.join(' · ')}이 함께 들어와 있어요. 준비해 둔 만큼 기회를 잡기 좋은 때예요.`
      : natalGwanIn
        ? '지금은 특정 기운이 크게 도드라지진 않지만, 타고난 그릇에 직장·자격의 바탕이 자리해 있어요. 실력을 다지며 흐름이 열리는 때를 준비하면 좋아요.'
        : '지금은 직장·자격의 기운이 잔잔한 편이에요. 조급해하기보다 방향을 정비하고 실력을 쌓아 두면 다음 흐름에서 문이 열려요.';

    // ④ 개운 티저 — 색/요일 중 딱 하나만 공개(방위는 잠금 → 유료와 중복 방지). 일간으로 결정론 선택.
    const gaeun = ELEM_GAEUN[INSEONG_EL[saju.dayMaster.element]];
    const teaser = ALL_STEMS.indexOf(saju.dayMaster.stem) % 2 === 1
      ? { label: '지원·면접에 힘을 주는 요일', value: gaeun.day }
      : { label: '합격·면접에 힘을 주는 색', value: gaeun.color };

    return { score, tone, tendency, gaugeCaption, signalLabel, signalBody, teaser };
  }, [saju]);

  const bright = d.tone === 'open';

  return (
    <>
      {/* ① 핵심 훅 — 취업 가능성 게이지(공용 애니 미터, accent 미전달 = 골드 기본) */}
      <PossibilityGauge score={d.score} label={d.tendency} tone={d.tone} title="취업 문이 열린 정도" caption={d.gaugeCaption} />

      {/* ② 지금 취업 운의 결 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>지금 취업 운의 결</Text>
        <Text style={[styles.signalLabel, bright && styles.signalLabelBright]}>{d.signalLabel}</Text>
        <Text style={styles.cardBody}>{d.signalBody}</Text>
      </View>

      {/* ③ 취업·합격 유리한 해 — 기존 연 단위 달력(그대로 품음) */}
      <JobTiming saju={saju} />

      {/* ④ 취업 개운 티저 + 잠긴 가치 명시(퍼널) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>취업 개운 미리보기</Text>
        <View style={styles.teaserRow}>
          <Text style={styles.teaserLabel}>{d.teaser.label}</Text>
          <Text style={styles.teaserValue}>{d.teaser.value}</Text>
        </View>
        <Text style={styles.lockNote}>🔒 좋은 방위 · 나머지 색·요일 · 지원·면접 실천법은 깊은 풀이에서</Text>
        <View style={styles.divider} />
        {/* 무료 vs 유료 잠긴 가치 명시(퍼널 훅 — 골드 CTA 바로 위) */}
        <Text style={styles.funnelLine}>무료로는 <Text style={styles.accent}>가능성·유리한 시기</Text>까지 볼 수 있어요.</Text>
        <Text style={styles.funnelLine}>깊은 풀이에선 <Text style={styles.accent}>합격 전략·맞는 직종·구체 개운법·이직 타이밍</Text>까지 짚어 드려요.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // 공통 카드(ReunionRich/JobTiming 과 동일 결 — sunk 배경·라운드·여백·하단 간격)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  cardTitle: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2.5), fontSize: 14 },
  cardBody: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1) },
  accent: { color: colors.ju, fontWeight: '800' },

  // ── 취업 운 신호 헤드라인(ReunionRich 의 gungLabel 과 동일 톤) ──
  signalLabel: { ...font.body, color: colors.inkSoft, fontWeight: '800', fontSize: 15, marginBottom: space(1.5) },
  signalLabelBright: { color: colors.ju },

  // ── 개운 티저 ──
  teaserRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: space(2) },
  teaserLabel: { ...font.caption, color: colors.inkFaint, fontSize: 12 },
  teaserValue: { color: colors.ju, fontSize: 16, fontWeight: '900', marginLeft: space(2) },
  lockNote: { ...font.caption, color: colors.inkFaint, fontSize: 11, lineHeight: 16 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space(3), opacity: 0.6 },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
});
