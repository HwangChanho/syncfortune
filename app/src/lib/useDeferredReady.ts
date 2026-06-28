// app/src/lib/useDeferredReady.ts — 무거운 화면의 '전환 멈칫' 제거 훅(daniel 2026-06-28)
// ─────────────────────────────────────────────────────────────────────────
// 문제: computeChart(사주/자미 엔진) + 거대 렌더트리(명식 1300줄·일주론 60갑자)를 첫 렌더에서 동기로
//   돌리면, 네비게이션 전환 애니가 JS 스레드 블록으로 '멈칫'한다(daniel: "컨텐츠 넘어가는 속도가 느려").
// 해법: 전환 애니가 끝난 뒤(InteractionManager.runAfterInteractions) 콘텐츠를 마운트한다. 그 사이엔
//   가벼운 스켈레톤([[Skeleton]])을 그려 화면이 *즉시* 뜨고, 무거운 계산은 전환이 끝난 뒤 수행 → 부드럽다.
//   ※ charts.tsx·ChartPicker 가 쓰던 인라인 패턴을 한 훅으로 표준화(중복 제거·일관 적용).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { InteractionManager } from 'react-native';

/**
 * 네비 전환(인터랙션) 완료 후 true. 무거운 화면은 false 동안 스켈레톤을 그리고, true가 되면 콘텐츠를 마운트.
 * @returns ready — false=전환 중(스켈레톤) / true=콘텐츠 마운트 가능
 */
export function useDeferredReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // 전환 애니/제스처가 모두 끝난 뒤 1회 — 그 전까지 무거운 계산·렌더를 미뤄 전환을 매끄럽게.
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel(); // 언마운트 시 콜백 취소(전환 중 이탈 대비)
  }, []);
  return ready;
}
