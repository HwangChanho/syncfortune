// app/src/components/MonthFlowGraph.tsx — 12개월 흐름 곡선(SVG) 공용 컴포넌트
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-08: 신년 신수 티저(전체 흐름) + 신년 카테고리별 흐름(재물·애정 등) 공유.
//   NewyearTeaser 의 MonthGraph 를 추출 — 단일 소스(DRY). scores = 월별 방향점수(−4~+4), 중립선 0 중앙.
//   goodSet(선택) = 강조할 달(1~12) 금색 점. 없으면 곡선/작은 점만.
// ─────────────────────────────────────────────────────────────────────────
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { colors } from '../lib/theme';

/**
 * 12개월 방향점수 곡선. 중립선(0) 기준 위=길·아래=흉. §4 웰빙: 낮은 달도 흉 단정 아님(관리축 흐름).
 * @param scores 1~12월 방향점수(−4~+4). 2개 미만이면 렌더 생략.
 * @param goodSet 강조할 달(1~12) — 금색 큰 점. 미전달 시 강조 없음.
 * @param height 그래프 높이(기본 116).
 */
export function MonthFlowGraph({ scores, goodSet, height = 116 }: { scores: number[]; goodSet?: Set<number>; height?: number }) {
  const W = 320, H = height, padX = 16, padY = 14;
  const n = scores.length;
  if (n < 2) return null;
  const good = goodSet ?? new Set<number>();
  const x = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX);
  const y = (md: number) => padY + (1 - (md + 4) / 8) * (H - 2 * padY); // +4=위 / −4=아래 / 0=중앙(중립선)
  const pts = scores.map((md, i) => [x(i), y(md)] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)},${(H - padY).toFixed(1)} L ${padX.toFixed(1)},${(H - padY).toFixed(1)} Z`;
  const y0 = y(0);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="mfg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.ju} stopOpacity={0.34} />
          <Stop offset="1" stopColor={colors.ju} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Line x1={padX} y1={y0} x2={W - padX} y2={y0} stroke={colors.line} strokeWidth={1} strokeDasharray="3 4" />
      <Path d={area} fill="url(#mfg)" />
      <Path d={line} fill="none" stroke={colors.ju} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([px, py], i) => {
        const g = good.has(i + 1);
        return <Circle key={i} cx={px} cy={py} r={g ? 5 : 2.5} fill={g ? colors.ju : colors.card} stroke={colors.ju} strokeWidth={g ? 0 : 1.5} />;
      })}
      {pts.map(([px], i) => (
        <SvgText key={`t${i}`} x={px} y={H - 2} fontSize="9" fill={good.has(i + 1) ? colors.ju : colors.inkFaint} fontWeight={good.has(i + 1) ? '800' : '500'} textAnchor="middle">{i + 1}</SvgText>
      ))}
    </Svg>
  );
}
