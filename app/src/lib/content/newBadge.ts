// app/src/lib/content/newBadge.ts — 신규 콘텐츠 'NEW' 배지 관리(단일 출처·자동 만료)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-22: 신규로 들어온 콘텐츠 카드 우측 상단에 연한 빨강 'NEW'.
//
// ★관리 로직(구상): 유저별 '봤음' 상태를 저장하지 않고 **출시일 + 노출기간**으로 자동 관리한다.
//   · 신규 콘텐츠를 낼 때 이 맵에 `키: '출시일(YYYY-MM-DD)'` 한 줄만 추가한다.
//   · 배지는 출시일로부터 NEW_WINDOW_DAYS(기본 21일) 동안만 자동 노출 → 기간 지나면 저절로 사라짐(수동 제거 불필요).
//   · 서버/유저 상태 0(온디바이스 날짜 계산만) — 계정·기기 무관하게 일관, API 0.
//   ⚠️ 키 = contentSections MenuItem.key / market CreditKind 와 동일 문자열(두 화면 공용).
//   (더 개인화하려면 '탭하면 사라짐'을 SecureStore 로 얹을 수 있으나, 우선 단순·무상태 방식 채택.)
// ─────────────────────────────────────────────────────────────────────────

/** 노출 기간(일) — 출시일로부터 이 기간 동안 NEW 배지. */
export const NEW_WINDOW_DAYS = 21;

/** 콘텐츠 키 → 출시일(YYYY-MM-DD). 신규 콘텐츠 낼 때 여기 한 줄 추가. */
export const NEW_SINCE: Record<string, string> = {
  wealth: '2026-07-22', // 재물 딥리포트(신규 유료)
};

/**
 * 이 콘텐츠 키가 지금 'NEW' 배지 대상인가(출시일 + 노출기간 내).
 * @param key contentSections MenuItem.key 또는 market CreditKind
 * @param now 기준 시각(기본 현재) — 테스트 주입용
 */
export function isNewContent(key: string, now: Date = new Date()): boolean {
  const since = NEW_SINCE[key];
  if (!since) return false;
  const start = new Date(`${since}T00:00:00`);
  if (isNaN(start.getTime())) return false;
  const elapsed = now.getTime() - start.getTime();
  return elapsed >= 0 && elapsed < NEW_WINDOW_DAYS * 86400000;
}
