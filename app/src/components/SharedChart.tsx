// app/src/components/SharedChart.tsx — 커뮤니티 게시판용 명식 요약 뷰(읽기 전용 프리뷰)
// ─────────────────────────────────────────────────────────────────────────
// 배경: 커뮤니티를 '명식 공유 게시판'으로 만들며, 글에 첨부된 남의 명식(사주 원국 + 옵션 대운·세운
//   + 자미 명반)을 열람자에게 보여줘야 한다. 기존 명식 표시(MyeongsikScreen.tsx)는 props로
//   ChartInput(생년월일시 원시 PII)을 받아 내부에서 computeChart()로 계산하는 구조라 그대로 못 쓴다
//   — 그대로 쓰면 글을 보는 모든 사람에게 작성자의 생년월일시가 그대로 넘어간다.
//
// ★그래서 이 컴포넌트는 '계산이 끝난 결과'만 받는다: saju: SajuChart(=spec/chart.ts, 글자·자리·
//   지장간·합충만 남은 정규화 구조 — PII 없음, ADR-005 §6.1 서버 전송 가능 계약). ChartInput 타입도
//   ChartInput→SajuChart 변환 함수인 computeChart도 이 파일은 import하지 않는다(원시 생년월일시는
//   작성자 기기에서 계산이 끝난 뒤 SajuChart 형태로만 게시물에 실려야 한다 — 변환은 이 컴포넌트의 책임이 아니다).
//
// ★showLuck: 대운·세운 공개 여부 플래그. 원국(타고난 여덟 글자)보다 '지금 이 사람이 어떤 시기를
//   지나는지'(대운·세운)가 한 단계 더 사적인 정보라, 작성자가 글 작성 시 공개를 선택한 경우에만
//   호출부가 true로 넘겨준다고 가정한다(기본은 원국만 표시). true여도 *현재* 대운·세운만 보여준다
//   — 월운·일운까지는 보여주지 않는다(요약 카드는 간결해야 한다. 전체 시간축 드릴다운은 MyeongsikScreen 몫).
//
// ★이 컴포넌트는 게시물 상단에 얹는 '요약 카드'다. MyeongsikScreen에 있는 탭 전환·사운드·햅틱·
//   글로서리 바텀시트·가로 스크롤 타임라인 드릴다운 같은 상호작용은 의도적으로 가져오지 않았다.
// ★간지 한 칸 렌더는 GzCell(components/GzCell.tsx — 2026-07-16 MyeongsikScreen에서 추출된 단일 출처)을
//   그대로 재사용한다. 합충·격국·용신 같은 새 명리 판정은 여기서 계산하지 않고, saju/ziwei 객체가
//   이미 들고 있는 값(십신·간지·궁 이름 등)을 그대로 읽어 보여주기만 한다.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart, PillarPos } from '@spec/chart';
import { colors, radius, space } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import { GzCell } from './GzCell';

// 전통 표기 — 오른쪽이 년주: 시(왼) ← 일 ← 월 ← 년(오른쪽). MyeongsikScreen의 POS와 동일 순서.
const POS: PillarPos[] = ['시', '일', '월', '년'];

// 자미두수 12궁의 화면 배치 좌표(4×4, 가운데 2×2는 궁이 없어 빈 칸) — MyeongsikScreen ziwei 탭의
//   LAYOUT 상수와 동일한 전통 배치(어느 지지가 어느 칸에 그려지는지)다. 이건 명리 판정이 아니라
//   '그림을 어디 그리는가'라는 배치 규약이라 그대로 재사용한다(재계산·재해석 없음).
const ZI_LAYOUT: (string | null)[][] = [
  ['巳', '午', '未', '申'],
  ['辰', null, null, '酉'],
  ['卯', null, null, '戌'],
  ['寅', '丑', '子', '亥'],
];

