// app/src/lib/useDeferredReady.ts — 무거운 화면의 '전환 멈칫' 제거 훅(daniel 2026-06-28)
// ─────────────────────────────────────────────────────────────────────────
// 문제: computeChart(사주/자미 엔진) + 거대 렌더트리(명식 1300줄·일주론 60갑자)를 첫 렌더에서 동기로
//   돌리면, 네비게이션 전환 애니가 JS 스레드 블록으로 '멈칫'한다(daniel: "컨텐츠 넘어가는 속도가 느려").
// 해법: 전환 애니가 끝난 뒤(InteractionManager.runAfterInteractions) 콘텐츠를 마운트한다. 그 사이엔
//   가벼운 스켈레톤([[Skeleton]])을 그려 화면이 *즉시* 뜨고, 무거운 계산은 전환이 끝난 뒤 수행 → 부드럽다.
//   ※ charts.tsx·ChartPicker 가 쓰던 인라인 패턴을 한 훅으로 표준화(중복 제거·일관 적용).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { InteractionManager, Platform } from 'react-native';

/**
 * 네비 전환(인터랙션) 완료 후 true. 무거운 화면은 false 동안 스켈레톤을 그리고, true가 되면 콘텐츠를 마운트.
 * @returns ready — false=전환 중(스켈레톤) / true=콘텐츠 마운트 가능
 *
 * ★★웹 분기(2026-08-16 실측) — **웹에서는 이 훅이 영영 안 풀렸다.**
 *   `InteractionManager.runAfterInteractions` 가 react-native-web 에서 끝나지 않아
 *   `ready` 가 계속 false → 만세력(`/myeongsik`)·내 명식(`/charts`)이 **44초를 기다려도 스켈레톤**이었다.
 *   에러가 안 나서 "명식이 없어서 비었나 보다"로 오해하기 딱 좋은 증상이다(실제로 내가 그렇게 넘겨짚었다).
 *   ⇒ 웹은 `requestAnimationFrame` 두 번으로 **첫 페인트만 넘긴다**: 스켈레톤이 한 프레임 보이고 곧 콘텐츠.
 *     (한 번이면 같은 프레임에 묶여 스켈레톤이 안 보이고, 무거운 계산이 첫 페인트를 다시 막는다.)
 *   ⚠️네이티브 경로는 그대로 둔다 — 전환 애니 중 무거운 렌더를 미루는 원래 목적이 살아 있어야 한다.
 */
export function useDeferredReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      // ★`requestAnimationFrame` 은 **백그라운드 탭에서 아예 안 돈다**(2026-08-17 실측 — 그래서
      //   탭을 뒤에 두고 열면 만세력이 영영 스켈레톤이었다. 앞서 rAF 로 고친 게 이 구멍을 남겼다).
      //   목적은 '첫 페인트만 넘기기'이므로 타이머면 충분하고, 타이머는 백그라운드에서도 진행된다.
      const timer = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(timer);
    }
    // 전환 애니/제스처가 모두 끝난 뒤 1회 — 그 전까지 무거운 계산·렌더를 미뤄 전환을 매끄럽게.
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel(); // 언마운트 시 콜백 취소(전환 중 이탈 대비)
  }, []);
  return ready;
}

/**
 * **상호작용이 끝난 뒤 한 번** 실행 — 웹/네이티브를 함께 다루는 단일 창구.
 *
 * ■ ⚠️★`InteractionManager.runAfterInteractions` 는 **웹에서 콜백이 안 온다**
 *   (위 훅 주석의 그 문제). 화면을 여는 데 쓰면 **영영 스켈레톤**,
 *   백그라운드 작업에 쓰면 **그 작업이 통째로 안 돈다.**
 * ■ 실제 피해: 2026-08-16 만세력 44초 스켈레톤 · 2026-08-28 `/dayPillar` 영구 스켈레톤 ·
 *   웹 로그인 시 **구매분 이관(`migrateLocalCreditsOnLogin`)과 prefetch 가 아예 안 돌고 있었다.**
 * ■ ⇒ 웹은 타이머 0(첫 페인트만 넘긴다 · rAF 는 백그라운드 탭에서 안 돈다), 네이티브는 원래대로.
 *
 * @param fn 한 번 실행할 일
 * @returns 취소 함수 — `useEffect` 의 정리에서 부른다
 */
export function afterInteractions(fn: () => void): () => void {
  if (Platform.OS === 'web') {
    const id = setTimeout(fn, 0);
    return () => clearTimeout(id);
  }
  const task = InteractionManager.runAfterInteractions(fn);
  return () => task.cancel();
}
