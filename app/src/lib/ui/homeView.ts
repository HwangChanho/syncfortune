// app/src/lib/ui/homeView.ts — 홈 화면 보기 방식(카드/리스트) 저장·토글 (daniel)
// ─────────────────────────────────────────────────────────────────────────
// daniel: "홈에서 카드뷰 ↔ 리스트뷰를 바꿔서 볼 수 있게, 선택은 유지되게."
//   fontScale.tsx 와 *동일한 저장 방식*(native=SecureStore / web=localStorage)으로 앱 재시작에도 유지.
//   단, 이 값은 홈 화면 한 곳에서만 쓰므로 fontScale 처럼 전역 Context 를 두지 않고,
//   자체 hook(로컬 state + 저장)으로 최소·단순하게 구현한다(단일 책임·확장 용이).
//   기본 = 'card' — 카드뷰가 기존 기본이며 불변(리스트는 opt-in 보조 뷰).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** 홈 메뉴 표시 방식 — 'card'(이미지 카드 그리드·기본) / 'list'(썸네일 세로 리스트) */
export type HomeViewMode = 'card' | 'list';

const KEY = 'home_view_mode_v1'; // 저장 키(버전 접미사 — 향후 스키마 변경 대비)
export const DEFAULT_VIEW: HomeViewMode = 'card'; // 기본 = 카드뷰(기존 유지)

// 저장소 접근(플랫폼 분기) — fontScale.tsx 의 getRaw/setRaw 패턴을 그대로 미러.
async function getRaw(): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}
async function setRaw(v: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(KEY, v);
  else await SecureStore.setItemAsync(KEY, v);
}

/**
 * 홈 보기 방식(카드/리스트) 상태 + 토글 세터.
 *  - 마운트 시 저장값 1회 로드('card'/'list'만 인정, 그 외·미설정은 기본 'card').
 *  - setViewMode 호출 시 즉시 반영 + 저장(다음 실행에도 유지).
 * @returns { viewMode, setViewMode }
 */
export function useHomeViewMode() {
  const [viewMode, setMode] = useState<HomeViewMode>(DEFAULT_VIEW);
  useEffect(() => {
    getRaw().then((v) => { if (v === 'card' || v === 'list') setMode(v); }).catch(() => {});
  }, []);
  const setViewMode = (m: HomeViewMode) => { setMode(m); setRaw(m).catch(() => {}); };
  return { viewMode, setViewMode };
}
