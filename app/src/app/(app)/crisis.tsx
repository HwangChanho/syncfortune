// src/app/(app)/crisis.tsx — 「관계의 고비」 (무료 · 온디바이스 결정론 · API 0)
// ─────────────────────────────────────────────────────────────────────────
// 기획: `신규컨텐츠기획문서/신규콘텐츠_기획_2026-08-10.md` §6-4
//   애정 축에서 **실제로 비어 있던 칸** = 이별 그 자체 · 삼각 구도.
//   (compat=관계역학 · love=이상형 · crush=짝사랑 · reunion=헤어진 *다음* · sokgunghap=성적궁합)
//
// ■ 이 화면이 지키는 것 (기획서 §4 — 이 콘텐츠는 특히)
//   1. **이별을 단정하지 않는다.** "헤어진다" 대신 *"이 시기엔 흔들리는 힘이 들어온다"*.
//      ★엔진이 `willBreakUp` 같은 필드를 아예 만들지 않아 **구조적으로 단정할 수 없다**(골든이 감시).
//   2. **진단엔 처방을 붙인다.** 각 카드가 '무엇이 있다'로 끝나지 않고 '무엇을 지키면 되는가'로 닫힌다.
//   3. **상대를 지목하지 않는다.** 쟁합은 "다투는 형태가 있다"까지만.
//   4. **유저가 스스로 연 화면에서만** 다룬다 — 홈 티저가 먼저 이별을 들추지 않는다(카드 설명도 중립).
//
// ■ 명리 어휘를 이 화면이 새로 만들지 않는다
//   판정은 전부 `crisisReport`(L1)가 내고, 여기서는 **배치와 말투**만 맡는다.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChartPicker } from '../../components/ChartPicker';
import { RelatedContent } from '../../components/RelatedContent';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { crisisReport, type CrisisReport } from '../../../../interpretation/engine/crisisReport';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { colors, radius, space, shadow } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';

