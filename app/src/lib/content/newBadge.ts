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

import { baseKey } from './contentSections'; // '인기' 사본 키(hot*) → 원본 키. 출시일 표는 원본 하나만 갖는다.
import { newOverride } from '../core/features'; // ★관리자 원격 토글(daniel 2026-08-11) — 있으면 날짜 규칙보다 우선

/** 노출 기간(일) — 출시일로부터 이 기간 동안 NEW 배지. */
export const NEW_WINDOW_DAYS = 21;

/** 콘텐츠 키 → 출시일(YYYY-MM-DD). 신규 콘텐츠 낼 때 여기 한 줄 추가. */
export const NEW_SINCE: Record<string, string> = {
  wealth: '2026-07-22', // 재물 딥리포트(신규 유료)
  gem: '2026-07-23',    // 내 사주 보석(R-GEM·신규 무료·daniel 07-23)
  attach: '2026-08-08', // 애착유형(명식×설문 비교·신규 무료·daniel 08-08)
  crisis: '2026-08-10', // 관계의 고비(이별·삼각·신규 무료·기획 §6-4)
};

/**
 * 이 콘텐츠 키가 지금 'NEW' 배지 대상인가(출시일 + 노출기간 내).
 * @param key contentSections MenuItem.key 또는 market CreditKind
 * @param now 기준 시각(기본 현재) — 테스트 주입용
 */
export function isNewContent(key: string, now: Date = new Date()): boolean {
  // ★관리자 원격 토글이 **먼저**다(daniel 2026-08-11 "관리자 페이지에서 컨텐츠 new 토글").
  //   지정돼 있으면 그 값이 이기고, 안 건드렸으면(undefined) 아래 날짜 규칙으로 떨어진다.
  //   ⇒ 재빌드 없이 켜고 끌 수 있다. 사본 키(hot*)도 원본과 같은 판정을 쓰도록 baseKey 로 한 번 더 본다.
  const ov = newOverride(key) ?? newOverride(baseKey(key));
  if (ov !== undefined) return ov;

  // ★'인기' 섹션 사본(hot*)은 원본과 같은 콘텐츠 → 같은 출시일을 쓴다(사본 키를 위 표에 또 적지 않는다).
  const since = NEW_SINCE[key] ?? NEW_SINCE[baseKey(key)];
  if (!since) return false;
  const start = new Date(`${since}T00:00:00`);
  if (isNaN(start.getTime())) return false;
  const elapsed = now.getTime() - start.getTime();
  return elapsed >= 0 && elapsed < NEW_WINDOW_DAYS * 86400000;
}
