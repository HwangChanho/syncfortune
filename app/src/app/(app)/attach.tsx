// src/app/(app)/attach.tsx — 성인 애착유형: **명식 × 설문 비교** (무료·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-08-08: "사주 기준으로도 뽑고 설문을 받아서도 결론을 도출해서 **비교**할 수 있게 하고 싶어"
// 설계 근거 = 전문가 스펙 `knowledge/rules/R-ATTACH_성인애착_2026-08-08.md`.
//
// ■ 이 화면이 지키는 것 (어기면 콘텐츠 자체가 무의미해진다)
//   1. **유형을 선고하지 않는다.** 4유형 이름표를 붙이지 않고 2축 점수만 보여 준다(§1).
//      전문가: *"사주로 애착유형을 맞춘다고 가면 반증당하는 순간 끝난다."*
//      → 프레이밍은 **같은 관계 패턴을 두 언어로 기술** = 검사(현재 상태) vs 원국(구조적 성향)(§6).
//   2. **가중치가 가설임을 화면에 적는다.** attachAxes 의 version('v0-equal')을 그대로 노출한다(§3·§5).
//   3. **불일치를 결함으로 그리지 않는다.** 차이가 크면 오히려 값진 소재다 —
//      회피 지표 강한데 검사는 안정 = 후천적 교정 경험(earned secure)(§6).
//   4. §4 안전: 진단·단정 금지. 절단점 없음. '이렇게 타고났다 + 그래서 이렇게 쓴다'까지.
//
// ■ 명리 어휘를 이 화면이 새로 만들지 않는다
//   축 기여 목록은 전부 `attachAxes` 가 넘겨준 label 을 **배치만** 한다(엔진이 단일 출처).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { ChartPicker } from '../../components/ChartPicker';
import { RelatedContent } from '../../components/RelatedContent';
import { AttachCompareBar, AttachCompareLegend } from '../../components/AttachCompareBar';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { attachAxes, type AttachAxes } from '@engine/attachAxes';
import { ATTACH_ITEMS, SCALE_LABELS, SCALE_MIN, SCALE_MAX, scoreSurvey, type AttachAnswers } from '../../lib/content/attachSurvey';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';

