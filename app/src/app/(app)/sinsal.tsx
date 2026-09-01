// src/app/(app)/sinsal.tsx — 신살·공망 전용 화면 라우트 (params → props 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// 명식 화면에서 같은 input(JSON 문자열)을 넘겨 진입. 계산(computeChart)은 화면 내부 온디바이스.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { loadMyChart } from '../../lib/engine/myChart';   // 파라미터가 없을 때 기댈 곳(막다른 길 방지)
import { SinsalScreen } from '../../screens/SinsalScreen';
import type { ChartInput } from '@spec/chart';

export default function SinsalRoute() {
  const { input } = useLocalSearchParams<{ input?: string }>();
  /**
   * ★파라미터 없이 들어와도 **막다른 길이 되지 않게** 대표 명식으로 떨어진다
   *   (2026-09-02 — 종전엔 「명식 정보가 없습니다」 한 줄뿐이고 누를 것이 없었다).
   *   `myeongsik.tsx` 와 **같은 처리**다 — 한쪽만 고치면 다른 쪽이 그대로 남는다.
   */
  const [fallback, setFallback] = useState<ChartInput | null>(null);
  useEffect(() => {
    if (input) return;
    let alive = true;
    void loadMyChart().then((c) => { if (alive) setFallback(c); });
    return () => { alive = false; };
  }, [input]);
  const parsed: ChartInput | null = input ? JSON.parse(input) : fallback;
  return <SinsalScreen input={parsed} />;
}
