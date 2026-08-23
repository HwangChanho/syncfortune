// app/src/lib/core/lastCompat.ts — **마지막으로 본 궁합 쌍**(나·상대·관계) 기억
// ─────────────────────────────────────────────────────────────────────────
// ★왜 화면 밖으로 뺐나(2026-08-23)
//   원래 `screens/CompatScreen.tsx` 안에 있었다. 그런데 이걸 쓰려는 쪽이 셋으로 늘었다 —
//   관계 지도 · 명식 목록('궁합 보기' 말풍선) · 궁합 화면 자신.
//   앞의 둘이 값 하나 때문에 **궁합 화면 모듈 전체**(등록 폼·결제·통변 로더까지)를 끌어오게 된다.
//   특히 명식 목록(ChartPicker)은 **홈에 떠 있는** 컴포넌트라, 홈이 궁합 화면을 통째로 평가하게 된다.
//   ⇒ 값만 따로 둔다. 화면은 화면 일만 한다.
//
// ⚠️왜 SecureStore 인가 (2026-07-27 사고)
//   daniel: *"홈에는 궁합 완성됐다고 뜨는데 탭해서 들어가면 상대명식부터 다시 지정해야해"*
//   원인: 이 값이 **모듈 전역 변수**뿐이라 앱을 껐다 켜면 사라졌다. 그런데 홈 배너(genProgress)는
//   SecureStore 에 저장돼 살아남는다 — "완성됐다"는 배너만 남고 **어느 쌍이었는지 잊은 상태**가 됐다.
//   두 값의 **수명이 달라서** 난 어긋남이다. ⇒ 배너와 같은 저장소로 맞춘다.
//
// ※ 명식 id 만 담는다(생년월일 등 PII 없음 — 규칙8). 그 id 가 지워졌으면 조용히 복원하지 않는다.
// ─────────────────────────────────────────────────────────────────────────
import * as SecureStore from 'expo-secure-store';

/** 마지막으로 본 궁합 쌍. 모두 선택 — 없으면 궁합 화면이 대표 명식으로 채운다. */
export type LastCompat = { meId?: string; otherId?: string; rel?: string };

const LAST_KEY = 'compatLast_v1';   // ⚠️SecureStore 키는 영숫자·._- 만(콜론 불가)
let _lastCompat: LastCompat = {};

/**
 * 마지막으로 본 궁합 쌍을 기억한다.
 *
 * @param v 나·상대 명식 id 와 관계 유형(부분만 채워도 된다)
 *
 * ★다른 화면에서 "이 사람과 궁합"을 열 때도 이걸 쓴다 — 궁합 라우트에 새 파라미터를 뚫지 않는다.
 *   경로가 둘이 되면 한쪽만 고쳐지는 사고가 난다([[duplicate-ui-single-source]]).
 * ⚠️저장 실패는 무시한다 — 복원은 편의지 정확성이 아니다.
 */
export function saveLastCompat(v: LastCompat): void {
  _lastCompat = v;
  SecureStore.setItemAsync(LAST_KEY, JSON.stringify(v)).catch(() => {});
}

/**
 * 복원 — 앱 시작 후 첫 진입에서 1회.
 * @returns 기억된 쌍. 없거나 읽기 실패면 빈 객체(등록 폼이 뜨는 종전 동작).
 */
export async function loadLastCompat(): Promise<LastCompat> {
  if (_lastCompat.meId || _lastCompat.otherId) return _lastCompat;   // 메모리에 있으면 그것
  try {
    const raw = await SecureStore.getItemAsync(LAST_KEY);
    if (raw) _lastCompat = JSON.parse(raw);
  } catch { /* 무시 — 빈 값으로 둔다 */ }
  return _lastCompat;
}