export default function CrisisScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  useLogContentVisit('crisis');

  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch); setLoaded(true);
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const report: CrisisReport | null = useMemo(() => {
    if (!saved) return null;
    try { return crisisReport(computeChart(saved.input).saju, new Date().getFullYear()); } catch { return null; }
  }, [saved]);

  /** 배우자궁 충의 강도 → 사람 말. ★'shaking'(안 깨지는 충)은 현재 배우자궁에서 도달 불가(엔진 주석 참조). */
  const gradeText = (g: CrisisReport['natalChung']['grade']) =>
    g === 'breaking' ? t('crisis.gradeBreaking', '가까운 자리에서 세게 흔드는 힘이 걸려 있습니다. 이 자리는 흔들리면 흔들리는 대로 티가 납니다.')
    : g === 'shaking' ? t('crisis.gradeShaking', '흔들림은 있어도 자리 자체가 밀리지는 않습니다.')
    : g === 'even' ? t('crisis.gradeEven', '양쪽 힘이 비슷해서, 어느 쪽이 이긴다고 말하기 어려운 형태입니다.')
    : t('crisis.gradeNone', '자리를 흔드는 힘이 원국에 걸려 있지 않습니다.');

  /** 처방 — 진단마다 하나씩 붙는다(§4: 진단만 홀로 내보내지 않는다). */
  const gradeRemedy = (g: CrisisReport['natalChung']['grade']) =>
    g === 'breaking' ? t('crisis.remedyBreaking', '흔들릴 때 관계를 다시 정의하려 들면 더 흔들립니다. 결정을 미루고 생활의 리듬부터 지키는 편이 낫습니다.')
    : g === 'even' ? t('crisis.remedyEven', '어느 쪽도 이기지 못하는 힘겨루기라, 이기려 할수록 길어집니다. 먼저 말을 꺼내는 쪽이 이깁니다.')
    : t('crisis.remedyCalm', '지금 구조에는 급한 불이 없습니다. 관계를 시험하는 선택은 굳이 지금 만들지 않아도 됩니다.');

  /** 앞으로 8년 중 무언가 들어오는 해만 추린다 — 조용한 해를 줄줄이 적으면 표가 겁을 준다. */
  const activeYears = report?.timeline.filter((y) => y.open || y.bond || y.friction) ?? [];

  return (
    <View style={styles.bg}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />

        <Text style={[styles.title, { fontSize: fs(24), lineHeight: fs(32) }]}>
          {t('crisis.title', '관계의 고비')}
        </Text>
        <Text style={[styles.heroSub, { fontSize: fs(13), lineHeight: fs(19) }]}>
          {t('crisis.heroSub', '흔들리는 시기를 구조로 봅니다 — 점이 아니라 자리와 힘으로')}
        </Text>

        {/* ── 프레이밍: 무엇을 답하고 무엇을 답하지 않는지 먼저 말한다(§4) ── */}
        <View style={styles.noteCard}>
          <Text style={[styles.noteTitle, { fontSize: fs(14), lineHeight: fs(20) }]}>
            {t('crisis.frameTitle', '헤어질지는 말하지 않습니다')}
          </Text>
          <Text style={[styles.noteBody, { fontSize: fs(13), lineHeight: fs(20) }]}>
            {t('crisis.frameBody', '관계가 끝날지 맞히는 화면이 아닙니다. 내 명식의 배우자 자리에 어떤 힘이 어디서 걸려 있고, 어느 해에 그 자리가 움직이는지를 봅니다. 결정은 그 다음이고, 그건 사주가 아니라 두 사람이 합니다.')}
          </Text>
        </View>

        {!loaded ? (
          <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>
        ) : !saved ? (
          <View style={styles.card}>
            <Text style={[styles.empty, { fontSize: fs(13), lineHeight: fs(20) }]}>
              {t('crisis.needChart', '명식을 등록하면 이 화면이 채워집니다.')}
            </Text>
          </View>
        ) : !report ? (
          <View style={styles.card}>
            <Text style={[styles.empty, { fontSize: fs(13), lineHeight: fs(20) }]}>
              {t('crisis.chartFail', '이 명식으로는 계산하지 못했습니다.')}
            </Text>
          </View>
        ) : (
          <>
            {/* ① 위기의 강도 — 배우자궁에 걸린 충 */}
            <Text style={[styles.secTitle, { fontSize: fs(17), lineHeight: fs(24) }]}>
              {t('crisis.secStrength', '① 흔드는 힘이 어디서 오는가')}
            </Text>
            <View style={styles.card}>
              <Text style={[styles.lead, { fontSize: fs(15), lineHeight: fs(23) }]}>
                {t('crisis.gungLine', '배우자 자리 = 일지 {{gung}}', { gung: report.gung })}
                {report.natalChung.from ? t('crisis.chungFrom', ' · {{from}}지에서 걸립니다', { from: report.natalChung.from }) : ''}
              </Text>
              <Text style={[styles.body, { fontSize: fs(13), lineHeight: fs(21) }]}>{gradeText(report.natalChung.grade)}</Text>
              <Text style={[styles.remedy, { fontSize: fs(13), lineHeight: fs(21) }]}>{gradeRemedy(report.natalChung.grade)}</Text>
            </View>

            {/* ② 삼각 구도 — 쟁합. ★상대를 지목하지 않는다 */}
            <Text style={[styles.secTitle, { fontSize: fs(17), lineHeight: fs(24) }]}>
              {t('crisis.secRivalry', '② 다투는 형태가 있는가')}
            </Text>
            <View style={styles.card}>
              <Text style={[styles.body, { fontSize: fs(13), lineHeight: fs(21) }]}>
                {report.rivalry.present
                  ? (report.rivalry.overWealth
                    ? t('crisis.rivalryWealth', '천간에서 같은 글자 둘이 하나를 두고 다투는 형태가 있고, 그 대상이 재성입니다. 사람이든 몫이든 “나눠 갖기 어려운 것”이 관계 안에 들어오면 결이 드러납니다.')
                    : t('crisis.rivalryYes', '천간에서 같은 글자 둘이 하나를 두고 다투는 형태가 있습니다. 누가 끼어든다는 뜻이 아니라, 하나를 두고 힘이 갈리는 구조가 원래 있다는 뜻입니다.'))
                  : t('crisis.rivalryNo', '하나를 두고 힘이 갈리는 형태는 원국에 없습니다. 관계가 흔들린다면 다른 데서 옵니다.')}
              </Text>
              <Text style={[styles.remedy, { fontSize: fs(13), lineHeight: fs(21) }]}>
                {report.rivalry.present
                  ? t('crisis.rivalryRemedy', '이 구조는 “누구 때문”으로 읽으면 반드시 틀립니다. 나눌 수 없는 것을 먼저 정해 두면 다툴 자리가 줄어듭니다.')
                  : t('crisis.rivalryRemedyNo', '삼각 구도를 미리 걱정할 자리는 아닙니다.')}
              </Text>
            </View>

            {/* ③ 인연의 원근 — 붙은 합 / 마찰 */}
            <Text style={[styles.secTitle, { fontSize: fs(17), lineHeight: fs(24) }]}>
              {t('crisis.secBond', '③ 붙어 있는가, 이름뿐인가')}
            </Text>
            <View style={styles.card}>
              <Text style={[styles.body, { fontSize: fs(13), lineHeight: fs(21) }]}>
                {report.bond.present
                  ? t('crisis.bondYes', '배우자 자리가 바로 옆자리와 묶여 있습니다. 떨어져 있어도 잘 안 끊어지는 결입니다.')
                  : t('crisis.bondNo', '배우자 자리를 붙들어 두는 글자가 옆에 없습니다. 관계의 지속은 구조보다 두 사람이 만드는 쪽입니다.')}
                {report.friction.present ? ` ${t('crisis.frictionYes', '다만 마찰(형)이 함께 걸려 있어, 가까울수록 부딪히는 대목이 생깁니다.')}` : ''}
              </Text>
              <Text style={[styles.remedy, { fontSize: fs(13), lineHeight: fs(21) }]}>
                {report.friction.present
                  ? t('crisis.frictionRemedy', '부딪히는 지점이 늘 같은 자리라면 그건 사건이 아니라 결입니다. 그 한 가지만 규칙으로 정해 두면 나머지는 조용해집니다.')
                  : t('crisis.bondRemedy', '붙들어 두는 힘이 약할수록 약속과 반복이 그 자리를 대신합니다.')}
              </Text>
            </View>

            {/* ④ 시기 — 어느 해에 자리가 움직이나 */}
            <Text style={[styles.secTitle, { fontSize: fs(17), lineHeight: fs(24) }]}>
              {t('crisis.secTiming', '④ 어느 해에 그 자리가 움직이는가')}
            </Text>
            <View style={styles.card}>
              {activeYears.length === 0 ? (
                <Text style={[styles.body, { fontSize: fs(13), lineHeight: fs(21) }]}>
                  {t('crisis.timingQuiet', '앞으로 여덟 해 동안 배우자 자리를 건드리는 해가 없습니다. 조용한 구간입니다.')}
                </Text>
              ) : (
                activeYears.map((y) => (
                  <View key={y.year} style={styles.yearRow}>
                    <Text style={[styles.year, { fontSize: fs(14), lineHeight: fs(20) }]}>{y.year}</Text>
                    <Text style={[styles.yearText, { fontSize: fs(13), lineHeight: fs(20) }]}>
                      {y.open ? t('crisis.yOpen', '자리가 열립니다 — 움직임이 들어오는 해') : ''}
                      {y.bond ? (y.open ? ' · ' : '') + t('crisis.yBond', '자리가 묶입니다 — 매듭이 지어지는 해') : ''}
                      {y.friction ? ((y.open || y.bond) ? ' · ' : '') + t('crisis.yFriction', '마찰이 도는 해') : ''}
                    </Text>
                  </View>
                ))
              )}
              <Text style={[styles.remedy, { fontSize: fs(13), lineHeight: fs(21) }]}>
                {t('crisis.timingRemedy', '“열린다”는 헤어진다는 뜻이 아닙니다. 그 자리에 움직임이 들어온다는 뜻이고, 만남도 정리도 같은 문으로 옵니다. 그 해에 큰 결정을 몰아 두지 않는 것만으로 대부분 지나갑니다.')}
              </Text>
            </View>

            <Text style={[styles.disclaimer, { fontSize: fs(11), lineHeight: fs(17) }]}>
              {t('crisis.disclaimer', '이 화면은 구조와 시기를 보는 참고 자료이고, 관계의 결말을 예측하지 않습니다. 지금 많이 힘드시다면 사주보다 먼저 곁의 사람이나 전문가와 이야기해 보시길 권합니다.')}
            </Text>
          </>
        )}

        <RelatedContent kind="crisis" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: space(4), paddingBottom: space(12) },
  title: { fontWeight: '900', color: colors.ink, marginTop: space(2) },
  heroSub: { color: colors.inkSoft, marginTop: space(1), marginBottom: space(4) },
  noteCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4), marginBottom: space(5), ...shadow.card },
  noteTitle: { fontWeight: '800', color: colors.ink, marginBottom: space(2) },
  noteBody: { color: colors.inkSoft },
  secTitle: { fontWeight: '800', color: colors.ink, marginTop: space(4), marginBottom: space(2) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4), marginBottom: space(2), ...shadow.card },
  lead: { fontWeight: '800', color: colors.ink, marginBottom: space(2) },
  body: { color: colors.inkSoft },
  // 처방 — 진단과 시각적으로 갈라 둔다(§4: 진단만 홀로 남지 않게)
  remedy: { color: colors.ink, marginTop: space(3), fontWeight: '600' },
  empty: { color: colors.inkFaint, textAlign: 'center' },
  yearRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space(2) },
  year: { fontWeight: '900', color: colors.ju, width: 56 },
  yearText: { color: colors.inkSoft, flex: 1 },
  disclaimer: { color: colors.inkFaint, marginTop: space(4) },
});
