// app/src/screens/SinsalScreen.tsx — 신살(神煞)·공망(空亡) 전용 상세 화면
// ─────────────────────────────────────────────────────────────────────────
// 명식 화면의 '자리별 표'(요약)와 분리된 *디테일* 화면(daniel "신살공망은 더 디테일하게 따로").
//   분류(길신/특수살/12신살/공망)별 카드 = 기준글자(오행색)·적중자리·의미 전문·키워드를 펼쳐 보여줌.
// ★ 보조 지표(CLAUDE.md §1-신살은 색채, 구조가 主). 길흉 단정 금지(R13·가드6) — 의미는 글로서리(검수본) 사용.
// ★ stance: 신살 *의미*는 myeongriGlossary(daniel 검수 대상). 이 화면은 표시·분류만 담당(단일 책임).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { computeChart } from '../lib/engine';
import type { ChartInput, PillarPos } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading } from '../lib/ohaeng';
import { SINSAL_GLOSSARY, GONGMANG_GLOSSARY } from '../lib/myeongriGlossary';

// 전통 표기 — 오른쪽이 년주: 시 ← 일 ← 월 ← 년
const POS: PillarPos[] = ['시', '일', '월', '년'];
const STEMS = new Set(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
const isStem = (g: string) => STEMS.has(g);

// ── 신살 분류(표시 관심사 — 엔진이 아닌 UI 레이어에 응집. 분류 변경 시 이 한 곳만 수정) ──
//   길신(吉神) = 도움·복록 / 특수살(特殊煞) = 강한 색채(전문성·매력 등 양면) / 12신살·공망은 별도 구조.
const GILSIN = ['천을귀인', '문창', '정록', '암록', '금여', '학당귀인', '월덕귀인', '천덕귀인', '황은대사', '천문성'];
const TEUKSU = ['현침살', '홍염', '양인', '괴강', '백호'];

// 신살 한 행의 표시용 데이터(엔진 SinsalHit + 글로서리 의미 결합)
type Row = {
  name: string;                                       // 글로서리 키(원래 신살명)
  glyphs: string[];                                   // 기준 글자(천간/지지)
  hits: { pos: PillarPos; side: 'stem' | 'branch' }[]; // 원국 적중 자리
  hit: boolean;                                       // 보이는 자리(visiblePos)에 적중했나
};

// side(천간/지지) → 한글 라벨
const sideKo = (s: 'stem' | 'branch') => (s === 'stem' ? '천간' : '지지');

/** 기준 글자 칩 — 오행색 배경 + 한자 + 한글음. 신살의 '근거 글자'를 시각화.
 *  괴강·백호처럼 간지 결합(2글자)은 단일 오행색이 없어 통짜 칩(중립)으로 표시. */
function GlyphChip({ g }: { g: string }) {
  if (g.length > 1) { // 간지 결합(괴강·백호) — 천간+지지 한 덩어리
    return <View style={styles.glyphChipWide}><Text style={styles.glyphTxWide}>{g}</Text></View>;
  }
  const el = isStem(g) ? stemElement(g) : branchElement(g);
  const ko = isStem(g) ? stemReading(g) : branchReading(g);
  return (
    <View style={[styles.glyphChip, { backgroundColor: elementColor[el] }]}>
      <Text style={[styles.glyphTx, { color: elementText[el] }]}>{g}</Text>
      {ko ? <Text style={[styles.glyphKo, { color: elementText[el] }]}>{ko}</Text> : null}
    </View>
  );
}

/** 신살 카드 — 명칭·기준글자·적중자리·의미·키워드를 한 장에 펼침(모달 탭 없이 바로 보이게 = '디테일'). */
function SinsalCard({ row }: { row: Row }) {
  const g = (SINSAL_GLOSSARY as Record<string, any>)[row.name];
  const ko: string = g?.ko ?? row.name;
  const hanja: string = g?.hanja ?? '';
  const meaning: string = g?.meaning ?? '';
  const keywords: string[] = g?.keywords ?? [];
  // 적중 자리 라벨(예: "일주·지지") — 보이는 자리만
  const hitLabels = row.hits.map((h) => `${h.pos}주·${sideKo(h.side)}`);
  return (
    <View style={[styles.card, row.hit ? styles.cardHit : styles.cardLuck]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardName}>
          {ko}
          {hanja ? <Text style={styles.cardHanja}> {hanja}</Text> : null}
        </Text>
        {/* 출처 배지 — 원국에 있으면 골드 ✓자리, 없으면 '運 운에서 들어옴' */}
        {row.hit ? (
          <Text style={styles.badgeHit}>✓ {hitLabels.join(', ')}</Text>
        ) : (
          <Text style={styles.badgeLuck}>運 운에서 들어옴</Text>
        )}
      </View>
      {/* 기준 글자(오행색) */}
      <View style={styles.glyphRow}>
        {row.glyphs.map((gl, i) => <GlyphChip key={i} g={gl} />)}
      </View>
      {meaning ? <Text style={styles.cardMeaning}>{meaning}</Text> : null}
      {keywords.length > 0 && (
        <View style={styles.kwRow}>
          {keywords.map((k, i) => <Text key={i} style={styles.kw}>{k}</Text>)}
        </View>
      )}
    </View>
  );
}

/** 신살 그룹 — 원국 적중과 '운에서 들어옴'을 서브헤더로 분리(daniel: 운에서 온 건 명확히 구분). */
function SinsalGroup({ rows }: { rows: Row[] }) {
  const hitRows = rows.filter((r) => r.hit);
  const luckRows = rows.filter((r) => !r.hit);
  return (
    <>
      {hitRows.map((r) => <SinsalCard key={r.name} row={r} />)}
      {luckRows.length > 0 && (
        <Text style={styles.luckSubHead}>運 운에서 들어옴 — 원국에 없음 (대운·세운에서 작동)</Text>
      )}
      {luckRows.map((r) => <SinsalCard key={r.name} row={r} />)}
    </>
  );
}

export function SinsalScreen({ input }: { input: ChartInput | null }) {
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);
  if (!c) return <View style={styles.center}><Text style={font.body}>명식 정보가 없습니다.</Text></View>;

  const timeUnknown = input?.timeAccuracy === '미상';                 // 시각 모름 → 시주 마스킹
  const P = c.saju.pillars;
  const visiblePos = POS.filter((p) => !(p === '시' && timeUnknown)); // 시각 미상 시 시주 제외
  const inView = (p: PillarPos) => (visiblePos as string[]).includes(p);

  // ── 길신·특수살 행 빌드(엔진 sinsal + 괴강/백호 합류) ──
  const baseRows: Row[] = c.sinsal.sinsal.map((s) => ({
    name: s.name,
    glyphs: s.glyphs,
    hits: s.hits.filter((h) => inView(h.pos)),
    hit: s.hits.some((h) => inView(h.pos)),
  }));
  // 괴강(일주 고정)·백호(간지 결합)는 SinsalHit 밖 → 적중 시에만 행으로 합류
  if (c.sinsal.goegang) {
    baseRows.push({ name: '괴강', glyphs: [`${P['일'].stem}${P['일'].branch}`], hits: [{ pos: '일', side: 'stem' }], hit: inView('일') });
  }
  if (c.sinsal.baekhoHits.length) {
    const hits = c.sinsal.baekhoHits.map((p) => ({ pos: p, side: 'stem' as const }));
    baseRows.push({ name: '백호', glyphs: c.sinsal.baekhoHits.map((p) => `${P[p].stem}${P[p].branch}`), hits, hit: c.sinsal.baekhoHits.some((p) => inView(p)) });
  }
  // 적중(원국) 먼저, 미적중(운에서) 나중 — 내 사주에 실재하는 것을 위로.
  const sortRows = (rows: Row[]) => [...rows].sort((a, b) => Number(b.hit) - Number(a.hit));
  const gilsin = sortRows(baseRows.filter((r) => GILSIN.includes(r.name)));
  const teuksu = sortRows(baseRows.filter((r) => TEUKSU.includes(r.name)));

  // ── 12신살 — 자리별(visiblePos) 지지 + 4기준(년·월·일·시지) 신살명(daniel "전부 산출") ──
  const baseKo: Record<string, string> = { 년: '년지', 월: '월지', 일: '일지', 시: '시지' };
  // ── 공망 ──
  const gmHit = c.sinsal.gongmangHits.filter((p) => inView(p));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>신살 · 공망 <Text style={styles.titleHanja}>神煞 · 空亡</Text></Text>
      <Text style={styles.intro}>
        신살은 사주에 색채를 더하는 보조 지표입니다(구조·격국이 중심). 길흉을 단정하기보다, 강점으로 살리고
        조심할 결을 이해하는 축으로 봅니다. 기준 글자가 원국에 있으면 ✓(자리), 없으면 대운·세운에서 작동합니다.
      </Text>

      {/* 🌟 길신 */}
      {gilsin.length > 0 && (
        <>
          <Text style={styles.section}>🌟 길신 <Text style={styles.sectionHanja}>吉神</Text></Text>
          <Text style={styles.sectionDesc}>도움·복록·귀인의 결 — 어려울 때 풀어 주는 기운.</Text>
          <SinsalGroup rows={gilsin} />
        </>
      )}

      {/* ⚡ 특수살 */}
      {teuksu.length > 0 && (
        <>
          <Text style={styles.section}>⚡ 특수살 <Text style={styles.sectionHanja}>特殊煞</Text></Text>
          <Text style={styles.sectionDesc}>강한 색채 — 전문성·매력·결단처럼 양면을 가진 기운(쓰기 나름).</Text>
          <SinsalGroup rows={teuksu} />
        </>
      )}

      {/* 🧭 12신살 — 자리별 4기준 */}
      <Text style={styles.section}>🧭 12신살 <Text style={styles.sectionHanja}>十二神煞</Text></Text>
      <Text style={styles.sectionDesc}>각 기둥의 지지를 년·월·일·시지 4기준 전부로 산출(기준에 따라 이름이 달라집니다).</Text>
      {visiblePos.map((p) => {
        const branch = P[p].branch;
        const el = branchElement(branch);
        const items = c.sinsal.twelve[p] ?? [];
        return (
          <View key={p} style={styles.twCard}>
            <View style={styles.twHead}>
              <View style={[styles.twBranch, { backgroundColor: elementColor[el] }]}>
                <Text style={[styles.twBranchTx, { color: elementText[el] }]}>{branch}</Text>
                <Text style={[styles.twBranchKo, { color: elementText[el] }]}>{branchReading(branch)}</Text>
              </View>
              <Text style={styles.twPos}>{p}주</Text>
            </View>
            <View style={styles.twItems}>
              {items.map((it, i) => {
                const gg = (SINSAL_GLOSSARY as Record<string, any>)[it.name];
                return (
                  <View key={i} style={styles.twItem}>
                    <Text style={styles.twName}>{gg?.ko ?? it.name}</Text>
                    <Text style={styles.twBases}>{it.bases.map((b) => baseKo[b] ?? b).join('·')} 기준</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* ⚪ 공망 */}
      <Text style={styles.section}>⚪ 공망 <Text style={styles.sectionHanja}>空亡</Text></Text>
      <View style={[styles.card, gmHit.length > 0 ? styles.cardHit : styles.cardLuck]}>
        <View style={styles.cardHead}>
          <Text style={styles.cardName}>공망 <Text style={styles.cardHanja}>{GONGMANG_GLOSSARY.hanja}</Text></Text>
          {gmHit.length > 0
            ? <Text style={styles.badgeHit}>✓ {gmHit.map((p) => `${p}주`).join(', ')}</Text>
            : <Text style={styles.badgeLuck}>運 운에서 들어옴 (원국에 없음)</Text>}
        </View>
        <View style={styles.glyphRow}>
          {c.sinsal.gongmang.map((b, i) => <GlyphChip key={i} g={b} />)}
        </View>
        <Text style={styles.cardMeaning}>{GONGMANG_GLOSSARY.meaning}</Text>
        <View style={styles.kwRow}>
          {GONGMANG_GLOSSARY.keywords.map((k, i) => <Text key={i} style={styles.kw}>{k}</Text>)}
        </View>
      </View>

      <Text style={styles.note}>※ 신살은 보조 지표입니다. 깊은 통변(영역별 풀이)은 구조·격국·용신과 함께 봅니다.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  title: { ...font.title, marginBottom: space(2) },
  titleHanja: { ...font.title, color: colors.inkFaint, fontWeight: '400' },
  intro: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(4) },

  section: { fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: space(5), marginBottom: space(1) },
  sectionHanja: { fontSize: 14, fontWeight: '400', color: colors.inkFaint },
  sectionDesc: { ...font.caption, color: colors.inkFaint, marginBottom: space(3), lineHeight: 17 },

  // 신살 카드
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: space(4), marginBottom: space(3), ...shadow.card,
  },
  cardHit: { borderColor: colors.ju }, // 원국 적중 = 골드 테두리(내 사주에 실재)
  cardLuck: { opacity: 0.74 },         // 운에서 들어옴 = 흐리게(원국 적중과 대비)
  // '운에서 들어옴' 서브헤더 — 원국 적중 카드 묶음과 분리
  luckSubHead: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginTop: space(3), marginBottom: space(2.5) },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2.5) },
  cardName: { fontSize: 16, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  cardHanja: { fontSize: 13, fontWeight: '400', color: colors.inkFaint },
  badgeHit: { fontSize: 12, fontWeight: '700', color: colors.ju, marginLeft: space(2) },
  badgeLuck: { fontSize: 12, fontWeight: '600', color: colors.inkFaint, marginLeft: space(2) },

  glyphRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginBottom: space(2.5) },
  glyphChip: { minWidth: 30, paddingHorizontal: space(1.5), paddingVertical: space(1), borderRadius: radius.sm, alignItems: 'center' },
  glyphTx: { fontSize: 17, fontWeight: '800' },
  glyphKo: { fontSize: 10, fontWeight: '600', marginTop: -2 },
  // 간지 결합(괴강·백호) 통짜 칩 — 단일 오행색이 없어 중립 배경
  glyphChipWide: { paddingHorizontal: space(2.5), paddingVertical: space(1.25), borderRadius: radius.sm, backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.line },
  glyphTxWide: { fontSize: 17, fontWeight: '800', color: colors.ink },

  cardMeaning: { ...font.body, color: colors.ink, lineHeight: 21, fontSize: 14 },
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2.5) },
  kw: {
    fontSize: 12, fontWeight: '600', color: colors.inkSoft, backgroundColor: colors.juSoft,
    paddingHorizontal: space(2), paddingVertical: space(0.75), borderRadius: radius.pill, overflow: 'hidden',
  },

  // 12신살 카드(자리별)
  twCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    padding: space(3.5), marginBottom: space(2.5),
  },
  twHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(2) },
  twBranch: { width: 38, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: space(3) },
  twBranchTx: { fontSize: 20, fontWeight: '800' },
  twBranchKo: { fontSize: 10, fontWeight: '600', marginTop: -2 },
  twPos: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  twItems: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  twItem: { backgroundColor: colors.juSoft, borderRadius: radius.sm, paddingHorizontal: space(2.5), paddingVertical: space(1.5) },
  twName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  twBases: { fontSize: 11, color: colors.inkFaint, marginTop: 1 },

  note: { ...font.caption, color: colors.inkFaint, marginTop: space(6), lineHeight: 18 },
});
