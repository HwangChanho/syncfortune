// app/src/lib/fontScale.tsx — 앱 글자 크기(통변 가독성) 전역 스케일 (설정에서 조절)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 '읽는 본문'에 곱해지는 배율(0.9~1.4)을 전역 보관.
//   SecureStore(native)/localStorage(web)에 저장 → 앱 재시작에도 유지. Context 로 즉시 반영.
//   ※ 본문(읽기) 텍스트에 적용 — `fs(base)` 헬퍼로 fontSize·lineHeight 를 곱한다(버튼/라벨 chrome 은 고정).
// ─────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'font_scale_v1';

// 단계(설정 UI) — 라벨·배율. 기본 = 크게(1.3) — daniel.
// ★2026-07-27(daniel "글자 작게 아주 작게는 없애줘"): **작은 단계를 없앴다.**
//   원래 최소는 '작게'(1.0)였고 '아주 작게'는 존재한 적이 없다 — 작은 쪽 끝을 걷어내라는 뜻으로 읽었다.
//   남은 3단 = 중간·크게·아주 크게. 최소 배율이 1.15 로 올라간다.
export const FONT_STEPS: { key: string; ko: string; scale: number }[] = [
  { key: 'md', ko: '중간', scale: 1.15 },
  { key: 'lg', ko: '크게', scale: 1.3 },
  { key: 'xl', ko: '아주 크게', scale: 1.45 },
];

export const DEFAULT_SCALE = 1.3; // 기본 글자 배율 = 크게
/** 남은 단계의 최소 배율 — 이보다 작게 저장돼 있던 기기(구버전 '작게' 1.0 등)를 끌어올리는 기준. */
export const MIN_SCALE = 1.15;

async function getRaw(): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}
async function setRaw(v: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(KEY, v);
  else await SecureStore.setItemAsync(KEY, v);
}

type Ctx = { scale: number; setScale: (s: number) => void };
const FontScaleContext = createContext<Ctx>({ scale: 1, setScale: () => {} });

/** 앱 루트에 감싸 전역 글자 배율 제공. 저장값을 1회 로드. */
export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState(DEFAULT_SCALE); // 기본 = 아주 크게
  // 저장값이 남은 단계 범위(1.15~1.45)면 적용. 그보다 작거나(구버전 '작게' 1.0·0.9) 미설정이면 기본(1.3)으로 끌어올린다.
  //   ★이 마이그레이션이 없으면 '작게'를 골라 뒀던 기기는 선택지에서 사라진 값을 계속 쓴다(설정 화면과 실제가 어긋남).
  useEffect(() => { getRaw().then((v) => { const n = Number(v); setScaleState(n >= MIN_SCALE && n <= 1.6 ? n : DEFAULT_SCALE); }); }, []);
  const setScale = (s: number) => { setScaleState(s); setRaw(String(s)); };
  return <FontScaleContext.Provider value={{ scale, setScale }}>{children}</FontScaleContext.Provider>;
}

/** 현재 배율 + 본문 크기 헬퍼. fs(15) → 스케일 곱한 px. 읽는 본문에 사용. */
export function useFontScale() {
  const { scale, setScale } = useContext(FontScaleContext);
  const fs = (px: number) => Math.round(px * scale);
  return { scale, setScale, fs };
}
