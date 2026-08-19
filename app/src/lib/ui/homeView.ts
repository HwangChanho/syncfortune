// app/src/lib/ui/homeView.ts — 풀이탭/카테고리 화면의 보기 방식(카드/리스트)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-08-07: **"카드뷰는 눌렀을 때만 그렇게 보이고, 카드뷰로 누르고 종료해도
//   재시작하면 무조건 리스트뷰가 떠야지."**
//   ⇒ 토글은 **이번 실행 동안만** 유효하다. 앱을 껐다 켜면 항상 리스트로 돌아온다.
//   ⇒ 그래서 **저장하지 않는다**(종전엔 SecureStore 에 남겨 다음 실행에도 카드뷰가 유지됐다).
//
// ★그런데 '저장 안 함'을 화면별 useState 로 하면 안 된다 —
//   이 훅의 소비처는 **둘**(풀이탭 contents / 카테고리 화면 category/[key]).
//   각자 state 를 들면 풀이탭에서 카드로 바꾸고 카테고리로 들어갔을 때 다시 리스트로 보인다.
//   ⇒ **모듈 스코프 변수 + 구독자**로 한 값을 공유한다. 이 변수는 JS 런타임이 새로 뜰 때
//     (= 앱 콜드 스타트) 자동으로 DEFAULT_VIEW 로 돌아가므로, '재시작하면 리스트'가 공짜로 성립한다.
//   (같은 값을 여러 곳이 각자 읽어 갈렸던 사고 이력이 있다 — coin 잔액·에겐테토 막대.)
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

/** 표시 방식 — 'card'(이미지 카드 그리드) / 'list'(썸네일 세로 리스트·기본) */
export type HomeViewMode = 'card' | 'list';

/**
 * 앱을 켤 때마다 여기서 시작한다.
 *
 * ★2026-08-19 daniel: **카드**(시안대로). 시안 p05·p14 가 3열 카드 그리드다.
 *   ⚠️2026-08-07 에는 *"재시작하면 무조건 리스트뷰가 떠야지"* 였다 — 그때 카드는
 *     사진이 꽉 찬 무거운 미디어 카드였고, 지금은 시안의 밝은 아이콘 카드다. 물건이 바뀌어 판단도 바뀌었다.
 */
export const DEFAULT_VIEW: HomeViewMode = 'card';

// 이번 실행 동안의 현재 값 + 구독자. 앱이 완전히 종료되면 함께 사라진다(= 다음 실행은 DEFAULT_VIEW).
let _mode: HomeViewMode = DEFAULT_VIEW;
const _subs = new Set<(m: HomeViewMode) => void>();

/**
 * 보기 방식 상태 + 세터. 소비처가 여러 곳이어도 **같은 값**을 본다.
 *  - 값은 저장하지 않는다 → 앱 재시작 시 항상 DEFAULT_VIEW('list').
 *  - setViewMode 는 모든 구독 화면에 즉시 반영된다.
 * @returns { viewMode, setViewMode }
 */
export function useHomeViewMode() {
  const [viewMode, setLocal] = useState<HomeViewMode>(_mode);
  useEffect(() => {
    // 마운트 사이에 다른 화면이 바꿨을 수 있으니 현재 값으로 한 번 맞추고 구독한다.
    setLocal(_mode);
    _subs.add(setLocal);
    return () => { _subs.delete(setLocal); };
  }, []);
  const setViewMode = (m: HomeViewMode) => {
    _mode = m;
    _subs.forEach((fn) => fn(m)); // 구독 중인 화면 전부 갱신(풀이탭 ↔ 카테고리 일치)
  };
  return { viewMode, setViewMode };
}
