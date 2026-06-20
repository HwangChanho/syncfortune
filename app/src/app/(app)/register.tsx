// src/app/(app)/register.tsx — 차트 등록 라우트 (네비 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// 화면(ChartRegisterScreen)의 onSubmit(input) 을 받아 ① 내 차트로 저장(myChart)
// ② /myeongsik 으로 input 직렬화 전달. 저장은 온디바이스(로그인 불필요, ADR-037).
// 무료 등록 한도(FREE_CHART_LIMIT=10): 저장소가 ChartLimitError 로 강제 → 여기서 잡아
//   업그레이드 유도(프로=무제한, ADR-051). 한도 초과면 저장·네비 모두 일어나지 않는다.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Alert } from '../../lib/alert'; // 커스텀 알림(앱 디자인)
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChartRegisterScreen } from '../../screens/ChartRegisterScreen';
import { addChart, saveMyChart, ChartLimitError, setRepresentative, updateChart, listCharts, type SavedChart } from '../../lib/myChart';
import { useSubscription, purchasePremium } from '../../lib/subscription';
import { useAuth } from '../../lib/useAuth';
import { requireLoginForPurchase } from '../../lib/requireLogin'; // 구매 전 로그인 게이트(계정 귀속)
import { showRewardedAd } from '../../lib/ads'; // 보상형 광고 → 한도 1건 우회
import { colors } from '../../lib/theme';

export default function RegisterRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isPremium } = useSubscription(); // 프로 = 무제한 등록
  const { editId } = useLocalSearchParams<{ editId?: string }>(); // 있으면 편집모드(명식 수정)
  const [editing, setEditing] = useState<SavedChart | null>(null);
  const [editReady, setEditReady] = useState(!editId); // 편집모드면 명식 로드 완료까지 폼 마운트 보류(초기값 prefill 보장)
  useEffect(() => { if (editId) listCharts().then((l) => { setEditing(l.find((c) => c.id === editId) ?? null); setEditReady(true); }); }, [editId]);

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

  // 편집모드 = 기존 명식 로드 완료 후에야 폼 마운트(초기값 prefill 보장). 로드 전엔 로딩 표시.
  if (!editReady) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.ju} /></View>;

  return (
    <ChartRegisterScreen
      // 편집모드 = 기존 값 prefill + '수정 저장' 라벨. input 의 label/relation 은 메타로 합쳐 전달.
      initial={editing ? { ...editing.input, label: editing.label, relation: editing.relation } : undefined}
      submitLabel={editId ? t('register.editDone', '완료') : undefined}
      autoSave={!!editId}
      onAutoSave={editId ? async (input) => { // 편집 = 필드 변경 시 자동 갱신(이동 없음, daniel "저장 따로 안눌러도")
        try { await updateChart(editId, input); if (input.makeRep) await setRepresentative(editId); } catch {}
      } : undefined}
      onSubmit={async (input) => {
        if (editId) { // 편집 = 한도 무관 갱신(추가 아님). 대표 체크 시 대표 전환.
          try { await updateChart(editId, input); if (input.makeRep) await setRepresentative(editId); }
          catch (e) { Alert.alert('!', (e as Error).message); return; }
          proceed(input); return;
        }
        // 본인(self)은 하나만 — 이미 있으면 경고 + 변경(교체) 여부 확인(daniel). 변경=기존 본인 명식 교체.
        if ((input.relation ?? 'self') === 'self') {
          const existingSelf = (await listCharts()).find((c) => c.relation === 'self');
          if (existingSelf) {
            Alert.alert(
              t('register.selfExistsTitle', '본인 명식이 이미 있어요'),
              t('register.selfExistsMsg', '본인 명식은 하나만 둘 수 있어요. 이 명식으로 변경(교체)할까요?'),
              [
                { text: t('common.cancel', '취소'), style: 'cancel' },
                { text: t('register.selfReplace', '변경'), onPress: async () => {
                  try { await updateChart(existingSelf.id, input); await setRepresentative(existingSelf.id); }
                  catch (e) { Alert.alert('!', (e as Error).message); return; }
                  proceed(input);
                } },
              ],
            );
            return; // 확인 대기 — 신규 추가 안 함
          }
        }
        try {
          // 내 차트 기기 저장 → 궁합·풀이 재사용. 무료 한도는 isPro 주입으로 저장소가 판정.
          const id = await addChart(input, { isPro: isPremium });
          await setRepresentative(id); // daniel: 신규 등록 시 항상 현재 설정(대표) 명식으로 전환
        } catch (e) {
          if (e instanceof ChartLimitError) { showLimit(e.limit, input); return; } // 저장·네비 중단 → 광고/구매 안내
          throw e;
        }
        proceed(input);
      }}
    />
  );
}
