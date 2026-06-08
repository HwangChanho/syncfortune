// app/src/lib/entitlement.ts — 통변 접근 권한 (건당 모델, ADR-043 개정)
// ─────────────────────────────────────────────────────────────────────────
// daniel 결정(2026-06): 무제한 구독 폐기(헤비 유저 API 적자 — 통변 1회≈$0.05, 손익분기 ~98회/월).
//   → 건당 ₩2,500. mode: trial(첫 1회 무료) / perUse(건당 결제 or 광고 리워드 1회).
// 건당 결제 = RevenueCat consumable, 광고 = AdMob rewarded — daniel 연동 전 미구현(안내).
// 캐싱(Edge readings chart_id×category)이 비용 방어 — 같은 차트·영역 재호출 = API 0.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TRIAL_KEY = 'free_trial_used_v1';

async function getTrialUsed(): Promise<boolean> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(TRIAL_KEY) === '1';
  return (await SecureStore.getItemAsync(TRIAL_KEY)) === '1';
}
async function markTrialUsed(): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(TRIAL_KEY, '1');
  else await SecureStore.setItemAsync(TRIAL_KEY, '1');
}

export type ReadMode = 'trial' | 'perUse';

export function useEntitlement() {
  const [trialUsed, setTrialUsed] = useState(true); // 보수적 기본(로드 전 차단)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrialUsed().then((u) => { setTrialUsed(u); setLoading(false); });
  }, []);

  // 첫 1회 무료 체험 → 이후 건당
  const mode: ReadMode = !trialUsed ? 'trial' : 'perUse';

  // 첫 체험 소진(통변 성공 후 호출)
  async function consumeTrial(): Promise<void> {
    await markTrialUsed();
    setTrialUsed(true);
  }

  // 광고 리워드 1회 (AdMob rewarded) — daniel 연동 전 미구현
  async function watchAdForReading(): Promise<void> {
    throw new Error('광고는 준비 중입니다 (AdMob 연동 예정).');
  }

  // 건당 결제 ₩2,500 (RevenueCat consumable) — daniel 연동 전 미구현
  async function purchaseReading(): Promise<void> {
    throw new Error('건당 결제는 준비 중입니다 (RevenueCat 연동 예정).');
  }

  return { mode, loading, consumeTrial, watchAdForReading, purchaseReading };
}
