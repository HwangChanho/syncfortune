// src/app/(app)/register.tsx — 차트 등록 라우트 (네비 어댑터)
// ─────────────────────────────────────────────────────────────────────────
// 화면(ChartRegisterScreen)의 onSubmit(input) 을 받아 ① 내 차트로 저장(myChart)
// ② /myeongsik 으로 input 직렬화 전달. 저장은 온디바이스(로그인 불필요, ADR-037).
// 무료 등록 한도(FREE_CHART_LIMIT=10): 저장소가 ChartLimitError 로 강제 → 여기서 잡아
//   업그레이드 유도(프로=무제한, ADR-051). 한도 초과면 저장·네비 모두 일어나지 않는다.
// ─────────────────────────────────────────────────────────────────────────
import { logEvent } from '../../lib/backend/logger';
import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChartRegisterScreen } from '../../screens/ChartRegisterScreen';
import { addChart, saveMyChart, ChartLimitError, setRepresentative, updateChart, listCharts, type SavedChart } from '../../lib/engine/myChart';
import { useSubscription } from '../../lib/billing/subscription';
import { showRewardedAd } from '../../lib/core/ads'; // 보상형 광고 → 한도 1건 우회
import { colors } from '../../lib/theme';

export default function RegisterRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isPremium } = useSubscription(); // 프로 = 무제한 등록
  // editId = 편집모드(명식 수정). preDate/preCal/preSex = **가볍게 보기**(/light)에서 넘어온 값 prefill —
  //   거기서 이미 받은 걸 또 묻는 순간이 이탈 지점이라 그대로 옮겨 담는다(docs/PLAN_light_mode.md L1).
  const { editId, preDate, preCal, preSex } = useLocalSearchParams<{ editId?: string; preDate?: string; preCal?: string; preSex?: string }>();
  // 시각은 **일부러 비운다**(timeAccuracy 미상) — 사용자가 채워야 오늘 기운·궁합이 정확해지고, 그게 이 전환의 이유다.
  const prefill = !editId && preDate
    ? { birthDateTime: `${preDate} 0:0`, calendar: (preCal === '음' ? '음' : '양'), sex: (preSex === '여' ? '여' : '남'), timeAccuracy: '미상' as const }
    : undefined;
  const [editing, setEditing] = useState<SavedChart | null>(null);
  const [editReady, setEditReady] = useState(!editId); // 편집모드면 명식 로드 완료까지 폼 마운트 보류(초기값 prefill 보장)
  useEffect(() => { if (editId) listCharts().then((l) => { setEditing(l.find((c) => c.id === editId) ?? null); setEditReady(true); }); }, [editId]);

  // 저장 후 **분석 완료 화면**을 한 박자 거쳐 명식으로(시안 p12, 2026-08-18).
  //   종전엔 등록하자마자 8글자 표가 나와서, 방금 넣은 생년월일이 무엇이 되었는지 알기 전에
  //   한자부터 마주쳤다. "당신은 ○○ 일주" 를 먼저 말해 주고 넘긴다.
  //   ⚠️편집 모드는 건너뛴다 — 이미 아는 명식을 고친 것이라 다시 선언할 이유가 없다.
  function proceed(input: any) {
    const to = editId ? '/myeongsik' : '/analyzed';
    router.replace({ pathname: to, params: { input: JSON.stringify(input) } });
  }

  // 한도(10개) 초과 안내 → 보상형 광고 1회 보고 1건 추가.
  // ★'업그레이드(프리미엄)' 선택지 제거(daniel 2026-07-30 전수조사).
  //   프리미엄은 07-28 폐지됐고 상품 `premium_lifetime` 은 Play 에 등록조차 없다 →
  //   누르면 "상품을 불러오지 못했어요"만 떴다. **살아 있는 깨진 결제 경로**였다.
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
            // ⚠️★대표 설정이 빠져 있었다(2026-08-24 발견). 등록 뒤 도착지를 **만세력**으로 바꾸면서
            //   드러난 구멍이다 — 만세력은 **대표 명식**을 그리므로, 여기서 대표를 안 세우면
            //   광고를 보고 추가한 사람에게는 **방금 넣은 명식이 아니라 옛 명식**이 뜬다.
            //   (다른 저장 경로 둘은 이미 `setRepresentative` 를 부르고 있었다.)
            try {
              await saveMyChart(input, { bypassLimit: true });
              const added = (await listCharts()).at(-1);
              if (added) await setRepresentative(added.id);
              proceed(input);
            }
            catch (e) { Alert.alert('!', (e as Error).message); }
          },
        },
      ],
    );
  }

  // 편집모드 = 기존 명식 로드 완료 후에야 폼 마운트(초기값 prefill 보장). 로드 전엔 로딩 표시.
  if (!editReady) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'transparent' }}><ActivityIndicator color={colors.ju} /></View>; // 전역 배경 노출

  return (
    <ChartRegisterScreen
      // ★신규 등록만 **4단계**로 묻는다(시안 p03, 2026-08-18).
      //   편집은 한 화면 그대로 — 이미 아는 명식에서 한 칸 고치려는데 4단계를 걷게 하면 그건 벌이다.
      stepped={!editId}
      // 편집모드 = 기존 값 prefill + '수정 저장' 라벨. input 의 label/relation 은 메타로 합쳐 전달.
      initial={editing ? { ...editing.input, label: editing.label, relation: editing.relation } : prefill}
      submitLabel={editId ? t('register.editDone', '완료') : undefined}
      autoSave={!!editId}
      onAutoSave={editId ? async (input) => { // 편집 = 필드 변경 시 자동 갱신(이동 없음, daniel "저장 따로 안눌러도")
        // ★자동저장 실패를 삼키지 않는다(daniel 2026-07-29 QA 전수검수).
        //   종전 `catch {}` 는 저장이 실패해도 화면이 그대로여서 **사용자는 저장된 줄 안다**.
        //   자동저장이라 매번 Alert 을 띄우면 성가시므로, 원인 추적이 되게 **로그로 남긴다**
        //   (같은 유형: 푸시 토큰 등록 실패를 catch 가 삼켜 '한 번도 작동 안 함'을 몰랐던 사고).
        try { await updateChart(editId, input); if (input.makeRep) await setRepresentative(editId); }
        catch (e) { logEvent('chart_autosave_fail', { editId, msg: String((e as Error)?.message ?? e).slice(0, 200) }); }
      } : undefined}
      onSubmit={async (input) => {
        if (editId) { // 편집 = 한도 무관 갱신(추가 아님). 대표 체크 시 대표 전환.
          try { await updateChart(editId, input); if (input.makeRep) await setRepresentative(editId); }
          catch (e) { Alert.alert('!', (e as Error).message); return; }
          proceed(input); return;
        }
        // ★본인(self)은 하나만 — 이미 있으면 기존 본인을 '기타'로 *강등*해 리스트에 보존하고, 이 명식을 새 본인으로 *추가*한다(daniel 2026-07-12).
        //   (옛 동작=updateChart 로 기존 본인을 새 사람 데이터로 덮어써 소실됐음 → 강등+추가로 두 명식 모두 유지.)
        if ((input.relation ?? 'self') === 'self') {
          const existingSelf = (await listCharts()).find((c) => c.relation === 'self');
          if (existingSelf) {
            Alert.alert(
              t('register.selfExistsTitle', '본인 명식이 이미 있어요'),
              t('register.selfExistsMsg', "본인 명식은 하나만 둘 수 있어요. 기존 본인 명식은 '기타'로 옮기고 이 명식을 본인으로 등록할까요?"),
              [
                { text: t('common.cancel', '취소'), style: 'cancel' },
                { text: t('register.selfReplace', '본인으로 등록'), onPress: async () => {
                  try {
                    // 기존 본인 = 삭제/덮어쓰기 대신 '기타'로 강등(생년월일 등 원본 그대로 보존) → 리스트에 남는다.
                    await updateChart(existingSelf.id, { ...existingSelf.input, label: existingSelf.label, relation: '기타' });
                    const id = await addChart(input, { isPro: isPremium }); // 새 명식을 본인으로 추가
                    await setRepresentative(id);
                  } catch (e) {
                    if (e instanceof ChartLimitError) { showLimit(e.limit, input); return; } // 한도 시 광고/구매 안내
                    Alert.alert('!', (e as Error).message); return;
                  }
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
