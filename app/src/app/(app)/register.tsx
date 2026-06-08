// src/app/(app)/register.tsx — 차트 등록 라우트 (네비 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// 화면(ChartRegisterScreen)의 onSubmit(input) 을 받아 ① 내 차트로 저장(myChart)
// ② /myeongsik 으로 input 직렬화 전달. 저장은 온디바이스(로그인 불필요, ADR-037).
// 무료 등록 한도(FREE_CHART_LIMIT=10): 저장소가 ChartLimitError 로 강제 → 여기서 잡아
//   업그레이드 유도(프로=무제한, ADR-051). 한도 초과면 저장·네비 모두 일어나지 않는다.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChartRegisterScreen } from '../../screens/ChartRegisterScreen';
import { saveMyChart, ChartLimitError } from '../../lib/myChart';
import { useSubscription, purchasePremium } from '../../lib/subscription';

export default function RegisterRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isPremium } = useSubscription(); // 프로 = 무제한 등록

  // 한도 초과 안내 → 업그레이드 시도(RevenueCat 미연동 시 '준비 중' 안내).
  function showLimit(limit: number) {
    Alert.alert(
      t('register.limitTitle'),
      t('register.limitMsg', { limit }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('register.upgrade'),
          onPress: () => { purchasePremium().catch((e) => Alert.alert('!', e.message)); },
        },
      ],
    );
  }

  return (
    <ChartRegisterScreen
      onSubmit={async (input) => {
        try {
          // 내 차트 기기 저장 → 궁합·풀이 재사용. 무료 한도는 isPro 주입으로 저장소가 판정.
          await saveMyChart(input, { isPro: isPremium });
        } catch (e) {
          if (e instanceof ChartLimitError) { showLimit(e.limit); return; } // 저장·네비 중단
          throw e;
        }
        router.push({ pathname: '/myeongsik', params: { input: JSON.stringify(input) } });
      }}
    />
  );
}
