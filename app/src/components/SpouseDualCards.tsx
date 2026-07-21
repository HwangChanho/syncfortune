// app/src/components/SpouseDualCards.tsx — R-SPOUSE-DUAL 배우자 이원 궁위 무료 카드(스펙 §5)
// ─────────────────────────────────────────────────────────────────────────
// 스펙: /R-SPOUSE-DUAL_spec.md §5(UX 컨텐츠 프레임). 엔진 analyzeSpouseDual(결정론·온디바이스·API 0)의
//   출력을 소비해 5프레임을 그린다:
//     ① 끌리는 이상형(배우자성 위치) ② 진짜 곁에 남는 사람(배우자궁=일지) ③ 관계/괴리(§2 판단트리 frame + 강도)
//     ④ 끌림 vs 안정 타임라인(세운별 ignition/settle 2-라인 + 라벨) ⑤ 나이대 경향(접이식·순화 톤).
//
// ▶ 명리 stance 경계(CLAUDE.md §3.3·§6): 엔진 산출값과 스펙 §2 frame 라벨·§3 세운 라벨은 *인코딩*(발명 아님).
//   지지별 '인물 묘사'(외모·성격 등)는 유료 애정 리딩(L2/Edge)이 담당 — 여기선 흉내내지 않는다(중복·발명 회피).
//   화면 텍스트는 *일상어*(한자·명리 용어 노출 금지 — PossibilityGauge 스탠스와 동일). 아래 문구는 daniel 검수 슬롯.
//
// ▶ 이 카드는 love.tsx(나의 애정흐름) 무료 섹션 = LoveFlowGraph 아래·유료 리딩 위(퍼널: 무료 결정론 훅 → 유료 깊은 통변).
// ─────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { SajuChart } from '@spec/chart';
import { analyzeSpouseDual, type SpouseDual, type SpouseYear } from '../lib/love/spouseDual';
import type { SpouseLabel } from '../lib/love/spouseDualCore';
import { colors, radius, space, font, shadow } from '../lib/theme';

// 현재 연도 — RN 앱 런타임(Workflow 스크립트 아님)이라 new Date() 사용 무방.
const thisYear = (): number => new Date().getFullYear();

// ── 배우자성 위치(궁위) → 일상어 결(스펙 §1 궁위론·daniel 검수 슬롯) ──────────────────────────
const POS_HINT: Record<string, string> = {
  월: '사회생활에서 자연스럽게 끌리는 결',   // 월지 = 사회적 접점·첫인상(스펙 §1)
  년: '집안·자라온 배경과 이어진 상',        // 년지 = 배경·집안
  시: '삶의 후반·가정에서 그리는 상',        // 시지 = 말년·가정궁
};

// ── §2 판단트리: 성↔궁 관계 → frame(라벨 + 일상어 설명 + 괴리 밴드). daniel 스펙 문구, 발명 아님 ──
type Frame = { key: string; label: string; desc: string };
function frameOf(d: SpouseDual): Frame {
  const b = d.base;
  if (!d.star) return { key: 'gung_only', label: '실제 인연 중심', desc: '뚜렷한 이상형(배우자성)이 원국에 드러나지 않아요 — 실제로 곁에 남는 사람(일지)이 더 큰 축이에요.' };
  if (b.same || b.sixhe || b.banhap || b.banghap) return { key: 'match', label: '끌림이 곧 결실', desc: '끌리는 이상형과 실제 곁에 남는 사람이 거의 같은 결이에요. 첫 끌림이 그대로 이어지기 쉬워요.' };
  if (b.chong) return { key: 'clash', label: '정면충돌형', desc: '이상형과 실제 배우자가 정면으로 대비돼요. 관계 내내 긴장이 있고, 크게 마음을 정해야 하는 시기가 옵니다.' };
  if (b.wonjin || b.pa) return { key: 'friction', label: '은근한 갈등형', desc: '겉으로는 무난해도 결이 은근히 어긋나, 오래 함께할수록 피로가 쌓이기 쉬워요. 소통 방식을 미리 맞추는 게 처방.' };
  if (b.gyeokgak) return { key: 'split', label: '트랙 분리형', desc: '연애 초반 끌린 상과 결혼까지 가는 상이 다른 결일 수 있어요. 끌림과 정착을 따로 보는 눈이 필요해요.' };
  return { key: 'neutral', label: '뚜렷한 대비 없음', desc: '이상형과 실제 인연 사이에 큰 어긋남 신호는 약해요.' };
}
// 괴리 강도(0~90) = base 발동강도(충90·원진70·파50·격각40·일치0). 높을수록 이상형↔실제 대비 큼(§7.1).
function gapPct(d: SpouseDual): number { return d.star ? Math.min(90, d.base.ignition) : 0; }

