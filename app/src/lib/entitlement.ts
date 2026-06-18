// app/src/lib/entitlement.ts — 통변 접근 권한 (ADR-043 → trial 폐지 2026-06)
// ─────────────────────────────────────────────────────────────────────────
// daniel 결정(2026-06): trial(첫 1회 무료) 폐지 — 기기 로컬(SecureStore) 저장이라 계정 전환·재설치 시
//   리셋되어 '무료 우회'가 됐다(naver 계정 사례). 통변(LLM)은 광고·결제·쿠폰으로만 연다(규칙5: LLM 유료 전용).
//   무료 진입은 '미리보기(한 분야 일부)'로 유도(ReadingScreen) → 전체는 아래 광고/결제로 unlock.
// 건당 결제 = RevenueCat consumable(purchases.ts), 광고 = AdMob rewarded(ads.ts).
// 캐싱(Edge readings chart_id×category)이 비용 방어 — 같은 차트·영역 재호출 = API 0.
// ─────────────────────────────────────────────────────────────────────────
import { purchaseConsumableRC, PRODUCT_UNLOCK_2500 } from './purchases';
import { showRewardedAd } from './ads'; // 광고 리워드 1회 = 통변 unlock

export function useEntitlement() {
  // 광고 리워드 1회 (AdMob rewarded) — 끝까지 시청(earned)해야 unlock. 미시청/닫기 = 'cancelled' throw(호출처 무시).
  async function watchAdForReading(): Promise<void> {
    const earned = await showRewardedAd();
    if (!earned) throw new Error('cancelled');
  }

  // 건당 결제 ₩2,500 (RevenueCat consumable). 성공=unlock. 취소='cancelled' throw(호출처 무시).
  //   ※ 로그인 게이트는 호출처(requireLoginForPurchase) — 구매는 계정 귀속.
  async function purchaseReading(): Promise<void> {
    const ok = await purchaseConsumableRC(PRODUCT_UNLOCK_2500); // 키 미설정 시 '준비 중' throw
    if (!ok) throw new Error('cancelled');
  }

  return { watchAdForReading, purchaseReading };
}
