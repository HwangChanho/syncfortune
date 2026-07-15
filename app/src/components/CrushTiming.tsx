// app/src/components/CrushTiming.tsx — 짝사랑 인연운 '매력·인연이 도는 달' 무료 온디바이스 티저
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스 인코딩(발명 아님 — 결정론 룰, API 0). ReunionTiming.tsx와 완전히 같은 결:
//   짝사랑/썸이 무르익는 달 = 도화(桃花 = 왕지 子午卯酉)가 '발동'하는 달. 원국 지지에 깔린
//   도화를 그해 월운(流月)이 ①스스로 도화이거나 ②충(子↔午·卯↔酉)하거나 ③합(육합·삼합)하면
//   그 달에 매력·끌림이 무르익어 마음이 통하기 좋다(daniel 07-05: 충에 더해 합도 인연 맺힘으로 추가).
//   → 올해 12 월운 중 '매력·인연이 도는 달'을 콕 집어 무료로 보여준다.
//
// ▶ 무료 훅(funnel): 여기서 '언제(어느 달)'를 무료로 보여주고, 깊은 통변(내 매력·나에게 끌릴
//   사람의 결·다가가는 법·조심할 점)은 아래 유료(SpecialContentScreen kind=crush)로 유도한다.
//
// ▶ 결정론(NO random): Edge buildCrushPrompt의 '올해 매력·인연이 도드라지는 달' 산출(section 5)을
//   그대로 온디바이스로 미러링 — 같은 월운 소스(saju.annual.months → 없으면 현재 대운 annuals[올해].months)
//   + 같은 합충/삼합 테이블이라 Edge와 결과 동일. ★한자·용어는 화면 텍스트에 노출 금지(전부 일상어).
// ▶ 산출 로직(도화 탐지·합충 판정·월건 계산)은 app/src/lib/content/timingSignals.ts 의 crushTiming()으로 이관(단일 출처) — 이 파일은 렌더만 담당.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { crushTiming } from '../lib/content/timingSignals';

/**
 * 짝사랑 인연운 '매력·인연이 도는 달' 무료 티저.
 * @param saju 본인 사주(원국). 결정론 산출값. (timeUnknown은 SpecialContentScreen이 관례대로 병합해 넘김 → 시각 미상 시 시주 제외.)
 */
export function CrushTiming({ saju }: { saju: SajuChart }) {
  // 산출(원국 도화 탐지 + 올해 매력·인연이 도는 달)은 lib/content/timingSignals.ts 로 이관 — 여기선 결과만 소비.
  const { year: annualYear, months: list, hasNatalDohwa } = crushTiming(saju);

  // 매력이 도는 달이 하나도 없으면(월운 자료 없음 or 결정론상 무발동) 큰 흐름(유료)으로 안내.
  if (!list.length) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>매력·인연이 도는 달 <Text style={styles.titleSub}>(끌림 흐름)</Text></Text>
        <Text style={styles.empty}>올해는 특정 달을 콕 집는 끌림의 기운이 도드라지진 않아요. 인연이 무르익는 시기는 더 큰 흐름으로 봐야 해서, 아래에서 자세히 풀어 드려요.</Text>
      </View>
    );
  }

  // 원국 도화 유무에 따라 리드 문구를 자연스럽게 분기(한자/용어 노출 금지 — 일상어).
  const lead = hasNatalDohwa
    ? '당신 안엔 사람을 끄는 타고난 끌림의 기운이 있어요. 그 기운이 깨어나는 달에 끌림·썸이 무르익어요.'
    : '타고난 끌림의 기운이 특정 달에 드나들어요. 그 기운이 드는 달에 끌림·썸이 무르익기 좋아요.';

  return (
    <View style={styles.box}>
      <Text style={styles.title}>매력·인연이 도는 달 <Text style={styles.titleSub}>(끌림 흐름)</Text></Text>
      {/* 진입 시 올해 년도를 먼저 노출(달 강조 이전) — subtle 캡션 */}
      {annualYear != null && <Text style={styles.yearBadge}>올해 {annualYear}년 기준</Text>}
      <Text style={styles.lead}>{lead}</Text>
      {/* 12개월 달력 — 매력·인연이 도는 달을 금색으로 강조(ReunionTiming과 동일 격자) */}
      <View style={styles.grid}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const on = list.includes(m);
          return (
            <View key={m} style={[styles.cell, on && styles.cellOn]}>
              <Text style={[styles.cellTx, on && styles.cellTxOn]}>{m}월</Text>
            </View>
          );
        })}
      </View>
      {/* 요약 = 올해 년도 + 도는 달들(daniel 07-05: 월 앞에 올해 년도 prefix) */}
      <Text style={styles.summary}>{annualYear != null ? `${annualYear}년 · ` : ''}{list.map((m) => `${m}월`).join(' · ')} — 끌림·썸이 무르익기 좋은 달</Text>
      <Text style={styles.note}>※ 이 달들에 마음을 표현하면 통하기 좋아요. 특히 그달의 흐름이 당신의 끌림을 깨우는 시기예요.</Text>
    </View>
  );
}

// ReunionTiming과 동일한 미드나잇-골드 스타일(공통 톤 유지).
const styles = StyleSheet.create({
  box: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  title: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2), fontSize: 14 },
  titleSub: { ...font.caption, color: colors.inkFaint, fontWeight: '600' },
  // 올해 년도 캡션 — 제목 바로 아래 subtle(ReunionTiming과 동일 톤)
  yearBadge: { ...font.caption, color: colors.inkFaint, fontWeight: '700', letterSpacing: 0.3, marginTop: -space(1), marginBottom: space(2.5) },
  lead: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(3) },
  // 12개월 격자 — 한 줄 6칸씩 자연스럽게 감김
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), justifyContent: 'center' },
  cell: { width: 44, paddingVertical: space(2), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  cellOn: { backgroundColor: colors.ju, borderColor: colors.ju },      // 매력 달 = 금색 강조
  cellTx: { ...font.caption, color: colors.inkFaint, fontSize: 12 },
  cellTxOn: { color: colors.bg, fontWeight: '900' },
  summary: { ...font.body, color: colors.ju, fontWeight: '800', textAlign: 'center', marginTop: space(3), fontSize: 14 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(2), textAlign: 'center', fontSize: 11, lineHeight: 16 },
  empty: { ...font.caption, color: colors.inkSoft, lineHeight: 19 },
});
