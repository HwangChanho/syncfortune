// engine/sipsinGroup.ts — 오행 → **십신 그룹** 단일 원본
// ═══════════════════════════════════════════════════════════════════════════
// 왜 엔진에 두나 (2026-08-24):
//   같은 표가 **두 곳에** 있었다 — `components/YongsinCard.tsx` 의 `sipsinGroup()` 과
//   개운 모듈. 한쪽만 고치면 만세력 안에서 **같은 오행이 다른 십신으로** 보인다.
//   순수 함수라 RN 의존이 없고, 여기 두면 하네스가 node 로 직접 검증할 수 있다
//   (앱 안에 두면 `react-native/index.js` 때문에 tsx 로 못 돌린다 — 실제로 막혔다).
// ═══════════════════════════════════════════════════════════════════════════

/** 오행 다섯. */
export type Elem5 = '木' | '火' | '土' | '金' | '水';
/** 십신 5그룹(음양은 가르지 않는다 — 정재/편재 구분은 별도 축이다). */
export type SipsinGroup = '비겁' | '식상' | '재성' | '관성' | '인성';

/** 生 — A 가 B 를 낳는다. */
export const GEN: Record<Elem5, Elem5> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 剋 — A 가 B 를 친다. */
export const CTRL: Record<Elem5, Elem5> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/**
 * 일간 오행 기준, 대상 오행의 십신 그룹.
 *
 *   같다        → 비겁   (나와 같은 것)
 *   내가 生한다  → 식상   (내가 내보내는 것)
 *   내가 剋한다  → 재성   (내가 다루는 것)
 *   나를 剋한다  → 관성   (나를 누르는 것)
 *   나를 生한다  → 인성   (나를 받치는 것)
 *
 * @param day    일간 오행
 * @param target 대상 오행
 */
export function sipsinGroupOf(day: Elem5, target: Elem5): SipsinGroup {
  if (target === day) return '비겁';
  if (GEN[day] === target) return '식상';
  if (CTRL[day] === target) return '재성';
  if (CTRL[target] === day) return '관성';
  return '인성';
}