export default function AttachScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  useLogContentVisit('attach');

  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [answers, setAnswers] = useState<AttachAnswers>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch); setLoaded(true);
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  // 명식 → 두 축. 명식이 없으면 설문만으로도 화면이 성립한다(설문은 명식과 독립).
  const axes: AttachAxes | null = useMemo(() => {
    if (!saved) return null;
    try { return attachAxes(computeChart(saved.input).saju); } catch { return null; }
  }, [saved]);

  const survey = useMemo(() => scoreSurvey(answers), [answers]);
  const surveyDone = survey.answered === survey.total;

  /** 기여 목록 — 0 인 항목은 감춘다(민 것만 보여 주는 게 근거로서 정확하다). */
  const contribList = (which: 'anxiety' | 'avoidance') =>
    (axes?.[which].contributions ?? []).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);

  return (
    <View style={styles.bgImage}>
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />

        <Text style={[styles.title, { fontSize: fs(24), lineHeight: fs(32) }]}>
          {t('attach.title', '애착유형 — 명식과 설문 비교')}
        </Text>
        <Text style={[styles.heroSub, { fontSize: fs(13), lineHeight: fs(19) }]}>
          {t('attach.heroSub', '같은 관계 패턴을 두 가지 언어로 봅니다')}
        </Text>

        {/* ── 프레이밍: 무엇을 재는지 · 무엇을 재지 않는지 (§6) ── */}
        <View style={styles.noteCard}>
          <Text style={[styles.noteTitle, { fontSize: fs(14), lineHeight: fs(20) }]}>
            {t('attach.frameTitle', '두 결과는 서로 다른 것을 봅니다')}
          </Text>
          <Text style={[styles.noteBody, { fontSize: fs(13), lineHeight: fs(20) }]}>
            {t('attach.frameBody', '설문은 지금 이 시기의 상태를 재고, 명식은 타고난 구조의 결을 봅니다. 그래서 두 값이 다를 수 있고, 다른 것이 오히려 읽을 거리입니다 — 구조는 거리를 두는 쪽인데 지금은 편안하다면, 그 사이에 무언가를 스스로 익힌 것입니다.')}
          </Text>
        </View>

        {/* ── ① 명식 쪽 ── */}
        <Text style={[styles.secTitle, { fontSize: fs(17), lineHeight: fs(24) }]}>
          {t('attach.secChart', '① 명식이 가리키는 결')}
        </Text>

        {!loaded ? (
          <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>
        ) : !saved ? (
          <View style={styles.card}>
            <Text style={[styles.emptyText, { fontSize: fs(13), lineHeight: fs(20) }]}>
              {t('attach.needChart', '명식을 등록하면 이 부분이 함께 나옵니다. 설문만 먼저 해 보셔도 됩니다.')}
            </Text>
          </View>
        ) : !axes ? (
          <View style={styles.card}>
            <Text style={[styles.emptyText, { fontSize: fs(13), lineHeight: fs(20) }]}>
              {t('attach.chartFail', '이 명식으로는 계산하지 못했습니다.')}
            </Text>
          </View>
        ) : (
          <>
            {(['anxiety', 'avoidance'] as const).map((k) => (
              <View key={k} style={styles.axisCard}>
                <Text style={[styles.axisName, { fontSize: fs(15), lineHeight: fs(21) }]}>
                  {k === 'anxiety' ? t('attach.axisAnx', '불안 — 멀어질까 하는 쪽') : t('attach.axisAvo', '회피 — 거리를 두는 쪽')}
                </Text>
                <Text style={[styles.axisNum, { fontSize: fs(28), lineHeight: fs(36) }]}>
                  {Math.round(axes[k].score * 100)}
                  <Text style={[styles.axisUnit, { fontSize: fs(16), lineHeight: fs(22) }]}> / 100</Text>
                </Text>
                {/* 근거 — 무엇이 이 점수를 밀었나. 점수만 보여 주면 반증이 불가능해진다(§3). */}
                <Text style={[styles.basisHead, { fontSize: fs(12), lineHeight: fs(17) }]}>
                  {t('attach.basisHead', '이 점수를 민 것')}
                </Text>
                {contribList(k).map((c) => (
                  <View key={c.key} style={styles.basisRow}>
                    <Text style={[styles.basisLabel, { fontSize: fs(13), lineHeight: fs(19) }]}>{c.label}</Text>
                    <View style={styles.basisTrack}>
                      <View style={[styles.basisFill, { width: `${Math.round(c.value * 100)}%` }]} />
                    </View>
                  </View>
                ))}
                {contribList(k).length === 0 ? (
                  <Text style={[styles.basisLabel, { fontSize: fs(13), lineHeight: fs(19) }]}>
                    {t('attach.basisNone', '이 축을 미는 구조가 뚜렷하지 않습니다.')}
                  </Text>
                ) : null}
              </View>
            ))}

            {/* ★가중치가 가설임을 화면에 적는다 — 이 문장이 빠지면 R-ATTACH 는 사후 변명 장치가 된다(§3) */}
            <Text style={[styles.hypo, { fontSize: fs(11), lineHeight: fs(17) }]}>
              {t('attach.hypo', '위 항목들이 어느 축에 속하는지는 상담 전문가가 지정했고, 항목별 비중은 아직 정하지 않아 모두 같은 무게로 두었습니다(v0). 응답이 쌓이면 실제 비중을 다시 계산해 반영합니다.')}
            </Text>
          </>
        )}

        {/* ── ② 설문 ── */}
        <Text style={[styles.secTitle, { fontSize: fs(17), lineHeight: fs(24) }]}>
          {t('attach.secSurvey', '② 지금의 나 (12문항)')}
        </Text>
        <Text style={[styles.secSub, { fontSize: fs(12), lineHeight: fs(18) }]}>
          {t('attach.surveySub', '가까운 사람과의 관계를 떠올리며 답해 주세요. 정답은 없습니다.')}
        </Text>

        {ATTACH_ITEMS.map((it, idx) => (
          <View key={it.id} style={styles.qCard}>
            <Text style={[styles.qText, { fontSize: fs(14), lineHeight: fs(21) }]}>
              {idx + 1}. {it.text}
            </Text>
            <View style={styles.optRow}>
              {Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => SCALE_MIN + i).map((v) => {
                const on = answers[it.id] === v;
                return (
                  <PressableScale
                    key={v}
                    onPress={() => setAnswers((a) => ({ ...a, [it.id]: v }))}
                    style={[styles.opt, on && styles.optOn]}
                    accessibilityLabel={`${it.text} — ${SCALE_LABELS[v - 1]}`}
                  >
                    <Text style={[styles.optNum, on && styles.optNumOn, { fontSize: fs(13), lineHeight: fs(18) }]}>{v}</Text>
                  </PressableScale>
                );
              })}
            </View>
            <View style={styles.optEnds}>
              <Text style={[styles.optEnd, { fontSize: fs(10), lineHeight: fs(15) }]}>{SCALE_LABELS[0]}</Text>
              <Text style={[styles.optEnd, { fontSize: fs(10), lineHeight: fs(15), textAlign: 'right' }]}>{SCALE_LABELS[SCALE_LABELS.length - 1]}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.progress, { fontSize: fs(12), lineHeight: fs(18) }]}>
          {t('attach.progress', '{{n}} / {{total}} 문항', { n: survey.answered, total: survey.total })}
        </Text>

        {/* ── ③ 비교 — 설문을 다 마쳐야 낸다(부분 응답 평균은 축을 왜곡한다) ── */}
        <Text style={[styles.secTitle, { fontSize: fs(17), lineHeight: fs(24) }]}>
          {t('attach.secCompare', '③ 두 결과 나란히 보기')}
        </Text>

        {!surveyDone ? (
          <View style={styles.card}>
            <Text style={[styles.emptyText, { fontSize: fs(13), lineHeight: fs(20) }]}>
              {t('attach.compareLocked', '12문항을 모두 답하면 여기에서 나란히 보여 드립니다.')}
            </Text>
          </View>
        ) : (
          <View style={styles.axisCard}>
            <AttachCompareLegend />
            <AttachCompareBar
              label={t('attach.axisAnxShort', '불안')}
              chart={axes?.anxiety.score}
              survey={survey.anxiety}
              lowText={t('attach.anxLow', '흔들리지 않는 편')}
              highText={t('attach.anxHigh', '멀어질까 살피는 편')}
            />
            <AttachCompareBar
              label={t('attach.axisAvoShort', '회피')}
              chart={axes?.avoidance.score}
              survey={survey.avoidance}
              lowText={t('attach.avoLow', '가까움이 편한 편')}
              highText={t('attach.avoHigh', '거리를 두는 편')}
            />

            {/* §6 편향 신호 — 해석을 단정하지 않고 '따로 볼 것'으로만 제시한다 */}
            {survey.soloCloseGap >= 0.25 ? (
              <Text style={[styles.noteBody, { fontSize: fs(12), lineHeight: fs(19) }]}>
                {t('attach.soloGap', '‘혼자가 편하다’ 쪽은 높고 ‘가까워지면 불편하다’ 쪽은 낮게 나왔습니다. 스스로 해결하는 힘이 큰 경우에도 이렇게 나오니, 두 갈래를 따로 보시면 좋습니다.')}
              </Text>
            ) : null}
          </View>
        )}

        {/* 안전 — 진단이 아님(§4) */}
        <Text style={[styles.disclaimer, { fontSize: fs(11), lineHeight: fs(17) }]}>
          {t('attach.disclaimer', '이 결과는 자기이해를 돕는 참고 자료이고 심리 진단이 아닙니다. 관계나 마음의 어려움이 일상에 영향을 주고 있다면 전문가와 이야기해 보시길 권합니다.')}
        </Text>

        <RelatedContent kind="attach" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: 'transparent' },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  // ★하단 여백 — 마지막이 눌리는 요소면 넉넉히(check:bottominset 기준)
  wrap: { padding: space(6), paddingBottom: space(44) },
  title: { fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(2) },
  heroSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(4) },

  secTitle: { fontWeight: '900', color: colors.ink, marginTop: space(6), marginBottom: space(2) },
  secSub: { color: colors.inkSoft, marginBottom: space(3) },

  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card, alignItems: 'center' },
  emptyText: { color: colors.inkSoft, textAlign: 'center' },

  noteCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(2) },
  noteTitle: { fontWeight: '800', color: colors.ink, marginBottom: space(1.5) },
  noteBody: { color: colors.inkSoft },

  axisCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  axisName: { fontWeight: '800', color: colors.ink },
  axisNum: { fontWeight: '900', color: colors.ink, marginTop: space(1) },
  axisUnit: { fontWeight: '800', color: colors.inkFaint },

  basisHead: { color: colors.inkFaint, fontWeight: '700', marginTop: space(3), marginBottom: space(2) },
  basisRow: { marginBottom: space(2) },
  basisLabel: { color: colors.inkSoft, marginBottom: space(1) },
  basisTrack: { height: 6, borderRadius: 3, backgroundColor: colors.sunk, overflow: 'hidden' },
  basisFill: { height: 6, borderRadius: 3, backgroundColor: '#C8A24A' },

  hypo: { color: colors.inkFaint, marginTop: space(1), marginBottom: space(2) },

  qCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(2.5) },
  qText: { color: colors.ink, fontWeight: '600', marginBottom: space(3) },
  optRow: { flexDirection: 'row', gap: space(1.5), justifyContent: 'space-between' },
  opt: { flex: 1, aspectRatio: 1, maxHeight: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  optOn: { backgroundColor: '#C8A24A', borderColor: '#C8A24A' },
  optNum: { color: colors.inkSoft, fontWeight: '700' },
  optNumOn: { color: colors.card, fontWeight: '900' },
  optEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(1.5) },
  optEnd: { color: colors.inkFaint, flex: 1 },

  progress: { color: colors.inkFaint, textAlign: 'center', marginTop: space(2), fontWeight: '700' },
  disclaimer: { color: colors.inkFaint, marginTop: space(5) },
});
