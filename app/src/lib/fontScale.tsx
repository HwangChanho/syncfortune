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

// 단계(설정 UI) — 라벨·배율. '보통'=1.0 기준.
export const FONT_STEPS: { key: string; ko: string; scale: number }[] = [
  { key: 'sm', ko: '작게', scale: 0.9 },
  { key: 'md', ko: '보통', scale: 1.0 },
  { key: 'lg', ko: '크게', scale: 1.15 },
  { key: 'xl', ko: '아주 크게', scale: 1.3 },
];

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
  const [scale, setScaleState] = useState(1);
  useEffect(() => { getRaw().then((v) => { const n = Number(v); if (n >= 0.8 && n <= 1.6) setScaleState(n); }); }, []);
  const setScale = (s: number) => { setScaleState(s); setRaw(String(s)); };
  return <FontScaleContext.Provider value={{ scale, setScale }}>{children}</FontScaleContext.Provider>;
}

/** 현재 배율 + 본문 크기 헬퍼. fs(15) → 스케일 곱한 px. 읽는 본문에 사용. */
export function useFontScale() {
  const { scale, setScale } = useContext(FontScaleContext);
  const fs = (px: number) => Math.round(px * scale);
  return { scale, setScale, fs };
}
