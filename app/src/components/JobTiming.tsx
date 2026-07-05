// app/src/components/JobTiming.tsx — 취업·이직운 '취업·합격운이 열리는 시기' 무료 온디바이스 티저
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스 인코딩(발명 아님 — 결정론 룰, API 0). ReunionTiming.tsx와 같은 결·같은 톤:
//   취업·합격이 유리한 시기 = 운(세운·대운)의 천간에 '관성(정관·편관)' 또는 '인성(정인·편인)'이 드는 때.
//     · 관성 = 일·자리(직장·취업·승진·합격)의 기운
//     · 인성 = 자격·문서·시험·합격의 기운
//   그런 세운(해)이 오면 취업·이직·합격의 문이 열린다(응기). buildJobPrompt의 '유리한 해'(section 4·5) 미러링.
//
// ▶ 무료 훅(funnel): 여기서 '언제(어느 해)'를 무료로 보여주고, 깊은 통변(맞는 직종·환경·준비법·
//   합격운·조심할 점)은 아래 유료(SpecialContentScreen kind=job)로 유도한다.
//
// ▶ 결정론(NO random)·연 단위: 원국 지지가 아니라 운의 '천간 십신'만 보므로 시각 미상과 무관하다.
//   월 단위 십신도 온디바이스에 있지만, 취업은 연 단위 세운이 더 깨끗·신뢰도↑라 buildJobPrompt처럼 연 단위로 간다.
//   소스 = 모든 대운(luckCycles)의 세운(annuals) 천간 십신(엔진이 12대운 전부 채움) → curYear 이후 유리한 해 산출.
//   ★한자·용어(관성·인성·정관…)는 화면 텍스트에 노출 금지(전부 일상어).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart, TenGod } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';

// 관성(정관·편관) = 일·자리(직장·취업·합격)의 기운 / 인성(정인·편인) = 자격·문서·시험·합격의 기운. (표준 통설)
const GWAN: TenGod[] = ['정관', '편관'];
const INSEONG: TenGod[] = ['정인', '편인'];
const isGwan = (t?: TenGod): boolean => !!t && GWAN.includes(t);
const isIn = (t?: TenGod): boolean => !!t && INSEONG.includes(t);
const isGwanIn = (t?: TenGod): boolean => isGwan(t) || isIn(t);

// 유리한 해의 결(관성/인성)에 따른 일상어 설명(용어·한자 노출 금지).
type JobKind = 'job' | 'cert';
const kindDesc: Record<JobKind, string> = {
  job: '일자리가 열리는 기운이 드는 해',        // 관성
  cert: '자격·시험·합격의 기운이 드는 해',       // 인성
};

/**
 * 취업·이직운 '취업·합격운이 열리는 시기' 무료 티저.
 * @param saju 본인 사주(원국·대운·세운). 결정론 산출값. (연 단위라 timeUnknown과 무관하지만 관례상 병합돼 옴.)
 */
