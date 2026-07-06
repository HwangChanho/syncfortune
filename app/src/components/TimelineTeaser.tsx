// app/src/components/TimelineTeaser.tsx — 인생 타임라인(대운 흐름) 무료 온디바이스 티저
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널(모든 유료 콘텐츠 공통): 유료 타임라인(연도별 LLM 풀이) '위'에
//   결정론 '대운 흐름 스트립'을 무료로 먼저 보여준다 → 재회(ReunionRich)/애정(LoveFlowGraph)/
//   인생그래프(LifeGraphTeaser)와 동일 결. 온디바이스·API 0(Anthropic 호출 없음).
//   · 무료 = 인생의 큰 챕터(대운) 나열 · 지금 어디쯤인지(현재 대운 강조) · 각 챕터의 오르내림 흐름.
//   · 유료 = 각 시기가 '어떤 국면'인지 · 언제 무엇을 하면 좋은지 · 연도별 풀이(LLM, 아래 카드).
//
// ▶ 데이터: saju.luckCycles(대운 목록·스펙 계약) 그대로 재사용(재계산 X). 현재 대운 = saju.currentLuck.
//   각 대운의 오르내림(오름/고름/다짐)은 lib/content/lifeGraph(대운별 용신 부합 점수)를 '읽기 전용'으로
//   재사용해 유도한다(명리 발명 아님 — daniel 검수 가중치). lifeGraph 산출이 없으면 화살표 없이 순서+현재만.
//   ★화면 텍스트엔 한자/십신/간지 절대 노출 금지 = 일상어(챕터·오름·고름·다짐·지금 여기).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { lifeGraph } from '../lib/content/lifeGraph'; // 대운별 흐름 점수(읽기 전용 재사용 — 재계산·발명 X)
import type { SajuChart } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';

const SCREEN_W = Dimensions.get('window').width;
const COL_W = 78;          // 대운 한 칸(스테이션) 고정 폭 — 가로 스크롤 오프셋·정렬 기준
const AGE_CAP = 100;       // 이 나이 이후 시작 대운은 생략(과도한 노령 구간 컷 — 스트립 간결화)
const CAUTION = '#E5484D'; // 다지고 조심할 흐름(하강) — LifeGraphTeaser와 동일 색

type Flow = 'up' | 'flat' | 'down'; // 대운 흐름: 오름 / 고름 / 다짐(하강)

/**
 * 인생 타임라인 무료 티저. 유료 타임라인 화면(TimelineScreen) 상단, 유료 카드 '위'에 노출.
 * @param saju 대표(또는 선택) 명식의 사주 — computeChart 산출값(luckCycles·currentLuck 포함).
 */
