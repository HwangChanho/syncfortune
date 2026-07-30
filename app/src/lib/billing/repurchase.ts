// app/src/lib/billing/repurchase.ts — 만료 후 재구매 판정(결정론·순수함수·daniel 2026-07-08)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스(수익구조·중요):
//   ① 일반 단건: category에 연도(newyear_YYYY·year_YYYY)가 인코딩됐고 그 연도가 현재연도보다 과거면 → '현재 시점 재구매' 대상.
//      (신년·타임라인은 category=newyear_${현재연도}로 매년 바뀌어 이미 재게이팅됨 — 여기선 '명시 재구매 버튼'을 띄울지 '판정'만 제공.)
//   ② 프리미엄: 구매 1년 경과 시 30% 할인 '갱신' 오퍼(선택·강제 아님·평생 접근은 유지). 만료 강제 없음.
//   ③ 30% 할인 실청구는 별도 SKU(premium_renew30 등)라 여기선 '표시가' 계산만(정가×0.7). SKU/청구는 스토어·RC.
//
// ★순수함수(now·purchasedAt·listPrice 주입) = 테스트 가능. new Date()는 호출부(앱)가 넘김.
// ─────────────────────────────────────────────────────────────────────────

/** category에서 연도 파싱(newyear_2027·year_2027·compat_..._y2027 → 2027). 연도 없으면 null(연도무관 static 풀이). */
export function categoryYear(category: string): number | null {
  const m = category.match(/(?:_|y)(\d{4})$/); // 끝의 _YYYY 또는 yYYYY
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 2000 && y <= 2100 ? y : null;
}

/** 일반 단건 '재구매 버튼' 노출 대상? = 연도 category & 그 연도 < 현재연도(지난 해 풀이). */
export function needsYearRepurchase(category: string, now: Date): boolean {
  const y = categoryYear(category);
  return y != null && y < now.getFullYear();
}

/** 지난 해 풀이의 '현재 시점' category(재구매가 향할 곳). 연도무관이면 원본 그대로. */
export function currentYearCategory(category: string, now: Date): string {
  const y = categoryYear(category);
  if (y == null) return category;
  return category.replace(/(\d{4})$/, String(now.getFullYear()));
}

/** 프리미엄 1주년 '갱신(30% 할인)' 오퍼 대상? = 구매일 + 1년 <= now. (평생 접근 유지·선택 오퍼) */
export function offerPremiumRenewal(purchasedAt: string | Date | null | undefined, now: Date): boolean {
  if (!purchasedAt) return false;
  const p = new Date(purchasedAt);
  if (isNaN(p.getTime())) return false;
  const anniversary = new Date(p);
  anniversary.setFullYear(p.getFullYear() + 1);
  return now.getTime() >= anniversary.getTime();
}

/** 30% 할인 표시가(정가 × 0.7, 100원 반올림). ★표시용 — 실제 청구는 할인 SKU의 스토어 등록가. */
export function renewalPrice(listPrice: number): number {
  return Math.round((listPrice * 0.7) / 100) * 100;
}

/** 할인율(표시용 배지 '30%'). 정가·할인가로 역산(SKU 등록가가 정확히 0.7이 아닐 수 있어 실가 기준). */
export function discountPercent(listPrice: number, salePrice: number): number {
  if (listPrice <= 0) return 0;
  return Math.round((1 - salePrice / listPrice) * 100);
}

// ─────────────────────────────────────────────────────────────────────────
// ★통일 재통변/재구매 모델(daniel 2026-07-08): 모든 유료 콘텐츠 중 **운세형만** 구매 1년 후 할인 재통변.
//   프리미엄 계정=30% 할인 / 일반 계정=10% 할인(개별가 기준). 명식형(원국 불변→1년 뒤도 같음)은 제외.
//   ★가격 변동 대비: 재구매가는 정가에서 파생(하드코딩 금지) — 정가 바뀌면 파생가·SKU 재생성으로 따라감.
// ─────────────────────────────────────────────────────────────────────────