// ── §3 세운 라벨 → 일상어(타임라인 마킹·daniel 검수). 한 해에 복수 가능 → 우선순위 하나만 대표 표기 ──
const LABEL_TX: Record<SpouseLabel, string> = {
  EVENT_CANDIDATE: '변곡점',   // 세운이 배우자궁 충 = 결혼/이별/동거 등 큰 변화 가능
  TYPE_A_ACTIVE: '끌림 활성',   // 세운이 배우자성 합 = 그 유형 인연 활성
  TYPE_A_RESOLVE: '인연 정리',  // 세운이 배우자성 충 = 그 유형 인연 이탈
  TYPE_B_SETTLE: '안정 정착',   // 세운이 배우자궁 합 = 안정형으로 무게중심 이동
  CONFIRM: '관계 확정',         // 세운이 배우자궁 복음 = 확정/안정형 진입
};
const LABEL_PRIORITY: SpouseLabel[] = ['EVENT_CANDIDATE', 'CONFIRM', 'TYPE_A_ACTIVE', 'TYPE_A_RESOLVE', 'TYPE_B_SETTLE'];
function primaryLabel(labels: SpouseLabel[]): SpouseLabel | null {
  for (const l of LABEL_PRIORITY) if (labels.includes(l)) return l;
  return null;
}

/**
 * R-SPOUSE-DUAL 무료 카드(스펙 §5) — 결정론·온디바이스·API 0.
 * @param saju        사주 원국(computeChart 결과의 .saju).
 * @param sex         '남'|'여'(배우자성 = 남 재성 / 여 관성). 미상=남 기본(엔진 규칙).
 * @param timeUnknown 시주 미상 여부(시지 제외 판정).
 * @param accent      강조색(애정=핑크 주입, 기본 colors.ju).
 */
