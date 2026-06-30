// app/src/lib/entitlement.ts — 통변 접근 권한 (ADR-043 → trial 폐지 2026-06 / 보상형 광고 무료 생성 폐지 2026-07)
// ─────────────────────────────────────────────────────────────────────────
// daniel 결정(2026-06): trial(첫 1회 무료) 폐지 — 기기 로컬(SecureStore) 저장이라 계정 전환·재설치 시
//   리셋되어 '무료 우회'가 됐다(naver 계정 사례). 통변(LLM)은 결제·쿠폰(이용권)으로만 연다(규칙5: LLM 유료 전용).
//   무료 진입은 '미리보기(한 분야 일부)'로 유도(ReadingScreen) → 전체는 아래 건당 결제(또는 이용권·프리미엄)로 unlock.
// 건당 결제 = RevenueCat consumable(purchases.ts).
//   ★daniel 결정(2026-07): 비용발생(유료) 통변은 보상형 광고로 무료 생성하지 않는다 — 결제/프리미엄만.
//     (보상형 광고는 무료 기능 = 만세력 추가 게이트·오늘/이달 미리보기 등에서만 유지. ads.ts·register/today/month.)
// 캐싱(Edge readings chart_id×category)이 비용 방어 — 같은 차트·영역 재호출 = API 0.
// ─────────────────────────────────────────────────────────────────────────
import { purchaseConsumableRC, PRODUCT_UNLOCK_2500 } from './purchases';

export function useEntitlement() {
  // 건당 결제 ₩2,500 (RevenueCat consumable). 성공=unlock. 취소='cancelled' throw(호출처 무시).
  //   ※ 로그인 게이트는 호출처(requireLoginForPurchase) — 구매는 계정 귀속.
  async function purchaseReading(): Promise<void> {
    const ok = await purchaseConsumableRC(PRODUCT_UNLOCK_2500); // 키 미설정 시 '준비 중' throw
    if (!ok) throw new Error('cancelled');
  }

  return { purchaseReading };
}
