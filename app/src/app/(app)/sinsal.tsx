// src/app/(app)/sinsal.tsx — 신살·공망 전용 화면 라우트 (params → props 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// 명식 화면에서 같은 input(JSON 문자열)을 넘겨 진입. 계산(computeChart)은 화면 내부 온디바이스.
// ─────────────────────────────────────────────────────────────────────────
import { useLocalSearchParams } from 'expo-router';
import { SinsalScreen } from '../../screens/SinsalScreen';
import type { ChartInput } from '@spec/chart';

export default function SinsalRoute() {
  const { input } = useLocalSearchParams<{ input?: string }>();
  const parsed: ChartInput | null = input ? JSON.parse(input) : null;
  return <SinsalScreen input={parsed} />;
}
