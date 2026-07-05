// app/src/components/ReunionRich.tsx — 재회(무료) 리치 콘텐츠 셸 (결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 모델: "무료를 결정론+비주얼로 풍부하게 → 유료 자연 구매". FreeFunnel 의 render 로 주입되는
//   재회 전용 무료 본문. supabase/Edge 절대 호출 안 함 — computeChart 산출 saju 만으로 전부 계산.
//   기존 ReunionTiming(12개월 달력)을 그대로 품고, 그 위에 아래 결정론 요소를 얹어 '언제·가능성·방향'을
//   시각적으로 보여주고 → 골드 CTA(유료 깊은 풀이)로 자연 유도한다.
//
// ▶ 담는 무료 요소(전부 결정론, 한자·용어는 화면 텍스트에 노출 금지 = 일상어):
//   ① 재회 인연 게이지(0~100) — 원국 도화 + 현재 운의 도화 발동 + 배우자궁 개폐 + 재/관 인연星 발동 합산.
//      ★점수 산출 = lib/love/inyeonGauge(재회·애정 공통 엔진) / 미터 UI = PossibilityGauge(공용 컴포넌트).
//   ② 배우자궁 개폐 상태 — 일지 vs 현재 운(세운·대운): 열리는/맺히는/부딪히는/잠잠한 '결'(일상어).
//   ③ 인연 기운 방향·계절 — 원국 도화 왕지 → 방위·계절(子북겨울/午남여름/卯동봄/酉서가을).
//   ④ 연락 개운 미리보기(티저) — 좋은 색·요일 중 딱 하나만 무료 공개, 나머지·구체 실천은 🔒(유료).
//
// ▶ 결정론 근거: lib/love/inyeonGauge(표준 합충/형/도화 + 엔진 tenGod·HIDDEN 재사용). 발명 아님 — 룰 산출만.
//   ★게이지 신호·가중치는 lib/love/inyeonGauge 의 W 블록(daniel 검수/튜닝 슬롯)에 모아 두었다.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart, Branch, Stem, Element, PillarPos } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { ReunionTiming } from './ReunionTiming';                       // 기존 12개월 '연락이 열리는 달' 달력(그대로 품음)
import { PossibilityGauge } from './PossibilityGauge';                 // 공용 가능성 게이지(추출 — 재회·애정 공유)
import { computeInyeonSignals, DOHWA } from '../lib/love/inyeonGauge'; // 인연 게이지 결정론 신호(재회·애정 공통 엔진)

// ── 재회 표시 전용 테이블(문구 매핑용 — 점수 산출 테이블은 lib/love/inyeonGauge 로 이관). ★daniel 검수 ──
const ALL_STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];    // 개운 티저 짝/홀 선택용
// 도화 왕지 → 방위·계절(일상어). 인연 기운이 무르익는 방향·철.
const DOHWA_DIR: Record<'子' | '午' | '卯' | '酉', { dir: string; season: string }> = {
  子: { dir: '북쪽', season: '겨울' }, 午: { dir: '남쪽', season: '여름' },
  卯: { dir: '동쪽', season: '봄' }, 酉: { dir: '서쪽', season: '가을' },
};
// 오행 → 연락 개운(방위·색·요일, 일상어). 배우자성(인연星) 오행 기준.
const ELEM_GAEUN: Record<Element, { dir: string; color: string; day: string }> = {
  木: { dir: '동쪽', color: '맑은 청록빛', day: '목요일' },
  火: { dir: '남쪽', color: '따뜻한 붉은빛', day: '화요일' },
  土: { dir: '가까운 곳', color: '포근한 노란·베이지빛', day: '토요일' },
  金: { dir: '서쪽', color: '맑은 흰·은빛', day: '금요일' },
  水: { dir: '북쪽', color: '깊은 남색빛', day: '수요일' },
};

/**
 * 재회 무료 리치 본문. FreeFunnel 의 render 로 주입(대표 명식 saju).
 * @param saju 대표 명식의 사주(결정론 산출 + timeUnknown/sex 병합됨 — FreeFunnel 참고).
 */
