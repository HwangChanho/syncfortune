// src/app/(app)/reading.tsx — 풀이 라우트 (params → props 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// 명식에서 넘어온 input(JSON)을 파싱해 ReadingScreen 에 주입. 무료=온디바이스 구조,
// 유료=LLM 통변(로그인 게이트 → Edge, 프로덕션). 차트는 화면 내 computeChart.
// ─────────────────────────────────────────────────────────────────────────
import { useLocalSearchParams } from 'expo-router';
import { ReadingScreen } from '../../screens/ReadingScreen';
import type { ChartInput } from '@spec/chart';

export default function ReadingRoute() {
  const { input } = useLocalSearchParams<{ input?: string }>();
  const parsed: ChartInput | null = input ? JSON.parse(input) : null;
  return <ReadingScreen input={parsed} />;
}
