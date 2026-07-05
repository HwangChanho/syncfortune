// app/src/components/ReunionTiming.tsx — 재회 타이밍(도화-충) 무료 온디바이스 티저
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스 인코딩(발명 아님 — 결정론 룰, API 0). LoveFlowGraph.tsx와 같은 결:
//   재회 연락 좋은 시기 = 도화(桃花 = 왕지 子午卯酉) '충(沖)' 시점. 원국 지지에 깔린 도화를
//   운(특히 월운)이 충하면(子↔午, 卯↔酉) 그 달에 옛 인연에게 연락이 닿을 확률↑.
//   → 올해 12 월운 중 '월지가 원국 도화를 충하는 달' = 재회 연락이 열리는 달(콕 집어 보여줌).
//
// ▶ 무료 훅(funnel): 여기서 '언제(어느 달)'를 무료로 보여주고, 깊은 통변(가능성·상대 마음·
//   재회 후 흐름·개운법)은 아래 유료(SpecialContentScreen kind=reunion)로 유도한다.
//
// ▶ 결정론: 각 원국 도화의 충 짝(역시 왕지)이 위치한 월건(節氣 월)을 월건표로 산출 —
//   월운 지지는 해마다 같은 절기 위치라 그 달들이 매년 결정론적으로 열린다(Edge buildReunionPrompt와 동일 결과).
//   ★한자·용어는 화면 텍스트에 노출 금지(일상어). 표준 합충 테이블은 표준 통설(engine과 동일 값·로컬 정의).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart, Branch, PillarPos } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';

// 도화 = 왕지(표준 통설) — 子午卯酉. 4지지에 깔린 것이 원국 도화.
const DOHWA: Branch[] = ['子', '午', '卯', '酉'];
// 6충(七冲) — 표준 통설. 재회에선 도화 쌍(子↔午, 卯↔酉)만 실질 사용.
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
// 지지 → 월건(節氣) 월 번호: 寅월=1월 … 丑월=12월. daniel 예 午→5월·酉→8월과 일치.
const BRANCH_MONTH: Record<Branch, number> = { 寅: 1, 卯: 2, 辰: 3, 巳: 4, 午: 5, 未: 6, 申: 7, 酉: 8, 戌: 9, 亥: 10, 子: 11, 丑: 12 };
// 이 지지가 충하는 짝(없으면 null)
const chongPartner = (b: Branch): Branch | null => {
  const p = CHONG.find(([x, y]) => x === b || y === b);
  return p ? (p[0] === b ? p[1] : p[0]) : null;
};

/**
 * 재회 타이밍(도화-충) 무료 티저.
 * @param saju 본인 사주(원국). 결정론 산출값. (timeUnknown은 SpecialContentScreen이 관례대로 병합해 넘김 → 시각 미상 시 시주 제외.)
 */
export function ReunionTiming({ saju }: { saju: SajuChart }) {
  // 시각 미상이면 시주(時支)를 도화 탐지에서 제외(잘못된 timing 방지) — 관례상 saju에 병합돼 옴.
  const timeUnknown = (saju as any)?.timeUnknown === true;
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];

  // 올해(현재 세운) 연도 — 엔진 산출값(computeChart가 '오늘' 기준이라 해가 바뀌면 자동 갱신).
  //   daniel 07-05: 진입 시 '월'뿐 아니라 '올해 년도'도 보여야 함(무료 = 올해꺼만).
  //   annual.year가 없으면(엔진 미채움) 연도 표기를 생략(크래시 방지) — 잘못된 연도 발명 금지.
  const annualYear: number | undefined = (saju as any)?.annual?.year;

  // 1) 원국 도화 탐지 — 4지지(시각 미상=시주 제외) 중 왕지.
  const natalBranches = posList
    .map((p) => saju.pillars?.[p]?.branch)
    .filter(Boolean) as Branch[];
  const natalDohwa = DOHWA.filter((d) => natalBranches.includes(d));

  // 2) 재회 연락이 열리는 달 — 각 원국 도화의 충 짝 월지 → 월건 번호(그 달에 도화 발동).
  const monthSet = new Set<number>();
  natalDohwa.forEach((d) => { const p = chongPartner(d); if (p) monthSet.add(BRANCH_MONTH[p]); });
  const months = [...monthSet].sort((a, b) => a - b);

  // 도화가 없으면 월 단위 콕이 약함 → 배우자 자리가 열리는 해·큰 흐름(유료)으로 안내.
  if (!natalDohwa.length || !months.length) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>재회가 열리는 달 <Text style={styles.titleSub}>(도화 흐름)</Text></Text>
        <Text style={styles.empty}>당신 사주엔 특정 달을 콕 집는 끌림의 기운이 도드라지진 않아요. 재회 시기는 인연이 다시 열리는 해·큰 흐름으로 봐야 해서, 아래에서 자세히 풀어 드려요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>재회가 열리는 달 <Text style={styles.titleSub}>(도화 흐름)</Text></Text>
      {/* 진입 시 올해 년도를 먼저 노출(달 강조 이전) — 미드나잇-골드 캡션(subtle) */}
      {annualYear != null && <Text style={styles.yearBadge}>올해 {annualYear}년 기준</Text>}
      {/* 원국 도화 = 끌림의 기운(한자/용어 노출 금지 — 일상어) */}
      <Text style={styles.lead}>당신 안엔 사람을 끄는 끌림의 기운이 있어요. 그 기운이 깨어나는 달에 옛 인연과 다시 이어질 문이 열려요.</Text>
      {/* 12개월 달력 — 재회 연락이 열리는 달을 금색으로 강조 */}
      <View style={styles.grid}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const on = months.includes(m);
          return (
            <View key={m} style={[styles.cell, on && styles.cellOn]}>
              <Text style={[styles.cellTx, on && styles.cellTxOn]}>{m}월</Text>
            </View>
          );
        })}
      </View>
      {/* 요약 = 올해 년도 + 열리는 달들(daniel 07-05: 월 앞에 올해 년도 prefix) */}
      <Text style={styles.summary}>{annualYear != null ? `${annualYear}년 · ` : ''}{months.map((m) => `${m}월`).join(' · ')} — 옛 인연에게 연락이 닿기 좋은 달</Text>
      <Text style={styles.note}>※ 이 달들에 마음을 전하면 닿을 확률이 높아요. 특히 그달의 흐름이 당신의 끌림을 깨우는 시기예요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  title: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2), fontSize: 14 },
  titleSub: { ...font.caption, color: colors.inkFaint, fontWeight: '600' },
  // 올해 년도 캡션 — 제목 바로 아래 subtle하게(금색 아닌 inkFaint), 제목과 살짝 붙임
  yearBadge: { ...font.caption, color: colors.inkFaint, fontWeight: '700', letterSpacing: 0.3, marginTop: -space(1), marginBottom: space(2.5) },
  lead: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(3) },
  // 12개월 격자 — 한 줄 6칸씩 자연스럽게 감김
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), justifyContent: 'center' },
  cell: { width: 44, paddingVertical: space(2), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  cellOn: { backgroundColor: colors.ju, borderColor: colors.ju },      // 재회 달 = 금색 강조
  cellTx: { ...font.caption, color: colors.inkFaint, fontSize: 12 },
  cellTxOn: { color: colors.bg, fontWeight: '900' },
  summary: { ...font.body, color: colors.ju, fontWeight: '800', textAlign: 'center', marginTop: space(3), fontSize: 14 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(2), textAlign: 'center', fontSize: 11, lineHeight: 16 },
  empty: { ...font.caption, color: colors.inkSoft, lineHeight: 19 },
});