export function ReunionRich({ saju }: { saju: SajuChart }) {
  // 모든 결정론 값은 saju 변경 시에만 1회 산출(성능·단일 소스). 게이지 카운트업 리렌더와 분리.
  const d = useMemo(() => {
    // ① 인연 게이지 신호(재회·애정 공통 엔진) — sex/timeUnknown 은 saju 병합값을 읽음(opts 미전달 = 기존 동작).
    const sig = computeInyeonSignals(saju);
    const { score, tone, natalDohwa, gungOpen, gungBond, gungFriction, inyeonEl, dm } = sig;

    // 경향 라벨/문구(§4 경향·단정 금지 + 처방 동반 + 전향적). tone 경계 = 기존 score 66/34 와 동일.
    const tendency = tone === 'open' ? '열려 있어요' : tone === 'warming' ? '서서히 열려요' : '지금은 조용해요';
    const gaugeCaption = tone === 'open'
      ? '옛 인연과 다시 이어질 문이 열려 있는 흐름이에요. 마음이 있다면 지금 진심을 전해 보세요.'
      : tone === 'warming'
        ? '문이 조금씩 열리는 중이에요. 서두르기보다 결이 무르익는 시기를 노려 보세요.'
        : '지금은 문이 잠잠한 편이에요. 무리한 연락보다 나를 가꾸며 때를 기다리는 게 좋아요.';

    // ② 배우자궁 개폐 '결' 문구(일상어)
    const gungLabel = gungOpen ? '지금 열리는 결이에요'
      : gungBond ? '지금 맺히는 결이에요'
        : gungFriction ? '지금 살짝 부딪히며 움직이는 결이에요'
          : '지금은 잠잠한 결이에요';
    const gungSub = gungOpen ? '인연의 자리가 열리는 시기예요. 다시 마주할 계기가 생기기 쉬워요.'
      : gungBond ? '인연의 자리가 이어지려는 결이에요. 관계를 다시 매듭짓기 좋은 때예요.'
        : gungFriction ? '자리가 흔들리며 움직여요. 감정보다 차분함으로 다가가면 결이 부드러워져요.'
          : '자리가 아직 고요해요. 억지로 열기보다 나를 채우며 다음 흐름을 기다려요.';

    // ③ 인연 기운 방향·계절(원국 도화 있을 때만)
    const dirSeason = natalDohwa.length ? (() => {
      const priority: PillarPos[] = ['일', '월', '년', '시'];  // 배우자궁(일)에 가까운 자리 우선
      const primary = priority.map((p) => saju.pillars?.[p]?.branch).find((b) => b && DOHWA.includes(b as Branch)) as Branch | undefined;
      const seasons = [...new Set(natalDohwa.map((x) => DOHWA_DIR[x as '子' | '午' | '卯' | '酉'].season))];
      const dir = DOHWA_DIR[(primary ?? natalDohwa[0]) as '子' | '午' | '卯' | '酉'].dir;
      return { seasons, dir };
    })() : null;

    // ④ 개운 티저 — 색/요일 중 딱 하나만 공개(방위는 잠금 → §3 방향과 중복 방지). 일간으로 결정론 선택.
    const gaeun = ELEM_GAEUN[inyeonEl];
    const teaser = ALL_STEMS.indexOf(dm) % 2 === 1
      ? { label: '인연이 열리는 요일', value: gaeun.day }
      : { label: '인연을 부르는 색', value: gaeun.color };

    return { score, tone, tendency, gaugeCaption, gungLabel, gungSub, dirSeason, teaser };
  }, [saju]);

  const bright = d.tone === 'open';

  return (
    <>
      {/* ① 핵심 훅 — 재회 인연 게이지(공용 애니 미터, accent 미전달 = 골드 기본) */}
      <PossibilityGauge score={d.score} label={d.tendency} tone={d.tone} title="재회의 문이 열린 정도" caption={d.gaugeCaption} />

      {/* ② 배우자궁 개폐 상태 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>인연의 자리</Text>
        <Text style={[styles.gungLabel, bright && styles.gungLabelBright]}>{d.gungLabel}</Text>
        <Text style={styles.cardBody}>{d.gungSub}</Text>
      </View>

      {/* ③ 인연 기운 방향·계절(도화 있을 때만) */}
      {d.dirSeason && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>인연 기운의 방향·계절</Text>
          <Text style={styles.cardBody}>
            당신의 인연 기운은 <Text style={styles.accent}>{d.dirSeason.seasons.join('·')}</Text>에 무르익고, <Text style={styles.accent}>{d.dirSeason.dir}</Text> 방향의 기운과 잘 통해요.
          </Text>
        </View>
      )}

      {/* ④ 재회가 열리는 달 — 기존 12개월 달력(그대로 품음) */}
      <ReunionTiming saju={saju} />

      {/* ⑤ 연락 개운 미리보기(티저) + 잠긴 가치 명시(퍼널) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>연락 개운 미리보기</Text>
        <View style={styles.teaserRow}>
          <Text style={styles.teaserLabel}>{d.teaser.label}</Text>
          <Text style={styles.teaserValue}>{d.teaser.value}</Text>
        </View>
        <Text style={styles.lockNote}>🔒 좋은 방위 · 나머지 색·요일 · 구체 실천법은 깊은 풀이에서</Text>
        <View style={styles.divider} />
        {/* 무료 vs 유료 잠긴 가치 명시(퍼널 훅 — 골드 CTA 바로 위) */}
        <Text style={styles.funnelLine}>무료로는 <Text style={styles.accent}>가능성·시기·방향</Text>까지 볼 수 있어요.</Text>
        <Text style={styles.funnelLine}>깊은 풀이에선 <Text style={styles.accent}>상대의 마음·구체 개운법·다시 이어질 이유</Text>까지 짚어 드려요.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // 공통 카드(ReunionTiming/LoveFlowGraph 와 동일 결 — sunk 배경·라운드·여백·하단 간격)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  cardTitle: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2.5), fontSize: 14 },
  cardBody: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1) },
  accent: { color: colors.ju, fontWeight: '800' },

  // ── 배우자궁 개폐 ──
  gungLabel: { ...font.body, color: colors.inkSoft, fontWeight: '800', fontSize: 15, marginBottom: space(1.5) },
  gungLabelBright: { color: colors.ju },

  // ── 개운 티저 ──
  teaserRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: space(2) },
  teaserLabel: { ...font.caption, color: colors.inkFaint, fontSize: 12 },
  teaserValue: { color: colors.ju, fontSize: 16, fontWeight: '900', marginLeft: space(2) },
  lockNote: { ...font.caption, color: colors.inkFaint, fontSize: 11, lineHeight: 16 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space(3), opacity: 0.6 },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
});
