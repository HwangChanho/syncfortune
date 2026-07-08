// app/src/lib/billing/renewal.ts — 재통변 흐름(daniel 2026-07-08 통일모델)
// ─────────────────────────────────────────────────────────────────────────
// 배경: interpret 재통변 게이트가 renewRequired{kind}(운세형 & 구매 1년 경과 & refresh)를 반환하면 이 흐름을 호출:
//   ① 할인 안내(프리미엄 30% / 일반 10%) → ② credit_kind_r30/_r10 할인 SKU 구매 → ③ 웹훅이 credit_kind 적립할 때까지 대기 → ④ 재생성 재시도(interpret 가 소비→최신 통변).
// ★대상은 운세형만(명식형 제외)·계정 티어로 할인율 결정·가격은 정가에서 파생(가격 변동 대비). 옛 블랭킷 premium_renew30 대체.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from '../ui/alert'; // 커스텀 알림(큐 기반 크래시 방지)
import { purchaseContentRenewalRC } from './purchases';
import { contentRenewalPrice, renewalDiscountRate } from './repurchase';
import { CREDIT_KINDS, waitForCreditGrant, type CreditKind } from './coupons';

/**
 * 재통변 유도 → 할인 SKU 구매 → 크레딧 적립 대기 → onDone(재생성 재시도). 사용자 취소·미로그인·결제실패면 조용히 no-op.
 * @param opts.kind      interpret 가 알려준 재통변 이용권 kind(운세형: reading·ziwei·compat·love·newyear·reunion·crush·job·timeline·lifegraph·future10)
 * @param opts.isPremium 프리미엄 계정 여부(할인율 30% vs 10% + SKU 티어 결정)
 * @param opts.onDone    구매·적립 완료 후 실행(=refreshReading 재호출: 이제 이용권 있어 interpret 가 소비→재생성)
 */
export async function runContentRenewal(opts: { kind: string; isPremium: boolean; onDone: () => void }): Promise<void> {
  const k = opts.kind as CreditKind;
  const base = CREDIT_KINDS.find((c) => c.key === k)?.price ?? 0;
  const price = contentRenewalPrice(base, opts.isPremium);
  const pct = Math.round(renewalDiscountRate(opts.isPremium) * 100);
  const ok = await new Promise<boolean>((resolve) => {
    Alert.alert('최신 통변으로 재통변', `구매한 지 1년이 지났어요.\n\n${pct}% 할인가(약 ₩${price.toLocaleString()})로 지금 시점 최신 통변을 다시 받아보세요.`, [
      { text: '다음에', style: 'cancel', onPress: () => resolve(false) },
      { text: '재통변하기', onPress: () => resolve(true) },
    ]);
  });
  if (!ok) return;
  try {
    const bought = await purchaseContentRenewalRC(k, opts.isPremium);
    if (!bought) return;                    // 사용자 취소
    await waitForCreditGrant(k);            // 웹훅이 credit_kind 적립할 때까지 대기(재시도 전 이용권 확보)
    opts.onDone();                          // 재생성 재시도(interpret 가 이용권 소비 → 최신 모델·현재 운으로 재생성)
  } catch (e: any) {
    Alert.alert('재통변', e?.message ?? '');
  }
}
