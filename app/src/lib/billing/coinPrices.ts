// app/src/lib/billing/coinPrices.ts — 코인 가격표(★순수 데이터 · RN 의존 0)
// ─────────────────────────────────────────────────────────────────────────
// coins.ts 에서 분리한 이유: 하네스(check:coins)가 **앱 런타임 없이** 이 표를 검증해야 한다.
//   coins.ts 는 supabase(→react-native) 를 import 하므로 tsx 가 파싱하지 못한다.
//   relatedMap.ts 와 같은 원칙 — 검증이 필요한 데이터는 순수 파일에 둔다.
// ⚠️가격 조정은 daniel 슬롯. **여기가 단일 출처**다.
// ─────────────────────────────────────────────────────────────────────────
import type { CreditKind } from './coupons';

/** 1운 = ₩100 — 표시·환산의 기준. */
export const WON_PER_COIN = 100;

/**
 * 콘텐츠별 코인 가격. **기존 원화가 ÷ 100 을 10단위로 반올림**한 값.
 * ⚠️새 유료 콘텐츠를 추가하면 여기에도 반드시 넣어야 한다(check:coins 가 누락을 잡는다).
 */
// ★`Record<CreditKind, …>` 가 아니라 Partial — `child_couple` 은 2026-07-04 에 상품에서 제거됐고
//   타입에만 남아 있다(Edge 호환). 판매하지 않는 것에 가격을 두면 하네스가 유령 항목으로 잡는다.
export const COIN_PRICE: Partial<Record<CreditKind, number>> = {
  dream: 5,
  coach: 10, followup: 10, timeresolve: 10,
  celeb: 12,
  timeline: 20,
  compat: 30,
  lifegraph: 40,
  astrology: 50, career: 50, child: 50, crush: 50, future10: 50,
  gaeun: 50, image: 50, job: 50, jobfit: 50, roots: 50, talent: 50, timeline5: 50, wealth: 50,
  mission: 70,
  timeline10: 100, love: 100, newyear: 100, reunion: 100,
  ziwei: 150,
  reading: 200,
};

/** 충전 팩 — 많이 살수록 운당 단가가 내려간다(충전 유인). 상품 id 는 ASC 등록값과 일치해야 한다. */
export const COIN_PACKS: { id: string; coins: number; won: number; bonusPct: number }[] = [
  { id: 'coin_100', coins: 100, won: 9900, bonusPct: 0 },
  { id: 'coin_300', coins: 300, won: 27900, bonusPct: 6 },
  { id: 'coin_600', coins: 600, won: 49900, bonusPct: 19 },   // ★평생 프리미엄과 같은 금액 — 성향대로 고르게
  { id: 'coin_1200', coins: 1200, won: 89900, bonusPct: 32 },
];

// ★광고 제거 상품(daniel 2026-07-28 "광고 제거를 코인으로 살수있게 하자")
//   프리미엄을 없애면서 광고 제거 수단이 같이 사라졌다 — 코인으로 되살린다.
//   ⚠️여기 값은 **표기용**이다. 실제 차감액은 서버 RPC(buy_ad_free)가 정한다
//     (클라가 금액을 넘기면 '1코인 내고 광고 제거'가 가능해지므로). 둘의 일치는 check:coins K6 이 강제.
//   ⚠️가격은 ★daniel 검수 슬롯 — 30일 30코인(₩3,000) / 영구 100코인(₩10,000, 3.3개월 손익분기).
export const AD_FREE_PLANS: { id: 'adfree_30' | 'adfree_forever'; coins: number; days: number | null }[] = [
  { id: 'adfree_30',      coins: 30,  days: 30 },
  { id: 'adfree_forever', coins: 100, days: null },   // null = 영구
];
