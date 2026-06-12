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
import { useAuth } from '../../lib/useAuth';
import { requireLoginForPurchase } from '../../lib/requireLogin'; // 구매 전 로그인 게이트(계정 귀속)
import { showRewardedAd } from '../../lib/ads'; // 보상형 광고 → 한도 1건 우회

export default function RegisterRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isPremium } = useSubscription(); // 프로 = 무제한 등록

  // 저장 후 명식 화면으로(스택 = [홈, 명식] — 등록 폼은 replace 로 제거).
  function proceed(input: any) {
    router.replace({ pathname: '/myeongsik', params: { input: JSON.stringify(input) } });
  }

  // 한도(10개) 초과 안내 → ① 보상형 광고 1회 보고 1건 추가 / ② 프리미엄(무제한, daniel).
  function showLimit(limit: number, input: any) {
    Alert.alert(
      t('register.limitTitle'),
      t('register.limitMsg', { limit }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          // 보상형 광고 시청 완료(earned) → 이번 1건만 한도 우회 저장 → 진행
          text: t('register.watchAdAdd'),
          onPress: async () => {
            const earned = await showRewardedAd();
            if (!earned) { Alert.alert(t('register.limitTitle'), t('register.adNotFinished')); return; }
            try { await saveMyChart(input, { bypassLimit: true }); proceed(input); }
            catch (e) { Alert.alert('!', (e as Error).message); }
          },
        },
        {
          text: t('register.upgrade'),
          onPress: () => {
            if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return; // 미로그인 → 안내 후 중단
            purchasePremium().catch((e) => Alert.alert('!', e.message));
          },
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
          if (e instanceof ChartLimitError) { showLimit(e.limit, input); return; } // 저장·네비 중단 → 광고/구매 안내
          throw e;
        }
        proceed(input);
      }}
    />
  );
}
