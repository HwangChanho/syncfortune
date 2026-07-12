// app/src/components/ScoreFlowGraph.tsx — 운세 점수 흐름 곡선(그제~모레 / 지난달~다음달 등)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-13: 경쟁앱식 '점수 그래프' — 부드러운 곡선 + 현재 지점 강조점 + 점수 버블 + 시기 라벨.
//   점수는 dailyScore(0~100·온디바이스 결정론)로 산출, 여기선 렌더만. MonthFlowGraph 의 SVG 패턴 재사용(신규 네이티브 의존 없음).
//   ★단순 '높으면 좋다'가 아니라 '흐름'을 보여주는 용도 — 오늘/이달 상세·홈에 공용.
// ─────────────────────────────────────────────────────────────────────────
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect, Polygon } from 'react-native-svg';
import { colors } from '../lib/theme';

/** Catmull-Rom → 3차 베지어 스무딩(부드러운 파도 곡선). pts = [[x,y],...] */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length < 2) return '';
  const d: string[] = [`M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`);
  }
  return d.join(' ');
}

/**
 * 점수 흐름 곡선.
 * @param scores 각 지점 점수(0~100)
 * @param labels 각 지점 라벨(그제/어제/오늘/… 또는 월 라벨) — scores 와 길이 동일
 * @param currentIndex 강조(버블)할 현재 지점 인덱스(보통 가운데 = 오늘/이번달)
 */
export function ScoreFlowGraph({ scores, labels, currentIndex, height = 148 }: {
  scores: number[]; labels: string[]; currentIndex: number; height?: number;
}) {
  const W = 320, H = height, padX = 26, padTop = 36, padBottom = 24; // padTop = 점수 버블 공간
  const n = scores.length;
  if (n < 2) return null;
  const x = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX);
  const y = (s: number) => padTop + (1 - Math.max(0, Math.min(100, s)) / 100) * (H - padTop - padBottom);
  const pts = scores.map((s, i) => [x(i), y(s)] as const);
  const line = smoothPath(pts);
  const area = `${line} L ${x(n - 1).toFixed(1)},${(H - padBottom).toFixed(1)} L ${padX.toFixed(1)},${(H - padBottom).toFixed(1)} Z`;
  const ci = Math.max(0, Math.min(n - 1, currentIndex));
  const [cx, cy] = pts[ci];
  const cScore = Math.round(scores[ci]);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="sfg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.ju} stopOpacity={0.32} />
          <Stop offset="1" stopColor={colors.ju} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      {/* 중립선(50점) 점선 */}
      <Line x1={padX} y1={y(50)} x2={W - padX} y2={y(50)} stroke={colors.line} strokeWidth={1} strokeDasharray="3 4" />
      <Path d={area} fill="url(#sfg)" />
      <Path d={line} fill="none" stroke={colors.ju} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* 지점 점 — 현재는 크게(강조), 나머지는 작게 */}
      {pts.map(([px, py], i) => (i === ci
        ? <Circle key={i} cx={px} cy={py} r={6} fill={colors.ju} stroke={colors.card} strokeWidth={3} />
        : <Circle key={i} cx={px} cy={py} r={3} fill={colors.card} stroke={colors.ju} strokeWidth={1.5} />
      ))}
      {/* 현재 지점 점수 버블(가운데 위) + 꼬리 */}
      <Rect x={cx - 19} y={cy - 32} width={38} height={22} rx={7} fill={colors.ju} />
      <Polygon points={`${cx - 4.5},${cy - 10.5} ${cx + 4.5},${cy - 10.5} ${cx},${cy - 4}`} fill={colors.ju} />
      <SvgText x={cx} y={cy - 16.5} fontSize="13" fontWeight="900" fill={colors.bg} textAnchor="middle">{cScore}</SvgText>
      {/* 시기 라벨(하단) — 현재는 골드 강조 */}
      {pts.map(([px], i) => (
        <SvgText key={`l${i}`} x={px} y={H - 5} fontSize="10.5" fill={i === ci ? colors.ju : colors.inkFaint} fontWeight={i === ci ? '800' : '500'} textAnchor="middle">{labels[i] ?? ''}</SvgText>
      ))}
    </Svg>
  );
}
