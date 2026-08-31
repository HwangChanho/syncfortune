// app/src/lib/billing/webPay.ts — **웹 결제**(주문 → 결제창 → 승인)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-31: *"다음은 결제 붙이고 테스트하자 앱웹 둘다"*
//
// ■ 앱과 웹이 **다른 길**인 이유
//   앱 = 스토어 인앱결제(RevenueCat) — 스토어 밖 결제를 넣으면 심사에서 걸린다.
//   웹 = PG(토스). 스토어 수수료가 없어 값이 −28% 다([[web-payment-netflix-model]]).
//   ⇒ 두 길은 **합치지 않는다.** 대신 «누르면 산다» 는 겉모습만 같게 둔다.
//
// ■ ★금액을 **클라가 정하지 않는다**
//   주문을 만들 때 보내는 것은 `packId` 하나다. 금액은 서버 행이 정하고,
//   승인 단계에서 PG 가 알려 준 실제 금액과 대조한다. 다르면 승인을 **취소**한다.
//
// ■ ⚠️결제창은 **리다이렉트**다 — 돌아오는 자리가 있어야 한다
//   토스 SDK 가 `successUrl` 로 `paymentKey`·`orderId`·`amount` 를 붙여 되돌린다.
//   그 자리(`/pay`)가 `confirm` 을 부른다. 창을 띄우는 방식이 아니라서
//   **탭이 닫혀도 주문 행이 남는다**(고아 결제는 `audit:pay` 가 찾는다).
// ═══════════════════════════════════════════════════════════════════════════
import { Platform } from 'react-native';
import { supabase } from '../supabase';

/** 결제창을 띄우기 전에 서버가 만든 주문. */
export type WebOrder = { orderNo: string; coins: number; won: number; clientKey: string; mock: boolean };

/** 웹 결제를 쓸 수 있는 자리인가 — 웹에서만. */
export const webPayEnabled = Platform.OS === 'web';

async function callPay(payload: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('pay-web', { body: payload });
  if (error) {
    // ★Edge 가 4xx 로 준 몸통을 살려 낸다 — 「알 수 없는 오류」로 뭉개면 원인을 잃는다
    let detail = '';
    try { detail = String((await (error as any)?.context?.json?.())?.error ?? ''); } catch { /* 무시 */ }
    throw new Error(detail || error.message);
  }
  return data;
}

/** 주문을 만든다(금액은 서버가 정한다). */
export async function createWebOrder(packId: string): Promise<WebOrder> {
  const d = await callPay({ action: 'create', packId });
  return { orderNo: String(d.orderNo), coins: Number(d.coins), won: Number(d.won), clientKey: String(d.clientKey ?? ''), mock: !!d.mock };
}

/** 돌아온 뒤 승인 확정 → 적립. @returns 적립된 운(거절이면 예외) */
export async function confirmWebOrder(orderNo: string, paymentKey: string, amount: number): Promise<number> {
  const d = await callPay({ action: 'confirm', orderNo, paymentKey, amount });
  if (!d?.granted) throw new Error(String(d?.reason ?? 'rejected'));
  return Number(d.coins ?? 0);
}

/**
 * 토스 결제창을 띄운다.
 *
 * ⚠️SDK 를 **그때 받는다** — 결제를 안 누르는 사람에게까지 스크립트를 받게 하지 않는다.
 * ⚠️`customerKey` 를 안 넘긴다(비회원 결제 아님 — 우리는 이미 로그인 사용자만 부른다).
 */
async function openTossCheckout(order: WebOrder, packName: string): Promise<void> {
  const w = globalThis as any;
  if (!w.TossPayments) {
    await new Promise<void>((resolve, reject) => {
      const s = w.document.createElement('script');
      s.src = 'https://js.tosspayments.com/v1/payment';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('결제 모듈을 불러오지 못했어요.'));
      w.document.head.appendChild(s);
    });
  }
  const origin = String(w.location?.origin ?? '');
  const toss = w.TossPayments(order.clientKey);
  await toss.requestPayment('카드', {
    amount: order.won,
    orderId: order.orderNo,
    orderName: packName,
    successUrl: `${origin}/pay?ok=1`,
    failUrl: `${origin}/pay?ok=0`,
  });
}

/**
 * 웹에서 팩 하나를 산다.
 *
 * @returns 모의 승인으로 **그 자리에서 끝났으면** 적립된 운 · 결제창으로 넘어갔으면 `null`
 *   (넘어간 경우 이 함수는 반환되지 않는다 — 페이지가 바뀐다)
 * @throws 주문 실패·PG 미설정 등
 */
export async function buyOnWeb(packId: string, packName: string): Promise<number | null> {
  const order = await createWebOrder(packId);
  if (order.mock) {
    // ⚠️키가 없을 때만이고, 서버가 **관리자만** 통과시킨다. 여기서 판정하지 않는다.
    return await confirmWebOrder(order.orderNo, '', order.won);
  }
  if (!order.clientKey) throw new Error('결제가 아직 준비되지 않았어요.');
  await openTossCheckout(order, packName);
  return null;   // 결제창으로 넘어갔다
}
