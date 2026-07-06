// app/src/components/LifeGraphTeaser.tsx — 인생 그래프(대운 곡선) 무료 온디바이스 티저
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널(모든 유료 콘텐츠 공통): 유료 인생그래프(LLM 해석) 위에 '결정론 곡선'을
//   무료로 먼저 보여준다 → 재회(ReunionRich)/애정(LoveFlowGraph)과 동일 결.
//   · 무료 = 삶의 큰 흐름 곡선 · 오르내림 · 전환점(어디서 오르고 내리는지) — 온디바이스·API 0.
//   · 유료 = 각 시기가 '왜' 그런지 · 지금 무엇을 하면 좋은지 · 전성기 활용법 · 어려운 때 대처(LLM).
//
// ▶ 곡선/전환점은 lib/content/lifeGraph.ts 가 이미 온디바이스로 산출한다(대운별 '용신 부합도' 점수).
//   여기선 그걸 그대로 재사용(재계산 X)하고, 유료 화면(lifegraph.tsx)의 곡선과 같은 결로 그린다.
//   ★화면 텍스트엔 용신/한자/십신 같은 전문 용어를 절대 노출하지 않는다 = 일상어(오르내림·전환점·전성기·다지는 때).
//   ★곡선 가중치·희기신 매핑은 lifeGraph.ts 의 daniel 검수 stance(대운 지지 우위 · R2 5분류 대칭 ±3)를 그대로 따른다(여기서 재계산·발명 X).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { lifeGraph } from '../lib/content/lifeGraph'; // 결정론 곡선(대운별 점수·전환점) — 재사용만, 재계산 X
import type { SajuChart } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';

const APolyline = Animated.createAnimatedComponent(Polyline); // 곡선 드로잉 애니(strokeDashoffset — 네이티브 드라이버 미지원)
const CAUTION_RED = '#E5484D'; // 다지고 조심할 전환점(하강) — lifegraph.tsx 유료 곡선과 동일 색

// 차트 폭 = 화면폭 − 화면 좌우여백(wrap space6) − 카드 좌우패딩(space5). 유료 곡선(lifegraph.tsx)과 동일 계산 결.
const CHART_W = Dimensions.get('window').width - space(6) * 2 - space(5) * 2;
const CHART_H = 150;            // 곡선 높이
const PAD = 0.12;               // 위아래 여백(점·라벨 안 잘리게) — 진폭을 이 만큼 남기고 stretch
const clamp01 = (s: number) => Math.max(0, Math.min(100, s)); // 점수 0~100 클램프

/**
 * 인생 그래프 무료 티저. lifegraph.tsx 잠김(미결제) 상태에서 히어로 아래·게이트 위에 노출.
 * @param saju 대표 명식의 사주(원국 + 대운 + structure.usefulGod). computeChart 산출값.
 */