/** 재통변 대상 = 운세형(매년 운이 바뀜). 명식형(뿌리·비침·사명·재능·자식·성격·전생·개운·별자리)은 제외. 궁합=연도별 궁합 있어 포함(daniel). */
export const RENEWABLE_KINDS: ReadonlySet<string> = new Set([
  'reading', 'ziwei', 'compat', 'love', 'newyear', 'reunion', 'crush', 'job', 'timeline', 'lifegraph', 'future10',
]);

/** 계정 티어별 재구매 할인율(daniel: 프리미엄 0.30 / 일반 0.10). ⚠️원화 시절 SKU 파생용 — 코인 전환 후에는 아래 코인 할인율을 쓴다. */
export function renewalDiscountRate(isPremium: boolean): number { return isPremium ? 0.30 : 0.10; }

// ─────────────────────────────────────────────────────────────────────────
// ★재통변 = 코인 결제(daniel 2026-07-30 "재통변은 코인으로 바꿔")
//   종전엔 할인 SKU(`credit_<kind>_r30/_r10`)를 스토어에서 사게 했다. 그런데
//   ①07-28 코인 단일화폐 전환으로 현금 경로는 코인 충전 하나로 정리됐고
//   ②그 할인 SKU 는 **Play 에 등록조차 없어**(등록 안 하기로 확정) 안드로이드에선 영원히 실패할 코드였다.
//   → 재통변도 코인으로 낸다. 청구·차감은 **서버(Edge interpret)** 가 한다(클라 선차감 금지).
// ─────────────────────────────────────────────────────────────────────────

/**
 * 재통변 코인 할인율(%). ★daniel 가격 검수 슬롯.
 *
 * 10 을 고른 근거(발명 아님): 종전 규칙은 프리미엄 30% / 일반 10% 였고 프리미엄은 07-28 폐지됐다.
 *   즉 **현재 모든 실사용자에게 적용되던 값이 10%** 다 → 관측 가능한 동작을 그대로 보존한다.
 *   재구매 유인을 더 주려면 이 숫자만 올리면 된다(앱·서버가 같은 규칙을 공유하도록 하네스가 대조).
 */
export const RENEWAL_COIN_DISCOUNT_PCT = 10;

/**
 * 재통변 코인가 = 정가 코인 × (1 − 할인율), **내림**(사용자에게 유리) · 최소 1코인.
 * @param fullCoins 그 콘텐츠의 정가 코인(COIN_PRICE[kind])
 *
 * ⚠️내림을 쓰는 이유: 코인은 정수라 반올림하면 할인이 0 이 되는 구간이 생긴다
 *   (예: 정가 5코인 × 0.9 = 4.5 → 반올림 5 = 할인 없음). 내림이면 4 로 실제 할인이 된다.
 * ⚠️서버(Edge interpret)에 **같은 식이 복제**돼 있다 — 값이 갈리면 클라 표시가와 실제 청구가 어긋난다.
 *   `npm run check:store` S5 가 두 곳을 대조한다.
 */
export function renewalCoinCost(fullCoins: number): number {
  if (!(fullCoins > 0)) return 0;
  return Math.max(1, Math.floor(fullCoins * (1 - RENEWAL_COIN_DISCOUNT_PCT / 100)));
}

/** 재구매 표시가 = 정가 × (1−할인율), 100원 반올림. ★정가 단일소스에서 파생(가격 변동 대비). */
export function contentRenewalPrice(listPrice: number, isPremium: boolean): number {
  return Math.round((listPrice * (1 - renewalDiscountRate(isPremium))) / 100) * 100;
}

/** 이 풀이가 재통변 버튼 노출 대상? = 운세형 & 생성 1년 경과(readings.created_at 기준). */
export function needsContentRenewal(kind: string, createdAt: string | Date | null | undefined, now: Date): boolean {
  if (!RENEWABLE_KINDS.has(kind)) return false;
  return offerPremiumRenewal(createdAt, now); // 1년 경과 판정 재사용(구매/생성일 + 1년 ≤ now)
}
