// src/app/(app)/register.tsx — 차트 등록 라우트 (네비 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// 화면(ChartRegisterScreen)의 onSubmit(input) 을 받아 ① 내 차트로 저장(myChart)
// ② /myeongsik 으로 input 직렬화 전달. 저장은 온디바이스(로그인 불필요, ADR-037).
// ─────────────────────────────────────────────────────────────────────────
import { useRouter } from 'expo-router';
import { ChartRegisterScreen } from '../../screens/ChartRegisterScreen';
import { saveMyChart } from '../../lib/myChart';

export default function RegisterRoute() {
  const router = useRouter();
  return (
    <ChartRegisterScreen
      onSubmit={async (input) => {
        await saveMyChart(input); // 내 차트(self) 기기 저장 → 궁합·풀이 재사용
        router.push({ pathname: '/myeongsik', params: { input: JSON.stringify(input) } });
      }}
    />
  );
}