export function TimelineTeaser({ saju }: { saju: SajuChart }) {
  const scrollRef = useRef<ScrollView>(null);
  const glow = useRef(new Animated.Value(0.35)).current; // 현재 대운 은은한 글로우 펄스

  // 모든 결정론 값은 saju 변경 시에만 1회 산출(성능·단일 소스).
  const d = useMemo(() => {
    // ① 대운 목록(스펙 계약) — 시작나이 오름차순, 노령 상한 컷. 재계산 없이 그대로 사용.
    const cycles = (saju.luckCycles ?? [])
      .filter((lc) => lc.startAge <= AGE_CAP)
      .slice()
      .sort((a, b) => a.startAge - b.startAge);
    if (cycles.length < 2) return null; // 여정을 그릴 대운이 부족 → 티저 생략(LifeGraphTeaser 동일 가드)

    // ② 현재 대운 시작나이 — 강조 기준(lifeGraph의 current 판정과 동일 소스).
    const curStart = saju.currentLuck?.startAge;

    // ③ 대운별 흐름 점수(읽기 전용 재사용). 실패/부재 시 화살표 생략(순서+현재만 표시).
    const scoreByAge = new Map<number, number>();
    try {
      lifeGraph(saju).points.forEach((p) => scoreByAge.set(p.startAge, p.score));
    } catch {
      /* 흐름 점수 산출 실패 = 화살표 없이 표시(치명적 아님 — 순서+현재 마커는 유지) */
    }
    const scores = cycles.map((lc) => scoreByAge.get(lc.startAge));
    const known = scores.filter((s): s is number => typeof s === 'number');
    const min = known.length ? Math.min(...known) : 0;
    const max = known.length ? Math.max(...known) : 0;

    // ④ 각 대운 노드 구성 — 나이범위·현재여부·직전 대비 흐름(오름/고름/다짐).
    const DEAD = 5; // 인접 대운 점수 변화 데드밴드(±5 이내 = 고름)
    const nodes = cycles.map((lc, i) => {
      const s = scores[i];
      const prev = i > 0 ? scores[i - 1] : undefined;
      let flow: Flow = 'flat';
      if (typeof s === 'number' && typeof prev === 'number') {
        flow = s - prev >= DEAD ? 'up' : s - prev <= -DEAD ? 'down' : 'flat';
      }
      return {
        startAge: lc.startAge,
        label: `${lc.startAge}~${lc.startAge + 9}세`,
        current: curStart != null && lc.startAge === curStart,
        flow,
      };
    });
    const curIdx = nodes.findIndex((x) => x.current);

    // ⑤ 현재 흐름 한 줄(전향적·§4 웰빙 가드 — 낮은 구간도 '다지며 준비'로 긍정 프레이밍, 처방은 유료 위임).
    //    현재 대운의 상대 높이(전 대운 중)로 판단. 점수 없거나 평탄하면 생략.
    const curScore = curIdx >= 0 ? scores[curIdx] : undefined;
    const curLine = typeof curScore === 'number' && max > min
      ? (() => {
          const h = (curScore - min) / (max - min); // 0~1 상대 높이
          if (h >= 0.66) return '지금은 기운이 차오르며 올라서는 흐름이에요.';
          if (h >= 0.34) return '지금은 큰 기복 없이 고르게 흐르는 때예요.';
          return '지금은 힘을 안으로 다지며 다음을 준비하는 흐름이에요.';
        })()
      : null;

    return { nodes, curIdx, curLine, hasFlow: known.length > 0 };
  }, [saju]);

  // 가로 스크롤을 현재 대운이 가운데 오도록 이동(맨 앞이 아닌 '지금'으로, daniel 결 — picker 스크롤과 동일 취지).
  useEffect(() => {
    if (!d || d.curIdx < 0) return;
    const x = Math.max(0, d.curIdx * COL_W - SCREEN_W / 2 + COL_W / 2);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ x, animated: false }), 80);
    return () => clearTimeout(id);
  }, [d]);

  // 현재 대운 글로우 펄스(은은하게) — opacity 왕복(네이티브 드라이버). PossibilityGauge 열림 글로우와 동일 결.
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.85, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.3, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow]);

  if (!d) return null;
  const { nodes, curIdx, curLine, hasFlow } = d;
  const n = nodes.length;

  // 흐름 글리프(일상어·화살표) — 한자/용어 없음. 고름은 작은 점(·).
  const glyphOf = (f: Flow) => (f === 'up' ? '↗' : f === 'down' ? '↘' : '·');
  const glyphColor = (f: Flow) => (f === 'up' ? colors.ju : f === 'down' ? CAUTION : colors.inkFaint);

  return (
    <View style={styles.wrap}>
      {/* 리드(일상어) — 무엇을 보여주는지 + 지금 위치 훅 */}
      <Text style={styles.lead}>당신 인생의 큰 챕터들</Text>
      <Text style={styles.leadSub}>지금 어디쯤 지나고 있는지, 큰 흐름을 미리 그려 봤어요.</Text>

      {/* 대운 흐름 스트립(가로 스크롤 — 현재 대운 강조) */}
      <View style={styles.stripCard}>
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {nodes.map((node, i) => {
            // 스테이션 점: 현재=금색+글로우 / 지난 챕터=채운 회색점 / 다가올 챕터=테두리만.
            const dotStyle = node.current ? styles.dotCur : (curIdx >= 0 && i < curIdx ? styles.dotPast : styles.dotFuture);
            return (
              <View key={node.startAge} style={styles.col}>
                {/* 위: 흐름 글리프(점수 있을 때만 표시 — 없으면 빈 자리 유지로 정렬 보존) */}
                <Text style={[styles.glyph, { color: glyphColor(node.flow) }]}>{hasFlow ? glyphOf(node.flow) : ' '}</Text>
                {/* 가운데: 연결선(좌/우 세그먼트) + 스테이션 점 */}
                <View style={styles.nodeRow}>
                  <View style={[styles.seg, i === 0 && styles.segHidden]} />
                  <View style={styles.dotWrap}>
                    {node.current && <Animated.View style={[styles.dotGlow, { opacity: glow }]} />}
                    <View style={[styles.dot, dotStyle]} />
                  </View>
                  <View style={[styles.seg, i === n - 1 && styles.segHidden]} />
                </View>
                {/* 아래: 나이 범위(현재=금색 굵게) */}
                <Text style={[styles.age, node.current && styles.ageCur]}>{node.label}</Text>
                {/* '지금 여기' 배지 슬롯(고정 높이로 전 칸 정렬) */}
                <View style={styles.badgeSlot}>{node.current ? <Text style={styles.nowBadge}>지금 여기</Text> : null}</View>
              </View>
            );
          })}
        </ScrollView>
        {/* 범례(일상어) — 흐름 화살표 뜻(점수 있을 때만). 고름(·)은 자명해 생략. */}
        <Text style={styles.legend}>
          {hasFlow
            ? '↗ 올라서는 흐름 · ↘ 다지고 조심할 때 · 금색 점 = 지금 지나는 챕터'
            : '금색 점 = 지금 지나고 있는 챕터예요'}
        </Text>
      </View>

      {/* 현재 흐름 한 줄(전향적) — 곡선 없이도 '지금 느낌'을 무료로 한 줄 */}
      {curLine ? (
        <View style={styles.nowCard}>
          <Text style={styles.nowLabel}>지금 흐름</Text>
          <Text style={styles.nowText}>{curLine}</Text>
        </View>
      ) : null}

      {/* ── 무료 vs 유료 가치 명시(퍼널 훅) — 곧바로 아래 연도별 유료 풀이 카드로 이어진다 ── */}
      <View style={styles.funnelCard}>
        <Text style={styles.funnelLine}>무료로는 <Text style={styles.accent}>인생의 큰 챕터와 지금 위치</Text>를 볼 수 있어요.</Text>
        <Text style={styles.funnelLine}>깊은 풀이에선 <Text style={styles.accent}>각 시기가 어떤 국면인지, 언제 무엇을 하면 좋은지</Text>를 연도별로 짚어 드려요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  // 리드(LifeGraphTeaser와 동일 결)
  lead: { ...font.body, fontWeight: '800', color: colors.ju, fontSize: 16, marginBottom: space(1.5) },
  leadSub: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(3), fontSize: 12 },
  // 스트립 카드(유료 chartCard와 동일 결 — 카드 배경·라운드·금선)
  stripCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(4), paddingHorizontal: space(2), marginBottom: space(3) },
  strip: { paddingHorizontal: space(2), alignItems: 'flex-start' },
  // 대운 한 칸(스테이션) — 세로 스택 고정 높이로 점들이 수평 정렬
  col: { width: COL_W, alignItems: 'center' },
  glyph: { height: 18, lineHeight: 18, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  // 노드 행: [좌 세그][점][우 세그] — 인접 칸 세그먼트가 이어져 연속선처럼 보인다.
  nodeRow: { height: 26, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  seg: { flex: 1, height: 2, backgroundColor: colors.juLine },
  segHidden: { opacity: 0 }, // 첫/끝 칸의 바깥쪽 선만 숨김(레이아웃 유지 → 점 중앙 정렬 보존)
  dotWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  dotGlow: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ju }, // 현재 대운 글로우(펄스)
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.juLine },
  dotPast: { backgroundColor: colors.inkFaint },                                   // 지난 챕터 = 채운 회색점
  dotFuture: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.juLine }, // 다가올 챕터 = 테두리만
  dotCur: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: colors.ju, borderWidth: 2, borderColor: colors.bg }, // 현재 = 큰 금색점
  // 나이 라벨(현재=금색 굵게)
  age: { ...font.caption, color: colors.inkFaint, fontSize: 11, marginTop: space(1.5), textAlign: 'center' },
  ageCur: { color: colors.ju, fontWeight: '800' },
  badgeSlot: { height: 16, justifyContent: 'center' },
  nowBadge: { fontSize: 10, fontWeight: '900', color: colors.badgeGold, letterSpacing: 0.3 },
  legend: { ...font.caption, color: colors.inkFaint, fontSize: 10.5, lineHeight: 15, marginTop: space(3), textAlign: 'center' },
  // 현재 흐름 한 줄(라벨:값)
  nowCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(3) },
  nowLabel: { ...font.caption, color: colors.inkFaint, fontSize: 12, marginBottom: space(1) },
  nowText: { ...font.body, color: colors.ink, fontSize: 13.5, fontWeight: '700', lineHeight: 20 },
  // 퍼널 가치 명시(LifeGraphTeaser와 동일 결)
  funnelCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4) },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
  accent: { color: colors.ju, fontWeight: '800' },
});
