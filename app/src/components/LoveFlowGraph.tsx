// app/src/components/LoveFlowGraph.tsx — 애정(재성) 흐름 곡선(시기별)
// ─────────────────────────────────────────────────────────────────────────
// daniel B + R29(사랑방식=재성 12운성): 일간의 재성(정재) 천간이 각 *대운 지지*에서 갖는
//   12운성 강도를 시기(나이)별로 이어 '애정 에너지 흐름' 곡선으로. 결정론(엔진 twelveStage)·API 0.
//   ★12운성 강도값·정/편재 선택 = 표준 통설 기본값(daniel 검수 슬롯 — 발명 아님, 엔진+텍스트북).
//   곡선은 마운트 시 좌→우로 그려짐(strokeDashoffset). 현재 대운 지점 강조.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { twelveStage, type TwelveStage } from '@engine/twelve';
import { tenGod } from '@engine/saju';
import type { SajuChart, Stem } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ALL_STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
// 12운성 표준 에너지 강도(1~10) — 텍스트북 통설(제왕 최강·절 최약). ★daniel 검수 가능.
const STAGE_STR: Record<TwelveStage, number> = { 장생: 7, 목욕: 5, 관대: 8, 건록: 9, 제왕: 10, 쇠: 6, 병: 4, 사: 3, 묘: 2, 절: 1, 태: 3, 양: 5 };
const LOVE_PINK = '#E5749B';

export function LoveFlowGraph({ saju }: { saju: SajuChart }) {
  const dash = useRef(new Animated.Value(0)).current;
  const dm = saju.dayMaster.stem;
  // 일간의 정재 천간(안정적 애정·배우자축 — daniel★ 정/편재). 없으면 편재 폴백.
  const jaeStem = ALL_STEMS.find((s) => tenGod(dm, s) === '정재') ?? ALL_STEMS.find((s) => tenGod(dm, s) === '편재') ?? dm;
  const cycles = (saju.luckCycles ?? []).slice(0, 9); // 대운 ~9개(약 80세까지)
  const curAge = saju.currentLuck?.startAge;

  const W = 300, H = 150, padL = 14, padR = 14, padT = 16, padB = 26;
  const pts = cycles.map((c, i) => {
    const stage = twelveStage(jaeStem, c.branch);
    const v = STAGE_STR[stage] ?? 5;
    const x = padL + (i * (W - padL - padR)) / Math.max(1, cycles.length - 1);
    const y = H - padB - ((v - 1) / 9) * (H - padT - padB);
    return { x, y, age: c.startAge, stage, cur: c.startAge === curAge };
  });
  // 경로 + 길이(드로잉 애니용)
  let d = '', len = 0;
  pts.forEach((p, i) => { d += i === 0 ? `M${p.x},${p.y}` : ` L${p.x},${p.y}`; if (i > 0) { const dx = p.x - pts[i - 1].x, dy = p.y - pts[i - 1].y; len += Math.sqrt(dx * dx + dy * dy); } });

  useEffect(() => {
    dash.setValue(0);
    Animated.timing(dash, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [dash, d]);
  const offset = dash.interpolate({ inputRange: [0, 1], outputRange: [len, 0] });

  if (cycles.length < 3) return null; // 대운 부족 시 미표시

  return (
    <View style={styles.box}>
      <Text style={styles.title}>애정 에너지 흐름 <Text style={styles.titleSub}>(재성 12운성 · 대운별)</Text></Text>
      <Svg width={W} height={H} style={{ alignSelf: 'center' }}>
        {/* 기준 점선(중간) */}
        <Line x1={padL} y1={H - padB - ((5 - 1) / 9) * (H - padT - padB)} x2={W - padR} y2={H - padB - ((5 - 1) / 9) * (H - padT - padB)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        {/* 곡선(좌→우 드로잉) */}
        <AnimatedPath d={d} stroke={LOVE_PINK} strokeWidth={2.5} fill="none" strokeDasharray={len} strokeDashoffset={offset} strokeLinejoin="round" strokeLinecap="round" />
        {/* 대운 점 + 나이 + 현재 강조 */}
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={p.cur ? 5 : 3} fill={p.cur ? '#E9C77B' : LOVE_PINK} stroke={p.cur ? '#fff' : 'none'} strokeWidth={p.cur ? 1.5 : 0} />
        ))}
        {pts.map((p, i) => (
          <SvgText key={`a${i}`} x={p.x} y={H - 8} fontSize={9} fill={p.cur ? '#E9C77B' : 'rgba(230,220,245,0.5)'} textAnchor="middle">{p.age}</SvgText>
        ))}
      </Svg>
      <Text style={styles.note}>※ 점이 높을수록 재성(애정星) 기운이 강한 시기. 노란 점 = 현재 대운.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  title: { ...font.body, fontWeight: '800', color: LOVE_PINK, marginBottom: space(2), fontSize: 14 },
  titleSub: { ...font.caption, color: colors.inkFaint, fontWeight: '600' },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(2), textAlign: 'center', fontSize: 11 },
});
