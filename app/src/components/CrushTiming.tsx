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
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart, Branch, PillarPos } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';

// ── 표준 통설 합충 테이블(engine·buildCrushPrompt와 동일 값·로컬 정의) ──────────────────────
// 도화 = 왕지(표준 통설) — 子午卯酉. 4지지에 깔린 것이 원국 도화(끌림·매력의 기운).
const DOHWA: Branch[] = ['子', '午', '卯', '酉'];
// 6충(七冲) — 표준 통설. 도화 발동에선 도화 쌍(子↔午, 卯↔酉)이 실질 사용된다.
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
// 육합(六合) — 표준 통설. 도화의 합 짝: 子-丑·午-未·卯-戌·酉-辰 (daniel 07-05: 합=인연 맺힘 추가).
const SIXHE: [Branch, Branch][] = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
// 삼합 3국 — 표준 통설. 같은 국에 뭉치면 같은 기운으로 결속(인연 뭉침).
const SANHE: Branch[][] = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
// 지지 → 월건(節氣) 월 번호: 寅월=1월 … 丑월=12월. daniel 예 午→5월·酉→8월과 일치.
const BRANCH_MONTH: Record<Branch, number> = { 寅: 1, 卯: 2, 辰: 3, 巳: 4, 午: 5, 未: 6, 申: 7, 酉: 8, 戌: 9, 亥: 10, 子: 11, 丑: 12 };

// 이 지지가 충하는 짝(없으면 null)
const chongPartner = (b: Branch): Branch | null => {
  const p = CHONG.find(([x, y]) => x === b || y === b);
  return p ? (p[0] === b ? p[1] : p[0]) : null;
};
// 이 지지의 육합 짝(없으면 null)
const hapPartner = (b: Branch): Branch | null => {
  const p = SIXHE.find(([x, y]) => x === b || y === b);
  return p ? (p[0] === b ? p[1] : p[0]) : null;
};
// 서로 다른 두 지지가 같은 삼합국에 속하는가(=같은 기운으로 뭉침)
const sameSanhe = (a: Branch, b: Branch): boolean => a !== b && SANHE.some((g) => g.includes(a) && g.includes(b));

/**
 * 올해(현재 세운) 12 월운(流月) 배열을 안전 탐색해 반환.
 *   월운은 top-level saju.annual엔 없을 수 있어(엔진), 현재 대운의 annuals[올해].months에 들어있다.
 *   → buildCrushPrompt.currentYearMonths / ReunionTiming과 동일 소스·동일 폴백.
 * @param saju 본인 사주(원국). @returns MonthPillar 유사 배열([]이면 월운 자료 없음)
 */
function currentYearMonths(saju: SajuChart): { stem?: string; branch?: Branch }[] {
  const annual: any = (saju as any).annual;
  if (Array.isArray(annual?.months) && annual.months.length) return annual.months;
  const curYear: number | undefined = annual?.year;
  for (const lc of ((saju as any).luckCycles ?? [])) {
    const a = (lc.annuals ?? []).find((x: any) => x.year === curYear);
    if (a?.months?.length) return a.months;
  }
  return [];
}

/**
 * 짝사랑 인연운 '매력·인연이 도는 달' 무료 티저.
 * @param saju 본인 사주(원국). 결정론 산출값. (timeUnknown은 SpecialContentScreen이 관례대로 병합해 넘김 → 시각 미상 시 시주 제외.)
 */
export function CrushTiming({ saju }: { saju: SajuChart }) {
  // 시각 미상이면 시주(時支)를 도화 탐지에서 제외(잘못된 timing 방지) — 관례상 saju에 병합돼 옴.
  const timeUnknown = (saju as any)?.timeUnknown === true;
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];

  // 올해(현재 세운) 연도 — currentYearMonths와 동일 소스(saju.annual.year). 엔진이 '오늘' 기준이라 자동 갱신.
  //   daniel 07-05: 진입 시 '월'뿐 아니라 '올해 년도'도 노출(무료 = 올해꺼만). 없으면 생략(크래시 방지).
  const annualYear: number | undefined = (saju as any)?.annual?.year;

  // 1) 원국 도화 탐지 — 4지지(시각 미상=시주 제외) 중 왕지 = 타고난 끌림의 기운.
  const natalBranches = posList
    .map((p) => saju.pillars?.[p]?.branch)
    .filter(Boolean) as Branch[];
  const natalDohwa = DOHWA.filter((d) => natalBranches.includes(d));

  // 2) 올해 매력·인연이 도는 달 — 월지가 ①스스로 도화 / ②원국 도화를 충 / ③원국 도화와 합(육합·삼합)하는 달.
  //    (buildCrushPrompt section 5와 동일 로직. 월 번호는 월건표로 결정론 매핑.)
  const months = currentYearMonths(saju);
  const monthSet = new Set<number>();
  months.forEach((m) => {
    const b = m.branch;
    if (!b) return;
    let hit = false;
    if (DOHWA.includes(b)) hit = true;                                   // ① 그달 자체가 매력의 기운
    const cp = chongPartner(b);
    if (cp && natalDohwa.includes(cp)) hit = true;                       // ② 원국 매력 글자를 흔들어 깨움(충)
    const hp = hapPartner(b);
    if (hp && natalDohwa.includes(hp)) hit = true;                       // ③-a 원국 매력 글자와 맺힘(육합)
    else if (natalDohwa.some((d) => sameSanhe(b, d))) hit = true;        // ③-b 원국 매력 글자와 뭉침(삼합)
    if (hit) monthSet.add(BRANCH_MONTH[b]);
  });
  const list = [...monthSet].sort((a, b) => a - b);

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
  const lead = natalDohwa.length
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