export function JobTiming({ saju }: { saju: SajuChart }) {
  const annual: any = (saju as any).annual;
  const curYear: number | undefined = annual?.year;            // 기준 '올해'(현재 세운 연도)
  const HORIZON = 15;                                          // 너무 먼 미래(노년)까지 보여주지 않도록 근미래로 제한

  // 1) 모든 대운의 세운 중 '천간에 관성/인성이 드는 해' = 취업·합격 유리 해(연 단위 timing).
  //    엔진(engine/saju.ts)이 12대운 각각의 annuals(세운)를 채우므로 연 단위 forward 스캔이 안정적이다.
  const yearMap = new Map<number, JobKind>();                  // 연도 → 결(중복 연도는 첫 판정 유지)
  for (const lc of ((saju as any).luckCycles ?? [])) {
    for (const a of (lc.annuals ?? [])) {
      const yr: number | undefined = a?.year;
      if (yr == null) continue;
      // 기준 연도(올해)를 모르면 근미래를 특정할 수 없으니 목록을 비워 폴백(엉뚱한 과거 연도 방지).
      if (curYear == null || yr < curYear || yr > curYear + HORIZON) continue; // 올해~근미래만
      if (!isGwanIn(a.stemTenGod)) continue;
      if (!yearMap.has(yr)) yearMap.set(yr, isGwan(a.stemTenGod) ? 'job' : 'cert');
    }
  }
  const years = [...yearMap.entries()]
    .sort((x, y) => x[0] - y[0])
    .slice(0, 4)                                               // 가까운 유리한 해 최대 4개(콕 집어)
    .map(([year, kind]) => ({ year, kind }));

  // 2) 특정 해가 안 잡히면 — 지금 '10년 흐름(대운)' 자체가 관성/인성인지로 보조 안내(전향적).
  const curLuck: any = (saju as any).currentLuck;
  const luckIsGwanIn = isGwanIn(curLuck?.stemTenGod);

  // 유리한 해가 하나도 없으면: (a) 지금 대운이 유리하면 그 흐름을, (b) 아니면 큰 흐름(유료)으로 안내.
  if (!years.length) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>취업·합격운이 열리는 시기 <Text style={styles.titleSub}>(일·자격 흐름)</Text></Text>
        <Text style={styles.empty}>
          {luckIsGwanIn
            ? '가까운 특정 해를 콕 집기보다, 지금 지나는 10년 흐름 자체가 일·자격의 기운이 받쳐 주는 구간이에요. 그 안에서 언제·어떻게 움직이면 좋은지는 아래에서 자세히 풀어 드려요.'
            : '가까운 몇 해 안에 특정 해를 콕 집는 취업·합격의 기운은 도드라지진 않아요. 취업·이직 흐름은 더 큰 10년 흐름으로 봐야 해서, 아래에서 자세히 풀어 드려요.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>취업·합격운이 열리는 시기 <Text style={styles.titleSub}>(일·자격 흐름)</Text></Text>
      {/* 진입 시 기준 '올해 년도'를 먼저 노출(연 단위라 이 목록의 base가 올해임을 명시) — subtle 캡션 */}
      {curYear != null && <Text style={styles.yearBadge}>올해 {curYear}년 기준</Text>}
      {/* 관성=일자리 / 인성=자격·문서·합격 — 용어 없이 일상어로 요약. 올해부터 가까운 해를 봄(base 명시). */}
      <Text style={styles.lead}>올해부터 가까운 해 가운데, 일자리가 열리는 기운과 자격·시험·합격을 뒷받침하는 기운이 드는 해예요. 그런 시기에 문이 열리기 좋아요.</Text>
      {/* 유리한 해 목록 — 각 해를 금색으로 강조하고, 그해가 '일자리'인지 '자격·합격'인지 일상어로 */}
      <View style={styles.yearList}>
        {years.map(({ year, kind }) => (
          <View key={year} style={styles.yearRow}>
            <Text style={styles.yearNum}>{year}년</Text>
            <Text style={styles.yearDesc}>{kindDesc[kind]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.summary}>{years.map((y) => `${y.year}년`).join(' · ')} — 취업·합격의 문이 열리기 좋은 해</Text>
      <Text style={styles.note}>※ 이 시기에 원서·면접·이직을 준비하면 유리해요. 미리 자격·서류를 갖춰 두면 흐름을 타기 좋아요.</Text>
    </View>
  );
}

// ReunionTiming과 동일한 미드나잇-골드 톤(연 단위라 12격자 대신 '해' 목록 행으로 렌더).
const styles = StyleSheet.create({
  box: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  title: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2), fontSize: 14 },
  titleSub: { ...font.caption, color: colors.inkFaint, fontWeight: '600' },
  // 올해(기준) 년도 캡션 — 제목 바로 아래 subtle(ReunionTiming/CrushTiming과 동일 톤)
  yearBadge: { ...font.caption, color: colors.inkFaint, fontWeight: '700', letterSpacing: 0.3, marginTop: -space(1), marginBottom: space(2.5) },
  lead: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(3) },
  // 유리한 해 목록 — 세로 행(금색 강조 연도 + 일상어 설명)
  yearList: { gap: space(2) },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: space(2.5), paddingHorizontal: space(3) },
  yearNum: { ...font.body, color: colors.ju, fontWeight: '900', fontSize: 15, minWidth: 58 },  // 해 = 금색 강조
  yearDesc: { ...font.caption, color: colors.inkSoft, fontSize: 12, flexShrink: 1 },
  summary: { ...font.body, color: colors.ju, fontWeight: '800', textAlign: 'center', marginTop: space(3), fontSize: 14 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(2), textAlign: 'center', fontSize: 11, lineHeight: 16 },
  empty: { ...font.caption, color: colors.inkSoft, lineHeight: 19 },
});