export function SpouseDualCards({
  saju,
  sex,
  timeUnknown = false,
  accent = colors.ju,
}: {
  saju: SajuChart;
  sex?: string;
  timeUnknown?: boolean;
  accent?: string;
}) {
  const { t } = useTranslation();
  const [ageOpen, setAgeOpen] = useState(false);

  // 엔진 산출(결정론). timeUnknown 은 analyzeSpouseDual 이 saju 에서 읽으므로 얕은 복사로 주입.
  const d = useMemo<SpouseDual>(
    () => analyzeSpouseDual({ ...(saju as any), timeUnknown } as SajuChart, sex, thisYear(), 8),
    [saju, sex, timeUnknown],
  );

  const frame = frameOf(d);
  const gap = gapPct(d);
  // 타임라인에 뚜렷한 개폐 신호가 있는가(전부 0이면 그래프 대신 안내).
  const hasFlow = d.timeline.some((y) => y.ignition > 0 || y.settle > 0);
  // 나이대 경향 — 차이 미미하면 노출 안 함(§7.3). 육합+30/반합+15 → max 15 이상 & 우열 있을 때만.
  const age = d.age;
  const ageTend = age.elder >= 15 || age.younger >= 15
    ? (age.elder > age.younger ? { tone: '연상 경향', desc: '나보다 나이가 있는(연상) 인연에 마음이 기우는 경향이 있어요.' }
      : age.younger > age.elder ? { tone: '연하·케어 포지션 경향', desc: '연하이거나, 내가 챙겨주는 포지션의 인연에 기우는 경향이 있어요.' }
      : null)
    : null;

  const gapBand = gap === 0 ? '거의 일치'
    : gap <= 40 ? '가벼운 어긋남'
    : gap <= 50 ? '은근한 어긋남'
    : gap <= 70 ? '은근한 긴장'
    : '강한 대비';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.h, { color: colors.ink }]}>{t('spouseDual.title', '이상형과 진짜 인연')}</Text>
      <Text style={styles.sub}>{t('spouseDual.sub', '타고난 배우자 자리를 두 축으로 봐요 — 끌리는 이상형과, 실제로 곁에 남는 사람.')}</Text>

      {/* ① + ② 이원축: 이상형(배우자성) / 실배우자(배우자궁) */}
      <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: accent }]}>
        <View style={styles.axisRow}>
          <View style={styles.axisCol}>
            <Text style={[styles.axisTag, { color: accent }]}>{t('spouseDual.idealTag', '끌리는 이상형')}</Text>
            <Text style={styles.axisDesc}>
              {d.star ? (POS_HINT[d.star.pos] ?? '끌리는 이성상') : '뚜렷한 이상형 신호는 약해요'}
            </Text>
          </View>
          <View style={styles.axisDivider} />
          <View style={styles.axisCol}>
            <Text style={[styles.axisTag, { color: colors.ju }]}>{t('spouseDual.realTag', '진짜 곁에 남는 사람')}</Text>
            <Text style={styles.axisDesc}>{t('spouseDual.realDesc', '결혼생활의 실질 — 늘 최우선인 자리(일지)')}</Text>
          </View>
        </View>
      </View>

      {/* ③ 관계/괴리 — §2 frame + 괴리 강도 바 */}
      <View style={styles.card}>
        <View style={styles.frameHead}>
          <Text style={[styles.frameLabel, { color: accent }]}>{frame.label}</Text>
          {d.star ? <Text style={styles.gapBadge}>{gapBand}</Text> : null}
        </View>
        <Text style={styles.frameDesc}>{frame.desc}</Text>
        {d.star ? (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.max(4, gap)}%`, backgroundColor: accent }]} />
          </View>
        ) : null}
        {d.star ? (
          <View style={styles.barAxis}>
            <Text style={styles.barAxisTx}>{t('spouseDual.match', '일치')}</Text>
            <Text style={styles.barAxisTx}>{t('spouseDual.gap', '대비')}</Text>
          </View>
        ) : null}
      </View>

      {/* ④ 끌림 vs 안정 타임라인(세운) */}
      <View style={styles.card}>
        <Text style={styles.secLabel}>{t('spouseDual.timeline', '끌림 vs 안정 — 인연 흐름')}</Text>
        {hasFlow ? (
          <>
            <TimelineGraph timeline={d.timeline} accent={accent} />
            <View style={styles.legend}>
              <Legend color={accent} tx={t('spouseDual.ignite', '끌림(발동)')} />
              <Legend color={colors.ju} tx={t('spouseDual.settle', '안정(안착)')} />
            </View>
            {d.settleProbability > 0 ? (
              <Text style={styles.prob}>{t('spouseDual.settleProb', { p: d.settleProbability, defaultValue: '첫 발동 이후 안착 확률 약 {{p}}%' })}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.frameDesc}>{t('spouseDual.noFlow', '다음 8년간은 배우자 자리가 크게 열리고 닫히는 신호가 약해요. 큰 변동보다 다지는 시기예요.')}</Text>
        )}
      </View>

      {/* ⑤ 나이대 경향(접이식·순화 톤) — 차이 미미하면 숨김 */}
      {ageTend ? (
        <View style={styles.card}>
          <Pressable style={styles.ageHead} onPress={() => setAgeOpen((v) => !v)}>
            <Text style={styles.secLabel}>{t('spouseDual.ageHint', '나이대 힌트')}</Text>
            <Text style={styles.ageChev}>{ageOpen ? '▾' : '▸'}</Text>
          </Pressable>
          {ageOpen ? (
            <>
              <Text style={[styles.frameLabel, { color: colors.inkSoft, fontSize: 15 }]}>{ageTend.tone}</Text>
              <Text style={styles.frameDesc}>{ageTend.desc}</Text>
              <Text style={styles.ageNote}>{t('spouseDual.ageNote', '※ 경향일 뿐이에요. 실제 상대 사주가 있으면 궁합이 우선해요.')}</Text>
            </>
          ) : null}
        </View>
      ) : null}

      {/* 유료 유도 — 지지별 구체 통변은 아래 유료 리딩 */}
      <Text style={styles.funnel}>{t('spouseDual.funnel', '더 구체적인 이상형·실제 인연·시기 통변은 아래 애정 리딩에서 확인해요.')}</Text>
    </View>
  );
}

// ── ④ 타임라인 2-라인 SVG(끌림 ignition / 안정 settle, 세운별) ─────────────────────────────
//   viewBox 고정 + width 100% 로 반응형. y = ignition/settle(0~90) 매핑, 라벨 있는 해에 점·표기.
function TimelineGraph({ timeline, accent }: { timeline: SpouseYear[]; accent: string }) {
  const W = 320, H = 132, padX = 14, padTop = 16, padBottom = 34;
  const n = timeline.length;
  const innerW = W - padX * 2, innerH = H - padTop - padBottom;
  const MAXV = 90; // ignition 상한(충90). settle(육합80)도 같은 축에 얹어 비교.
  const x = (i: number) => padX + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v: number) => padTop + innerH - (Math.min(v, MAXV) / MAXV) * innerH;
  const pathOf = (pick: (yr: SpouseYear) => number): string =>
    timeline.map((yr, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(pick(yr)).toFixed(1)}`).join(' ');

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* 바닥선 */}
      <SvgLine x1={padX} y1={padTop + innerH} x2={W - padX} y2={padTop + innerH} stroke={colors.line} strokeWidth={1} />
      {/* 안정(settle) — 골드 */}
      <Path d={pathOf((yr) => yr.settle)} fill="none" stroke={colors.ju} strokeWidth={2} strokeOpacity={0.85} strokeLinejoin="round" />
      {/* 끌림(ignition) — accent */}
      <Path d={pathOf((yr) => yr.ignition)} fill="none" stroke={accent} strokeWidth={2.5} strokeLinejoin="round" />
      {timeline.map((yr, i) => {
        const lab = primaryLabel(yr.labels);
        const cy = y(Math.max(yr.ignition, yr.settle));
        return (
          <React.Fragment key={yr.year}>
            {/* 라벨 있는 해 = 강조 점 + 세운 라벨(일상어) */}
            {lab ? <Circle cx={x(i)} cy={cy} r={3.5} fill={accent} /> : <Circle cx={x(i)} cy={cy} r={2} fill={colors.inkFaint} />}
            {lab ? (
              <SvgText x={x(i)} y={cy - 7} fontSize={8.5} fill={colors.ink} textAnchor="middle" fontWeight="700">
                {LABEL_TX[lab]}
              </SvgText>
            ) : null}
            {/* 연도(2년 간격만 표기해 겹침 방지) */}
            {i % 2 === 0 ? (
              <SvgText x={x(i)} y={H - 12} fontSize={9} fill={colors.inkFaint} textAnchor="middle">
                {String(yr.year).slice(2)}
              </SvgText>
            ) : null}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// 범례 점
function Legend({ color, tx }: { color: string; tx: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendTx}>{tx}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(3) },
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },

  // ①② 이원축
  axisRow: { flexDirection: 'row', alignItems: 'stretch' },
  axisCol: { flex: 1 },
  axisDivider: { width: 1, backgroundColor: colors.line, marginHorizontal: space(3) },
  axisTag: { fontSize: 13, fontWeight: '800', marginBottom: space(1) },
  axisDesc: { ...font.body, color: colors.inkSoft, fontSize: 13, lineHeight: 19 },

  // ③ 관계/괴리
  frameHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  frameLabel: { fontSize: 17, fontWeight: '900' },
  gapBadge: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, backgroundColor: colors.sunk, borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(1) },
  frameDesc: { ...font.body, color: colors.ink, fontSize: 14, lineHeight: 22 },
  barTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.sunk, marginTop: space(3), overflow: 'hidden' },
  barFill: { height: 8, borderRadius: radius.pill },
  barAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(1) },
  barAxisTx: { fontSize: 11, color: colors.inkFaint },

  // ④ 타임라인
  secLabel: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: space(2) },
  legend: { flexDirection: 'row', gap: space(4), marginTop: space(2) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTx: { fontSize: 12, color: colors.inkSoft },
  prob: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },

  // ⑤ 나이대
  ageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ageChev: { fontSize: 14, color: colors.inkFaint },
  ageNote: { ...font.caption, color: colors.inkFaint, marginTop: space(2), lineHeight: 17 },

  funnel: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(1), marginBottom: space(2), lineHeight: 18 },
});
