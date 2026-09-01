// src/app/(app)/myeongsik.tsx — 명식 라우트 (params → props 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// URL 로 받은 input(JSON 문자열)을 파싱해 순수 화면(MyeongsikScreen)에 주입.
// 명식 계산(computeChart)은 화면 내부에서 온디바이스로 수행(PII 기기 잔류).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { loadMyChart } from '../../lib/engine/myChart';   // 파라미터가 없을 때 기댈 곳(막다른 길 방지)
import { MyeongsikScreen } from '../../screens/MyeongsikScreen';
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 끝난 뒤 MyeongsikScreen 마운트(멈칫 제거)
import { ChartSkeleton } from '../../components/Skeleton';
import type { ChartInput } from '@spec/chart';

export default function MyeongsikRoute() {
  const router = useRouter();
  const { input } = useLocalSearchParams<{ input?: string }>();
  const ready = useDeferredReady();
  /**
   * ★★파라미터가 없으면 **대표 명식으로 떨어진다** (2026-09-02 전 화면 순회에서 발견).
   *
   * ■ 이 화면은 만세력에서 `?input=…` 을 들고 들어오는 자리다. 그런데 사용자는
   *   **새로고침·딥링크·뒤로가기**로 파라미터 없이 여기 설 수 있다. 그때 종전엔
   *   「차트 정보가 없습니다」 **한 줄만** 뜨고 **누를 것이 하나도 없었다** = 막다른 길.
   * ■ ⇒ 저장된 대표 명식을 읽어 그걸 보여 준다. 그것도 없으면 종전대로 빈 화면
   *   (그 사람은 정말 명식이 없는 것이고, 그 화면엔 «등록» 안내가 있다).
   * ■ ⚠️훅은 **조기 return 위**에 있어야 한다 — 아래로 내리면 훅 수가 갈려 화면이 통째로 죽는다.
   */
  const [fallback, setFallback] = useState<ChartInput | null>(null);
  useEffect(() => {
    if (input) return;                       // 들고 온 것이 있으면 저장된 것을 읽지 않는다
    let alive = true;
    void loadMyChart().then((c) => { if (alive) setFallback(c); });
    return () => { alive = false; };
  }, [input]);
  // ★전환 멈칫 제거는 *래퍼*가 마운트를 늦춰 담당 — MyeongsikScreen 내부 조기 return 금지(hook 수 불변).
  if (!ready) return <ChartSkeleton />;
  const parsed: ChartInput | null = input ? JSON.parse(input) : fallback;
  // 명식 → 영역별 풀이 / 신살·공망 전용 화면 진입(같은 input 전달)
  return (
    <MyeongsikScreen
      input={parsed}
      // ⚠️★`push` — 자미 풀이를 먼저 본 뒤 여기로 오면 `navigate` 는 그 화면을 **재사용**해
      //   «사주를 눌렀는데 자미가 뜨는» 반대 방향 함정이 생긴다(위 `ziwei.tsx` 와 같은 이유).
      onReading={() => router.push({ pathname: '/reading', params: { input: input ?? '', kind: 'saju' } })}
      onSinsal={() => router.push({ pathname: '/sinsal', params: { input: input ?? '' } })}
    />
  );
}
