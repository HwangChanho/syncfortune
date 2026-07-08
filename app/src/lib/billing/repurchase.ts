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

/** 계정 티어별 재구매 할인율(daniel: 프리미엄 0.30 / 일반 0.10). */
export function renewalDiscountRate(isPremium: boolean): number { return isPremium ? 0.30 : 0.10; }

/** 재구매 표시가 = 정가 × (1−할인율), 100원 반올림. ★정가 단일소스에서 파생(가격 변동 대비). */
export function contentRenewalPrice(listPrice: number, isPremium: boolean): number {
  return Math.round((listPrice * (1 - renewalDiscountRate(isPremium))) / 100) * 100;
}

/** 이 풀이가 재통변 버튼 노출 대상? = 운세형 & 생성 1년 경과(readings.created_at 기준). */
export function needsContentRenewal(kind: string, createdAt: string | Date | null | undefined, now: Date): boolean {
  if (!RENEWABLE_KINDS.has(kind)) return false;
  return offerPremiumRenewal(createdAt, now); // 1년 경과 판정 재사용(구매/생성일 + 1년 ≤ now)
}