export function SharedChart({ saju, ziwei, showLuck }: { saju: SajuChart; ziwei?: any; showLuck?: boolean }) {
  const { fs } = useFontScale(); // 앱 전역 글자 크기 설정 — 명식 글자까지 일관 적용(daniel 접근성 컨벤션)
  const styles = useMemo(() => makeStyles(fs), [fs]);

  // 자미 궁을 지지(branch)로 바로 찾기 위한 맵. ziwei는 any(iztro 산출물)이라 방어적으로 다룬다.
  const palacesByBranch: Record<string, any> = {};
  if (Array.isArray(ziwei?.palaces)) {
    for (const pl of ziwei.palaces) palacesByBranch[pl.branch] = pl;
  }

  return (
    <View style={styles.card}>
      {/* 사주 원국 8글자 그리드(필수) — 시·일·월·년 4기둥 × (천간+지지) */}
      <View style={styles.pillarRow}>
        {POS.map((p) => {
          const d = saju.pillars[p];
          if (!d) return null; // 방어적 가드 — SajuChart 타입상 4주 모두 채워지지만 손상 데이터 대비
          const isDay = p === '일'; // 일주(日柱) = '나'(일간) — MyeongsikScreen과 동일 관례로 강조만(새 판정 아님)
          return (
            <View key={p} style={[styles.pillarCol, isDay && styles.pillarColDay]}>
              <Text style={[styles.posLabel, isDay && styles.posLabelDay]}>{p}</Text>
              <Text style={styles.tenGod}>{d.stemTenGod}</Text>
              <GzCell char={d.stem} kind="stem" size="sm" />
              <GzCell char={d.branch} kind="branch" size="sm" />
              <Text style={styles.tenGod}>{d.branchMainTenGod}</Text>
            </View>
          );
        })}
      </View>

      {/* 대운·세운 — 작성자가 공개를 선택한 경우만(showLuck). 현재 대운·세운만(월운 이하 생략 — 요약이라 간결하게) */}
      {showLuck && saju.currentLuck && saju.annual && (
        <View style={styles.luckRow}>
          <View style={styles.luckCol}>
            <Text style={styles.luckLabel}>대운 · {saju.currentLuck.startAge}세</Text>
            <View style={styles.luckGz}>
              <GzCell char={saju.currentLuck.stem} kind="stem" size="xs" />
              <GzCell char={saju.currentLuck.branch} kind="branch" size="xs" />
            </View>
            <Text style={styles.luckSub}>{saju.currentLuck.stemTenGod}</Text>
          </View>
          <View style={styles.luckCol}>
            <Text style={styles.luckLabel}>세운 · {saju.annual.year}</Text>
            <View style={styles.luckGz}>
              <GzCell char={saju.annual.stem} kind="stem" size="xs" />
              <GzCell char={saju.annual.branch} kind="branch" size="xs" />
            </View>
            <Text style={styles.luckSub}>{saju.annual.stemTenGod}</Text>
          </View>
        </View>
      )}

      {/* 자미두수 명반(12궁) — ziwei가 있을 때만 표시. 별 밝기·생년사화 색·소성 등 디테일은 생략(요약) */}
      {ziwei && Array.isArray(ziwei.palaces) && (
        <View style={styles.ziWrap}>
          <Text style={styles.sectionLabel}>
            자미두수{ziwei.bureau ? ` · ${ziwei.bureau}` : ''}{ziwei.lifePalaceBranch ? ` · 명궁 ${ziwei.lifePalaceBranch}` : ''}
          </Text>
          <View style={styles.ziGrid}>
            {ZI_LAYOUT.map((row, r) => (
              <View key={r} style={styles.ziRow}>
                {row.map((branch, ci) => {
                  if (!branch) return <View key={ci} style={styles.ziCellEmpty} />;
                  const pl = palacesByBranch[branch];
                  return (
                    <View key={ci} style={styles.ziCell}>
                      <Text style={styles.ziBranch}>{branch}</Text>
                      {pl && (
                        <>
                          <Text style={styles.ziPalaceName} numberOfLines={1}>{pl.name}</Text>
                          <Text style={styles.ziStars} numberOfLines={2}>
                            {(pl.majorStars ?? []).map((s: any) => s.name).join(' ') || '—'}
                          </Text>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// SharedChart 전용 스타일 — 색·간격·라운드·글자크기는 전부 lib/theme(colors·space·radius) + fs(폰트스케일)만
//   사용한다(하드코딩 금지). fs는 MyeongsikScreen과 동일하게 사용자 글자 크기 설정을 반영.
const makeStyles = (fs: (n: number) => number) => StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4) },
  pillarRow: { flexDirection: 'row', gap: space(2) },
  pillarCol: { flex: 1, alignItems: 'center', paddingVertical: space(2), borderRadius: radius.sm },
  pillarColDay: { backgroundColor: colors.juSoft },
  posLabel: { fontSize: fs(11), fontWeight: '700', color: colors.inkFaint, marginBottom: space(1) },
  posLabelDay: { color: colors.ju },
  tenGod: { fontSize: fs(10), fontWeight: '600', color: colors.inkSoft },
  luckRow: { flexDirection: 'row', gap: space(3), marginTop: space(4) },
  luckCol: { flex: 1, alignItems: 'center', paddingVertical: space(2.5), borderRadius: radius.sm, backgroundColor: colors.sunk },
  luckLabel: { fontSize: fs(11), fontWeight: '700', color: colors.ju, marginBottom: space(1) },
  luckGz: { flexDirection: 'row', gap: space(1) },
  luckSub: { fontSize: fs(10), fontWeight: '600', color: colors.inkSoft, marginTop: space(1) },
  sectionLabel: { fontSize: fs(12), fontWeight: '700', color: colors.inkSoft, marginBottom: space(2) },
  ziWrap: { marginTop: space(4) },
  ziGrid: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, overflow: 'hidden' },
  ziRow: { flexDirection: 'row' },
  ziCell: { flex: 1, minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: space(1), backgroundColor: colors.card },
  ziCellEmpty: { flex: 1, minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.sunk },
  ziBranch: { fontSize: fs(10), fontWeight: '800', color: colors.inkFaint },
  ziPalaceName: { fontSize: fs(9), fontWeight: '700', color: colors.ink, marginTop: 1 },
  ziStars: { fontSize: fs(9), fontWeight: '400', color: colors.inkSoft, marginTop: 1, lineHeight: fs(12) },
});
