// app/src/lib/billing/coinPrices.ts — 코인 가격표(★순수 데이터 · RN 의존 0)
// ─────────────────────────────────────────────────────────────────────────
// coins.ts 에서 분리한 이유: 하네스(check:coins)가 **앱 런타임 없이** 이 표를 검증해야 한다.
//   coins.ts 는 supabase(→react-native) 를 import 하므로 tsx 가 파싱하지 못한다.
//   relatedMap.ts 와 같은 원칙 — 검증이 필요한 데이터는 순수 파일에 둔다.
// ⚠️가격 조정은 daniel 슬롯. **여기가 단일 출처**다.
// ─────────────────────────────────────────────────────────────────────────
import type { CreditKind } from './coupons';

/** 1 운 = ₩100 — 표시·환산의 기준. */
export const WON_PER_COIN = 100;

/**
 * 콘텐츠별 코인 가격. **기존 원화가 ÷ 100 을 10단위로 반올림**한 값.
 * ⚠️새 유료 콘텐츠를 추가하면 여기에도 반드시 넣어야 한다(check:coins 가 누락을 잡는다).
 */
// ★`Record<CreditKind, …>` 가 아니라 Partial — `child_couple` 은 2026-07-04 에 상품에서 제거됐고
//   타입에만 남아 있다(Edge 호환). 판매하지 않는 것에 가격을 두면 하네스가 유령 항목으로 잡는다.
export const COIN_PRICE: Partial<Record<CreditKind, number>> = {
  dream: 5,
  followup: 10, timeresolve: 10,
  celeb: 12,
  taemong: 50,   // 태몽 — 단독(명식 불필요) · 섹션 5개 딥리포트(daniel 2026-08-12 — 50운으로 올리고 그에 맞는 분량으로)
  // ★20 → 40(daniel 2026-08-12 "가격을 올려") — 단가 실측에서 **유일하게 마진 79%**였다.
  //   실측 원가 ₩317 · 운당 15.9 로 다른 콘텐츠(0.7~9.5)의 4~15배. 세운 1건이 아니라
  //   대운 구간 전체를 훑는 분량이라 원가가 크다. 40운이면 매출 ₩2,997 → 마진 89%(compat·crush 급).
  timeline: 40,
  compat: 30,
  lifegraph: 40,
  astrology: 50, career: 50, child: 50, crush: 50, future10: 50,
  gaeun: 50, image: 50, job: 50, jobfit: 50, roots: 50, talent: 50, wealth: 50,
  mission: 70,
  love: 100, newyear: 100, reunion: 100,
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

// ═══════════════════════════════════════════════════════════════════════════
// ★결제 채널 (daniel 2026-08-17 결정: **앱·웹 동일 가격**)
// ═══════════════════════════════════════════════════════════════════════════
// 배경 — 안드로이드와 웹을 병행하면 **수수료가 다르다**:
//   · Google Play  약 15%(구간에 따라 30%)  → 100운 9,900원 중 순수령 약 8,415원
//   · 웹 PG(토스)  약 2.5~3.3%              → 순수령 약 9,603원   (차이 12~14%p)
//
// daniel 결정: **가격은 같게 간다.** 웹의 14%p 는 *할인 재원이 아니라 마진*이다.
//   이유 ① 사용자 눈에 보이는 차이가 없으면 "왜 앱이 비싸?" CS 가 아예 안 생긴다
//        ② 앱 안에서 웹 가격을 알리는 행위(steering)는 스토어 정책 영역 — 리스크를 만들지 않는다
//        ③ 웹 결제를 붙이는 것 자체가 큰 공사다. 변수는 하나만 둔다
//
// ★이 파일이 **가격의 단일 출처**인 것이 이 문제를 작게 만든다:
//   원화가 붙는 것은 충전 팩 4개뿐이고, 콘텐츠 51종은 전부 `COIN_PRICE`(운)로 매겨져 있다.
//   ⇒ 채널이 늘어도 **콘텐츠 가격표는 손댈 필요가 없다.**
//
// ★지갑도 이미 채널 무관이다: 적립은 서버 `grant_coins`(원장 `coin_ledger` + `p_ref` 멱등)만 할 수 있고
//   클라에는 실행 권한이 없다. ⇒ 웹 PG 웹훅이 같은 RPC 를 부르면 **웹에서 충전한 운을 앱에서 그대로 쓴다.**
//   (지금 그 일을 하는 것이 `supabase/functions/rc-webhook` — 토스용은 같은 계약을 따르면 된다)
//
// ⚠️앞으로 차등을 두고 싶어지면 **가격 대신 `bonusPct`**(웹에서 운을 더 주기)가 낫다 —
//   정가는 하나로 남아 비교 자체가 안 생긴다.
// ═══════════════════════════════════════════════════════════════════════════

/** 결제 채널 — `store`=앱 인앱결제(Play/App Store) · `web`=웹 PG(토스페이먼츠). */
export type PayChannel = 'store' | 'web';

/**
 * 채널별로 **의도적으로** 가격을 다르게 두는 팩. 지금은 비어 있다(= 전 채널 동일가).
 *
 * ★비워 두는 것이 곧 정책이다. 여기에 줄을 추가하지 않는 한 `check:paychannel` 이
 *   채널 간 가격 차이를 **실패로 잡는다** — 실수로 벌어지는 일이 없게.
 * @example { coin_100: { web: 8900, why: '웹 전환 캠페인(2026-Q4)' } }
 */
export const PRICE_DIVERGENCE: Record<string, { web: number; why: string }> = {};

/**
 * 팩의 원화 가격 — **채널을 받는다**.
 *
 * @param packId  `coin_100` 등 팩 id
 * @param channel 결제 채널. 기본 `'store'`
 * @returns 원화 가격. `PRICE_DIVERGENCE` 에 명시된 팩만 채널별로 달라진다(현재 없음 = 항상 동일).
 */
export function packPriceWon(packId: string, channel: PayChannel = 'store'): number {
  const base = COIN_PACKS.find((p) => p.id === packId)?.won ?? 0;
  if (channel === 'web') return PRICE_DIVERGENCE[packId]?.web ?? base;
  return base;
}

/**
 * 대화 묶음 — **한 번에 얼마로 몇 턴**인가(Boss 2026-08-26 *"짜잘하게 뜯지말고 한번에
 *   5~10개씩 뜯고 대화를 몇턴 할수있게"*).
 *
 * ⚠️★서버(`talk` Edge)의 `coin_cost`·`PACK_TURNS` 와 **같아야 한다.** 여기는 «화면에 적는 값»이고
 *   실제 차감은 서버가 한다 — 어긋나면 «10운이라더니 20운이 빠졌다» 가 된다.
 *   ⇒ 서버 값을 바꿀 때 여기도 바꾼다. `check:talkcoin` ⑥ 이 DB 값을 찍어 준다.
 */
export const TALK_PACK = { cost: 10, turns: 5 } as const;

/** 하루 무료 대화 턴 수 — ★서버 `consultants.free_daily` 와 같아야 한다(화면 표기용). */
export const FREE_TALK_DAILY = 10;