export function LifeGraphTeaser({ saju }: { saju: SajuChart }) {
  const draw = useRef(new Animated.Value(0)).current; // 곡선 드로잉 진행값(0→1)

  // ── 결정론 곡선 산출(재사용) — 대운별 점수·전환점·현재위치. saju 바뀔 때만 1회 계산 ──
  const g = useMemo(() => lifeGraph(saju), [saju]);
  const points = g.points;
  const n = points.length;

  // ── 좌표(진폭 확대) — 유료 곡선과 동일 방식: 보이는 min~max 를 위아래로 stretch 해 밋밋함 방지 ──
  const derived = useMemo(() => {
    const vals = points.map((p) => clamp01(p.score));
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 100;
    const flat = hi <= lo; // 전 대운 점수 동일(평탄) — 전성기/전환점 특정 불가
    const normY = (s: number) => (hi > lo ? (s - lo) / (hi - lo) : 0.5);

    const pts = points.map((p, i) => {
      // 직전 대운 대비 상승/하강(전환점 색·방향 판정)
      const prevScore = i > 0 ? clamp01(points[i - 1].score) : clamp01(p.score);
      const up = clamp01(p.score) >= prevScore;
      return {
        x: n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W,
        y: CHART_H - (PAD + normY(clamp01(p.score)) * (1 - 2 * PAD)) * CHART_H,
        p, i, up,
      };
    });
    const polyline = pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
    // 드로잉 dash 기준 = 곡선 총 길이(점 사이 거리 합)
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);

    // ── 무료 하이라이트(일상어) — 전부 곡선에서 유도. 용신/한자 노출 없이 '흐름'만 짚는다 ──
    const cur = points.find((p) => p.current) ?? null;                 // 지금 나이의 대운
    const peak = flat ? null : points.reduce((a, b) => (b.score > a.score ? b : a)); // 가장 높이 오르는 때
    const turningCount = points.filter((p) => p.turning).length;       // 삶의 방향이 크게 바뀌는 전환점 수

    // 지금 흐름 라벨(전향적·§4 웰빙 가드 — 낮은 구간도 '다지며 준비'로 긍정 프레이밍, 처방은 유료로 위임)
    const curLabel = cur
      ? (() => {
          const h = normY(clamp01(cur.score)); // 곡선 내 상대 높이 0~1
          if (h >= 0.66) return '기운이 차오르며 올라서는 흐름이에요';
          if (h >= 0.34) return '큰 기복 없이 고르게 흐르는 때예요';
          return '힘을 안으로 다지며 다음을 준비하는 흐름이에요';
        })()
      : null;

    return { pts, polyline, len: Math.max(len, 1), flat, cur, peak, turningCount, curLabel };
  }, [points, n]);

  // 마운트 시 곡선이 좌→우로 그려지는 애니(0→1). strokeDashoffset 이라 useNativeDriver:false.
  useEffect(() => {
    draw.setValue(0);
    Animated.timing(draw, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [draw, derived.polyline]);

  if (n < 3) return null; // 대운 정보 부족(아주 드문 케이스) — 티저 생략(LoveFlowGraph 동일 가드)

  const { pts, polyline, len, flat, cur, peak, turningCount, curLabel } = derived;

  return (
    <View style={styles.wrap}>
      {/* 리드(일상어) — 무엇을 보여주는지 한 줄 + 유도 */}
      <Text style={styles.lead}>당신 삶의 큰 흐름 곡선이에요</Text>
      <Text style={styles.leadSub}>오르내림과 전환점을 미리 그려 봤어요. 각 시기의 자세한 이야기는 아래에서 열 수 있어요.</Text>

      {/* 곡선 카드 — 유료 곡선과 같은 결(기준선·드로잉·현재 마커·전환점 강조) */}
      <View style={styles.chartCard}>
        <Svg width={CHART_W} height={CHART_H + 22}>
          {/* 중앙 기준선(점선) */}
          <Line x1={0} y1={CHART_H / 2} x2={CHART_W} y2={CHART_H / 2} stroke={colors.line} strokeWidth={1} strokeDasharray="4 4" />
          {/* 곡선(좌→우 드로잉) */}
          <APolyline
            points={polyline} fill="none" stroke={colors.ju} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [len, 0] })}
          />
          {/* 대운 점 — 전환점=큼(상승 금색/하강 붉은색) · 현재=테두리만(빈 점) · 그 외=작은 금색 */}
          {pts.map((q) => {
            const turning = q.p.turning;
            const fill = q.p.current ? colors.bg : turning ? (q.up ? colors.ju : CAUTION_RED) : colors.ju;
            const stroke = q.p.current ? colors.ju : turning && !q.up ? CAUTION_RED : colors.ju;
            return (
              <Circle key={q.i} cx={q.x} cy={q.y} r={q.p.current ? 6 : turning ? 7 : 4.5}
                fill={fill} stroke={stroke} strokeWidth={q.p.current ? 3 : 1} />
            );
          })}
          {/* 나이 라벨 — 점 x 위치 기준 중앙정렬(양끝은 클리핑 방지로 start/end). 현재=굵은 금색 */}
          {pts.map((q) => (
            <SvgText key={`age-${q.i}`} x={q.x} y={CHART_H + 15}
              fontSize={10} fontWeight={q.p.current ? '800' : '400'}
              fill={q.p.current ? colors.ju : colors.inkFaint}
              textAnchor={q.i === 0 ? 'start' : q.i === n - 1 ? 'end' : 'middle'}>{q.p.startAge}</SvgText>
          ))}
        </Svg>
        {/* 범례(일상어 — 한자/용어 없음) */}
        <Text style={styles.legend}>
          큰 금색 점 = 올라서는 전환점 · 큰 붉은 점 = 다지고 조심할 전환점 · 테두리만 있는 점 = 지금 나이
        </Text>
      </View>

      {/* 무료 하이라이트 — 곡선에서 바로 읽히는 '흐름'만(왜·무엇은 유료) */}
      <View style={styles.hlCard}>
        {curLabel ? (
          <View style={styles.hlRow}>
            <Text style={styles.hlLabel}>지금 흐름</Text>
            <Text style={styles.hlValue}>{cur ? `${cur.startAge}~${cur.endAge}세 · ` : ''}{curLabel}</Text>
          </View>
        ) : null}
        {peak ? (
          <View style={styles.hlRow}>
            <Text style={styles.hlLabel}>가장 빛나는 때</Text>
            <Text style={styles.hlValue}>{peak.startAge}~{peak.endAge}세 무렵</Text>
          </View>
        ) : null}
        <View style={[styles.hlRow, styles.hlRowLast]}>
          <Text style={styles.hlLabel}>큰 전환점</Text>
          <Text style={styles.hlValue}>{flat ? '비교적 고른 흐름이에요' : turningCount > 0 ? `삶의 방향이 크게 바뀌는 지점 ${turningCount}곳` : '완만하게 이어지는 흐름'}</Text>
        </View>
      </View>

      {/* ── 무료 vs 유료 가치 명시(퍼널 훅) — 곧바로 아래 게이트(₩3,900 CTA)로 이어진다 ── */}
      <View style={styles.funnelCard}>
        <Text style={styles.funnelLine}>무료로는 <Text style={styles.accent}>삶의 큰 흐름과 전환점</Text>을 곡선으로 볼 수 있어요.</Text>
        <Text style={styles.funnelLine}>깊은 풀이에선 <Text style={styles.accent}>각 시기가 왜 그런지, 지금 무엇을 하면 좋은지, 전성기 활용법과 어려운 때 대처법</Text>까지 짚어 드려요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  // 리드
  lead: { ...font.body, fontWeight: '800', color: colors.ju, fontSize: 16, marginBottom: space(1.5) },
  leadSub: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(3), fontSize: 12 },
  // 곡선 카드(유료 chartCard 와 동일 결)
  chartCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3) },
  legend: { ...font.caption, color: colors.inkFaint, fontSize: 10.5, lineHeight: 15, marginTop: space(2.5), textAlign: 'center' },
  // 하이라이트(라벨:값 줄)
  hlCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(3) },
  hlRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: space(1.5), borderBottomWidth: 1, borderBottomColor: colors.line },
  hlRowLast: { borderBottomWidth: 0 },
  hlLabel: { ...font.caption, color: colors.inkFaint, fontSize: 12, width: 92 }, // 라벨 고정폭 → 값 정렬
  hlValue: { ...font.body, color: colors.ink, fontSize: 13.5, fontWeight: '700', flex: 1, lineHeight: 19 },
  // 퍼널 가치 명시
  funnelCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4) },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
  accent: { color: colors.ju, fontWeight: '800' },
});
