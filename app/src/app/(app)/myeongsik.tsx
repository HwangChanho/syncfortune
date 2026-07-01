// src/app/(app)/myeongsik.tsx — 명식 라우트 (params → props 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// URL 로 받은 input(JSON 문자열)을 파싱해 순수 화면(MyeongsikScreen)에 주입.
// 명식 계산(computeChart)은 화면 내부에서 온디바이스로 수행(PII 기기 잔류).
// ─────────────────────────────────────────────────────────────────────────
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MyeongsikScreen } from '../../screens/MyeongsikScreen';
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 끝난 뒤 MyeongsikScreen 마운트(멈칫 제거)
import { ChartSkeleton } from '../../components/Skeleton';
import type { ChartInput } from '@spec/chart';

export default function MyeongsikRoute() {
  const router = useRouter();
  const { input } = useLocalSearchParams<{ input?: string }>();
  const ready = useDeferredReady();
  // ★전환 멈칫 제거는 *래퍼*가 마운트를 늦춰 담당 — MyeongsikScreen 내부 조기 return 금지(hook 수 불변).
  if (!ready) return <ChartSkeleton />;
  const parsed: ChartInput | null = input ? JSON.parse(input) : null;
  // 명식 → 영역별 풀이 / 신살·공망 전용 화면 진입(같은 input 전달)
  return (
    <MyeongsikScreen
      input={parsed}
      onReading={() => router.push({ pathname: '/reading', params: { input: input ?? '' } })}
      onSinsal={() => router.push({ pathname: '/sinsal', params: { input: input ?? '' } })}
    />
  );
}
