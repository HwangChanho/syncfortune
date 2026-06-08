// src/app/(app)/myeongsik.tsx — 명식 라우트 (params → props 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// URL 로 받은 input(JSON 문자열)을 파싱해 순수 화면(MyeongsikScreen)에 주입.
// 명식 계산(computeChart)은 화면 내부에서 온디바이스로 수행(PII 기기 잔류).
// ─────────────────────────────────────────────────────────────────────────
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MyeongsikScreen } from '../../screens/MyeongsikScreen';
import type { ChartInput } from '@spec/chart';

export default function MyeongsikRoute() {
  const router = useRouter();
  const { input } = useLocalSearchParams<{ input?: string }>();
  const parsed: ChartInput | null = input ? JSON.parse(input) : null;
  // 명식 → 영역별 풀이 진입(같은 input 전달)
  return (
    <MyeongsikScreen
      input={parsed}
      onReading={() => router.push({ pathname: '/reading', params: { input: input ?? '' } })}
    />
  );
}
